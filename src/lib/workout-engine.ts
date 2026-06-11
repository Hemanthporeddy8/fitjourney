import * as ort from 'onnxruntime-web';

if (typeof window !== 'undefined') {
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.0/dist/';
  ort.env.wasm.simd = true;
  ort.env.wasm.numThreads = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4;
}

export interface Keypoint {
  name?: string;
  index?: number;
  x: number; // Normalized 0-1 (canvas or video space)
  y: number; // Normalized 0-1
  confidence: number;
  visible?: boolean;
}

export class PoseResult {
  keypoints: Keypoint[];
  upperBodyOnly: boolean;
  legsVisible: boolean;
  hipsVisible: boolean;

  constructor(keypoints: Keypoint[]) {
    this.keypoints = keypoints;
    const hipsVis   = keypoints[7]?.visible || keypoints[8]?.visible || false;
    const kneesVis  = keypoints[9]?.visible || keypoints[10]?.visible || false;
    const anklesVis = keypoints[11]?.visible || keypoints[12]?.visible || false;
    this.upperBodyOnly = hipsVis && !kneesVis && !anklesVis;
    this.legsVisible   = kneesVis && anklesVis;
    this.hipsVisible   = hipsVis;
  }

  kp(name: string): Keypoint | undefined {
    return this.keypoints.find(k => k.name === name);
  }

  kpIdx(i: number): Keypoint {
    return this.keypoints[i];
  }

  /** Angle at B in triangle A-B-C. Returns null if joints not visible. */
  angle(a: string, b: string, c: string): number | null {
    const A = this.kp(a);
    const B = this.kp(b);
    const C = this.kp(c);
    if (!A?.visible || !B?.visible || !C?.visible) return null;
    const v1x = A.x - B.x;
    const v1y = A.y - B.y;
    const v2x = C.x - B.x;
    const v2y = C.y - B.y;
    const dot = v1x * v2x + v1y * v2y;
    const mag = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
    if (mag < 1e-6) return null;
    return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI);
  }

  /** Draw skeleton. sx/sy = canvas scale factors. */
  draw(ctx: CanvasRenderingContext2D, sx: number = 1, sy: number = 1, quality: 'ready' | 'partial' | 'none' = 'ready') {
    const kps = this.keypoints;
    
    // Choose lines based on quality
    const lineColor = quality === 'ready' ? 'rgba(34, 197, 94, 0.92)' : 'rgba(244, 155, 51, 0.92)'; // green or orange

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    for (const [a, b] of CONNECTING_LINES) {
      if (a >= kps.length || b >= kps.length) continue;
      if (!kps[a]?.visible || !kps[b]?.visible) continue;
      
      const isLeg = a >= 7 || b >= 7;
      ctx.strokeStyle = isLeg && this.upperBodyOnly
        ? 'rgba(34, 197, 94, 0.3)'
        : lineColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(kps[a].x * sx, kps[a].y * sy);
      ctx.lineTo(kps[b].x * sx, kps[b].y * sy);
      ctx.stroke();
    }

    // Dots
    for (const kp of kps) {
      if (!kp.visible) continue;
      const x = kp.x * sx;
      const y = kp.y * sy;
      const r = [1, 2, 7, 8, 9, 10].includes(kp.index ?? -1) ? 6 : 5;
      
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.strokeStyle = quality === 'ready' ? '#22c55e' : '#f49b33';
      ctx.lineWidth = 2.5;
      ctx.fill();
      ctx.stroke();
    }
  }
}

// ── Constants ──────────────────────────────────────────────
export const INPUT_SIZE = 256;
export const HEATMAP_SZ = 64;
export const NUM_KP = 13;

const KP_THRESH = [
  0.25, // 0  nose
  0.25, // 1  left_shoulder
  0.25, // 2  right_shoulder
  0.20, // 3  left_elbow
  0.20, // 4  right_elbow
  0.15, // 5  left_wrist
  0.15, // 6  right_wrist
  0.25, // 7  left_hip
  0.25, // 8  right_hip
  0.20, // 9  left_knee
  0.20, // 10 right_knee
  0.15, // 11 left_ankle
  0.15, // 12 right_ankle
];

export const COCO_KEYPOINTS = [
  'nose',
  'left_shoulder', 'right_shoulder',
  'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist',
  'left_hip', 'right_hip',
  'left_knee', 'right_knee',
  'left_ankle', 'right_ankle'
];

export const CONNECTING_LINES = [
  [1, 2], [1, 3], [3, 5], [2, 4], [4, 6], // arms
  [1, 7], [2, 8], [7, 8],                 // torso
  [7, 9], [9, 11], [8, 10], [10, 12],     // legs
  [0, 1], [0, 2],                         // head
];

const SMOOTH = 0.7;
const GHOST_FRAMES = 4;
const IMG_MEAN = [0.485, 0.456, 0.406];
const IMG_STD  = [0.229, 0.224, 0.225];

let session: ort.InferenceSession | null = null;
let isModelLoading = false;
let loadPromise: Promise<void> | null = null;

// Engine state persistent variables (for smoothing across calls to runPoseInference)
const smoothedJoints = Array.from({ length: NUM_KP }, () => ({ x: 0, y: 0, conf: 0, vis: false }));
const ghostFrames = new Array(NUM_KP).fill(0);
let offscreenCanvas: HTMLCanvasElement | null = null;

export async function loadWorkoutModel(): Promise<void> {
  if (session) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    isModelLoading = true;
    try {
      console.log('[WorkoutEngine] Loading FitJourneyNet V3 (13 Keypoints)...');
      session = await ort.InferenceSession.create('/models/fitjourney_net_v3.onnx', {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      console.log('[WorkoutEngine] FitJourneyNet V3 model loaded successfully.');
    } catch (err) {
      console.error('[WorkoutEngine] Failed to load model:', err);
      session = null;
      loadPromise = null;
      throw err;
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
    if (typeof document === 'undefined') return null;

    if (!offscreenCanvas) {
      offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = offscreenCanvas.height = INPUT_SIZE;
    }
    const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true })!;

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

    // We do a square crop first, but map back to source width/height coords to keep overlay perfectly aligned
    const sz = Math.min(sWidth, sHeight);
    const ox = (sWidth - sz) / 2;
    const oy = (sHeight - sz) / 2;

    ctx.drawImage(source, ox, oy, sz, sz, 0, 0, INPUT_SIZE, INPUT_SIZE);
    const imgData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
    const hw = INPUT_SIZE * INPUT_SIZE;
    const floatData = new Float32Array(3 * hw);

    for (let i = 0; i < hw; i++) {
      floatData[i]        = (imgData.data[i * 4 + 0] / 255.0 - IMG_MEAN[0]) / IMG_STD[0];
      floatData[hw + i]   = (imgData.data[i * 4 + 1] / 255.0 - IMG_MEAN[1]) / IMG_STD[1];
      floatData[hw*2 + i] = (imgData.data[i * 4 + 2] / 255.0 - IMG_MEAN[2]) / IMG_STD[2];
    }

    const tensor = new ort.Tensor('float32', floatData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    const outputs = await session.run({ [session.inputNames[0]]: tensor });
    const heatmaps = outputs[session.outputNames[0]].data as Float32Array;

    const raw: any[] = [];
    const hmHw = HEATMAP_SZ * HEATMAP_SZ;

    // Decode raw coordinates
    for (let k = 0; k < NUM_KP; k++) {
      const offset = k * hmHw;
      let maxVal = -Infinity;
      let maxIdx = -1;
      for (let i = 0; i < hmHw; i++) {
        if (heatmaps[offset + i] > maxVal) {
          maxVal = heatmaps[offset + i];
          maxIdx = i;
        }
      }
      
      const col = maxIdx % HEATMAP_SZ;
      const row = Math.floor(maxIdx / HEATMAP_SZ);
      const conf = 1 / (1 + Math.exp(-maxVal)); // sigmoid confidence

      // Normalized coordinates inside the crop box
      const normCropX = (col + 0.5) / HEATMAP_SZ;
      const normCropY = (row + 0.5) / HEATMAP_SZ;

      // Map back to original full video dimensions (0 to 1 normalized)
      const mappedX = (ox + normCropX * sz) / sWidth;
      const mappedY = (oy + normCropY * sz) / sHeight;

      raw.push({
        x: mappedX,
        y: mappedY,
        conf: conf,
        vis: conf >= KP_THRESH[k]
      });
    }

    // Exponential Moving Average Smoothing + Ghost Frame Interpolation
    const keypoints: Keypoint[] = [];
    for (let k = 0; k < NUM_KP; k++) {
      const r = raw[k];
      const s = smoothedJoints[k];

      if (r.vis) {
        if (!s.vis && ghostFrames[k] === 0) {
          s.x = r.x;
          s.y = r.y;
          s.conf = r.conf;
        } else {
          s.x = s.x * (1 - SMOOTH) + r.x * SMOOTH;
          s.y = s.y * (1 - SMOOTH) + r.y * SMOOTH;
          s.conf = s.conf * (1 - SMOOTH) + r.conf * SMOOTH;
        }
        s.vis = true;
        ghostFrames[k] = GHOST_FRAMES;
      } else if (ghostFrames[k] > 0) {
        ghostFrames[k]--;
        s.conf = s.conf * 0.85; // fade confidence
        s.vis = ghostFrames[k] > 0;
      } else {
        s.vis = false;
        s.conf = 0;
      }

      keypoints.push({
        name: COCO_KEYPOINTS[k],
        index: k,
        x: s.x,
        y: s.y,
        confidence: s.conf,
        visible: s.vis
      });
    }

    return new PoseResult(keypoints);
  } catch (error) {
    console.error('[WorkoutEngine] Inference error:', error);
    return null;
  }
}

export interface ExerciseCounterResult {
  reps: number;
  state: string;
  feedback: string;
}

export class ExerciseCounter {
  id: number;
  reps: number;
  state: string;
  plankMs: number;
  _lastTs: number | null;
  _hist: Record<string, number | null>;
  _upperOnly: boolean = false;
  _legsVis: boolean = false;

  constructor(exerciseId: number) {
    this.id = exerciseId;
    this.reps = 0;
    this.state = 'idle';
    this.plankMs = 0;
    this._lastTs = null;
    this._hist = {};
  }

  update(pose: PoseResult, ts: number = Date.now()): ExerciseCounterResult {
    const dt = this._lastTs ? ts - this._lastTs : 16;
    this._lastTs = ts;

    this._upperOnly = pose.upperBodyOnly;
    this._legsVis   = pose.legsVisible;

    switch (this.id) {
      case 1: return this._jumpingJacks(pose);
      case 2: return this._highKnees(pose);
      case 3: return this._squats(pose);
      case 4: return this._pushups(pose);
      case 5: return this._burpees(pose);
      case 6: return this._plank(pose, dt);
      case 7: return this._lunges(pose);
      case 8: return this._crunches(pose);
      case 9: return this._mountainClimbers(pose);
      default: return this._r('unknown exercise');
    }
  }

  reset() {
    this.reps = 0;
    this.state = 'idle';
    this.plankMs = 0;
    this._hist = {};
    this._lastTs = null;
  }

  private _r(feedback: string): ExerciseCounterResult {
    return { reps: this.reps, state: this.state, feedback };
  }

  private _smooth(key: string, val: number | null, alpha: number = 0.35): number | null {
    if (val === null || val === undefined) return this._hist[key] ?? null;
    this._hist[key] = (this._hist[key] ?? val) * (1 - alpha) + val * alpha;
    return this._hist[key];
  }

  private _angle(pose: PoseResult, a: string, b: string, c: string): number | null {
    return this._smooth(`${a}-${b}-${c}`, pose.angle(a, b, c));
  }

  private _jumpingJacks(pose: PoseResult): ExerciseCounterResult {
    const ls = pose.kp('left_shoulder');
    const rs = pose.kp('right_shoulder');
    const lw = pose.kp('left_wrist');
    const rw = pose.kp('right_wrist');

    if (!ls?.visible && !rs?.visible)
      return this._r('step into frame');

    const le = pose.kp('left_elbow');
    const re = pose.kp('right_elbow');

    let open = false;

    if (lw?.visible && ls?.visible) open = open || lw.y < ls.y;
    if (rw?.visible && rs?.visible) open = open || rw.y < rs.y;

    if (!lw?.visible && le?.visible && ls?.visible) open = open || le.y < ls.y;
    if (!rw?.visible && re?.visible && rs?.visible) open = open || re.y < rs.y;

    const lElbowAngle = this._angle(pose, 'left_shoulder', 'left_elbow', 'left_wrist');
    const rElbowAngle = this._angle(pose, 'right_shoulder', 'right_elbow', 'right_wrist');
    if (lElbowAngle !== null && lElbowAngle > 140) open = true;
    if (rElbowAngle !== null && rElbowAngle > 140) open = true;

    const smoothOpen = (this._smooth('open', open ? 1 : 0) ?? 0) > 0.5;

    if (this.state === 'idle' && smoothOpen) this.state = 'open';
    if (this.state === 'open' && !smoothOpen) {
      this.state = 'idle';
      this.reps++;
    }

    const mode = this._upperOnly ? ' (upper body mode)' : '';
    return this._r(smoothOpen ? `arms up ↑${mode}` : `arms down ↓${mode}`);
  }

  private _highKnees(pose: PoseResult): ExerciseCounterResult {
    const lk = pose.kp('left_knee');
    const rk = pose.kp('right_knee');
    const lh = pose.kp('left_hip');
    const rh = pose.kp('right_hip');

    if (this._legsVis) {
      const hipY = (lh?.visible && rh?.visible)
        ? (lh.y + rh.y) / 2
        : (lh?.y ?? rh?.y ?? 128);
      const kneeRaw = (lk?.visible && lk.y < hipY) || (rk?.visible && rk.y < hipY);
      const up = (this._smooth('kneeUp', kneeRaw ? 1 : 0) ?? 0) > 0.5;
      if (this.state === 'idle' && up) this.state = 'up';
      if (this.state === 'up' && !up) {
        this.state = 'idle';
        this.reps++;
      }
      return this._r(up ? 'knee up ↑' : 'knees down');
    }

    const ls = pose.kp('left_shoulder');
    const rs = pose.kp('right_shoulder');
    if (!ls?.visible && !rs?.visible) return this._r('step into frame');

    const shoulderY = ((ls?.y ?? 0) + (rs?.y ?? 0)) / (ls?.visible && rs?.visible ? 2 : 1);
    const baseY = this._smooth('baseY', shoulderY, 0.02) ?? shoulderY;
    const diff  = this._smooth('bounce', baseY - shoulderY, 0.3) ?? 0;

    const bounceUp = diff > 4; // shoulder 4px above average
    if (this.state === 'idle' && bounceUp) this.state = 'up';
    if (this.state === 'up' && !bounceUp) {
      this.state = 'idle';
      this.reps++;
    }
    return this._r(bounceUp ? 'bounce ↑ (shoulder mode)' : 'step in place');
  }

  private _squats(pose: PoseResult): ExerciseCounterResult {
    if (!this._legsVis) {
      return this._r('📱 Move phone lower — need to see knees & ankles');
    }
    const a = this._angle(pose, 'left_hip', 'left_knee', 'left_ankle')
           ?? this._angle(pose, 'right_hip', 'right_knee', 'right_ankle');
    if (a === null) return this._r('stand in frame');
    if (this.state === 'idle' && a < 110) this.state = 'down';
    if (this.state === 'down' && a > 160) {
      this.state = 'idle';
      this.reps++;
    }
    const fb = a < 110 ? `deep squat ↓ ${Math.round(a)}°`
             : a < 140 ? `going down ${Math.round(a)}°`
             : `standing ${Math.round(a)}°`;
    return this._r(fb);
  }

  private _pushups(pose: PoseResult): ExerciseCounterResult {
    const la = this._angle(pose, 'left_shoulder', 'left_elbow', 'left_wrist');
    const ra = this._angle(pose, 'right_shoulder', 'right_elbow', 'right_wrist');
    const a  = la ?? ra;

    if (a !== null) {
      if (this.state === 'idle' && a < 100) this.state = 'down';
      if (this.state === 'down' && a > 155) {
        this.state = 'idle';
        this.reps++;
      }
      return this._r(`elbow ${Math.round(a)}°`);
    }

    const ls = pose.kp('left_shoulder');
    const rs = pose.kp('right_shoulder');
    if (!ls?.visible && !rs?.visible) return this._r('get into pushup position');

    const shY    = ((ls?.y ?? 0) + (rs?.y ?? 0)) / 2;
    const baseY  = this._smooth('pushBaseY', shY, 0.01) ?? shY;
    const diff   = this._smooth('pushDiff', shY - baseY, 0.3) ?? 0;

    const down = diff > 10;
    const up   = diff < -5 && this.state === 'down';
    if (this.state === 'idle' && down) this.state = 'down';
    if (up) {
      this.state = 'idle';
      this.reps++;
    }
    return this._r(down ? 'chest down ↓' : 'push up ↑');
  }

  private _burpees(pose: PoseResult): ExerciseCounterResult {
    const ka = this._angle(pose, 'left_hip', 'left_knee', 'left_ankle')
            ?? this._angle(pose, 'right_hip', 'right_knee', 'right_ankle');
    if (ka === null) return this._r('stand in frame — needs full body');
    if (this.state === 'idle'   && ka < 110) this.state = 'squat';
    if (this.state === 'squat'  && ka > 150) this.state = 'plank';
    if (this.state === 'plank'  && ka < 110) this.state = 'squat2';
    if (this.state === 'squat2' && ka > 160) {
      this.state = 'idle';
      this.reps++;
    }
    return this._r(`phase: ${this.state}`);
  }

  private _plank(pose: PoseResult, dt: number): ExerciseCounterResult {
    const ls = pose.kp('left_shoulder');
    const lh = pose.kp('left_hip');
    const la = pose.kp('left_ankle');
    const rh = pose.kp('right_hip');

    if (this._upperOnly) {
      const ls2 = pose.kp('left_shoulder');
      const rs = pose.kp('right_shoulder');
      if (!ls2?.visible && !rs?.visible) {
        return { reps: Math.floor(this.plankMs / 1000), state: 'idle', feedback: 'get into plank' };
      }
      this.plankMs += dt;
      return { reps: Math.floor(this.plankMs / 1000), state: 'holding', feedback: 'hold position 💪' };
    }

    if (!ls?.visible || !lh?.visible || !la?.visible) {
      return { reps: Math.floor(this.plankMs / 1000), state: 'idle', feedback: 'get into plank position' };
    }

    const spread = Math.max(ls.y, lh.y, la.y) - Math.min(ls.y, lh.y, la.y);
    const holding = (this._smooth('plank', spread < 40 ? 1 : 0) ?? 0) > 0.5;

    if (holding) this.plankMs += dt;

    const hipY = (lh.y + (rh?.y ?? lh.y)) / 2;
    let fb = holding ? 'hold it! 💪' : 'align body straight';
    if (holding && hipY > ls.y + 18) fb = 'lift hips ↑';
    if (holding && hipY < ls.y - 18) fb = 'lower hips ↓';

    return { reps: Math.floor(this.plankMs / 1000), state: holding ? 'holding' : 'idle', feedback: fb };
  }

  private _lunges(pose: PoseResult): ExerciseCounterResult {
    if (!this._legsVis) {
      return this._r('📱 Move phone lower — need to see knees');
    }
    const a = this._angle(pose, 'left_hip', 'left_knee', 'left_ankle')
           ?? this._angle(pose, 'right_hip', 'right_knee', 'right_ankle');
    if (a === null) return this._r('stand in frame');
    if (this.state === 'idle' && a < 110) this.state = 'down';
    if (this.state === 'down' && a > 160) {
      this.state = 'idle';
      this.reps++;
    }
    return this._r(a < 120 ? `lunge ↓ ${Math.round(a)}°` : `standing ${Math.round(a)}°`);
  }

  private _crunches(pose: PoseResult): ExerciseCounterResult {
    const nose = pose.kp('nose');
    const ls   = pose.kp('left_shoulder');
    const lh   = pose.kp('left_hip');
    const rh   = pose.kp('right_hip');
    const topY = nose?.visible ? nose.y : ls?.visible ? ls.y : null;
    const hipY = lh?.visible ? (lh.y + (rh?.y ?? lh.y)) / 2 : null;
    if (topY === null || hipY === null) return this._r('lie down in frame');
    const dist = this._smooth('crunch', Math.abs(topY - hipY)) ?? 100;
    if (this.state === 'idle' && dist < 65)  this.state = 'up';
    if (this.state === 'up'  && dist > 105)  {
      this.state = 'idle';
      this.reps++;
    }
    return this._r(dist < 65 ? 'crunch ↑' : 'lie back ↓');
  }

  private _mountainClimbers(pose: PoseResult): ExerciseCounterResult {
    const lk = pose.kp('left_knee');
    const rk = pose.kp('right_knee');
    const lh = pose.kp('left_hip');
    const rh = pose.kp('right_hip');

    if (lk?.visible || rk?.visible) {
      const hipY = (lh?.visible && rh?.visible) ? (lh.y + rh.y) / 2 : 128;
      const inward = (lk?.visible && lk.y < hipY) || (rk?.visible && rk.y < hipY);
      const sm = (this._smooth('mtnIn', inward ? 1 : 0) ?? 0) > 0.5;
      if (this.state === 'idle' && sm)  this.state = 'in';
      if (this.state === 'in'  && !sm) {
        this.state = 'idle';
        this.reps++;
      }
      return this._r(sm ? 'knee in ↑' : 'extend ↓');
    }

    const ls = pose.kp('left_shoulder');
    const rs = pose.kp('right_shoulder');
    if (!ls?.visible || !rs?.visible) return this._r('get into plank position');

    const diff = ls.y - rs.y;
    const sm   = this._smooth('mtnSh', diff, 0.4) ?? 0;
    const left  = sm >  8;
    const right = sm < -8;
    const active = left || right;
    if (this.state === 'idle'  && active) this.state = 'in';
    if (this.state === 'in'    && !active) {
      this.state = 'idle';
      this.reps++;
    }
    return this._r(active ? 'shoulder shift (upper mode)' : 'hold plank');
  }
}
