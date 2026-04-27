'use client';

// src/app/upload/page.tsx
// Body Progress page — now uses PhysiqueNet on-device
// Photos NEVER leave the device

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button }   from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge }    from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  UserSquare2, ArrowLeft, Camera as CameraIcon, Upload,
  Sparkles, Loader2, AlertCircle, Trash2, Film,
  TrendingDown, Target, Dumbbell, ShieldCheck, FileText,
  RotateCcw, Play
} from 'lucide-react';
import { format, parseISO, isSameDay } from 'date-fns';

// Lazy load heavy components
const Calendar = dynamic(
  () => import('@/components/ui/calendar').then(m => m.Calendar),
  { ssr: false, loading: () => <div className="h-72 bg-muted animate-pulse rounded-lg" /> }
);

// PhysiqueNet imports
import {
  scanBody, loadModels, modelsLoaded, type ScanResult
} from '@/lib/physiquenet';
import { recommend, type VideoRec }      from '@/lib/recommender';
import {
  saveScan, loadAllScans, loadProfile, getWeeklyStats,
  getGoalProgress, exportPDFReport, type StoredScan
} from '@/lib/progress-tracker';

// ── TYPES ─────────────────────────────────────────────────────

interface PhotoEntry {
  id:        string;
  date:      string;
  url:       string;
  scanResult?: ScanResult;
}

// ── HELPERS ───────────────────────────────────────────────────

function dataUrlToFile(dataUrl: string, filename: string): File | null {
  const arr  = dataUrl.split(',');
  if (arr.length < 2) return null;
  const mime = arr[0].match(/:(.*?);/)?.[1];
  if (!mime) return null;
  const bstr = atob(arr[1]);
  const u8   = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
  return new File([u8], filename, { type: mime });
}

function getConfidenceColor(conf: number): string {
  if (conf >= 0.6)  return 'text-green-500';
  if (conf >= 0.35) return 'text-yellow-500';
  return 'text-red-500';
}

function getCategoryColor(cat: string): string {
  if (cat === 'Athlete')          return 'bg-green-100 text-green-800';
  if (cat === 'Fitness')          return 'bg-blue-100 text-blue-800';
  if (cat === 'Average')          return 'bg-yellow-100 text-yellow-800';
  if (cat === 'Above Average')    return 'bg-orange-100 text-orange-800';
  return 'bg-gray-100 text-gray-800';
}

// ── MAIN COMPONENT ────────────────────────────────────────────

export default function UploadPhotoPage() {
  const { toast } = useToast();

  // Photos (localStorage — same as before)
  const [photos, setPhotos]               = useState<PhotoEntry[]>([]);
  const [selectedDate, setSelectedDate]   = useState<Date>(new Date());
  const [photoForDate, setPhotoForDate]   = useState<PhotoEntry | null>(null);
  const [isLoading, setIsLoading]         = useState(true);

  // Camera / upload
  const [previewUrl, setPreviewUrl]       = useState<string | null>(null);
  const [showCamera, setShowCamera]       = useState(false);
  const [stream, setStream]               = useState<MediaStream | null>(null);
  const videoRef                          = useRef<HTMLVideoElement>(null);
  const canvasRef                         = useRef<HTMLCanvasElement>(null);
  const fileInputRef                      = useRef<HTMLInputElement>(null);

  // Scan state
  const [isAnalyzing, setIsAnalyzing]     = useState(false);
  const [modelLoading, setModelLoading]   = useState(false);
  const [modelLoadMsg, setModelLoadMsg]   = useState('');
  const [scanResult, setScanResult]       = useState<ScanResult | null>(null);
  const [recommendations, setRecommendations] = useState<VideoRec[]>([]);

  // Progress
  const [scanHistory, setScanHistory]     = useState<StoredScan[]>([]);
  const [weeklyStats, setWeeklyStats]     = useState<ReturnType<typeof getWeeklyStats>>(null);
  const [goalProgress, setGoalProgress]   = useState(0);

  // Video player
  const [activeVideo, setActiveVideo]     = useState<string | null>(null);
  const [activeVideoTitle, setActiveVideoTitle] = useState('');

  // Profile
  const profile = typeof window !== 'undefined' ? loadProfile() : null;
  const isMale  = (profile?.gender ?? 'male') === 'male';
  const weightKg = profile?.weightKg ?? 70;
  const goalBf   = profile?.goalBf   ?? 18;

  // ── LOAD DATA ────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem('fitjourney_body_photos') || '[]'
      ) as PhotoEntry[];
      setPhotos(saved.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ));
      setScanHistory(loadAllScans());
      setWeeklyStats(getWeeklyStats());
      setGoalProgress(getGoalProgress(goalBf));
    } finally {
      setIsLoading(false);
    }
  }, [goalBf]);

  useEffect(() => {
    const found = photos.find(p => isSameDay(parseISO(p.date), selectedDate));
    setPhotoForDate(found ?? null);
    setScanResult(found?.scanResult ?? null);
    setPreviewUrl(null);
  }, [selectedDate, photos]);

  // ── CAMERA ───────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } }
      });
      setStream(s);
      setShowCamera(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s; }, 100);
    } catch {
      toast({ variant: 'destructive', title: 'Camera Denied',
              description: 'Allow camera access in browser settings.' });
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setShowCamera(false);
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const v   = videoRef.current;
    const c   = canvasRef.current;
    c.width   = v.videoWidth;
    c.height  = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    const url = c.toDataURL('image/jpeg', 0.92);
    setPreviewUrl(url);
    stopCamera();
  }, [stopCamera]);

  // ── SCAN ─────────────────────────────────────────────────────
  const handleScan = async () => {
    if (!previewUrl) return;
    setIsAnalyzing(true);

    try {
      // Load models on first use
      if (!modelsLoaded()) {
        setModelLoading(true);
        setModelLoadMsg('Loading AI models (first time ~10s)...');
        await loadModels((msg, pct) => setModelLoadMsg(msg));
        setModelLoading(false);
      }

      toast({ title: 'Scanning...', description: 'AI running on your device' });

      const result = await scanBody(previewUrl, isMale, weightKg);
      setScanResult(result);

      // Get exercise recommendations
      const recs = recommend(result.bf, goalBf, isMale);
      setRecommendations(recs.primary);

      // Save scan to history
      saveScan(result);
      setScanHistory(loadAllScans());
      setWeeklyStats(getWeeklyStats());
      setGoalProgress(getGoalProgress(goalBf));

      // Save photo entry to existing system
      const dateStr  = selectedDate.toISOString();
      const newPhoto: PhotoEntry = {
        id:         Date.now().toString(),
        date:       dateStr,
        url:        previewUrl,
        scanResult: result,
      };
      const updated = [
        ...photos.filter(p => !isSameDay(parseISO(p.date), selectedDate)),
        newPhoto,
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPhotos(updated);
      setPhotoForDate(newPhoto);
      localStorage.setItem('fitjourney_body_photos', JSON.stringify(updated));

      // Confidence feedback
      if (result.conf < 0.35) {
        toast({
          variant:     'destructive',
          title:       'Low Confidence Scan',
          description: 'Try a plain background and good lighting for better results.',
        });
      } else {
        toast({
          title:       `Scan Complete — ${result.bf}% Body Fat`,
          description: `${result.category} · Confidence: ${Math.round(result.conf * 100)}%`,
        });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Scan Failed',
              description: err.message || 'Unknown error' });
    } finally {
      setIsAnalyzing(false);
      setModelLoading(false);
    }
  };

  const handleDelete = () => {
    const updated = photos.filter(
      p => !isSameDay(parseISO(p.date), selectedDate)
    );
    setPhotos(updated);
    setPhotoForDate(null);
    setScanResult(null);
    setPreviewUrl(null);
    localStorage.setItem('fitjourney_body_photos', JSON.stringify(updated));
    toast({ title: 'Photo deleted' });
  };

  // ── UI ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-primary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg">Body Progress</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-green-500" />
            Photos stay on your device
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full p-4 space-y-4">

        {/* ── PROGRESS SUMMARY ─────────────────────────────── */}
        {scanHistory.length > 0 && (
          <Card>
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-muted-foreground">Current Body Fat</p>
                  <p className="text-3xl font-bold text-primary">
                    {scanHistory[0].bf}%
                  </p>
                  <Badge className={getCategoryColor(scanHistory[0].category)}>
                    {scanHistory[0].category}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Goal</p>
                  <p className="text-3xl font-bold">{goalBf}%</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.max(0, scanHistory[0].bf - goalBf).toFixed(1)}% to go
                  </p>
                </div>
              </div>

              {/* Goal progress bar */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Goal Progress</span>
                  <span>{goalProgress}%</span>
                </div>
                <Progress value={goalProgress} className="h-2" />
              </div>

              {/* Weekly stats */}
              {weeklyStats && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                  <div className="text-center">
                    <p className={`font-bold ${weeklyStats.bfChange < 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {weeklyStats.bfChange > 0 ? '+' : ''}{weeklyStats.bfChange}%
                    </p>
                    <p className="text-xs text-muted-foreground">Week BF</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold">{scanHistory[0].fatMass}kg</p>
                    <p className="text-xs text-muted-foreground">Fat Mass</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold">{scanHistory[0].leanMass}kg</p>
                    <p className="text-xs text-muted-foreground">Lean Mass</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── CALENDAR ─────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Select Date to Scan</CardTitle>
            <CardDescription>
              {photos.length} photos logged
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isLoading && (
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                modifiers={{
                  hasPhoto: photos.map(p => parseISO(p.date)),
                }}
                modifiersStyles={{
                  hasPhoto: { fontWeight: 'bold', color: 'var(--primary)' },
                }}
                className="rounded-md"
              />
            )}
          </CardContent>
        </Card>

        {/* ── PHOTO / CAMERA AREA ───────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {format(selectedDate, 'MMMM d, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">

            {/* Camera view */}
            {showCamera && (
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  autoPlay muted playsInline
                  className="w-full aspect-[3/4] object-cover"
                />
                {/* Guide overlay */}
                <div className="absolute inset-x-8 inset-y-4 border-2 border-white/40 rounded-xl pointer-events-none" />
                <p className="absolute bottom-16 left-0 right-0 text-center text-white/70 text-xs">
                  Stand straight — full body visible
                </p>
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                  <Button onClick={stopCamera} variant="secondary" size="sm">Cancel</Button>
                  <Button onClick={capturePhoto}
                    className="bg-white text-black hover:bg-gray-100 rounded-full h-12 w-12 p-0">
                    📸
                  </Button>
                </div>
              </div>
            )}

            {/* Preview */}
            {(previewUrl || photoForDate?.url) && !showCamera && (
              <div className="relative">
                <Image
                  src={previewUrl ?? photoForDate!.url}
                  alt="Body photo"
                  width={400}
                  height={600}
                  className="w-full rounded-lg object-cover max-h-80"
                />
                {photoForDate && !previewUrl && (
                  <Button
                    onClick={handleDelete}
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            {/* No photo placeholder */}
            {!showCamera && !previewUrl && !photoForDate && (
              <div
                className="w-full h-48 bg-secondary rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <UserSquare2 className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground text-sm">Tap to upload or take photo</p>
                <p className="text-xs text-muted-foreground mt-1">Full body, plain background works best</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onloadend = () => setPreviewUrl(r.result as string);
                r.readAsDataURL(f);
              }}
            />

            {/* Buttons */}
            {!showCamera && (
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                  <Upload className="h-4 w-4 mr-2" /> Upload
                </Button>
                <Button onClick={startCamera} variant="outline">
                  <CameraIcon className="h-4 w-4 mr-2" /> Camera
                </Button>
              </div>
            )}

            {/* Model loading indicator */}
            {modelLoading && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>{modelLoadMsg}</AlertDescription>
              </Alert>
            )}

            {/* Scan button */}
            {previewUrl && !isAnalyzing && (
              <Button onClick={handleScan} className="w-full" size="lg">
                <Sparkles className="h-4 w-4 mr-2" />
                Scan Body Composition
              </Button>
            )}

            {isAnalyzing && (
              <Button disabled className="w-full" size="lg">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing on your device...
              </Button>
            )}

            {/* Retake button */}
            {scanResult && (
              <Button
                onClick={() => { setPreviewUrl(null); setScanResult(null); }}
                variant="outline"
                className="w-full"
              >
                <RotateCcw className="h-4 w-4 mr-2" /> Retake Photo
              </Button>
            )}
          </CardContent>
        </Card>

        {/* ── SCAN RESULTS ──────────────────────────────────── */}
        {scanResult && (
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-primary" />
                Scan Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Main metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-primary/5 rounded-xl p-4 text-center">
                  <p className="text-4xl font-bold text-primary">{scanResult.bf}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Body Fat</p>
                  <Badge className={`mt-2 ${getCategoryColor(scanResult.category)}`}>
                    {scanResult.category}
                  </Badge>
                </div>
                <div className="bg-secondary rounded-xl p-4 text-center">
                  <p className="text-4xl font-bold">{scanResult.shape}</p>
                  <p className="text-xs text-muted-foreground mt-1">Shape Score /100</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 bg-secondary rounded-lg">
                  <p className="font-bold">{scanResult.fatMass}kg</p>
                  <p className="text-xs text-muted-foreground">Fat Mass</p>
                </div>
                <div className="text-center p-3 bg-secondary rounded-lg">
                  <p className="font-bold">{scanResult.leanMass}kg</p>
                  <p className="text-xs text-muted-foreground">Lean Mass</p>
                </div>
                <div className="text-center p-3 bg-secondary rounded-lg">
                  <p className={`font-bold text-sm ${getConfidenceColor(scanResult.conf)}`}>
                    {Math.round(scanResult.conf * 100)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Confidence</p>
                </div>
              </div>

              {/* Confidence notice */}
              {scanResult.conf < 0.35 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Low Confidence</AlertTitle>
                  <AlertDescription>
                    Only {scanResult.coverage}% of your body was detected.
                    Try: plain white/grey wall behind you, better lighting, full body visible.
                  </AlertDescription>
                </Alert>
              )}

              {/* Goal gap */}
              <div className="bg-secondary rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm">Goal: {goalBf}% BF</span>
                </div>
                <span className="font-bold text-sm">
                  {scanResult.bf > goalBf
                    ? `${(scanResult.bf - goalBf).toFixed(1)}% to go`
                    : '🎉 Goal reached!'
                  }
                </span>
              </div>

              {/* Export PDF */}
              <Button
                onClick={() => exportPDFReport(30)}
                variant="outline"
                className="w-full"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export 30-Day Report (PDF)
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── EXERCISE RECOMMENDATIONS ──────────────────────── */}
        {recommendations.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Dumbbell className="h-5 w-5 text-primary" />
                Today&apos;s Workouts for You
              </CardTitle>
              <CardDescription>
                Based on your {scanResult?.bf}% body fat — targeting {goalBf}%
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recommendations.map(video => (
                <div
                  key={video.id}
                  className="flex items-center gap-3 p-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
                  onClick={() => {
                    setActiveVideo(video.file);
                    setActiveVideoTitle(video.title);
                  }}
                >
                  <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Play className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{video.title}</p>
                    <p className="text-xs text-muted-foreground">{video.duration} · ~{video.calories} cal</p>
                    <p className="text-xs text-primary mt-0.5">{video.reason}</p>
                  </div>
                  <Badge variant="outline">{'★'.repeat(video.difficulty)}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── VIDEO PLAYER ──────────────────────────────────── */}
        {activeVideo && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{activeVideoTitle}</CardTitle>
                <Button
                  onClick={() => setActiveVideo(null)}
                  variant="ghost"
                  size="sm"
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <video
                src={activeVideo}
                controls
                autoPlay
                playsInline
                className="w-full rounded-lg"
              />
            </CardContent>
          </Card>
        )}

        {/* ── PHOTO HISTORY ─────────────────────────────────── */}
        {photos.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Film className="h-5 w-5" />
                Photo History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {photos.slice(0, 9).map(p => (
                  <div
                    key={p.id}
                    className="relative cursor-pointer rounded-lg overflow-hidden aspect-[3/4] bg-secondary"
                    onClick={() => setSelectedDate(parseISO(p.date))}
                  >
                    <Image
                      src={p.url}
                      alt={p.date}
                      fill
                      className="object-cover"
                    />
                    {p.scanResult && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-center text-xs py-1">
                        {p.scanResult.bf}% BF
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      {/* Hidden canvas for camera capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
