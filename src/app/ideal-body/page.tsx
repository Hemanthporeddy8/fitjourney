'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, Loader2, Scale, Flame, Dumbbell, Droplets, Moon, Lock, CheckCircle2, ChevronDown, ChevronUp, Play, Upload, Target, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { aiEngine, type IdealBodyPlanResult } from '@/lib/ai-engine';
import { idealCompareEngine, type ComparisonResult } from '@/lib/idealcompare-engine';

const LOCAL_KEY        = 'fitjourney_latest_ideal_body_plan';
const LOCK_KEY         = 'fitjourney_body_type_lock';
const SESSIONS_KEY     = 'fitjourney_sessions_completed';
const SESSIONS_NEEDED  = 5;

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isLoading, setIsLoading]         = useState(false);
  const [isComparing, setIsComparing]     = useState(false);
  const [plan, setPlan]                   = useState<IdealBodyPlanResult | null>(null);
  const [selected, setSelected]           = useState<string | null>(null);
  const [locked, setLocked]               = useState<string | null>(null);
  const [sessionsLeft, setSessionsLeft]   = useState(0);
  const [expandedType, setExpandedType]   = useState<string | null>(null);
  const [comparison, setComparison]       = useState<ComparisonResult | null>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !locked) return;

    setIsComparing(true);
    try {
      const result = await idealCompareEngine.analyzeProgress(file, locked);
      setComparison(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsComparing(false);
    }
  };

  const selectedInfo = BODY_TYPES.find(b => b.type === selected);

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileUpload} 
      />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl text-white hover:bg-white/10" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-black flex items-center gap-2">
            <Scale className="text-primary h-5 w-5" /> Ideal Body Plan
          </h1>
        </div>
        {locked && (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
            <Lock className="h-3 w-3 mr-1" /> Locked · {sessionsLeft} left
          </Badge>
        )}
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">

        {/* 🚀 ACTION CENTER (ONLY WHEN LOCKED) */}
        {locked && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              onClick={() => router.push('/track')}
              className="h-16 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-lg shadow-xl shadow-primary/20"
            >
              <Play className="mr-2 h-6 w-6 fill-current" /> Start Today's Session
            </Button>
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isComparing}
              variant="outline"
              className="h-16 rounded-2xl border-2 border-white/10 bg-white/5 hover:bg-white/10 font-black text-lg"
            >
              {isComparing ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Upload className="mr-2 h-5 w-5" />
              )}
              {isComparing ? 'Analyzing...' : 'Upload Progress Photo'}
            </Button>
          </div>
        )}

        {/* 📊 IDEAL COMPARE RESULTS */}
        {comparison && (
          <Card className="bg-zinc-900 border-primary/30 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-primary/10 px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-sm font-black flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> IdealCompare AI Analysis
              </h3>
              <Badge variant="outline" className="text-primary border-primary/30">
                {comparison.matchPercentage}% Match
              </Badge>
            </div>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span>Proximity to Ideal Build</span>
                  <span>{comparison.matchPercentage}%</span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-1000" 
                    style={{ width: `${comparison.matchPercentage}%` }} 
                  />
                </div>
              </div>

              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="text-xs font-black text-muted-foreground uppercase mb-2">Focus Areas for Next Session</p>
                <div className="flex flex-wrap gap-2">
                  {comparison.focusAreas.map(area => (
                    <Badge key={area} className="bg-zinc-800 text-white text-[10px] py-1">
                      🎯 {area}
                    </Badge>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground italic leading-relaxed">
                "{comparison.analysis}"
              </p>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Upper</p>
                  <p className="text-xs font-bold text-primary">{comparison.metrics.upperBodyDensity}</p>
                </div>
                <div className="text-center border-x border-white/5">
                  <p className="text-[10px] text-muted-foreground uppercase">Core</p>
                  <p className="text-xs font-bold text-primary">{comparison.metrics.coreDefinition}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Lower</p>
                  <p className="text-xs font-bold text-primary">{comparison.metrics.lowerBodyPower}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 1. Body Type Selection */}
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-black">1</div>
          <p className="text-sm font-bold">Choose Your Body Type</p>
        </div>

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
                <div className="relative">
                  <Image src={bt.image} alt={bt.label} width={700} height={400} className="w-full object-cover" />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <Badge className={`${bt.bg} text-white border-none text-xs font-black px-3`}>{bt.emoji} {bt.label}</Badge>
                    <Badge variant="secondary" className="text-xs">BF: {bt.bf}</Badge>
                  </div>
                  {isSelected && <div className="absolute top-3 right-3"><CheckCircle2 className={`h-7 w-7 ${bt.accent}`} /></div>}
                  {isLocked && <div className="absolute bottom-3 right-3"><Badge className="bg-amber-500 text-black font-black text-xs"><Lock className="h-3 w-3 mr-1" /> YOUR TYPE</Badge></div>}
                </div>

                <button
                  className="w-full flex items-center justify-between px-4 py-3"
                  onClick={e => { e.stopPropagation(); setExpandedType(expandedType === bt.type ? null : bt.type); }}
                >
                  <p className="text-sm text-muted-foreground">{bt.desc}</p>
                  {expandedType === bt.type ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
                </button>

                {expandedType === bt.type && (
                  <div className="px-4 pb-4 flex flex-wrap gap-2">
                    {bt.tips.map(tip => <Badge key={tip} variant="secondary" className="text-xs">{tip}</Badge>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selected && !locked && (
          <div className={`rounded-2xl border-2 ${selectedInfo?.border} p-4 bg-gradient-to-r ${selectedInfo?.color} space-y-3`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedInfo?.emoji}</span>
              <div>
                <p className="font-black">{selectedInfo?.label} Selected</p>
                <p className="text-xs text-muted-foreground">Lock this body type to get your personalised plan</p>
              </div>
            </div>
            <Button onClick={handleLock} className={`w-full h-12 font-black rounded-xl ${selectedInfo?.bg} text-white`}>
              <Lock className="mr-2 h-4 w-4" /> Lock My Body Type & Continue
            </Button>
          </div>
        )}

        {/* 2. Generate Plan */}
        {(selected || locked) && (
          <>
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-black">2</div>
              <p className="text-sm font-bold">Generate Your Blueprint</p>
            </div>
            <Button onClick={handleGenerate} disabled={isLoading} className="w-full h-16 rounded-2xl text-lg font-black bg-primary">
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
              {isLoading ? "Calculating..." : "Generate My Ideal Body Plan"}
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
                  <StatCard label="Calories" value={`${plan.dietPlan.dailyCalorieTarget}`} icon={<Flame className="h-5 w-5" />} color="text-orange-400" />
                  <StatCard label="Protein" value={`${plan.dietPlan.macronutrientSplit.proteinGrams}g`} icon={<Dumbbell className="h-5 w-5" />} color="text-blue-400" />
                  <StatCard label="Carbs" value={`${plan.dietPlan.macronutrientSplit.carbsGrams}g`} icon={<Droplets className="h-5 w-5" />} color="text-yellow-400" />
                  <StatCard label="Fats" value={`${plan.dietPlan.macronutrientSplit.fatsGrams}g`} icon={<Moon className="h-5 w-5" />} color="text-purple-400" />
                </div>
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
          </div>
        )}
      </div>
    </div>
  );
}
