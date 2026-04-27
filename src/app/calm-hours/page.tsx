
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Clock4, Save, Trash2, CalendarDays, Repeat, Info, XCircle } from 'lucide-react';
import { format, parseISO, startOfDay, getDay, addDays, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { useToast } from "@/hooks/use-toast";

// Lazy load heavy Calendar component
const Calendar = dynamic(() => import("@/components/ui/calendar").then(mod => mod.Calendar), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-muted animate-pulse rounded-md border" />
});

type FastingPeriod = "Morning" | "Afternoon" | "Evening" | "Night" | "AllDay";
const fastingPeriodOptions: { id: FastingPeriod, label: string }[] = [
  { id: "Morning", label: "Morning (6 AM - 12 PM)" },
  { id: "Afternoon", label: "Afternoon (12 PM - 5 PM)" },
  { id: "Evening", label: "Evening (5 PM - 9 PM)" },
  { id: "Night", label: "Night (9 PM - 6 AM next day)" },
  { id: "AllDay", label: "All Day" },
];

const daysOfWeek = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

interface SpecificFastDay {
  date: string;
  periods: FastingPeriod[];
  notes?: string;
}

interface RecurringFastRule {
  id: string;
  dayOfWeek: number;
  periods: FastingPeriod[];
  notes?: string;
}

export default function CalmHoursPage() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [specificFastDays, setSpecificFastDays] = useState<SpecificFastDay[]>([]);
  const [recurringFastRules, setRecurringFastRules] = useState<RecurringFastRule[]>([]);
  
  const [currentFastingPeriods, setCurrentFastingPeriods] = useState<FastingPeriod[]>([]);
  const [currentNotes, setCurrentNotes] = useState<string>('');

  const [newRecurringDay, setNewRecurringDay] = useState<string | undefined>(undefined);
  const [newRecurringPeriods, setNewRecurringPeriods] = useState<FastingPeriod[]>([]);
  const [newRecurringNotes, setNewRecurringNotes] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedSpecific = localStorage.getItem('fitjourney_specific_fasts');
        setSpecificFastDays(savedSpecific ? JSON.parse(savedSpecific) : []);
        const savedRecurring = localStorage.getItem('fitjourney_recurring_fasts');
        setRecurringFastRules(savedRecurring ? JSON.parse(savedRecurring) : []);
      } catch (error) {
        console.error('Error loading fasting data from localStorage:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedDate) {
      const dateStr = format(startOfDay(selectedDate), 'yyyy-MM-dd');
      const specificDay = specificFastDays.find(fd => fd.date === dateStr);
      if (specificDay) {
        setCurrentFastingPeriods(specificDay.periods);
        setCurrentNotes(specificDay.notes || '');
      } else {
        const dayOfWeek = getDay(selectedDate);
        const recurringRule = recurringFastRules.find(rule => rule.dayOfWeek === dayOfWeek);
        if (recurringRule) {
          setCurrentFastingPeriods(recurringRule.periods);
          setCurrentNotes(recurringRule.notes || `Recurring fast: ${daysOfWeek.find(d => d.value === String(dayOfWeek))?.label}`);
        } else {
          setCurrentFastingPeriods([]);
          setCurrentNotes('');
        }
      }
    }
  }, [selectedDate, specificFastDays, recurringFastRules]);

  const handleSaveSpecificFastDay = () => {
    if (!selectedDate) return;
    const dateStr = format(startOfDay(selectedDate), 'yyyy-MM-dd');
    const updatedSpecificFastDays = specificFastDays.filter(fd => fd.date !== dateStr);
    if (currentFastingPeriods.length > 0 || currentNotes) {
      updatedSpecificFastDays.push({ date: dateStr, periods: currentFastingPeriods, notes: currentNotes });
    }
    updatedSpecificFastDays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setSpecificFastDays(updatedSpecificFastDays);
    localStorage.setItem('fitjourney_specific_fasts', JSON.stringify(updatedSpecificFastDays));
    toast({ title: "Fasting Day Updated", description: `Settings for ${format(selectedDate, 'PPP')} saved.` });
  };

  const handleClearSpecificFastDay = () => {
    if (!selectedDate) return;
    const dateStr = format(startOfDay(selectedDate), 'yyyy-MM-dd');
    const updatedSpecificFastDays = specificFastDays.filter(fd => fd.date !== dateStr);
    setSpecificFastDays(updatedSpecificFastDays);
    localStorage.setItem('fitjourney_specific_fasts', JSON.stringify(updatedSpecificFastDays));
    setCurrentFastingPeriods([]);
    setCurrentNotes('');
    toast({ title: "Fasting Day Cleared", description: `Fasting settings for ${format(selectedDate, 'PPP')} cleared.` });
  };

  const handlePeriodCheckboxChange = (periodId: FastingPeriod, checked: boolean) => {
    setCurrentFastingPeriods(prev => 
      checked ? (prev.includes(periodId) ? prev : [...prev, periodId]) : prev.filter(p => p !== periodId)
    );
  };
  
  const handleRecurringPeriodCheckboxChange = (periodId: FastingPeriod, checked: boolean) => {
    setNewRecurringPeriods(prev => 
      checked ? (prev.includes(periodId) ? prev : [...prev, periodId]) : prev.filter(p => p !== periodId)
    );
  };

  const handleAddRecurringRule = () => {
    if (newRecurringDay === undefined || newRecurringPeriods.length === 0) {
      toast({ title: "Missing Information", description: "Please select a day and at least one fasting period.", variant: "destructive" });
      return;
    }
    const dayOfWeekNum = parseInt(newRecurringDay, 10);
    const newRule: RecurringFastRule = {
      id: `recurring-${dayOfWeekNum}-${Date.now()}`,
      dayOfWeek: dayOfWeekNum,
      periods: newRecurringPeriods,
      notes: newRecurringNotes,
    };
    const updatedRules = [...recurringFastRules.filter(r => r.dayOfWeek !== dayOfWeekNum), newRule];
    updatedRules.sort((a,b) => a.dayOfWeek - b.dayOfWeek);
    setRecurringFastRules(updatedRules);
    localStorage.setItem('fitjourney_recurring_fasts', JSON.stringify(updatedRules));
    toast({ title: "Recurring Rule Added", description: `Fasting rule for every ${daysOfWeek.find(d=>d.value === newRecurringDay)?.label} saved.` });
    setNewRecurringDay(undefined);
    setNewRecurringPeriods([]);
    setNewRecurringNotes('');
  };

  const handleDeleteRecurringRule = (ruleId: string) => {
    const updatedRules = recurringFastRules.filter(r => r.id !== ruleId);
    setRecurringFastRules(updatedRules);
    localStorage.setItem('fitjourney_recurring_fasts', JSON.stringify(updatedRules));
    toast({ title: "Recurring Rule Deleted", description: "The recurring fasting rule has been removed." });
  };

  const calendarModifiers = useMemo(() => {
    const modifiers: Record<string, Date[]> = {
      specificFast: specificFastDays.map(fd => parseISO(fd.date)),
      recurringFast: [],
    };
    
    if (selectedDate) {
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        const daysInCurrentMonthView = eachDayOfInterval({start: monthStart, end: monthEnd});

        recurringFastRules.forEach(rule => {
            daysInCurrentMonthView.forEach(dayInMonth => {
                if (getDay(dayInMonth) === rule.dayOfWeek) {
                    if (!specificFastDays.some(sfd => sfd.date === format(dayInMonth, 'yyyy-MM-dd'))) {
                         modifiers.recurringFast.push(dayInMonth);
                    }
                }
            });
        });
    }
    return modifiers;
  }, [specificFastDays, recurringFastRules, selectedDate]);

  const calendarModifierStyles = {
    specificFast: { 
        backgroundColor: 'hsl(var(--primary))', 
        color: 'hsl(var(--primary-foreground))',
        fontWeight: 'bold',
    },
    recurringFast: { 
        border: '2px solid hsl(var(--accent))',
        borderRadius: '50%',
    },
  };

  return (
    <div className="flex flex-col min-h-screen bg-purple-50/30 p-4 pb-20">
      <Link href="/healmap" className="text-sm text-purple-600 hover:text-purple-800 absolute top-4 left-4 flex items-center z-10">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to HealMap
      </Link>
      <Card className="w-full max-w-4xl mx-auto shadow-lg mt-10 border-purple-200">
        <CardHeader className="text-center bg-purple-100 rounded-t-lg py-4">
          <CardTitle className="text-3xl font-bold text-purple-700 flex items-center justify-center">
            <Clock4 className="mr-2 h-8 w-8" /> CalmHours - Fasting Schedule
          </CardTitle>
          <CardDescription className="text-purple-600">Track your fasting days and recurring schedules.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card className="border-purple-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-purple-700 flex items-center"><CalendarDays className="mr-2 h-5 w-5"/> Manage Specific Fasting Day</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border border-purple-200 self-center mx-auto"
                  modifiers={calendarModifiers}
                  modifiersStyles={calendarModifierStyles}
                  disabled={(date) => date > addDays(new Date(), 365*2)}
                />
                {selectedDate && (
                  <div className="space-y-3 pt-3">
                    <p className="text-sm font-medium text-center text-purple-700">Settings for: {format(selectedDate, 'PPP')}</p>
                    <div>
                      <Label className="text-sm font-medium text-purple-700">Fasting Periods for this day:</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {fastingPeriodOptions.map(period => (
                          <div key={period.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`specific-${period.id}`} 
                              checked={currentFastingPeriods.includes(period.id)}
                              onCheckedChange={(checked) => handlePeriodCheckboxChange(period.id, !!checked)}
                            />
                            <Label htmlFor={`specific-${period.id}`} className="text-xs font-normal">{period.label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="specific-notes" className="text-sm font-medium text-purple-700">Notes (e.g., foods to avoid/eat):</Label>
                      <Textarea 
                        id="specific-notes"
                        value={currentNotes}
                        onChange={(e) => setCurrentNotes(e.target.value)}
                        placeholder="e.g., Avoiding grains, only water..."
                        className="min-h-[70px] border-purple-300 focus:border-purple-500 mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleSaveSpecificFastDay} className="flex-1 bg-purple-500 hover:bg-purple-600 text-white">
                            <Save className="mr-2 h-4 w-4"/> Save Day
                        </Button>
                        <Button onClick={handleClearSpecificFastDay} variant="outline" className="border-purple-400 text-purple-600 hover:bg-purple-50">
                            <XCircle className="mr-2 h-4 w-4"/> Clear Day
                        </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-purple-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-purple-700 flex items-center"><Repeat className="mr-2 h-5 w-5"/> Manage Recurring Weekly Fasts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="recurring-day" className="text-sm font-medium text-purple-700">Select Day of Week:</Label>
                  <Select value={newRecurringDay} onValueChange={setNewRecurringDay}>
                    <SelectTrigger id="recurring-day" className="mt-1 border-purple-300 focus:border-purple-500">
                      <SelectValue placeholder="Choose a day" />
                    </SelectTrigger>
                    <SelectContent>
                      {daysOfWeek.map(day => (
                        <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-purple-700">Fasting Periods for recurring day:</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {fastingPeriodOptions.map(period => (
                      <div key={period.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`recurring-${period.id}`}
                          checked={newRecurringPeriods.includes(period.id)}
                          onCheckedChange={(checked) => handleRecurringPeriodCheckboxChange(period.id, !!checked)}
                        />
                        <Label htmlFor={`recurring-${period.id}`} className="text-xs font-normal">{period.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="recurring-notes" className="text-sm font-medium text-purple-700">Notes for recurring fast:</Label>
                  <Textarea 
                    id="recurring-notes"
                    value={newRecurringNotes}
                    onChange={(e) => setNewRecurringNotes(e.target.value)}
                    placeholder="e.g., Avoid meat products, light meals only..."
                    className="min-h-[70px] border-purple-300 focus:border-purple-500 mt-1"
                  />
                </div>
                <Button onClick={handleAddRecurringRule} className="w-full bg-purple-500 hover:bg-purple-600 text-white">
                  <Save className="mr-2 h-4 w-4"/> Add/Update Recurring Rule
                </Button>

                {recurringFastRules.length > 0 && (
                  <div className="mt-4 space-y-2 pt-3 border-t border-purple-200">
                    <h4 className="text-md font-semibold text-purple-700">Active Recurring Rules:</h4>
                    {recurringFastRules.map(rule => (
                      <Card key={rule.id} className="p-2 bg-purple-50 border-purple-100">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm font-medium text-purple-600">
                                    Every {daysOfWeek.find(d => d.value === String(rule.dayOfWeek))?.label}
                                </p>
                                <p className="text-xs text-muted-foreground">Periods: {rule.periods.join(', ') || 'N/A'}</p>
                                {rule.notes && <p className="text-xs text-muted-foreground">Notes: {rule.notes}</p>}
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteRecurringRule(rule.id)} className="text-destructive hover:text-destructive/80">
                                <Trash2 className="h-4 w-4"/>
                            </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
                 {recurringFastRules.length === 0 && (
                     <Alert variant="default" className="mt-3 bg-purple-50 border-purple-200 text-purple-600 text-xs">
                        <Info className="h-4 w-4 text-purple-500" />
                        <AlertDescription>No recurring weekly fasts set up yet. Add one above to apply it to the calendar.</AlertDescription>
                    </Alert>
                 )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
