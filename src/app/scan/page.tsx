
'use client';

import React, { useState, ChangeEvent, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Camera, Upload, Sparkles, ArrowLeft, CircleDot, Utensils, Scale, Package, Save, RefreshCcw, Info, Edit3, CheckCircle, CalendarDays, Dumbbell, ListChecks, Trash2, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { runFoodInference, loadFoodModel, FoodInferenceResult } from '@/lib/food-engine';
import { useToast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';
import { format, parseISO, startOfDay, subDays, isWithinInterval } from 'date-fns';

interface WoundEntry { id: string; date: string; analysis?: { analysisType: 'wound' | 'document' | 'unclear', description: string } }
interface PeriodDay { date: string; notes?: string }

function dataURLtoFile(dataurl: string, filename: string): File | null {
    const arr = dataurl.split(',');
    if (arr.length < 2) return null;
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const bstr = atob(arr[arr.length - 1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

interface IngredientDetail {
  name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
}

interface SavedMeal {
  foodName: string;
  calories: number;
  timestamp: string;
  imageUrl?: string;
  ingredientsBreakdown?: IngredientDetail[];
  dietaryClassification?: string[];
  healthSummary?: string;
  nutritionalScore?: number;
}

export default function CalorieScannerPage() {
  const [foodImageFile, setFoodImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [nutritionInfo, setNutritionInfo] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [showCamera, setShowCamera] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const [recentWoundInfo, setRecentWoundInfo] = useState<any>(undefined);
  const [calmCycleInfo, setCalmCycleInfo] = useState<any>(undefined);

  const [isEditingMealInfo, setIsEditingMealInfo] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [editableFoodName, setEditableFoodName] = useState('');
  const [editableQuantity, setEditableQuantity] = useState('');
  const [editableEstimatedWeight, setEditableEstimatedWeight] = useState('');
  const [editableIngredients, setEditableIngredients] = useState<IngredientDetail[]>([]);
  
  // Top-K and Portion State
  const [topPredictions, setTopPredictions] = useState<FoodInferenceResult[]>([]);
  const [selectedPredictionIndex, setSelectedPredictionIndex] = useState<number | null>(null);
  const [portionSize, setPortionSize] = useState<'small' | 'regular' | 'large'>('regular');
  const [isOtherSelected, setIsOtherSelected] = useState(false);

  useEffect(() => {
    // NOTE: Model loads lazily on first Analyze click â€” NOT here.
    // Preloading a 41MB model on mount causes PC lag and unnecessary bandwidth.

    if (typeof window !== 'undefined') {
      const savedWoundEntriesRaw = localStorage.getItem('fitjourney_wound_entries');
      if (savedWoundEntriesRaw) {
        const woundEntries: WoundEntry[] = JSON.parse(savedWoundEntriesRaw);
        if (woundEntries.length > 0) {
          const latestEntry = woundEntries.sort((a,b) => parseISO(b.date).getTime() - new Date(a.date).getTime())[0];
          const sevenDaysAgo = subDays(new Date(), 7);
          if (latestEntry.analysis && isWithinInterval(parseISO(latestEntry.date), {start: sevenDaysAgo, end: new Date()})) {
            setRecentWoundInfo({ analysisType: latestEntry.analysis.analysisType, description: latestEntry.analysis.description });
          }
        }
      }

      const periodDaysRaw = localStorage.getItem('fitjourney_period_days');
      if (periodDaysRaw) {
        const periodDays: PeriodDay[] = JSON.parse(periodDaysRaw);
        const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
        const todayPeriodEntry = periodDays.find(p => p.date === todayStr);
        setCalmCycleInfo({ isPeriodDayToday: !!todayPeriodEntry, periodDayNotes: todayPeriodEntry?.notes });
      }
    }
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const videoElement = videoRef.current;

    if (showCamera) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode } })
        .then(s => {
          stream = s; setHasCameraPermission(true);
          if (videoElement) videoElement.srcObject = stream;
        })
        .catch(() => {
          setHasCameraPermission(false); setShowCamera(false);
          toast({ variant: 'destructive', title: 'Camera Access Denied', description: 'Enable camera in settings.' });
        });
    }
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, [showCamera, facingMode, toast]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    setPreviewUrl(dataUrl);
    setFoodImageFile(dataURLtoFile(dataUrl, `food-${Date.now()}.jpg`));
    setShowCamera(false);
  };

  const handleScan = async () => {
    if (!previewUrl && !isManualMode) return;
    setIsLoading(true);
    setError(null);
    setTopPredictions([]);
    setSelectedPredictionIndex(null);
    setIsOtherSelected(false);

    try {
      // 1. Run Proprietary Local Engine
      const results = await runFoodInference(previewUrl!);
      
      if (results && results.length > 0) {
        setTopPredictions(results);
        setSelectedPredictionIndex(0); // Default to top match
        
        const topMatch = results[0];
        const mappedResult: any = {
          foodName: topMatch.className,
          calories: topMatch.nutrients.calories,
          ingredientsBreakdown: [
            {
              name: topMatch.className,
              calories: topMatch.nutrients.calories,
              protein: topMatch.nutrients.protein,
              carbs: topMatch.nutrients.carbs,
              fats: topMatch.nutrients.fats
            }
          ],
          nutritionalScore: topMatch.confidence > 0.7 ? 10 : 8,
          healthSummary: `Identified using WorkoutFood Engine V2. Confidence: ${Math.round(topMatch.confidence * 100)}%`,
          dietaryClassification: (topMatch.nutrients.protein > 20) ? ['High Protein'] : ['Standard'],
        };
        
        setNutritionInfo(mappedResult);
        setEditableFoodName(mappedResult.foodName);
        setEditableIngredients(mappedResult.ingredientsBreakdown || []);
      } else {
        // Fallback or manual entry if no results
        setError("No clear matches found. Please enter dish name manually.");
        setIsManualMode(true);
      }
    } catch (err: any) {
      setError(err.message || "Scan failed.");
      toast({ variant: 'destructive', title: 'Scanner Error', description: 'Local engine failed to load or run.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveMeal = () => {
    if (!nutritionInfo) return;
    const multiplier = portionSize === 'small' ? 0.5 : portionSize === 'large' ? 1.5 : 1.0;
    const totalCal = Math.round(editableIngredients.reduce((s, i) => s + (i.calories || 0), 0) * multiplier);
    
    const saved = { 
      ...nutritionInfo, 
      foodName: editableFoodName, 
      calories: totalCal, 
      timestamp: new Date().toISOString(), 
      imageUrl: previewUrl,
      portionSize
    };
    
    // 1. Save to regular meal history
    const prevMeals = JSON.parse(localStorage.getItem('fitjourney_saved_meals') || '[]');
    localStorage.setItem('fitjourney_saved_meals', JSON.stringify([saved, ...prevMeals]));
    
    // 2. SILENT TRAINING: Log the correction for future model fine-tuning
    const trainingEntry = {
      timestamp: new Date().toISOString(),
      originalPredictions: topPredictions.map(p => ({ name: p.className, conf: p.confidence })),
      userCorrection: editableFoodName,
      wasOther: isOtherSelected,
      portion: portionSize,
      imageRef: previewUrl?.substring(0, 50) + '...' // Data URI is too big for log, just a ref
    };
    const prevTraining = JSON.parse(localStorage.getItem('fitjourney_training_data') || '[]');
    localStorage.setItem('fitjourney_training_data', JSON.stringify([trainingEntry, ...prevTraining]));

    toast({ title: 'Meal Saved!', description: 'Your progress has been recorded.' });
    setNutritionInfo(null); 
    setPreviewUrl(null);
    setTopPredictions([]);
  };

  const selectPrediction = (index: number) => {
    const p = topPredictions[index];
    setSelectedPredictionIndex(index);
    setIsOtherSelected(false);
    setEditableFoodName(p.className);
    setEditableIngredients([{
      name: p.className,
      calories: p.nutrients.calories,
      protein: p.nutrients.protein,
      carbs: p.nutrients.carbs,
      fats: p.nutrients.fats
    }]);
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-background p-4 pb-20">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <div className="relative flex items-center justify-center">
            <Link href="/" className="absolute left-0 top-1/2 -translate-y-1/2 text-sm text-primary hover:underline flex items-center">
              <ArrowLeft className="h-4 w-4 mr-1" /> Home
            </Link>
            <CardTitle className="text-2xl font-bold text-primary">Meal Scanner</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-center">
             {previewUrl && !showCamera ? (
                <Image src={previewUrl} alt="Food Preview" width={300} height={200} className="rounded-md object-cover mx-auto mb-4 border" />
              ) : !showCamera && !isManualMode ? (
                 <div className="w-full h-48 bg-secondary rounded-md flex flex-col items-center justify-center border border-dashed cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                     <Camera className="h-12 w-12 text-muted-foreground mb-2" />
                     <p className="text-muted-foreground">Select or take photo</p>
                 </div>
              ) : null }

            {showCamera && (
             <div className="relative w-full aspect-video">
                <video ref={videoRef} className="w-full h-full rounded-md border bg-muted" autoPlay muted playsInline />
                <Button onClick={capturePhoto} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-500 rounded-full h-12 w-12 p-0 shadow-lg"><CircleDot /></Button>
                <Button onClick={() => setShowCamera(false)} variant="ghost" className="absolute top-2 right-2 bg-black/20 text-white">Cancel</Button>
            </div>
           )}

            <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                const r = new FileReader();
                r.onloadend = () => setPreviewUrl(r.result as string);
                r.readAsDataURL(f);
              }
            }} className="hidden" />

            <canvas ref={canvasRef} className="hidden" />
            
            {!showCamera && !previewUrl && (
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => fileInputRef.current?.click()} variant="outline"><Upload className="mr-2 h-4 w-4" /> Upload</Button>
                <Button onClick={() => setShowCamera(true)} variant="outline"><Camera className="mr-2 h-4 w-4" /> Take</Button>
              </div>
            )}
          </div>

          {previewUrl && !nutritionInfo && !isLoading && (
            <Button onClick={handleScan} className="w-full bg-accent hover:bg-accent/90"><Sparkles className="mr-2 h-4 w-4" /> Analyze with AI</Button>
          )}

          {isLoading && <div className="text-center py-4"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /><p className="text-xs text-muted-foreground mt-2">Analyzing food... (first scan loads AI model ~5s)</p></div>}


          {nutritionInfo && (
            <div className="space-y-4 pt-4 border-t animate-in fade-in slide-in-from-bottom-2">
              
              {/* Top-5 Match Selector */}
              {topPredictions.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center">
                     <Utensils className="h-3 w-3 mr-1" /> Is this what you're eating?
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {topPredictions.map((pred, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectPrediction(idx)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          selectedPredictionIndex === idx && !isOtherSelected
                            ? 'bg-primary text-primary-foreground scale-105 shadow-md'
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        }`}
                      >
                        {pred.className}
                      </button>
                    ))}
                    <button
                      onClick={() => { setIsOtherSelected(true); setSelectedPredictionIndex(null); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isOtherSelected
                          ? 'bg-accent text-accent-foreground scale-105 shadow-md'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                    >
                      Something Else
                    </button>
                  </div>
                </div>
              )}

              {/* Portion Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center">
                  <Scale className="h-3 w-3 mr-1" /> Portion Size
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['small', 'regular', 'large'] as const).map((size) => (
                    <Button
                      key={size}
                      variant={portionSize === size ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPortionSize(size)}
                      className="capitalize text-xs"
                    >
                      {size === 'small' ? 'Small/Piece' : size === 'regular' ? 'Regular/Bowl' : 'Large/Plate'}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Dish Name {isOtherSelected && <span className="text-accent font-bold">(Manual Entry)</span>}</Label>
                <div className="relative">
                  <Input 
                    value={editableFoodName} 
                    onChange={(e) => setEditableFoodName(e.target.value)} 
                    className={isOtherSelected ? 'border-accent ring-1 ring-accent' : ''}
                  />
                  {isOtherSelected && <Edit3 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent" />}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-secondary/50 p-4 rounded-xl border border-border/50">
                <div className="text-center group">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Est. Calories</p>
                  <p className="text-2xl font-black text-primary">
                    {Math.round(editableIngredients.reduce((s,i)=>s+(i.calories||0),0) * (portionSize === 'small' ? 0.5 : portionSize === 'large' ? 1.5 : 1.0))}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Est. Protein</p>
                  <p className="text-2xl font-black text-primary">
                    {Math.round(editableIngredients.reduce((s,i)=>s+(i.protein||0),0) * (portionSize === 'small' ? 0.5 : portionSize === 'large' ? 1.5 : 1.0))}g
                  </p>
                </div>
              </div>

              <Button onClick={handleSaveMeal} className="w-full bg-primary hover:bg-primary/90 h-12 text-lg font-bold shadow-lg">
                <Save className="mr-2 h-5 w-5" /> Save to Progress
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
