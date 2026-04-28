// src/lib/recommender.ts
// Maps PhysiqueNet BF% output to your existing videos
// Your videos: Burpees, Crunches, High_Knees, Jumping jacks,
//              Lunges, Planks, Pushups, Squarts

export interface VideoRec {
  id:          string;
  title:       string;
  file:        string;    // path in /public/videos/
  duration:    string;
  calories:    number;
  difficulty:  1 | 2 | 3 | 4 | 5;
  targets:     string[];
  reason:      string;
}

export interface WeeklyPlanDay {
  day:    string;
  isRest: boolean;
  video:  VideoRec | null;
}

export interface RecommendResult {
  primary:     VideoRec[];   // top 3 for today
  weeklyPlan:  WeeklyPlanDay[];
  phase:       string;
  message:     string;
  gap:         number;       // bf% to lose
}

//  YOUR 8 VIDEOS MAPPED 
const VIDEO_LIBRARY: VideoRec[] = [
  {
    id:         'burpees',
    title:      'Burpee Blast',
    file:       '/videos/Burpees.mp4',
    duration:   '20 min',
    calories:   280,
    difficulty: 4,
    targets:    ['full body', 'cardio', 'fat loss'],
    reason:     'Highest calorie burn  maximum fat loss',
  },
  {
    id:         'high_knees',
    title:      'High Knees Cardio',
    file:       '/videos/High_Knees.mp4',
    duration:   '20 min',
    calories:   220,
    difficulty: 3,
    targets:    ['cardio', 'legs', 'fat loss'],
    reason:     'Intense cardio burns belly fat fast',
  },
  {
    id:         'jumping_jacks',
    title:      'Jumping Jacks Burn',
    file:       '/videos/Jumping jacks.mp4',
    duration:   '15 min',
    calories:   180,
    difficulty: 2,
    targets:    ['cardio', 'full body'],
    reason:     'Full body warm-up and fat burn',
  },
  {
    id:         'squats',
    title:      'Squat Power',
    file:       '/videos/Squarts.mp4',
    duration:   '20 min',
    calories:   210,
    difficulty: 3,
    targets:    ['legs', 'glutes', 'metabolism'],
    reason:     'Builds largest muscles  boosts metabolism',
  },
  {
    id:         'lunges',
    title:      'Lunge Sculpt',
    file:       '/videos/Lunges.mp4',
    duration:   '20 min',
    calories:   200,
    difficulty: 3,
    targets:    ['legs', 'glutes', 'balance'],
    reason:     'Lower body sculpting and toning',
  },
  {
    id:         'pushups',
    title:      'Push-up Power',
    file:       '/videos/Pushups.mp4',
    duration:   '15 min',
    calories:   150,
    difficulty: 3,
    targets:    ['chest', 'shoulders', 'arms', 'core'],
    reason:     'Upper body strength and definition',
  },
  {
    id:         'crunches',
    title:      'Core Crunches',
    file:       '/videos/Crunches.mp4',
    duration:   '15 min',
    calories:   120,
    difficulty: 2,
    targets:    ['abs', 'core'],
    reason:     'Core definition and belly toning',
  },
  {
    id:         'planks',
    title:      'Plank Hold',
    file:       '/videos/Planks.mp4',
    duration:   '10 min',
    calories:   80,
    difficulty: 2,
    targets:    ['core', 'stability', 'posture'],
    reason:     'Core stability and posture improvement',
  },
];

//  RECOMMENDATION ENGINE 

export function recommend(
  bf: number,
  goalBf: number,
  isMale: boolean,
): RecommendResult {
  const gap   = Math.round((bf - goalBf) * 10) / 10;
  const phase = getPhase(bf, isMale);

  let primary: VideoRec[];
  let message: string;

  if (gap > 10) {
    // Heavy fat loss phase  cardio priority
    primary = [
      VIDEO_LIBRARY[0], // Burpees
      VIDEO_LIBRARY[1], // High Knees
      VIDEO_LIBRARY[2], // Jumping Jacks
    ];
    message = `You have ${gap}% to lose. Focus on cardio daily  every session counts.`;
  } else if (gap > 6) {
    // Moderate fat loss  cardio + lower body
    primary = [
      VIDEO_LIBRARY[1], // High Knees
      VIDEO_LIBRARY[3], // Squats
      VIDEO_LIBRARY[4], // Lunges
    ];
    message = `${gap}% to go. Combine cardio with strength to accelerate fat loss.`;
  } else if (gap > 3) {
    // Mixed recomposition  build muscle, lose fat
    primary = [
      VIDEO_LIBRARY[3], // Squats
      VIDEO_LIBRARY[5], // Pushups
      VIDEO_LIBRARY[4], // Lunges
    ];
    message = `${gap}% to go. Great progress! Strength training accelerates results now.`;
  } else if (gap > 0) {
    // Almost at goal  toning and definition
    primary = [
      VIDEO_LIBRARY[5], // Pushups
      VIDEO_LIBRARY[6], // Crunches
      VIDEO_LIBRARY[7], // Planks
    ];
    message = `Almost there! Only ${gap}% to your goal. Focus on definition now.`;
  } else {
    // At or past goal  maintenance
    primary = [
      VIDEO_LIBRARY[3], // Squats
      VIDEO_LIBRARY[5], // Pushups
      VIDEO_LIBRARY[7], // Planks
    ];
    message = 'Goal reached! Maintain with strength training and variety.';
  }

  const weeklyPlan = buildWeeklyPlan(gap, primary);

  return { primary, weeklyPlan, phase, message, gap };
}

function buildWeeklyPlan(gap: number, recs: VideoRec[]): WeeklyPlanDay[] {
  const DAYS      = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const workDays  = gap > 8 ? 5 : gap > 4 ? 4 : 3;
  const allVideos = VIDEO_LIBRARY;

  return DAYS.map((day, i) => ({
    day,
    isRest: i >= workDays,
    video:  i < workDays ? allVideos[i % allVideos.length] : null,
  }));
}

function getPhase(bf: number, isMale: boolean): string {
  if (isMale) {
    if (bf < 8)  return 'Athlete';
    if (bf < 14) return 'Fitness';
    if (bf < 18) return 'Average';
    if (bf < 25) return 'Overweight';
    return 'High Body Fat';
  } else {
    if (bf < 14) return 'Athlete';
    if (bf < 21) return 'Fitness';
    if (bf < 25) return 'Average';
    if (bf < 32) return 'Overweight';
    return 'High Body Fat';
  }
}

//  PROGRESS CALCULATIONS 

export interface ScanHistoryEntry {
  bf:        number;
  timestamp: number;
  date:      string;
}

export function estimateWeeksToGoal(
  history: ScanHistoryEntry[],
  goalBf: number
): { weeks: number; dailyLoss: number; targetDate: string } | null {
  if (history.length < 2) return null;

  const recent    = history.slice(-7);
  const oldest    = recent[0].bf;
  const newest    = recent[recent.length - 1].bf;
  const daysDiff  = (recent[recent.length-1].timestamp - recent[0].timestamp)
                    / (1000 * 60 * 60 * 24);

  if (daysDiff < 1) return null;
  const dailyLoss = (oldest - newest) / daysDiff;
  if (dailyLoss <= 0.001) return null;

  const daysLeft = (newest - goalBf) / dailyLoss;
  const weeks    = Math.round(daysLeft / 7);
  const date     = new Date();
  date.setDate(date.getDate() + daysLeft);

  return {
    weeks,
    dailyLoss: Math.round(dailyLoss * 100) / 100,
    targetDate: date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }),
  };
}

export function getWeeklyChange(history: ScanHistoryEntry[]): number | null {
  if (history.length < 2) return null;
  const week    = history.filter(
    s => s.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000
  );
  if (week.length < 2) return null;
  return Math.round((week[week.length-1].bf - week[0].bf) * 10) / 10;
}
