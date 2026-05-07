'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BrainCircuit, Settings2, Activity, ShieldCheck, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { runPoseInference, loadWorkoutModel, CONNECTING_LINES } from '@/lib/workout-engine';

export default function AiLabPage() {
  const router = useRouter();
  
  // --- Lab Controls ---
  const [confThreshold, setConfThreshold] = useState(0.4);
  const [smoothing, setSmoothing] = useState(0.6);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [useLegacyNormalization, setUseLegacyNormalization] = useState(false);
  
  // --- AI State ---
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reqRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);
  const lastTimeRef = useRef(performance.now());

  // Init AI
  useEffect(() => {
    const start = async () => {
      setStatus('loading');
      try {
        await loadWorkoutModel();
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: 640, height: 480 } 
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('ready');
        loop();
      } catch (err: any) {
        setError(err.message || 'Failed to start AI Lab');
        setStatus('error');
      }
    };

    const loop = async () => {
      if (!videoRef.current || !canvasRef.current) return;
      
      const now = performance.now();
      setFps(Math.round(1000 / (now - lastTimeRef.current)));
      lastTimeRef.current = now;

      const res = await runPoseInference(videoRef.current);
      
      if (res?.keypoints && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')!;
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        drawLabSkeleton(ctx, res.keypoints, canvasRef.current.width, canvasRef.current.height);
      }
      
      reqRef.current = requestAnimationFrame(loop);
    };

    start();
    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  function drawLabSkeleton(ctx: CanvasRenderingContext2D, kp: any[], W: number, H: number) {
    const color = '#22c55e'; // Pro Green
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    
    if (showSkeleton) {
      for (const [a, b] of CONNECTING_LINES) {
        const pA = kp[a], pB = kp[b];
        if (pA.confidence > confThreshold && pB.confidence > confThreshold) {
          ctx.beginPath();
          ctx.moveTo(pA.x * W, pA.y * H);
          ctx.lineTo(pB.x * W, pB.y * H);
          ctx.stroke();
        }
      }
    }

    kp.forEach((p, i) => {
      if (p.confidence > confThreshold) {
        ctx.fillStyle = i === 0 ? '#ef4444' : color; // Nose is Red
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Lab labels
        ctx.fillStyle = 'white';
        ctx.font = '10px Inter';
        ctx.fillText(`${i}:${Math.round(p.confidence*100)}%`, p.x * W + 8, p.y * H);
      }
    });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="rounded-xl" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2">
              <BrainCircuit className="text-accent" /> FitJourney AI Lab <Badge variant="secondary">V2.0-LAB</Badge>
            </h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Interactively Tune Proprietary Model V2</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Viewport */}
          <div className="lg:col-span-2 space-y-4">
            <div className="aspect-video bg-black rounded-[2rem] overflow-hidden border-2 border-accent/20 relative">
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" muted playsInline />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
              
              {status === 'loading' && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center">
                  <div className="h-8 w-8 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-sm font-bold uppercase tracking-widest">Warming up AI Engine...</p>
                </div>
              )}
            </div>
            
            <div className="flex gap-4">
              <Card className="flex-1 bg-zinc-900/50 border-white/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Inference Speed</p>
                    <p className="text-2xl font-black text-accent">{fps} <span className="text-sm font-normal">FPS</span></p>
                  </div>
                  <Activity className="text-accent opacity-20 h-8 w-8" />
                </CardContent>
              </Card>
              <Card className="flex-1 bg-zinc-900/50 border-white/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Resolution</p>
                    <p className="text-2xl font-black">256<span className="text-sm font-normal opacity-40">x</span>256</p>
                  </div>
                  <ShieldCheck className="text-primary opacity-20 h-8 w-8" />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-6">
            <Card className="bg-zinc-900 border-accent/20">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings2 className="h-4 w-4" /> Tweak Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider">Conf Threshold</label>
                    <span className="text-accent font-mono text-xs">{confThreshold}</span>
                  </div>
                  <Slider 
                    value={[confThreshold]} 
                    min={0.1} max={0.9} step={0.05} 
                    onValueChange={([v]) => setConfThreshold(v)} 
                  />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Filter out keypoints the AI isn't sure about. Higher = cleaner skeleton, but points might disappear.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider">Temporal Smoothing</label>
                    <span className="text-accent font-mono text-xs">{smoothing}</span>
                  </div>
                  <Slider 
                    value={[smoothing]} 
                    min={0.1} max={0.95} step={0.05} 
                    onValueChange={([v]) => setSmoothing(v)} 
                  />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    How much joints "stick" to their previous position. Higher = smoother motion, but more lag.
                  </p>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-4">
                   <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Show Skeleton Lines</span>
                      <Button 
                        variant={showSkeleton ? 'default' : 'outline'} 
                        size="sm" className="h-7 px-3 text-[10px]"
                        onClick={() => setShowSkeleton(!showSkeleton)}
                      >
                        {showSkeleton ? 'ENABLED' : 'DISABLED'}
                      </Button>
                   </div>
                </div>

              </CardContent>
            </Card>

            <Alert className="bg-blue-500/10 border-blue-500/20 text-blue-400">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-[10px] leading-relaxed">
                <strong>V2 Strategy:</strong> The dots represent the raw 64x64 heatmap peaks. If dots are "bunching" in the center, try adjusting your lighting or standing further back to give the 256px input more contrast.
              </AlertDescription>
            </Alert>
          </div>

        </div>
      </div>
    </div>
  );
}
