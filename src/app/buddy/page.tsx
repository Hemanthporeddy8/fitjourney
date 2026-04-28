
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as PageCardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Zap, Activity, ShieldCheck, ShieldHalf, Heart, Flame, Clock, StopCircle, Utensils, Star as StarIcon, BarChart3 as ActivityReportIcon, Waves, PersonStanding, Camera as CameraIcon, RefreshCcw as FlipCameraIcon, Video as VideoIcon, Loader2, Target as TargetIcon, Repeat as RepeatIcon, XCircle, ShieldAlert, Gauge, TrendingUp, MinusCircle, PlusCircle, Play, Pause } from 'lucide-react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { parseISO, isSameDay, startOfDay } from 'date-fns';
import { useRouter } from 'next/navigation';
import { type IdealBodyPlanResult as GenerateIdealBodyPlanOutput } from '@/lib/ai-engine';

const DEFAULT_TARGET_CALORIES = 250;
const DEFAULT_POOL_LENGTH_METERS = 25;

const poolLengthOptions = [
  { value: 25, label: '25 meters' },
  { value: 50, label: '50 meters' },
  { value: 33.33, label: '33.33 meters (Short Course Yards adjusted)' },
  { value: 20, label: '20 meters' },
];

interface ActivityItem {
  name: string;
  icon?: React.ReactNode;
  caloriesPerMinute: number;
  averageSpeedKmh?: number;
  caloriesPerRep?: number;
  repUnit?: string;
}

interface SavedMeal {
  foodName: string;
  calories: number;
  timestamp: string;
}

interface CompletedBuddyActivity {
  id: string;
  name: string;
  durationSeconds: number;
  caloriesBurned: number;
  timestamp: string;
  distanceKm?: number;
  laps?: number;
  poolLengthM?: number;
  strokeType?: string;
  aiAnalysisNotes?: string;
  repsCompleted?: number;
  repUnit?: string;
  treadmillSpeedKmh?: number;
  treadmillInclinePercent?: number;
}

interface AiWorkoutAnalysis {
    detectedStroke?: string;
    estimatedDistanceM?: number;
    formScore?: string;
    confidence?: number;
    estimatedReps?: number;
}

const ActivityButton: React.FC<ActivityItem & { targetCalories: number; selectedPoolLength: number; onClick: () => void }> = ({ name, icon, caloriesPerMinute, averageSpeedKmh, caloriesPerRep, repUnit, targetCalories, selectedPoolLength, onClick }) => {
  const timeToBurnMinutes = targetCalories > 0 && caloriesPerMinute > 0 ? Math.round(targetCalories / caloriesPerMinute) : 0;
  
  let distanceText = "";
  if (averageSpeedKmh && timeToBurnMinutes > 0 && !name.toLowerCase().includes('swimming') && !(caloriesPerRep && repUnit)) { 
    const timeToBurnHours = timeToBurnMinutes / 60;
    const distanceKm = Math.round(timeToBurnHours * averageSpeedKmh * 10) / 10; 
    distanceText = ` / ~${distanceKm} km`;
  }

  let repsText = "";
  if (caloriesPerRep && repUnit && targetCalories > 0 && caloriesPerRep > 0) {
    const repsToBurn = Math.round(targetCalories / caloriesPerRep);
    repsText = ` / ~${repsToBurn} ${repUnit}`;
  }

  let lapsText = "";
  if (name.toLowerCase().includes('swimming') && averageSpeedKmh && timeToBurnMinutes > 0 && selectedPoolLength > 0) {
      const timeToBurnHours = timeToBurnMinutes / 60;
      const distanceKm = timeToBurnHours * averageSpeedKmh;
      const distanceMeters = distanceKm * 1000;
      const targetLaps = Math.round(distanceMeters / selectedPoolLength);
      const estDistanceKmForButton = parseFloat(distanceKm.toFixed(2));
      lapsText = ` / ~${estDistanceKmForButton} km / ~${targetLaps} laps (${selectedPoolLength}m)`;
  }

  return (
    <Button
      variant="outline"
      className="w-full justify-start text-left h-auto py-3 px-4 text-sm hover:bg-secondary/50 transition-colors flex flex-col items-start"
      onClick={onClick}
      aria-label={`Start tracking ${name}`}
    >
      <div className="flex items-center w-full">
        {icon && <span className="mr-3 text-primary">{icon}</span>}
        <span className="text-foreground font-medium">{name}</span>
      </div>
      {targetCalories > 0 && timeToBurnMinutes > 0 && (
        <div className="text-xs text-muted-foreground mt-1.5 pl-1">
          <div className="flex items-center">
            <Flame className="h-3 w-3 mr-1 text-accent" /> Burn {targetCalories} kcal:
          </div>
          <div className="flex items-center mt-0.5">
            <Clock className="h-3 w-3 mr-1" /> {timeToBurnMinutes} min{distanceText}{repsText}{lapsText}
          </div>
        </div>
      )}
       {targetCalories === 0 && (
         <div className="text-xs text-muted-foreground mt-1.5 pl-1">
            Set a calorie target to see estimates.
        </div>
       )}
    </Button>
  );
};

export default function BuddyChallengeAnalysisPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [activeActivity, setActiveActivity] = useState<ActivityItem | null>(null);
  const [isTrackingDialogOpen, setIsTrackingDialogOpen] = useState(false);
  const [sessionTimeElapsed, setSessionTimeElapsed] = useState(0);
  const [isSessionPaused, setIsSessionPaused] = useState(true);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [currentTargetCalories, setCurrentTargetCalories] = useState<number>(DEFAULT_TARGET_CALORIES);
  const [selectedPoolLength, setSelectedPoolLength] = useState<number>(DEFAULT_POOL_LENGTH_METERS);

  const [showAiCameraView, setShowAiCameraView] = useState(false);
  const [hasAiCameraPermission, setHasAiCameraPermission] = useState<boolean | null>(null);
  const [isAiRecording, setIsAiRecording] = useState(false);
  const aiVideoRef = useRef<HTMLVideoElement>(null);
  const [aiCameraFacingMode, setAiCameraFacingMode] = useState<'user' | 'environment'>('environment');
  const [aiWorkoutAnalysis, setAiWorkoutAnalysis] = useState<AiWorkoutAnalysis | null>(null);
  const [isAnalyzingAiData, setIsAnalyzingAiData] = useState(false);

  const [currentTreadmillSpeed, setCurrentTreadmillSpeed] = useState<number>(7);
  const [currentTreadmillIncline, setCurrentTreadmillIncline] = useState<number>(1);

  const coreActivities: ActivityItem[] = [
    { name: 'Swimming', icon: <Waves className="h-5 w-5" />, caloriesPerMinute: 10, averageSpeedKmh: 2.0 },
    { name: 'Treadmill Workout', icon: <PersonStanding className="h-5 w-5" />, caloriesPerMinute: 10, averageSpeedKmh: 7 },
    { name: 'Skipping/Jump Rope', icon: <Zap className="h-5 w-5" />, caloriesPerMinute: 15, caloriesPerRep: 0.125, repUnit: 'skips' },
    { name: 'HIIT', icon: <Zap className="h-5 w-5" />, caloriesPerMinute: 15 },
    { name: 'Cycling', icon: <Activity className="h-5 w-5" />, caloriesPerMinute: 8, averageSpeedKmh: 20 },
    { name: 'Yoga/Stretching', icon: <Heart className="h-5 w-5" />, caloriesPerMinute: 3 },
    { name: 'Walking', icon: <PersonStanding className="h-5 w-5" />, caloriesPerMinute: 4, averageSpeedKmh: 4.5 },
  ];

  const handleActivityClick = (activity: ActivityItem) => {
    setActiveActivity(activity);
    setSessionTimeElapsed(0);
    setIsSessionPaused(true);
    setShowAiCameraView(false);
    setAiWorkoutAnalysis(null);
    setIsAiRecording(false);
    if (activity.name === 'Treadmill Workout') {
      setCurrentTreadmillSpeed(activity.averageSpeedKmh || 7);
      setCurrentTreadmillIncline(1);
    }
    setIsTrackingDialogOpen(true);
  };

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const sessionCaloriesBurned = activeActivity ? Math.round((activeActivity.caloriesPerMinute / 60) * sessionTimeElapsed) : 0;
  
  let sessionDistanceKm = 0;
  let sessionLaps = 0;
  let sessionRepsCompleted = 0;

  if (activeActivity?.name === 'Treadmill Workout') {
    sessionDistanceKm = (currentTreadmillSpeed / 3600) * sessionTimeElapsed;
  } else if (aiWorkoutAnalysis?.estimatedDistanceM) {
    sessionDistanceKm = aiWorkoutAnalysis.estimatedDistanceM / 1000;
    if (activeActivity?.name.toLowerCase().includes('swimming') && selectedPoolLength > 0) {
        sessionLaps = Math.floor(aiWorkoutAnalysis.estimatedDistanceM / selectedPoolLength);
    }
  } else if (activeActivity?.averageSpeedKmh && sessionTimeElapsed > 0) {
    sessionDistanceKm = (activeActivity.averageSpeedKmh / 3600) * sessionTimeElapsed;
    if (activeActivity.name.toLowerCase().includes('swimming') && selectedPoolLength > 0) {
      sessionLaps = Math.floor((sessionDistanceKm * 1000) / selectedPoolLength);
    }
  }

  if (aiWorkoutAnalysis?.estimatedReps) {
    sessionRepsCompleted = aiWorkoutAnalysis.estimatedReps;
  } else if (activeActivity?.caloriesPerRep && activeActivity.caloriesPerRep > 0 && sessionCaloriesBurned > 0) {
    sessionRepsCompleted = Math.round(sessionCaloriesBurned / activeActivity.caloriesPerRep);
  }
  
  let targetLapsForDialog = 0;
  if (activeActivity && activeActivity.name.toLowerCase().includes('swimming') && activeActivity.averageSpeedKmh && activeActivity.caloriesPerMinute > 0 && currentTargetCalories > 0 && selectedPoolLength > 0) {
      const timeToBurnMinutes = currentTargetCalories / activeActivity.caloriesPerMinute;
      const timeToBurnHours = timeToBurnMinutes / 60;
      const distanceKmToBurn = timeToBurnHours * activeActivity.averageSpeedKmh;
      const distanceMetersToBurn = distanceKmToBurn * 1000;
      targetLapsForDialog = Math.round(distanceMetersToBurn / selectedPoolLength);
  }

  let targetRepsForDialog: number | string = 'N/A';
    if (activeActivity?.caloriesPerRep && activeActivity.caloriesPerRep > 0 && currentTargetCalories > 0) {
        targetRepsForDialog = Math.round(currentTargetCalories / activeActivity.caloriesPerRep);
    }

  let targetDistanceForDialogKm: string | number = 'N/A';
    if (activeActivity?.averageSpeedKmh && activeActivity.caloriesPerMinute > 0 && currentTargetCalories > 0 && !(activeActivity.name.toLowerCase().includes('swimming') || (activeActivity.caloriesPerRep && activeActivity.repUnit))) {
        const timeToBurnMinutes = currentTargetCalories / activeActivity.caloriesPerMinute;
        const timeToBurnHours = timeToBurnMinutes / 60;
        const distanceKmToBurn = timeToBurnHours * activeActivity.averageSpeedKmh;
        targetDistanceForDialogKm = distanceKmToBurn.toFixed(2);
    } else if (activeActivity?.name === 'Treadmill Workout' && activeActivity.caloriesPerMinute > 0 && currentTargetCalories > 0 && activeActivity.averageSpeedKmh) {
        const timeToBurnMinutes = currentTargetCalories / activeActivity.caloriesPerMinute;
        const timeToBurnHours = timeToBurnMinutes / 60;
        const distanceKmToBurn = timeToBurnHours * (activeActivity.averageSpeedKmh);
        targetDistanceForDialogKm = distanceKmToBurn.toFixed(2);
    }

  useEffect(() => {
    if (isTrackingDialogOpen && activeActivity && !isSessionPaused && !isAiRecording) {
      sessionTimerRef.current = setInterval(() => {
        setSessionTimeElapsed(prevTime => prevTime + 1);
      }, 1000);
    } else {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }
    }
    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }
    };
  }, [isTrackingDialogOpen, activeActivity, isSessionPaused, isAiRecording]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const videoElement = aiVideoRef.current;

    if (showAiCameraView) {
        const getCameraPermission = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: aiCameraFacingMode }, audio: false });
                setHasAiCameraPermission(true);
                if (videoElement) {
                    videoElement.srcObject = stream;
                }
            } catch (error) {
                console.error('Error accessing AI camera:', error);
                setHasAiCameraPermission(false);
                toast({
                    variant: 'destructive',
                    title: 'Camera Access Denied',
                    description: 'Please enable camera permissions for AI tracking.',
                });
            }
        };
        getCameraPermission();
    } else {
        if (videoElement && videoElement.srcObject) {
            const currentStream = videoElement.srcObject as MediaStream;
            currentStream.getTracks().forEach(track => track.stop());
            videoElement.srcObject = null;
        }
        setHasAiCameraPermission(null);
    }

    return () => {
        if (videoElement && videoElement.srcObject) {
            const currentStream = videoElement.srcObject as MediaStream;
            currentStream.getTracks().forEach(track => track.stop());
        }
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    };
  }, [showAiCameraView, aiCameraFacingMode, toast]);

  const handleStartPauseSession = () => {
    if (isAiRecording) {
        setIsAiRecording(false);
        toast({ title: "AI Recording Paused", description: "Session timer also paused." });
    }
    setIsSessionPaused(prev => !prev);
  };

  const handleStopSession = () => {
    if (activeActivity) {
      const completedActivity: CompletedBuddyActivity = {
        id: `${new Date().toISOString()}-${activeActivity.name}`,
        name: activeActivity.name,
        durationSeconds: sessionTimeElapsed,
        caloriesBurned: sessionCaloriesBurned,
        timestamp: new Date().toISOString(),
        distanceKm: sessionDistanceKm > 0 ? parseFloat(sessionDistanceKm.toFixed(2)) : undefined,
        laps: activeActivity.name.toLowerCase().includes('swimming') && sessionLaps > 0 ? sessionLaps : undefined,
        poolLengthM: activeActivity.name.toLowerCase().includes('swimming') ? selectedPoolLength : undefined,
        strokeType: activeActivity.name.toLowerCase().includes('swimming') ? (aiWorkoutAnalysis?.detectedStroke || 'Freestyle') : undefined,
        aiAnalysisNotes: aiWorkoutAnalysis ? `Form: ${aiWorkoutAnalysis.formScore}, Confidence: ${aiWorkoutAnalysis.confidence?.toFixed(2)}` : undefined,
        repsCompleted: activeActivity.caloriesPerRep && sessionRepsCompleted > 0 ? sessionRepsCompleted : undefined,
        repUnit: activeActivity.caloriesPerRep ? activeActivity.repUnit : undefined,
        treadmillSpeedKmh: activeActivity.name === 'Treadmill Workout' ? currentTreadmillSpeed : undefined,
        treadmillInclinePercent: activeActivity.name === 'Treadmill Workout' ? currentTreadmillIncline : undefined,
      };

      try {
        if (typeof window !== 'undefined') {
          const existingActivitiesRaw = localStorage.getItem('fitjourney_buddy_activities');
          const existingActivities: CompletedBuddyActivity[] = existingActivitiesRaw ? JSON.parse(existingActivitiesRaw) : [];
          const updatedActivities = [...existingActivities, completedActivity];
          localStorage.setItem('fitjourney_buddy_activities', JSON.stringify(updatedActivities));
          toast({
            title: "Session Saved!",
            description: `${activeActivity.name} session: ${formatTime(sessionTimeElapsed)}, Burned: ~${sessionCaloriesBurned} kcal.`,
          });
        }
      } catch (error) {
        console.error("Error saving activity to localStorage:", error);
        toast({
          title: "Save Error",
          description: "Could not save activity session.",
          variant: "destructive"
        });
      }
    }
    setIsTrackingDialogOpen(false);
    setActiveActivity(null);
    setShowAiCameraView(false);
    setAiWorkoutAnalysis(null);
  };

  const handleSetTargetFromMealLog = () => {
    if (typeof window !== 'undefined') {
      try {
        const savedMealsRaw = localStorage.getItem('fitjourney_saved_meals');
        const loadedMeals: SavedMeal[] = savedMealsRaw ? JSON.parse(savedMealsRaw) : [];
        
        const today = startOfDay(new Date());
        const todaysMeals = loadedMeals.filter(meal => {
          try {
            return isSameDay(parseISO(meal.timestamp), today);
          } catch (e) {
            return false;
          }
        });

        if (todaysMeals.length === 0) {
          toast({
            title: "No Meals Logged Today",
            description: "No meals found in your log for today. Target remains unchanged.",
          });
          return;
        }

        const totalTodaysCalories = todaysMeals.reduce((sum, meal) => sum + meal.calories, 0);
        setCurrentTargetCalories(totalTodaysCalories);
        toast({
          title: "Target Updated!",
          description: `Activity target set to ${totalTodaysCalories} kcal based on today's meal log.`,
        });

      } catch (error) {
        console.error('Error loading meals from localStorage:', error);
        toast({
          title: "Error Loading Meals",
          description: "Could not retrieve meal log data.",
          variant: "destructive",
        });
      }
    }
  };

  const handleSetTargetFromIdealBodyPlan = () => {
    if (typeof window !== 'undefined') {
      try {
        const savedPlanRaw = localStorage.getItem('fitjourney_latest_ideal_body_plan');
        if (!savedPlanRaw) {
          toast({
            title: "No Ideal Body Plan Found",
            description: "Please generate an Ideal Body Plan first.",
            variant: "default"
          });
          return;
        }
        const savedPlan: GenerateIdealBodyPlanOutput = JSON.parse(savedPlanRaw);
        
        if (savedPlan.dietPlan && typeof savedPlan.dietPlan.dailyCalorieTarget === 'number') {
          setCurrentTargetCalories(savedPlan.dietPlan.dailyCalorieTarget);
          toast({
            title: "Target Updated!",
            description: `Activity target set to ${savedPlan.dietPlan.dailyCalorieTarget} kcal from your Ideal Body Plan.`,
          });
        } else {
          toast({
            title: "No Calorie Goal in Plan",
            description: "Your Ideal Body Plan does not have a daily calorie target specified.",
            variant: "default"
          });
        }
      } catch (error) {
        console.error('Error loading Ideal Body Plan from localStorage:', error);
        toast({
          title: "Error Loading Plan",
          description: "Could not retrieve Ideal Body Plan data.",
          variant: "destructive",
        });
      }
    }
  };

  const handleToggleAiCameraView = () => {
    if (showAiCameraView && isAiRecording) { 
      setIsAiRecording(false); 
      toast({
        title: "AI Recording Stopped",
        description: "Switched view, AI recording automatically stopped.",
      });
    } else if (!showAiCameraView) { 
        setAiWorkoutAnalysis(null); 
    }
    setShowAiCameraView(prev => !prev);
  };

  const handleFlipAiCamera = () => {
    if (aiVideoRef.current && aiVideoRef.current.srcObject) {
        const stream = aiVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        aiVideoRef.current.srcObject = null;
    }
    setAiCameraFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleStartStopAiRecording = () => {
    if (isAiRecording) {
        setIsAiRecording(false);
        setIsSessionPaused(true);
        setIsAnalyzingAiData(true);
        toast({
            title: "AI Recording Stopped",
            description: "Simulating AI analysis of your workout...",
        });
        
        setTimeout(() => {
            let estimatedDistM;
            if (activeActivity?.name === 'Treadmill Workout') {
                estimatedDistM = Math.round(((currentTreadmillSpeed * 1000) / 3600) * sessionTimeElapsed * (0.8 + Math.random()*0.4));
            } else if (activeActivity?.averageSpeedKmh) {
                estimatedDistM = Math.round(((activeActivity.averageSpeedKmh * 1000) / 3600) * sessionTimeElapsed * (0.8 + Math.random()*0.4));
            }

            const simulatedAnalysis: AiWorkoutAnalysis = {
                detectedStroke: activeActivity?.name.toLowerCase().includes('swimming') ? ["Freestyle (AI Sim)", "Breaststroke (AI Sim)"][Math.floor(Math.random()*2)] : undefined,
                estimatedDistanceM: estimatedDistM,
                estimatedReps: activeActivity?.caloriesPerRep ? Math.round(sessionTimeElapsed * (activeActivity.caloriesPerMinute / (activeActivity.caloriesPerRep || 1)) * (0.8 + Math.random()*0.4)) : undefined,
                formScore: ["Good", "Okay", "Needs Improvement"][Math.floor(Math.random() * 3)],
                confidence: Math.random() * 0.3 + 0.7,
            };
            setAiWorkoutAnalysis(simulatedAnalysis);
            setIsAnalyzingAiData(false);
            let analysisDesc = `Form: ${simulatedAnalysis.formScore}`;
            if(simulatedAnalysis.detectedStroke) analysisDesc += `, Stroke: ${simulatedAnalysis.detectedStroke}`;
            if(simulatedAnalysis.estimatedDistanceM) analysisDesc += `, Est. Dist: ${(simulatedAnalysis.estimatedDistanceM / 1000).toFixed(2)}km`;
            if(simulatedAnalysis.estimatedReps && activeActivity?.repUnit) analysisDesc += `, Est. Reps: ${simulatedAnalysis.estimatedReps} ${activeActivity.repUnit}`;
            
            toast({
                title: "AI Analysis Complete (Simulated)",
                description: analysisDesc,
            });
        }, 3000);
    } else {
        if (!hasAiCameraPermission) {
            toast({title: "Camera Permission Needed", description: "Allow camera access for AI recording.", variant: "destructive"});
            return;
        }
        setIsAiRecording(true);
        setAiWorkoutAnalysis(null);
        setIsSessionPaused(false);
        toast({
            title: "AI Recording Started",
            description: "Perform your activity. AI is 'watching'. Timer running.",
        });
    }
  };

  const adjustTreadmillSpeed = (increment: number) => {
    setCurrentTreadmillSpeed(prev => Math.max(0.5, parseFloat((prev + increment).toFixed(1))));
  };
  const adjustTreadmillIncline = (increment: number) => {
    setCurrentTreadmillIncline(prev => Math.max(0, parseFloat((prev + increment).toFixed(1))));
  };

  return (
    <div className="flex flex-col min-h-screen bg-background p-4 pb-20">
      <Link href="/" className="text-sm text-primary hover:underline absolute top-4 left-4 flex items-center z-10">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back Home
      </Link>
      <Card className="w-full max-w-4xl mx-auto shadow-lg mt-10">
        <CardHeader className="text-center">
          <PageCardDescription className="text-3xl font-bold text-primary">Buddy Challenge Activities</PageCardDescription>
          <PageCardDescription>
            Explore activities. Target: <span className="font-semibold text-accent">{currentTargetCalories} kcal</span>.
            Estimates are approximate. Click an activity to start "tracking".
          </PageCardDescription>
        </CardHeader>
        <CardContent className="space-y-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg text-primary flex items-center"><Utensils className="mr-2 h-5 w-5 text-green-500" />Meal Log Calories</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">Set target calories based on your recent meal log.</p>
                <Button variant="outline" className="w-full text-green-600 border-green-400 hover:bg-green-50" onClick={handleSetTargetFromMealLog}>
                  Use Today's Meal Log Data
                </Button>
              </CardContent>
            </Card>
            <Card className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg text-primary flex items-center"><StarIcon className="mr-2 h-5 w-5 text-yellow-500" />Ideal Body Calories</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">Align with your Ideal Body plan's calorie goals.</p>
                <Button variant="outline" className="w-full text-yellow-600 border-yellow-400 hover:bg-yellow-50" onClick={handleSetTargetFromIdealBodyPlan}>
                  Use Ideal Body Goal
                </Button>
              </CardContent>
            </Card>
            <Card className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg text-primary flex items-center"><ActivityReportIcon className="mr-2 h-5 w-5 text-blue-500" />Activity Report</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">View your completed activities and progress.</p>
                <Button variant="outline" className="w-full text-blue-600 border-blue-400 hover:bg-blue-50" onClick={() => router.push('/buddy/report')}>
                  View Report
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-xl text-accent flex items-center"><Zap className="mr-2 h-5 w-5" />Core Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {coreActivities.map((activity, index) => (
                  <ActivityButton
                    key={`core-${index}`}
                    {...activity}
                    targetCalories={currentTargetCalories}
                    selectedPoolLength={selectedPoolLength}
                    onClick={() => handleActivityClick(activity)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {activeActivity && (
        <Dialog open={isTrackingDialogOpen} onOpenChange={(isOpen) => {
            if (!isOpen) {
                if (sessionTimeElapsed > 0 && !isSessionPaused) {
                     toast({
                        title: "Session Paused",
                        description: `${activeActivity.name} tracking automatically paused.`,
                        variant: "default"
                    });
                }
                 setIsSessionPaused(true);
                 if (isAiRecording) setIsAiRecording(false); 
            }
            setIsTrackingDialogOpen(isOpen);
            if (!isOpen) setActiveActivity(null);
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                {activeActivity.icon && <span className="mr-2 text-primary">{activeActivity.icon}</span>}
                Tracking: {activeActivity.name}
              </DialogTitle>
              <DialogDescription>AI Coach View not active for this dialog.</DialogDescription>
            </DialogHeader>
            
            <div className="flex justify-center my-2">
                <Button onClick={handleToggleAiCameraView} variant="outline" size="sm">
                    {showAiCameraView ? <XCircle className="mr-2 h-4 w-4"/> : <CameraIcon className="mr-2 h-4 w-4"/>}
                    {showAiCameraView ? "Close Camera View" : "Record with AI (Sim)"}
                </Button>
            </div>

            {showAiCameraView ? (
                <div className="py-2 space-y-3">
                    <div className="relative w-full aspect-video bg-muted rounded-md overflow-hidden">
                        <video ref={aiVideoRef} className="w-full h-full object-contain" autoPlay muted playsInline />
                        {hasAiCameraPermission && (
                            <Button onClick={handleFlipAiCamera} variant="ghost" size="icon" className="absolute top-2 right-2 z-10 bg-background/50 hover:bg-background/80 p-1 rounded-full" disabled={isAiRecording || isAnalyzingAiData}>
                                <FlipCameraIcon className="h-5 w-5 text-foreground" />
                            </Button>
                        )}
                        {hasAiCameraPermission === null && !isAiRecording && <p className="absolute inset-0 flex items-center justify-center text-muted-foreground">Starting camera...</p>}
                    </div>
                    {hasAiCameraPermission === false && (
                        <Alert variant="destructive">
                            <ShieldAlert className="h-4 w-4"/>
                            <AlertTitle>Camera Access Denied</AlertTitle>
                            <AlertDescription>Enable camera permission for AI tracking.</AlertDescription>
                        </Alert>
                    )}
                    {hasAiCameraPermission && (
                        <Button onClick={handleStartStopAiRecording} variant={isAiRecording ? "destructive" : "default"} className="w-full" disabled={isAnalyzingAiData || !hasAiCameraPermission}>
                            {isAnalyzingAiData ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (isAiRecording ? <StopCircle className="mr-2 h-4 w-4" /> : <VideoIcon className="mr-2 h-4 w-4" />)}
                            {isAnalyzingAiData ? 'Analyzing...' : (isAiRecording ? 'Stop & Analyze (Sim)' : 'Start AI Recording (Sim)')}
                        </Button>
                    )}
                    {aiWorkoutAnalysis && !isAnalyzingAiData && (
                        <Card className="bg-secondary/50 p-3 text-xs space-y-1 mt-2">
                            <p><strong>AI Analysis (Simulated):</strong></p>
                            {aiWorkoutAnalysis.detectedStroke && <p className="flex items-center"><ShieldHalf className="mr-1.5 h-3 w-3 text-primary"/>Stroke: {aiWorkoutAnalysis.detectedStroke}</p>}
                            {aiWorkoutAnalysis.estimatedDistanceM !== undefined && <p className="flex items-center"><Activity className="mr-1.5 h-3 w-3 text-primary"/>Distance: {(aiWorkoutAnalysis.estimatedDistanceM / 1000).toFixed(2)} km</p>}
                            {aiWorkoutAnalysis.estimatedReps !== undefined && activeActivity.repUnit && <p className="flex items-center"><RepeatIcon className="mr-1.5 h-3 w-3 text-primary"/>Reps: {aiWorkoutAnalysis.estimatedReps} {activeActivity.repUnit}</p>}
                            {aiWorkoutAnalysis.formScore && <p className="flex items-center"><ShieldCheck className="mr-1.5 h-3 w-3 text-primary"/>Form Score: {aiWorkoutAnalysis.formScore}</p>}
                            {aiWorkoutAnalysis.confidence !== undefined && <p>Confidence: {aiWorkoutAnalysis.confidence.toFixed(2)}</p>}
                        </Card>
                    )}
                    <div className="text-center mt-2">
                         <span className="text-2xl font-mono font-bold text-primary">{formatTime(sessionTimeElapsed)}</span> /
                         <span className="text-sm font-semibold text-accent">{sessionCaloriesBurned} kcal</span>
                    </div>
                </div>
            ) : (
              <div className="py-4 space-y-3 text-sm">
                <div className="flex justify-between items-center">
                    <span className="font-medium text-muted-foreground flex items-center"><TargetIcon className="h-4 w-4 mr-1.5 text-accent"/>Target:</span>
                    <span className="font-semibold text-accent">{currentTargetCalories} kcal</span>
                </div>
                {activeActivity.name.toLowerCase().includes('swimming') && (
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground"></span>
                        <span className="font-semibold text-accent">/ {targetLapsForDialog} laps ({selectedPoolLength}m)</span>
                    </div>
                )}
                {activeActivity.caloriesPerRep && activeActivity.repUnit && (
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground"></span>
                        <span className="font-semibold text-accent">/ {targetRepsForDialog} {activeActivity.repUnit}</span>
                    </div>
                )}
                {activeActivity.averageSpeedKmh && !activeActivity.caloriesPerRep && !activeActivity.name.toLowerCase().includes('swimming') && (
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground"></span>
                        <span className="font-semibold text-accent">/ {targetDistanceForDialogKm} km</span>
                    </div>
                )}
                
                {activeActivity.name.toLowerCase().includes('swimming') && (
                  <>
                    <div className="space-y-1 mb-3">
                        <Label htmlFor="pool-length-select">Pool Length</Label>
                        <Select
                        value={String(selectedPoolLength)}
                        onValueChange={(value) => setSelectedPoolLength(Number(value))}
                        disabled={!isSessionPaused || sessionTimeElapsed > 0 || isAiRecording}
                        >
                        <SelectTrigger id="pool-length-select" className="w-full">
                            <SelectValue placeholder="Select pool length" />
                        </SelectTrigger>
                        <SelectContent>
                            {poolLengthOptions.map(option => (
                            <SelectItem key={option.value} value={String(option.value)}>
                                {option.label}
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        {(!isSessionPaused || sessionTimeElapsed > 0 || isAiRecording) && (
                            <p className="text-xs text-muted-foreground">Pool length cannot be changed during an active or AI recording session.</p>
                        )}
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-muted-foreground flex items-center"><Waves className="h-4 w-4 mr-1.5"/>Distance Swum:</span>
                        <span className="font-semibold">
                            {sessionDistanceKm.toFixed(2)} km ({aiWorkoutAnalysis?.estimatedDistanceM ? "AI Est." : "Time Est."})
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-muted-foreground flex items-center"><Activity className="h-4 w-4 mr-1.5"/>Laps Completed:</span>
                        <span className="font-semibold">
                            {sessionLaps} laps ({selectedPoolLength}m pool)
                        </span>
                    </div>
                  </>
                )}

                {activeActivity.name === 'Treadmill Workout' && (
                  <>
                    <div className="space-y-1">
                        <Label className="text-sm font-medium text-muted-foreground flex items-center"><Gauge className="h-4 w-4 mr-1.5"/>Speed</Label>
                        <div className="flex items-center justify-between">
                            <Button variant="outline" size="icon" onClick={() => adjustTreadmillSpeed(-0.5)} disabled={!isSessionPaused || isAiRecording}><MinusCircle className="h-5 w-5"/></Button>
                            <span className="font-semibold text-lg mx-2">{currentTreadmillSpeed.toFixed(1)} km/h</span>
                            <Button variant="outline" size="icon" onClick={() => adjustTreadmillSpeed(0.5)} disabled={!isSessionPaused || isAiRecording}><PlusCircle className="h-5 w-5"/></Button>
                        </div>
                    </div>
                     <div className="space-y-1">
                        <Label className="text-sm font-medium text-muted-foreground flex items-center"><TrendingUp className="h-4 w-4 mr-1.5"/>Incline</Label>
                        <div className="flex items-center justify-between">
                            <Button variant="outline" size="icon" onClick={() => adjustTreadmillIncline(-0.5)} disabled={!isSessionPaused || isAiRecording}><MinusCircle className="h-5 w-5"/></Button>
                            <span className="font-semibold text-lg mx-2">{currentTreadmillIncline.toFixed(1)} %</span>
                            <Button variant="outline" size="icon" onClick={() => adjustTreadmillIncline(0.5)} disabled={!isSessionPaused || isAiRecording}><PlusCircle className="h-5 w-5"/></Button>
                        </div>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="font-medium text-muted-foreground flex items-center"><Activity className="h-4 w-4 mr-1.5"/>Distance Covered:</span>
                        <span className="font-semibold">{sessionDistanceKm.toFixed(2)} km (Speed Est.)</span>
                    </div>
                  </>
                )}
                
                {activeActivity.caloriesPerRep && activeActivity.repUnit && !activeActivity.name.toLowerCase().includes('swimming') && (
                     <div className="flex justify-between items-center">
                        <span className="font-medium text-muted-foreground flex items-center"><RepeatIcon className="h-4 w-4 mr-1.5"/>Session {activeActivity.repUnit} (Est.):</span>
                         <span className="font-semibold">{sessionRepsCompleted} ({aiWorkoutAnalysis?.estimatedReps ? "AI Est." : "Calorie Est."})</span>
                    </div>
                )}
                
                {activeActivity.averageSpeedKmh && !activeActivity.caloriesPerRep && !activeActivity.name.toLowerCase().includes('swimming') && activeActivity.name !== 'Treadmill Workout' && ( 
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-muted-foreground flex items-center"><Activity className="h-4 w-4 mr-1.5"/>Distance Covered:</span>
                        <span className="font-semibold">
                            {sessionDistanceKm.toFixed(2)} km ({aiWorkoutAnalysis?.estimatedDistanceM ? "AI Est." : "Time Est."})
                        </span>
                    </div>
                )}
                
                <div className="flex justify-between items-center pt-2 border-t mt-2">
                    <span className="font-medium text-muted-foreground flex items-center"><Clock className="h-4 w-4 mr-1.5"/>Time:</span>
                    <span className="text-2xl font-mono font-bold text-primary">{formatTime(sessionTimeElapsed)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="font-medium text-muted-foreground flex items-center"><Flame className="h-4 w-4 mr-1.5 text-accent"/>Calories Burned:</span>
                    <span className="font-semibold text-accent">{sessionCaloriesBurned} kcal</span>
                </div>

                {activeActivity.name.toLowerCase().includes('swimming') && aiWorkoutAnalysis?.detectedStroke && (
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-muted-foreground flex items-center"><ShieldHalf className="h-4 w-4 mr-1.5"/>Stroke Type:</span>
                        <span className="font-semibold">{aiWorkoutAnalysis.detectedStroke}</span>
                    </div>
                )}
                {aiWorkoutAnalysis?.formScore && (
                     <div className="flex justify-between items-center">
                        <span className="font-medium text-muted-foreground flex items-center"><ShieldCheck className="h-4 w-4 mr-1.5"/>Form Score:</span>
                        <span className="font-semibold">{aiWorkoutAnalysis.formScore} (AI Sim)</span>
                    </div>
                )}
                 {!activeActivity.name.toLowerCase().includes('swimming') && !activeActivity.caloriesPerRep && !activeActivity.averageSpeedKmh && activeActivity.name !== 'Treadmill Workout' && aiWorkoutAnalysis?.estimatedDistanceM && (
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-muted-foreground flex items-center"><Activity className="h-4 w-4 mr-1.5"/>AI Est. Movement:</span>
                        <span className="font-semibold">{(aiWorkoutAnalysis.estimatedDistanceM / 1000).toFixed(2)} km</span>
                    </div>
                )}
                </div>
            )}

            <DialogFooter className="sm:justify-center space-x-2">
              <Button
                variant={isSessionPaused ? "default" : "outline"}
                onClick={handleStartPauseSession}
                className="w-24"
                disabled={isAnalyzingAiData || (showAiCameraView && isAiRecording && isSessionPaused) || (isAiRecording && !isSessionPaused)} 
              >
                {isSessionPaused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                {isSessionPaused ? (sessionTimeElapsed > 0 ? "Resume" : "Start") : "Pause"}
              </Button>
              <Button
                variant="destructive"
                onClick={handleStopSession}
                className="w-24"
                disabled={(sessionTimeElapsed === 0 && isSessionPaused) || isAiRecording || isAnalyzingAiData}
              >
                <StopCircle className="mr-2 h-4 w-4" />
                Stop
              </Button>
            </DialogFooter>
            <DialogClose asChild>
                <button className="hidden"></button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
