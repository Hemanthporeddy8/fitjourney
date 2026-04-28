
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Activity, Clock, Flame, ListChecks, BarChart3, PieChart as PieChartIcon, TrendingUp, Repeat, Star } from 'lucide-react';
import { parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { type ChartConfig } from "@/components/ui/chart";

import { 
  ChartContainer, ChartTooltip, ChartTooltipContent, 
  ChartLegend, ChartLegendContent 
} from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";

interface CompletedBuddyActivity {
  id: string;
  name: string;
  durationSeconds: number;
  caloriesBurned: number;
  timestamp: string;
}

interface AggregatedActivityStats {
  name: string;
  count: number;
  totalDurationSeconds: number;
  totalCaloriesBurned: number;
}

const formatTime = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

const chartColorsPalette = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))",
  "hsl(var(--primary))", "hsl(var(--accent))",
  "hsl(var(--primary) / 0.7)", "hsl(var(--accent) / 0.7)",
  "hsl(var(--secondary-foreground) / 0.6)",
];

export default function BuddyActivityReportPage() {
  const { toast } = useToast();
  const [completedActivities, setCompletedActivities] = useState<CompletedBuddyActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedActivitiesRaw = localStorage.getItem('fitjourney_buddy_activities');
        const loadedActivities: CompletedBuddyActivity[] = savedActivitiesRaw ? JSON.parse(savedActivitiesRaw) : [];
        loadedActivities.sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
        setCompletedActivities(loadedActivities);
      } catch (error) {
        console.error('Error loading completed activities from localStorage:', error);
        toast({
          title: "Load Error",
          description: "Could not load completed activity data.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    }
  }, [toast]);

  const summaryStats = useMemo(() => {
    if (completedActivities.length === 0) {
      return {
        totalActivities: 0,
        totalDurationSeconds: 0,
        totalCaloriesBurned: 0,
        averageCaloriesPerSession: 0,
        mostFrequentActivity: 'N/A',
        topCalorieBurningActivity: 'N/A',
      };
    }

    const totalDurationSeconds = completedActivities.reduce((sum, act) => sum + act.durationSeconds, 0);
    const totalCaloriesBurned = completedActivities.reduce((sum, act) => sum + act.caloriesBurned, 0);
    
    const activityCounts: Record<string, number> = {};
    const activityCalories: Record<string, number> = {};
    completedActivities.forEach(act => {
      activityCounts[act.name] = (activityCounts[act.name] || 0) + 1;
      activityCalories[act.name] = (activityCalories[act.name] || 0) + act.caloriesBurned;
    });

    let mostFrequentActivity = 'N/A';
    let maxCount = 0;
    for (const name in activityCounts) {
      if (activityCounts[name] > maxCount) {
        maxCount = activityCounts[name];
        mostFrequentActivity = name;
      }
    }

    let topCalorieBurningActivity = 'N/A';
    let maxCalories = 0;
    for (const name in activityCalories) {
      if (activityCalories[name] > maxCalories) {
        maxCalories = activityCalories[name];
        topCalorieBurningActivity = name;
      }
    }

    return {
      totalActivities: completedActivities.length,
      totalDurationSeconds,
      totalCaloriesBurned,
      averageCaloriesPerSession: completedActivities.length > 0 ? Math.round(totalCaloriesBurned / completedActivities.length) : 0,
      mostFrequentActivity: `${mostFrequentActivity} (${maxCount} times)`,
      topCalorieBurningActivity: `${topCalorieBurningActivity} (~${Math.round(maxCalories)} kcal)`,
    };
  }, [completedActivities]);

  const aggregatedActivities = useMemo(() => {
    const activityMap: Record<string, AggregatedActivityStats> = {};
    completedActivities.forEach(act => {
      if (!activityMap[act.name]) {
        activityMap[act.name] = {
          name: act.name,
          count: 0,
          totalDurationSeconds: 0,
          totalCaloriesBurned: 0,
        };
      }
      activityMap[act.name].count += 1;
      activityMap[act.name].totalDurationSeconds += act.durationSeconds;
      activityMap[act.name].totalCaloriesBurned += act.caloriesBurned;
    });
    return Object.values(activityMap).sort((a,b) => b.totalCaloriesBurned - a.totalCaloriesBurned);
  }, [completedActivities]);

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    aggregatedActivities.forEach((activity, index) => {
      config[activity.name] = { 
        label: activity.name,
        color: chartColorsPalette[index % chartColorsPalette.length],
      };
    });
    return config;
  }, [aggregatedActivities]);

  const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; description?: string }> = ({ title, value, icon, description }) => (
    <Card className="shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-primary">{value}</div>
        {description && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col min-h-screen bg-secondary/30 p-4 pb-20">
      <Link href="/buddy" className="text-sm text-primary hover:underline absolute top-4 left-4 flex items-center z-10">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Buddy Activities
      </Link>
      <div className="w-full max-w-4xl mx-auto mt-10 space-y-6">
        <Card className="shadow-lg border-primary">
          <CardHeader className="text-center bg-primary/10">
            <CardTitle className="text-3xl font-bold text-primary flex items-center justify-center">
              <BarChart3 className="mr-3 h-8 w-8" /> Buddy Activity Dashboard
            </CardTitle>
            <CardDescription>Your tracked activity performance and insights.</CardDescription>
          </CardHeader>
        </Card>

        {isLoading && <p className="text-center text-muted-foreground py-8">Loading report...</p>}
        {!isLoading && completedActivities.length === 0 && (
          <Card>
            <CardContent className="text-center text-muted-foreground py-12">
              <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-semibold">No Activity Logged Yet</p>
              <p className="text-sm">Start tracking activities in the "Buddy Challenge" page to see your report here.</p>
              <Button asChild className="mt-4">
                <Link href="/buddy">Go to Buddy Activities</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && completedActivities.length > 0 && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <StatCard title="Total Activities" value={summaryStats.totalActivities} icon={<Activity className="h-5 w-5 text-accent" />} />
              <StatCard title="Total Time Tracked" value={formatTime(summaryStats.totalDurationSeconds)} icon={<Clock className="h-5 w-5 text-accent" />} />
              <StatCard title="Total Calories Burned" value={`~${Math.round(summaryStats.totalCaloriesBurned)} kcal`} icon={<Flame className="h-5 w-5 text-accent" />} />
              <StatCard title="Avg. Calories/Session" value={`~${summaryStats.averageCaloriesPerSession} kcal`} icon={<Flame className="h-5 w-5 text-accent" />} description="Average per activity session." />
              <StatCard title="Most Frequent" value={summaryStats.mostFrequentActivity.split(' (')[0]} icon={<Repeat className="h-5 w-5 text-accent" />} description={summaryStats.mostFrequentActivity.split(' (')[1]?.replace(')','')} />
              <StatCard title="Top Calorie Burner" value={summaryStats.topCalorieBurningActivity.split(' (~')[0]} icon={<Star className="h-5 w-5 text-accent" />} description={summaryStats.topCalorieBurningActivity.split(' (~')[1]?.replace(')','')} />
            </div>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl text-primary flex items-center"><ListChecks className="mr-2 h-6 w-6"/>Activity Breakdown</CardTitle>
                <CardDescription>Summary of calories and duration for each type of activity.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-3">
                  <div className="space-y-4">
                    {aggregatedActivities.map(activity => (
                      <Card key={activity.name} className="bg-background/70 hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2 pt-3 px-4">
                          <CardTitle className="text-md font-semibold text-primary flex items-center">
                            <Activity className="h-4 w-4 mr-2" /> {activity.name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 space-y-1.5 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Sessions:</span>
                            <Badge variant="secondary">{activity.count}</Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Total Time:</span>
                            <span>{formatTime(activity.totalDurationSeconds)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Total Calories:</span>
                            <Badge variant="default" className="bg-accent text-accent-foreground">~{Math.round(activity.totalCaloriesBurned)} kcal</Badge>
                          </div>
                          {summaryStats.totalCaloriesBurned > 0 && (
                            <div className="pt-1">
                              <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                                <span>Contribution to Total Burn:</span>
                                <span>{((activity.totalCaloriesBurned / summaryStats.totalCaloriesBurned) * 100).toFixed(1)}%</span>
                              </div>
                              <Progress 
                                value={(activity.totalCaloriesBurned / summaryStats.totalCaloriesBurned) * 100} 
                                className="h-1.5 [&>*]:bg-primary"
                                aria-label={`${activity.name} calorie contribution`}
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="text-lg text-primary flex items-center"><PieChartIcon className="mr-2 h-5 w-5"/>Calorie Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[350px] flex flex-col items-center justify-center p-4">
                        {aggregatedActivities.length > 0 && Object.keys(chartConfig).length > 0 ? (
                        <div className="mx-auto aspect-square h-full max-h-[300px] w-full">
                          <ChartContainer config={chartConfig}>
                              <PieChart>
                                  <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent indicator="dot" nameKey="totalCaloriesBurned" labelKey="name" hideLabel />}
                                  />
                                  <Pie
                                    data={aggregatedActivities}
                                    dataKey="totalCaloriesBurned"
                                    nameKey="name" 
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    innerRadius={50}
                                    strokeWidth={1}
                                    labelLine={false}
                                    label={({ name, percent }) => {
                                        if (!percent || percent * 100 < 5) return null; 
                                        return `${(percent * 100).toFixed(0)}%`;
                                    }}
                                  >
                                    {aggregatedActivities.map((entry) => (
                                        <Cell
                                          key={`cell-${entry.name}`}
                                          fill={`var(--color-${entry.name})`}
                                          className="stroke-background focus:outline-none"
                                        />
                                    ))}
                                  </Pie>
                              </PieChart>
                          </ChartContainer>
                          <ChartLegend content={<ChartLegendContent nameKey="name" />} className="mt-4 flex flex-wrap justify-center" />
                        </div>
                        ) : (
                        <p className="text-muted-foreground text-center">Not enough data to display chart.</p>
                        )}
                    </CardContent>
                </Card>
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="text-lg text-primary flex items-center"><TrendingUp className="mr-2 h-5 w-5"/>Activity Trends</CardTitle>
                    </CardHeader>
                    <CardContent className="h-40 flex items-center justify-center text-center p-6">
                        <p className="text-muted-foreground">Keep logging activities to see trend lines and progress velocity over time.</p>
                    </CardContent>
                </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
