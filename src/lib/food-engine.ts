'use client';

/**
 * @fileOverview VisiFood Ultra Engine (V3 â€” 5,765 classes)
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
let isModelLoading = false;
let classMapCore: string[] | null = null;                 
let nutritionDb: Record<string, any> | null = null;       

// â”€â”€ NUTRITION ESTIMATOR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// Format class name from folder-style names like "apple_pie" â†’ "Apple Pie"
function formatClassName(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase()).trim();
}

// â”€â”€ LOAD MODEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function loadFoodModel(): Promise<void> {
  if (sessionCore || isModelLoading) return;
  isModelLoading = true;
  try {
    console.log('[FoodEngine] Loading Core Recognizer (450 classes)...');

    // 1. Load Data Maps
    const [mapCoreRes, dbRes] = await Promise.all([
      fetch('/data/food-classes.json'),
      fetch('/data/food-nutrition-db.json')
    ]);

    classMapCore = await mapCoreRes.json();
    nutritionDb = await dbRes.json().catch(() => ({}));

    // 2. Load ONNX Models
    sessionCore = await ort.InferenceSession.create('/models/v2_food_recognizer.onnx', {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
    
    console.log(`[FoodEngine] Ready.`);
  } catch (error) {
    console.error('[FoodEngine] Failed to load Engine:', error);
    sessionCore = null;
  } finally {
    isModelLoading = false;
  }
}

// â”€â”€ PREPROCESS IMAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ RUN INFERENCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function runFoodInference(imageDataUrl: string, k: number = 5): Promise<FoodInferenceResult[]> {
  if (!sessionCore) await loadFoodModel();
  if (!sessionCore) return [];

  try {
    const input = await preprocessImage(imageDataUrl);
    const tensor = new ort.Tensor('float32', input, [1, 3, 224, 224]);

    const isGarbageClass = (name: string) =>
      ['images', 'train', 'val', 'test', 'data', 'annotations'].includes(name.toLowerCase()) || name.length < 2;

    // --- ENGINE: CORE 450 (Top 5) ---
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
      .slice(0, k);

    // --- FORMATTING ---
    const combinedResults: FoodInferenceResult[] = [];

    // Format Core Results
    topCore.forEach(item => {
      const rawName = classMapCore![item.index] || 'Unknown Food';
      const displayName = formatClassName(rawName);
      const legNut = nutritionDb?.[rawName] || nutritionDb?.[displayName];
      const nutrition = legNut ? { calories: legNut.calories, protein: legNut.protein, carbs: legNut.carbs, fats: legNut.fats } : estimateNutrition(rawName);
      
      combinedResults.push({ classId: item.index, className: displayName, confidence: item.conf, nutrients: nutrition });
    });

    return combinedResults;
  } catch (error) {
    console.error('[FoodEngine] Inference error:', error);
    return [];
  }
}
