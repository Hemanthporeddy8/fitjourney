'use client';

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Pause, Square, Footprints, Clock, Zap, MapPin, Target, Dumbbell, BrainCircuit, ChevronRight, Activity, TrendingUp, Wind, Flame } from 'lucide-react';
import { suggestedExercises, type Exercise } from '@/lib/exercise-data';
import { calculateDynamicWorkoutPlan } from '@/lib/workout-count-engine';
import { Loader2 } from 'lucide-react';

// ─── Constants ─────────────────────────────────────────────
const CALORIES_PER_KM_WALK = 60;
const CALORIES_PER_KM_RUN  = 80;
const STEP_LENGTH_M = 0.75; // avg step length in meters

// ─── Haversine Distance ─────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function fmtTime(s: number) {
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const sec = s%60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

type Mode = 'walk' | 'run';
type Phase = 'idle' | 'active' | 'paused';

interface Coord { lat: number; lng: number; }

function TrackerContent() {
  const router = useRouter();

  // ── Core state ────────────────────────────────────────────
  const [phase, setPhase]             = useState<Phase>('idle');
  const [mode, setMode]               = useState<Mode>('walk');
  const [elapsed, setElapsed]         = useState(0);
  const [distance, setDistance]       = useState(0);  // km
  const [steps, setSteps]             = useState(0);
  const [calories, setCalories]       = useState(0);
  const [pace, setPace]               = useState(0);   // min/km
  const [cadence, setCadence]         = useState(0);   // steps/min
  const [route, setRoute]             = useState<Coord[]>([]);
  const [gpsAvail, setGpsAvail]       = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  // ── AI state ──────────────────────────────────────────────
  const [aiGoal, setAiGoal]           = useState<{kcal:number; km:number}|null>(null);
  const [exercises, setExercises]     = useState<Exercise[]>([]);
  const [bodyFat, setBodyFat]         = useState(20);

  // ── Refs ──────────────────────────────────────────────────
  const timerRef      = useRef<NodeJS.Timeout|null>(null);
  const watchRef      = useRef<number|null>(null);
  const lastPosRef    = useRef<GeolocationPosition|null>(null);
  const startTimeRef  = useRef<number>(0);
  const pauseAccRef   = useRef<number>(0);  // accumulated paused seconds
  const accelRef      = useRef<{x:number;y:number;z:number}[]>([]);
  const stepBufRef    = useRef<number[]>([]);
  const canvasRef     = useRef<HTMLCanvasElement>(null);

  // ── Load AI data ──────────────────────────────────────────
  useEffect(() => {
    const scans   = JSON.parse(localStorage.getItem('fitjourney_scan_history') || '[]');
    const profile = JSON.parse(localStorage.getItem('fitjourney_profile') || '{}');
    const plan    = JSON.parse(localStorage.getItem('fitjourney_latest_ideal_body_plan') || 'null');

    if (scans.length > 0) {
      const scan = scans[0];
      const bf = scan.bf || 20;
      setBodyFat(bf);
      const gap = bf - parseFloat(profile.goalBf || '15');
      let kcal = 150;
      if (gap > 10) kcal = 600;
      else if (gap > 5) kcal = 450;
      else if (gap > 2) kcal = 300;
      const km = parseFloat((kcal / CALORIES_PER_KM_WALK).toFixed(1));
      setAiGoal({ kcal, km });
      const recs = suggestedExercises.slice(0, 5);
      setExercises(calculateDynamicWorkoutPlan(kcal, bf, recs));
    } else {
      setExercises(suggestedExercises.slice(0, 5));
    }

    // Check GPS availability
    if ('geolocation' in navigator) setGpsAvail(true);
  }, []);

  // ── Route canvas drawing ──────────────────────────────────
  useEffect(() => {
    if (route.length < 2 || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const lats = route.map(c => c.lat);
    const lngs = route.map(c => c.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const padX = 20, padY = 20;
    const W = canvas.width - 2*padX;
    const H = canvas.height - 2*padY;

    const toX = (lng: number) => maxLng === minLng ? canvas.width/2 : padX + ((lng - minLng) / (maxLng - minLng)) * W;
    const toY = (lat: number) => maxLat === minLat ? canvas.height/2 : padY + ((maxLat - lat) / (maxLat - minLat)) * H;

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#22c55e88';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    route.forEach((c, i) => {
      const x = toX(c.lng), y = toY(c.lat);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Start dot
    ctx.fillStyle = '#3b82f6'; ctx.shadowBlur = 12; ctx.shadowColor = '#3b82f6';
    ctx.beginPath(); ctx.arc(toX(route[0].lng), toY(route[0].lat), 6, 0, Math.PI*2); ctx.fill();
    // End dot
    ctx.fillStyle = '#ef4444'; ctx.shadowColor = '#ef4444';
    ctx.beginPath(); ctx.arc(toX(route[route.length-1].lng), toY(route[route.length-1].lat), 6, 0, Math.PI*2); ctx.fill();
  }, [route]);

  // ── Timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'active') {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000) + pauseAccRef.current);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // ── Derived stats ─────────────────────────────────────────
  useEffect(() => {
    const calPer = mode === 'run' ? CALORIES_PER_KM_RUN : CALORIES_PER_KM_WALK;
    setCalories(Math.round(distance * calPer));
    if (elapsed > 10 && distance > 0) {
      const minPerKm = (elapsed / 60) / distance;
      setPace(parseFloat(minPerKm.toFixed(2)));
    }
    if (elapsed > 0) setCadence(Math.round((steps / elapsed) * 60));
  }, [distance, elapsed, steps, mode]);

  // ── GPS watch ─────────────────────────────────────────────
  const startGps = useCallback(() => {
    watchRef.current = navigator.geolocation.watchPosition(pos => {
      if (lastPosRef.current) {
        const inc = haversine(
          lastPosRef.current.coords.latitude, lastPosRef.current.coords.longitude,
          pos.coords.latitude, pos.coords.longitude
        );
        if (inc > 0.003) { // >3m movement threshold
          setDistance(d => d + inc);
          setSteps(s => s + Math.round((inc * 1000) / STEP_LENGTH_M));
          setRoute(r => [...r.slice(-200), { lat: pos.coords.latitude, lng: pos.coords.longitude }]);
        }
      }
      lastPosRef.current = pos;
    }, () => setOfflineMode(true), { enableHighAccuracy: true, maximumAge: 1000 });
  }, []);

  // ── Accelerometer step counting (offline) ─────────────────
  const startAccel = useCallback(() => {
    const handler = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      accelRef.current.push({ x: acc.x||0, y: acc.y||0, z: acc.z||0 });
      if (accelRef.current.length > 10) accelRef.current.shift();
      const mag = Math.sqrt(accelRef.current.reduce((s,a) => s + a.x**2 + a.y**2 + a.z**2, 0) / accelRef.current.length);
      stepBufRef.current.push(mag);
      if (stepBufRef.current.length > 4) {
        const [a, b, c, d] = stepBufRef.current.slice(-4);
        if (b > a && b > c && b > 11) { // peak detection
          setSteps(s => s + 1);
          setDistance(d2 => d2 + STEP_LENGTH_M / 1000);
        }
        stepBufRef.current.shift();
      }
    };
    window.addEventListener('devicemotion', handler);
    return () => window.removeEventListener('devicemotion', handler);
  }, []);

  // ── Start / Pause / Stop ──────────────────────────────────
  const handleStart = () => {
    startTimeRef.current = Date.now();
    setPhase('active');
    if (gpsAvail) {
      navigator.geolocation.getCurrentPosition(
        () => startGps(),
        () => { setOfflineMode(true); startAccel(); }
      );
    } else {
      setOfflineMode(true);
      startAccel();
    }
  };

  const handlePause = () => {
    pauseAccRef.current = elapsed;
    setPhase('paused');
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
  };

  const handleResume = () => {
    startTimeRef.current = Date.now();
    setPhase('active');
    if (!offlineMode) startGps(); else startAccel();
  };

  const handleStop = () => {
    setPhase('idle');
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    // Save session
    if (elapsed > 10) {
      const sessions = JSON.parse(localStorage.getItem('fitjourney_run_sessions') || '[]');
      sessions.unshift({ mode, elapsed, distance, steps, calories, pace, date: new Date().toISOString() });
      localStorage.setItem('fitjourney_run_sessions', JSON.stringify(sessions.slice(0,30)));
    }
    setElapsed(0); setDistance(0); setSteps(0); setCalories(0); setPace(0); setCadence(0);
    setRoute([]); pauseAccRef.current = 0; lastPosRef.current = null;
  };

  // ── Progress % ────────────────────────────────────────────
  const prog = aiGoal ? Math.min(100, (calories / aiGoal.kcal) * 100) : 0;

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', color:'#fff', fontFamily:'system-ui,sans-serif', paddingBottom:'90px' }}>

      {/* ── Header ── */}
      <div style={{ padding:'24px 20px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <p style={{ fontSize:'11px', color:'#6b7280', letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:'4px' }}>FitJourney</p>
          <h1 style={{ fontSize:'28px', fontWeight:900, margin:0, background:'linear-gradient(135deg,#22c55e,#3b82f6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Activity Tracker</h1>
        </div>
        {/* Mode toggle */}
        <div style={{ display:'flex', background:'#1a1a2e', borderRadius:'12px', padding:'4px', border:'1px solid #2a2a4a' }}>
          {(['walk','run'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ padding:'6px 14px', borderRadius:'8px', border:'none', fontSize:'12px', fontWeight:700, cursor:'pointer', background: mode===m ? '#22c55e' : 'transparent', color: mode===m ? '#000' : '#6b7280', transition:'all 0.2s' }}>
              {m === 'walk' ? '🚶 Walk' : '🏃 Run'}
            </button>
          ))}
        </div>
      </div>

      {/* ── AI Goal Banner ── */}
      {aiGoal && (
        <div style={{ margin:'20px 20px 0', borderRadius:'20px', background:'linear-gradient(135deg,#1a2f1a,#0d1b2a)', border:'1px solid #22c55e33', padding:'18px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <BrainCircuit size={16} color='#22c55e' />
              <span style={{ fontSize:'11px', color:'#22c55e', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>AI Daily Goal</span>
            </div>
            <span style={{ fontSize:'12px', color:'#6b7280' }}>{Math.round(prog)}% done</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'10px' }}>
            <span style={{ fontSize:'22px', fontWeight:900 }}>{aiGoal.kcal} <span style={{ fontSize:'13px', color:'#6b7280', fontWeight:400 }}>kcal</span></span>
            <span style={{ fontSize:'22px', fontWeight:900 }}>{aiGoal.km} <span style={{ fontSize:'13px', color:'#6b7280', fontWeight:400 }}>km</span></span>
          </div>
          {/* Progress bar */}
          <div style={{ height:'6px', background:'#1e3a1e', borderRadius:'999px', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${prog}%`, background:'linear-gradient(90deg,#22c55e,#3b82f6)', borderRadius:'999px', transition:'width 0.5s' }} />
          </div>
          <p style={{ fontSize:'10px', color:'#6b7280', marginTop:'8px', margin:'6px 0 0' }}>Based on your {bodyFat}% body fat scan</p>
        </div>
      )}

      {/* ── GPS / Offline Badge ── */}
      {phase !== 'idle' && (
        <div style={{ margin:'12px 20px 0', display:'flex', justifyContent:'flex-end' }}>
          <span style={{ fontSize:'10px', padding:'4px 10px', borderRadius:'999px', background: offlineMode ? '#3b1a00' : '#0d2a1a', color: offlineMode ? '#f97316' : '#22c55e', border:`1px solid ${offlineMode ? '#f9731633' : '#22c55e33'}`, fontWeight:700 }}>
            {offlineMode ? '📡 Offline Mode (Accelerometer)' : '🛰 GPS Active'}
          </span>
        </div>
      )}

      {/* ── Big Stats ── */}
      <div style={{ margin:'20px 20px 0', borderRadius:'24px', background:'#111118', border:'1px solid #1e1e30', padding:'24px', position:'relative', overflow:'hidden' }}>
        {/* Glow when active */}
        {phase === 'active' && (
          <div style={{ position:'absolute', top:'-60px', left:'50%', transform:'translateX(-50%)', width:'200px', height:'120px', background:'radial-gradient(ellipse,#22c55e22,transparent)', pointerEvents:'none' }} />
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'16px', textAlign:'center', marginBottom:'20px' }}>
          {[
            { icon:<MapPin size={16} color='#3b82f6'/>, label:'KM', val: distance.toFixed(2), color:'#3b82f6' },
            { icon:<Clock size={16} color='#a78bfa'/>, label:'TIME', val: fmtTime(elapsed), color:'#a78bfa' },
            { icon:<Flame size={16} color='#ef4444'/>, label:'KCAL', val: calories.toString(), color:'#ef4444' },
          ].map(s => (
            <div key={s.label} style={{ padding:'16px 8px', background:'#1a1a2e', borderRadius:'16px', border:'1px solid #2a2a4a' }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:'8px' }}>{s.icon}</div>
              <p style={{ fontSize:'10px', color:'#6b7280', letterSpacing:'0.1em', marginBottom:'4px' }}>{s.label}</p>
              <p style={{ fontSize:'22px', fontWeight:900, color:s.color, margin:0 }}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Secondary Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', textAlign:'center' }}>
          {[
            { icon:<Footprints size={14} color='#22c55e'/>, label:'STEPS', val: steps.toLocaleString(), color:'#22c55e' },
            { icon:<TrendingUp size={14} color='#f59e0b'/>, label:'PACE', val: pace > 0 ? `${pace}'/km` : '--', color:'#f59e0b' },
            { icon:<Activity size={14} color='#ec4899'/>, label:'CADENCE', val: cadence > 0 ? `${cadence}/m` : '--', color:'#ec4899' },
          ].map(s => (
            <div key={s.label} style={{ padding:'12px 8px', background:'#0f0f1a', borderRadius:'12px' }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:'6px' }}>{s.icon}</div>
              <p style={{ fontSize:'9px', color:'#6b7280', letterSpacing:'0.1em', marginBottom:'2px' }}>{s.label}</p>
              <p style={{ fontSize:'15px', fontWeight:800, color:s.color, margin:0 }}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* ── Control Buttons ── */}
        <div style={{ display:'flex', justifyContent:'center', gap:'16px', marginTop:'24px' }}>
          {phase === 'idle' && (
            <button onClick={handleStart} style={{ width:'72px', height:'72px', borderRadius:'50%', background:'linear-gradient(135deg,#22c55e,#16a34a)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 30px #22c55e55', transform:'scale(1)', transition:'all 0.15s' }} onMouseDown={e => (e.currentTarget.style.transform='scale(0.93)')} onMouseUp={e => (e.currentTarget.style.transform='scale(1)')}>
              <Play size={28} color='#fff' fill='#fff' style={{ marginLeft:'4px' }} />
            </button>
          )}
          {phase === 'active' && (
            <button onClick={handlePause} style={{ width:'72px', height:'72px', borderRadius:'50%', background:'linear-gradient(135deg,#f59e0b,#d97706)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 30px #f59e0b55', transition:'all 0.15s' }}>
              <Pause size={28} color='#fff' fill='#fff' />
            </button>
          )}
          {phase === 'paused' && (
            <button onClick={handleResume} style={{ width:'72px', height:'72px', borderRadius:'50%', background:'linear-gradient(135deg,#22c55e,#16a34a)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 30px #22c55e55', transition:'all 0.15s' }}>
              <Play size={28} color='#fff' fill='#fff' style={{ marginLeft:'4px' }} />
            </button>
          )}
          {phase !== 'idle' && (
            <button onClick={handleStop} style={{ width:'72px', height:'72px', borderRadius:'50%', background:'linear-gradient(135deg,#ef4444,#dc2626)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 30px #ef444455', transition:'all 0.15s' }}>
              <Square size={28} color='#fff' fill='#fff' />
            </button>
          )}
        </div>
      </div>

      {/* ── Route Canvas ── */}
      {route.length > 1 && (
        <div style={{ margin:'16px 20px 0', borderRadius:'20px', overflow:'hidden', border:'1px solid #1e1e30', background:'#0d0d1a' }}>
          <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:'8px', borderBottom:'1px solid #1e1e30' }}>
            <MapPin size={14} color='#22c55e' />
            <span style={{ fontSize:'12px', fontWeight:700, color:'#22c55e' }}>LIVE ROUTE MAP</span>
            <span style={{ fontSize:'10px', color:'#6b7280', marginLeft:'auto' }}>{route.length} GPS points</span>
          </div>
          <canvas ref={canvasRef} width={400} height={200} style={{ width:'100%', display:'block' }} />
          <div style={{ padding:'8px 16px', display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:'10px', color:'#3b82f6' }}>● Start</span>
            <span style={{ fontSize:'10px', color:'#ef4444' }}>● Current</span>
          </div>
        </div>
      )}

      {/* ── AI Exercise Recommendations ── */}
      {exercises.length > 0 && (
        <div style={{ margin:'20px 20px 0' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px' }}>
            <Dumbbell size={16} color='#22c55e' />
            <h2 style={{ fontSize:'14px', fontWeight:800, margin:0, color:'#fff' }}>AI Coach Recommendations</h2>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {exercises.map(ex => (
              <div key={ex.id} onClick={() => router.push(`/track/workout?id=${ex.id}`)} style={{ display:'flex', alignItems:'center', gap:'14px', padding:'14px 16px', background:'#111118', borderRadius:'16px', border:'1px solid #1e1e30', cursor:'pointer', transition:'all 0.2s' }} onMouseEnter={e => (e.currentTarget.style.borderColor='#22c55e55')} onMouseLeave={e => (e.currentTarget.style.borderColor='#1e1e30')}>
                <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:'#1a2f1a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', flexShrink:0 }}>{ex.icon}</div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:'14px', fontWeight:700, margin:'0 0 2px' }}>{ex.name}</p>
                  <p style={{ fontSize:'11px', color:'#6b7280', margin:0 }}>{ex.reps} · {ex.sets}</p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ fontSize:'13px', fontWeight:800, color:'#22c55e', margin:'0 0 2px' }}>~{ex.caloriesPerMinute * ex.durationMinutes} kcal</p>
                  <p style={{ fontSize:'10px', color:'#6b7280', margin:0 }}>{ex.durationMinutes} min</p>
                </div>
                <ChevronRight size={16} color='#4b5563' />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#0a0a0f' }}><Loader2 className="h-10 w-10 animate-spin" color='#22c55e' /></div>}>
      <TrackerContent />
    </Suspense>
  );
}
