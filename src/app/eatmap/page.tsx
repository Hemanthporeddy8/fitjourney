
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Utensils, Brain, Sparkles } from 'lucide-react';
import { foodItemCategoriesData, foodIdToConcept } from '@/lib/eatmap-data';
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { aiEngine } from '@/lib/ai-engine';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export default function EatMapPage() {
  const { toast } = useToast();
  const [selectedFoodItemIds, setSelectedFoodItemIds] = useState<string[]>([]);
  const [suggestedProfile, setSuggestedProfile] = useState<{ suggestedDietNames: string[], reasoning: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedFoodPalette = localStorage.getItem('fitjourney_eatmap_food_items');
      if (savedFoodPalette) setSelectedFoodItemIds(JSON.parse(savedFoodPalette));
    }
  }, []);

  const handleFoodItemToggle = (itemId: string) => {
    setSelectedFoodItemIds(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);
    setSuggestedProfile(null);
  };

  const handleAnalyzeFoodChoices = async () => {
    if (selectedFoodItemIds.length === 0) return;
    setIsAnalyzing(true);
    try {
      const selectedNames = selectedFoodItemIds.map(id => foodIdToConcept[id] || id);
      const result = await aiEngine.inferDietProfile(selectedNames);
      setSuggestedProfile(result);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveFoodPaletteSelections = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('fitjourney_eatmap_food_items', JSON.stringify(selectedFoodItemIds));
      toast({ title: "Food Palette Saved" });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-green-50/30 p-4 pb-20">
      <Link href="/healmap" className="text-sm text-green-600 hover:text-green-800 absolute top-4 left-4 flex items-center z-10">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to HealMap
      </Link>
      <Card className="w-full max-w-4xl mx-auto shadow-lg mt-10 border-green-200">
        <CardHeader className="text-center bg-green-100 rounded-t-lg py-4">
          <CardTitle className="text-3xl font-bold text-green-700 flex items-center justify-center">
            <Utensils className="mr-2 h-8 w-8" /> EatMap - Preferences
          </CardTitle>
          <CardDescription className="text-green-600">Deterministic diet classification based on your palette.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <Tabs defaultValue="foodPalette" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-green-200 text-green-700">
              <TabsTrigger value="foodPalette">Your Food Palette</TabsTrigger>
              <TabsTrigger value="detailedProfiles">Select Dietary Profiles</TabsTrigger>
            </TabsList>

            <TabsContent value="foodPalette" className="mt-4">
              <Card className="border-green-100 shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-green-700">Rules Engine Classifier</CardTitle>
                  <CardDescription className="text-xs">Classifies your profile based on inclusion/exclusion logic.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ScrollArea className="h-[400px] border rounded-md p-4 bg-white">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {foodItemCategoriesData.flatMap(c => c.families.flatMap(f => f.items)).map((item) => (
                        <Button
                          key={item.id}
                          variant={selectedFoodItemIds.includes(item.id) ? "default" : "outline"}
                          onClick={() => handleFoodItemToggle(item.id)}
                          className={cn("flex flex-col items-center h-auto p-2", selectedFoodItemIds.includes(item.id) && "bg-green-500 text-white")}
                        >
                          <span className="text-2xl">{item.emoji}</span>
                          <span className="text-[10px] truncate w-full mt-1">{item.name}</span>
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>

                  <Button onClick={handleAnalyzeFoodChoices} className="w-full bg-green-600" disabled={isAnalyzing || selectedFoodItemIds.length === 0}>
                    {isAnalyzing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Brain className="mr-2 h-4 w-4" />}
                    Analyze Selections
                  </Button>

                  {suggestedProfile && (
                    <Alert className="bg-teal-50 border-teal-200">
                      <Sparkles className="h-5 w-5 text-teal-600" />
                      <AlertTitle className="text-teal-700 font-bold">Classified As: {suggestedProfile.suggestedDietNames.join(', ')}</AlertTitle>
                      <AlertDescription className="text-teal-600">{suggestedProfile.reasoning}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
                <CardFooter>
                  <Button onClick={handleSaveFoodPaletteSelections} className="w-full" variant="outline">Save Selection</Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="detailedProfiles" className="mt-4">
               <p className="text-sm text-center text-muted-foreground p-8">Choose from our pre-defined library of dietary patterns.</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
