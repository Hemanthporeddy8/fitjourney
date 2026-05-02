import { Pose, Results } from '@mediapipe/pose';

// Map Mediapipe's 33 keypoints to our 17 COCO keypoints so UI/Counting doesn't need to change.
const MP_TO_COCO = {
  0: 0,   // nose
  11: 5,  // l_shoulder
  12: 6,  // r_shoulder
  13: 7,  // l_elbow
  14: 8,  // r_elbow
  15: 9,  // l_wrist
  16: 10, // r_wrist
  23: 11, // l_hip
  24: 12, // r_hip
  25: 13, // l_knee
  26: 14, // r_knee
  27: 15, // l_ankle
  28: 16  // r_ankle
};

export const CONNECTING_LINES = [
  // Face lines removed to keep skeleton clean
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10], // Arms
  [5, 11], [6, 12], [11, 12], // Torso
  [11, 13], [13, 15], [12, 14], [14, 16] // Legs
];

let pose: Pose | null = null;
let currentResults: any = null;

export async function loadWorkoutModel() {
  if (pose) return true;
  pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
  });
  pose.setOptions({
    modelComplexity: 1, // 1=full. Better accuracy.
    smoothLandmarks: true, // Internal EMA
    enableSegmentation: false,
    smoothSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  pose.onResults((results: Results) => {
    if (!results.poseLandmarks) {
      currentResults = null;
      return;
    }
    
    // Convert to our ONNX format (COCO 17)
    const keypoints = new Array(17).fill(null).map(() => ({ x: 0, y: 0, confidence: 0 }));
    
    for (const [mpIdxStr, cocoIdx] of Object.entries(MP_TO_COCO)) {
      const mpIdx = parseInt(mpIdxStr);
      const lm = results.poseLandmarks[mpIdx];
      if (lm) {
        keypoints[cocoIdx] = {
          x: lm.x,
          y: lm.y,
          confidence: lm.visibility || 0
        };
      }
    }
    
    currentResults = { keypoints };
  });

  await pose.initialize();
  return true;
}

export async function runPoseInference(video: HTMLVideoElement) {
  if (!pose) return null;
  try {
    await pose.send({ image: video });
    return currentResults;
  } catch (err) {
    console.error('Mediapipe error:', err);
    return null;
  }
}
