'use client';

/**
 * @fileOverview VisiFood Ultra Engine (V3 — 5,765 classes)
 * Powered by FoodNet + PoseCore custom architecture.
 * 100% proprietary, no third-party AI APIs.
 */

import * as ort from 'onnxruntime-web';

if (typeof window !== 'undefined') {
  ort.env.wasm.wasmPaths = '/onnx/';
  ort.env.wasm.numThreads = 1;
}

export interface FoodInferenceResult {
  classId: number;
  className: string;
  confidence: number;
  nutrients: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
}

let sessionCore: ort.InferenceSession | null = null;
let sessionGlobal: ort.InferenceSession | null = null;
let isModelLoading = false;
let classMapCore: string[] | null = null;                 
let classMapGlobal: Record<string, string> | null = null; 
let nutritionDb: Record<string, any> | null = null;       
let nutrition5kMap: Record<string, any> | null = null;

// ── NUTRITION ESTIMATOR ───────────────────────────────────────
// For classes not in the legacy DB, infer from name keywords
function estimateNutrition(name: string) {
  const n = name.toLowerCase();
  if (n.includes('salad'))            return { calories: 120, protein: 4,  carbs: 10, fats: 6  };
  if (n.includes('chicken'))          return { calories: 250, protein: 27, carbs: 0,  fats: 12 };
  if (n.includes('rice'))             return { calories: 200, protein: 4,  carbs: 44, fats: 1  };
  if (n.includes('bread') || n.includes('toast'))
                                      return { calories: 170, protein: 6,  carbs: 32, fats: 2  };
  if (n.includes('egg'))              return { calories: 155, protein: 13, carbs: 1,  fats: 11 };
  if (n.includes('fish') || n.includes('salmon') || n.includes('tuna'))
                                      return { calories: 200, protein: 24, carbs: 0,  fats: 10 };
  if (n.includes('burger') || n.includes('sandwich'))
                                      return { calories: 450, protein: 22, carbs: 40, fats: 22 };
  if (n.includes('pizza'))            return { calories: 280, protein: 11, carbs: 36, fats: 10 };
  if (n.includes('pasta') || n.includes('noodle') || n.includes('spaghetti'))
                                      return { calories: 220, protein: 8,  carbs: 43, fats: 2  };
  if (n.includes('soup'))             return { calories: 100, protein: 6,  carbs: 12, fats: 3  };
  if (n.includes('cake') || n.includes('cookie') || n.includes('dessert') || n.includes('sweet'))
                                      return { calories: 350, protein: 4,  carbs: 55, fats: 14 };
  if (n.includes('fruit') || n.includes('apple') || n.includes('banana') || n.includes('orange'))
                                      return { calories: 80,  protein: 1,  carbs: 20, fats: 0  };
  if (n.includes('juice'))            return { calories: 110, protein: 1,  carbs: 26, fats: 0  };
  if (n.includes('milk') || n.includes('yogurt') || n.includes('cheese'))
                                      return { calories: 150, protein: 8,  carbs: 12, fats: 8  };
  if (n.includes('steak') || n.includes('beef') || n.includes('meat'))
                                      return { calories: 300, protein: 30, carbs: 0,  fats: 18 };
  if (n.includes('pork') || n.includes('bacon'))
                                      return { calories: 280, protein: 25, carbs: 0,  fats: 20 };
  if (n.includes('biryani') || n.includes('curry'))
                                      return { calories: 320, protein: 18, carbs: 40, fats: 10 };
  if (n.includes('dosa') || n.includes('idli') || n.includes('roti') || n.includes('chapati'))
                                      return { calories: 180, protein: 5,  carbs: 34, fats: 3  };
  if (n.includes('dal') || n.includes('lentil'))
                                      return { calories: 160, protein: 10, carbs: 28, fats: 1  };
  if (n.includes('vegetable') || n.includes('veggie'))
                                      return { calories: 80,  protein: 3,  carbs: 15, fats: 1  };
  // Default: average mixed meal estimate
  return { calories: 200, protein: 8, carbs: 25, fats: 8 };
}

// Format class name from folder-style names like "apple_pie" → "Apple Pie"
function formatClassName(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase()).trim();
}

// ── LOAD MODEL ────────────────────────────────────────────────
export async function loadFoodModel(): Promise<void> {
  if ((sessionCore && sessionGlobal) || isModelLoading) return;
  isModelLoading = true;
  try {
    console.log('[FoodEngine] Loading Dual-Engine Array (Core 450 + Global 7K)...');

    // 1. Load Data Maps
    const [mapCoreRes, mapGlobalRes, dbRes, map5kRes] = await Promise.all([
      fetch('/data/food-classes.json'),
      fetch('/models/class_map_global_7k.json'),
      fetch('/data/food-nutrition-db.json'),
      fetch('/data/nutrition5k_map.json')
    ]);

    classMapCore = await mapCoreRes.json();
    classMapGlobal = await mapGlobalRes.json();
    nutritionDb = await dbRes.json().catch(() => ({}));
    nutrition5kMap = await map5kRes.json().catch(() => ({}));

    // 2. Load ONNX Models
    sessionCore = await ort.InferenceSession.create('/models/v2_food_recognizer.onnx', {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
    
    sessionGlobal = await ort.InferenceSession.create('/models/VisiFood_Global_7K.onnx', {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });

    console.log(`[FoodEngine] Ready — Dual Engines Initialized.`);
  } catch (error) {
    console.error('[FoodEngine] Failed to load Dual-Engine:', error);
    sessionCore = null;
    sessionGlobal = null;
  } finally {
    isModelLoading = false;
  }
}

// ── PREPROCESS IMAGE ──────────────────────────────────────────
async function preprocessImage(dataUrl: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 224;
      canvas.height = 224;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, 224, 224);
      const { data } = ctx.getImageData(0, 0, 224, 224);
      const floatData = new Float32Array(3 * 224 * 224);
      const mean = [0.485, 0.456, 0.406];
      const std  = [0.229, 0.224, 0.225];
      for (let i = 0; i < 224 * 224; i++) {
        floatData[0 * 224 * 224 + i] = (data[i * 4 + 0] / 255 - mean[0]) / std[0];
        floatData[1 * 224 * 224 + i] = (data[i * 4 + 1] / 255 - mean[1]) / std[1];
        floatData[2 * 224 * 224 + i] = (data[i * 4 + 2] / 255 - mean[2]) / std[2];
      }
      resolve(floatData);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// ── RUN INFERENCE ─────────────────────────────────────────────
export async function runFoodInference(imageDataUrl: string, k: number = 5): Promise<FoodInferenceResult[]> {
  if (!sessionCore || !sessionGlobal) await loadFoodModel();
  if (!sessionCore || !sessionGlobal) return [];

  try {
    const input = await preprocessImage(imageDataUrl);
    const tensor = new ort.Tensor('float32', input, [1, 3, 224, 224]);

    const isGarbageClass = (name: string) =>
      ['images', 'train', 'val', 'test', 'data', 'annotations'].includes(name.toLowerCase()) || name.length < 2;

    // --- ENGINE 1: CORE 450 (Top 2) ---
    const inCore = sessionCore.inputNames[0];
    const outCore = sessionCore.outputNames[0];
    const mapCore = await sessionCore.run({ [inCore]: tensor });
    const dataCore = mapCore[outCore].data as Float32Array;

    const maxCore = Math.max(...Array.from(dataCore));
    const expCore = Array.from(dataCore).map(v => Math.exp(v - maxCore));
    const sumCore = expCore.reduce((a, b) => a + b, 0);
    const confCore = expCore.map(v => v / sumCore);

    const topCore = confCore
      .map((conf, index) => ({ index, conf }))
      .sort((a, b) => b.conf - a.conf)
      .filter(item => !isGarbageClass(classMapCore![item.index] || ''))
      .slice(0, 2); // Pull Top 2 from Core

    // --- ENGINE 2: GLOBAL 7K (Top 3) ---
    const inGlobal = sessionGlobal.inputNames[0];
    const outGlobal = sessionGlobal.outputNames[0];
    const mapGlobal = await sessionGlobal.run({ [inGlobal]: tensor });
    const dataGlobal = mapGlobal[outGlobal].data as Float32Array;

    const maxGlobal = Math.max(...Array.from(dataGlobal));
    const expGlobal = Array.from(dataGlobal).map(v => Math.exp(v - maxGlobal));
    const sumGlobal = expGlobal.reduce((a, b) => a + b, 0);
    const confGlobal = expGlobal.map(v => v / sumGlobal);

    const topGlobal = confGlobal
      .map((conf, index) => ({ index, conf }))
      .sort((a, b) => b.conf - a.conf)
      .filter(item => !isGarbageClass(classMapGlobal![String(item.index)] || ''))
      .slice(0, 3); // Pull Top 3 from Global

    // --- MERGING & FORMATTING ---
    const combinedResults: FoodInferenceResult[] = [];

    // Format Core Results finding basic generic mappings
    topCore.forEach(item => {
      const rawName = classMapCore![item.index] || 'Unknown Food';
      const displayName = formatClassName(rawName);
      const legNut = nutritionDb?.[rawName] || nutritionDb?.[displayName];
      const nutrition = legNut ? { calories: legNut.calories, protein: legNut.protein, carbs: legNut.carbs, fats: legNut.fats } : estimateNutrition(rawName);
      
      combinedResults.push({ classId: item.index, className: displayName, confidence: item.conf, nutrients: nutrition });
    });

    // Format Global Results mapping to Nutrition5K or falling back
    topGlobal.forEach(item => {
      const rawName = classMapGlobal![String(item.index)] || 'Unknown Food';
      let displayName = formatClassName(rawName);
      let nutrition = { calories: 0, protein: 0, carbs: 0, fats: 0 };

      if (rawName.startsWith('dish_') && nutrition5kMap && nutrition5kMap[rawName]) {
        const dish = nutrition5kMap[rawName];
        displayName = dish.name;
        nutrition = { calories: dish.calories, protein: dish.protein, carbs: dish.carbs, fats: dish.fats };
      } else {
        const legNut = nutritionDb?.[rawName] || nutritionDb?.[displayName];
        nutrition = legNut ? { calories: legNut.calories, protein: legNut.protein, carbs: legNut.carbs, fats: legNut.fats } : estimateNutrition(rawName);
      }

      combinedResults.push({ classId: item.index, className: displayName, confidence: item.conf, nutrients: nutrition });
    });

    return combinedResults;
  } catch (error) {
    console.error('[FoodEngine] Inference error:', error);
    return [];
  }
}
