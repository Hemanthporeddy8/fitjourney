'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, Loader2, Scale, Flame, Dumbbell, Droplets, Moon, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { aiEngine, type IdealBodyPlanResult } from '@/lib/ai-engine';

const LOCAL_KEY = 'fitjourney_latest_ideal_body_plan';

// Body type info cards
const BODY_TYPES = [
  {
    type: 'ectomorph',
    label: 'Ectomorph',
    emoji: '🏃',
    bf: '8–14%',
    desc: 'Naturally lean, fast metabolism. Hard to gain muscle. Focus on caloric surplus and heavy compound lifts.',
    color: 'from-blue-500/20 to-cyan-500/10',
    border: 'border-blue-500/30',
    accent: 'text-blue-400',
    tips: ['Eat every 3 hours', 'Focus on compound lifts', '4–6 meals/day', 'Limit cardio'],
  },
  {
    type: 'mesomorph',
    label: 'Mesomorph',
    emoji: '💪',
    bf: '10–18%',
    desc: 'Athletic build, responds well to training. Gains muscle and loses fat easily. Balanced approach works best.',
    color: 'from-green-500/20 to-emerald-500/10',
    border: 'border-green-500/30',
    accent: 'text-green-400',
    tips: ['Balanced macros', 'Mix strength + cardio', 'Progressive overload', 'Great recovery'],
  },
  {
    type: 'endomorph',
    label: 'Endomorph',
    emoji: '🏋️',
    bf: '18–28%',
    desc: 'Larger frame, stores fat easily. Excellent strength potential. Focus on caloric deficit and HIIT cardio.',
    color: 'from-orange-500/20 to-red-500/10',
    border: 'border-orange-500/30',
    accent: 'text-orange-400',
    tips: ['Caloric deficit', 'HIIT 3x/week', 'Low glycemic carbs', 'High protein diet'],
  },
];

const GOALS = [
  { key: 'weight_loss',   label: 'Fat Loss',    emoji: '🔥', color: 'text-red-400' },
  { key: 'muscle_gain',  label: 'Muscle Gain', emoji: '💪', color: 'text-blue-400' },
  { key: 'maintenance',  label: 'Maintain',    emoji: '⚖️', color: 'text-green-400' },
];

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className={`flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-900/80 border border-white/5`}>
      <div className={`mb-1 ${color}`}>{icon}</div>
      <p className="text-lg font-black">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

export default function IdealBodyPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<IdealBodyPlanResult | null>(null);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [expandedType, setExpandedType] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_KEY);
    if (saved) setPlan(JSON.parse(saved));
    const profile = JSON.parse(localStorage.getItem('fitjourney_profile_data') || '{}');
    if (profile.gender === 'female') setGender('female');
  }, []);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const profile = JSON.parse(localStorage.getItem('fitjourney_profile_data') || '{}');
      const result = await aiEngine.calculateIdealBodyPlan({
        weightKg:      parseFloat(profile.weightKg)      || 70,
        heightCm:      parseFloat(profile.heightCm)      || 175,
        age:           parseInt(profile.age)             || 28,
        gender:        profile.gender === 'female' ? 'female' : 'male',
        goal:          profile.goal          || 'muscle_gain',
        activityLevel: profile.activityLevel || 'moderately_active',
      });
      setPlan(result);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(result));
      if (profile.gender === 'female') setGender('female');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const goalInfo = GOALS.find(g => plan?.workoutPlan?.focus?.toLowerCase().includes(g.key.replace('_', ' '))) || GOALS[1];

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl text-white hover:bg-white/10" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-black flex items-center gap-2"><Scale className="text-primary h-5 w-5" /> Ideal Body Plan</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Science-backed body blueprint</p>
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">

        {/* Hero Image — Body Types */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Body Type Reference</h2>
            <div className="flex gap-2">
              <Button size="sm" variant={gender === 'male' ? 'default' : 'outline'} className="h-7 px-3 text-xs rounded-full" onClick={() => setGender('male')}>Male</Button>
              <Button size="sm" variant={gender === 'female' ? 'default' : 'outline'} className="h-7 px-3 text-xs rounded-full" onClick={() => setGender('female')}>Female</Button>
            </div>
          </div>

          <div className="rounded-3xl overflow-hidden border border-white/10 bg-zinc-900">
            <Image
              src={gender === 'male' ? '/images/male_body_types.png' : '/images/female_body_types.png'}
              alt={`${gender} body types`}
              width={700}
              height={400}
              className="w-full object-cover"
              priority
            />
          </div>

          {/* Body type cards */}
          <div className="space-y-2">
            {BODY_TYPES.map(bt => (
              <div key={bt.type} className={`rounded-2xl border ${bt.border} bg-gradient-to-r ${bt.color} overflow-hidden`}>
                <button
                  className="w-full flex items-center gap-3 p-4 text-left"
                  onClick={() => setExpandedType(expandedType === bt.type ? null : bt.type)}
                >
                  <span className="text-2xl">{bt.emoji}</span>
                  <div className="flex-1">
                    <p className={`font-black ${bt.accent}`}>{bt.label}</p>
                    <p className="text-xs text-muted-foreground">Body Fat: {bt.bf}</p>
                  </div>
                  {expandedType === bt.type ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {expandedType === bt.type && (
                  <div className="px-4 pb-4 space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">{bt.desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {bt.tips.map(tip => (
                        <Badge key={tip} variant="secondary" className="text-xs">{tip}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Goal Body Illustration */}
        <div className="space-y-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Goal Physique Guide</h2>
          <div className="rounded-3xl overflow-hidden border border-white/10 bg-zinc-900">
            <Image
              src="/images/goal_body_lean.png"
              alt="Goal physique illustration"
              width={700}
              height={400}
              className="w-full object-cover"
            />
          </div>
          <p className="text-xs text-muted-foreground text-center px-4">Athletic lean physique achievable with consistent training and nutrition. Timeline: 16–24 weeks.</p>
        </div>

        {/* Generate Plan Button */}
        <Button
          onClick={handleGenerate}
          disabled={isLoading}
          className="w-full h-16 rounded-2xl text-lg font-black bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20"
        >
          {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Calculating Your Blueprint...</> : <><Sparkles className="mr-2 h-5 w-5" /> Generate My Ideal Body Plan</>}
        </Button>

        {/* Plan Results */}
        {plan && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <Badge className="text-xs px-3 py-1 bg-primary/20 text-primary border-primary/30">{plan.planTitle}</Badge>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{plan.planSummary}</p>
            </div>

            {/* Calorie Stats */}
            {plan.dietPlan && (
              <>
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Daily Nutrition Targets</h3>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Daily Calories" value={`${plan.dietPlan.dailyCalorieTarget} kcal`} icon={<Flame className="h-5 w-5" />} color="text-orange-400" />
                  <StatCard label="Protein" value={`${plan.dietPlan.macronutrientSplit.proteinGrams}g`} icon={<Dumbbell className="h-5 w-5" />} color="text-blue-400" />
                  <StatCard label="Carbs" value={`${plan.dietPlan.macronutrientSplit.carbsGrams}g`} icon={<Droplets className="h-5 w-5" />} color="text-yellow-400" />
                  <StatCard label="Fats" value={`${plan.dietPlan.macronutrientSplit.fatsGrams}g`} icon={<Moon className="h-5 w-5" />} color="text-purple-400" />
                </div>

                {/* Macro Bar */}
                <Card className="bg-zinc-900 border-white/5">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Macro Split</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {[
                      { label: 'Protein', grams: plan.dietPlan.macronutrientSplit.proteinGrams, color: 'bg-blue-500', cal: plan.dietPlan.macronutrientSplit.proteinGrams * 4 },
                      { label: 'Carbs',   grams: plan.dietPlan.macronutrientSplit.carbsGrams,   color: 'bg-yellow-500', cal: plan.dietPlan.macronutrientSplit.carbsGrams * 4 },
                      { label: 'Fats',    grams: plan.dietPlan.macronutrientSplit.fatsGrams,    color: 'bg-purple-500', cal: plan.dietPlan.macronutrientSplit.fatsGrams * 9 },
                    ].map(m => {
                      const pct = Math.round((m.cal / plan.dietPlan!.dailyCalorieTarget) * 100);
                      return (
                        <div key={m.label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-bold">{m.label}</span>
                            <span className="text-muted-foreground">{m.grams}g · {pct}%</span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full ${m.color} rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </>
            )}

            {/* Workout Plan */}
            {plan.workoutPlan && (
              <>
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Training Blueprint</h3>
                <Card className="bg-zinc-900 border-white/5">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
                        <p className="text-2xl font-black text-primary">{plan.workoutPlan.frequencyPerWeek}</p>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Sessions/Week</p>
                      </div>
                      <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
                        <p className="text-sm font-black text-primary">{plan.workoutPlan.focus}</p>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Focus</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-black text-muted-foreground uppercase">Recommended Exercises</p>
                      {plan.workoutPlan.sampleExercises.map((ex, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                          <span className="text-primary font-black text-sm">{i + 1}</span>
                          <span className="text-sm">{ex}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            <p className="text-[10px] text-muted-foreground text-center px-4 leading-relaxed">
              ⚕️ Calculated via Mifflin-St Jeor formula. Consult a healthcare professional before starting any new diet or training program.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
