'use server';
/**
 * @fileOverview Generates a personalized fitness and diet plan based on user metrics.
 *
 * - generateIdealBodyPlan - A function that handles the plan generation.
 * - GenerateIdealBodyPlanInput - The input type for the function.
 * - GenerateIdealBodyPlanOutput - The return type for the function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GenerateIdealBodyPlanInputSchema = z.object({
  currentWeightKg: z.number().describe('User\'s current weight in kilograms.'),
  heightCm: z.number().describe('User\'s height in centimeters.'),
  age: z.number().describe('User\'s age in years.'),
  gender: z.enum(['male', 'female', 'other']).describe('User\'s gender.'),
  fitnessGoal: z.enum(['weight_loss', 'muscle_gain', 'maintenance']).describe('User\'s primary fitness goal.'),
  activityLevel: z.enum(['sedentary', 'lightly_active', 'moderately_active', 'very_active']).describe('User\'s daily activity level.'),
});
export type GenerateIdealBodyPlanInput = z.infer<typeof GenerateIdealBodyPlanInputSchema>;


const MacronutrientSplitSchema = z.object({
    proteinGrams: z.number().describe('Recommended daily protein intake in grams.'),
    carbsGrams: z.number().describe('Recommended daily carbohydrate intake in grams.'),
    fatsGrams: z.number().describe('Recommended daily fat intake in grams.'),
});

const DietPlanSchema = z.object({
    dailyCalorieTarget: z.number().describe('Recommended daily calorie intake target.'),
    macronutrientSplit: MacronutrientSplitSchema,
    mealSuggestions: z.array(z.string()).optional().describe('Example meal ideas for breakfast, lunch, and dinner. Max 3 items.'),
});

const WorkoutPlanSchema = z.object({
    frequencyPerWeek: z.string().describe('Recommended number of workout sessions per week (e.g., "3-4 times per week").'),
    focus: z.string().describe('Primary focus of the workouts (e.g., "Full Body Strength", "Cardio & Core").'),
    sampleExercises: z.array(z.string()).describe('A list of 3-5 sample exercises suitable for the user\'s goal.'),
});

const GenerateIdealBodyPlanOutputSchema = z.object({
  planTitle: z.string().describe('A catchy and motivational title for the generated plan.'),
  planSummary: z.string().describe('A brief, encouraging summary of the plan (2-3 sentences).'),
  dietPlan: DietPlanSchema,
  workoutPlan: WorkoutPlanSchema,
  lifestyleTips: z.array(z.string()).optional().describe('2-3 additional tips related to hydration, sleep, or consistency.'),
});
export type GenerateIdealBodyPlanOutput = z.infer<typeof GenerateIdealBodyPlanOutputSchema>;


export async function generateIdealBodyPlan(
  input: GenerateIdealBodyPlanInput
): Promise<GenerateIdealBodyPlanOutput> {
  return generateIdealBodyPlanFlow(input);
}


const prompt = ai.definePrompt({
  name: 'generateIdealBodyPlanPrompt',
  input: {schema: GenerateIdealBodyPlanInputSchema},
  output: {schema: GenerateIdealBodyPlanOutputSchema},
  prompt: `You are an expert fitness and nutrition coach. Based on the user's data, create a comprehensive and motivating ideal body plan.

User Data:
- Goal: {{{fitnessGoal}}}
- Weight: {{{currentWeightKg}}} kg
- Height: {{{heightCm}}} cm
- Age: {{{age}}}
- Gender: {{{gender}}}
- Activity Level: {{{activityLevel}}}

Instructions:
1.  **Calculate BMR and TDEE (for calorie target):**
    *   Use the Mifflin-St Jeor equation for BMR:
        *   Men: (10 * weight in kg) + (6.25 * height in cm) - (5 * age) + 5
        *   Women: (10 * weight in kg) + (6.25 * height in cm) - (5 * age) - 161
    *   Use these multipliers for TDEE (Total Daily Energy Expenditure):
        *   sedentary: 1.2
        *   lightly_active: 1.375
        *   moderately_active: 1.55
        *   very_active: 1.725
    *   Adjust TDEE for the goal:
        *   weight_loss: Subtract 500 calories
        *   muscle_gain: Add 300-500 calories
        *   maintenance: No change

2.  **Determine Macronutrient Split (grams):**
    *   Protein: 1.6-2.2g per kg of body weight (higher end for muscle gain).
    *   Fats: 20-30% of total daily calories. 1g fat = 9 calories.
    *   Carbs: Remainder of calories. 1g protein/carb = 4 calories.

3.  **Create Diet Plan:**
    *   Provide the calculated daily calorie target.
    *   Provide the calculated macronutrient split in grams.
    *   Suggest 2-3 sample meal ideas aligned with the goal (e.g., "High-protein breakfast: Scrambled eggs with spinach").

4.  **Create Workout Plan:**
    *   Recommend a workout frequency (e.g., "3-5 times per week").
    *   Define a workout focus based on the goal (e.g., "Strength Training & Cardio" for weight loss, "Progressive Overload Strength" for muscle gain).
    *   List 3-5 sample exercises that align with the focus (e.g., Squats, Deadlifts, Bench Press, HIIT Sprints, Yoga).

5.  **Add Lifestyle Tips:**
    *   Provide 2-3 actionable tips regarding hydration (e.g., "Drink at least 3L of water daily"), sleep, or consistency.

6.  **Assemble the Output:**
    *   Create a catchy title for the plan.
    *   Write a short, motivational summary.
    *   Structure the final output strictly according to the 'GenerateIdealBodyPlanOutputSchema'. Ensure all fields are populated correctly.
`,
});

const generateIdealBodyPlanFlow = ai.defineFlow(
  {
    name: 'generateIdealBodyPlanFlow',
    inputSchema: GenerateIdealBodyPlanInputSchema,
    outputSchema: GenerateIdealBodyPlanOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI analysis failed to produce a plan.');
    }
    return output;
  }
);
