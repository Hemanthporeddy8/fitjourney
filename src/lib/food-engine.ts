'use client';

/**
 * @fileOverview FitJourney Food Cascade Recognition Engine (5-Expert Mixture of Experts)
 * Powered by FitJourneyFoodNet custom cascade architecture.
 * 100% proprietary, zero-cost, browser-safe, running via ONNX Runtime Web.
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
  metadata?: {
    cuisine: string;
    type: string;
    ingredients?: string[];
    servingSuggestion?: string;
  };
}

let sessionGeneralist: ort.InferenceSession | null = null;
let activeSpecialistSession: ort.InferenceSession | null = null;
let activeSpecialistIndex: number | null = null;
let cascadeMetadata: any = null;
let nutritionDb: Record<string, any> | null = null;
let isModelLoading = false;

// Consolidated 5-Expert Mixture of Experts (MoE) Categories
const CATEGORIES = [
  "raw_produce",             // 0: Fruits & Vegetables
  "indian_cuisine",          // 1: Indian dishes, curries, regional breads & sweets
  "east_asian_cuisine",      // 2: Chinese, Japanese, Korean foods (sushi, ramen, etc.)
  "western_bakery_fastfood", // 3: Pizza, burger, pasta, bakery breads
  "desserts_drinks_others"   // 4: Cakes, beverages, snacks, and backgrounds
];

// Popularity weight priors for re-ranking logic (prefers common foods over rare varieties)
const POPULAR_FOODS: Record<string, number> = {
  "pizza": 1.3,
  "burger": 1.3,
  "sandwich": 1.2,
  "biryani": 1.25,
  "samosa": 1.2,
  "dosa": 1.2,
  "naan": 1.25,
  "apple": 1.15,
  "banana": 1.15,
  "salad": 1.2,
  "chicken curry": 1.2,
  "fried rice": 1.2,
  "chow mein": 1.15,
  "spaghetti": 1.2,
  "french fries": 1.25,
  "chips": 1.2,
  "croissant": 1.15,
  "coffee": 1.2,
  "cappuccino": 1.15,
  "coke": 1.2,
  "egg": 1.2,
  "chocolate cake": 1.2,
  "sushi": 1.2,
  "rice": 1.15,
  "dal makhani": 1.15,
  "roti": 1.2
};

// --- NUTRITIONAL ESTIMATOR FALLBACK ---
function estimateNutrition(name: string) {
  const n = name.toLowerCase();
  if (n.includes('salad'))            return { calories: 120, protein: 4,  carbs: 10, fats: 6  };
  if (n.includes('chicken'))          return { calories: 250, protein: 27, carbs: 0,  fats: 12 };
  if (n.includes('rice'))             return { calories: 200, protein: 4,  carbs: 44, fats: 1  };
  if (n.includes('bread') || n.includes('toast') || n.includes('naan') || n.includes('roti'))
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
  if (n.includes('cake') || n.includes('cookie') || n.includes('dessert') || n.includes('sweet') || n.includes('jamun') || n.includes('jalebi'))
                                      return { calories: 350, protein: 4,  carbs: 55, fats: 14 };
  if (n.includes('fruit') || n.includes('apple') || n.includes('banana') || n.includes('orange') || n.includes('mango'))
                                      return { calories: 80,  protein: 1,  carbs: 20, fats: 0  };
  if (n.includes('juice'))            return { calories: 110, protein: 1,  carbs: 26, fats: 0  };
  if (n.includes('milk') || n.includes('yogurt') || n.includes('cheese'))
                                      return { calories: 150, protein: 8,  carbs: 12, fats: 8  };
  if (n.includes('steak') || n.includes('beef') || n.includes('meat'))
                                      return { calories: 300, protein: 30, carbs: 0,  fats: 18 };
  if (n.includes('pork') || n.includes('bacon'))
                                      return { calories: 280, protein: 25, carbs: 0,  fats: 20 };
  if (n.includes('biryani') || n.includes('curry') || n.includes('masala'))
                                      return { calories: 320, protein: 18, carbs: 40, fats: 10 };
  if (n.includes('dosa') || n.includes('idli') || n.includes('upma'))
                                      return { calories: 180, protein: 5,  carbs: 34, fats: 3  };
  if (n.includes('dal') || n.includes('lentil'))
                                      return { calories: 160, protein: 10, carbs: 28, fats: 1  };
  if (n.includes('vegetable') || n.includes('veggie'))
                                      return { calories: 80,  protein: 3,  carbs: 15, fats: 1  };
  return { calories: 200, protein: 8, carbs: 25, fats: 8 };
}

// --- FOOD KNOWLEDGE DATABASE MAPPER ---
interface FoodMetadata {
  cuisine: string;
  type: string;
  ingredients: string[];
  servingSuggestion: string;
}

function getFoodMetadata(name: string): FoodMetadata {
  const n = name.toLowerCase();
  
  let cuisine = "International";
  let type = "Other Foods";
  let ingredients: string[] = ["Main ingredient"];
  let servingSuggestion = "Serve fresh at room temperature.";

  if (n.includes("apple") || n.includes("banana") || n.includes("mango") || n.includes("orange") || n.includes("grape") || n.includes("kiwi") || n.includes("fruit")) {
    cuisine = "Natural";
    type = "Fruits";
    ingredients = [name];
    servingSuggestion = "Wash thoroughly and serve fresh as a healthy snack.";
  } else if (n.includes("potato") || n.includes("tomato") || n.includes("carrot") || n.includes("cabbage") || n.includes("spinach") || n.includes("broccoli") || n.includes("vegetable")) {
    cuisine = "Natural";
    type = "Vegetables";
    ingredients = [name];
    servingSuggestion = "Steam, grill, or include in a fresh salad.";
  } else if (n.includes("pizza")) {
    cuisine = "Italian";
    type = "Fast Food";
    ingredients = ["Wheat flour", "Tomato sauce", "Mozzarella cheese", "Yeast", "Olive oil", "Herbs"];
    servingSuggestion = "Serve hot with a side of garlic dipping sauce and red pepper flakes.";
  } else if (n.includes("burger") || n.includes("sandwich")) {
    cuisine = "Western";
    type = "Fast Food";
    ingredients = ["Bun/Bread", "Patty (meat or veggie)", "Lettuce", "Tomato", "Cheese", "Sauce"];
    servingSuggestion = "Serve warm with french fries and ketchup.";
  } else if (n.includes("biryani")) {
    cuisine = "Indian";
    type = "Indian Dishes";
    ingredients = ["Basmati rice", "Spices (cardamom, clove, cinnamon)", "Meat/Paneer", "Yogurt", "Onions"];
    servingSuggestion = "Serve hot with cucumber raita and sliced onions.";
  } else if (n.includes("curry") || n.includes("masala") || n.includes("paneer")) {
    cuisine = "Indian";
    type = "Indian Dishes";
    ingredients = ["Spices", "Onion-tomato gravy", "Heavy cream/Yogurt", "Tofu/Paneer/Chicken"];
    servingSuggestion = "Serve hot with butter naan or steamed basmati rice.";
  } else if (n.includes("dosa") || n.includes("idli")) {
    cuisine = "South Indian";
    type = "Indian Dishes";
    ingredients = ["Rice batter", "Urad dal", "Fenugreek seeds"];
    servingSuggestion = "Serve hot with coconut chutney and hot sambar.";
  } else if (n.includes("naan") || n.includes("roti") || n.includes("chapati")) {
    cuisine = "Indian";
    type = "Bakery & Breads";
    ingredients = ["Wheat flour", "Water", "Ghee/Butter"];
    servingSuggestion = "Serve hot straight from the oven to accompany spicy curries.";
  } else if (n.includes("dumpling") || n.includes("spring roll") || n.includes("chow mein") || n.includes("kung pao")) {
    cuisine = "Chinese";
    type = "Chinese Dishes";
    ingredients = ["Noodles/Wrapper", "Vegetables", "Soy sauce", "Sesame oil", "Meat/Tofu"];
    servingSuggestion = "Serve hot with chili oil or sweet and sour sauce.";
  } else if (n.includes("cake") || n.includes("cookie") || n.includes("sweet") || n.includes("gulab jamun") || n.includes("jalebi")) {
    cuisine = "Dessert";
    type = "Desserts & Sweets";
    ingredients = ["Sugar", "Flour", "Milk solids/Butter", "Flavorings"];
    servingSuggestion = "Serve warm or chilled as a dessert.";
  } else if (n.includes("salad")) {
    cuisine = "Western";
    type = "Salads";
    ingredients = ["Leafy greens", "Cucumber", "Tomatoes", "Vinaigrette / Dressing"];
    servingSuggestion = "Serve cold as a refreshing starter or light meal.";
  } else if (n.includes("soup")) {
    cuisine = "International";
    type = "Soups & Stews";
    ingredients = ["Broth", "Vegetables/Meat", "Seasonings", "Herbs"];
    servingSuggestion = "Serve piping hot with breadsticks or crackers.";
  }

  return { cuisine, type, ingredients, servingSuggestion };
}

function formatClassName(raw: string): string {
  let cleaned = raw.replace(/^scraped_/i, '').replace(/^indian80_/i, '');
  return cleaned.replace(/_/g, ' ').replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase()).trim();
}

// --- MODEL LOAD ENGINE ---
export async function loadFoodModel(): Promise<void> {
  if (sessionGeneralist || isModelLoading) return;
  isModelLoading = true;
  try {
    console.log('[FoodEngine] Loading Cascade Models...');

    const [metaRes, dbRes] = await Promise.all([
      fetch('/models/food-cascade-metadata.json').catch(() => null),
      fetch('/data/food-nutrition-db.json').catch(() => null)
    ]);

    if (metaRes && metaRes.ok) {
      cascadeMetadata = await metaRes.json();
      console.log('[FoodEngine] Loaded cascade class mapping metadata.');
    } else {
      console.warn('[FoodEngine] Cascade metadata not found, running generalist fallback.');
    }

    if (dbRes && dbRes.ok) {
      nutritionDb = await dbRes.json();
    }

    // Load 5-Expert Generalist
    sessionGeneralist = await ort.InferenceSession.create('/models/generalist_int8.onnx', {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
    
    console.log('[FoodEngine] Cascade Generalist Loaded.');
  } catch (error) {
    console.error('[FoodEngine] Failed to initialize Cascade Engine:', error);
    sessionGeneralist = null;
  } finally {
    isModelLoading = false;
  }
}

// --- IMAGE PREPROCESSING ---
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

// --- HIERARCHICAL INFERENCE RUNNER ---
export async function runFoodInference(imageDataUrl: string, k: number = 5): Promise<FoodInferenceResult[]> {
  if (!sessionGeneralist) await loadFoodModel();
  if (!sessionGeneralist) return [];

  try {
    const input = await preprocessImage(imageDataUrl);
    const tensor = new ort.Tensor('float32', input, [1, 3, 224, 224]);

    // 1. Run Generalist Model (5 broad categories)
    const inGen = sessionGeneralist.inputNames[0];
    const outGen = sessionGeneralist.outputNames[0];
    const genOutputs = await sessionGeneralist.run({ [inGen]: tensor });
    const genLogits = genOutputs[outGen].data as Float32Array;

    // Apply Softmax
    const maxGen = Math.max(...Array.from(genLogits));
    const expGen = Array.from(genLogits).map(v => Math.exp(v - maxGen));
    const sumGen = expGen.reduce((a, b) => a + b, 0);
    const genProbs = expGen.map(v => v / sumGen);

    // Find the primary category
    let topCatIdx = 0;
    let maxCatProb = 0;
    for (let i = 0; i < genProbs.length; i++) {
      if (genProbs[i] > maxCatProb) {
        maxCatProb = genProbs[i];
        topCatIdx = i;
      }
    }

    const predictedCategory = CATEGORIES[topCatIdx] || "desserts_drinks_others";
    console.log(`[FoodEngine] MoE Category: ${predictedCategory} (${(maxCatProb * 100).toFixed(1)}%)`);

    // 2. Load and run Specialist Model if sub-classes exist
    const specialistClasses = cascadeMetadata?.specialists?.[predictedCategory] || [];
    let finalPredictions: { className: string; confidence: number; classId: number }[] = [];

    if (specialistClasses.length > 1) {
      if (activeSpecialistIndex !== topCatIdx || !activeSpecialistSession) {
        if (activeSpecialistSession) {
          console.log(`[FoodEngine] Disposing expert model for index ${activeSpecialistIndex} to free RAM.`);
          activeSpecialistSession = null;
        }

        try {
          console.log(`[FoodEngine] Loading specialist model: /models/specialist_${topCatIdx}_int8.onnx`);
          activeSpecialistSession = await ort.InferenceSession.create(`/models/specialist_${topCatIdx}_int8.onnx`, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all'
          });
          activeSpecialistIndex = topCatIdx;
        } catch (err) {
          console.error(`[FoodEngine] Could not load specialist_${topCatIdx}_int8.onnx:`, err);
          activeSpecialistSession = null;
          activeSpecialistIndex = null;
        }
      }

      if (activeSpecialistSession) {
        const specIn = activeSpecialistSession.inputNames[0];
        const specOut = activeSpecialistSession.outputNames[0];
        const specOutputs = await activeSpecialistSession.run({ [specIn]: tensor });
        const specLogits = specOutputs[specOut].data as Float32Array;

        // Apply Softmax to specialist outputs
        const maxSpec = Math.max(...Array.from(specLogits));
        const expSpec = Array.from(specLogits).map(v => Math.exp(v - maxSpec));
        const sumSpec = expSpec.reduce((a, b) => a + b, 0);
        const specProbs = expSpec.map(v => v / sumSpec);

        for (let i = 0; i < specProbs.length; i++) {
          const className = specialistClasses[i] || `Unknown Class ${i}`;
          const confidence = maxCatProb * specProbs[i];
          finalPredictions.push({ className, confidence, classId: i });
        }
      }
    }

    // Fallback: If no specialist model exists or it failed to load
    if (finalPredictions.length === 0) {
      const classIndexList = cascadeMetadata?.class_index || CATEGORIES;
      for (let i = 0; i < genProbs.length; i++) {
        const className = classIndexList[i] || CATEGORIES[i];
        finalPredictions.push({
          className: className,
          confidence: genProbs[i],
          classId: i
        });
      }
    }

    // 3. Direct Out-of-Distribution (OOD) Background Filter Bypass
    const backgroundPrediction = finalPredictions.find(p => p.className.toLowerCase() === "non_food_background");
    
    // If the top prediction is the background, or if the background confidence is very high
    if (backgroundPrediction && (finalPredictions[0].className === "non_food_background" || backgroundPrediction.confidence > 0.40)) {
      console.log(`[FoodEngine] OOD Triggered: Identified Non-Food Background scene (${(backgroundPrediction.confidence * 100).toFixed(1)}%).`);
      return [{
        classId: -1,
        className: "Unknown Food",
        confidence: backgroundPrediction.confidence,
        nutrients: { calories: 0, protein: 0, carbs: 0, fats: 0 },
        metadata: {
          cuisine: "Unknown",
          type: "Non-Food scene detected",
          ingredients: [],
          servingSuggestion: "No food was identified in the image. Please take a clear picture of your plate/meal."
        }
      }];
    }

    // Remove background class from candidate list before sorting and re-ranking
    finalPredictions = finalPredictions.filter(p => p.className.toLowerCase() !== "non_food_background");

    // 4. Apply Re-ranking Logic (Popularity Bias)
    finalPredictions.forEach(p => {
      const nameLower = p.className.toLowerCase();
      let weight = 1.0;
      for (const [key, val] of Object.entries(POPULAR_FOODS)) {
        if (nameLower.includes(key)) {
          weight = Math.max(weight, val);
        }
      }
      p.confidence *= weight;
    });

    // Re-normalize confidence scores
    const totalConf = finalPredictions.reduce((sum, p) => sum + p.confidence, 0);
    finalPredictions.forEach(p => {
      p.confidence = totalConf > 0 ? (p.confidence / totalConf) : p.confidence;
    });

    // Sort predictions descending
    finalPredictions.sort((a, b) => b.confidence - a.confidence);

    // 5. Thresholding and Output Formatting (Top 3 predictions)
    const combinedResults: FoodInferenceResult[] = [];
    const topPrediction = finalPredictions[0];
    
    const isLowConfidence = !topPrediction || topPrediction.confidence < 0.30;
    const isAmbiguous = finalPredictions.length >= 2 && (topPrediction.confidence - finalPredictions[1].confidence < 0.15);

    if (isLowConfidence) {
      console.log(`[FoodEngine] Low confidence trigger: top prediction has confidence < 30%.`);
      
      // Absolute uncertainty: Primary Match is "Unknown Food"
      combinedResults.push({
        classId: -1,
        className: "Unknown Food",
        confidence: topPrediction ? topPrediction.confidence : 0.0,
        nutrients: { calories: 0, protein: 0, carbs: 0, fats: 0 },
        metadata: {
          cuisine: "Unknown",
          type: "Unrecognizable",
          ingredients: [],
          servingSuggestion: "The image is too blurry, dark, or lacks focus. Please try taking another clear photo."
        }
      });
      
      // Return top 3 alternatives anyway for reference
      const count = Math.min(3, finalPredictions.length);
      for (let i = 0; i < count; i++) {
        const item = finalPredictions[i];
        const dispName = formatClassName(item.className);
        const legNut = nutritionDb?.[item.className] || nutritionDb?.[dispName];
        const nutrition = legNut ? { calories: legNut.calories, protein: legNut.protein, carbs: legNut.carbs, fats: legNut.fats } : estimateNutrition(item.className);
        combinedResults.push({
          classId: item.classId,
          className: dispName,
          confidence: item.confidence,
          nutrients: nutrition,
          metadata: getFoodMetadata(item.className)
        });
      }
    } else if (isAmbiguous) {
      console.log(`[FoodEngine] Ambiguous match trigger: margin between Top-1 and Top-2 is less than 15%.`);
      
      // Margin uncertainty: Primary Match is "Unknown Food"
      combinedResults.push({
        classId: -1,
        className: "Unknown Food",
        confidence: topPrediction.confidence,
        nutrients: { calories: 0, protein: 0, carbs: 0, fats: 0 },
        metadata: {
          cuisine: "Unknown",
          type: "Ambiguous Match",
          ingredients: [],
          servingSuggestion: "This item looks visually ambiguous. Please select the correct option from the candidates below."
        }
      });

      // Include the top 3 alternatives so the user can resolve the ambiguity
      const count = Math.min(3, finalPredictions.length);
      for (let i = 0; i < count; i++) {
        const item = finalPredictions[i];
        const dispName = formatClassName(item.className);
        const legNut = nutritionDb?.[item.className] || nutritionDb?.[dispName];
        const nutrition = legNut ? { calories: legNut.calories, protein: legNut.protein, carbs: legNut.carbs, fats: legNut.fats } : estimateNutrition(item.className);
        
        combinedResults.push({
          classId: item.classId,
          className: dispName,
          confidence: item.confidence,
          nutrients: nutrition,
          metadata: getFoodMetadata(item.className)
        });
      }
    } else {
      // Clear separation between Top-1 and Top-2, match accepted!
      const count = Math.min(k, finalPredictions.length);
      for (let i = 0; i < count; i++) {
        const item = finalPredictions[i];
        const dispName = formatClassName(item.className);
        const legNut = nutritionDb?.[item.className] || nutritionDb?.[dispName];
        const nutrition = legNut ? { calories: legNut.calories, protein: legNut.protein, carbs: legNut.carbs, fats: legNut.fats } : estimateNutrition(item.className);
        
        combinedResults.push({
          classId: item.classId,
          className: dispName,
          confidence: item.confidence,
          nutrients: nutrition,
          metadata: getFoodMetadata(item.className)
        });
      }
    }

    return combinedResults;
  } catch (error) {
    console.error('[FoodEngine] Inference error:', error);
    return [];
  }
}


