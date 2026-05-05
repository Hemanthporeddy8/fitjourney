'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Play, Dumbbell, BrainCircuit, ChevronRight, Flame, Footprints, CalendarDays, Target } from 'lucide-react';
import { suggestedExercises, type Exercise } from '@/lib/exercise-data';
import { calculateDynamicWorkoutPlan } from '@/lib/workout-count-engine';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, isSameDay, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const Calendar = dynamic(() => import('@/components/ui/calendar').then(m => m.Calendar), {
  ssr: false,
  loading: () => <div className="h-[280px] w-full bg-muted animate-pulse rounded-md" />,
});

interface SavedMeal {
  foodName: string;
  calories: number;
  timestamp: string;
  photoUrl?: string;
}

function TrackContent() {
  const router  = useRouter();
  const { toast } = useToast();

  const [aiGoal, setAiGoal]           = useState<{kcal:number; km:number}|null>(null);
  const [exercises, setExercises]     = useState<Exercise[]>([]);
  const [bodyFat, setBodyFat]         = useState(20);
  const [planTitle, setPlanTitle]     = useState('');
  const [allMeals, setAllMeals]       = useState<SavedMeal[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date|undefined>(new Date());
  const [mealsForDate, setMealsForDate] = useState<SavedMeal[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<{kcal:number; name:string}|null>(null);

  useEffect(() => {
    const scans   = JSON.parse(localStorage.getItem('fitjourney_scan_history') || '[]');
    const profile = JSON.parse(localStorage.getItem('fitjourney_profile') || '{}');
    const plan    = JSON.parse(localStorage.getItem('fitjourney_latest_ideal_body_plan') || 'null');
    const meals   = JSON.parse(localStorage.getItem('fitjourney_saved_meals') || '[]');

    if (plan?.planTitle) setPlanTitle(plan.planTitle);
    setAllMeals(meals);

    if (scans.length > 0) {
      const scan = scans[0];
      const bf = scan.bf || 20;
      setBodyFat(bf);
      const gap = bf - parseFloat(profile.goalBf || '15');
      let kcal = 150;
      if (gap > 10) kcal = 600;
      else if (gap > 5) kcal = 450;
      else if (gap > 2) kcal = 300;
      const km = parseFloat((kcal / 60).toFixed(1));
      setAiGoal({ kcal, km });
      const recs = suggestedExercises.slice(0, 5);
      setExercises(calculateDynamicWorkoutPlan(kcal, bf, recs));
    } else {
      setExercises(suggestedExercises.slice(0, 5));
    }
  }, []);

  useEffect(() => {
    if (selectedDate) {
      const found = allMeals.filter(m => isSameDay(parseISO(m.timestamp), selectedDate));
      setMealsForDate(found);
    }
  }, [selectedDate, allMeals]);

  const handleSelectGoal = (kcal: number, name: string) => {
    setSelectedGoal({ kcal, name });
    localStorage.setItem('fitjourney_active_goal', JSON.stringify({ kcal, name }));
    toast({ title: 'Goal Set ✓', description: `Burning ${kcal} kcal — ${name}` });
  };

  const totalMealCal = mealsForDate.reduce((s, m) => s + m.calories, 0);

  return (
    <div className="flex flex-col items-center min-h-screen bg-background p-4 pb-24 gap-4">

      {/* ── Header ── */}
      <div className="w-full max-w-md">
        <p className="text-xs font-black uppercase tracking-widest text-primary mb-1">FitJourney</p>
        <h1 className="text-3xl font-black">Activity Tracker</h1>
      </div>

      {/* ── AI Goal Banner ── */}
      {aiGoal && (
        <Card className="w-full max-w-md bg-primary text-primary-foreground border-none shadow-xl overflow-hidden relative">
          <div className="absolute right-4 top-4 opacity-10 text-6xl">🧠</div>
          <CardHeader className="pb-2">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">AI Daily Goal</p>
            <CardTitle className="text-2xl font-black">{planTitle || 'Your Plan'}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 rounded-2xl p-4">
              <p className="text-xs opacity-70">Burn Target</p>
              <p className="text-2xl font-black">{aiGoal.kcal} <span className="text-sm opacity-60">kcal</span></p>
            </div>
            <div className="bg-white/10 rounded-2xl p-4">
              <p className="text-xs opacity-70">Distance</p>
              <p className="text-2xl font-black">{aiGoal.km} <span className="text-sm opacity-60">km</span></p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Calendar + Meal Goal Selector ── */}
      <Card className="w-full max-w-md shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-5 w-5 text-primary" /> Set Calorie Goal from Food Log
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className="rounded-xl border self-center" />

          {mealsForDate.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                {format(selectedDate!, 'dd MMM')} · {totalMealCal} kcal consumed
              </p>
              <ScrollArea className="h-36 rounded-xl border p-2">
                {mealsForDate.map((meal, i) => (
                  <div
                    key={i}
                    onClick={() => handleSelectGoal(meal.calories, meal.foodName)}
                    className={`flex items-center justify-between p-3 rounded-xl mb-2 cursor-pointer transition-all border ${
                      selectedGoal?.name === meal.foodName
                        ? 'bg-primary/10 border-primary'
                        : 'bg-secondary/50 border-transparent hover:border-primary/30'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-bold">{meal.foodName}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(meal.timestamp), 'hh:mm a')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-primary">{meal.calories} kcal</p>
                      {selectedGoal?.name === meal.foodName && (
                        <p className="text-[10px] text-primary font-bold">✓ Active Goal</p>
                      )}
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground border rounded-xl bg-secondary/20">
              <Flame className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No meals logged for this date.</p>
              <p className="text-xs mt-1">Scan food in the Camera tab to log meals.</p>
            </div>
          )}

          {selectedGoal && (
            <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-xl border border-primary/20">
              <Target className="h-4 w-4 text-primary shrink-0" />
              <p className="text-xs font-bold">Goal: <span className="text-primary">{selectedGoal.name}</span> · {selectedGoal.kcal} kcal</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Start Activity Cards ── */}
      <div className="w-full max-w-md grid grid-cols-2 gap-3">
        {[
          { mode:'walk', label:'Walking', emoji:'🚶', color:'hsl(var(--primary))', bg:'hsl(var(--primary)/0.08)', border:'hsl(var(--primary)/0.2)', desc:'GPS + step tracking' },
          { mode:'run',  label:'Running', emoji:'🏃', color:'#3b82f6', bg:'rgba(59,130,246,0.08)', border:'rgba(59,130,246,0.2)', desc:'GPS + pace tracking' },
        ].map(({ mode, label, emoji, color, bg, border, desc }) => (
          <button
            key={mode}
            onClick={() => {
              const goal = selectedGoal || (aiGoal ? { kcal: aiGoal.kcal, name: 'AI Goal' } : null);
              const url = `/track/run-track?mode=${mode}${goal ? `&goal=${goal.kcal}&goalName=${encodeURIComponent(goal.name)}` : ''}`;
              router.push(url);
            }}
            className="rounded-2xl p-5 text-left cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: bg, border: `1px solid ${border}` }}
          >
            <div className="text-3xl mb-3">{emoji}</div>
            <p className="font-black text-base mb-1" style={{ color }}>{label}</p>
            <p className="text-xs text-muted-foreground mb-4">{desc}</p>
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: color, boxShadow: `0 0 16px ${color}55` }}>
              <Play size={16} color='#fff' fill='#fff' style={{ marginLeft: '2px' }} />
            </div>
          </button>
        ))}
      </div>

      {/* ── AI Coach Recommendations ── */}
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Dumbbell className="h-5 w-5 text-primary" /> AI Coach Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
          {exercises.map(ex => (
            <div key={ex.id} onClick={() => router.push(`/track/workout?id=${ex.id}`)}
              className="flex items-center gap-3 p-3 rounded-2xl border border-border hover:border-primary/40 cursor-pointer transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">{ex.icon}</div>
              <div className="flex-1">
                <p className="text-sm font-bold">{ex.name}</p>
                <p className="text-xs text-muted-foreground">{ex.reps} · {ex.sets}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-primary">~{ex.caloriesPerMinute * ex.durationMinutes} kcal</p>
                <p className="text-[10px] text-muted-foreground">{ex.durationMinutes} min</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}>
      <TrackContent />
    </Suspense>
  );
}
