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
const SESSIONS_NEEDED  = 5; 

const BODY_TYPES = [
  {
    type:   'ectomorph',
    label:  'Ectomorph',
    emoji:  '🏃',
    bf_m:   '8–12%',
    bf_f:   '15–20%',
    image_m: '/images/body_m_ecto.png',
    image_f: '/images/body_f_ecto.png',
    color:  'from-blue-600/30 to-blue-900/20',
    border: 'border-blue-500/50',
    glow:   'shadow-blue-500/30',
    accent: 'text-blue-400',
    bg:     'bg-blue-500',
    desc:   'Naturally lean, long limbs, fast metabolism. Often called "hard gainers" for muscle mass.',
    tips:   ['Eat every 3 hours', 'Heavy compound lifts', 'High carbohydrate intake', 'Limit high-intensity cardio'],
  },
  {
    type:   'mesomorph',
    label:  'Mesomorph',
    emoji:  '💪',
    bf_m:   '10–15%',
    bf_f:   '18–24%',
    image_m: '/images/body_m_meso.png',
    image_f: '/images/body_f_meso.png',
    color:  'from-green-600/30 to-green-900/20',
    border: 'border-green-500/50',
    glow:   'shadow-green-500/30',
    accent: 'text-green-400',
    bg:     'bg-green-500',
    desc:   'Athletic, well-proportioned frame. Naturally gains muscle and loses fat with ease.',
    tips:   ['Balanced macronutrients', 'Mix strength + cardio', 'Progressive overload focus', 'Prioritize recovery'],
  },
  {
    type:   'endomorph',
    label:  'Endomorph',
    emoji:  '🏋️',
    bf_m:   '18–25%',
    bf_f:   '25–32%',
    image_m: '/images/body_m_endo.png',
    image_f: '/images/body_endomorph.png', // Using the high-quality medical illustration
    color:  'from-orange-600/30 to-orange-900/20',
    border: 'border-orange-500/50',
    glow:   'shadow-orange-500/30',
    accent: 'text-orange-400',
    bg:     'bg-orange-500',
    desc:   'Larger bone structure, stores fat more easily. Excellent strength and power potential.',
    tips:   ['Caloric deficit focus', 'HIIT 3× per week', 'Low-glycemic carbohydrates', 'High protein intake'],
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
  const [gender, setGender]               = useState<'male' | 'female'>('male');
  const [sessionsLeft, setSessionsLeft]   = useState(0);
  const [expandedType, setExpandedType]   = useState<string | null>(null);

  useEffect(() => {
    const saved     = localStorage.getItem(LOCAL_KEY);
    const lockData  = localStorage.getItem(LOCK_KEY);
    const sessions  = parseInt(localStorage.getItem(SESSIONS_KEY) || '0');

    if (saved)    setPlan(JSON.parse(saved));
    
    // Check profile for initial gender
    const profile = JSON.parse(localStorage.getItem('fitjourney_profile_data') || '{}');
    if (profile.gender === 'female') setGender('female');

    if (lockData) {
      const { type, lockedAt } = JSON.parse(lockData);
      const sessionsAfterLock = Math.max(0, sessions - lockedAt);
      if (sessionsAfterLock < SESSIONS_NEEDED) {
        setLocked(type);
        setSelected(type);
        setSessionsLeft(SESSIONS_NEEDED - sessionsAfterLock);
      } else {
        localStorage.removeItem(LOCK_KEY);
      }
    }
  }, []);

  const handleSelect = (type: string) => {
    if (locked) return; 
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
        gender:        gender, // Use current toggle state
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
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Select your body type blueprint</p>
        </div>
        {locked && (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
            <Lock className="h-3 w-3 mr-1" /> Locked · {sessionsLeft} left
          </Badge>
        )}
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">

        {/* Gender Toggle */}
        {!locked && (
          <div className="flex items-center justify-between bg-white/5 p-1 rounded-2xl border border-white/5">
            <button 
              onClick={() => setGender('male')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all font-bold text-sm ${gender === 'male' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-white/5'}`}
            >
              ♂️ Male
            </button>
            <button 
              onClick={() => setGender('female')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all font-bold text-sm ${gender === 'female' ? 'bg-pink-500 text-white' : 'text-muted-foreground hover:bg-white/5'}`}
            >
              ♀️ Female
            </button>
          </div>
        )}

        {/* Step label */}
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-black shadow-lg shadow-primary/20">1</div>
          <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">Identify Your Build</p>
          {locked && <Lock className="h-4 w-4 text-amber-400 ml-auto" />}
        </div>

        {/* 3 Body Type Cards */}
        <div className="space-y-6">
          {BODY_TYPES.map(bt => {
            const isSelected = selected === bt.type;
            const isLocked   = locked === bt.type;
            const isDisabled = !!locked && locked !== bt.type;
            const image = gender === 'male' ? bt.image_m : bt.image_f;
            const bf = gender === 'male' ? bt.bf_m : bt.bf_f;

            return (
              <div
                key={bt.type}
                onClick={() => !isDisabled && handleSelect(bt.type)}
                className={`rounded-3xl border-2 overflow-hidden transition-all duration-300
                  ${isSelected ? `${bt.border} shadow-2xl ${bt.glow} scale-[1.02]` : 'border-white/10 opacity-70'}
                  ${isDisabled ? 'opacity-30 cursor-not-allowed grayscale-[0.5]' : 'cursor-pointer hover:border-white/30 hover:opacity-100'}
                  bg-gradient-to-br ${bt.color}
                `}
              >
                {/* Medical Illustration */}
                <div className="relative aspect-[1.5/1]">
                  <Image
                    src={image}
                    alt={`${gender} ${bt.label}`}
                    fill
                    className="object-cover"
                  />
                  {/* Overlays */}
                  <div className="absolute top-4 left-4 flex gap-2">
                    <Badge className={`${bt.bg} text-white border-none text-[10px] font-black px-3 py-1 uppercase tracking-widest`}>
                      {bt.emoji} {bt.label}
                    </Badge>
                  </div>
                  
                  <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                    <Badge variant="outline" className="bg-black/50 backdrop-blur-md text-[10px] border-white/20">BF: {bf}</Badge>
                    {isSelected && <CheckCircle2 className={`h-8 w-8 ${bt.accent} drop-shadow-lg`} />}
                  </div>

                  {isLocked && (
                    <div className="absolute bottom-4 right-4">
                      <Badge className="bg-amber-500 text-black font-black text-[10px] px-3 py-1 shadow-lg">
                        <Lock className="h-3 w-3 mr-1" /> CURRENT STATUS
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                   <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground leading-relaxed flex-1">{bt.desc}</p>
                      <button
                        className={`ml-4 p-2 rounded-full bg-white/5 transition-colors ${isSelected ? bt.accent : 'text-white'}`}
                        onClick={e => { e.stopPropagation(); setExpandedType(expandedType === bt.type ? null : bt.type); }}
                      >
                        {expandedType === bt.type ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                   </div>

                  {expandedType === bt.type && (
                    <div className="pt-4 border-t border-white/10 flex flex-wrap gap-2">
                      {bt.tips.map(tip => (
                        <Badge key={tip} variant="secondary" className="text-[10px] bg-white/5 border-white/10 text-white font-medium">{tip}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Lock Mechanism */}
        {selected && !locked && (
          <div className={`rounded-3xl border-2 ${selectedInfo?.border} p-6 bg-zinc-900 shadow-2xl space-y-4`}>
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-2xl ${selectedInfo?.bg} flex items-center justify-center text-2xl shadow-lg`}>
                {selectedInfo?.emoji}
              </div>
              <div>
                <p className="text-lg font-black">{selectedInfo?.label} Selected</p>
                <p className="text-xs text-muted-foreground">Finalize this blueprint to unlock your routine</p>
              </div>
            </div>
            <Button onClick={handleLock} className={`w-full h-14 font-black rounded-2xl ${selectedInfo?.bg} hover:opacity-90 text-white border-none text-md shadow-xl`}>
              <Lock className="mr-2 h-5 w-5" /> Lock Status & Generate Plan
            </Button>
            <p className="text-[10px] text-muted-foreground text-center font-medium leading-relaxed">
              ⚠️ Warning: Your metabolic math will be locked to this body type for {SESSIONS_NEEDED} workout sessions.
            </p>
          </div>
        )}

        {/* Generation & Results (Same as before but cleaned up) */}
        {locked && (
          <div className="space-y-6 pt-4 border-t border-white/5">
             <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-black shadow-lg shadow-primary/20">2</div>
              <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">Blueprint Generation</p>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full h-16 rounded-2xl text-lg font-black bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/30 transition-transform active:scale-95"
            >
              {isLoading
                ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing Metrics...</>
                : <><Sparkles className="mr-2 h-5 w-5" /> Calculate Ideal Body Plan</>}
            </Button>

            {plan && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center space-y-2">
                  <Badge className="text-[10px] px-4 py-1.5 bg-primary/20 text-primary border-primary/40 uppercase font-black tracking-widest">{plan.planTitle}</Badge>
                  <p className="text-sm text-muted-foreground leading-relaxed italic">"{plan.planSummary}"</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <StatCard label="Daily Goal" value={`${plan.dietPlan?.dailyCalorieTarget} kcal`} icon={<Flame className="h-5 w-5" />} color="text-orange-400" />
                  <StatCard label="Protein" value={`${plan.dietPlan?.macronutrientSplit.proteinGrams}g`} icon={<Dumbbell className="h-5 w-5" />} color="text-blue-400" />
                  <StatCard label="Carbohydrates" value={`${plan.dietPlan?.macronutrientSplit.carbsGrams}g`} icon={<Droplets className="h-5 w-5" />} color="text-yellow-400" />
                  <StatCard label="Healthy Fats" value={`${plan.dietPlan?.macronutrientSplit.fatsGrams}g`} icon={<Moon className="h-5 w-5" />} color="text-purple-400" />
                </div>

                <div className="space-y-4">
                   <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-black shadow-lg shadow-primary/20">3</div>
                    <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">Training Routine</p>
                  </div>
                  <Card className="bg-zinc-900 border-white/10 rounded-[2rem] overflow-hidden">
                    <CardContent className="p-6 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
                          <p className="text-3xl font-black text-primary">{plan.workoutPlan?.frequencyPerWeek}</p>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">Sessions / Week</p>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/5 flex flex-col justify-center">
                          <p className="text-sm font-black text-primary leading-tight">{plan.workoutPlan?.focus}</p>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">Core Focus</p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Protocol Highlights</p>
                        {plan.workoutPlan?.sampleExercises.map((ex, i) => (
                          <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                            <div className="h-8 w-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-black text-sm">{i + 1}</div>
                            <span className="text-sm font-medium">{ex}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
