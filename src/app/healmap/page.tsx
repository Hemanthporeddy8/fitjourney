
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Map, HeartPulse, Utensils, Flower2, Clock4 } from 'lucide-react';

export default function HealMapPage() {
  const [userGender, setUserGender] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const profileRaw = localStorage.getItem('fitjourney_profile');
      if (profileRaw) {
        const profile = JSON.parse(profileRaw);
        setUserGender(profile.gender || '');
      }
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background p-4 pb-20">
      <Link href="/" className="text-sm text-primary hover:underline absolute top-4 left-4 flex items-center z-10">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back Home
      </Link>
      <Card className="w-full max-w-2xl mx-auto shadow-lg mt-10">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary flex items-center justify-center">
            <Map className="mr-2 h-7 w-7" /> HealMap
          </CardTitle>
          <CardDescription>Explore features designed to support your healing and well-being journey.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
          <Button asChild variant="outline" className="w-full h-20 text-lg flex flex-col items-center justify-center space-y-1 shadow-sm hover:shadow-md transition-shadow">
            <Link href="/wound-heal">
              <HeartPulse className="h-6 w-6 mb-1 text-red-500" />
              <span>WoundHeal</span>
              <span className="text-xs text-muted-foreground">(Track healing progress)</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full h-20 text-lg flex flex-col items-center justify-center space-y-1 shadow-sm hover:shadow-md transition-shadow">
            <Link href="/eatmap">
              <Utensils className="h-6 w-6 mb-1 text-green-500" />
              <span>EatMap</span>
              <span className="text-xs text-muted-foreground">(Dietary preferences)</span>
            </Link>
          </Button>
          
          {userGender === 'female' && (
            <Button asChild variant="outline" className="w-full h-20 text-lg flex flex-col items-center justify-center space-y-1 shadow-sm hover:shadow-md transition-shadow">
              <Link href="/cycle-calm">
                <Flower2 className="h-6 w-6 mb-1 text-pink-500" />
                <span>Calm Cycle</span>
                <span className="text-xs text-muted-foreground">(Menstrual cycle comfort)</span>
              </Link>
            </Button>
          )}

          <Button asChild variant="outline" className="w-full h-20 text-lg flex flex-col items-center justify-center space-y-1 shadow-sm hover:shadow-md transition-shadow">
            <Link href="/calm-hours">
              <Clock4 className="h-6 w-6 mb-1 text-purple-500" />
              <span>CalmHours</span>
              <span className="text-xs text-muted-foreground">(Fasting schedule tracker)</span>
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
