
'use server';
/**
 * @fileOverview Infers a dietary profile based on selected food items.
 *
 * - inferDietFromFoodItems - A function that handles the diet inference.
 * - InferDietInput - The input type.
 * - InferDietOutput - The return type.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import { foodIdToConcept, knownDietaryProfiles } from '@/lib/eatmap-data';


const InferDietInputSchema = z.object({
  selectedFoodItemNames: z.array(z.string()).describe('An array of names of food items the user typically eats or prefers. e.g., ["Egg", "Broccoli", "Apple", "Milk (Dairy)"]'),
});
export type InferDietInput = z.infer<typeof InferDietInputSchema>;

const InferDietOutputSchema = z.object({
  suggestedDietNames: z.array(z.string()).describe('A list of suggested dietary profile names (e.g., "Eggetarian", "Lacto-Ovo Vegetarian"). Could be empty if no specific profile fits well.'),
  reasoning: z.string().optional().describe('A brief explanation for the suggested diet(s).'),
});
export type InferDietOutput = z.infer<typeof InferDietOutputSchema>;

export async function inferDietFromFoodItems(
  input: InferDietInput
): Promise<InferDietOutput> {
  return inferDietFromFoodItemsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'inferDietFromFoodItemsPrompt',
  input: {schema: InferDietInputSchema},
  output: {schema: InferDietOutputSchema},
  prompt: `You are an expert nutritionist specializing in identifying dietary patterns.
The user has indicated they typically include the following food items/categories in their diet:
{{#each selectedFoodItemNames}}
- {{this}}
{{/each}}

Based *only* on this list of included items, and considering common dietary definitions, infer the most specific and accurate dietary profile(s).

Consider these common dietary profiles and their key characteristics:
- **Vegan:** Excludes ALL animal products (meat, poultry, fish, eggs, dairy, honey). Eats only plant-based foods.
- **Lacto-Vegetarian:** Excludes meat, poultry, fish, and eggs. INCLUDES dairy products.
- **Ovo-Vegetarian:** Excludes meat, poultry, fish, and dairy. INCLUDES eggs.
- **Lacto-Ovo Vegetarian:** Excludes meat, poultry, and fish. INCLUDES dairy and eggs.
- **Eggetarian:** Primarily plant-based but INCLUDES eggs. Excludes meat, poultry, fish. Dairy is often excluded or optional.
- **Pescatarian:** Excludes meat and poultry. INCLUDES fish/seafood. Eggs and dairy are typically allowed.
- **Pollotarian:** Excludes red meat and fish. INCLUDES poultry. Eggs and dairy might be allowed.
- **Flexitarian:** Primarily plant-based diet with occasional, limited consumption of meat, poultry, or fish.
- **Non-Vegetarian (Omnivore):** Consumes a wide variety of foods including meat, poultry, fish, eggs, dairy, and plant-based foods without broad restrictions.
- **Keto (Ketogenic):** Very low carbohydrate, high fat. Typically includes meats, fish, eggs, high-fat dairy, nuts, seeds, low-carb vegetables. Excludes grains, sugars, most fruits.
- **Paleo:** Foods presumed available to Paleolithic humans. Includes meat, fish, fruits, vegetables, nuts, seeds. Excludes grains, legumes, dairy, processed foods.
- **Gluten-Free:** Excludes wheat, barley, rye, and their derivatives. This can overlap with many other dietary patterns.
- **Dairy-Free:** Excludes all dairy products (milk, cheese, yogurt). This can also overlap with other patterns.

Your goal is to find the most fitting profile(s).
- If the selections strongly point to one or more specific diets from the list above, list them. For example, if "Eggs" and "Broccoli/Green Veg" are selected, and "Red Meat", "Poultry", "Fish", "Milk (Dairy)" are NOT selected, "Eggetarian" is a strong candidate.
- If "Red Meat", "Poultry", "Fish", "Eggs", "Milk (Dairy)" are all selected, "Non-Vegetarian (Omnivore)" is likely.
- If only plant-based items are selected (e.g., fruits, vegetables, grains, nuts, plant milk) and items like "Eggs", "Milk (Dairy)", "Honey", "Red Meat" are absent, "Vegan" is a strong candidate.
- If the selections are very minimal or contradictory for a clear profile (e.g., just "Apple"), suggest "Custom Selection / Unclear Pattern" or "Plant-Forward" if applicable.
- If the selection is broad but doesn't fit a restrictive diet (e.g. user selects items from all major food groups including meat, dairy, plants), "Non-Vegetarian (Omnivore)" or "Flexitarian" might be appropriate depending on emphasis.
- If a major category like "Red Meat" is selected, diets like "Vegan" or "Vegetarian" are ruled out.

Provide the suggested diet name(s) and a brief reasoning based on the key inclusions and exclusions implied by the user's selection.
If multiple profiles fit well (e.g., selections compatible with both "Lacto-Ovo Vegetarian" and "Gluten-Free"), list both.
Prioritize more specific diets if the evidence is strong. For example, if someone selects eggs and vegetables but no meat or dairy, "Eggetarian" is more specific than just "Vegetarian".
Ensure the output is in JSON format according to the schema.
`,
});

const inferDietFromFoodItemsFlow = ai.defineFlow(
  {
    name: 'inferDietFromFoodItemsFlow',
    inputSchema: InferDietInputSchema,
    outputSchema: InferDietOutputSchema,
  },
  async (input: InferDietInput) => {
    console.log('[AI Flow] inferDietFromFoodItemsFlow invoked. Selected items:', input.selectedFoodItemNames.join(', '));
    if (input.selectedFoodItemNames.length === 0) {
      return {
        suggestedDietNames: ["Custom Selection / Unclear Pattern"],
        reasoning: "No food items were selected to analyze."
      };
    }

    try {
        const {output} = await prompt(input);
        if (!output) {
            console.error('[AI Flow] AI diet inference returned null or undefined output.');
            throw new Error('AI diet inference did not produce a valid output structure.');
        }
        console.log('[AI Flow] AI diet inference successful. Suggested:', output.suggestedDietNames.join(', '));
        return output;
    } catch (err: any) {
        console.error('[AI Flow] Error during AI processing in inferDietFromFoodItemsFlow:', err);
        let errorMessage = 'An unexpected error occurred during AI diet inference.';
        if (err instanceof Error) {
            errorMessage = err.message;
        } else if (typeof err === 'string') {
            errorMessage = err;
        }
        throw new Error(`AI Diet Inference Failed: ${errorMessage}`);
    }
  }
);
