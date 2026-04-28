
'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Play, Pause, StopCircle, Footprints, Clock, Zap, ArrowLeft, MapPin, AlertCircle, Target, CalendarDays, Loader2, Dumbbell, BrainCircuit, TrendingUp, Sparkles, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isSameDay, startOfDay } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
// Local interface for food inference results
export interface FoodMealResult {
  itemName: string;
  confidence: number;
  nutrients?: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  };
}
import { suggestedExercises, type Exercise } from '@/lib/exercise-data';
import { cn } from "@/lib/utils";
import { type StoredScan } from '@/lib/progress-tracker';
import { type FitProfile } from '@/lib/progress-tracker';
import { type IdealBodyPlanResult } from '@/lib/ai-engine';

// Lazy load heavy Calendar component
const Calendar = dynamic(() => import("@/components/ui/calendar").then(mod => mod.Calendar), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-muted animate-pulse rounded-md border" />
});

const CALORIES_PER_KM = 60;
const MIN_DISTANCE_INCREMENT_KM = 0.005;

type LocationPermissionStatus = 'idle' | 'pending' | 'granted' | 'denied';

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

interface SavedMeal extends FoodMealResult {
  date: string;
  photoUrl?: string;
  foodName: string;
  calories: number;
  timestamp: string;
}

interface TrackPageClientProps {
  initialCaloriesParam?: string;
}

function TrackPageClientContent({ initialCaloriesParam }: TrackPageClientProps) {
    const router = useRouter();
    const initialCaloriesFromUrl = useMemo(() => parseInt(initialCaloriesParam || '0', 10), [initialCaloriesParam]);

    const [isTracking, setIsTracking] = useState(false);
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [distance, setDistance] = useState(0);
    const [caloriesBurned, setCaloriesBurned] = useState(0);
    const [locationPermissionStatus, setLocationPermissionStatus] = useState<LocationPermissionStatus>('idle');
    const [locationError, setLocationError] = useState<string | null>(null);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const watcherIdRef = useRef<number | null>(null);
    const lastPositionRef = useRef<GeolocationPosition | null>(null);
    const startTimeRef = useRef<number>(0);
    const { toast } = useToast();
    const [targetCalories, setTargetCalories] = useState<number>(initialCaloriesFromUrl);
    const [selectedMealName, setSelectedMealName] = useState<string | null>(null);

    const [allMeals, setAllMeals] = useState<SavedMeal[]>([]);
    const [selectedDateForMeals, setSelectedDateForMeals] = useState<Date | undefined>(new Date());
    const [mealsForSelectedDate, setMealsForSelectedDate] = useState<SavedMeal[]>([]);

    // AI SYNC STATE
    const [lastScan, setLastScan] = useState<StoredScan | null>(null);
    const [userProfile, setUserProfile] = useState<FitProfile | null>(null);
    const [idealPlan, setIdealPlan] = useState<IdealBodyPlanResult | null>(null);
    const [aiRecommendedGoal, setAiRecommendedGoal] = useState<{ kcal: number; km: number } | null>(null);
    const [smartExercises, setSmartExercises] = useState<Exercise[]>([]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedMeals = localStorage.getItem('fitjourney_saved_meals');
            if (savedMeals) setAllMeals(JSON.parse(savedMeals));

            const savedScans = JSON.parse(localStorage.getItem('fitjourney_scan_history') || '[]');
            const savedProfile = JSON.parse(localStorage.getItem('fitjourney_profile') || '{}');
            const savedIdealPlan = JSON.parse(localStorage.getItem('fitjourney_latest_ideal_body_plan') || 'null');
            
            setUserProfile(savedProfile);
            setIdealPlan(savedIdealPlan);

            if (savedScans.length > 0) {
               const latest = savedScans[0];
               setLastScan(latest);
               
               // Calculate smart goal factoring in Ideal Plan
               const goalBf = parseFloat(savedProfile.goalBf || '15');
               const bfGap = latest.bf - goalBf;
               
               let kcal = 150, km = 2.5;
               
               // Adjust baseline by Ideal Plan intensity
               const intensityMultiplier = savedIdealPlan?.workoutPlan?.frequencyPerWeek?.includes('5') ? 1.2 : 1.0;

               if (bfGap > 10) kcal = 600;
               else if (bfGap > 5) kcal = 450;
               else if (bfGap > 2) kcal = 300;
               
               kcal = Math.round(kcal * intensityMultiplier);
               km = parseFloat((kcal / 60).toFixed(1));
               
               setAiRecommendedGoal({ kcal, km });

               // Smart Exercises logic refined by Ideal Body Focus
               const bodyType = latest.bodyType;
               const focus = savedIdealPlan?.workoutPlan?.focus?.toLowerCase() || '';
               let recommendations: Exercise[] = [];
               
               if (bodyType === 'upper_body') {
                  recommendations = suggestedExercises.filter(e => ['3', '7'].includes(e.id)); 
               } else if (bodyType === 'lower_body') {
                  recommendations = suggestedExercises.filter(e => ['4', '6', '8'].includes(e.id)); 
               } else {
                  recommendations = suggestedExercises.filter(e => ['5', '1', '9'].includes(e.id)); 
               }

               // Intensity adjustment: if "Hypertrophy" focus, increase volume
               if (focus.includes('hypertrophy')) {
                  recommendations = recommendations.map(r => ({ ...r, reps: '15-20 reps', sets: '4 sets' }));
               }

               setSmartExercises(recommendations);
            }
        }
    }, []);

    useEffect(() => {
        if (selectedDateForMeals) {
            const found = allMeals.filter(m => isSameDay(parseISO(m.timestamp), selectedDateForMeals));
            setMealsForSelectedDate(found);
        }
    }, [selectedDateForMeals, allMeals]);

    useEffect(() => {
        if (isTracking) {
            startTimeRef.current = Date.now() - timeElapsed * 1000;
            intervalRef.current = setInterval(() => setTimeElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isTracking, timeElapsed]);

    useEffect(() => setCaloriesBurned(Math.round(distance * CALORIES_PER_KM * 10) / 10), [distance]);

    const handleStartPause = () => {
        if (!isTracking) {
            if (locationPermissionStatus === 'granted') {
                setIsTracking(true);
                watcherIdRef.current = navigator.geolocation.watchPosition((pos) => {
                    if (lastPositionRef.current) {
                        const inc = calculateDistance(lastPositionRef.current.coords.latitude, lastPositionRef.current.coords.longitude, pos.coords.latitude, pos.coords.longitude);
                        if (inc > MIN_DISTANCE_INCREMENT_KM) setDistance(d => d + inc);
                    }
                    lastPositionRef.current = pos;
                }, (err) => setLocationError(err.message), { enableHighAccuracy: true });
            } else {
                navigator.geolocation.getCurrentPosition(() => { setLocationPermissionStatus('granted'); handleStartPause(); }, () => setLocationPermissionStatus('denied'));
            }
        } else {
            setIsTracking(false);
            if (watcherIdRef.current !== null) navigator.geolocation.clearWatch(watcherIdRef.current);
        }
    };

    return (
        <div className="flex flex-col items-center min-h-screen bg-background p-4 pb-20 space-y-4">
             {/* DAILY BLUEPRINT SUMMARY */}
             {idealPlan && (
                <Card className="w-full max-w-md bg-primary text-primary-foreground border-none shadow-2xl overflow-hidden relative group">
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Sparkles className="h-24 w-24 rotate-12" />
                   </div>
                   <CardHeader className="pb-2">
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Daily Master Plan</p>
                       <CardTitle className="text-2xl font-black">{idealPlan.planTitle}</CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                         <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                            <p className="text-xs opacity-70">Burn Target</p>
                            <p className="text-2xl font-black">{idealPlan.dietPlan.dailyCalorieTarget} <span className="text-sm opacity-50">kcal</span></p>
                         </div>
                         <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                            <p className="text-xs opacity-70">Workout Focus</p>
                            <p className="text-lg font-bold leading-tight">{idealPlan.workoutPlan.focus}</p>
                         </div>
                      </div>
                      <div className="space-y-2">
                         <div className="flex justify-between items-end">
                            <p className="text-xs font-bold">Daily Burn Progress</p>
                            <p className="text-xs opacity-70">{caloriesBurned} / {idealPlan.dietPlan.dailyCalorieTarget} kcal</p>
                         </div>
                         <Progress value={(caloriesBurned / idealPlan.dietPlan.dailyCalorieTarget) * 100} className="h-2 bg-white/20 [&>*]:bg-white" />
                      </div>
                   </CardContent>
                </Card>
             )}

             <Card className="w-full max-w-md shadow-lg">
                <CardHeader>
                    <CardTitle className="text-lg font-bold text-primary flex items-center justify-center">
                        <CalendarDays className="mr-2 h-5 w-5" /> Goal Selection
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <Calendar mode="single" selected={selectedDateForMeals} onSelect={setSelectedDateForMeals} className="rounded-md border self-center" />
                    <ScrollArea className="h-32 w-full border rounded-md p-2">
                        {mealsForSelectedDate.map((meal, idx) => (
                            <div key={idx} className="p-2 mb-1 bg-secondary rounded-md cursor-pointer hover:bg-secondary/80" onClick={() => {
                                setTargetCalories(meal.calories);
                                setSelectedMealName(meal.foodName);
                                toast({ title: "Goal Set", description: `Targeting ${meal.calories} kcal.` });
                            }}>
                                <p className="text-xs font-bold">{meal.foodName}</p>
                                <p className="text-[10px]">{meal.calories} kcal</p>
                            </div>
                        ))}
                    </ScrollArea>
                </CardContent>
            </Card>

            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-xl font-bold text-primary flex items-center justify-center">
                        <Footprints className="mr-2 h-6 w-6" /> Tracker
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="p-3 bg-secondary rounded-md text-sm text-center">
                         <Target className="inline h-4 w-4 mr-2 text-accent" />
                         {selectedMealName ? `Goal: ${selectedMealName} (${targetCalories} kcal)` : "No meal goal selected."}
                     </div>

                     {aiRecommendedGoal && !selectedMealName && (
                        <div 
                          className="bg-accent/10 border border-accent/20 rounded-xl p-4 cursor-pointer hover:bg-accent/20 transition-all group"
                          onClick={() => {
                             setTargetCalories(aiRecommendedGoal.kcal);
                             setSelectedMealName(`AI Suggested (${aiRecommendedGoal.km}km Walk)`);
                             toast({ title: "AI Coaching Active", description: `Today's target: ${aiRecommendedGoal.kcal} kcal burn.` });
                          }}
                        >
                           <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                 <BrainCircuit className="h-4 w-4 text-accent" />
                                 <span className="text-xs font-bold uppercase tracking-wider">AI Suggested Goal</span>
                              </div>
                              <Sparkles className="h-4 w-4 text-accent animate-pulse" />
                           </div>
                           <p className="text-lg font-black text-accent">{aiRecommendedGoal.kcal} <span className="text-sm font-normal text-muted-foreground">KCAL / </span>{aiRecommendedGoal.km} <span className="text-sm font-normal text-muted-foreground">KM Walk</span></p>
                           <p className="text-[10px] text-muted-foreground mt-1 group-hover:text-primary transition-colors">Based on your {lastScan?.bf}% Body Fat scan. Click to set this goal.</p>
                        </div>
                     )}

                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div><p className="text-[10px] text-muted-foreground uppercase">KM</p><p className="text-lg font-bold">{distance.toFixed(2)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase">Time</p><p className="text-lg font-bold">{format(timeElapsed * 1000, 'mm:ss')}</p></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase">KCAL</p><p className="text-lg font-bold text-accent">{caloriesBurned.toFixed(0)}</p></div>
                    </div>

                    <div className="flex justify-center space-x-4">
                        <Button size="lg" onClick={handleStartPause} className={cn("rounded-full w-20 h-20 shadow-lg transition-all active:scale-95", isTracking ? "bg-yellow-500 hover:bg-yellow-600" : "bg-accent hover:bg-accent/90")}>
                            {isTracking ? <Pause className="h-8 w-8 fill-white" /> : <Play className="h-8 w-8 ml-1 fill-white" />}
                        </Button>
                        <Button size="lg" variant="destructive" className="rounded-full w-20 h-20 shadow-lg transition-all active:scale-95" onClick={() => { setIsTracking(false); setDistance(0); setTimeElapsed(0); }}><StopCircle className="h-8 w-8 fill-white" /></Button>
                    </div>
                </CardContent>
            </Card>

            {/* SMART COACH RECOMMENDATIONS */}
            {smartExercises.length > 0 && (
               <Card className="w-full max-w-md shadow-xl border-accent/20 bg-accent/5 overflow-hidden">
                  <CardHeader className="pb-2">
                     <CardTitle className="text-base flex items-center gap-2">
                        <Dumbbell className="h-5 w-5 text-accent" /> AI Coach Recommendations
                     </CardTitle>
                     <CardDescription className="text-xs">
                        Targeting {lastScan?.bodyTypeLabel || 'Full Body'} for better proportions.
                     </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                     <div className="grid grid-cols-1 gap-2">
                        {smartExercises.map(ex => (
                           <div 
                             key={ex.id} 
                             className="flex items-center gap-3 p-3 bg-background/60 rounded-2xl border border-accent/10 hover:border-accent/40 transition-all group cursor-pointer"
                             onClick={() => router.push(`/track/workout?id=${ex.id}`)}
                           >
                              <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform relative overflow-hidden">
                                 {ex.icon}
                                 <div className="absolute inset-0 bg-accent/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ChevronRight className="h-4 w-4 text-white" />
                                 </div>
                              </div>
                              <div className="flex-1">
                                 <p className="text-sm font-bold">{ex.name}</p>
                                 <p className="text-[10px] text-muted-foreground">{ex.reps}  {ex.sets}</p>
                              </div>
                              <div className="text-right">
                                 <p className="text-xs font-black text-accent">~{ex.caloriesPerMinute * ex.durationMinutes} kcal</p>
                                 <p className="text-[9px] text-muted-foreground">{ex.durationMinutes} min</p>
                              </div>
                           </div>
                        ))}
                     </div>
                     <p className="text-[10px] text-center text-muted-foreground italic px-4">
                        &quot;Since AI detected an **{lastScan?.bodyTypeLabel}** focus and your blueprint is **{idealPlan?.planTitle}**, these exercises are prioritized.&quot;
                     </p>
                  </CardContent>
               </Card>
            )}
        </div>
    );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <TrackPageClientContent initialCaloriesParam={undefined} />
    </Suspense>
  );
}
