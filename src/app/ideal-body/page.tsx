'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, Loader2, Scale, Flame, Dumbbell, Droplets, Moon, Lock, CheckCircle2, Play, Upload, Target } from 'lucide-react';
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
  { id: 'ectomorph', label: 'Ectomorph', bf: '8–12%', color: 'border-blue-500/50', bg: 'bg-blue-500', desc: 'Naturally lean, long limbs, fast metabolism.' },
  { id: 'mesomorph', label: 'Mesomorph', bf: '10–15%', color: 'border-green-500/50', bg: 'bg-green-500', desc: 'Athletic build, broad shoulders, muscle definition.' },
  { id: 'endomorph', label: 'Endomorph', bf: '18–25%', color: 'border-orange-500/50', bg: 'bg-orange-500', desc: 'Stocky frame, naturally strong, stores fat easily.' }
];

export default function IdealBodyPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isLoading, setIsLoading]         = useState(false);
  const [isComparing, setIsComparing]     = useState(false);
  const [plan, setPlan]                   = useState<IdealBodyPlanResult | null>(null);
  const [selected, setSelected]           = useState<string | null>(null);
  const [locked, setLocked]               = useState<string | null>(null);
  const [gender, setGender]               = useState<'male' | 'female'>('male');
  const [sessionsLeft, setSessionsLeft]   = useState(0);
  const [comparison, setComparison]       = useState<ComparisonResult | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_KEY);
    const lockData = localStorage.getItem(LOCK_KEY);
    const sessions = parseInt(localStorage.getItem(SESSIONS_KEY) || '0');
    const profile = JSON.parse(localStorage.getItem('fitjourney_profile_data') || '{}');

    if (saved) setPlan(JSON.parse(saved));
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
      const result = await aiEngine.calculateIdealBodyPlan({
        weightKg: 70, heightCm: 175, age: 28, gender, goal: 'muscle_gain', activityLevel: 'moderately_active',
      });
      setPlan(result);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(result));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !locked) return;
    setIsComparing(true);
    try {
      const res = await idealCompareEngine.analyzeProgress(file, locked);
      setComparison(res);
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />

      <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-black flex items-center gap-2"><Scale className="text-primary h-5 w-5" /> Ideal Body Plan</h1>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={gender === 'male' ? 'default' : 'outline'} className="h-7 px-3 text-[10px] rounded-full" onClick={() => !locked && setGender('male')}>MALE</Button>
          <Button size="sm" variant={gender === 'female' ? 'default' : 'outline'} className="h-7 px-3 text-[10px] rounded-full" onClick={() => !locked && setGender('female')}>FEMALE</Button>
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">
        
        {/* 🚀 ACTION CENTER (ONLY WHEN LOCKED) */}
        {locked && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button onClick={() => router.push('/track')} className="h-14 rounded-2xl bg-primary font-black text-lg shadow-xl shadow-primary/20"><Play className="mr-2 h-5 w-5 fill-current" /> Start Today's Session</Button>
            <Button onClick={() => fileInputRef.current?.click()} disabled={isComparing} variant="outline" className="h-14 rounded-2xl border-2 border-white/10 font-black text-lg">
              {isComparing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Upload className="mr-2 h-5 w-5" />}
              {isComparing ? 'Analyzing...' : 'Compare Photo'}
            </Button>
          </div>
        )}

        {/* 📊 IDEAL COMPARE RESULTS */}
        {comparison && (
          <Card className="bg-zinc-900 border-primary/30 overflow-hidden">
            <div className="bg-primary/10 px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-sm font-black flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> AI Analysis: {comparison.matchPercentage}% Match</h3>
            </div>
            <CardContent className="p-4 space-y-3">
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${comparison.matchPercentage}%` }} />
              </div>
              <p className="text-xs text-muted-foreground italic">"{comparison.analysis}"</p>
              <div className="flex flex-wrap gap-2">
                {comparison.focusAreas.map(area => <Badge key={area} className="bg-zinc-800 text-[10px]">🎯 {area}</Badge>)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 1. Body Type Chart */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Professional Reference Chart</h2>
            {locked && <Badge variant="outline" className="text-amber-400 border-amber-400/30 text-[10px]"><Lock className="h-3 w-3 mr-1" /> Selection Locked</Badge>}
          </div>
          <div className="rounded-[2rem] overflow-hidden border border-white/10 bg-white">
            <Image 
              src={gender === 'male' ? '/images/male_body_types.png' : '/images/female_body_types.png'} 
              alt="Body types" width={800} height={450} className="w-full h-auto"
            />
          </div>
        </div>

        {/* Selection Grid */}
        <div className="grid grid-cols-1 gap-3">
          {BODY_TYPES.map(bt => {
            const isSelected = selected === bt.id;
            const isLocked   = locked === bt.id;
            const isDisabled = !!locked && locked !== bt.id;
            return (
              <button
                key={bt.id}
                onClick={() => !isDisabled && setSelected(bt.id)}
                className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between
                  ${isSelected ? `border-primary bg-primary/10 shadow-lg shadow-primary/10` : 'border-white/5 bg-zinc-900'}
                  ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'hover:border-white/20'}
                `}
              >
                <div>
                  <p className="text-sm font-black uppercase tracking-widest">{bt.label}</p>
                  <p className="text-[10px] text-muted-foreground">{bt.desc}</p>
                </div>
                {isSelected && <CheckCircle2 className="text-primary h-5 w-5" />}
              </button>
            );
          })}
        </div>

        {selected && !locked && (
          <Button onClick={handleLock} className="w-full h-14 font-black rounded-2xl bg-primary">
            <Lock className="mr-2 h-4 w-4" /> Lock Selection & Continue
          </Button>
        )}

        {/* Generate Button */}
        {(selected || locked) && (
          <Button onClick={handleGenerate} disabled={isLoading} className="w-full h-16 rounded-3xl bg-zinc-900 border-2 border-primary/20 text-lg font-black">
            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5 text-primary" />}
            {isLoading ? "Calculating..." : "Generate AI Blueprint"}
          </Button>
        )}

        {/* Plan Results */}
        {plan && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
             <div className="p-4 rounded-3xl bg-zinc-900 border border-white/5 space-y-6">
                <div className="text-center">
                  <Badge variant="outline" className="text-primary border-primary/30 uppercase tracking-widest px-4">{plan.planTitle}</Badge>
                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{plan.planSummary}</p>
                </div>

                {plan.dietPlan && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                      <Flame className="h-5 w-5 text-orange-400 mx-auto mb-1" />
                      <p className="text-xl font-black">{plan.dietPlan.dailyCalorieTarget}</p>
                      <p className="text-[10px] uppercase text-muted-foreground">Calories</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                      <Dumbbell className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                      <p className="text-xl font-black">{plan.dietPlan.macronutrientSplit.proteinGrams}g</p>
                      <p className="text-[10px] uppercase text-muted-foreground">Protein</p>
                    </div>
                  </div>
                )}
             </div>
          </div>
        )}

      </div>
    </div>
  );
}
