'use server';

/**
 * @fileOverview Determines which nutrients to display based on user goals and dietary restrictions.
 *
 * - determineIfNutrientsDisplayed - A function that determines which nutrients to display.
 * - DetermineIfNutrientsDisplayedInput - The input type for the determineIfNutrientsDisplayed function.
 * - DetermineIfNutrientsDisplayedOutput - The return type for the determineIfNutrientsDisplayed function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const DetermineIfNutrientsDisplayedInputSchema = z.object({
  userGoals: z
    .string()
    .describe('The user’s fitness goals, e.g., weight loss, muscle gain.'),
  dietaryRestrictions: z
    .string()
    .describe('Any dietary restrictions the user has, e.g., vegetarian, vegan, gluten-free.'),
  availableNutrients: z
    .array(z.string())
    .describe('An array of available nutrients to choose from, e.g., [\