
'use client';

import React, { useState, useEffect, ChangeEvent, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Smile, ArrowLeft, Film, Camera as CameraIcon, Sparkles, Loader2, Trash2, AlertCircle, CalendarDays, RotateCcw, TimerIcon, FastForward, Play, Pause, SkipBack, SkipForward, RefreshCcw, Upload, Repeat } from 'lucide-react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format, parseISO, startOfDay, isSameDay, endOfWeek, isAfter, isBefore, isValid, startOfWeek as dateFnsStartOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter as DialogFooterComponent } from '@/components/ui/dialog';

// Lazy load heavy Calendar component
const Calendar = dynamic(() => import("@/components/ui/calendar").then(mod => mod.Calendar), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-muted animate-pulse rounded-md border" />
});

interface FacePhoto {
  id: string;
  date: string;
  url: string;
}

const LOCAL_STORAGE_KEY = 'fitjourney_face_photos';

export default function FaceTimelapsePage() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [photos, setPhotos] = useState<FacePhoto[]>([]);
  const [photoForSelectedDate, setPhotoForSelectedDate] = useState<FacePhoto | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showCamera, setShowCamera] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const [isSaving, setIsSaving] = useState(false);

  const [timelapseFrames, setTimelapseFrames] = useState<FacePhoto[]>([]);
  const [currentTimelapseFrameIndex, setCurrentTimelapseFrameIndex] = useState(0);
  const [isTimelapsePlaying, setIsTimelapsePlaying] = useState(false);
  const [timelapseSpeed, setTimelapseSpeed] = useState(3);
  const timelapseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [timelapsePreviewUrl, setTimelapsePreviewUrl] = useState<string | null>(null);
  const [timelapseResolution, setTimelapseResolution] = useState("1080p");
  const [timelapseFormat, setTimelapseFormat] = useState("mp4");
  const [timelapseGenerated, setTimelapseGenerated] = useState(false);
  const [isGeneratingTimelapse, setIsGeneratingTimelapse] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  const [isConfirmTimelapseDialogOpen, setIsConfirmTimelapseDialogOpen] = useState(false);

  const [showCustomDateRangePicker, setShowCustomDateRangePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [timelapseMode, setTimelapseMode] = useState<'weekly' | 'custom'>('weekly');

  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCountingDown, setIsCountingDown] = useState(false);

  const daysWithPhotos = useMemo(() => {
    return photos.map(photo => {
      try {
        return startOfDay(parseISO(photo.date));
      } catch (e) {
        return null;
      }
    }).filter(date => date !== null) as Date[];
  }, [photos]);

  const weekStartForTimelapse = useMemo(() => {
    return selectedDate ? startOfDay(dateFnsStartOfWeek(selectedDate, { weekStartsOn: 0 })) : startOfDay(dateFnsStartOfWeek(new Date(), { weekStartsOn: 0 }));
  }, [selectedDate]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedPhotosRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
        const loadedPhotos: FacePhoto[] = savedPhotosRaw ? JSON.parse(savedPhotosRaw) : [];
        const validPhotos = loadedPhotos.filter(p => {
          try {
            parseISO(p.date); return true;
          } catch (e) {
            return false;
          }
        });
        validPhotos.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPhotos(validPhotos);
      } catch (error) {
        console.error('Error loading face photos:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedDate) {
      const currentDayPhoto = photos.find(p => isSameDay(parseISO(p.date), selectedDate));
      setPhotoForSelectedDate(currentDayPhoto || null);
      setPreviewUrl(null);
      setShowCamera(false);
    }
  }, [selectedDate, photos]);

  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
      if (isCountingDown) { setIsCountingDown(false); setCountdown(null); }
    };
  }, [isCountingDown]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const videoElement = videoRef.current;
    if (showCamera) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false })
        .then(s => { stream = s; setHasCameraPermission(true); if (videoElement) videoElement.srcObject = stream; })
        .catch(err => {
          setHasCameraPermission(false); setShowCamera(false);
          toast({ variant: 'destructive', title: 'Camera Access Denied', description: 'Please enable camera permissions.' });
        });
    } else {
      if (videoElement?.srcObject) { (videoElement.srcObject as MediaStream).getTracks().forEach(track => track.stop()); videoElement.srcObject = null; }
      setIsCountingDown(false); setCountdown(null);
    }
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (videoElement?.srcObject) { (videoElement.srcObject as MediaStream).getTracks().forEach(track => track.stop()); videoElement.srcObject = null; }
    };
  }, [showCamera, facingMode, toast]);

  const handleFlipCamera = () => {
    if (videoRef.current?.srcObject) { (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop()); videoRef.current.srcObject = null; }
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !selectedDate) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPreviewUrl(canvas.toDataURL('image/jpeg'));
    setShowCamera(false);
    setIsCountingDown(false); setCountdown(null);
  }, [selectedDate]);

  useEffect(() => {
    if (isCountingDown && countdown !== null && countdown > 0 && showCamera && hasCameraPermission) {
      const timerId = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timerId);
    } else if (countdown === 0 && isCountingDown) {
      capturePhoto();
    }
  }, [isCountingDown, countdown, showCamera, hasCameraPermission, capturePhoto]);

  const handleDateSelect = (date: Date | undefined) => { setSelectedDate(date); setPreviewUrl(null); };
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setShowCamera(false);
    const file = event.target.files?.[0];
    if (file && selectedDate) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    } else { setPreviewUrl(null); }
  };
  const triggerFileInput = () => fileInputRef.current?.click();
  const handleTakePhotoClick = () => { setPreviewUrl(null); setShowCamera(true); };
  const startTimer = (duration: number) => { if (showCamera && hasCameraPermission) { setCountdown(duration); setIsCountingDown(true); } };

  const handleSavePhoto = async () => {
    if (!previewUrl || !selectedDate) {
      toast({ title: "No Photo", description: "Please provide or capture a photo.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    const normalizedDate = startOfDay(selectedDate);
    const newPhoto: FacePhoto = {
      id: normalizedDate.toISOString(),
      date: normalizedDate.toISOString(),
      url: previewUrl,
    };
    setPhotos(prevPhotos => {
      const updatedPhotos = prevPhotos.filter(p => p.id !== newPhoto.id);
      updatedPhotos.push(newPhoto);
      updatedPhotos.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedPhotos));
      return updatedPhotos;
    });
    setPhotoForSelectedDate(newPhoto);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast({ title: "Face Photo Saved", description: `Photo for ${format(normalizedDate, 'PPP')} stored.` });
    setIsSaving(false);
  };

  const handleDeletePhoto = (photoId: string) => {
    setPhotos(prevPhotos => {
      const updatedPhotos = prevPhotos.filter(p => p.id !== photoId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedPhotos));
      if (photoForSelectedDate?.id === photoId) setPhotoForSelectedDate(null);
      toast({ title: "Photo Deleted", description: "The face photo has been removed." });
      return updatedPhotos;
    });
  };

  useEffect(() => {
    if (isTimelapsePlaying && timelapseFrames.length > 0) {
      timelapseTimerRef.current = setInterval(() => {
        setCurrentTimelapseFrameIndex(prevIndex => {
          const nextIndex = (prevIndex + 1);
          if (nextIndex >= timelapseFrames.length) {
            if (isLooping) { setTimelapsePreviewUrl(timelapseFrames[0].url); return 0; }
            else { setIsTimelapsePlaying(false); if (timelapseTimerRef.current) clearInterval(timelapseTimerRef.current); return prevIndex; }
          }
          setTimelapsePreviewUrl(timelapseFrames[nextIndex].url);
          return nextIndex;
        });
      }, 1000 / timelapseSpeed);
    } else { if (timelapseTimerRef.current) clearInterval(timelapseTimerRef.current); }
    return () => { if (timelapseTimerRef.current) clearInterval(timelapseTimerRef.current); };
  }, [isTimelapsePlaying, timelapseFrames, timelapseSpeed, isLooping]);

  const handleInitiateTimelapseGeneration = (mode: 'weekly' | 'custom') => {
    setTimelapseMode(mode);
    if (mode === 'custom' && (!customStartDate || !customEndDate || isAfter(customStartDate, customEndDate))) {
      toast({ title: "Invalid Date Range", description: "Select valid start/end dates.", variant: "destructive" });
      return;
    }
    setIsConfirmTimelapseDialogOpen(true);
  };

  const handleConfirmGenerateTimelapse = () => {
    let photosForGen: FacePhoto[] = [];
    let rangeDesc = "";
    if (timelapseMode === 'weekly') {
      const weekStart = weekStartForTimelapse;
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
      photosForGen = photos.filter(p => { try { const d = parseISO(p.date); return d >= weekStart && d <= weekEnd; } catch (e) { return false; } })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      rangeDesc = `Week of ${format(weekStart, 'MMM d')}`;
    } else if (timelapseMode === 'custom' && customStartDate && customEndDate) {
      photosForGen = photos.filter(p => { try { const d = startOfDay(parseISO(p.date)); return !isBefore(d, startOfDay(customStartDate)) && !isAfter(d, startOfDay(customEndDate)); } catch (e) { return false; } })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      rangeDesc = `${format(customStartDate, 'MMM d')} to ${format(customEndDate, 'MMM d')}`;
    }

    if (photosForGen.length < 1) {
      toast({ title: "Not Enough Photos", description: `Need at least 1 photo in ${rangeDesc}.`, variant: "destructive" });
      setIsConfirmTimelapseDialogOpen(false); return;
    }
    setIsConfirmTimelapseDialogOpen(false); setIsGeneratingTimelapse(true); setTimelapseGenerated(false);
    setTimelapseFrames(photosForGen); setCurrentTimelapseFrameIndex(0); setTimelapsePreviewUrl(photosForGen[0]?.url || null); setIsTimelapsePlaying(false);
    
    setTimeout(() => { setIsGeneratingTimelapse(false); setTimelapseGenerated(true); toast({ title: "Simulation Ready!", description: "Preview or 'export'." }); }, 2000);
  };

  const handleTimelapsePlayPause = () => { if (timelapseFrames.length > 0) setIsTimelapsePlaying(!isTimelapsePlaying); };
  const handleTimelapseSpeedChange = (value: number[]) => setTimelapseSpeed(value[0]);
  const handleTimelapseFrameChange = (direction: 'next' | 'prev' | number) => {
    if (timelapseFrames.length === 0) return;
    setIsTimelapsePlaying(false);
    setCurrentTimelapseFrameIndex(prev => {
      let next;
      if (typeof direction === 'number') next = Math.max(0, Math.min(direction, timelapseFrames.length - 1));
      else if (direction === 'next') next = (prev + 1) % timelapseFrames.length;
      else next = (prev - 1 + timelapseFrames.length) % timelapseFrames.length;
      setTimelapsePreviewUrl(timelapseFrames[next].url);
      return next;
    });
  };
  const handleExportTimelapse = () => {
    if (!timelapseGenerated || timelapseFrames.length === 0) {
      toast({ title: "Nothing to Export", variant: "destructive" }); return;
    }
    let rangeDescPart = timelapseMode === 'weekly' ? `week_${format(weekStartForTimelapse, 'yyyy-MM-dd')}` : `custom_${format(customStartDate!, 'yyyy-MM-dd')}_to_${format(customEndDate!, 'yyyy-MM-dd')}`;
    const filename = `fitjourney_face_timelapse_${rangeDescPart}.mp4`;
    const content = `SIMULATED FACE TIMELAPSE VIDEO\nFile: ${filename}\nResolution: ${timelapseResolution}\nFormat: ${timelapseFormat}\nFrames: ${timelapseFrames.length}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast({ title: "Export Simulated", description: `Description file '${filename}' downloaded.` });
  };
  
  const uniquePhotoDates = useMemo(() => {
    const dates = photos.map(p => { try { return startOfDay(parseISO(p.date)).toISOString(); } catch (e) { return null; } })
                      .filter((date): date is string => date !== null);
    return [...new Set(dates)].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }, [photos]);

  return (
    <div className="flex flex-col min-h-screen bg-background p-4 pb-20">
      <Link href="/" className="text-sm text-primary hover:underline absolute top-4 left-4 flex items-center z-10">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back Home
      </Link>
      <Card className="w-full max-w-6xl mx-auto shadow-lg mt-10">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary flex items-center justify-center"><Smile className="mr-2 h-8 w-8"/>Face Timelapse Tracker</CardTitle>
          <CardDescription>Track changes in your face over time. Upload daily photos and create timelapses.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-x-8 gap-y-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl flex items-center"><CameraIcon className="mr-2 h-5 w-5 text-primary" /> Daily Face Photo</CardTitle>
                <CardDescription>Select a date, then upload or capture your face photo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  className="rounded-md border self-center mx-auto"
                  modifiers={{ hasPhoto: daysWithPhotos }}
                  modifiersStyles={{ hasPhoto: { fontWeight: 'bold', color: 'hsl(var(--primary))' } }}
                  disabled={(date) => date > new Date() && !isSameDay(date, new Date())}
                />
                {selectedDate && <div className="text-center text-sm font-medium">Selected: {format(selectedDate, 'PPP')}</div>}
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={triggerFileInput} variant="outline" disabled={!selectedDate || isSaving || showCamera || isCountingDown}><Upload className="mr-2 h-4 w-4" /> Upload</Button>
                  <Button onClick={handleTakePhotoClick} variant="outline" disabled={!selectedDate || isSaving || showCamera || isCountingDown}><CameraIcon className="mr-2 h-4 w-4" /> Take Photo</Button>
                  <Input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </div>
                {showCamera && (
                  <div className="space-y-2">
                    <div className="relative w-full aspect-video bg-muted rounded-md overflow-hidden">
                      <video ref={videoRef} className="w-full h-full object-contain" autoPlay muted playsInline />
                      {hasCameraPermission && <Button onClick={handleFlipCamera} variant="ghost" size="icon" className="absolute top-2 right-2 z-10 bg-background/50 hover:bg-background/80 p-1 rounded-full"><RefreshCcw className="h-5 w-5 text-foreground" /></Button>}
                      {isCountingDown && countdown !== null && countdown > 0 && <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10"><p className="text-8xl font-bold text-white drop-shadow-lg">{countdown}</p></div>}
                    </div>
                    <canvas ref={canvasRef} className="hidden"></canvas>
                    {hasCameraPermission && !isCountingDown && (
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <Button onClick={capturePhoto} variant="default" className="bg-green-600 hover:bg-green-700">Now</Button>
                        <Button onClick={() => startTimer(3)} variant="outline"><TimerIcon className="mr-1 h-4 w-4"/>3s</Button>
                        <Button onClick={() => startTimer(5)} variant="outline"><TimerIcon className="mr-1 h-4 w-4"/>5s</Button>
                      </div>
                    )}
                    <Button onClick={() => { setShowCamera(false); setIsCountingDown(false); setCountdown(null); }} variant="ghost" size="sm" className="w-full" disabled={isCountingDown}>Cancel</Button>
                  </div>
                )}
                {previewUrl && selectedDate && !photoForSelectedDate && (
                  <Card className="mt-4">
                    <CardHeader className="p-3"><CardTitle className="text-md">New Photo for {format(selectedDate, 'PPP')}</CardTitle></CardHeader>
                    <CardContent className="p-3"><Image src={previewUrl} alt="Preview" width={200} height={200} className="rounded-md object-contain mx-auto max-h-[200px]" data-ai-hint="face portrait" /></CardContent>
                    <CardFooter className="p-3"><Button onClick={handleSavePhoto} disabled={isSaving} className="w-full">{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Photo"}</Button></CardFooter>
                  </Card>
                )}
                {photoForSelectedDate && (
                  <Card className="mt-4">
                    <CardHeader className="p-3"><CardTitle className="text-md flex items-center justify-between">Photo for {format(parseISO(photoForSelectedDate.date), 'PPP')} <Button variant="ghost" size="icon" onClick={() => handleDeletePhoto(photoForSelectedDate.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button></CardTitle></CardHeader>
                    <CardContent className="p-3"><Image src={photoForSelectedDate.url} alt={`Face for ${photoForSelectedDate.date}`} width={200} height={200} className="rounded-md object-contain mx-auto max-h-[200px]" data-ai-hint="face portrait" /></CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl flex items-center"><Film className="mr-2 h-5 w-5 text-primary" /> Face Timelapse Creator</CardTitle>
                <CardDescription>Generate a weekly or custom range timelapse. Uses saved face photos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative w-full aspect-square bg-muted rounded-md flex items-center justify-center overflow-hidden">
                  {isGeneratingTimelapse && <Loader2 className="h-12 w-12 animate-spin text-primary" />}
                  {!isGeneratingTimelapse && timelapsePreviewUrl && <Image src={timelapsePreviewUrl} alt="Timelapse frame" layout="fill" objectFit="contain" data-ai-hint="face sequence" />}
                  {!isGeneratingTimelapse && !timelapsePreviewUrl && <div className="text-center text-muted-foreground p-4"><Film className="mx-auto h-16 w-16 mb-2"/><p>Generate a timelapse to preview.</p></div>}
                </div>
                {timelapseFrames.length > 0 && !isGeneratingTimelapse && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center space-x-2">
                      <Button onClick={() => handleTimelapseFrameChange('prev')} size="icon" variant="outline"><SkipBack className="h-4 w-4" /></Button>
                      <Button onClick={handleTimelapsePlayPause} size="icon" variant="outline">{isTimelapsePlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
                      <Button onClick={() => handleTimelapseFrameChange('next')} size="icon" variant="outline"><SkipForward className="h-4 w-4" /></Button>
                      <Button onClick={() => setIsLooping(!isLooping)} size="icon" variant={isLooping ? "default" : "outline"} title={isLooping ? "Loop On" : "Loop Off"}><Repeat className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="timelapse-speed" className="text-xs whitespace-nowrap">Speed (FPS): {timelapseSpeed}</Label>
                      <Slider id="timelapse-speed" min={1} max={10} step={1} defaultValue={[timelapseSpeed]} onValueChange={handleTimelapseSpeedChange} disabled={isTimelapsePlaying} />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">Frame {currentTimelapseFrameIndex + 1} of {timelapseFrames.length}</p>
                    {timelapseFrames[currentTimelapseFrameIndex]?.date && <p className="text-xs text-center text-muted-foreground">Date: {format(parseISO(timelapseFrames[currentTimelapseFrameIndex].date), 'PPP')}</p>}
                  </div>
                )}
                <Button onClick={() => handleInitiateTimelapseGeneration('weekly')} className="w-full bg-accent hover:bg-accent/90" disabled={isGeneratingTimelapse || !selectedDate}>
                  {isGeneratingTimelapse && timelapseMode === 'weekly' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FastForward className="mr-2 h-4 w-4"/>} Generate Weekly Timelapse
                </Button>
                <Button variant="outline" onClick={() => setShowCustomDateRangePicker(!showCustomDateRangePicker)} className="w-full mt-2">
                  <CalendarDays className="mr-2 h-4 w-4" /> {showCustomDateRangePicker ? 'Hide Custom Range' : 'Create Custom Range Timelapse'}
                </Button>
                {showCustomDateRangePicker && (
                  <Card className="mt-2 p-4 space-y-3 border-dashed">
                    <CardTitle className="text-md">Select Custom Date Range</CardTitle>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="custom-start-date" className="text-xs">Start Date</Label>
                        <Select value={customStartDate?.toISOString()} onValueChange={(val) => val && setCustomStartDate(parseISO(val))}>
                          <SelectTrigger id="custom-start-date"><SelectValue placeholder="Start Date" /></SelectTrigger>
                          <SelectContent>{uniquePhotoDates.map(d => <SelectItem key={`s-${d}`} value={d} disabled={customEndDate ? isAfter(parseISO(d), customEndDate) : false}>{format(parseISO(d), 'PPP')}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="custom-end-date" className="text-xs">End Date</Label>
                        <Select value={customEndDate?.toISOString()} onValueChange={(val) => val && setCustomEndDate(parseISO(val))} disabled={!customStartDate}>
                          <SelectTrigger id="custom-end-date"><SelectValue placeholder="End Date" /></SelectTrigger>
                          <SelectContent>{uniquePhotoDates.filter(d => customStartDate ? !isBefore(parseISO(d), customStartDate) : true).map(d => <SelectItem key={`e-${d}`} value={d}>{format(parseISO(d), 'PPP')}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button onClick={() => handleInitiateTimelapseGeneration('custom')} className="w-full" disabled={isGeneratingTimelapse || !customStartDate || !customEndDate || isAfter(customStartDate, customEndDate)}>
                      {isGeneratingTimelapse && timelapseMode === 'custom' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FastForward className="mr-2 h-4 w-4"/>} Generate from Range
                    </Button>
                  </Card>
                )}
              </CardContent>
            </Card>
            <Card className={cn((!timelapseGenerated || isGeneratingTimelapse) && "opacity-50 pointer-events-none")}>
              <CardHeader><CardTitle className="text-lg flex items-center"><Upload className="mr-2 h-5 w-5"/> Export Timelapse (Simulated)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="resolution">Resolution</Label>
                  <Select value={timelapseResolution} onValueChange={setTimelapseResolution}><SelectTrigger id="resolution"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="720p">720p</SelectItem><SelectItem value="1080p">1080p</SelectItem><SelectItem value="4k">4K</SelectItem></SelectContent></Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="format-export">Format</Label>
                  <Select value={timelapseFormat} onValueChange={setTimelapseFormat}><SelectTrigger id="format-export"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mp4">MP4</SelectItem><SelectItem value="gif">GIF</SelectItem></SelectContent></Select>
                </div>
                <Button onClick={handleExportTimelapse} className="w-full">Export Simulated Video</Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
      <Dialog open={isConfirmTimelapseDialogOpen} onOpenChange={setIsConfirmTimelapseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Confirm Timelapse Generation</DialogTitle><DialogDescription>This is a simulated process.</DialogDescription></DialogHeader>
          <DialogFooterComponent><Button variant="outline" onClick={() => setIsConfirmTimelapseDialogOpen(false)}>Cancel</Button><Button onClick={handleConfirmGenerateTimelapse} disabled={isGeneratingTimelapse}>{isGeneratingTimelapse && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm & Generate</Button></DialogFooterComponent>
        </DialogContent>
      </Dialog>
    </div>
  );
}
