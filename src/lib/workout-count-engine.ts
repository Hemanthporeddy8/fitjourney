import { type Exercise } from './exercise-data';

/**
 * Workout Count Engine
 * Deterministic algorithm to calculate exact reps/sets/time based on calorie targets.
 */

interface FitnessMultipliers {
  repKcal: number;
  timeKcalPerMin: number;
  intensity: number;
}

// Calorie burn estimates (approximate per rep or per minute)
const EXERCISE_METRICS: Record<string, { kcalPerRep?: number; kcalPerMin: number; isHold: boolean }> = {
  '1': { kcalPerRep: 0.5, kcalPerMin: 8, isHold: false },  // Jumping Jacks
  '2': { kcalPerRep: 0.4, kcalPerMin: 10, isHold: false }, // High Knees
  '3': { kcalPerRep: 0.6, kcalPerMin: 7, isHold: false },  // Squats
  '4': { kcalPerRep: 0.8, kcalPerMin: 9, isHold: false },  // Push-ups
  '5': { kcalPerRep: 1.2, kcalPerMin: 12, isHold: false }, // Burpees
  '6': { kcalPerMin: 4, isHold: true },                    // Plank
  '7': { kcalPerRep: 0.5, kcalPerMin: 6, isHold: false },  // Lunges
  '8': { kcalPerRep: 0.3, kcalPerMin: 5, isHold: false },  // Crunches
  '9': { kcalPerRep: 0.4, kcalPerMin: 11, isHold: false }, // Mountain Climbers
};

export function calculateDynamicWorkoutPlan(
  targetCalories: number,
  bodyFat: number,
  exercises: Exercise[]
): Exercise[] {
  if (targetCalories <= 0) return exercises;

  // 1. Calculate Fitness Multiplier based on Body Fat %
  // Goal BF is usually 15%. If user is 30%, intensity is lower (more rest).
  const fitnessLevel = Math.max(0.5, 2 - (bodyFat / 20)); // 1.0 is standard (20% BF)
  
  // 2. Distribute target calories across the exercise queue
  // We'll give 70% of the target to the main exercises and 30% to the core/finisher.
  const caloriesPerExercise = targetCalories / exercises.length;

  return exercises.map(ex => {
    const metrics = EXERCISE_METRICS[ex.id] || { kcalPerMin: 5, isHold: false };
    
    if (metrics.isHold) {
      // Hold-based: Calculate duration in minutes
      const totalMinutes = caloriesPerExercise / metrics.kcalPerMin;
      const durationSeconds = Math.max(30, Math.round(totalMinutes * 60));
      
      return {
        ...ex,
        reps: 'Hold',
        sets: '1 set',
        durationMinutes: durationSeconds / 60,
        description: `${ex.description} (Hold for ${durationSeconds}s to burn ~${Math.round(caloriesPerExercise)} kcal)`
      };
    } else {
      // Rep-based: Calculate total reps
      const kcalPerRep = metrics.kcalPerRep || (metrics.kcalPerMin / 15); // fallback
      const totalRepsNeeded = Math.round(caloriesPerExercise / kcalPerRep);
      
      // Split into sets (approx 10-20 reps per set)
      const repsPerSet = Math.min(20, Math.max(8, Math.round(15 * fitnessLevel)));
      const sets = Math.max(1, Math.ceil(totalRepsNeeded / repsPerSet));
      const actualRepsPerSet = Math.ceil(totalRepsNeeded / sets);
      
      return {
        ...ex,
        reps: `${actualRepsPerSet} reps`,
        sets: `${sets} ${sets === 1 ? 'set' : 'sets'}`,
        durationMinutes: (totalRepsNeeded * 2) / 60, // approx 2 seconds per rep
        description: `${ex.description} (${sets}x${actualRepsPerSet} to burn ~${Math.round(caloriesPerExercise)} kcal)`
      };
    }
  });
}
