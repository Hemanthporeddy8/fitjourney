'use server';

/**
 * @fileOverview Refactored to use the Custom VisiFood Vision Model and NutriPredict Data Service.
 */

import { z } from 'genkit';
import { aiEngine } from '@/lib/ai-engine';

const EstimateCaloriesFromPhotoInputSchema = z.object({
  photoDataUri: z.string(),
  recentWoundInfo: z.any().optional(),
  cycleCalmInfo: z.any().optional(),
});

export type EstimateCaloriesFromPhotoInput = z.infer<typeof EstimateCaloriesFromPhotoInputSchema>;

const EstimateCaloriesFromPhotoOutputSchema = z.object({
  foodName: z.string(),
  calories: z.number(),
  protein: z.number(),
  vitamins: z.string(),
  ingredientsBreakdown: z.array(z.object({
    name: z.string(),
    calories: z.number().optional(),
    protein: z.number().optional()
  })).optional(),
});

export type EstimateCaloriesFromPhotoOutput = z.infer<typeof EstimateCaloriesFromPhotoOutputSchema>;

export async function estimateCaloriesFromPhoto(input: EstimateCaloriesFromPhotoInput): Promise<EstimateCaloriesFromPhotoOutput> {
  // 1. Identification via Proprietary VisiFood Model
  const classification = await aiEngine.runVisiFood(input.photoDataUri);
  
  // 2. Data Retrieval via NutriPredict Service
  const nutrition = await aiEngine.getNutritionalData(classification.itemName);

  return {
    foodName: classification.itemName,
    calories: nutrition.calories,
    protein: nutrition.protein,
    vitamins: "Vitamins A, B6, C",
    ingredientsBreakdown: [
      { name: classification.itemName, calories: nutrition.calories, protein: nutrition.protein }
    ]
  };
}
