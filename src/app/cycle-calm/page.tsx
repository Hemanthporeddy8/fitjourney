
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Flower2, Apple, HeartHandshake } from 'lucide-react';
import { format, parseISO, startOfDay } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { aiEngine } from '@/lib/ai-engine';
import { Badge } from '@/components/ui/badge';

// Lazy load heavy Calendar component
const Calendar = dynamic(() => import("@/components/ui/calendar").then(mod => mod.Calendar), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-muted animate-pulse rounded-md border" />
});

interface PeriodDay {
  date: string;
  notes?: string;
}

export default function CalmCyclePage() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [periodDays, setPeriodDays] = useState<PeriodDay[]>([]);
  const [suggestions, setSuggestions] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFemale, setIsFemale] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fitjourney_period_days');
      if (saved) setPeriodDays(JSON.parse(saved));

      const profileRaw = localStorage.getItem('fitjourney_profile');
      if (profileRaw) {
        const profile = JSON.parse(profileRaw);
        setIsFemale(profile.gender === 'female');
      } else {
        setIsFemale(false);
      }
    }
  }, []);

  const isPeriodDaySelected = useMemo(() => {
    if (!selectedDate) return false;
    const dateStr = format(startOfDay(selectedDate), 'yyyy-MM-dd');
    return periodDays.some(pd => pd.date === dateStr);
  }, [selectedDate, periodDays]);

  const fetchAdvice = async () => {
    setIsLoading(true);
    const result = await aiEngine.getCycleComfortPlan(isPeriodDaySelected);
    setSuggestions(result);
    setIsLoading(false);
  };

  if (isFemale === false) {
    return (
      <div className="flex flex-col min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CardTitle>Access Restricted</CardTitle>
            <CardDescription>Calm Cycle is a specialized tool for menstrual cycle tracking. Please update your gender in your profile to access this feature.</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button asChild variant="outline">
              <Link href="/profile">Go to Profile</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-pink-50/30 p-4 pb-20">
      <Link href="/healmap" className="text-sm text-pink-600 hover:text-pink-800 absolute top-4 left-4 flex items-center z-10">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to HealMap
      </Link>
      <Card className="w-full max-w-3xl mx-auto shadow-lg mt-10 border-pink-200">
        <CardHeader className="text-center bg-pink-100 rounded-t-lg py-4">
          <CardTitle className="text-3xl font-bold text-pink-700 flex items-center justify-center">
            <Flower2 className="mr-2 h-8 w-8" /> Calm Cycle
          </CardTitle>
          <CardDescription>Rules-based comfort protocols.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border border-pink-200 bg-white"
                    modifiers={{ marked: periodDays.map(pd => parseISO(pd.date)) }}
                    modifiersStyles={{ marked: { backgroundColor: 'hsl(var(--primary))', color: 'white' } }}
                />
                <Button onClick={fetchAdvice} className="w-full bg-teal-500 hover:bg-teal-600 text-white" disabled={isLoading}>
                    {isLoading ? "Consulting Engine..." : "Get Protocol Advice"}
                </Button>
            </div>

            <div className="space-y-4">
              {suggestions && (
                <Card className="border-pink-200 shadow-sm bg-white">
                  <CardHeader className="bg-pink-50 pb-3">
                    <CardTitle className="text-lg text-pink-700">Protocol Details</CardTitle>
                    <Badge className="bg-pink-500">{suggestions.positiveAffirmation}</Badge>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-sm">
                    <div>
                        <h4 className="font-semibold text-pink-600 flex items-center mb-1"><Apple className="mr-2 h-4 w-4"/>Foods:</h4>
                        <ul className="list-disc list-inside text-gray-700">
                          {suggestions.comfortingFoods.map((f: string, i: number) => <li key={i}>{f}</li>)}
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-pink-600 flex items-center mb-1"><HeartHandshake className="mr-2 h-4 w-4"/>Activity:</h4>
                        <ul className="list-disc list-inside text-gray-700">
                          {suggestions.gentleExercises.map((e: string, i: number) => <li key={i}>{e}</li>)}
                        </ul>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
