
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Utensils, Sparkles, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, addDays, subDays, getHours } from 'date-fns';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface SavedMeal {
  foodName: string;
  quantity?: string;
  estimatedWeight?: string;
  calories: number;
  protein: number;
  vitamins?: string;
  timestamp: string;
  imageUrl?: string;
}

type MealCategory = 'Breakfast' | 'Brunch' | 'Lunch' | 'Dinner' | 'Sip & Snack';
const mealCategories: MealCategory[] = ['Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Sip & Snack'];

const categoryColors: Record<MealCategory, string> = {
    'Breakfast': 'bg-pink-200 text-pink-800',
    'Brunch': 'bg-orange-200 text-orange-800',
    'Lunch': 'bg-blue-200 text-blue-800',
    'Dinner': 'bg-green-200 text-green-800',
    'Sip & Snack': 'bg-purple-200 text-purple-800',
};

const dayHeaderColors = [
    'bg-pink-300',
    'bg-orange-300',
    'bg-cyan-300',
    'bg-yellow-300',
    'bg-teal-300',
    'bg-rose-300',
    'bg-lime-300',
];

const ESTIMATED_DAILY_WORK_CALORIES = 250;

const getMealCategory = (timestamp: string, foodName: string): MealCategory => {
  const hour = getHours(parseISO(timestamp));
  if (hour >= 6 && hour < 10) return 'Breakfast';
  if (hour >= 10 && hour < 12) return 'Brunch';
  if (hour >= 12 && hour < 16) return 'Lunch';
  if (hour >= 16 && hour < 21) return 'Dinner';
  return 'Sip & Snack';
};

export default function ProgressPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [allMeals, setAllMeals] = useState<SavedMeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 0 }), [currentDate]);
  const weekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 0 }), [currentDate]);
  const daysInWeek = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedMealsRaw = localStorage.getItem('fitjourney_saved_meals');
        setAllMeals(savedMealsRaw ? JSON.parse(savedMealsRaw) : []);
      } catch (error) {
        console.error('Error loading meals:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  const weekMeals = useMemo(() => {
    const summarized: Record<string, Record<MealCategory, SavedMeal[]>> = {};
    daysInWeek.forEach(day => {
      summarized[format(day, 'yyyy-MM-dd')] = {
        'Breakfast': [], 'Brunch': [], 'Lunch': [], 'Dinner': [], 'Sip & Snack': [],
      };
    });

    allMeals.filter(meal => {
      const d = parseISO(meal.timestamp);
      return d >= weekStart && d <= weekEnd;
    }).forEach(meal => {
      const dStr = format(parseISO(meal.timestamp), 'yyyy-MM-dd');
      const cat = getMealCategory(meal.timestamp, meal.foodName);
      if (summarized[dStr]) summarized[dStr][cat].push(meal);
    });
    return summarized;
  }, [allMeals, daysInWeek, weekStart, weekEnd]);

  const dailyTotals = useMemo(() => {
      const totals: Record<string, number> = {};
      daysInWeek.forEach(day => {
          const dStr = format(day, 'yyyy-MM-dd');
          let dailyCal = 0;
          if (weekMeals[dStr]) {
              Object.values(weekMeals[dStr]).forEach(meals => meals.forEach(m => dailyCal += m.calories));
          }
          totals[dStr] = Math.max(0, Math.round(dailyCal) - ESTIMATED_DAILY_WORK_CALORIES);
      });
      return totals;
  }, [weekMeals, daysInWeek]);

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin h-8 w-8" /></div>;

  return (
    <div className="flex flex-col items-center min-h-screen bg-background p-4 pb-20">
      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader>
          <div className="relative flex items-center justify-center">
             <Link href="/" className="absolute left-0 top-1/2 -translate-y-1/2 text-sm text-primary hover:underline flex items-center">
                 <ArrowLeft className="h-4 w-4 mr-1" /> Back Home
             </Link>
            <CardTitle className="text-center text-2xl font-bold text-primary">Weekly Meal Log</CardTitle>
          </div>
           <CardDescription className="text-center pt-2 flex items-center justify-center space-x-4">
             <Button variant="outline" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 7))}><ChevronLeft className="h-4 w-4" /></Button>
             <span className="font-medium">{format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}</span>
             <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}><ChevronRight className="h-4 w-4" /></Button>
           </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="grid grid-cols-[auto_repeat(7,minmax(100px,1fr))] gap-1 border rounded-lg p-1 bg-muted/30">
            <div className="sticky left-0 z-10 bg-background"></div>
            {daysInWeek.map((day, index) => (
               <div key={`day-${index}`} className={cn("font-semibold text-center p-2 rounded text-sm text-white", dayHeaderColors[index % dayHeaderColors.length])}>
                 {format(day, 'EEE')} <span className="block text-xs font-normal">{format(day, 'd')}</span>
               </div>
            ))}
            {mealCategories.map((category) => (
               <React.Fragment key={category}>
                 <div className={cn("sticky left-0 font-semibold p-2 rounded text-sm flex items-center justify-center text-center h-full z-10 text-white min-w-[80px]", categoryColors[category])}>
                   {category}
                 </div>
                {daysInWeek.map(day => {
                  const dStr = format(day, 'yyyy-MM-dd');
                  const meals = weekMeals[dStr]?.[category] || [];
                  return (
                    <div key={`${dStr}-${category}`} className="border rounded-md p-1.5 bg-background min-h-[100px] flex flex-col">
                        <ScrollArea className="h-[100px] w-full">
                           <div className="space-y-1.5 h-full p-1">
                            {meals.length === 0 ? (
                               <span className="text-xs text-muted-foreground m-auto flex items-center justify-center h-full">Empty</span>
                            ) : (
                                meals.map((meal, idx) => (
                                  <div key={idx} className="text-xs border-l-2 pl-1.5 border-primary/50">
                                    <p className="font-medium text-primary text-[11px] leading-tight truncate">{meal.foodName}</p>
                                    <p className="text-muted-foreground text-[10px]">{meal.calories} kcal</p>
                                  </div>
                                ))
                            )}
                          </div>
                         <ScrollBar orientation="vertical" />
                       </ScrollArea>
                    </div>
                  );
                })}
               </React.Fragment>
            ))}
             <div className="sticky left-0 font-semibold p-2 rounded text-sm flex items-center justify-center text-center h-full z-10 bg-slate-500 text-white">Net Cal</div>
             {daysInWeek.map(day => {
                const dStr = format(day, 'yyyy-MM-dd');
                const netCal = dailyTotals[dStr] || 0;
                return (
                    <div key={`${dStr}-summary`} className="border rounded-md p-2 bg-secondary min-h-[100px] flex flex-col justify-center items-center space-y-1">
                        <p className="font-bold text-sm text-primary">{netCal} kcal</p>
                        {netCal > 0 ? (
                            <Button variant="outline" size="sm" className="w-full text-[10px] h-auto p-1 mt-1" onClick={() => router.push(`/track?calories=${netCal}`)}>
                                <Sparkles className="mr-1 h-3 w-3 text-accent" /> Let's Burn!
                            </Button>
                        ) : <Badge variant="default" className="text-[10px] bg-green-500 text-white">Goal Met</Badge>}
                    </div>
                )
             })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Loader2 } from 'lucide-react';
