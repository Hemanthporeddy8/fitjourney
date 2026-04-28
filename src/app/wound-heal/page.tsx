
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Upload, Camera as CameraIcon, Sparkles, Loader2, AlertCircle, Microscope, HeartPulse, Apple, Ban, ListChecks, Trash2 } from 'lucide-react'; 
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; 
import { analyzeWoundLocally as analyzeWoundOrDocument, type WoundAnalysisResult as AnalyzeWoundOrDocumentOutput } from '@/lib/wound-engine';
import { format, parseISO, startOfDay, isSameDay } from 'date-fns';

// Lazy load heavy Calendar component
const Calendar = dynamic(() => import("@/components/ui/calendar").then(mod => mod.Calendar), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-muted animate-pulse rounded-md border" />
});

interface WoundEntry {
  id: string; 
  date: string; 
  imageUrl: string; 
  analysis?: AnalyzeWoundOrDocumentOutput;
}

export default function WoundHealPage() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [woundEntries, setWoundEntries] = useState<WoundEntry[]>([]);
  const [entryForSelectedDate, setEntryForSelectedDate] = useState<WoundEntry | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showCamera, setShowCamera] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysisResult, setCurrentAnalysisResult] = useState<AnalyzeWoundOrDocumentOutput | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem('fitjourney_wound_entries') || '[]');
        setWoundEntries(saved.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } catch (error) { console.error('Load Error:', error); }
    }
  }, []); 

  useEffect(() => {
    if (selectedDate) {
      const found = woundEntries.find(p => isSameDay(parseISO(p.date), selectedDate));
      setEntryForSelectedDate(found || null);
      setCurrentAnalysisResult(found?.analysis || null);
      setPreviewUrl(null); setShowCamera(false);
    }
  }, [selectedDate, woundEntries]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !selectedDate) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    setPreviewUrl(canvas.toDataURL('image/jpeg'));
    setShowCamera(false);
  }, [selectedDate]);

  const handleSaveAndAnalyze = async () => {
    if (!previewUrl || !selectedDate) return;
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeWoundOrDocument(previewUrl);
      setCurrentAnalysisResult(analysis);
      const newEntry = { id: Date.now().toString(), date: selectedDate.toISOString(), imageUrl: previewUrl, analysis };
      const updated = [newEntry, ...woundEntries.filter(e => !isSameDay(parseISO(e.date), selectedDate))];
      setWoundEntries(updated);
      localStorage.setItem('fitjourney_wound_entries', JSON.stringify(updated));
      toast({ title: "Entry Saved" });
    } catch (err: any) {
      toast({ title: "Analysis Failed", description: err.message, variant: "destructive" });
    } finally { setIsAnalyzing(false); setPreviewUrl(null); }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background p-4 pb-20">
      <Link href="/healmap" className="text-sm text-primary hover:underline absolute top-4 left-4 flex items-center z-10">
        <ArrowLeft className="h-4 w-4 mr-1" /> HealMap
      </Link>
      <Card className="w-full max-w-2xl mx-auto shadow-lg mt-10">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary flex items-center justify-center">
            <HeartPulse className="mr-2 h-8 w-8" /> WoundHeal
          </CardTitle>
          <CardDescription>Monitor healing and analyze documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className="rounded-md border mx-auto" />
            <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => fileInputRef.current?.click()} variant="outline"><Upload className="mr-2 h-4 w-4" /> Upload</Button>
                <Button onClick={() => setShowCamera(true)} variant="outline"><CameraIcon className="mr-2 h-4 w-4" /> Take Photo</Button>
                <Input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const r = new FileReader();
                    r.onloadend = () => setPreviewUrl(r.result as string);
                    r.readAsDataURL(f);
                  }
                }} />
            </div>

            {showCamera && (
                <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                    <video ref={videoRef} className="w-full h-full object-contain" autoPlay muted playsInline />
                    <Button onClick={capturePhoto} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-500 rounded-full h-12 w-12 p-0 shadow-lg"><CameraIcon /></Button>
                </div>
            )}

            {previewUrl && (
                <div className="mt-4 space-y-2">
                    <Image src={previewUrl} alt="Preview" width={300} height={225} className="rounded-md mx-auto" />
                    <Button onClick={handleSaveAndAnalyze} disabled={isAnalyzing} className="w-full">
                        {isAnalyzing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Analyze & Save
                    </Button>
                </div>
            )}

            {entryForSelectedDate && (
                <Card>
                    <CardHeader><CardTitle className="text-sm">Report for {format(parseISO(entryForSelectedDate.date), 'PPP')}</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <Image src={entryForSelectedDate.imageUrl} alt="Saved" width={400} height={300} className="rounded-md mx-auto" />
                        {currentAnalysisResult && (
                          <div className="text-sm space-y-2">
                            <p><strong>Type:</strong> {currentAnalysisResult.analysisType}</p>
                            <p><strong>Notes:</strong> {currentAnalysisResult.description}</p>
                          </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </CardContent>
      </Card>
      <canvas ref={canvasRef} className="hidden"></canvas>
    </div>
  );
}
