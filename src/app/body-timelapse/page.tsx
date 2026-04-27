'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  ArrowLeft, Film, Play, RotateCcw, 
  Download, Calendar as CalendarIcon, TrendingUp, Info,
  Repeat, PlayCircle, Loader2, Settings2, Hash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { format, parseISO, isSameDay, differenceInDays } from 'date-fns';
import { useToast } from "@/hooks/use-toast";

type ScanMode = 'front_view' | 'side_view' | 'back_view' | 'upper_body';

interface PhotoEntry {
  id: string;
  date: string;
  url: string;
  scanResult?: {
    bf: number;
    scanMode?: ScanMode | string;
    confDisplay?: number;
  };
}

export default function BodyTimelapsePage() {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Timelapse state
  const [isTimelapsePlaying, setIsTimelapsePlaying] = useState(false);
  const [timelapseFrames, setTimelapseFrames] = useState<PhotoEntry[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [timelapseSpeed, setTimelapseSpeed] = useState(4); // FPS
  const [timelapseFilter, setTimelapseFilter] = useState<ScanMode | 'all'>('all');
  const [isLooping, setIsLooping] = useState(true);
  const timelapseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Overlay state
  const [showDate, setShowDate] = useState(true);
  const [showBf, setShowBf] = useState(true);
  const [showDayCount, setShowDayCount] = useState(false);

  // Calendar state
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>(new Date());

  // Load photos
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem('fitjourney_body_photos') || '[]') as PhotoEntry[];
        const sorted = saved.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setPhotos(sorted);
        setTimelapseFrames(sorted);
      } catch (error) {
        console.error('Error loading photos:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  // Playback engine
  useEffect(() => {
    if (isTimelapsePlaying && timelapseFrames.length > 1) {
      timelapseTimerRef.current = setInterval(() => {
        setCurrentFrameIndex(prev => {
          const nextIndex = (prev + 1);
          if (nextIndex >= timelapseFrames.length) {
            if (isLooping) return 0;
            setIsTimelapsePlaying(false);
            return prev;
          }
          return nextIndex;
        });
      }, 1000 / timelapseSpeed);
      return () => {
        if (timelapseTimerRef.current) clearInterval(timelapseTimerRef.current);
      }
    }
  }, [isTimelapsePlaying, timelapseFrames, timelapseSpeed, isLooping]);

  const handleFilterChange = (filter: ScanMode | 'all') => {
    setTimelapseFilter(filter);
    setIsTimelapsePlaying(false);
    const filtered = photos.filter(p => filter === 'all' || p.scanResult?.scanMode === filter);
    setTimelapseFrames(filtered);
    setCurrentFrameIndex(0);
  };

  const getDayLabel = (dateStr: string) => {
     if (photos.length === 0) return '';
     const firstPhotoDate = parseISO(photos[0].date);
     const currentPhotoDate = parseISO(dateStr);
     const diff = differenceInDays(currentPhotoDate, firstPhotoDate);
     return `Day ${diff + 1}`;
  };

  const jumpToDate = (date: Date | undefined) => {
    if (!date) return;
    const foundIdx = timelapseFrames.findIndex(p => isSameDay(parseISO(p.date), date));
    if (foundIdx !== -1) {
      setIsTimelapsePlaying(false);
      setCurrentFrameIndex(foundIdx);
    } else {
       const allIdx = photos.findIndex(p => isSameDay(parseISO(p.date), date));
       if (allIdx !== -1) {
          setTimelapseFilter('all');
          setTimelapseFrames(photos);
          setIsTimelapsePlaying(false);
          setCurrentFrameIndex(allIdx);
       }
    }
    setSelectedCalendarDate(date);
  };

  const handleExportRealVideo = async () => {
    if (timelapseFrames.length < 2) return;
    setIsExporting(true);
    toast({ title: "Generating Video", description: "This will take a few seconds..." });

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("No canvas context");

      canvas.width = 720;
      canvas.height = 1280;

      const stream = canvas.captureStream(timelapseSpeed);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `body_timelapse_${format(new Date(), 'yyyyMMdd')}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsExporting(false);
        toast({ title: "Export Complete!", description: "Video saved to downloads." });
      };

      recorder.start();

      for (const frame of timelapseFrames) {
        const img = new (window as any).Image();
        img.src = frame.url;
        await new Promise((resolve) => {
          img.onload = () => {
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
            const x = (canvas.width / 2) - (img.width / 2) * scale;
            const y = (canvas.height / 2) - (img.height / 2) * scale;
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

            // Conditional Overlays
            let overlayY = 40;

            if (showDate) {
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.fillRect(30, overlayY, 280, 60);
                ctx.fillStyle = 'white';
                ctx.font = 'bold 24px sans-serif';
                ctx.fillText(format(parseISO(frame.date), 'MMM d, yyyy'), 50, overlayY + 40);
                overlayY += 80;
            }

            if (showDayCount) {
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(30, overlayY, 150, 60);
                ctx.fillStyle = 'white';
                ctx.font = 'bold 28px sans-serif';
                ctx.fillText(getDayLabel(frame.date), 50, overlayY + 42);
                overlayY += 80;
            }

            if (showBf && frame.scanResult) {
                ctx.fillStyle = '#10b981'; 
                ctx.beginPath();
                ctx.roundRect(canvas.width - 200, 40, 170, 60, 30);
                ctx.fill();
                ctx.fillStyle = 'white';
                ctx.font = 'bold 24px sans-serif';
                ctx.fillText(`${frame.scanResult.bf}% BF`, canvas.width - 175, 80);
            }

            resolve(null);
          };
        });
        await new Promise(r => setTimeout(r, 1000 / timelapseSpeed));
      }

      recorder.stop();
    } catch (err) {
      console.error(err);
      setIsExporting(false);
      toast({ title: "Export Failed", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Film className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20 px-4 pt-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto w-full mb-6">
        <Link href="/" className="inline-flex items-center text-sm text-primary hover:underline mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back Home
        </Link>
        <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
          <Film className="h-8 w-8 text-accent" /> Body Timelapse
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Watch your physical transformation come to life.
        </p>
      </div>

      <div className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8">
        
        {/* Left: Player */}
        <div className="space-y-6">
          {photos.length < 2 ? (
            <Card className="border-dashed py-20 bg-accent/5">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Film className="h-8 w-8 text-primary opacity-50" />
                </div>
                <p className="font-semibold">Not enough photos yet</p>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                  You need at least 2 photos in your Body Progress history to generate a timelapse.
                </p>
                <Button asChild className="mt-6">
                  <Link href="/upload">Take a Photo</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden bg-accent/5 border-primary/20 shadow-xl rounded-3xl">
              <CardContent className="p-0">
                <div className="flex gap-2 p-3 bg-background/60 backdrop-blur overflow-x-auto no-scrollbar border-b">
                  {(['all', 'front_view', 'side_view', 'back_view', 'upper_body'] as const).map(f => (
                    <Button 
                      key={f}
                      variant={timelapseFilter === f ? 'default' : 'outline'}
                      size="sm"
                      className="text-[10px] h-8 px-4 capitalize rounded-full whitespace-nowrap"
                      onClick={() => handleFilterChange(f)}
                    >
                      {f.replace('_', ' ')}
                    </Button>
                  ))}
                </div>

                <div className="relative aspect-[3/4] bg-[#0a0a0a] overflow-hidden group">
                  {timelapseFrames.length > 0 ? (
                    <>
                      <Image 
                        src={timelapseFrames[currentFrameIndex].url}
                        alt="Progress Frame"
                        fill
                        className="object-contain"
                        priority
                      />
                      
                      {/* Overlays */}
                      <div className="absolute top-6 left-6 flex flex-col gap-2">
                         {showDate && (
                            <Badge className="bg-black/60 backdrop-blur-md border-none text-white text-[11px] font-medium px-4 py-2 rounded-full shadow-lg">
                              {format(parseISO(timelapseFrames[currentFrameIndex].date), 'MMM d, yyyy')}
                            </Badge>
                         )}
                         {showDayCount && (
                            <Badge className="bg-black/80 backdrop-blur-md border-none text-white text-[13px] font-bold px-5 py-2.5 rounded-full shadow-xl w-fit">
                               {getDayLabel(timelapseFrames[currentFrameIndex].date)}
                            </Badge>
                         )}
                         {showBf && timelapseFrames[currentFrameIndex].scanResult && (
                           <Badge className="bg-accent border-none text-white text-[11px] font-heavy px-4 py-2 rounded-full shadow-lg w-fit">
                             {timelapseFrames[currentFrameIndex].scanResult?.bf}% Body Fat
                           </Badge>
                         )}
                      </div>
                      <div className="absolute bottom-6 right-6">
                         <Badge variant="outline" className="bg-black/40 backdrop-blur-sm border-white/20 text-white text-[10px] font-bold px-3 py-1.5 rounded-full">
                           {currentFrameIndex + 1} / {timelapseFrames.length}
                         </Badge>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-12 text-center text-muted-foreground bg-secondary/20">
                      <Info className="h-12 w-12 mb-4 opacity-20" />
                      <p className="font-semibold">No photos for this angle</p>
                    </div>
                  )}
                </div>

                {timelapseFrames.length > 0 && (
                  <div className="p-6 space-y-6 bg-background/50">
                    <div className="flex items-center justify-center gap-6">
                       <Button 
                         variant={isLooping ? "default" : "outline"} size="icon" 
                         className={`h-12 w-12 rounded-full transition-all ${isLooping ? 'bg-accent/20 text-accent hover:bg-accent/30' : 'opacity-50'}`}
                         onClick={() => setIsLooping(!isLooping)}
                       >
                         <Repeat className="h-5 w-5" />
                       </Button>

                       <Button 
                         variant="ghost" size="icon" className="h-12 w-12 rounded-full bg-secondary"
                         onClick={() => { setIsTimelapsePlaying(false); setCurrentFrameIndex(prev => (prev - 1 + timelapseFrames.length) % timelapseFrames.length); }}
                       >
                         <RotateCcw className="h-5 w-5 rotate-180" />
                       </Button>

                       <Button 
                         variant="default" size="lg" 
                         className="h-16 w-16 rounded-full shadow-lg bg-accent hover:bg-accent/90"
                         onClick={() => setIsTimelapsePlaying(!isTimelapsePlaying)}
                       >
                          {isTimelapsePlaying ? <div className="flex gap-1.5"><div className="h-6 w-1.5 bg-white rounded-full"/><div className="h-6 w-1.5 bg-white rounded-full"/></div> : <Play className="h-8 w-8 fill-white ml-1" />}
                       </Button>

                       <Button 
                         variant="ghost" size="icon" className="h-12 w-12 rounded-full bg-secondary"
                         onClick={() => { setIsTimelapsePlaying(false); setCurrentFrameIndex(prev => (prev + 1) % timelapseFrames.length); }}
                       >
                         <RotateCcw className="h-5 w-5" />
                       </Button>

                       <Button 
                         variant={!isLooping ? "default" : "outline"} size="icon" 
                         className={`h-12 w-12 rounded-full transition-all ${!isLooping ? 'bg-accent/20 text-accent hover:bg-accent/30' : 'opacity-50'}`}
                         onClick={() => setIsLooping(false)}
                       >
                         <PlayCircle className="h-5 w-5" />
                       </Button>
                    </div>

                    <div className="space-y-2">
                       <Progress 
                        value={(timelapseSpeed / 10) * 100} 
                        className="h-2 cursor-pointer"
                        onClick={(e) => {
                           const rect = e.currentTarget.getBoundingClientRect();
                           const pct = (e.clientX - rect.left) / rect.width;
                           setTimelapseSpeed(Math.max(1, Math.round(pct * 10)));
                        }}
                      />
                      <div className="flex justify-between items-center text-[9px] font-bold text-muted-foreground uppercase px-1">
                        <span>Speed</span>
                        <span className="text-primary">{timelapseSpeed} FPS</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <Button onClick={handleExportRealVideo} variant="outline" className="rounded-2xl h-12 shadow-sm relative" disabled={isExporting}>
                        {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                        {isExporting ? "Recording..." : "Export Video"}
                      </Button>
                      <Button asChild variant="secondary" className="rounded-2xl h-12 shadow-sm">
                        <Link href="/upload"><RotateCcw className="h-4 w-4 mr-2" /> New Photo</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Settings & Calendar */}
        <div className="space-y-6">
          {/* Overlay Customization */}
          <Card className="rounded-3xl border-none shadow-xl bg-accent/5">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-accent" /> Video Customization
              </CardTitle>
              <CardDescription>Choose what stats to show in your video.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6 pt-0">
               <div className="flex items-center justify-between p-3 bg-background/40 rounded-2xl border">
                  <div className="flex flex-col gap-0.5">
                     <Label className="text-sm font-bold flex items-center gap-2">
                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" /> Show Date
                     </Label>
                     <span className="text-[10px] text-muted-foreground">Display the exact day taken</span>
                  </div>
                  <Switch checked={showDate} onCheckedChange={setShowDate} />
               </div>

               <div className="flex items-center justify-between p-3 bg-background/40 rounded-2xl border">
                  <div className="flex flex-col gap-0.5">
                     <Label className="text-sm font-bold flex items-center gap-2">
                        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" /> Show Body Fat
                     </Label>
                     <span className="text-[10px] text-muted-foreground">Display AI composition stats</span>
                  </div>
                  <Switch checked={showBf} onCheckedChange={setShowBf} />
               </div>

               <div className="flex items-center justify-between p-3 bg-background/40 rounded-2xl border">
                  <div className="flex flex-col gap-0.5">
                     <Label className="text-sm font-bold flex items-center gap-2">
                        <Hash className="h-3.5 w-3.5 text-muted-foreground" /> Show Day Count
                     </Label>
                     <span className="text-[10px] text-muted-foreground">Label as Day 1, Day 2, etc.</span>
                  </div>
                  <Switch checked={showDayCount} onCheckedChange={setShowDayCount} />
               </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-xl bg-accent/5 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-accent" /> Progress Calendar
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center p-6 bg-background/20">
              <Calendar
                mode="single"
                selected={selectedCalendarDate}
                onSelect={jumpToDate}
                modifiers={{
                   hasPhoto: (date) => photos.some(p => isSameDay(parseISO(p.date), date)),
                }}
                modifiersStyles={{
                   hasPhoto: { fontWeight: 'bold', borderBottom: '2px solid var(--accent)' },
                }}
                className="rounded-2xl border bg-background shadow-lg p-3"
              />
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-lg bg-primary/5">
            <CardHeader className="pb-2">
               <CardTitle className="text-base flex items-center gap-2 font-bold text-primary">
                 <Info className="h-5 w-5 text-primary" /> Tips
               </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-muted-foreground px-6 pb-6">
               <p>Your choices here will be <strong>saved into the exported MP4</strong> so it looks exactly like the preview.</p>
               <p>Day 1 is your very first scan in the history.</p>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
