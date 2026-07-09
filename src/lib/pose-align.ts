/**
 * @fileOverview FitJourney Pose-based Image Alignment library.
 * Reuses the FitJourneyNet V3 ONNX model to align progress photos into a canonical frame.
 */

import * as ort from 'onnxruntime-web';

export interface Keypoint {
  name: string;
  x: number; // relative to original canvas dimensions
  y: number; // relative to original canvas dimensions
  confidence: number;
  visible: boolean;
}

export interface AlignmentTransform {
  aligned: boolean;
  reason?: string;
  matrix?: {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
  };
  outputWidth?: number;
  outputHeight?: number;
  scanMode?: 'torso' | 'full_body';
}

let poseSession: ort.InferenceSession | null = null;
let isLoadingPromise: Promise<void> | null = null;

// Initialize and load the pose model (reusing the same NPM ort pattern)
export async function loadPoseModel(): Promise<void> {
  if (poseSession) return;
  if (isLoadingPromise) return isLoadingPromise;

  isLoadingPromise = (async () => {
    try {
      console.log('[PoseAlign] Loading FitJourneyNet V3 (fitjourney_net_v3.onnx)...');
      poseSession = await ort.InferenceSession.create('/models/fitjourney_net_v3.onnx', {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      console.log('[PoseAlign] FitJourneyNet V3 model loaded successfully.');
    } catch (err) {
      console.error('[PoseAlign] Failed to load pose model:', err);
      isLoadingPromise = null;
      throw err;
    }
  })();

  return isLoadingPromise;
}

// Detect shoulders, hips, and ankles using 256x256 ImageNet preprocessing
export async function detectAlignmentKeypoints(canvas: HTMLCanvasElement): Promise<Keypoint[]> {
  await loadPoseModel();
  if (!poseSession) {
    throw new Error('Pose model session could not be initialized.');
  }

  // Preprocess: draw to 256x256 offscreen canvas
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 256;
  tempCanvas.height = 256;
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })!;
  tempCtx.drawImage(canvas, 0, 0, 256, 256);
  const imgData = tempCtx.getImageData(0, 0, 256, 256);

  const mean = [0.485, 0.456, 0.406];
  const std  = [0.229, 0.224, 0.225];
  const hw = 256 * 256;
  const floatData = new Float32Array(3 * hw);

  // Normalize image data to float array in CHW layout
  for (let i = 0; i < hw; i++) {
    floatData[i]          = (imgData.data[i * 4 + 0] / 255.0 - mean[0]) / std[0];
    floatData[hw + i]     = (imgData.data[i * 4 + 1] / 255.0 - mean[1]) / std[1];
    floatData[hw * 2 + i] = (imgData.data[i * 4 + 2] / 255.0 - mean[2]) / std[2];
  }

  const tensor = new ort.Tensor('float32', floatData, [1, 3, 256, 256]);
  const outputs = await poseSession.run({ [poseSession.inputNames[0]]: tensor });
  const heatmaps = outputs[poseSession.outputNames[0]].data as Float32Array;

  const keypoints: Keypoint[] = [];
  const kpNames = [
    'nose',
    'left_shoulder', 'right_shoulder',
    'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist',
    'left_hip', 'right_hip',
    'left_knee', 'right_knee',
    'left_ankle', 'right_ankle'
  ];

  // Decode raw heatmap logits (sigmoid + argmax)
  for (let k = 0; k < 13; k++) {
    const offset = k * 64 * 64;
    let maxVal = -Infinity;
    let maxIdx = -1;
    for (let i = 0; i < 64 * 64; i++) {
      if (heatmaps[offset + i] > maxVal) {
        maxVal = heatmaps[offset + i];
        maxIdx = i;
      }
    }

    const col = maxIdx % 64;
    const row = Math.floor(maxIdx / 64);
    const confidence = 1 / (1 + Math.exp(-maxVal)); // sigmoid confidence

    // Scale back coordinates to the original canvas dimensions
    const x = ((col + 0.5) / 64) * canvas.width;
    const y = ((row + 0.5) / 64) * canvas.height;

    keypoints.push({
      name: kpNames[k],
      x,
      y,
      confidence,
      visible: confidence >= 0.25
    });
  }

  return keypoints;
}

// Compute scale, rotation, and translation matrix relative to a canonical frame
export function computeAlignmentTransform(
  keypoints: Keypoint[]
): AlignmentTransform {
  const getKp = (name: string) => keypoints.find(k => k.name === name);

  const lShoulder = getKp('left_shoulder');
  const rShoulder = getKp('right_shoulder');
  const lHip = getKp('left_hip');
  const rHip = getKp('right_hip');
  const lAnkle = getKp('left_ankle');
  const rAnkle = getKp('right_ankle');

  const thresh = 0.25;

  const shouldersVisible = lShoulder && rShoulder && lShoulder.confidence >= thresh && rShoulder.confidence >= thresh;
  const hipsVisible = lHip && rHip && lHip.confidence >= thresh && rHip.confidence >= thresh;
  const anklesVisible = lAnkle && rAnkle && lAnkle.confidence >= thresh && rAnkle.confidence >= thresh;

  // Failure Condition: shoulders are always mandatory, and we need either hips OR ankles
  if (!shouldersVisible || (!hipsVisible && !anklesVisible)) {
    return { aligned: false, reason: 'low_confidence' };
  }

  // Anchor Point A: Shoulder Midpoint
  const ax = (lShoulder.x + rShoulder.x) / 2;
  const ay = (lShoulder.y + rShoulder.y) / 2;
  const A = { x: ax, y: ay };

  let B: { x: number; y: number };
  let scanMode: 'torso' | 'full_body';
  let TA: { x: number; y: number };
  let TB: { x: number; y: number };

  const outputWidth = 600;
  const outputHeight = 800;

  // Target Anchor A: Shoulder midpoint at 50% width / 20% height
  TA = { x: 300, y: 160 };

  if (anklesVisible) {
    // Full body scan is preferred if ankles are present (longer baseline)
    const bx = (lAnkle!.x + rAnkle!.x) / 2;
    const by = (lAnkle!.y + rAnkle!.y) / 2;
    B = { x: bx, y: by };
    TB = { x: 300, y: 720 }; // Ankle midpoint at 50% width / 90% height
    scanMode = 'full_body';
  } else {
    // Torso scan using hips as the anchor
    const bx = (lHip!.x + rHip!.x) / 2;
    const by = (lHip!.y + rHip!.y) / 2;
    B = { x: bx, y: by };
    TB = { x: 300, y: 520 }; // Hip midpoint at 50% width / 65% height
    scanMode = 'torso';
  }

  // Solve transform equations
  const srcVec = { x: B.x - A.x, y: B.y - A.y };
  const L_src = Math.sqrt(srcVec.x * srcVec.x + srcVec.y * srcVec.y);
  if (L_src < 1) {
    return { aligned: false, reason: 'invalid_geometry' };
  }

  const tgtVec = { x: TB.x - TA.x, y: TB.y - TA.y };
  const L_tgt = Math.sqrt(tgtVec.x * tgtVec.x + tgtVec.y * tgtVec.y);

  const s = L_tgt / L_src;
  const theta_src = Math.atan2(srcVec.y, srcVec.x);
  const theta_tgt = Math.atan2(tgtVec.y, tgtVec.x);
  const theta = theta_tgt - theta_src;

  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // Matrix factors for 2D context affine transformation:
  // x_new = a*x + c*y + e
  // y_new = b*x + d*y + f
  const a = s * cosT;
  const b = s * sinT;
  const c = -s * sinT;
  const d = s * cosT;

  const e = TA.x - a * A.x - c * A.y;
  const f = TA.y - b * A.x - d * A.y;

  return {
    aligned: true,
    matrix: { a, b, c, d, e, f },
    outputWidth,
    outputHeight,
    scanMode
  };
}

// Apply transformation to create an aligned canvas
export function alignPhoto(
  canvas: HTMLCanvasElement,
  transform: AlignmentTransform
): HTMLCanvasElement {
  if (!transform.aligned || !transform.matrix) {
    throw new Error('Cannot align canvas with invalid pose transform.');
  }

  const outWidth = transform.outputWidth || 600;
  const outHeight = transform.outputHeight || 800;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outWidth;
  outCanvas.height = outHeight;
  const outCtx = outCanvas.getContext('2d')!;

  // Clean background fill
  outCtx.fillStyle = 'rgb(240, 240, 240)';
  outCtx.fillRect(0, 0, outWidth, outHeight);

  // Apply matrix and draw original image
  const m = transform.matrix;
  outCtx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  outCtx.drawImage(canvas, 0, 0);

  return outCanvas;
}

// Dev-only pose drawing utility for overlay verification
export function drawPoseDebug(
  canvas: HTMLCanvasElement,
  keypoints: Keypoint[]
): HTMLCanvasElement {
  const debugCanvas = document.createElement('canvas');
  debugCanvas.width = canvas.width;
  debugCanvas.height = canvas.height;
  const ctx = debugCanvas.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0);

  // Connect limbs
  const lines = [
    ['left_shoulder', 'right_shoulder'],
    ['left_shoulder', 'left_hip'],
    ['right_shoulder', 'right_hip'],
    ['left_hip', 'right_hip'],
    ['left_hip', 'left_knee'],
    ['left_knee', 'left_ankle'],
    ['right_hip', 'right_knee'],
    ['right_knee', 'right_ankle']
  ];

  ctx.lineWidth = 3;
  ctx.strokeStyle = '#3b82f6'; // Blue skeleton lines

  for (const [p1Name, p2Name] of lines) {
    const p1 = keypoints.find(k => k.name === p1Name);
    const p2 = keypoints.find(k => k.name === p2Name);
    if (p1 && p2 && p1.visible && p2.visible) {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  // Draw joints
  for (const kp of keypoints) {
    if (!kp.visible) continue;
    ctx.beginPath();
    ctx.arc(kp.x, kp.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e'; // Green joints
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'white';
    ctx.stroke();

    // Renders text
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    const text = `${kp.name} (${Math.round(kp.confidence * 100)}%)`;
    ctx.strokeText(text, kp.x + 8, kp.y + 4);
    ctx.fillText(text, kp.x + 8, kp.y + 4);
  }

  return debugCanvas;
}

// Convert base64 data URL to HTMLCanvasElement
export function loadImageToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = (e) => reject(new Error('Failed to load image.'));
    img.src = dataUrl;
  });
}
