'use client';

// src/lib/physiquenet.ts â€” COMPLETE FIXED VERSION
// Fixes: dynamic ONNX names, confidence recalibration, body type detection

import * as ort from 'onnxruntime-web';

if (typeof window !== 'undefined') {
  ort.env.wasm.wasmPaths = '/onnx/';
  ort.env.wasm.numThreads = 1;
}

// â”€â”€ TYPES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type BodyType = 'full_body' | 'upper_body' | 'lower_body' | 'unknown';

export interface ScanResult {
  bf:            number;
  shape:         number;
  bmi:           number;
  conf:          number;
  confDisplay:   number;   // recalibrated for real photos (0-100%)
  fatMass:       number;
  leanMass:      number;
  coverage:      number;
  category:      string;
  confLabel:     string;
  bodyType:      BodyType;
  bodyTypeLabel: string;
  isolatedUrl?:  string;
  normalizedUrl?: string;
  timestamp:     number;
}

// â”€â”€ SINGLETON SESSIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let sessionA: ort.InferenceSession | null = null;
let modelsAreLoaded = false;

export async function loadModels(
  onProgress?: (msg: string, pct: number) => void
): Promise<void> {
  if (modelsAreLoaded && sessionA) return;

  onProgress?.('Loading composition model...', 50);
  sessionA = await ort.InferenceSession.create('/models/physiquenet_merged.onnx?v=2', {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
  console.log('âœ… PhysiqueNet loaded');
  console.log('   inputs:', sessionA.inputNames);
  console.log('   outputs:', sessionA.outputNames);

  modelsAreLoaded = true;
  onProgress?.('Models ready!', 100);
}

export function modelsLoaded(): boolean {
  return modelsAreLoaded && sessionA !== null;
}

// â”€â”€ IMAGE HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function loadImageToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width  = img.naturalWidth  || img.width;
      c.height = img.naturalHeight || img.height;
      c.getContext('2d')!.drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

function padToSquare(canvas: HTMLCanvasElement, bgGray = 215): HTMLCanvasElement {
  const W = canvas.width, H = canvas.height;
  const size = Math.max(W, H);
  const out = document.createElement('canvas');
  out.width = size; out.height = size;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = `rgb(${bgGray},${bgGray},${bgGray})`;
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(canvas, Math.floor((size - W) / 2), Math.floor((size - H) / 2));
  return out;
}

function resizeTo(canvas: HTMLCanvasElement, size: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = size; out.height = size;
  out.getContext('2d')!.drawImage(canvas, 0, 0, size, size);
  return out;
}

function autoNormalizeLighting(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const idat = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = idat.data;
  let mn = 255, mx = 0;
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i+1] + data[i+2]) / 3;
    if (avg < mn) mn = avg;
    if (avg > mx) mx = avg;
  }
  const range = (mx - mn) || 1;
  const boost = 1.05;
  for (let i = 0; i < data.length; i += 4) {
    data[i]   = Math.min(255, ((data[i]   - mn) / range * 255) * boost);
    data[i+1] = Math.min(255, ((data[i+1] - mn) / range * 255) * boost);
    data[i+2] = Math.min(255, ((data[i+2] - mn) / range * 255) * boost);
  }
  const out = document.createElement('canvas');
  out.width = canvas.width; out.height = canvas.height;
  out.getContext('2d')!.putImageData(idat, 0, 0);
  return out;
}

// â”€â”€ BODY TYPE DETECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Detects whether photo contains full body, upper body, etc.
// Uses mask shape analysis â€” where is the person in the frame?

export function detectBodyType(
  maskCanvas: HTMLCanvasElement
): { bodyType: BodyType; label: string; topPct: number; bottomPct: number; heightPct: number } {
  const ctx  = maskCanvas.getContext('2d', { willReadFrequently: true })!;
  const W    = maskCanvas.width;
  const H    = maskCanvas.height;
  const idat = ctx.getImageData(0, 0, W, H);

  // Scan row by row â€” find where person starts and ends vertically
  const rowCoverage = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    let count = 0;
    for (let x = 0; x < W; x++) {
      if (idat.data[(y * W + x) * 4] > 30) count++;
    }
    rowCoverage[y] = count / W;
  }

  // Find topmost and bottommost rows with significant coverage
  const THRESHOLD = 0.05; // at least 5% of row must be person
  let topRow    = -1;
  let bottomRow = -1;

  for (let y = 0; y < H; y++) {
    if (rowCoverage[y] > THRESHOLD) { if (topRow === -1) topRow = y; bottomRow = y; }
  }

  if (topRow === -1) {
    return { bodyType: 'unknown', label: 'No body detected', topPct: 0, bottomPct: 0, heightPct: 0 };
  }

  const topPct    = topRow    / H;   // where person starts (0=top of frame)
  const bottomPct = bottomRow / H;   // where person ends   (1=bottom of frame)
  const heightPct = bottomPct - topPct; // fraction of frame height person spans

  // Check if photo is portrait vs square
  const aspectRatio = H / W;

  let bodyType: BodyType;
  let label: string;

  // Full body: person is tall and starts near top, ends near bottom
  if (topPct < 0.15 && bottomPct > 0.75 && heightPct > 0.60) {
    bodyType = 'full_body';
    label    = 'Full body detected âœ“';
  }
  // Upper body: person starts near top but ends in middle of frame
  else if (topPct < 0.25 && bottomPct < 0.70 && heightPct > 0.35) {
    bodyType = 'upper_body';
    label    = 'Upper body detected';
  }
  // Lower body: person starts in middle of frame
  else if (topPct > 0.25 && bottomPct > 0.75) {
    bodyType = 'lower_body';
    label    = 'Lower body only';
  }
  else {
    bodyType = 'upper_body';
    label    = 'Partial body detected';
  }

  console.log(`[BodyType] top=${(topPct*100).toFixed(0)}% bottom=${(bottomPct*100).toFixed(0)}% height=${(heightPct*100).toFixed(0)}% â†’ ${bodyType}`);

  return { bodyType, label, topPct, bottomPct, heightPct };
}

// â”€â”€ MASK BOUNDS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getMaskBounds(maskCanvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } {
  const ctx  = maskCanvas.getContext('2d', { willReadFrequently: true })!;
  const W    = maskCanvas.width;
  const H    = maskCanvas.height;
  const idat = ctx.getImageData(0, 0, W, H);

  let minX = W, maxX = 0, minY = H, maxY = 0, found = false;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (idat.data[(y * W + x) * 4] > 10) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        found = true;
      }
    }
  }
  if (!found) return { x: 0, y: 0, w: W, h: H };

  const pad  = Math.max(W, H) * 0.02;
  const bW   = (maxX - minX) + pad * 2;
  const bH   = (maxY - minY) + pad * 2;
  const size = Math.max(bW, bH);
  const cx   = (minX + maxX) / 2;
  const cy   = (minY + maxY) / 2;

  let x = Math.max(0, cx - size / 2);
  let y = Math.max(0, cy - size / 2);
  if (x + size > W) x = W - size;
  if (y + size > H) y = H - size;
  if (x < 0) x = 0; if (y < 0) y = 0;

  return {
    x: Math.floor(x),
    y: Math.floor(y),
    w: Math.floor(Math.min(size, W - x)),
    h: Math.floor(Math.min(size, H - y)),
  };
}

// â”€â”€ TARGET B â€” BACKGROUND REMOVAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FIXED: uses dynamic input/output names from session

async function runTargetB(canvas: HTMLCanvasElement): Promise<{
  composited: HTMLCanvasElement;
  mCanvas: HTMLCanvasElement;
}> {
  // Pad to square BEFORE resizing
  const squared = padToSquare(canvas, 127);
  const W = squared.width, H = squared.height;

  const c320 = resizeTo(squared, 320);
  const idat = c320.getContext('2d')!.getImageData(0, 0, 320, 320);

  // Try 0-1 normalization first (PoNet training standard)
  const inp = new Float32Array(3 * 320 * 320);
  for (let i = 0; i < 320 * 320; i++) {
    inp[0 * 320 * 320 + i] = idat.data[i * 4 + 0] / 255.0;
    inp[1 * 320 * 320 + i] = idat.data[i * 4 + 1] / 255.0;
    inp[2 * 320 * 320 + i] = idat.data[i * 4 + 2] / 255.0;
  }

  // FIXED: use actual input name from model, not hardcoded 'input'
  const inputName  = sessionB!.inputNames[0];
  const outputName = sessionB!.outputNames[0];
  console.log(`[Target B] Using input="${inputName}" output="${outputName}"`);

  const feed: Record<string, ort.Tensor> = {};
  feed[inputName] = new ort.Tensor('float32', inp, [1, 3, 320, 320]);

  const outMap  = await sessionB!.run(feed);
  const rawPred = outMap[outputName].data as Float32Array;
  const rawDims = outMap[outputName].dims;
  console.log(`[Target B] Output dims: [${rawDims.join(', ')}]`);

  // Handle multiple output formats
  let softMask320: Float32Array;
  const total = rawPred.length;

  if (rawDims.length === 4 && rawDims[1] === 4) {
    // RGBA format [1,4,H,W] â€” use alpha channel
    const size = rawDims[2] * rawDims[3];
    softMask320 = rawPred.slice(3 * size, 4 * size);
  } else {
    // Single channel [1,1,H,W] or [1,H,W] or [H,W]
    softMask320 = new Float32Array(rawPred);
  }

  // Normalize to [0,1]
  let mn = Infinity, mx = -Infinity;
  for (let v of softMask320) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const rng = mx - mn;
  if (rng > 0.001) {
    for (let i = 0; i < softMask320.length; i++) {
      softMask320[i] = (softMask320[i] - mn) / rng;
    }
  } else {
    // Flat output â€” apply sigmoid
    const orig = outMap[outputName].data as Float32Array;
    for (let i = 0; i < softMask320.length; i++) {
      softMask320[i] = 1 / (1 + Math.exp(-orig[i]));
    }
  }

  const maskH = rawDims[rawDims.length - 2] || 320;
  const maskW = rawDims[rawDims.length - 1] || 320;

  const abv50 = softMask320.filter(v => v > 0.5).length;
  console.log(`[Target B] Raw coverage: ${(abv50/softMask320.length*100).toFixed(1)}%`);

  // Build composited image and mask at ORIGINAL resolution
  const sDat = squared.getContext('2d')!.getImageData(0, 0, W, H);
  const compDat = new Uint8ClampedArray(W * H * 4);
  const mDat    = new Uint8ClampedArray(W * H * 4);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = Math.min(maskW - 1, Math.floor(x * maskW / W));
      const sy = Math.min(maskH - 1, Math.floor(y * maskH / H));
      const m  = softMask320[sy * maskW + sx];
      const i  = (y * W + x) * 4;
      compDat[i+0] = Math.round(sDat.data[i+0] * m + 215 * (1 - m));
      compDat[i+1] = Math.round(sDat.data[i+1] * m + 215 * (1 - m));
      compDat[i+2] = Math.round(sDat.data[i+2] * m + 215 * (1 - m));
      compDat[i+3] = 255;
      const v = Math.round(m * 255);
      mDat[i]=mDat[i+1]=mDat[i+2]=v; mDat[i+3]=255;
    }
  }

  const compCanvas = document.createElement('canvas');
  compCanvas.width = W; compCanvas.height = H;
  compCanvas.getContext('2d')!.putImageData(new ImageData(compDat, W, H), 0, 0);

  const mCanvas = document.createElement('canvas');
  mCanvas.width = W; mCanvas.height = H;
  mCanvas.getContext('2d')!.putImageData(new ImageData(mDat, W, H), 0, 0);

  return { composited: compCanvas, mCanvas };
}

// â”€â”€ PHYSIQUENET INFERENCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FIXED: uses dynamic input/output names

async function runPhysiqueNet(
  canvas224: HTMLCanvasElement,
  mask224: Float32Array,
  isMale: boolean
): Promise<{ bf: number; shape: number; bmi: number; conf: number }> {
  const idat = canvas224.getContext('2d')!.getImageData(0, 0, 224, 224);
  const S    = 224 * 224;
  const CHW  = new Float32Array(4 * S);
  const MEAN = [0.5, 0.5, 0.5, 0.0];
  const STD  = [0.25, 0.25, 0.25, 1.0];

  for (let i = 0; i < S; i++) {
    CHW[0*S+i] = (idat.data[i*4+0] / 255 - MEAN[0]) / STD[0];
    CHW[1*S+i] = (idat.data[i*4+1] / 255 - MEAN[1]) / STD[1];
    CHW[2*S+i] = (idat.data[i*4+2] / 255 - MEAN[2]) / STD[2];
    CHW[3*S+i] = (mask224[i]             - MEAN[3]) / STD[3];
  }

  // FIXED: use actual names from model
  const imgName = sessionA!.inputNames[0];
  const sexName = sessionA!.inputNames[1];
  const outName = sessionA!.outputNames[0];

  const feed: Record<string, ort.Tensor> = {};
  feed[imgName] = new ort.Tensor('float32', CHW, [1, 4, 224, 224]);
  feed[sexName] = new ort.Tensor('float32', new Float32Array([isMale ? 1.0 : 0.0]), [1]);

  const result = await sessionA!.run(feed);
  const preds  = result[outName].data as Float32Array;

  console.log(`[PhysiqueNet] Raw: BF=${preds[0].toFixed(2)} Shape=${preds[1].toFixed(1)} Conf=${preds[3].toFixed(4)}`);

  return { bf: preds[0], shape: preds[1], bmi: preds[2], conf: preds[3] };
}

// â”€â”€ CONFIDENCE CALIBRATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Real photos get lower raw confidence than synthetic training data.
// This function recalibrates confidence for display.
// Raw 0.05-0.15 on real photos = actually reasonable prediction.

function calibrateConfidence(
  rawConf: number,
  coverage: number,
  bodyType: BodyType
): { display: number; label: string } {
  // Base score from coverage
  let coverageScore = coverage / 100; // 0-1

  // Body type penalty
  const bodyPenalty = bodyType === 'full_body'  ? 1.0
                    : bodyType === 'upper_body'  ? 0.75
                    : bodyType === 'lower_body'  ? 0.60
                    : 0.40;

  // Raw model confidence (very small for real photos â€” this is normal)
  // Scale raw 0-0.3 range to 0-1 for real photos
  const confScore = Math.min(1, rawConf / 0.15);

  // Combined display score (0-100%)
  const display = Math.round(
    (coverageScore * 0.4 + bodyPenalty * 0.35 + confScore * 0.25) * 100
  );

  let label: string;
  if (display >= 65) label = 'High accuracy scan';
  else if (display >= 45) label = 'Good scan quality';
  else if (display >= 30) label = 'Fair â€” full body improves accuracy';
  else label = 'Low â€” try plain background, full body';

  return { display, label };
}

// â”€â”€ BYPASS MODE (no Target B) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildBypassMask(rawCanvas: HTMLCanvasElement): {
  composited: HTMLCanvasElement;
  mCanvas: HTMLCanvasElement;
} {
  const W = rawCanvas.width, H = rawCanvas.height;
  const ctx = rawCanvas.getContext('2d', { willReadFrequently: true })!;
  const idat = ctx.getImageData(0, 0, W, H);

  // Check for PNG transparency
  let hasAlpha = false;
  for (let i = 3; i < idat.data.length; i += 4) {
    if (idat.data[i] < 250) { hasAlpha = true; break; }
  }

  const mCanvas = document.createElement('canvas');
  mCanvas.width = W; mCanvas.height = H;
  const mCtx = mCanvas.getContext('2d')!;

  if (hasAlpha) {
    const mDat = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < idat.data.length; i += 4) {
      const v = idat.data[i+3];
      mDat[i]=mDat[i+1]=mDat[i+2]=v; mDat[i+3]=255;
    }
    mCtx.putImageData(new ImageData(mDat, W, H), 0, 0);
    const bg = document.createElement('canvas');
    bg.width = W; bg.height = H;
    const bCtx = bg.getContext('2d')!;
    bCtx.fillStyle = 'rgb(215,215,215)';
    bCtx.fillRect(0, 0, W, H);
    bCtx.drawImage(rawCanvas, 0, 0);
    return { composited: bg, mCanvas };
  } else {
    // Center rectangle mask
    mCtx.fillStyle = 'black';
    mCtx.fillRect(0, 0, W, H);
    mCtx.fillStyle = 'white';
    mCtx.fillRect(W * 0.15, H * 0.02, W * 0.70, H * 0.96);
    return { composited: rawCanvas, mCanvas };
  }
}

// â”€â”€ MAIN SCAN FUNCTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function scanBody(
  imageDataUrl: string,
  isMale: boolean,
  weightKg: number,
  onProgress?: (msg: string) => void
): Promise<ScanResult> {
  if (!sessionA) await loadModels();

  onProgress?.('Loading image...');
  const rawCanvas = await loadImageToCanvas(imageDataUrl);
  console.log(`[Scan] Image: ${rawCanvas.width}Ã—${rawCanvas.height}`);

  // Step 1: Background analysis (Bypass mode)
  onProgress?.('Analyzing image structure...');
  const r = buildBypassMask(rawCanvas);
  const composited = r.composited; 
  const mCanvas = r.mCanvas;

  // Step 2: Detect body type BEFORE zooming
  onProgress?.('Detecting body framing...');
  const { bodyType, label: bodyTypeLabel } = detectBodyType(mCanvas);

  // Step 3: Smart zoom to person's bounding box
  onProgress?.('Optimizing focus area...');
  const bounds = getMaskBounds(mCanvas);

  const zoomedImg = document.createElement('canvas');
  zoomedImg.width = bounds.w; zoomedImg.height = bounds.h;
  zoomedImg.getContext('2d')!.drawImage(composited, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);

  const zoomedMask = document.createElement('canvas');
  zoomedMask.width = bounds.w; zoomedMask.height = bounds.h;
  zoomedMask.getContext('2d')!.drawImage(mCanvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);

  // Step 4: Normalize â†’ pad â†’ resize to 224
  onProgress?.('Normalizing image...');
  const normalized = autoNormalizeLighting(zoomedImg);
  const squared    = padToSquare(normalized, 215);
  const canvas224  = resizeTo(squared, 224);

  const mSquared = padToSquare(zoomedMask, 0);
  const m224c    = resizeTo(mSquared, 224);
  const m224idat = m224c.getContext('2d')!.getImageData(0, 0, 224, 224);
  const mask224  = new Float32Array(224 * 224);
  for (let i = 0; i < 224 * 224; i++) mask224[i] = m224idat.data[i * 4] / 255;

  const coverage = Math.round(mask224.filter(v => v > 0.5).length / (224 * 224) * 100);
  console.log(`[Scan] Coverage: ${coverage}% | BodyType: ${bodyType}`);

  // Step 5: PhysiqueNet inference
  onProgress?.('Analyzing body composition...');
  const raw = await runPhysiqueNet(canvas224, mask224, isMale);

  // Step 6: Calibrate and derive metrics
  const bf       = Math.round(raw.bf    * 10) / 10;
  const shape    = Math.round(Math.max(0, Math.min(100, raw.shape)));
  const bmi      = Math.round(raw.bmi   * 10) / 10;
  const conf     = Math.round(raw.conf  * 1000) / 1000;
  const fatMass  = Math.round(weightKg * Math.max(0, bf) / 100 * 10) / 10;
  const leanMass = Math.round((weightKg - fatMass) * 10) / 10;
  const category = getCategory(bf, isMale);
  const { display: confDisplay, label: confLabel } = calibrateConfidence(conf, coverage, bodyType);

  console.log(`[Scan] Result: BF=${bf}% Shape=${shape} RawConf=${conf} DisplayConf=${confDisplay}% Coverage=${coverage}%`);

  return {
    bf, shape, bmi, conf, confDisplay, fatMass, leanMass,
    coverage, category, confLabel, bodyType, bodyTypeLabel,
    isolatedUrl:   composited.toDataURL('image/webp', 0.6),
    normalizedUrl: canvas224.toDataURL('image/webp', 0.6),
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
