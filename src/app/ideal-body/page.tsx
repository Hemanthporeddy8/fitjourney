'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, Loader2, Scale, Flame, Dumbbell, Droplets, Moon, Lock, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { aiEngine, type IdealBodyPlanResult } from '@/lib/ai-engine';

const LOCAL_KEY        = 'fitjourney_latest_ideal_body_plan';
const LOCK_KEY         = 'fitjourney_body_type_lock';
const SESSIONS_KEY     = 'fitjourney_sessions_completed';
const SESSIONS_NEEDED  = 5; // sessions required to unlock body type change

const BODY_TYPES = [
  {
    type:   'ectomorph',
    label:  'Ectomorph',
    emoji:  '🏃',
    bf:     '8–12%',
    image:  '/images/body_ectomorph.png',
    color:  'from-blue-600/30 to-blue-900/20',
    border: 'border-blue-500/50',
    glow:   'shadow-blue-500/30',
    accent: 'text-blue-400',
    bg:     'bg-blue-500',
    desc:   'Naturally lean, long limbs, fast metabolism. Struggles to gain muscle mass.',
    tips:   ['Eat every 3 hours', 'Heavy compound lifts', '4–6 meals/day', 'Limit cardio'],
  },
  {
    type:   'mesomorph',
    label:  'Mesomorph',
    emoji:  '💪',
    bf:     '10–15%',
    image:  '/images/body_mesomorph.png',
    color:  'from-green-600/30 to-green-900/20',
    border: 'border-green-500/50',
    glow:   'shadow-green-500/30',
    accent: 'text-green-400',
    bg:     'bg-green-500',
    desc:   'Athletic, V-shaped torso. Responds well to training. Gains muscle & loses fat easily.',
    tips:   ['Balanced macros', 'Mix strength + cardio', 'Progressive overload', 'Great recovery'],
  },
  {
    type:   'endomorph',
    label:  'Endomorph',
    emoji:  '🏋️',
    bf:     '18–25%',
    image:  '/images/body_endomorph.png',
    color:  'from-orange-600/30 to-orange-900/20',
    border: 'border-orange-500/50',
    glow:   'shadow-orange-500/30',
    accent: 'text-orange-400',
    bg:     'bg-orange-500',
    desc:   'Larger frame, stores fat easily. Excellent strength potential. Responds best to HIIT.',
    tips:   ['Caloric deficit', 'HIIT 3×/week', 'Low glycemic carbs', 'High protein'],
  },
];

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-900/80 border border-white/5">
      <div className={`mb-1 ${color}`}>{icon}</div>
      <p className="text-lg font-black">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

export default function IdealBodyPage() {
  const router = useRouter();
  const [isLoading, setIsLoading]         = useState(false);
  const [plan, setPlan]                   = useState<IdealBodyPlanResult | null>(null);
  const [selected, setSelected]           = useState<string | null>(null);
  const [locked, setLocked]               = useState<string | null>(null);
  const [sessionsLeft, setSessionsLeft]   = useState(0);
  const [expandedType, setExpandedType]   = useState<string | null>(null);

  useEffect(() => {
    const saved     = localStorage.getItem(LOCAL_KEY);
    const lockData  = localStorage.getItem(LOCK_KEY);
    const sessions  = parseInt(localStorage.getItem(SESSIONS_KEY) || '0');

    if (saved)    setPlan(JSON.parse(saved));
    if (lockData) {
      const { type, lockedAt } = JSON.parse(lockData);
      const sessionsAfterLock = Math.max(0, sessions - lockedAt);
      if (sessionsAfterLock < SESSIONS_NEEDED) {
        setLocked(type);
        setSelected(type);
        setSessionsLeft(SESSIONS_NEEDED - sessionsAfterLock);
      } else {
        // Enough sessions done — unlock
        localStorage.removeItem(LOCK_KEY);
      }
    }
  }, []);

  const handleSelect = (type: string) => {
    if (locked) return; // locked — ignore taps
    setSelected(type);
    setExpandedType(type);
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
        gender:        profile.gender === 'female' ? 'female' : 'male',
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

      {/* Header */}
      <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl text-white hover:bg-white/10" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-black flex items-center gap-2">
            <Scale className="text-primary h-5 w-5" /> Ideal Body Plan
          </h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Select your body type to get started</p>
        </div>
        {locked && (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
            <Lock className="h-3 w-3 mr-1" /> Locked · {sessionsLeft} sessions left
          </Badge>
        )}
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">

        {/* Step label */}
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-black">1</div>
          <p className="text-sm font-bold">Choose Your Body Type</p>
          {locked && <Lock className="h-4 w-4 text-amber-400 ml-auto" />}
        </div>

        {/* 3 Body Type Cards with Images */}
        <div className="space-y-4">
          {BODY_TYPES.map(bt => {
            const isSelected = selected === bt.type;
            const isLocked   = locked === bt.type;
            const isDisabled = !!locked && locked !== bt.type;

            return (
              <div
                key={bt.type}
                onClick={() => !isDisabled && handleSelect(bt.type)}
                className={`rounded-3xl border-2 overflow-hidden transition-all duration-300
                  ${isSelected ? `${bt.border} shadow-xl ${bt.glow}` : 'border-white/10'}
                  ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-white/30'}
                  bg-gradient-to-br ${bt.color}
                `}
              >
                {/* Image */}
                <div className="relative">
                  <Image
                    src={bt.image}
                    alt={bt.label}
                    width={700}
                    height={400}
                    className="w-full object-cover"
                  />
                  {/* Top overlay badge */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <Badge className={`${bt.bg} text-white border-none text-xs font-black px-3`}>
                      {bt.emoji} {bt.label}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">BF: {bt.bf}</Badge>
                  </div>
                  {/* Selected check */}
                  {isSelected && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle2 className={`h-7 w-7 ${bt.accent}`} />
                    </div>
                  )}
                  {/* Locked badge */}
                  {isLocked && (
                    <div className="absolute bottom-3 right-3">
                      <Badge className="bg-amber-500 text-black font-black text-xs">
                        <Lock className="h-3 w-3 mr-1" /> YOUR TYPE
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Expandable info */}
                <button
                  className="w-full flex items-center justify-between px-4 py-3"
                  onClick={e => { e.stopPropagation(); setExpandedType(expandedType === bt.type ? null : bt.type); }}
                >
                  <p className="text-sm text-muted-foreground">{bt.desc}</p>
                  {expandedType === bt.type
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />}
                </button>

                {expandedType === bt.type && (
                  <div className="px-4 pb-4 flex flex-wrap gap-2">
                    {bt.tips.map(tip => (
                      <Badge key={tip} variant="secondary" className="text-xs">{tip}</Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Lock CTA */}
        {selected && !locked && (
          <div className={`rounded-2xl border-2 ${selectedInfo?.border} p-4 bg-gradient-to-r ${selectedInfo?.color} space-y-3`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedInfo?.emoji}</span>
              <div>
                <p className="font-black">{selectedInfo?.label} Selected</p>
                <p className="text-xs text-muted-foreground">Lock this body type to get your personalised plan</p>
              </div>
            </div>
            <Button onClick={handleLock} className={`w-full h-12 font-black rounded-xl ${selectedInfo?.bg} hover:opacity-90 text-white border-none`}>
              <Lock className="mr-2 h-4 w-4" /> Lock My Body Type & Continue
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              ⚠️ Once locked, you cannot change your body type until you complete {SESSIONS_NEEDED} workout sessions.
            </p>
          </div>
        )}

        {/* Locked notice */}
        {locked && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-3">
            <Lock className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-black text-amber-400">Body Type Locked</p>
              <p className="text-xs text-muted-foreground">
                Complete {sessionsLeft} more workout session{sessionsLeft !== 1 ? 's' : ''} to unlock your body type selection.
              </p>
            </div>
          </div>
        )}

        {/* Step 2 — Generate Plan */}
        {(selected || locked) && (
          <>
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-black">2</div>
              <p className="text-sm font-bold">Generate Your Blueprint</p>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full h-16 rounded-2xl text-lg font-black bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20"
            >
              {isLoading
                ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Calculating...</>
                : <><Sparkles className="mr-2 h-5 w-5" /> Generate My Ideal Body Plan</>}
            </Button>
          </>
        )}

        {/* Plan Results */}
        {plan && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <Badge className="text-xs px-3 py-1 bg-primary/20 text-primary border-primary/30">{plan.planTitle}</Badge>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{plan.planSummary}</p>
            </div>

            {plan.dietPlan && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-black">3</div>
                  <p className="text-sm font-bold">Daily Nutrition Targets</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Daily Calories" value={`${plan.dietPlan.dailyCalorieTarget} kcal`} icon={<Flame className="h-5 w-5" />} color="text-orange-400" />
                  <StatCard label="Protein" value={`${plan.dietPlan.macronutrientSplit.proteinGrams}g`} icon={<Dumbbell className="h-5 w-5" />} color="text-blue-400" />
                  <StatCard label="Carbs" value={`${plan.dietPlan.macronutrientSplit.carbsGrams}g`} icon={<Droplets className="h-5 w-5" />} color="text-yellow-400" />
                  <StatCard label="Fats" value={`${plan.dietPlan.macronutrientSplit.fatsGrams}g`} icon={<Moon className="h-5 w-5" />} color="text-purple-400" />
                </div>

                <Card className="bg-zinc-900 border-white/5">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Macro Split</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {[
                      { label: 'Protein', grams: plan.dietPlan.macronutrientSplit.proteinGrams, color: 'bg-blue-500',   cal: plan.dietPlan.macronutrientSplit.proteinGrams * 4 },
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

            {plan.workoutPlan && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-black">4</div>
                  <p className="text-sm font-bold">Training Blueprint</p>
                </div>
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
