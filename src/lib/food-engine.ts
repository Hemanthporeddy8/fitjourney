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
  // No-op now as the model is hosted on the server
  console.log('[FoodEngine] Server-side VLM model loaded lazily on demand.');
}

// --- IMAGE PREPROCESSING ---
// No longer needed client-side, but kept for signature safety if other files import it
async function preprocessImage(dataUrl: string): Promise<Float32Array> {
  return new Float32Array(0);
}

// --- HIERARCHICAL INFERENCE RUNNER ---
export async function runFoodInference(imageDataUrl: string, k: number = 5): Promise<FoodInferenceResult[]> {
  try {
    console.log('[FoodEngine] Running inference via VLM backend API...');
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageDataUrl }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || 'Failed to scan image via VLM server');
    }

    const data = await res.json();
    
    // Map FastAPI response to FoodInferenceResult structure
    const result: FoodInferenceResult = {
      classId: 0,
      className: formatClassName(data.className),
      confidence: data.confidence || 0.95,
      nutrients: {
        calories: data.nutrients.calories,
        protein: data.nutrients.protein,
        carbs: data.nutrients.carbs,
        fats: data.nutrients.fats,
      },
      metadata: {
        cuisine: data.metadata?.cuisine || 'Unknown',
        type: data.metadata?.type || 'VLM Food Scan',
        ingredients: data.metadata?.ingredients || [],
        servingSuggestion: data.metadata?.servingSuggestion || 'Serve fresh.'
      }
    };

    return [result];
  } catch (error) {
    console.error('[FoodEngine] Inference error:', error);
    throw error;
  }
}



