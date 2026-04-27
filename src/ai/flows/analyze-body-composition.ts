
'use server';

/**
 * @fileOverview Refactored to use the Proprietary PhysiPose Vision Model for deterministic metric analysis.
 */

import { z } from 'genkit';
import { aiEngine } from '@/lib/ai-engine';

const AnalyzeBodyCompositionInputSchema = z.object({
  currentPhotoDataUri: z.string(),
  previousPhotoDataUri: z.string().optional(),
});

export type AnalyzeBodyCompositionInput = z.infer<typeof AnalyzeBodyCompositionInputSchema>;

const AnalyzeBodyCompositionOutputSchema = z.object({
  estimatedFatPercentage: z.number().optional(),
  muscleVisibilityScore: z.number().optional(),
  postureAnalysis: z.string(),
  visualMeasurements: z.any().optional(),
  comparisonSummary: z.any().optional(),
});

export type AnalyzeBodyCompositionOutput = z.infer<typeof AnalyzeBodyCompositionOutputSchema>;

export async function analyzeBodyComposition(input: AnalyzeBodyCompositionInput): Promise<AnalyzeBodyCompositionOutput> {
  // 1. Metric Extraction via Proprietary PhysiPose Model
  const metrics = await aiEngine.runPhysiPose(input.currentPhotoDataUri);

  return {
    estimatedFatPercentage: metrics.estimatedFatPercentage,
    muscleVisibilityScore: 8,
    postureAnalysis: metrics.postureScore > 7 ? "Optimal Alignment" : "Slight Imbalance Detected",
    visualMeasurements: {
      shoulderWidth: `${metrics.measurements.shoulderWidthCm} cm`,
      waistHipRatio: (metrics.measurements.waistCm! / metrics.measurements.hipCm!).toFixed(2)
    }
  };
}
