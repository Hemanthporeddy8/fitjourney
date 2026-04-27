
'use server';
/**
 * @fileOverview This file is DEPRECATED and no longer used.
 * Exercise tutorials are now handled by static data in /lib/exercise-data.ts
 *
 * - generateExerciseTutorialVideo - A function that handles the video generation process.
 * - GenerateExerciseTutorialVideoInput - The input type for the function.
 * - GenerateExerciseTutorialVideoOutput - The return type for the function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GenerateExerciseTutorialVideoInputSchema = z.object({
  exerciseName: z.string().describe('The name of the exercise.'),
  exerciseDescription: z
    .string()
    .describe(
      'A detailed description or prompt for the AI to generate the video tutorial (e.g., "Show a clear demonstration of jumping jacks focusing on form.").'
    ),
});
export type GenerateExerciseTutorialVideoInput = z.infer<
  typeof GenerateExerciseTutorialVideoInputSchema
>;

const GenerateExerciseTutorialVideoOutputSchema = z.object({
  videoDataUri: z
    .string()
    //.url() // Removed .url() as it might cause schema issues with Gemini: "format: only 'enum' and 'date-time' are supported for STRING type"
    .describe(
      "The generated exercise tutorial video, as a data URI. Expected format: 'data:video/<mimetype>;base64,<encoded_data>'."
    ),
});
export type GenerateExerciseTutorialVideoOutput = z.infer<
  typeof GenerateExerciseTutorialVideoOutputSchema
>;

export async function generateExerciseTutorialVideo(
  input: GenerateExerciseTutorialVideoInput
): Promise<GenerateExerciseTutorialVideoOutput> {
  return generateExerciseTutorialVideoFlow(input);
}

const videoGenerationPrompt = ai.definePrompt({
  name: 'generateExerciseTutorialVideoPrompt',
  input: {schema: GenerateExerciseTutorialVideoInputSchema},
  output: {schema: GenerateExerciseTutorialVideoOutputSchema}, // LLM is expected to return JSON matching this
  prompt: `You are an AI assistant specialized in creating instructional exercise videos.
Exercise Name: {{{exerciseName}}}
Detailed Request: {{{exerciseDescription}}}

Generate a short video tutorial (around 10-15 seconds) for the specified exercise.
The video must clearly demonstrate the key movements and proper form. Focus on clarity, accuracy, and brevity.
The final output should be a video encoded as a data URI (e.g., 'data:video/mp4;base64,...').
Return this data URI in the 'videoDataUri' field of a JSON object.

Example of desired output format if you were to successfully create the video data:
{
  "videoDataUri": "data:video/mp4;base64,..." // Actual base64 video data here
}

If you are absolutely unable to generate actual video data URI, provide a placeholder data URI for a very short, silent, generic fitness-related animation or a relevant stock video clip data URI if possible, still fitting the schema.
`,
  // Configuration for the prompt itself
  config: {
    model: 'googleai/gemini-2.0-flash-exp', // Use the model capable of media generation/understanding
    // Safety settings can be adjusted if needed, though video generation might have its own implicit safety.
    // The prompt asks for JSON output which is text-based, so responseModalities might not be directly applicable here
    // for forcing video bytes. The LLM is tasked with providing the data URI string.
  },
});

const generateExerciseTutorialVideoFlow = ai.defineFlow(
  {
    name: 'generateExerciseTutorialVideoFlow',
    inputSchema: GenerateExerciseTutorialVideoInputSchema,
    outputSchema: GenerateExerciseTutorialVideoOutputSchema,
  },
  async (input: GenerateExerciseTutorialVideoInput) => {
    console.log(`Generating video for: ${input.exerciseName}`);
    const {output} = await videoGenerationPrompt(input);

    if (!output || !output.videoDataUri) {
      console.error('AI failed to produce video data URI in the expected format.', output);
      throw new Error(
        'AI analysis failed to produce a video data URI in the expected format.'
      );
    }
    
    // Validate if the output is a basic data URI structure.
    // This is a very basic check. Full validation is complex.
    if (!output.videoDataUri.startsWith('data:video/')) {
        console.error('Generated videoDataUri does not seem to be a valid video data URI:', output.videoDataUri);
        // Fallback or more specific error
        // For now, we'll throw, but one could implement a fallback to a placeholder if critical
         throw new Error('Generated content is not a valid video data URI.');
    }

    return output;
  }
);
