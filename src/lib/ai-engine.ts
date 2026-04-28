
/**
 * @fileOverview Custom AI & Rules Engine
 * Central hub for proprietary models (VisiFood, PhysiPose) and deterministic health rules.
 */

export interface FoodAnalysisResult {
  itemName: string;
  confidence: number;
  nutrients?: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
}

export interface BodyMetricsResult {
  estimatedFatPercentage: number;
  postureScore: number;
  landmarksDetected: boolean;
  measurements: {
    waistCm?: number;
    hipCm?: number;
    shoulderWidthCm?: number;
  };
}

export interface IdealBodyPlanResult {
  planTitle: string;
  planSummary: string;
  dietPlan: {
    dailyCalorieTarget: number;
    macronutrientSplit: {
      proteinGrams: number;
      carbsGrams: number;
      fatsGrams: number;
    };
    mealSuggestions: string[];
  };
  workoutPlan: {
    frequencyPerWeek: string;
    focus: string;
    sampleExercises: string[];
  };
  lifestyleTips: string[];
}

import { runFoodInference } from './food-engine';

class CustomAIEngine {
  /**
   * MODEL 1: VisiFood (Food Classification)
   * Simulated for now, ready for ONNX integration.
   */
  async runVisiFood(imageDataUri: string): Promise<FoodAnalysisResult> {
    // Only run proprietary local engine if in the browser
    if (typeof window !== 'undefined') {
      const res = await runFoodInference(imageDataUri);
      if (res && res.length > 0) {
        return { 
          itemName: res[0].className, 
          confidence: res[0].confidence,
          nutrients: res[0].nutrients
        };
      }
    }
    
    // Server-side or fallback simulated logic
    console.log("[VisiFood] Local engine NOT found. Using generic fallback.");
    return { itemName: "Unknown Dish", confidence: 0.1 };
  }

  /**
   * MODEL 2: PhysiPose (Body Metrics)
   * Simulated pose estimation.
   */
  async runPhysiPose(imageDataUri: string): Promise<BodyMetricsResult> {
    return {
      estimatedFatPercentage: 19.2,
      postureScore: 9,
      landmarksDetected: true,
      measurements: { waistCm: 82, hipCm: 94, shoulderWidthCm: 44 }
    };
  }

  /**
   * ENGINE: Ideal Body Calculator (Deterministic Math)
   * Uses Mifflin-St Jeor Equation.
   */
  async calculateIdealBodyPlan(input: {
    weightKg: number;
    heightCm: number;
    age: number;
    gender: 'male' | 'female' | 'other';
    goal: 'weight_loss' | 'muscle_gain' | 'maintenance';
    activityLevel: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
  }): Promise<IdealBodyPlanResult> {
    // 1. BMR Calculation
    let bmr = (10 * input.weightKg) + (6.25 * input.heightCm) - (5 * input.age);
    bmr = input.gender === 'male' ? bmr + 5 : bmr - 161;

    // 2. TDEE Calculation
    const multipliers = { sedentary: 1.2, lightly_active: 1.375, moderately_active: 1.55, very_active: 1.725 };
    let tdee = bmr * multipliers[input.activityLevel];

    // 3. Goal Adjustment
    if (input.goal === 'weight_loss') tdee -= 500;
    if (input.goal === 'muscle_gain') tdee += 400;

    const calories = Math.round(tdee);
    
    // 4. Macros (Protein: 2g/kg, Fats: 25%, Carbs: Rest)
    const protein = Math.round(input.weightKg * 2);
    const fats = Math.round((calories * 0.25) / 9);
    const carbs = Math.round((calories - (protein * 4) - (fats * 9)) / 4);

    return {
      planTitle: `${input.goal.replace('_', ' ').toUpperCase()} Blueprint`,
      planSummary: `A precision-calculated plan optimized for ${input.activityLevel.replace('_', ' ')} metabolic demands.`,
      dietPlan: {
        dailyCalorieTarget: calories,
        macronutrientSplit: { proteinGrams: protein, carbsGrams: carbs, fatsGrams: fats },
        mealSuggestions: ["Oatmeal with protein scoop", "Grilled chicken and quinoa", "Greek yogurt with nuts"]
      },
      workoutPlan: {
        frequencyPerWeek: input.goal === 'muscle_gain' ? "4-5 sessions" : "3-4 sessions",
        focus: input.goal === 'muscle_gain' ? "Hypertrophy" : "Metabolic Conditioning",
        sampleExercises: ["Compound Lifts", "Steady State Cardio", "Mobility Drills"]
      },
      lifestyleTips: ["Prioritize 7-8h sleep", "Hydrate with 3L water", "Daily steps: 8k+"]
    };
  }

  /**
   * ENGINE: Diet Classifier (Rule-Based)
   */
  async inferDietProfile(foodItems: string[]): Promise<{ suggestedDietNames: string[], reasoning: string }> {
    const lowerItems = foodItems.map(i => i.toLowerCase());
    const hasMeat = lowerItems.some(i => i.includes('meat') || i.includes('chicken') || i.includes('beef') || i.includes('pork'));
    const hasFish = lowerItems.some(i => i.includes('fish') || i.includes('seafood') || i.includes('salmon'));
    const hasDairy = lowerItems.some(i => i.includes('milk') || i.includes('cheese') || i.includes('dairy') || i.includes('yogurt'));
    const hasEggs = lowerItems.some(i => i.includes('egg'));

    if (!hasMeat && !hasFish && !hasDairy && !hasEggs) {
      return { suggestedDietNames: ["Vegan"], reasoning: "No animal products detected in your selections." };
    }
    if (!hasMeat && !hasFish && (hasDairy || hasEggs)) {
      return { suggestedDietNames: ["Vegetarian"], reasoning: "Plant-based with some dairy/egg inclusions." };
    }
    if (!hasMeat && hasFish) {
      return { suggestedDietNames: ["Pescatarian"], reasoning: "Seafood-inclusive vegetarian pattern." };
    }
    return { suggestedDietNames: ["Omnivore"], reasoning: "A balanced, non-restrictive dietary pattern." };
  }

  /**
   * ENGINE: Calm Cycle Planner
   */
  async getCycleComfortPlan(isPeriodDay: boolean): Promise<any> {
    if (isPeriodDay) {
      return {
        comfortingFoods: ["Warm ginger tea", "Dark chocolate", "Leafy greens"],
        foodsToLimit: ["Caffeine", "High salt snacks"],
        gentleExercises: ["Yoga", "Slow walking"],
        selfCareTips: ["Use a heating pad", "Early bedtime"],
        positiveAffirmation: "I listen to my body's needs. "
      };
    }
    return {
      comfortingFoods: ["Fresh fruits", "Lean proteins"],
      foodsToLimit: ["Processed sugars"],
      gentleExercises: ["Strength training", "HIIT"],
      selfCareTips: ["Maintain routine", "Focus on goals"],
      positiveAffirmation: "I am strong and energetic. "
    };
  }

  async getNutritionalData(foodName: string): Promise<any> {
    // This is now redundant if using runVisiFood, but kept for compatibility
    return { calories: 420, protein: 35, carbs: 12, fats: 15 };
  }
}

export const aiEngine = new CustomAIEngine();
