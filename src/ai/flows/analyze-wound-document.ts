
'use server';
/**
 * @fileOverview Analyzes a wound photo or medical document.
 *
 * - analyzeWoundOrDocument - A function that handles the analysis.
 * - AnalyzeWoundOrDocumentInput - The input type.
 * - AnalyzeWoundOrDocumentOutput - The return type.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const AnalyzeWoundOrDocumentInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a wound or a medical document (e.g., X-ray, scan report), as a data URI. Format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzeWoundOrDocumentInput = z.infer<typeof AnalyzeWoundOrDocumentInputSchema>;

const AnalyzeWoundOrDocumentOutputSchema = z.object({
  analysisType: z.enum(['wound', 'document', 'unclear']).describe('The type of image analyzed (wound, medical document, or unclear).'),
  description: z
    .string()
    .describe('A general description of the visual aspects of the wound or a brief summary of the document if identifiable. Max 150 chars.'),
  foodSuggestions: z
    .array(z.string())
    .describe('General food suggestions (with 1-2 examples) that may support healing or overall well-being relevant to the image. Max 3 items, each max 70 chars.'),
  foodsToAvoid: z
    .array(z.string())
    .describe('General foods or habits to consider avoiding (with 1-2 examples). Max 3 items, each max 70 chars.'),
  otherSuggestions: z
    .array(z.string())
    .describe('Other general care suggestions or observations. Max 3 items, each max 70 chars.'),
  encouragingMessage: z
    .string()
    .optional()
    .describe('A short, cute, and encouraging message for the user, possibly with an emoji. Max 70 chars.'),
  disclaimer: z
    .string()
    .describe('A standard disclaimer that this is not medical advice.'),
});
export type AnalyzeWoundOrDocumentOutput = z.infer<typeof AnalyzeWoundOrDocumentOutputSchema>;

export async function analyzeWoundOrDocument(
  input: AnalyzeWoundOrDocumentInput
): Promise<AnalyzeWoundOrDocumentOutput> {
  return analyzeWoundOrDocumentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeWoundOrDocumentPrompt',
  input: {schema: AnalyzeWoundOrDocumentInputSchema},
  output: {schema: AnalyzeWoundOrDocumentOutputSchema},
  prompt: `You are an AI assistant providing a general analysis of an image that could be a wound or a medical document. Your response is NOT medical advice.

Image: {{media url=photoDataUri}}

Instructions:
1.  Determine if the image appears to be primarily a photo of a physical wound, a medical document (like an X-ray, scan, or report), or if it's unclear. Set 'analysisType' accordingly.
2.  **Description (Max 150 chars):**
    *   If 'wound': Briefly describe its visual characteristics (e.g., "Appears as a superficial abrasion on a joint, reddish area surrounding it."). Avoid diagnosing or speculating on severity.
    *   If 'document': Briefly describe what it looks like if identifiable (e.g., "Appears to be a radiological image showing skeletal structures." or "Looks like a text document, possibly a medical report."). Do not attempt to interpret specific medical findings from documents.
    *   If 'unclear': State that the image content is not clearly identifiable as a wound or medical document.
3.  **Food Suggestions (Max 3 items, each max 70 chars):**
    *   Provide general dietary suggestions that are broadly known to support overall health or recovery. Include 1-2 brief examples for each suggestion. (e.g., "Protein-rich foods (chicken, lentils)", "Fruits rich in Vitamin C (oranges, berries)", "Leafy green vegetables (spinach, kale)"). Tailor slightly if context allows (e.g., "Calcium-rich foods (milk, yogurt)" if it clearly seems bone-related, but be generic).
4.  **Foods To Avoid (Max 3 items, each max 70 chars):**
    *   Suggest general items to consider limiting for overall health. Include 1-2 brief examples for each. (e.g., "Excessive sugary foods (candy, soda)", "Highly processed snacks (chips, packaged cookies)", "Alcohol in excess").
5.  **Other Suggestions (Max 3 items, each max 70 chars):**
    *   Provide very general, common-sense advice (e.g., "Ensure adequate rest", "Stay hydrated", "Keep wounds clean if applicable").
    *   If 'document' and it appears to be a medical report, suggest: "Review findings with a healthcare professional."
6.  **Encouraging Message (Max 70 chars):**
    *   Generate a short, cute, and positive encouraging message for the user. You can include a relevant emoji (e.g., "Keep going, you're doing great! ✨", "Stay positive and take care! 😊", "Healing takes time, be patient with yourself! 👍"). Make it general and supportive.
7.  **Disclaimer:** ALWAYS include the following: "This is an AI-generated analysis and NOT a substitute for professional medical advice. Consult a healthcare provider for any health concerns or before making any decisions related to your health or treatment."

Focus on general observations and widely accepted health advice. Do NOT provide diagnoses, treatment plans, or specific medical interpretations. Keep all text concise and within character limits.
Structure the output strictly according to the 'AnalyzeWoundOrDocumentOutputSchema'.
`,
});

const analyzeWoundOrDocumentFlow = ai.defineFlow(
  {
    name: 'analyzeWoundOrDocumentFlow',
    inputSchema: AnalyzeWoundOrDocumentInputSchema,
    outputSchema: AnalyzeWoundOrDocumentOutputSchema,
  },
  async (input: AnalyzeWoundOrDocumentInput) => {
    console.log('[AI Flow] analyzeWoundOrDocumentFlow invoked.');
    try {
        const {output} = await prompt(input);
        if (!output) {
            console.error('[AI Flow] AI analysis returned null or undefined output.');
            throw new Error('AI analysis did not produce a valid output structure.');
        }
        // Ensure disclaimer is always present
        output.disclaimer = "This is an AI-generated analysis and NOT a substitute for professional medical advice. Consult a healthcare provider for any health concerns or before making any decisions related to your health or treatment.";
        console.log('[AI Flow] AI analysis successful. Analysis Type:', output.analysisType);
        return output;
    } catch (err: any) {
        console.error('[AI Flow] Error during AI processing in analyzeWoundOrDocumentFlow:', err);
        let errorMessage = 'An unexpected error occurred during AI analysis.';
        if (err instanceof Error) {
            errorMessage = err.message;
        } else if (typeof err === 'string') {
            errorMessage = err;
        }
        throw new Error(`AI Analysis Failed: ${errorMessage}`);
    }
  }
);

