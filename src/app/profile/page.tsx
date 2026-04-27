
'use client';

import Link from 'next/link';
import React, { useState, useEffect, ChangeEvent, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, UserCircle, Utensils, BarChart3, Footprints, Lock, Edit3, Save, UploadCloud, BrainCircuit, Download } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format, differenceInYears, parseISO, isValid } from 'date-fns'; 

interface UserProfileData {
  name: string;
  dob: string;
  gender: 'male' | 'female' | 'other' | '';
  heightCm: string;
  weightKg: string;
  preferredHeightUnit: 'cm' | 'ft-in';
  preferredWeightUnit: 'kg' | 'lbs';
  goal: string;
  avatarUrl: string | null;
}

const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;
const LBS_PER_KG = 2.20462;

function calculateAge(dobString: string): number | null {
  if (!dobString) return null;
  const dob = parseISO(dobString);
  if (!isValid(dob)) return null;
  return differenceInYears(new Date(), dob);
}

function cmToFeetInches(cm: number): { feet: number; inches: number } {
  if (isNaN(cm) || cm <= 0) return { feet: 0, inches: 0 };
  const totalInches = cm / CM_PER_INCH;
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  const inches = Math.round(totalInches % INCHES_PER_FOOT);
  return { feet, inches };
}

function feetInchesToCm(feet: number, inches: number): number {
  const totalInches = (feet * INCHES_PER_FOOT) + inches;
  return Math.round(totalInches * CM_PER_INCH);
}

function kgToLbs(kg: number): number {
  return parseFloat((kg * LBS_PER_KG).toFixed(1));
}

function lbsToKg(lbs: number): number {
  return parseFloat((lbs / LBS_PER_KG).toFixed(2));
}

export default function ProfilePage() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  
  const initialProfileState: UserProfileData = {
    name: 'Hemanth',
    dob: '1998-01-01',
    gender: 'male',
    heightCm: '175',
    weightKg: '68',
    preferredHeightUnit: 'cm',
    preferredWeightUnit: 'kg',
    goal: 'Gain Muscle',
    avatarUrl: 'https://placehold.co/100x100.png',
  };
  const [profileData, setProfileData] = useState<UserProfileData>(initialProfileState);

  const [tempFeet, setTempFeet] = useState<string>('');
  const [tempInches, setTempInches] = useState<string>('');
  const [tempLbs, setTempLbs] = useState<string>('');
  
  const [calculatedAge, setCalculatedAge] = useState<number | null>(calculateAge(profileData.dob));
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profileData.avatarUrl);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedProfile = localStorage.getItem('fitjourney_profile');
      if (savedProfile) {
        const loadedData = JSON.parse(savedProfile);
        setProfileData(prev => ({ ...prev, ...loadedData }));
        setAvatarPreview(loadedData.avatarUrl || initialProfileState.avatarUrl);
        setCalculatedAge(calculateAge(loadedData.dob || initialProfileState.dob));
      }
    }
  }, []);

  useEffect(() => {
    setCalculatedAge(calculateAge(profileData.dob));
  }, [profileData.dob]);

  useEffect(() => {
    if (isEditing) {
      if (profileData.preferredHeightUnit === 'ft-in') {
        const { feet, inches } = cmToFeetInches(parseFloat(profileData.heightCm) || 0);
        setTempFeet(String(feet));
        setTempInches(String(inches));
      }
      if (profileData.preferredWeightUnit === 'lbs') {
        setTempLbs(String(kgToLbs(parseFloat(profileData.weightKg) || 0)));
      }
    }
  }, [isEditing, profileData.preferredHeightUnit, profileData.preferredWeightUnit, profileData.heightCm, profileData.weightKg]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSaveProfile = () => {
    let finalProfileData = { ...profileData };
    if (finalProfileData.preferredHeightUnit === 'ft-in') {
      finalProfileData.heightCm = String(feetInchesToCm(parseFloat(tempFeet) || 0, parseFloat(tempInches) || 0));
    }
    if (finalProfileData.preferredWeightUnit === 'lbs') {
      finalProfileData.weightKg = String(lbsToKg(parseFloat(tempLbs) || 0));
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('fitjourney_profile', JSON.stringify(finalProfileData));
      setProfileData(finalProfileData);
      toast({ title: "Profile Saved", description: "Your details have been updated." });
      setIsEditing(false);
    }
  };

  const displayHeight = () => {
    if (!profileData.heightCm) return 'N/A';
    const heightNum = parseFloat(profileData.heightCm);
    if (profileData.preferredHeightUnit === 'ft-in') {
      const { feet, inches } = cmToFeetInches(heightNum);
      return `${feet}ft ${inches}in`;
    }
    return `${profileData.heightCm} cm`;
  };

  const displayWeight = () => {
    if (!profileData.weightKg) return 'N/A';
    const weightNum = parseFloat(profileData.weightKg);
    if (profileData.preferredWeightUnit === 'lbs') {
      return `${kgToLbs(weightNum)} lbs`;
    }
    return `${profileData.weightKg} kg`;
  };

  const calorieData = { consumed: 1800, burned: 450, goal: 2200 };
  const bodyMetricsData = {
    weight: displayWeight(), 
    bmi: (profileData.weightKg && profileData.heightCm) 
         ? (parseFloat(profileData.weightKg) / ((parseFloat(profileData.heightCm)/100) ** 2)).toFixed(1) 
         : 'N/A',
    bodyFat: 18, 
  };
  const stepsData = { current: 7200, goal: 10000, workout: '40 min (Cardio)' };
  
  const handleExportDataset = () => {
    try {
      const scans  = JSON.parse(localStorage.getItem('fitjourney_scan_history') || '[]');
      const photos = JSON.parse(localStorage.getItem('fitjourney_body_photos') || '[]');
      
      const verifiedScans = scans.filter((s: any) => s.isVerified);
      
      const dataset = {
        exportedAt: new Date().toISOString(),
        totalScans: scans.length,
        verifiedScans: verifiedScans.length,
        data: verifiedScans.map((s: any) => {
           const photo = photos.find((p: any) => p.date === s.date);
           return {
              originalPhoto: photo?.url,
              prediction: {
                 bf: s.bf,
                 shape: s.shape,
                 bodyType: s.bodyType
              },
              groundTruth: {
                 bf: s.userBf || s.bf,
                 feedback: s.feedback
              }
           };
        })
      };

      const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fitjourney_ai_dataset_${format(new Date(), 'yyyyMMdd')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ 
        title: "Dataset Exported!", 
        description: `Collected ${verifiedScans.length} verified data points for training.` 
      });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Export Failed', description: 'Could not assemble dataset.' });
    }
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-background p-4 pb-20">
      <Link href="/" className="text-sm text-primary hover:underline absolute top-4 left-4 flex items-center z-10">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back Home
      </Link>
      <div className="w-full max-w-4xl mx-auto mt-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="shadow-lg col-span-1 md:col-span-2 lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center space-x-2">
                <UserCircle className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg font-semibold">Profile</CardTitle>
              </div>
              <Button variant={isEditing ? "default" : "outline"} size="sm" onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}>
                {isEditing ? <Save className="mr-2 h-4 w-4" /> : <Edit3 className="mr-2 h-4 w-4" />}
                {isEditing ? "Save Profile" : "Edit Profile"}
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
              <div className="relative group">
                <Avatar className="h-24 w-24 md:h-32 md:w-32 border-2 border-primary cursor-pointer" onClick={() => isEditing && avatarInputRef.current?.click()}>
                  <AvatarImage src={avatarPreview || undefined} alt={profileData.name} />
                  <AvatarFallback className="text-lg">{profileData.name ? profileData.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                </Avatar>
                <Input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => setAvatarPreview(reader.result as string);
                    reader.readAsDataURL(file);
                  }
                }} disabled={!isEditing} />
              </div>
              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" name="name" value={profileData.name} onChange={handleInputChange} />
                  </div>
                  <div>
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input id="dob" name="dob" type="date" value={profileData.dob} onChange={handleInputChange} />
                  </div>
                  <div>
                    <Label htmlFor="gender">Gender</Label>
                    <Select name="gender" value={profileData.gender} onValueChange={(val: any) => setProfileData(p => ({...p, gender: val}))}>
                      <SelectTrigger id="gender"><SelectValue placeholder="Select gender" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Height</Label>
                    <div className="flex gap-2">
                      <Select value={profileData.preferredHeightUnit} onValueChange={(val: any) => setProfileData(p => ({...p, preferredHeightUnit: val}))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="cm">cm</SelectItem><SelectItem value="ft-in">ft/in</SelectItem></SelectContent>
                      </Select>
                      {profileData.preferredHeightUnit === 'cm' ? (
                        <Input name="heightCm" type="number" placeholder="cm" value={profileData.heightCm} onChange={handleInputChange} />
                      ) : (
                        <div className="flex gap-1">
                          <Input className="w-16" placeholder="ft" value={tempFeet} onChange={(e) => setTempFeet(e.target.value)} />
                          <Input className="w-16" placeholder="in" value={tempInches} onChange={(e) => setTempInches(e.target.value)} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  <p className="text-xl font-bold col-span-full">{profileData.name}</p>
                  <p className="text-sm"><strong className="text-muted-foreground">Age:</strong> {calculatedAge !== null ? `${calculatedAge} yrs` : 'N/A'}</p>
                  <p className="text-sm"><strong className="text-muted-foreground">Gender:</strong> {profileData.gender}</p>
                  <p className="text-sm"><strong className="text-muted-foreground">Height:</strong> {displayHeight()}</p>
                  <p className="text-sm"><strong className="text-muted-foreground">Weight:</strong> {displayWeight()}</p>
                  <p className="text-sm col-span-full"><strong className="text-muted-foreground">Goal:</strong> {profileData.goal}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center space-x-2 pb-2">
              <Utensils className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-semibold">Calories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm"><span>Consumed:</span><span className="font-medium">{calorieData.consumed} kcal</span></div>
              <div className="flex justify-between text-sm"><span>Burned:</span><span className="font-medium">{calorieData.burned} kcal</span></div>
              <Progress value={(calorieData.consumed / calorieData.goal) * 100} className="h-2 [&>*]:bg-green-500" />
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center space-x-2 pb-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-semibold">Body Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex justify-between text-sm"><span>Weight:</span><span className="font-medium">{bodyMetricsData.weight}</span></div>
              <div className="flex justify-between text-sm"><span>BMI:</span><span className="font-medium">{bodyMetricsData.bmi}</span></div>
              <div className="flex justify-between text-sm"><span>Body Fat:</span><span className="font-medium">{bodyMetricsData.bodyFat}% (est.)</span></div>
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center space-x-2 pb-2">
              <Footprints className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-semibold">Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm"><span>Steps Today:</span><span className="font-medium">{stepsData.current} / {stepsData.goal}</span></div>
              <Progress value={(stepsData.current / stepsData.goal) * 100} className="h-2" />
              <div className="flex justify-between text-sm pt-1"><span>Last Workout:</span><span className="text-xs">{stepsData.workout}</span></div>
            </CardContent>
          </Card>

          {/* DEVELOPER TOOLS */}
          <Card className="shadow-lg border-accent/20 bg-accent/5 col-span-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-accent" /> AI Developer Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Improve the PhysiqueNet models by exporting your human-verified scan data. 
                Use this JSON file to fine-tune the ONNX models in your training pipeline.
              </p>
              <Button onClick={handleExportDataset} variant="outline" className="w-full border-accent/50 text-accent hover:bg-accent/10">
                <Download className="mr-2 h-4 w-4" /> Export Training Dataset (.JSON)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
