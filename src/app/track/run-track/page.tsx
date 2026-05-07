'use client';

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Play, Pause, Square, MapPin, Clock, Flame, Footprints, TrendingUp, Activity, ArrowLeft, Wind, RotateCcw, ShieldCheck, Navigation } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

const CALORIES_PER_KM: Record<string, number> = { walk: 60, run: 80 };
const STEP_M = 0.75;

function haversine(la1: number, lo1: number, la2: number, lo2: number) {
  const R = 6371, dLa = (la2 - la1) * Math.PI / 180, dLo = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

type Phase = 'permission' | 'idle' | 'active' | 'paused' | 'done';
type TrackType = 'long' | 'loop';
interface Coord { lat: number; lng: number }
interface Result { mode: string; type: TrackType; elapsed: number; distance: number; steps: number; calories: number; pace: number; goalKcal: number; goalName: string; }

function RunTrackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = (params.get('mode') || 'walk') as 'walk' | 'run';
  const goalKcal = parseInt(params.get('goal') || '0');
  const goalName = decodeURIComponent(params.get('goalName') || 'Daily Goal');

  const [phase, setPhase] = useState<Phase>('permission');
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [trackType, setTrackType] = useState<TrackType>('long');
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [steps, setSteps] = useState(0);
  const [calories, setCalories] = useState(0);
  const [pace, setPace] = useState(0);
  const [cadence, setCadence] = useState(0);
  const [route, setRoute] = useState<Coord[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastPosRef = useRef<GeolocationPosition | null>(null);
  const startRef = useRef(0);
  const pauseAcc = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const accelBuf = useRef<number[]>([]);
  const cleanupAccel = useRef<(() => void) | null>(null);

  // Ask permission immediately on mount
  useEffect(() => {
    if (!('geolocation' in navigator)) { setPhase('idle'); return; }
    navigator.permissions?.query({ name: 'geolocation' }).then(p => {
      if (p.state === 'granted') { setGpsEnabled(true); setPhase('idle'); }
      else if (p.state === 'denied') { setPhase('idle'); }
      // else 'prompt' — stay on permission screen
    }).catch(() => setPhase('idle'));
  }, []);

  const requestGps = () => {
    navigator.geolocation.getCurrentPosition(
      () => { setGpsEnabled(true); setPhase('idle'); },
      () => { setGpsEnabled(false); setPhase('idle'); },
      { enableHighAccuracy: true }
    );
  };

  // Derived stats
  useEffect(() => {
    // Calories based on distance or steps if distance is failing
    const effectiveDist = distance > 0 ? distance : (steps * STEP_M / 1000);
    setCalories(Math.round(effectiveDist * (CALORIES_PER_KM[mode] || 60)));
    
    if (elapsed > 5 && effectiveDist > 0.001) {
      const minPerKm = (elapsed / 60) / effectiveDist;
      // Sanity check: cap pace at 2 min/km (bullet train prevention)
      setPace(minPerKm < 2 ? 2 : parseFloat(minPerKm.toFixed(2)));
    }
    if (elapsed > 0) setCadence(Math.round((steps / (elapsed / 60))));
  }, [distance, elapsed, steps, mode]);

  // Timer
  useEffect(() => {
    if (phase === 'active') {
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000) + pauseAcc.current), 1000);
    } else if (timerRef.current) clearInterval(timerRef.current);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // Canvas route
  useEffect(() => {
    if (route.length < 2 || !canvasRef.current) return;
    const cv = canvasRef.current, ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const lats = route.map(c => c.lat), lngs = route.map(c => c.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const p = 24, W = cv.width - 2 * p, H = cv.height - 2 * p;
    const toX = (lng: number) => maxLng === minLng ? cv.width / 2 : p + ((lng - minLng) / (maxLng - minLng)) * W;
    const toY = (lat: number) => maxLat === minLat ? cv.height / 2 : p + ((maxLat - lat) / (maxLat - minLat)) * H;
    const g = ctx.createLinearGradient(0, 0, cv.width, cv.height);
    g.addColorStop(0, '#3b82f6'); g.addColorStop(1, '#22c55e');
    ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    route.forEach((c, i) => { const x = toX(c.lng), y = toY(c.lat); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.stroke();
    const dot = (c: Coord, color: string) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(toX(c.lng), toY(c.lat), 5, 0, Math.PI * 2); ctx.fill(); };
    dot(route[0], '#3b82f6'); dot(route[route.length - 1], '#ef4444');
  }, [route]);

  const startGps = useCallback(() => {
    const threshold = trackType === 'loop' ? 0.0015 : 0.004; // 1.5m for loop, 4m for long
    watchRef.current = navigator.geolocation.watchPosition(pos => {
      setGpsAccuracy(Math.round(pos.coords.accuracy));
      // Discard low accuracy points initially
      if (pos.coords.accuracy > 30 && route.length < 5) return;

      if (lastPosRef.current) {
        const inc = haversine(lastPosRef.current.coords.latitude, lastPosRef.current.coords.longitude, pos.coords.latitude, pos.coords.longitude);
        
        // Speed check: discard jumps faster than 30km/h for walk/run
        const speedKmh = (inc / ((pos.timestamp - lastPosRef.current.timestamp) / 3600000));
        if (speedKmh > 35) return;

        if (inc >= threshold) {
          setDistance(d => d + inc);
          setRoute(r => [...r.slice(-300), { lat: pos.coords.latitude, lng: pos.coords.longitude }]);
          lastPosRef.current = pos;
        }
      } else {
        lastPosRef.current = pos;
        setRoute([{ lat: pos.coords.latitude, lng: pos.coords.longitude }]);
      }
    }, () => { }, { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 });
  }, [trackType, route.length]);

  const startAccel = useCallback(() => {
    const h = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity; if (!acc) return;
      const mag = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
      accelBuf.current.push(mag);
      if (accelBuf.current.length > 10) {
        const b = accelBuf.current.slice(-10);
        // More robust peak detection: find max in window and check if it's a significant deviation from avg
        const avg = b.reduce((a,c)=>a+c,0)/10;
        const peak = Math.max(...b);
        const peakIdx = b.indexOf(peak);
        
        if (peakIdx === 5 && peak > avg + 1.5 && peak > 10.5) { 
          setSteps(s => s + 1); 
          // If GPS is failing/jittery, use steps to supplement distance
          if (!gpsEnabled || gpsAccuracy && gpsAccuracy > 25) {
            setDistance(d => d + STEP_M / 1000);
          }
        }
        accelBuf.current.shift();
      }
    };
    window.addEventListener('devicemotion', h);
    return () => window.removeEventListener('devicemotion', h);
  }, [gpsEnabled, gpsAccuracy]);

  const handleStart = () => {
    startRef.current = Date.now();
    setPhase('active');
    cleanupAccel.current = startAccel();
    if (gpsEnabled) startGps();
  };

  const handlePause = () => {
    pauseAcc.current = elapsed; setPhase('paused');
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    if (cleanupAccel.current) { cleanupAccel.current(); cleanupAccel.current = null; }
  };

  const handleResume = () => {
    startRef.current = Date.now(); setPhase('active');
    cleanupAccel.current = startAccel();
    if (gpsEnabled) startGps();
  };

  const handleStop = () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    if (cleanupAccel.current) cleanupAccel.current();
    const effectiveGoal = goalKcal || 0;
    const r: Result = { mode, type: trackType, elapsed, distance: parseFloat(distance.toFixed(2)), steps, calories, pace, goalKcal: effectiveGoal, goalName };
    if (elapsed > 5) {
      const sessions = JSON.parse(localStorage.getItem('fitjourney_run_sessions') || '[]');
      sessions.unshift({ ...r, date: new Date().toISOString() });
      localStorage.setItem('fitjourney_run_sessions', JSON.stringify(sessions.slice(0, 30)));
      setResult(r); setPhase('done');
    } else {
      setPhase('idle');
      router.back();
    }
  };

  const prog = goalKcal > 0 ? Math.min(100, (calories / goalKcal) * 100) : 0;
  const isRun = mode === 'run';
  const accentClass = isRun ? 'text-blue-500' : 'text-primary';

  // ── Permission Screen ───────────────────────────────────────
  if (phase === 'permission') return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 gap-6">
      <div className="text-6xl">{isRun ? '🏃' : '🚶'}</div>
      <div className="text-center">
        <h1 className="text-2xl font-black mb-2">{isRun ? 'Run' : 'Walk'} Tracker</h1>
        <p className="text-muted-foreground text-sm">To track your distance accurately, we need your GPS location.</p>
      </div>
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl">
            <Navigation className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-bold">GPS Tracking</p>
              <p className="text-xs text-muted-foreground">Accurate distance, pace &amp; route map</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
            <Footprints className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-bold">Step Counter (Offline)</p>
              <p className="text-xs text-muted-foreground">Used if GPS is denied</p>
            </div>
          </div>
          <Button className="w-full" size="lg" onClick={requestGps}>
            <ShieldCheck className="mr-2 h-4 w-4" /> Allow GPS &amp; Start
          </Button>
          <Button className="w-full" variant="outline" onClick={() => { setGpsEnabled(false); setPhase('idle'); }}>
            Use Step Counter Instead
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // ── Achievement Screen ──────────────────────────────────────
  if (phase === 'done' && result) {
    const pct = result.goalKcal > 0 ? Math.round((result.calories / result.goalKcal) * 100) : 100;
    const achieved = result.goalKcal > 0 && result.calories >= result.goalKcal * 0.8;
    const badges: { icon: string; label: string }[] = [];
    if (result.distance >= 5) badges.push({ icon: '🏅', label: '5K Club' });
    else if (result.distance >= 1) badges.push({ icon: '⭐', label: '1K Done' });
    if (result.calories >= 300) badges.push({ icon: '🔥', label: '300 kcal' });
    if (result.steps >= 5000) badges.push({ icon: '👟', label: '5K Steps' });
    if (achieved) badges.push({ icon: '🎯', label: 'Goal Hit!' });

    return (
      <div className="flex flex-col items-center min-h-screen bg-background p-5 pb-10 gap-4">
        <div className="text-center pt-8 pb-2">
          <div className="text-6xl mb-3">{achieved ? '🏆' : '✅'}</div>
          <h1 className="text-2xl font-black">{achieved ? 'Goal Achieved!' : 'Workout Complete!'}</h1>
          <p className="text-sm text-muted-foreground mt-1">{result.goalName} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full max-w-md">
          {[
            { emoji: '📍', label: 'Distance', val: `${result.distance.toFixed(2)} km` },
            { emoji: '⏱️', label: 'Time', val: fmtTime(result.elapsed) },
            { emoji: '🔥', label: 'Calories', val: `${result.calories} kcal` },
            { emoji: '👟', label: 'Steps', val: result.steps.toLocaleString() },
            { emoji: '💨', label: 'Avg Pace', val: result.pace > 0 ? `${result.pace}'/km` : '--' },
            { emoji: '🎯', label: 'Goal %', val: result.goalKcal > 0 ? `${pct}%` : 'N/A' },
          ].map(s => (
            <Card key={s.label} className="text-center">
              <CardContent className="pt-4 pb-4">
                <div className="text-2xl mb-1">{s.emoji}</div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{s.label}</p>
                <p className="text-lg font-black">{s.val}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {result.goalKcal > 0 && (
          <Card className="w-full max-w-md">
            <CardContent className="pt-5 pb-5">
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span>Goal Progress</span><span className="text-muted-foreground">{result.calories} / {result.goalKcal} kcal</span>
              </div>
              <Progress value={pct} className="h-3" />
            </CardContent>
          </Card>
        )}

        {badges.length > 0 && (
          <div className="flex gap-2 flex-wrap justify-center">
            {badges.map(b => <Badge key={b.label} variant="secondary" className="text-sm py-1 px-3">{b.icon} {b.label}</Badge>)}
          </div>
        )}

        <div className="flex gap-3 w-full max-w-md mt-2">
          <Button className="flex-1" variant="outline" size="lg" onClick={() => router.push('/track')}><RotateCcw className="mr-2 h-4 w-4" /> Back</Button>
          <Button className="flex-1" size="lg" onClick={() => { setPhase('idle'); setElapsed(0); setDistance(0); setSteps(0); setCalories(0); setPace(0); setCadence(0); setRoute([]); pauseAcc.current = 0; lastPosRef.current = null; setResult(null); }}>
            <Play className="mr-2 h-4 w-4 fill-white" /> New {isRun ? 'Run' : 'Walk'}
          </Button>
        </div>
      </div>
    );
  }

  // ── Main Tracker ────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pt-5">
        <Button variant="outline" size="icon" className="rounded-xl" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <p className={`text-xs font-black uppercase tracking-widest ${accentClass}`}>{isRun ? 'Running' : 'Walking'} Mode</p>
          <h1 className="text-xl font-black">{isRun ? '🏃 Run Track' : '🚶 Walk Track'}</h1>
        </div>
        <Badge variant={gpsEnabled ? 'default' : 'secondary'} className="text-xs">
          {gpsEnabled ? '🛰 GPS' : '📡 Accel'}
          {gpsEnabled && gpsAccuracy && ` ±${gpsAccuracy}m`}
        </Badge>
      </div>

      {/* Goal Progress */}
      {goalKcal > 0 && (
        <div className="mx-4 mb-2">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex justify-between text-xs mb-2 font-medium">
                <span className={accentClass}>{goalName}</span>
                <span className="text-muted-foreground">{Math.round(prog)}% · {calories}/{goalKcal} kcal</span>
              </div>
              <Progress value={prog} className="h-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats */}
      <div className="mx-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <MapPin className="h-4 w-4 text-blue-500" />, label: 'KM', val: distance.toFixed(2) },
            { icon: <Clock className="h-4 w-4 text-violet-500" />, label: 'TIME', val: fmtTime(elapsed) },
            { icon: <Flame className="h-4 w-4 text-red-500" />, label: 'KCAL', val: calories.toString() },
          ].map(s => (
            <Card key={s.label} className="text-center">
              <CardContent className="pt-4 pb-4">
                <div className="flex justify-center mb-2">{s.icon}</div>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">{s.label}</p>
                <p className="text-xl font-black">{s.val}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Footprints className="h-3 w-3 text-primary" />, label: 'STEPS', val: steps.toLocaleString() },
            { icon: <TrendingUp className="h-3 w-3 text-yellow-500" />, label: "PACE '/km", val: pace > 0 ? `${pace}` : '--' },
            { icon: <Activity className="h-3 w-3 text-pink-500" />, label: 'CADENCE', val: cadence > 0 ? `${cadence}` : '--' },
          ].map(s => (
            <Card key={s.label} className="text-center">
              <CardContent className="pt-3 pb-3">
                <div className="flex justify-center mb-1">{s.icon}</div>
                <p className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1">{s.label}</p>
                <p className="text-base font-black">{s.val}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Type Selector (Idle Phase) */}
        {phase === 'idle' && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Button 
              variant={trackType === 'long' ? 'default' : 'outline'} 
              className="flex flex-col h-auto py-3 gap-1 rounded-2xl"
              onClick={() => setTrackType('long')}
            >
              <span className="text-lg">🛣️</span>
              <span className="text-sm font-bold text-wrap leading-tight">Long Directional</span>
              <span className="text-[10px] opacity-60">Direct routes</span>
            </Button>
            <Button 
              variant={trackType === 'loop' ? 'default' : 'outline'} 
              className="flex flex-col h-auto py-3 gap-1 rounded-2xl"
              onClick={() => setTrackType('loop')}
            >
              <span className="text-lg">🔄</span>
              <span className="text-sm font-bold text-wrap leading-tight">Loop / Park</span>
              <span className="text-[10px] opacity-60">Circular paths</span>
            </Button>
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center items-center gap-5 py-2">
          {phase === 'idle' && (
            <Button size="lg" className="w-20 h-20 rounded-full shadow-xl shadow-primary/20" onClick={handleStart}>
              <Play className="h-8 w-8 fill-white ml-1" />
            </Button>
          )}
          {phase === 'active' && (<>
            <Button size="lg" className="w-20 h-20 rounded-full bg-yellow-500 hover:bg-yellow-600 shadow-xl shadow-yellow-500/20" onClick={handlePause}>
              <Pause className="h-8 w-8 fill-white" />
            </Button>
            <Button size="icon" variant="destructive" className="w-14 h-14 rounded-full" onClick={handleStop}>
              <Square className="h-5 w-5 fill-white" />
            </Button>
          </>)}
          {phase === 'paused' && (<>
            <Button size="lg" className="w-20 h-20 rounded-full shadow-xl shadow-primary/20" onClick={handleResume}>
              <Play className="h-8 w-8 fill-white ml-1" />
            </Button>
            <Button size="icon" variant="destructive" className="w-14 h-14 rounded-full" onClick={handleStop}>
              <Square className="h-5 w-5 fill-white" />
            </Button>
          </>)}
        </div>
      </div>

      {/* Route Map */}
      {route.length > 1 && (
        <div className="mx-4 mt-3">
          <Card className="overflow-hidden">
            <CardHeader className="pb-0 pt-3 px-4">
              <CardTitle className="text-xs flex items-center gap-2">
                <MapPin className="h-3 w-3 text-primary" /> LIVE ROUTE
                <span className="ml-auto text-muted-foreground font-normal">{route.length} pts</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <canvas ref={canvasRef} width={400} height={200} className="w-full" />
              <div className="flex justify-between px-4 pb-2 text-xs text-muted-foreground">
                <span className="text-blue-500">● Start</span>
                <span className="text-red-500">● Now</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tips / Zones */}
      <div className="mx-4 mt-3">
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wind className="h-4 w-4 text-primary" /> {isRun ? 'Running Zones' : 'Walking Tips'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {isRun ? [
              { zone: 'Recovery', pace: '7:00+/km', color: 'text-green-500', desc: 'Conversational' },
              { zone: 'Base', pace: '6:00-7:00/km', color: 'text-blue-500', desc: 'Sustainable' },
              { zone: 'Tempo', pace: '5:00-6:00/km', color: 'text-yellow-500', desc: 'Comfortably hard' },
              { zone: 'Speed', pace: '<5:00/km', color: 'text-red-500', desc: 'Max effort' },
            ].map(z => (
              <div key={z.zone} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${z.color.replace('text-', 'bg-')}`} />
                <span className={`text-xs font-bold ${z.color}`}>{z.zone}</span>
                <span className="text-xs text-muted-foreground flex-1">{z.desc}</span>
                <span className="text-xs font-mono text-muted-foreground">{z.pace}</span>
              </div>
            )) : [
              { label: 'Warm up', desc: '5 min slow walk first' },
              { label: 'Posture', desc: 'Back straight, arms swinging' },
              { label: 'Breathing', desc: '3 steps in, 3 steps out' },
              { label: 'Cool down', desc: 'Slow pace last 5 min' },
            ].map(t => (
              <div key={t.label} className="flex gap-2 text-xs">
                <span className="font-bold text-primary shrink-0">{t.label}:</span>
                <span className="text-muted-foreground">{t.desc}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Accuracy note */}
      {!gpsEnabled && phase !== 'idle' && (
        <div className="mx-4 mt-3">
          <Alert>
            <AlertDescription className="text-xs">
              📡 <strong>Offline mode:</strong> Distance estimated from steps (±10%). For best accuracy, allow GPS next time.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}

export default function RunTrackPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}>
      <RunTrackContent />
    </Suspense>
  );
}
