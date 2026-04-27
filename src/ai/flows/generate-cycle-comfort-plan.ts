
'use server';
/**
 * @fileOverview Generates a comfort plan for menstrual cycle days.
 *
 * - generateCycleComfortPlan - A function that handles the plan generation.
 * - GenerateCycleComfortPlanInput - The input type.
 * - GenerateCycleComfortPlanOutput - The return type.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GenerateCycleComfortPlanInputSchema = z.object({
  isPeriodDay: z.boolean().describe('Indicates if advice is for a period day.'),
  userNotes: z.string().optional().describe('Optional notes from the user, e.g., "heavy flow", "cramps", "low energy". Max 100 chars.'),
});
export type GenerateCycleComfortPlanInput = z.infer<typeof GenerateCycleComfortPlanInputSchema>;

const GenerateCycleComfortPlanOutputSchema = z.object({
  comfortingFoods: z.array(z.string()).describe('List of 2-4 food suggestions that may help with period discomfort, with brief examples. Each max 70 chars.'),
  foodsToLimit: z.array(z.string()).describe('List of 2-3 foods or drinks to consider limiting during period, with brief examples. Each max 70 chars.'),
  gentleExercises: z.array(z.string()).describe('List of 2-3 gentle exercises or activities suitable for period days. Each max 70 chars.'),
  selfCareTips: z.array(z.string()).describe('List of 2-3 self-care tips for comfort and well-being. Each max 70 chars.'),
  importantReminder: z.string().optional().describe('A very brief, gentle reminder, e.g., "Listen to your body." Max 50 chars.'),
  positiveAffirmation: z.string().optional().describe('A short, positive affirmation. Max 70 chars with an emoji.'),
});
export type GenerateCycleComfortPlanOutput = z.infer<typeof GenerateCycleComfortPlanOutputSchema>;

export async function generateCycleComfortPlan(
  input: GenerateCycleComfortPlanInput
): Promise<GenerateCycleComfortPlanOutput> {
  return generateCycleComfortPlanFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCycleComfortPlanPrompt',
  input: {schema: GenerateCycleComfortPlanInputSchema},
  output: {schema: GenerateCycleComfortPlanOutputSchema},
  prompt: `You are a caring and supportive AI assistant specializing in providing gentle advice for menstrual cycle comfort.
The user is looking for suggestions because it is their period day (isPeriodDay: {{{isPeriodDay}}}).
{{#if userNotes}}User's notes: {{{userNotes}}}{{/if}}

Based on this, provide:
1.  **Comforting Foods (2-4 items, each max 70 chars):** Suggest foods that can help with common period symptoms like cramps, fatigue, or mood swings. Include brief examples (e.g., "Warm herbal teas (ginger, chamomile)", "Dark chocolate (for mood boost)").
2.  **Foods to Limit (2-3 items, each max 70 chars):** Suggest foods or drinks that might worsen symptoms and are generally good to limit during this time. Include brief examples (e.g., "Excessive caffeine (can increase anxiety)", "Highly salty foods (may cause bloating)").
3.  **Gentle Exercises (2-3 items, each max 70 chars):** Recommend light activities or exercises that can be beneficial. (e.g., "Light stretching or yoga", "Short, gentle walks").
4.  **Self-Care Tips (2-3 items, each max 70 chars):** Offer practical self-care advice for comfort. (e.g., "Use a heating pad for cramps", "Prioritize rest and sleep").
5.  **Important Reminder (optional, max 50 chars):** A very short, kind reminder like "Listen to your body." or "Be gentle with yourself."
6.  **Positive Affirmation (optional, max 70 chars with an emoji):** A brief, uplifting affirmation. (e.g., "My body is strong and capable. ✨", "I honor my body's needs. ❤️").

Keep all suggestions practical, concise, and empathetic. Avoid making medical claims or giving medical advice.
Focus on general well-being and comfort measures.
Structure the output strictly according to the 'GenerateCycleComfortPlanOutputSchema'.
`,
});

const generateCycleComfortPlanFlow = ai.defineFlow(
  {
    name: 'generateCycleComfortPlanFlow',
    inputSchema: GenerateCycleComfortPlanInputSchema,
    outputSchema: GenerateCycleComfortPlanOutputSchema,
  },
  async (input: GenerateCycleComfortPlanInput) => {
    console.log('[AI Flow] generateCycleComfortPlanFlow invoked. Is period day:', input.isPeriodDay);
    try {
        const {output} = await prompt(input);
        if (!output) {
            console.error('[AI Flow] AI plan generation returned null or undefined output.');
            throw new Error('AI plan generation did not produce a valid output structure.');
        }
        console.log('[AI Flow] AI cycle comfort plan generation successful.');
        return output;
    } catch (err: any) {
        console.error('[AI Flow] Error during AI processing in generateCycleComfortPlanFlow:', err);
        let errorMessage = 'An unexpected error occurred during AI plan generation.';
        if (err instanceof Error) {
            errorMessage = err.message;
        } else if (typeof err === 'string') {
            errorMessage = err;
        }
        throw new Error(`AI Plan Generation Failed: ${errorMessage}`);
    }
  }
);

