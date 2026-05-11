'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Sparkles, Loader2, Scale, Flame,
  Dumbbell, Droplets, Moon, Lock, CheckCircle2,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { aiEngine, type IdealBodyPlanResult } from '@/lib/ai-engine';

const LOCAL_KEY       = 'fitjourney_latest_ideal_body_plan';
const LOCK_KEY        = 'fitjourney_body_type_lock';
const SESSIONS_KEY    = 'fitjourney_sessions_completed';
const SESSIONS_NEEDED = 5;

const BODY_TYPES = [
  {
    type: 'ectomorph',
    label: 'Ectomorph',
    emoji: '🏃',
    bf_m: '8–12%',
    bf_f: '15–20%',
    color: 'from-blue-600/20 to-blue-900/10',
    border: 'border-blue-500/40',
    glow: 'shadow-blue-500/25',
    accent: 'text-blue-400',
    bg: 'bg-blue-500',
    ring: 'ring-blue-500',
    desc_m: 'Naturally lean, fast metabolism, long limbs. Hard to gain muscle mass.',
    desc_f: 'Slender frame, fast metabolism. Struggles to build curves or muscle size.',
    tips: ['Eat every 3 hours', 'Heavy compound lifts', 'High-carb diet', 'Limit cardio'],
  },
  {
    type: 'mesomorph',
    label: 'Mesomorph',
    emoji: '💪',
    bf_m: '10–15%',
    bf_f: '18–24%',
    color: 'from-green-600/20 to-green-900/10',
    border: 'border-green-500/40',
    glow: 'shadow-green-500/25',
    accent: 'text-green-400',
    bg: 'bg-green-500',
    ring: 'ring-green-500',
    desc_m: 'Athletic V-taper, responds well to training. Gains muscle and loses fat easily.',
    desc_f: 'Hourglass shape, responds well to training. Best of both worlds naturally.',
    tips: ['Balanced macros', 'Mix strength + HIIT', 'Progressive overload', 'Prioritise recovery'],
  },
  {
    type: 'endomorph',
    label: 'Endomorph',
    emoji: '🏋️',
    bf_m: '18–25%',
    bf_f: '25–32%',
    color: 'from-orange-600/20 to-orange-900/10',
    border: 'border-orange-500/40',
    glow: 'shadow-orange-500/25',
    accent: 'text-orange-400',
    bg: 'bg-orange-500',
    ring: 'ring-orange-500',
    desc_m: 'Larger frame, stores fat easily. Excellent strength and power potential.',
    desc_f: 'Fuller, curvy build. Strong and powerful but tends to store fat more easily.',
    tips: ['Caloric deficit', 'HIIT 3× / week', 'Low-glycemic carbs', 'High protein diet'],
  },
];

function StatCard({
  label, value, icon, color,
}: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-900 border border-white/5">
      <div className={`mb-2 ${color}`}>{icon}</div>
      <p className="text-xl font-black">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export default function IdealBodyPage() {
  const router = useRouter();
  const [isLoading, setIsLoading]       = useState(false);
  const [plan, setPlan]                 = useState<IdealBodyPlanResult | null>(null);
  const [selected, setSelected]         = useState<string | null>(null);
  const [locked, setLocked]             = useState<string | null>(null);
  const [gender, setGender]             = useState<'male' | 'female'>('male');
  const [sessionsLeft, setSessionsLeft] = useState(0);
  const [expanded, setExpanded]         = useState<string | null>(null);

  useEffect(() => {
    const saved    = localStorage.getItem(LOCAL_KEY);
    const lockData = localStorage.getItem(LOCK_KEY);
    const sessions = parseInt(localStorage.getItem(SESSIONS_KEY) || '0');
    const profile  = JSON.parse(localStorage.getItem('fitjourney_profile_data') || '{}');

    if (saved) setPlan(JSON.parse(saved));
    if (profile.gender === 'female') setGender('female');

    if (lockData) {
      const { type, lockedAt } = JSON.parse(lockData);
      const done = Math.max(0, sessions - lockedAt);
      if (done < SESSIONS_NEEDED) {
        setLocked(type);
        setSelected(type);
        setSessionsLeft(SESSIONS_NEEDED - done);
      } else {
        localStorage.removeItem(LOCK_KEY);
      }
    }
  }, []);

  const handleSelect = (type: string) => {
    if (locked) return;
    setSelected(type);
    setExpanded(type);
  };

  const handleLock = () => {
    if (!selected || locked) return;
    const sessions = parseInt(localStorage.getItem(SESSIONS_KEY) || '0');
    localStorage.setItem(LOCK_KEY, JSON.stringify({ type: selected, lockedAt: sessions }));
    setLocked(selected);
    setSessionsLeft(SESSIONS_NEEDED);
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const profile = JSON.parse(localStorage.getItem('fitjourney_profile_data') || '{}');
      const result  = await aiEngine.calculateIdealBodyPlan({
        weightKg:      parseFloat(profile.weightKg)      || 70,
        heightCm:      parseFloat(profile.heightCm)      || 175,
        age:           parseInt(profile.age)             || 28,
        gender,
        goal:          profile.goal          || 'muscle_gain',
        activityLevel: profile.activityLevel || 'moderately_active',
      });
      setPlan(result);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(result));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedInfo = BODY_TYPES.find(b => b.type === selected);

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl text-white hover:bg-white/10" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-black flex items-center gap-2">
            <Scale className="text-primary h-5 w-5" /> Ideal Body Plan
          </h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Science-backed body blueprint</p>
        </div>
        {locked && (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] shrink-0">
            <Lock className="h-3 w-3 mr-1" /> {sessionsLeft} sessions left
          </Badge>
        )}
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">

        {/* ── Gender Toggle ── */}
        {!locked && (
          <div className="grid grid-cols-2 gap-2 bg-zinc-900 p-1 rounded-2xl border border-white/5">
            <button
              onClick={() => setGender('male')}
              className={`py-3 rounded-xl text-sm font-black transition-all ${gender === 'male' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-muted-foreground hover:text-white'}`}
            >
              ♂ Male
            </button>
            <button
              onClick={() => setGender('female')}
              className={`py-3 rounded-xl text-sm font-black transition-all ${gender === 'female' ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30' : 'text-muted-foreground hover:text-white'}`}
            >
              ♀ Female
            </button>
          </div>
        )}

        {/* ── Reference Image (One Consistent Illustration Showing All 3 Types) ── */}
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Body Type Reference Chart</p>
          <div className="rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl">
            <Image
              src={gender === 'male' ? '/images/male_body_types.png' : '/images/female_body_types.png'}
              alt={`${gender} body types`}
              width={800}
              height={450}
              className="w-full object-cover"
              priority
            />
          </div>
        </div>

        {/* ── Step 1 Label ── */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-sm font-black shadow-lg shadow-primary/20 shrink-0">1</div>
          <div>
            <p className="font-black">Select Your Body Type</p>
            <p className="text-xs text-muted-foreground">Tap the card that most closely matches your natural build</p>
          </div>
          {locked && <Lock className="h-5 w-5 text-amber-400 ml-auto shrink-0" />}
        </div>

        {/* ── 3 Body Type Detail Cards ── */}
        <div className="space-y-3">
          {BODY_TYPES.map((bt) => {
            const isSelected = selected === bt.type;
            const isLocked   = locked === bt.type;
            const isDisabled = !!locked && locked !== bt.type;
            const desc = gender === 'male' ? bt.desc_m : bt.desc_f;
            const bf   = gender === 'male' ? bt.bf_m : bt.bf_f;

            return (
              <div
                key={bt.type}
                onClick={() => !isDisabled && handleSelect(bt.type)}
                className={`rounded-3xl border-2 transition-all duration-300 overflow-hidden bg-gradient-to-br ${bt.color}
                  ${isSelected ? `${bt.border} shadow-xl ${bt.glow}` : 'border-white/8'}
                  ${isDisabled ? 'opacity-35 cursor-not-allowed grayscale' : 'cursor-pointer active:scale-[0.98]'}
                `}
              >
                {/* Card Header */}
                <div className="flex items-center gap-4 p-4">
                  <div className={`h-12 w-12 rounded-2xl ${bt.bg}/20 border ${bt.border} flex items-center justify-center text-2xl shrink-0`}>
                    {bt.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-black text-base ${bt.accent}`}>{bt.label}</p>
                      <Badge variant="secondary" className="text-[10px] bg-white/5 border-white/10">
                        Body Fat: {bf}
                      </Badge>
                      {isLocked && (
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                          <Lock className="h-2.5 w-2.5 mr-1" /> Your Type
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                  </div>
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    {isSelected
                      ? <CheckCircle2 className={`h-6 w-6 ${bt.accent}`} />
                      : <div className="h-6 w-6 rounded-full border-2 border-white/20" />
                    }
                    <button
                      onClick={e => { e.stopPropagation(); setExpanded(expanded === bt.type ? null : bt.type); }}
                      className="text-muted-foreground hover:text-white transition-colors"
                    >
                      {expanded === bt.type ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Expandable Tips */}
                {expanded === bt.type && (
                  <div className="px-4 pb-4 pt-0 border-t border-white/5">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-3 mb-2 font-black">Recommended Strategy</p>
                    <div className="flex flex-wrap gap-2">
                      {bt.tips.map(tip => (
                        <Badge key={tip} variant="secondary" className="text-[10px] bg-white/5 border-white/10 text-white">
                          {tip}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Lock CTA ── */}
        {selected && !locked && (
          <div className={`rounded-3xl border-2 ${selectedInfo?.border} p-5 bg-gradient-to-br ${selectedInfo?.color} space-y-4`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{selectedInfo?.emoji}</span>
              <div>
                <p className="font-black text-lg">{selectedInfo?.label} Confirmed</p>
                <p className="text-xs text-muted-foreground">Lock this to generate your personalised plan</p>
              </div>
            </div>
            <Button
              onClick={handleLock}
              className={`w-full h-14 font-black rounded-2xl ${selectedInfo?.bg} hover:opacity-90 text-white border-none shadow-xl text-base`}
            >
              <Lock className="mr-2 h-5 w-5" /> Lock Body Type & Continue
            </Button>
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
              ⚠️ You cannot change your body type until you complete {SESSIONS_NEEDED} workout sessions.
            </p>
          </div>
        )}

        {/* ── Locked Notice ── */}
        {locked && (
          <div className="flex items-center gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <Lock className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-black text-amber-400">Body Type Locked</p>
              <p className="text-xs text-muted-foreground">Complete {sessionsLeft} more workout session{sessionsLeft !== 1 ? 's' : ''} to change your body type.</p>
            </div>
          </div>
        )}

        {/* ── Step 2: Generate Plan ── */}
        {(locked) && (
          <>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-sm font-black shadow-lg shadow-primary/20 shrink-0">2</div>
              <div>
                <p className="font-black">Calculate Your Blueprint</p>
                <p className="text-xs text-muted-foreground">Based on your body type, weight, height & goal</p>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full h-16 rounded-2xl text-lg font-black bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/25"
            >
              {isLoading
                ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Calculating...</>
                : <><Sparkles className="mr-2 h-5 w-5" /> Generate My Ideal Body Plan</>}
            </Button>
          </>
        )}

        {/* ── Plan Results ── */}
        {plan && locked && (
          <div className="space-y-6">
            <div className="text-center space-y-2 py-2">
              <Badge className="text-xs px-4 py-1.5 bg-primary/20 text-primary border-primary/30 uppercase font-black tracking-widest">
                {plan.planTitle}
              </Badge>
              <p className="text-sm text-muted-foreground leading-relaxed">{plan.planSummary}</p>
            </div>

            {/* Macro Cards */}
            {plan.dietPlan && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-sm font-black shadow-lg shadow-primary/20 shrink-0">3</div>
                  <p className="font-black">Daily Nutrition Targets</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Daily Calories" value={`${plan.dietPlan.dailyCalorieTarget} kcal`} icon={<Flame className="h-5 w-5" />} color="text-orange-400" />
                  <StatCard label="Protein" value={`${plan.dietPlan.macronutrientSplit.proteinGrams}g`} icon={<Dumbbell className="h-5 w-5" />} color="text-blue-400" />
                  <StatCard label="Carbs" value={`${plan.dietPlan.macronutrientSplit.carbsGrams}g`} icon={<Droplets className="h-5 w-5" />} color="text-yellow-400" />
                  <StatCard label="Healthy Fats" value={`${plan.dietPlan.macronutrientSplit.fatsGrams}g`} icon={<Moon className="h-5 w-5" />} color="text-purple-400" />
                </div>

                {/* Macro Bar */}
                <Card className="bg-zinc-900 border-white/5 rounded-3xl overflow-hidden">
                  <CardHeader className="pb-0 pt-5 px-5">
                    <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-black">Macro Split</CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    {[
                      { label: 'Protein', g: plan.dietPlan.macronutrientSplit.proteinGrams, cal: plan.dietPlan.macronutrientSplit.proteinGrams * 4, color: 'bg-blue-500' },
                      { label: 'Carbs',   g: plan.dietPlan.macronutrientSplit.carbsGrams,   cal: plan.dietPlan.macronutrientSplit.carbsGrams * 4,   color: 'bg-yellow-500' },
                      { label: 'Fats',    g: plan.dietPlan.macronutrientSplit.fatsGrams,    cal: plan.dietPlan.macronutrientSplit.fatsGrams * 9,    color: 'bg-purple-500' },
                    ].map(m => {
                      const pct = Math.round((m.cal / plan.dietPlan!.dailyCalorieTarget) * 100);
                      return (
                        <div key={m.label} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="font-bold">{m.label}</span>
                            <span className="text-muted-foreground">{m.g}g &middot; {pct}%</span>
                          </div>
                          <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full ${m.color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
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
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-sm font-black shadow-lg shadow-primary/20 shrink-0">4</div>
                  <p className="font-black">Training Blueprint</p>
                </div>
                <Card className="bg-zinc-900 border-white/5 rounded-3xl overflow-hidden">
                  <CardContent className="p-5 space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
                        <p className="text-3xl font-black text-primary">{plan.workoutPlan.frequencyPerWeek}</p>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Sessions/Week</p>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/5 flex flex-col justify-center">
                        <p className="text-sm font-black text-primary leading-tight">{plan.workoutPlan.focus}</p>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Core Focus</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Recommended Exercises</p>
                      {plan.workoutPlan.sampleExercises.map((ex, i) => (
                        <div key={i} className="flex items-center gap-3 p-3.5 bg-white/5 rounded-2xl border border-white/5">
                          <div className="h-7 w-7 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-black text-xs shrink-0">{i + 1}</div>
                          <span className="text-sm">{ex}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            <p className="text-[10px] text-muted-foreground text-center px-4 leading-relaxed">
              ⚕️ Calculated via Mifflin-St Jeor formula. Consult a healthcare professional before starting any new program.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
