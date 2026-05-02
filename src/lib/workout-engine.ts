import * as ort from 'onnxruntime-web';

if (typeof window !== 'undefined') {
  ort.env.wasm.wasmPaths = '/onnx/';
  ort.env.wasm.numThreads = 1;
}

export interface Keypoint {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  confidence: number;
}

export interface PoseResult {
  keypoints: Keypoint[]; // 17 points for COCO format
}

let session: ort.InferenceSession | null = null;
let isModelLoading = false;
let loadPromise: Promise<void> | null = null;

// ── Temporal smoothing (EMA) — eliminates skeleton jumping between frames —
// Blends each new detection with the previous frame's position.
const SMOOTH = 0.6; // increased for more stable skeleton
let prevKeypoints: Array<{ x: number; y: number; confidence: number }> | null = null;

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export const COCO_KEYPOINTS = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
];

export const CONNECTING_LINES = [
  [0, 1], [0, 2], [1, 3], [2, 4],  // Face
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10], // Arms
  [5, 11], [6, 12], [11, 12], // Torso
  [11, 13], [13, 15], [12, 14], [14, 16] // Legs
];

export async function loadWorkoutModel(): Promise<void> {
  if (session) return; // already loaded
  if (loadPromise) return loadPromise; // already loading — wait on same promise

  loadPromise = (async () => {
    isModelLoading = true;
    try {
      console.log('[WorkoutEngine] Loading WorkoutNet V2...');
      session = await ort.InferenceSession.create('/models/workoutnet_v2.onnx', {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      console.log('[WorkoutEngine] Model loaded. Inputs:', session.inputNames, 'Outputs:', session.outputNames);
    } catch (err) {
      console.error('[WorkoutEngine] Failed to load model:', err);
      session = null;
      loadPromise = null; // allow retry
      throw err; // propagate so initWorkoutNet catches it
    } finally {
      isModelLoading = false;
    }
  })();

  return loadPromise;
}

export async function runPoseInference(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<PoseResult | null> {
  if (!session) return null;

  try {
    const inputSize = 256;

    const pCanvas = document.createElement('canvas');
    pCanvas.width  = inputSize;
    pCanvas.height = inputSize;
    const ctx = pCanvas.getContext('2d')!;

    let sWidth = 0, sHeight = 0;
    if (source instanceof HTMLVideoElement) {
      sWidth  = source.videoWidth;
      sHeight = source.videoHeight;
    } else if (source instanceof HTMLImageElement) {
      sWidth  = source.naturalWidth;
      sHeight = source.naturalHeight;
    } else {
      sWidth  = source.width;
      sHeight = source.height;
    }

    if (sWidth === 0 || sHeight === 0) return null;

    const sz = Math.min(sWidth, sHeight);
    const ox = (sWidth  - sz) / 2;
    const oy = (sHeight - sz) / 2;
    ctx.drawImage(source, ox, oy, sz, sz, 0, 0, inputSize, inputSize);

    const imgData  = ctx.getImageData(0, 0, inputSize, inputSize);
    const floatData = new Float32Array(3 * inputSize * inputSize);
    const mean = [0.485, 0.456, 0.406];
    const std  = [0.229, 0.224, 0.225];

    for (let i = 0; i < inputSize * inputSize; i++) {
      floatData[0 * inputSize * inputSize + i] = (imgData.data[i * 4 + 0] / 255.0 - mean[0]) / std[0];
      floatData[1 * inputSize * inputSize + i] = (imgData.data[i * 4 + 1] / 255.0 - mean[1]) / std[1];
      floatData[2 * inputSize * inputSize + i] = (imgData.data[i * 4 + 2] / 255.0 - mean[2]) / std[2];
    }

    const tensor = new ort.Tensor('float32', floatData, [1, 3, inputSize, inputSize]);

    const inputName  = session.inputNames[0];
    const outputName = session.outputNames[0];
    const outputs    = await session.run({ [inputName]: tensor });
    const heatmaps   = outputs[outputName].data as Float32Array;

    const numKeypoints = 17;
    const mapSize      = 64;
    const keypoints: Keypoint[] = [];

    for (let k = 0; k < numKeypoints; k++) {
      let maxVal = -Infinity;
      let maxIdx = -1;
      const offset = k * mapSize * mapSize;
      for (let i = 0; i < mapSize * mapSize; i++) {
        if (heatmaps[offset + i] > maxVal) {
          maxVal = heatmaps[offset + i];
          maxIdx = i;
        }
      }
      keypoints.push({
        x:          (maxIdx % mapSize) / mapSize,
        y:          Math.floor(maxIdx / mapSize) / mapSize,
        // CRITICAL: sigmoid converts raw logits → true 0-1 probabilities
        // Without this, threshold 0.35 lets garbage keypoints through
        confidence: sigmoid(maxVal),
      });
    }

    // ── EMA temporal smoothing — blend new detection with previous frame ──
    // Prevents skeleton from jumping when model is uncertain on one frame
    if (prevKeypoints && prevKeypoints.length === keypoints.length) {
      for (let i = 0; i < keypoints.length; i++) {
        const cur  = keypoints[i];
        const prev = prevKeypoints[i];
        // Only smooth high-confidence detections; let low-conf ones fall through
        if (cur.confidence > 0.3 && prev.confidence > 0.3) {
          cur.x = prev.x * SMOOTH + cur.x * (1 - SMOOTH);
          cur.y = prev.y * SMOOTH + cur.y * (1 - SMOOTH);
        }
        cur.confidence = prev.confidence * 0.3 + cur.confidence * 0.7;
      }
    }
    prevKeypoints = keypoints.map(k => ({ ...k }));

    return { keypoints };
  } catch (error) {
    console.error('[WorkoutEngine] Inference error:', error);
    return null;
  }
}
