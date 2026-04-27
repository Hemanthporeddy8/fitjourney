'use client';

// src/lib/physiquenet.ts
// PhysiqueNet on-device inference
// Photos NEVER leave the device

import * as ort from 'onnxruntime-web';

// Configure WASM paths for Next.js
ort.env.wasm.wasmPaths = '/_next/static/chunks/';

export interface ScanResult {
  bf:        number;   // body fat %
  shape:     number;   // fitness score 0-100
  bmi:       number;   // bmi proxy
  conf:      number;   // confidence 0-1
  fatMass:   number;   // fat in kg
  leanMass:  number;   // lean mass in kg
  coverage:  number;   // mask body coverage %
  category:  string;   // Athlete / Fitness / Average / Above Average
  confLabel: string;   // human readable confidence
  timestamp: number;
}

// Singleton sessions — load once, reuse
let sessionA: ort.InferenceSession | null = null; // PhysiqueNet
let sessionB: ort.InferenceSession | null = null; // Target B

export async function loadModels(
  onProgress?: (msg: string, pct: number) => void
): Promise<void> {
  if (sessionA && sessionB) return;

  onProgress?.('Loading body removal model...', 20);
  sessionB = await ort.InferenceSession.create('/models/target_b.onnx', {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });

  onProgress?.('Loading body composition model...', 70);
  sessionA = await ort.InferenceSession.create('/models/physiquenet_int8.onnx', {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });

  onProgress?.('Models ready!', 100);
}

export function modelsLoaded(): boolean {
  return sessionA !== null && sessionB !== null;
}

// ── IMAGE HELPERS ──────────────────────────────────────────────

function loadImageToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width  = img.width;
      c.height = img.height;
      c.getContext('2d')!.drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// THE CRITICAL FIX — pad to square before resize
// Without this, portrait photos get squished and model thinks person is obese
function padToSquare(canvas: HTMLCanvasElement, bgGray = 215): HTMLCanvasElement {
  const W    = canvas.width;
  const H    = canvas.height;
  const size = Math.max(W, H);
  const out  = document.createElement('canvas');
  out.width  = size;
  out.height = size;
  const ctx  = out.getContext('2d')!;
  ctx.fillStyle = `rgb(${bgGray},${bgGray},${bgGray})`;
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(canvas, (size - W) / 2, (size - H) / 2);
  return out;
}

function resizeTo224(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width  = 224;
  out.height = 224;
  out.getContext('2d')!.drawImage(canvas, 0, 0, 224, 224);
  return out;
}

function calcCoverage(mask: Float32Array): number {
  let count = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] > 0.5) count++;
  return Math.round(count / mask.length * 100);
}

// ── TARGET B — BACKGROUND REMOVAL ─────────────────────────────

async function runTargetB(
  canvas: HTMLCanvasElement
): Promise<{ composited: HTMLCanvasElement; mask224: Float32Array }> {
  const W = canvas.width;
  const H = canvas.height;

  // Resize to 320x320 for Target B
  const c320 = document.createElement('canvas');
  c320.width  = 320;
  c320.height = 320;
  c320.getContext('2d')!.drawImage(canvas, 0, 0, 320, 320);
  const idat = c320.getContext('2d')!.getImageData(0, 0, 320, 320);

  // Normalize with ImageNet mean/std
  const MEAN = [0.485, 0.456, 0.406];
  const STD  = [0.229, 0.224, 0.225];
  const inp  = new Float32Array(3 * 320 * 320);
  for (let i = 0; i < 320 * 320; i++) {
    for (let c = 0; c < 3; c++) {
      inp[c * 320 * 320 + i] = (idat.data[i * 4 + c] / 255 - MEAN[c]) / STD[c];
    }
  }

  const feed: Record<string, ort.Tensor> = {};
  feed[sessionB!.inputNames[0]] = new ort.Tensor('float32', inp, [1, 3, 320, 320]);
  const out  = await sessionB!.run(feed);
  const pred = out[sessionB!.outputNames[0]].data as Float32Array;

  // Normalize soft mask 0-1
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < pred.length; i++) { if (pred[i] < mn) mn = pred[i]; if (pred[i] > mx) mx = pred[i]; }
  const range = mx - mn + 1e-8;
  const softMask320 = new Float32Array(pred.length);
  for (let i = 0; i < pred.length; i++) softMask320[i] = (pred[i] - mn) / range;

  // Composite original image on gray background using mask (at original resolution)
  const origCtx = canvas.getContext('2d')!;
  const origDat = origCtx.getImageData(0, 0, W, H);
  const compDat = new Uint8ClampedArray(origDat.data.length);
  const mask224 = new Float32Array(224 * 224);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = Math.floor(x * 320 / W);
      const sy = Math.floor(y * 320 / H);
      const m  = softMask320[sy * 320 + sx];
      const i  = (y * W + x) * 4;
      compDat[i+0] = Math.round(origDat.data[i+0] * m + 215 * (1 - m));
      compDat[i+1] = Math.round(origDat.data[i+1] * m + 215 * (1 - m));
      compDat[i+2] = Math.round(origDat.data[i+2] * m + 215 * (1 - m));
      compDat[i+3] = 255;
    }
  }

  // Build composited canvas
  const compCanvas = document.createElement('canvas');
  compCanvas.width  = W;
  compCanvas.height = H;
  compCanvas.getContext('2d')!.putImageData(new ImageData(compDat, W, H), 0, 0);

  // Build 224x224 mask (pad to square first to match image)
  const mCanvas = document.createElement('canvas');
  mCanvas.width  = W;
  mCanvas.height = H;
  const mCtx = mCanvas.getContext('2d')!;
  const mDat = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = Math.floor(x * 320 / W);
      const sy = Math.floor(y * 320 / H);
      const v  = Math.round(softMask320[sy * 320 + sx] * 255);
      const i  = (y * W + x) * 4;
      mDat[i]=mDat[i+1]=mDat[i+2]=v; mDat[i+3]=255;
    }
  }
  mCtx.putImageData(new ImageData(mDat, W, H), 0, 0);

  const mSquared = padToSquare(mCanvas, 0);
  const m224c    = document.createElement('canvas');
  m224c.width    = 224;
  m224c.height   = 224;
  m224c.getContext('2d')!.drawImage(mSquared, 0, 0, 224, 224);
  const m224idat = m224c.getContext('2d')!.getImageData(0, 0, 224, 224);
  for (let i = 0; i < 224 * 224; i++) mask224[i] = m224idat.data[i * 4] / 255;

  return { composited: compCanvas, mask224 };
}

// ── PHYSIQUENET INFERENCE ─────────────────────────────────────

async function runPhysiqueNet(
  canvas224: HTMLCanvasElement,
  mask224: Float32Array,
  isMale: boolean
): Promise<{ bf: number; shape: number; bmi: number; conf: number }> {
  const idat = canvas224.getContext('2d')!.getImageData(0, 0, 224, 224);
  const size  = 224 * 224;
  const CHW   = new Float32Array(4 * size);

  // PhysiqueNet normalization
  const MEAN = [0.5, 0.5, 0.5, 0.0];
  const STD  = [0.25, 0.25, 0.25, 1.0];

  for (let i = 0; i < size; i++) {
    CHW[0*size+i] = (idat.data[i*4+0] / 255 - MEAN[0]) / STD[0];
    CHW[1*size+i] = (idat.data[i*4+1] / 255 - MEAN[1]) / STD[1];
    CHW[2*size+i] = (idat.data[i*4+2] / 255 - MEAN[2]) / STD[2];
    CHW[3*size+i] = (mask224[i]              - MEAN[3]) / STD[3];
  }

  const imgTensor = new ort.Tensor('float32', CHW, [1, 4, 224, 224]);
  const sexTensor = new ort.Tensor('float32',
    new Float32Array([isMale ? 1.0 : 0.0]), [1]);

  const feed: Record<string, ort.Tensor> = {};
  feed[sessionA!.inputNames[0]] = imgTensor;
  feed[sessionA!.inputNames[1]] = sexTensor;

  const result = await sessionA!.run(feed);
  const preds  = result[sessionA!.outputNames[0]].data as Float32Array;

  return {
    bf:    preds[0],
    shape: preds[1],
    bmi:   preds[2],
    conf:  preds[3],
  };
}

// ── MAIN SCAN FUNCTION ────────────────────────────────────────

export async function scanBody(
  imageDataUrl: string,
  isMale: boolean,
  weightKg: number
): Promise<ScanResult> {
  if (!sessionA || !sessionB) {
    await loadModels();
  }

  // Step 1: Load image
  const rawCanvas = await loadImageToCanvas(imageDataUrl);

  // Step 2: Target B — remove background at original resolution
  const { composited, mask224 } = await runTargetB(rawCanvas);

  // Step 3: Pad to square then resize to 224 (preserves proportions)
  const squared  = padToSquare(composited, 215);
  const canvas224 = resizeTo224(squared);

  // Step 4: PhysiqueNet inference
  const raw = await runPhysiqueNet(canvas224, mask224, isMale);

  // Step 5: Calculate derived metrics
  const bf       = Math.round(raw.bf    * 10) / 10;
  const shape    = Math.round(raw.shape);
  const bmi      = Math.round(raw.bmi   * 10) / 10;
  const conf     = Math.round(raw.conf  * 1000) / 1000;
  const coverage = calcCoverage(mask224);
  const fatMass  = Math.round(weightKg * bf / 100 * 10) / 10;
  const leanMass = Math.round((weightKg - fatMass) * 10) / 10;

  const category = getCategory(bf, isMale);
  const confLabel = conf >= 0.6
    ? 'High confidence'
    : conf >= 0.35
    ? 'Medium confidence — try plain background'
    : 'Low confidence — retake photo';

  return {
    bf, shape, bmi, conf, fatMass, leanMass,
    coverage, category, confLabel,
    timestamp: Date.now(),
  };
}

function getCategory(bf: number, isMale: boolean): string {
  if (isMale) {
    if (bf < 6)  return 'Essential Fat';
    if (bf < 14) return 'Athlete';
    if (bf < 18) return 'Fitness';
    if (bf < 25) return 'Average';
    return 'Above Average';
  } else {
    if (bf < 14) return 'Essential Fat';
    if (bf < 21) return 'Athlete';
    if (bf < 25) return 'Fitness';
    if (bf < 32) return 'Average';
    return 'Above Average';
  }
}
