
'use server';
/**
 * @fileOverview This file is DEPRECATED and no longer used.
 * Exercise tutorials are now handled by static data in /lib/exercise-data.ts
 *
 * - generateExerciseTutorialImage - A function that handles the image generation process.
 * - GenerateExerciseTutorialImageInput - The input type for the function.
 * - GenerateExerciseTutorialImageOutput - The return type for the function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GenerateExerciseTutorialImageInputSchema = z.object({
  exerciseName: z.string().describe('The name of the exercise.'),
  exerciseDescription: z
    .string()
    .describe(
      'A detailed description or prompt for the AI to generate the image tutorial (e.g., "Clear instructional image of a person doing jumping jacks, focusing on correct form.").'
    ),
});
export type GenerateExerciseTutorialImageInput = z.infer<
  typeof GenerateExerciseTutorialImageInputSchema
>;

const GenerateExerciseTutorialImageOutputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "The generated exercise tutorial image, as a data URI. Expected format: 'data:image/<mimetype>;base64,<encoded_data>'."
    ),
});
export type GenerateExerciseTutorialImageOutput = z.infer<
  typeof GenerateExerciseTutorialImageOutputSchema
>;

export async function generateExerciseTutorialImage(
  input: GenerateExerciseTutorialImageInput
): Promise<GenerateExerciseTutorialImageOutput> {
  return generateExerciseTutorialImageFlow(input);
}

// This flow uses the gemini-2.0-flash-exp model for image generation.
const generateExerciseTutorialImageFlow = ai.defineFlow(
  {
    name: 'generateExerciseTutorialImageFlow',
    inputSchema: GenerateExerciseTutorialImageInputSchema,
    outputSchema: GenerateExerciseTutorialImageOutputSchema,
  },
  async (input: GenerateExerciseTutorialImageInput) => {
    console.log(`Generating image for: ${input.exerciseName}`);

    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp', // Model capable of image generation
      prompt: `Generate a clear, instructional image of a person performing: "${input.exerciseName}".
      Focus on correct form and a clear visual representation suitable for a tutorial.
      Description: ${input.exerciseDescription}`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'], // Must include IMAGE
        // Optional: Adjust safety settings if needed for exercise images
        // safetySettings: [
        //   { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        // ],
      },
    });

    if (!media || !media.url || !media.url.startsWith('data:image/')) {
      console.error('AI failed to produce image data URI in the expected format.', media);
      throw new Error(
        'AI analysis failed to produce an image data URI in the expected format.'
      );
    }

    return { imageDataUri: media.url };
  }
);
