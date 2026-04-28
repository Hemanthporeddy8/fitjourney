'use client';

// src/app/upload/page.tsx  WITH POSE GUIDE + BODY TYPE DETECTION

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
  ArrowLeft, Camera as CameraIcon, Upload, Sparkles, Loader2,
  AlertCircle, Trash2, Film, TrendingDown, Target, Dumbbell,
  ShieldCheck, FileText, RotateCcw, Play, User, UserCheck,
  ChevronRight, Info, BrainCircuit
} from 'lucide-react';
import { format, parseISO, isSameDay } from 'date-fns';

const Calendar = dynamic(
  () => import('@/components/ui/calendar').then(m => m.Calendar),
  { ssr: false, loading: () => <div className="h-72 bg-muted animate-pulse rounded-lg" /> }
);

import {
  scanBody, loadModels, modelsLoaded, type ScanResult, type BodyType
} from '@/lib/physiquenet';
import { recommend, type VideoRec } from '@/lib/recommender';
import {
  saveScan, loadAllScans, loadProfile, getWeeklyStats,
  getGoalProgress, exportPDFReport, type StoredScan
} from '@/lib/progress-tracker';

//  TYPES 

interface PhotoEntry {
  id: string; date: string; url: string; scanResult?: ScanResult;
}

//  SCAN MODE 
// Added 3 primary poses for 360-degree coverage
type ScanMode = 'front_view' | 'side_view' | 'back_view' | 'upper_body';

//  HELPERS 

function getCategoryColor(cat: string): string {
  if (cat === 'Athlete')       return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (cat === 'Fitness')       return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  if (cat === 'Average')       return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  if (cat === 'Above Average') return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
  return 'bg-gray-100 text-gray-800';
}

function getConfidenceColor(display: number): string {
  if (display >= 65) return 'text-green-500';
  if (display >= 45) return 'text-yellow-500';
  if (display >= 30) return 'text-orange-500';
  return 'text-red-500';
}

function getBodyTypeIcon(bodyType: BodyType): string {
  if (bodyType === 'full_body')  return '';
  if (bodyType === 'upper_body') return '';
  if (bodyType === 'lower_body') return '';
  return '';
}

//  POSE GUIDE OVERLAY 
// Like KYC face verification but for body
// Shows a silhouette that user aligns to

function PoseGuideOverlay({ mode }: { mode: ScanMode }) {
  const getSilhouette = () => {
    if (mode === 'front_view') {
      return (
        <svg viewBox="0 0 200 500" className="h-[65%] w-auto opacity-70 mt-[-5%]" style={{ filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.9))' }}>
          <ellipse cx="100" cy="45" rx="30" ry="35" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8,4"/>
          <rect x="88" y="78" width="24" height="20" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8,4"/>
          <path d="M40 100 L55 95 L100 100 L145 95 L160 100 L155 200 L145 220 L100 225 L55 220 L45 200 Z" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8,4"/>
          <path d="M40 100 L20 180 L22 240 L35 240 L40 185 L55 110" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8,4"/>
          <path d="M160 100 L180 180 L178 240 L165 240 L160 185 L145 110" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8,4"/>
          <path d="M45 200 L40 260 L55 270 L100 268 L145 270 L160 260 L155 200" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8,4"/>
          <path d="M55 270 L50 420 L55 480 L80 480 L90 420 L95 270" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8,4"/>
          <path d="M105 270 L110 420 L120 480 L145 480 L150 420 L145 270" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8,4"/>
        </svg>
      );
    }
    if (mode === 'side_view') {
      return (
        <svg viewBox="0 0 200 500" className="h-[65%] w-auto opacity-70 mt-[-5%]" style={{ filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.9))' }}>
          <ellipse cx="110" cy="45" rx="25" ry="32" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8,4"/>
          <path d="M105 75 C80 120, 75 200, 85 240 C95 280, 120 300, 115 480 L140 480 C150 350, 160 250, 150 150 C145 100, 130 80, 110 75" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8,4"/>
          <path d="M130 110 L145 220 L140 240 L125 240 L120 115" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8,4"/>
        </svg>
      );
    }
    if (mode === 'back_view') {
      return (
        <svg viewBox="0 0 200 500" className="h-[65%] w-auto opacity-70 mt-[-5%]" style={{ filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.9))' }}>
          <ellipse cx="100" cy="45" rx="28" ry="34" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8,4"/>
          <path d="M40 100 Q100 110 160 100 L155 240 L140 480 L60 480 L45 240 Z" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8,4"/>
          <path d="M40 100 L25 240 M160 100 L175 240" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8,4"/>
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 200 300" className="h-[55%] w-auto opacity-70" style={{ filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.9))' }}>
        <ellipse cx="100" cy="38" rx="30" ry="32" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8,4"/>
        <path d="M30 90 L50 85 L100 90 L150 85 L170 90 L165 200 L100 208 L35 200 Z" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8,4"/>
        <path d="M30 90 L10 175 L12 230 L28 230 L35 180 L50 95" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8,4"/>
        <path d="M170 90 L190 175 L188 230 L172 230 L165 180 L150 95" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8,4"/>
      </svg>
    );
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" style={{
        clipPath: mode === 'upper_body'
          ? 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 25% 10%, 25% 75%, 75% 75%, 75% 10%, 25% 10%)'
          : 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 25% 10%, 25% 85%, 75% 85%, 75% 10%, 25% 10%)'
      }} />

      {getSilhouette()}

      {[
        'top-[10%] left-[25%] border-t-4 border-l-4',
        'top-[10%] right-[25%] border-t-4 border-r-4',
        'bottom-[15%] left-[25%] border-b-4 border-l-4',
        'bottom-[15%] right-[25%] border-b-4 border-r-4',
      ].map((cls, i) => (
        <div key={i} className={`absolute ${cls} border-white w-10 h-10 rounded-sm shadow-[0_0_10px_rgba(255,255,255,0.5)]`} />
      ))}

      <div className="absolute bottom-[2%] left-0 right-0 flex justify-center">
        <div className="bg-primary px-4 py-2 rounded-full text-white text-[10px] font-bold uppercase tracking-wider shadow-lg flex items-center gap-2">
          {mode === 'front_view'  ? 'Front View Studio'
           : mode === 'side_view'  ? 'Side Profile'
           : mode === 'back_view'  ? 'Back Symmetry'
           : 'Upper Body Focus'}
        </div>
      </div>
    </div>
  );
}

//  SCAN MODE SELECTOR 

function ScanModeSelector({
  mode, onChange
}: { mode: ScanMode; onChange: (m: ScanMode) => void }) {
  const modes: { id: ScanMode; icon: string; label: string; desc: string }[] = [
    { id: 'front_view', icon: '', label: 'Front View', desc: 'Standard scan' },
    { id: 'side_view', icon: '', label: 'Side Profile', desc: 'Detail logic' },
    { id: 'back_view', icon: '', label: 'Back View',  desc: 'Symmetry' },
    { id: 'upper_body', icon: '', label: 'Torso Only', desc: 'Head to waist' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
      {modes.map(m => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium transition-all ${
            mode === m.id
              ? 'bg-background shadow text-primary scale-[1.02]'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="text-lg">{m.icon}</span>
          <div className="text-left">
            <p className="font-semibold text-[11px] leading-tight">{m.label}</p>
            <p className="text-[9px] opacity-70">{m.desc}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

//  PHOTO TIPS 

const TIPS_FULL = [
  ' Plain wall or light background',
  ' Light source facing you',
  ' Fitted clothing or shorts',
  ' Arms slightly away from body',
  ' Full body  head & feet visible',
];

const TIPS_UPPER = [
  ' Plain wall or light background',
  ' Light source facing you',
  ' Remove or wear fitted top',
  ' Head to waist fully visible',
  ' Fill 70% of frame height',
];

//  MAIN COMPONENT 

export default function UploadPhotoPage() {
  const { toast } = useToast();

  const [photos, setPhotos]             = useState<PhotoEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [photoForDate, setPhotoForDate] = useState<PhotoEntry | null>(null);
  const [isLoading, setIsLoading]       = useState(true);

  const [previewUrl, setPreviewUrl]     = useState<string | null>(null);
  const [showCamera, setShowCamera]     = useState(false);
  const [stream, setStream]             = useState<MediaStream | null>(null);
  const [scanMode, setScanMode]         = useState<ScanMode>('front_view');
  const [showTips, setShowTips]         = useState(false);

  const videoRef     = useRef<HTMLVideoElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAnalyzing, setIsAnalyzing]   = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [analysisMsg, setAnalysisMsg]   = useState('');
  const [scanResult, setScanResult]     = useState<ScanResult | null>(null);
  const [recommendations, setRecommendations] = useState<VideoRec[]>([]);

  const [scanHistory, setScanHistory]   = useState<StoredScan[]>([]);
  const [weeklyStats, setWeeklyStats]   = useState<ReturnType<typeof getWeeklyStats>>(null);
  const [goalProgress, setGoalProgress] = useState(0);

  const [activeVideo, setActiveVideo]         = useState<string | null>(null);
  const [activeVideoTitle, setActiveVideoTitle] = useState('');

  //  AI FEEDBACK STATE 
  const [isVerifying, setIsVerifying] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [userCorrectedBf, setUserCorrectedBf] = useState<number | null>(null);

  const profile  = typeof window !== 'undefined' ? loadProfile() : null;
  const isMale   = (profile?.gender  ?? 'male') === 'male';
  const weightKg = profile?.weightKg ?? 70;
  const goalBf   = profile?.goalBf   ?? 18;

  //  LOAD 
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('fitjourney_body_photos') || '[]') as PhotoEntry[];
      setPhotos(saved.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setScanHistory(loadAllScans());
      setWeeklyStats(getWeeklyStats());
      setGoalProgress(getGoalProgress(goalBf));
    } finally { setIsLoading(false); }
  }, [goalBf]);

  useEffect(() => {
    const found = photos.find(p => isSameDay(parseISO(p.date), selectedDate));
    setPhotoForDate(found ?? null);
    setScanResult(found?.scanResult ?? null);
    setPreviewUrl(null);
  }, [selectedDate, photos]);

  //  CAMERA 
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
    setStream(null); setShowCamera(false);
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    setPreviewUrl(c.toDataURL('image/jpeg', 0.92));
    stopCamera();
  }, [stopCamera]);

  //  SCAN 
  const handleScan = async () => {
    if (!previewUrl) return;
    setIsAnalyzing(true);
    try {
      if (!modelsLoaded()) {
        setModelLoading(true);
        await loadModels((msg) => setAnalysisMsg(msg));
        setModelLoading(false);
      }
      setAnalysisMsg('Starting scan...');
      const result = await scanBody(previewUrl, isMale, weightKg,
        (msg) => setAnalysisMsg(msg));
      setScanResult(result);

      const recs = recommend(result.bf, goalBf, isMale);
      setRecommendations(recs.primary);
      saveScan(result);
      setScanHistory(loadAllScans());
      setWeeklyStats(getWeeklyStats());
      setGoalProgress(getGoalProgress(goalBf));

      const newPhoto: PhotoEntry = {
        id: Date.now().toString(), date: selectedDate.toISOString(),
        url: previewUrl, scanResult: result,
      };
      const updated = [
        ...photos.filter(p => !isSameDay(parseISO(p.date), selectedDate)),
        newPhoto,
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPhotos(updated);
      setPhotoForDate(newPhoto);
      localStorage.setItem('fitjourney_body_photos', JSON.stringify(updated));

      toast({
        title: `${result.bf}% Body Fat  ${result.category}`,
        description: `${result.bodyTypeLabel}  ${result.confLabel}`,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Scan Failed', description: err.message });
    } finally { setIsAnalyzing(false); setModelLoading(false); }
  };

  const handleSaveWithoutProgress = () => {
    if (!previewUrl) return;

    const newPhoto: PhotoEntry = {
      id: Date.now().toString(),
      date: selectedDate.toISOString(),
      url: previewUrl,
      // No scanResult
    };

    const updated = [
      ...photos.filter(p => !isSameDay(parseISO(p.date), selectedDate)),
      newPhoto,
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setPhotos(updated);
    setPhotoForDate(newPhoto);
    localStorage.setItem('fitjourney_body_photos', JSON.stringify(updated));

    toast({
      title: "Saved to History",
      description: "Photo added without AI scan (Timelapse mode).",
    });

    setPreviewUrl(null);
  };

  const handleDelete = () => {
    const updated = photos.filter(p => !isSameDay(parseISO(p.date), selectedDate));
    setPhotos(updated); setPhotoForDate(null); setScanResult(null); setPreviewUrl(null);
    localStorage.setItem('fitjourney_body_photos', JSON.stringify(updated));
    toast({ title: 'Photo deleted' });
  };

  //  RENDER 
  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-primary"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="font-bold text-lg">Body Progress</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-green-500" />
            Photos stay on your device  always
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full p-4 space-y-4">

        {/* Progress summary */}
        {scanHistory.length > 0 && (
          <Card>
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-muted-foreground">Current Body Fat</p>
                  <p className="text-4xl font-bold text-primary">{scanHistory[0].bf}%</p>
                  <Badge className={`mt-1 ${getCategoryColor(scanHistory[0].category)}`}>
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
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Goal Progress</span><span>{goalProgress}%</span>
                </div>
                <Progress value={goalProgress} className="h-2" />
              </div>
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

        {/* Calendar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Select Date to Scan</CardTitle>
            <CardDescription>{photos.length} photos logged</CardDescription>
          </CardHeader>
          <CardContent>
            {!isLoading && (
              <Calendar
                mode="single" selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                modifiers={{ hasPhoto: photos.map(p => parseISO(p.date)) }}
                modifiersStyles={{ hasPhoto: { fontWeight: 'bold', color: 'var(--primary)' } }}
                className="rounded-md"
              />
            )}
          </CardContent>
        </Card>

        {/*  SCAN MODE + CAMERA  */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{format(selectedDate, 'MMMM d, yyyy')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">

            {/* Mode selector  only show if no result yet */}
            {!scanResult && !previewUrl && (
              <>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Body Scan Studio  Select Angle
                </p>
                <ScanModeSelector mode={scanMode} onChange={setScanMode} />

                {/* Photo tips toggle */}
                <button
                  onClick={() => setShowTips(!showTips)}
                  className="flex items-center gap-2 text-xs text-primary"
                >
                  <Info className="h-3 w-3" />
                  {showTips ? 'Hide' : 'Show'} pose tips
                </button>

                {showTips && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-1">
                    <p className="text-xs font-semibold text-primary mb-2">
                       Guidance for {scanMode.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground"> Keep arms 20deg from body</p>
                    <p className="text-xs text-muted-foreground"> Stand 6-8 feet away</p>
                    <p className="text-xs text-muted-foreground"> Ensure head & feet are within corners</p>
                  </div>
                )}
              </>
            )}

            {/* Camera STUDIO  Fullscreen Professional KYC View */}
            {showCamera && (
              <div className="fixed inset-0 z-[100] bg-black flex flex-col">
                <div className="relative flex-1 group">
                  <video
                    ref={videoRef} autoPlay muted playsInline
                    className="w-full h-full object-cover"
                  />
                  <PoseGuideOverlay mode={scanMode} />
                  
                  {/* Dismiss gesture area */}
                  <div className="absolute top-6 left-6 z-20">
                    <Button onClick={stopCamera} variant="secondary" size="icon" className="rounded-full bg-black/40 backdrop-blur border-none text-white">
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Studio Controls */}
                <div className="bg-black/95 backdrop-blur-xl border-t border-white/10 px-6 py-8 flex flex-col items-center gap-6">
                  {/* Pose Selector in Studio */}
                  <div className="w-full max-w-sm">
                    <ScanModeSelector mode={scanMode} onChange={setScanMode} />
                  </div>

                  <div className="flex items-center justify-center gap-12">
                    <button onClick={stopCamera} className="text-white/60 hover:text-white text-xs font-medium uppercase tracking-widest">
                      Cancel
                    </button>
                    
                    {/* Capture Trigger */}
                    <button
                      onClick={capturePhoto}
                      className="group relative w-20 h-20 flex items-center justify-center"
                    >
                      <div className="absolute inset-0 rounded-full border-4 border-white opacity-40 group-active:scale-x-110 group-active:scale-y-110 transition-transform" />
                      <div className="w-16 h-16 rounded-full bg-white shadow-2xl scale-95 group-active:scale-90 transition-transform" />
                    </button>

                    <div className="w-12" /> {/* alignment spacer */}
                  </div>
                </div>
              </div>
            )}

            {/* Preview */}
            {(previewUrl || photoForDate?.url) && !showCamera && (
              <div className="relative rounded-xl overflow-hidden">
                <Image
                  src={previewUrl ?? photoForDate!.url}
                  alt="Body photo"
                  width={400} height={600}
                  className="w-full rounded-xl object-cover max-h-80"
                />
                {photoForDate && !previewUrl && (
                  <Button onClick={handleDelete} variant="destructive" size="sm"
                    className="absolute top-2 right-2 h-8 w-8 p-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            {/* Empty state */}
            {!showCamera && !previewUrl && !photoForDate && (
              <div
                className="w-full h-44 bg-secondary rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-4xl">{scanMode === 'front_view' ? '' : ''}</div>
                <p className="text-muted-foreground text-sm font-medium">Upload or take photo</p>
                <p className="text-xs text-muted-foreground">
                  {scanMode === 'front_view' ? 'Full body  head to feet' : 'Upper body  head to waist'}
                </p>
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onloadend = () => setPreviewUrl(r.result as string);
                r.readAsDataURL(f);
              }} />

            {/* Action buttons */}
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

            {/* Loading */}
            {(modelLoading || isAnalyzing) && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm font-medium text-primary">AI Processing</span>
                </div>
                <p className="text-xs text-muted-foreground">{analysisMsg}</p>
              </div>
            )}

            {/* Scan button */}
            {previewUrl && !isAnalyzing && !scanResult && (
              <div className="flex flex-col gap-2">
                <Button onClick={handleScan} className="w-full" size="lg">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze Body Composition
                </Button>
                <Button onClick={handleSaveWithoutProgress} variant="secondary" className="w-full border-dashed border-2" size="lg">
                  <Film className="h-4 w-4 mr-2" />
                  Timelapse Without Progress
                </Button>
              </div>
            )}

            {/* Retake */}
            {scanResult && (
              <Button
                onClick={() => { setPreviewUrl(null); setScanResult(null); setRecommendations([]); }}
                variant="outline" className="w-full"
              >
                <RotateCcw className="h-4 w-4 mr-2" /> Retake Photo
              </Button>
            )}
          </CardContent>
        </Card>

        {/*  SCAN RESULTS  */}
        {scanResult && (
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-primary" />
                Scan Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Body type + confidence badge row */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {getBodyTypeIcon(scanResult.bodyType)} {scanResult.bodyTypeLabel}
                </Badge>
                <Badge variant="outline" className={`text-xs ${getConfidenceColor(scanResult.confDisplay)}`}>
                  {scanResult.confDisplay}% confidence
                </Badge>
              </div>

              {/* Main metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-primary/5 rounded-xl p-4 text-center">
                  <p className="text-5xl font-bold text-primary">{scanResult.bf}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Body Fat</p>
                  <Badge className={`mt-2 ${getCategoryColor(scanResult.category)}`}>
                    {scanResult.category}
                  </Badge>
                </div>
                <div className="bg-secondary rounded-xl p-4 text-center">
                  <p className="text-5xl font-bold">{scanResult.shape}</p>
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
                  <p className="font-bold">{scanResult.coverage}%</p>
                  <p className="text-xs text-muted-foreground">Coverage</p>
                </div>
              </div>

              {/* Confidence info */}
              <div className={`rounded-lg p-3 text-sm ${
                scanResult.confDisplay >= 45
                  ? 'bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800'
                  : 'bg-yellow-50 border border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800'
              }`}>
                <p className="font-medium">{scanResult.confLabel}</p>
                {scanResult.bodyType === 'upper_body' && (
                  <p className="text-xs mt-1 text-muted-foreground">
                    Upper body scan  switch to Full Body mode for more accurate hip/thigh analysis
                  </p>
                )}
              </div>

              {/* AI proof images */}
              {(scanResult.isolatedUrl || scanResult.normalizedUrl) && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Scan Proof (AI Vision)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {scanResult.isolatedUrl && (
                      <div>
                        <Image src={scanResult.isolatedUrl} alt="AI Isolation"
                          width={200} height={200} className="w-full rounded-lg object-contain bg-secondary" />
                        <p className="text-xs text-center text-muted-foreground mt-1">AI Isolation</p>
                      </div>
                    )}
                    {scanResult.normalizedUrl && (
                      <div>
                        <Image src={scanResult.normalizedUrl} alt="AI Input"
                          width={200} height={200} className="w-full rounded-lg object-contain bg-secondary" />
                        <p className="text-xs text-center text-muted-foreground mt-1">AI Vision (224px)</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Goal */}
              <div className="bg-secondary rounded-lg p-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm">Goal: {goalBf}% BF</span>
                </div>
                <span className="font-bold text-sm">
                  {scanResult.bf > goalBf
                    ? `${(scanResult.bf - goalBf).toFixed(1)}% to go`
                    : ' Goal reached!'}
                </span>
              </div>

              <Button onClick={() => exportPDFReport(30)} variant="outline" className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                Export 30-Day Report (PDF)
              </Button>

              {/*  AI FEEDBACK LOOP (ACTIVE LEARNING)  */}
              <div className="mt-4 pt-4 border-t border-dashed space-y-4">
                <div className="flex items-center justify-between">
                   <div className="space-y-0.5">
                      <p className="text-sm font-semibold flex items-center gap-2">
                         <BrainCircuit className="h-4 w-4 text-accent" /> Help AI improve?
                      </p>
                      <p className="text-[10px] text-muted-foreground">Your feedback trains a smarter model</p>
                   </div>
                   {!feedbackGiven && (
                     <div className="flex gap-2">
                        <Button 
                          variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full bg-secondary hover:bg-green-100 dark:hover:bg-green-900"
                          onClick={() => {
                             setFeedbackGiven(true);
                             
                             // Save success feedback to history
                             const history = JSON.parse(localStorage.getItem('fitjourney_scan_history') || '[]');
                             const updatedHistory = history.map((s: any) => {
                                if (isSameDay(parseISO(s.date), selectedDate)) {
                                   return { ...s, isVerified: true, feedback: 'good' };
                                }
                                return s;
                             });
                             localStorage.setItem('fitjourney_scan_history', JSON.stringify(updatedHistory));
                             setScanHistory(updatedHistory);

                             toast({ title: "Feedback Saved!", description: "AI performance marked as Good." });
                          }}
                        >
                           
                        </Button>
                        <Button 
                          variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full bg-secondary hover:bg-red-100 dark:hover:bg-red-900"
                          onClick={() => setIsVerifying(true)}
                        >
                           
                        </Button>
                     </div>
                   )}
                   {feedbackGiven && (
                      <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/5 px-3 py-1">
                         Feedback Shared!
                      </Badge>
                   )}
                </div>

                {isVerifying && !feedbackGiven && (
                  <div className="bg-accent/5 p-4 rounded-2xl border border-accent/20 animate-in fade-in slide-in-from-top-2">
                     <p className="text-sm font-bold mb-3">Correct the AI&apos;s estimate:</p>
                     <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                           <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Your known Body Fat</span>
                           <span className="text-lg font-black text-accent">{(userCorrectedBf || scanResult.bf).toFixed(1)}%</span>
                        </div>
                        <Progress 
                          value={((userCorrectedBf || scanResult.bf) / 50) * 100} 
                          className="h-2 cursor-pointer bg-accent/10"
                          onClick={(e) => {
                             const rect = e.currentTarget.getBoundingClientRect();
                             const pct = (e.clientX - rect.left) / rect.width;
                             setUserCorrectedBf(parseFloat((pct * 50).toFixed(1)));
                          }}
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                           <span>5%</span>
                           <span>50%</span>
                        </div>
                        <div className="flex gap-2 pt-2">
                           <Button 
                             className="flex-1 rounded-xl h-10 bg-accent hover:bg-accent/90"
                             onClick={() => {
                                setFeedbackGiven(true);
                                setIsVerifying(false);
                                
                                // Save to localStorage logic: update history entry
                                const history = JSON.parse(localStorage.getItem('fitjourney_scan_history') || '[]');
                                const updatedHistory = history.map((s: any) => {
                                   if (isSameDay(parseISO(s.date), selectedDate)) {
                                      return { 
                                         ...s, 
                                         isVerified: true, 
                                         userBf: userCorrectedBf || scanResult.bf,
                                         feedback: 'bad'
                                      };
                                   }
                                   return s;
                                });
                                localStorage.setItem('fitjourney_scan_history', JSON.stringify(updatedHistory));
                                setScanHistory(updatedHistory);

                                toast({ title: "Correction Saved!", description: "Thank you for the training data." });
                             }}
                           >
                              Confirm Correction
                           </Button>
                           <Button variant="ghost" onClick={() => setIsVerifying(false)} className="rounded-xl h-10">
                              Cancel
                           </Button>
                        </div>
                     </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/*  WORKOUTS  */}
        {recommendations.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Dumbbell className="h-5 w-5 text-primary" />
                Today&apos;s Workouts
              </CardTitle>
              <CardDescription>
                Based on {scanResult?.bf}% BF  targeting {goalBf}%
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {recommendations.map(v => (
                <div key={v.id}
                  className="flex items-center gap-3 p-3 bg-secondary rounded-xl cursor-pointer hover:bg-secondary/70 transition-colors"
                  onClick={() => { setActiveVideo(v.file); setActiveVideoTitle(v.title); }}>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Play className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{v.title}</p>
                    <p className="text-xs text-muted-foreground">{v.duration}  ~{v.calories} cal</p>
                    <p className="text-xs text-primary">{v.reason}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Video player */}
        {activeVideo && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{activeVideoTitle}</CardTitle>
                <Button onClick={() => setActiveVideo(null)} variant="ghost" size="sm"></Button>
              </div>
            </CardHeader>
            <CardContent>
              <video src={activeVideo} controls autoPlay playsInline className="w-full rounded-xl" />
            </CardContent>
          </Card>
        )}

        {/* Photo history */}
        {photos.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Film className="h-5 w-5" /> Photo History
                </CardTitle>
                <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                  <Link href="/body-timelapse" className="flex items-center">
                    Watch Timelapse <ArrowLeft className="ml-1 h-4 w-4 rotate-180" />
                  </Link>
                </Button>
              </div>
              <CardDescription>
                {photos.length} photos logged. Watch your video in the Timelapse section.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {photos.slice(0, 9).map(p => (
                  <div key={p.id}
                    className="relative cursor-pointer rounded-xl overflow-hidden aspect-[3/4] bg-secondary"
                    onClick={() => setSelectedDate(parseISO(p.date))}>
                    <Image src={p.url} alt={p.date} fill className="object-cover" />
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
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
