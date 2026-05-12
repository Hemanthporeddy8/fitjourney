import { IdealBodyPlanResult } from './ai-engine';

interface ProfileData {
  weightKg?: string | number;
  heightCm?: string | number;
  age?: string | number;
  gender?: 'male' | 'female';
  activityLevel?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';
  goal?: 'lose_fat' | 'maintain' | 'muscle_gain';
}

interface LockData {
  type: string;
  lockedAt: number;
}

interface ComparisonData {
  matchPercentage: number;
  focusAreas: string[];
}

export const smartMetabolicEngine = {
  /**
   * Generates a hyper-personalized plan by reading all local user context automatically.
   * Applies "Plateau Breaker" logic if the user is consistently working out but not improving.
   */
  generateAdaptivePlan: async (): Promise<IdealBodyPlanResult> => {
    // 1. Gather all intel from the user's local state
    const profile: ProfileData = JSON.parse(localStorage.getItem('fitjourney_profile_data') || '{}');
    const sessionsDone = parseInt(localStorage.getItem('fitjourney_sessions_completed') || '0', 10);
    const lockData: LockData | null = JSON.parse(localStorage.getItem('fitjourney_body_type_lock') || 'null');
    const comparison: ComparisonData | null = JSON.parse(localStorage.getItem('fitjourney_latest_comparison') || 'null');

    // Safe defaults if profile is somehow missing data
    const weight = parseFloat(String(profile.weightKg)) || 70;
    const height = parseFloat(String(profile.heightCm)) || 175;
    const age = parseInt(String(profile.age)) || 28;
    const gender = profile.gender || 'male';
    const goal = profile.goal || 'muscle_gain';
    const bodyType = lockData?.type || 'mesomorph';

    // 2. Base Mifflin-St Jeor Calculation
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr += gender === 'male' ? 5 : -161;

    const activityMultipliers = {
      sedentary: 1.2,
      lightly_active: 1.375,
      moderately_active: 1.55,
      very_active: 1.725,
      extra_active: 1.9,
    };
    const tdee = bmr * (activityMultipliers[profile.activityLevel as keyof typeof activityMultipliers] || 1.55);

    // 3. Goal Adjustment
    let targetCalories = tdee;
    if (goal === 'lose_fat') targetCalories -= 500;
    if (goal === 'muscle_gain') targetCalories += 300;

    // 4. THE SMART ENGINE LOGIC (Plateau Detection)
    let planTitle = `The ${bodyType.toUpperCase()} Blueprint`;
    let planSummary = `A precision-calculated metabolic plan optimized for your baseline.`;
    
    // Check if we have progress data and significant effort
    if (lockData && comparison) {
      const sessionsSinceLock = Math.max(0, sessionsDone - lockData.lockedAt);
      
      // If they've done >10 sessions but match is low (< 60%), trigger Plateau Breaker
      if (sessionsSinceLock >= 10 && comparison.matchPercentage < 60) {
        planTitle = `🚨 Plateau Breaker: ${bodyType.toUpperCase()}`;
        
        if (goal === 'lose_fat') {
          targetCalories -= 150; // Aggressive cut
          planSummary = `We noticed your physique match is stalled at ${comparison.matchPercentage}%. We've engaged Plateau Breaker mode: dropping calories by an extra 150kcal and shifting focus to stubborn fat.`;
        } else {
          targetCalories += 200; // Hard gainer boost
          planSummary = `We noticed your physique match is stalled at ${comparison.matchPercentage}%. We've engaged Plateau Breaker mode: increasing caloric surplus by 200kcal to force muscle growth.`;
        }
      } else if (comparison.matchPercentage >= 75) {
        planTitle = `🔥 Optimal Growth: ${bodyType.toUpperCase()}`;
        planSummary = `Incredible progress! At a ${comparison.matchPercentage}% match, your metabolism is responding perfectly. We are maintaining current macro ratios to ride this wave.`;
      }
    }

    targetCalories = Math.round(targetCalories);

    // 5. Body-Type Specific Macro Splits
    let pPct = 0.30, cPct = 0.40, fPct = 0.30; // Default Mesomorph
    if (bodyType === 'ectomorph') { pPct = 0.25; cPct = 0.55; fPct = 0.20; } // Needs carbs to grow
    if (bodyType === 'endomorph') { pPct = 0.35; cPct = 0.25; fPct = 0.40; } // Carb sensitive

    const proteinGrams = Math.round((targetCalories * pPct) / 4);
    const carbsGrams   = Math.round((targetCalories * cPct) / 4);
    const fatsGrams    = Math.round((targetCalories * fPct) / 9);

    // 6. Dynamic Workout Focus based on latest comparison
    const focusAreas = comparison?.focusAreas?.length 
      ? comparison.focusAreas 
      : ['Compound Lifts', 'Progressive Overload', 'Mobility Work'];

    // Add artificial delay to simulate heavy AI processing
    await new Promise(res => setTimeout(res, 1200));

    return {
      planTitle,
      planSummary,
      dietPlan: {
        dailyCalorieTarget: targetCalories,
        macronutrientSplit: { proteinGrams, carbsGrams, fatsGrams }
      },
      workoutPlan: {
        frequencyPerWeek: bodyType === 'endomorph' ? '5-6 sessions' : '4-5 sessions',
        focus: bodyType === 'ectomorph' ? 'Hypertrophy / Low Cardio' : 'Recomposition',
        sampleExercises: focusAreas
      }
    };
  }
};
