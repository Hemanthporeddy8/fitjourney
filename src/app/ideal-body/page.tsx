
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Scale, Sparkles, Loader2, Info, Repeat } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { aiEngine, type IdealBodyPlanResult } from '@/lib/ai-engine';

const LOCAL_STORAGE_KEY_PLAN = 'fitjourney_latest_ideal_body_plan';

export default function IdealBodyPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [plan, setPlan] = useState<IdealBodyPlanResult | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedPlan = localStorage.getItem(LOCAL_STORAGE_KEY_PLAN);
            if (savedPlan) {
                setPlan(JSON.parse(savedPlan));
            }
        }
    }, []);

    const handleGeneratePlan = async () => {
        setIsLoading(true);
        try {
            // Read real profile data saved by the Profile page
            let weightKg = 70;
            let heightCm = 175;
            let age      = 30;
            let gender: 'male' | 'female' | 'other' = 'male';
            let goal: 'weight_loss' | 'muscle_gain' | 'maintenance' = 'muscle_gain';
            let activityLevel: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' = 'moderately_active';

            if (typeof window !== 'undefined') {
                const raw = localStorage.getItem('fitjourney_profile_data');
                if (raw) {
                    const p = JSON.parse(raw);
                    weightKg      = parseFloat(p.weightKg)      || weightKg;
                    heightCm      = parseFloat(p.heightCm)      || heightCm;
                    age           = parseInt(p.age)             || age;
                    gender        = (p.gender === 'female' ? 'female' : 'male');
                    goal          = p.goal          || goal;
                    activityLevel = p.activityLevel || activityLevel;
                }
            }

            const result = await aiEngine.calculateIdealBodyPlan({
                weightKg,
                heightCm,
                age,
                gender,
                goal,
                activityLevel
            });
            
            setPlan(result);
            if (typeof window !== 'undefined') {
                localStorage.setItem(LOCAL_STORAGE_KEY_PLAN, JSON.stringify(result));
            }
            toast({
                title: "Plan Calculated!",
                description: "Your Blueprint is ready based on metabolic math.",
            });
        } catch (error) {
            console.error("Error calculating plan:", error);
            toast({
                title: "Calculation Failed",
                description: "Could not process metrics.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const renderPlan = () => {
        if (!plan) return null;

        return (
            <Card className="mt-4 text-left">
                <CardHeader>
                    <CardTitle className="text-xl text-primary">{plan.planTitle}</CardTitle>
                    <CardDescription>{plan.planSummary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    {plan.dietPlan && (
                        <div>
                            <h3 className="font-semibold mb-2">Dietary Targets (Daily)</h3>
                            <div className="p-3 rounded-md bg-secondary space-y-1">
                                <p><strong>Target:</strong> {plan.dietPlan.dailyCalorieTarget} kcal</p>
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    <div className="bg-background p-2 rounded text-center border">
                                        <p className="text-[10px] text-muted-foreground">Protein</p>
                                        <p className="font-bold">{plan.dietPlan.macronutrientSplit.proteinGrams}g</p>
                                    </div>
                                    <div className="bg-background p-2 rounded text-center border">
                                        <p className="text-[10px] text-muted-foreground">Carbs</p>
                                        <p className="font-bold">{plan.dietPlan.macronutrientSplit.carbsGrams}g</p>
                                    </div>
                                    <div className="bg-background p-2 rounded text-center border">
                                        <p className="text-[10px] text-muted-foreground">Fats</p>
                                        <p className="font-bold">{plan.dietPlan.macronutrientSplit.fatsGrams}g</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                     {plan.workoutPlan && (
                        <div>
                            <h3 className="font-semibold mb-2">Training Focus</h3>
                            <div className="p-3 rounded-md bg-secondary space-y-2">
                                <p><strong>Frequency:</strong> {plan.workoutPlan.frequencyPerWeek}</p>
                                <p><strong>Focus:</strong> {plan.workoutPlan.focus}</p>
                                <p><strong>Samples:</strong></p>
                                <ul className="list-disc list-inside pl-4">
                                    {plan.workoutPlan.sampleExercises.map((ex, i) => <li key={i}>{ex}</li>)}
                                </ul>
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                            Metrics calculated via Mifflin-St Jeor formula. Consult a professional for medical advice.
                        </AlertDescription>
                    </Alert>
                </CardFooter>
            </Card>
        );
    };

  return (
    <div className="flex flex-col min-h-screen bg-background p-4 pb-20">
      <Link href="/" className="text-sm text-primary hover:underline absolute top-4 left-4 flex items-center z-10">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back Home
      </Link>
      <Card className="w-full max-w-2xl mx-auto shadow-lg mt-10">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary flex items-center justify-center">
            <Scale className="mr-2 h-7 w-7" /> Ideal Body Plan
          </CardTitle>
          <CardDescription>Math-driven diet & workout blueprints.</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground text-sm">
                We use deterministic formulas (BMR & TDEE) to build your plan. No generic AI guesses.
            </p>
            <Button onClick={handleGeneratePlan} disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {isLoading ? "Calculating..." : "Generate My Blueprint"}
            </Button>
            {plan && (
                <Button onClick={handleGeneratePlan} variant="outline" disabled={isLoading} className="w-full">
                    <Repeat className="mr-2 h-4 w-4" />
                    Recalculate
                </Button>
            )}

            {renderPlan()}
        </CardContent>
      </Card>
    </div>
  );
}
