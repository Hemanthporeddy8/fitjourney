'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Pause, ChevronRight, BrainCircuit, AlertTriangle } from 'lucide-react';
import { suggestedExercises, type Exercise } from '@/lib/exercise-data';
import { runPoseInference, loadWorkoutModel, CONNECTING_LINES } from '@/lib/workout-engine';

const WN = {
  NOSE: 0, L_SHOULDER: 5, R_SHOULDER: 6,
  L_ELBOW: 7,  R_ELBOW: 8,
  L_WRIST: 9,  R_WRIST: 10,
  L_HIP: 11,   R_HIP: 12,
  L_KNEE: 13,  R_KNEE: 14,
  L_ANKLE: 15, R_ANKLE: 16,
};

type AiStatus = 'idle' | 'loading-model' | 'loading-camera' | 'ready' | 'error';

function WorkoutClientContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const exerciseId   = searchParams.get('id');

  const [exercise, setExercise]         = useState<Exercise | null>(null);
  const [queue, setQueue]               = useState<Exercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused]         = useState(true);
  const [exerciseTime, setExerciseTime] = useState(0);
  const [isDemoPaused, setIsDemoPaused] = useState(false);
  const [isResting, setIsResting]       = useState(false);
  const [restTimer, setRestTimer]       = useState(10);
  const [aiEnabled, setAiEnabled]       = useState(true);
  const [aiStatus, setAiStatus]         = useState<AiStatus>('idle');
  const [aiError, setAiError]           = useState<string | null>(null);
  const [repCount, setRepCount]         = useState(0);
  const [countdown, setCountdown]       = useState(10);
  const [skeletonQuality, setSkeletonQuality] = useState<'none' | 'partial' | 'ready'>('none');
  const [detectedParts, setDetectedParts] = useState({ arms: false, core: false, legs: false });

  const videoRef       = useRef<HTMLVideoElement | null>(null);
  const canvasRef      = useRef<HTMLCanvasElement | null>(null);
  const demoVideoRef   = useRef<HTMLVideoElement | null>(null);
  const timerRef       = useRef<NodeJS.Timeout | null>(null);
  const restTimerRef   = useRef<NodeJS.Timeout | null>(null);
  const reqFrameRef    = useRef<number | undefined>();
  const streamRef      = useRef<MediaStream | null>(null);
  const poseStateRef   = useRef<'top' | 'bottom'>('top');
  const repRef         = useRef(0);
  const exRef          = useRef<Exercise | null>(null);
  const loopActiveRef  = useRef(false);
  const initRunningRef = useRef(false);
  const stopCameraRef  = useRef<() => void>(() => {});
  // Anti-noise: minimum ms between two reps (prevents noise spikes from counting)
  const lastRepTimeRef    = useRef(0);
  const MIN_REP_MS        = 600;
  // Anti-noise: require pose held for N consecutive frames before state change
  const frameCountRef     = useRef(0);
  const FRAMES_REQUIRED   = 3;

  // ── Exercise queue ──────────────────────────────────────────
  useEffect(() => {
    const savedScans = JSON.parse(localStorage.getItem('fitjourney_scan_history') || '[]');
    const savedPlan  = JSON.parse(localStorage.getItem('fitjourney_latest_ideal_body_plan') || 'null');
    let recs: Exercise[] = [];
    if (savedScans.length > 0) {
      const bt    = savedScans[0].bodyType;
      const focus = savedPlan?.workoutPlan?.focus?.toLowerCase() || '';
      if (bt === 'upper_body')      recs = suggestedExercises.filter(e => ['3','7'].includes(e.id));
      else if (bt === 'lower_body') recs = suggestedExercises.filter(e => ['4','6','8'].includes(e.id));
      else                          recs = suggestedExercises.filter(e => ['5','1','9'].includes(e.id));
      if (focus.includes('hypertrophy')) recs = recs.map(r => ({ ...r, reps: '15-20 reps', sets: '4 sets' }));
    }
    if (!recs.length) recs = suggestedExercises.slice(0, 3);
    setQueue(recs);
    const idx = Math.max(0, recs.findIndex(e => e.id === exerciseId));
    const ex  = recs[idx];
    if (ex) { 
      setExercise(ex); 
      exRef.current = ex; 
      setCurrentIndex(idx); 
      setExerciseTime(ex.durationMinutes * 60);
      // Reset counters for the new exercise
      repRef.current = 0;
      setRepCount(0);
      poseStateRef.current = 'top';
    }
  }, [exerciseId]);

  // ── Exercise timer ──────────────────────────────────────────
  useEffect(() => {
    if (!isResting && !isPaused && exerciseTime > 0) {
      timerRef.current = setInterval(() =>
        setExerciseTime(p => { if (p <= 1) { setIsResting(true); return 0; } return p - 1; }), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isResting, isPaused, exerciseTime]);

  // ── Rest timer ──────────────────────────────────────────────
  useEffect(() => {
    if (isResting) {
      setRestTimer(10);
      restTimerRef.current = setInterval(() => setRestTimer(p => p > 0 ? p - 1 : 0), 1000);
    } else {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    }
    return () => { if (restTimerRef.current) clearInterval(restTimerRef.current); };
  }, [isResting]);

  useEffect(() => { if (isResting && restTimer === 0) handleNext(); }, [isResting, restTimer]);

  // ── Countdown ───────────────────────────────────────────────
  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => { if (countdown === 1) setIsPaused(false); setCountdown(c => c - 1); }, 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  // ── stopCamera (stored in ref — never changes identity) ─────
  useEffect(() => {
    stopCameraRef.current = () => {
      loopActiveRef.current  = false;
      initRunningRef.current = false;
      if (reqFrameRef.current)  { cancelAnimationFrame(reqFrameRef.current); reqFrameRef.current = undefined; }
      if (streamRef.current)    { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      // FIX 3: do NOT null out srcObject here — it causes a flash-of-black
      // and confuses the next play() call. Clear the canvas instead.
      if (canvasRef.current)    { canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); }
    };
  });

  // ── Core AI init ────────────────────────────────────────────
  const initWorkoutNet = useCallback(async () => {
    // FIX 1: guard against double-invoke (React Strict Mode mounts twice)
    if (initRunningRef.current) return;
    initRunningRef.current = true;

    if (!videoRef.current || !canvasRef.current) {
      initRunningRef.current = false;
      return;
    }

    // Stop any previous loop/stream cleanly
    loopActiveRef.current = false;
    if (reqFrameRef.current)  { cancelAnimationFrame(reqFrameRef.current); reqFrameRef.current = undefined; }
    if (streamRef.current)    { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }

    setAiError(null);
    setAiStatus('loading-model');

    // Hard timeout — never hang forever
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      initRunningRef.current = false;
      setAiStatus('error');
      setAiError('AI trainer timed out. Check camera permissions and try again.');
    }, 15000);

    try {
      // Step 1 — load ONNX model (shared singleton, safe to call many times)
      await loadWorkoutModel();
      if (timedOut) return;

      setAiStatus('loading-camera');

      // Step 2 — request camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (timedOut) { stream.getTracks().forEach(t => t.stop()); return; }

      streamRef.current = stream;

      // FIX 4: assign srcObject ONLY if the video element is still mounted
      if (!videoRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      videoRef.current.srcObject = stream;

      // Step 3 — wait for video data (robust cross-browser approach)
      await new Promise<void>((resolve, reject) => {
        const vid = videoRef.current!;
        // Already has data (e.g. from a previous stream that wasn't fully cleared)
        if (vid.readyState >= 2) { resolve(); return; }

        let resolved = false;
        const done = () => {
          if (resolved) return;
          resolved = true;
          vid.removeEventListener('loadeddata',   done);
          vid.removeEventListener('canplay',       done);
          vid.removeEventListener('loadedmetadata',onMeta);
          vid.removeEventListener('error',         onErr);
          resolve();
        };
        const onMeta = () => {
          // Some browsers only fire loadedmetadata, not loadeddata
          setTimeout(done, 100);
        };
        const onErr = (e: Event) => {
          if (resolved) return;
          resolved = true;
          reject(new Error('Video element error'));
        };
        vid.addEventListener('loadeddata',    done);
        vid.addEventListener('canplay',        done);
        vid.addEventListener('loadedmetadata', onMeta);
        vid.addEventListener('error',          onErr);

        // Fallback: if none of the above fire within 5s, proceed anyway
        setTimeout(() => done(), 5000);
      });

      if (timedOut || !videoRef.current) return;

      // Step 4 — play (ignore autoplay policy errors — stream still works)
      try { await videoRef.current.play(); } catch { /* autoplay blocked is OK */ }

      clearTimeout(timeoutId);
      initRunningRef.current = false;
      setAiStatus('ready');

      // Step 5 — inference loop
      loopActiveRef.current = true;
      const loop = async () => {
        if (!loopActiveRef.current) return;

        const vid    = videoRef.current;
        const canvas = canvasRef.current;
        if (vid && canvas && vid.readyState >= 2 && !vid.paused) {
          const res = await runPoseInference(vid);
          if (res && canvasRef.current && loopActiveRef.current) {
            const ctx     = canvas.getContext('2d')!;
            canvas.width  = vid.videoWidth  || 640;
            canvas.height = vid.videoHeight || 480;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const quality = getSkeletonQuality(res.keypoints, exRef.current?.id || '');
            setSkeletonQuality(quality);
            drawSkeleton(ctx, res.keypoints, canvas.width, canvas.height, quality);
            countReps(res.keypoints);
          }
        }

        if (loopActiveRef.current) {
          reqFrameRef.current = requestAnimationFrame(loop);
        }
      };
      reqFrameRef.current = requestAnimationFrame(loop);

    } catch (err: any) {
      clearTimeout(timeoutId);
      initRunningRef.current = false;
      if (timedOut) return;
      console.error('[WorkoutAI] init failed:', err);
      const msg =
        err?.name === 'NotAllowedError'  ? 'Camera permission denied. Tap the camera icon in your browser address bar to allow it.' :
        err?.name === 'NotFoundError'    ? 'No camera found on this device.' :
        err?.name === 'NotReadableError' ? 'Camera is in use by another app. Close it and try again.' :
        `Could not start AI trainer: ${err?.message || 'Unknown error'}`;
      setAiError(msg);
      setAiStatus('error');
      stopCameraRef.current();
    }
  }, []); // no deps — uses refs for everything mutable

  // ── Skeleton quality check ───────────────────────────────────
  // Returns 'ready' if all critical keypoints visible, 'partial' if some, 'none' if too few
  function getSkeletonQuality(kp: any[], exId: string): 'ready' | 'partial' | 'none' {
    const conf = 0.5; // match new CONF
    const ok = (i: number) => (kp[i]?.confidence || 0) > conf;
    const hasUpperBody = ok(WN.L_SHOULDER) && ok(WN.R_SHOULDER);
    const hasHips      = ok(WN.L_HIP) || ok(WN.R_HIP);
    const hasKnees     = ok(WN.L_KNEE) || ok(WN.R_KNEE);
    const hasWrists    = ok(WN.L_WRIST) || ok(WN.R_WRIST);

    // Update detected parts UI safely
    const newArms = hasUpperBody && hasWrists;
    const newCore = hasHips;
    const newLegs = hasKnees;
    setDetectedParts(prev => {
      if (prev.arms !== newArms || prev.core !== newCore || prev.legs !== newLegs) {
        return { arms: newArms, core: newCore, legs: newLegs };
      }
      return prev;
    });

    // Per-exercise: what's the minimum for accurate counting?
    if (exId === '1') { // Jumping Jacks — needs shoulders + wrists
      if (hasUpperBody && hasWrists) return 'ready';
      if (hasUpperBody) return 'partial';
      return 'none';
    }
    if (['3','7','5'].includes(exId)) { // Squats/Lunges/Burpees — need hips + knees
      if (hasHips && hasKnees) return 'ready';
      if (hasUpperBody) return 'partial';
      return 'none';
    }
    if (exId === '4') { // Push-ups — needs shoulders + elbows
      if (hasUpperBody && ok(WN.L_ELBOW)) return 'ready';
      if (hasUpperBody) return 'partial';
      return 'none';
    }
    if (['2','9'].includes(exId)) { // High Knees / Mountain Climbers
      if (hasHips && hasKnees) return 'ready';
      if (hasUpperBody) return 'partial';
      return 'none';
    }
    if (exId === '8') { // Crunches
      if (hasUpperBody && hasHips) return 'ready';
      if (hasUpperBody) return 'partial';
      return 'none';
    }
    return hasUpperBody ? 'partial' : 'none';
  }

  // ── Skeleton drawing (color = green when ready, orange when partial) ──
  function drawSkeleton(ctx: CanvasRenderingContext2D, kp: any[], W: number, H: number, quality: 'ready' | 'partial' | 'none') {
    const conf = 0.35;
    const lineColor = quality === 'ready' ? '#22c55e' : '#F49B33'; // green or orange
    const dotColor  = quality === 'ready' ? '#86efac' : '#ffffff';
    ctx.strokeStyle = lineColor;
    ctx.lineWidth   = quality === 'ready' ? 4 : 3;
    for (const [a, b] of CONNECTING_LINES) {
      if ((kp[a]?.confidence || 0) > conf && (kp[b]?.confidence || 0) > conf) {
        ctx.beginPath();
        ctx.moveTo((1 - kp[a].x) * W, kp[a].y * H);
        ctx.lineTo((1 - kp[b].x) * W, kp[b].y * H);
        ctx.stroke();
      }
    }
    ctx.fillStyle = dotColor;
    for (const pt of kp) {
      if ((pt.confidence || 0) > conf) {
        ctx.beginPath();
        ctx.arc((1 - pt.x) * W, pt.y * H, quality === 'ready' ? 6 : 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── Adaptive rep counting (debounced + frame-gated) ─────────
  // conf=0.5: only count when AI is highly confident (sigmoid output)
  // MIN_REP_MS: no two reps faster than 600ms (stops noise spikes)
  // FRAMES_REQUIRED: condition must hold for 3 frames (stops single-frame glitches)
  function countReps(kp: any[]) {
    const ex = exRef.current; if (!ex) return;
    const CONF = 0.5; // raised from 0.35 — after sigmoid, 0.5 is solid confidence
    const ok = (i: number) => (kp[i]?.confidence || 0) > CONF;

    const lShoulder = kp[WN.L_SHOULDER], rShoulder = kp[WN.R_SHOULDER];
    const lElbow    = kp[WN.L_ELBOW];
    const lWrist    = kp[WN.L_WRIST],    rWrist    = kp[WN.R_WRIST];
    const lHip      = kp[WN.L_HIP],      rHip      = kp[WN.R_HIP];
    const lKnee     = kp[WN.L_KNEE],     rKnee     = kp[WN.R_KNEE];
    const nose      = kp[WN.NOSE];

    // Helper: called when condition for "top" position is met.
    // Requires N consecutive frames + debounce before counting.
    const registerUp = () => {
      if (poseStateRef.current !== 'bottom') return;
      const now = Date.now();
      if (now - lastRepTimeRef.current < MIN_REP_MS) return; // debounce
      frameCountRef.current++;
      if (frameCountRef.current >= FRAMES_REQUIRED) {
        poseStateRef.current = 'top';
        repRef.current++;
        setRepCount(repRef.current);
        lastRepTimeRef.current = now;
        frameCountRef.current = 0;
        
        // Speak the count so user doesn't need to look at screen
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance(repRef.current.toString());
          utterance.rate = 1.1;
          window.speechSynthesis.speak(utterance);
        }
      }
    };
    const registerDown = () => {
      if (poseStateRef.current !== 'top') return;
      frameCountRef.current++;
      if (frameCountRef.current >= FRAMES_REQUIRED) {
        poseStateRef.current = 'bottom';
        frameCountRef.current = 0;
      }
    };
    const resetFrames = () => { frameCountRef.current = 0; };

    // ── 1. Jumping Jacks ─ wrists above shoulders ────────────────
    if (ex.id === '1') {
      const wristOk   = ok(WN.L_WRIST) || ok(WN.R_WRIST);
      const shoulderOk = ok(WN.L_SHOULDER) || ok(WN.R_SHOULDER);
      if (!wristOk || !shoulderOk) { resetFrames(); return; }
      const wristY    = ok(WN.L_WRIST)    ? lWrist.y    : rWrist.y;
      const shoulderY = ok(WN.L_SHOULDER) ? lShoulder.y : rShoulder.y;
      // wristY < shoulderY means wrist is ABOVE shoulder (y=0 is top of screen)
      if (wristY < shoulderY - 0.05) registerDown(); // arms up   → set to 'bottom'
      else if (wristY > shoulderY + 0.05) registerUp(); // arms down → count rep
      else resetFrames();
    }

    // ── 2. High Knees ─ knee above hip ───────────────────────────
    else if (ex.id === '2') {
      if (ok(WN.L_KNEE) && (ok(WN.L_HIP) || ok(WN.R_HIP))) {
        const hipY = ok(WN.L_HIP) ? lHip.y : rHip.y;
        if (lKnee.y < hipY - 0.04) registerDown();
        else if (lKnee.y > hipY)   registerUp();
        else resetFrames();
      } else resetFrames();
    }

    // ── 3. Squats ─ hip below knee level ─────────────────────────
    else if (ex.id === '3') {
      if (ok(WN.L_HIP) && ok(WN.L_KNEE)) {
        if (lHip.y > lKnee.y + 0.04) registerDown(); // squatting
        else if (lHip.y < lKnee.y)   registerUp();   // standing
        else resetFrames();
      } else if (ok(WN.L_SHOULDER) && ok(WN.R_SHOULDER)) {
        const avgY = (lShoulder.y + rShoulder.y) / 2;
        if (avgY > 0.60) registerDown();
        else if (avgY < 0.50) registerUp();
        else resetFrames();
      } else resetFrames();
    }

    // ── 4. Push-ups ─ shoulder above/below elbow ─────────────────
    else if (ex.id === '4') {
      if (ok(WN.L_SHOULDER) && ok(WN.L_ELBOW)) {
        if (lShoulder.y > lElbow.y + 0.03) registerDown();
        else if (lShoulder.y < lElbow.y)   registerUp();
        else resetFrames();
      } else resetFrames();
    }

    // ── 5. Burpees ───────────────────────────────────────────────
    else if (ex.id === '5') {
      if (ok(WN.L_HIP) && ok(WN.L_KNEE)) {
        if (lHip.y > lKnee.y + 0.04) registerDown();
        else if (lHip.y < lKnee.y)   registerUp();
        else resetFrames();
      } else if (ok(WN.L_SHOULDER) && ok(WN.R_SHOULDER)) {
        const avgY = (lShoulder.y + rShoulder.y) / 2;
        if (avgY > 0.55) registerDown();
        else if (avgY < 0.40) registerUp();
        else resetFrames();
      } else resetFrames();
    }

    // ── 7. Lunges ─────────────────────────────────────────────────
    else if (ex.id === '7') {
      const hasHip  = ok(WN.L_HIP) || ok(WN.R_HIP);
      const hasKnee = ok(WN.L_KNEE) || ok(WN.R_KNEE);
      if (hasHip && hasKnee) {
        const hipY  = ok(WN.L_HIP)  ? lHip.y  : rHip.y;
        const kneeY = ok(WN.L_KNEE) ? lKnee.y : rKnee.y;
        if (hipY > kneeY + 0.04) registerDown();
        else if (hipY < kneeY)   registerUp();
        else resetFrames();
      } else resetFrames();
    }

    // ── 8. Crunches ───────────────────────────────────────────────
    else if (ex.id === '8') {
      if (ok(WN.NOSE) && (ok(WN.L_HIP) || ok(WN.R_HIP))) {
        const hipY = ok(WN.L_HIP) ? lHip.y : rHip.y;
        if (nose.y < hipY - 0.05) registerDown();
        else if (nose.y > hipY)   registerUp();
        else resetFrames();
      } else resetFrames();
    }

    // ── 9. Mountain Climbers ──────────────────────────────────────
    else if (ex.id === '9') {
      const hasKnee = ok(WN.L_KNEE) || ok(WN.R_KNEE);
      const hasHip  = ok(WN.L_HIP)  || ok(WN.R_HIP);
      if (hasKnee && hasHip) {
        const hipY  = ok(WN.L_HIP)  ? lHip.y  : rHip.y;
        const kneeY = ok(WN.L_KNEE) ? lKnee.y : rKnee.y;
        if (kneeY < hipY - 0.04) registerDown();
        else if (kneeY > hipY)   registerUp();
        else resetFrames();
      } else resetFrames();
    }
  }

  // ── AI lifecycle ────────────────────────────────────────────
  // Using module-level flag to survive React Strict Mode double-invoke
  const didMountRef = useRef(false);
  useEffect(() => {
    if (didMountRef.current) return;
    didMountRef.current = true;

    // Small delay ensures videoRef/canvasRef are attached to DOM
    const t = setTimeout(() => {
      if (aiEnabled) initWorkoutNet();
    }, 100);

    return () => {
      clearTimeout(t);
      stopCameraRef.current();
      if (timerRef.current)     clearInterval(timerRef.current);
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, []); // intentionally empty — runs once on mount

  // Toggle effect — only runs when user clicks AI On/Off AFTER mount
  const firstToggleRef = useRef(true);
  useEffect(() => {
    if (firstToggleRef.current) { firstToggleRef.current = false; return; }
    if (aiEnabled) {
      initRunningRef.current = false; // allow re-init
      initWorkoutNet();
    } else {
      stopCameraRef.current();
      setAiStatus('idle');
      setAiError(null);
    }
  }, [aiEnabled, initWorkoutNet]);

  const handleNext = () => {
    setIsResting(false);
    repRef.current = 0; setRepCount(0);
    poseStateRef.current = 'top';
    router.replace(`/track/workout?id=${queue[(currentIndex + 1) % queue.length].id}`);
  };

  const handleSkip = () => {
    const remainingTime = exerciseTime; // seconds
    const remainingExercises = queue.length - currentIndex - 1;
    
    if (remainingExercises > 0) {
      // Distribute remaining time to other exercises
      const extraMinutes = remainingTime / 60 / remainingExercises;
      const newQueue = [...queue];
      for (let i = currentIndex + 1; i < queue.length; i++) {
        newQueue[i] = { ...newQueue[i], durationMinutes: newQueue[i].durationMinutes + extraMinutes };
      }
      setQueue(newQueue);
    } else {
      // Last exercise skipped, convert to walking makeup (8 kcal/min avg)
      const makeupCalories = Math.floor((remainingTime / 60) * 8);
      const existing = parseInt(localStorage.getItem('fitjourney_makeup_calories') || '0');
      localStorage.setItem('fitjourney_makeup_calories', (existing + makeupCalories).toString());
    }
    
    handleNext();
  };

  if (!exercise) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;

  const isAiLoading = aiStatus === 'loading-model' || aiStatus === 'loading-camera';
  const isAiReady   = aiStatus === 'ready';

  const aiLoadingLabel =
    aiStatus === 'loading-model'  ? 'Loading AI model…'  :
    aiStatus === 'loading-camera' ? 'Starting camera…'   : 'Loading…';

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center p-4 pb-24">

      {/* HEADER */}
      <div className="w-full max-w-lg flex items-center justify-between mb-6">
        <Button variant="ghost" className="text-white hover:bg-white/10 rounded-full h-12 w-12 p-0"
          onClick={() => router.push('/track')}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div className="text-center">
          <p className="text-[10px] font-black tracking-widest text-accent uppercase">
            Exercise {currentIndex + 1} of {queue.length}
          </p>
          <h1 className="text-xl font-black">{exercise.name}</h1>
        </div>
        <Button variant="outline" size="sm"
          className={`rounded-full h-10 px-4 ${aiEnabled ? 'bg-accent/10 border-accent text-accent' : 'bg-zinc-800 text-white/40'}`}
          onClick={() => setAiEnabled(p => !p)}>
          <BrainCircuit className={`h-4 w-4 mr-2 ${isAiReady ? 'animate-pulse' : ''}`} />
          {aiEnabled ? 'AI On' : 'AI Off'}
        </Button>
      </div>

      {/* DUAL SPLIT */}
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

        {/* LIVE AI CAM */}
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black tracking-[0.2em] text-accent uppercase flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" /> Live AI Trainer
            </p>
            {isAiReady && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                skeletonQuality === 'ready'   ? 'bg-green-500/20 text-green-400' :
                skeletonQuality === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                                               'bg-white/10 text-white/30'
              }`}>
                {skeletonQuality === 'ready'   ? 'READY TO COUNT' :
                 skeletonQuality === 'partial' ? 'ADAPTIVE MODE ON' :
                                               'LOOKING FOR YOU...'}
              </span>
            )}
          </div>
          {isAiReady && (
            <div className="flex gap-2">
               <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${detectedParts.arms ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-transparent text-white/30 border-white/10'}`}>ARMS</span>
               <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${detectedParts.core ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-transparent text-white/30 border-white/10'}`}>CORE</span>
               <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${detectedParts.legs ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-transparent text-white/30 border-white/10'}`}>LEGS</span>
            </div>
          )}
          <div className="aspect-video rounded-3xl overflow-hidden bg-black relative border-2 border-accent/20">

            {/* Video + canvas — ALWAYS mounted, never conditionally removed */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              style={{ transform: 'scaleX(-1)' }}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {/* Loading overlay */}
            {aiEnabled && isAiLoading && (
              <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center z-10">
                <div className="h-10 w-10 border-4 border-accent border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs font-bold text-accent uppercase tracking-widest">{aiLoadingLabel}</p>
                <p className="text-[10px] text-white/40 mt-1">
                  {aiStatus === 'loading-model' ? 'Downloading model (~850kb)…' : 'Allow camera when prompted'}
                </p>
              </div>
            )}

            {/* Error overlay */}
            {aiEnabled && aiStatus === 'error' && (
              <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center z-20">
                <AlertTriangle className="h-10 w-10 text-amber-400 mb-3" />
                <p className="font-bold uppercase tracking-tight text-sm text-white mb-2">AI Trainer Unavailable</p>
                <p className="text-white/60 text-xs mb-5 leading-relaxed">{aiError}</p>
                <Button size="sm" className="bg-accent hover:bg-accent/90 text-black font-bold"
                  onClick={() => { initRunningRef.current = false; initWorkoutNet(); }}>
                  Try Again
                </Button>
                <Button size="sm" variant="ghost" className="text-white/30 text-xs mt-2"
                  onClick={() => setAiEnabled(false)}>
                  Continue without AI
                </Button>
              </div>
            )}

            {/* AI off */}
            {!aiEnabled && (
              <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center z-10">
                <BrainCircuit className="h-12 w-12 text-white/10 mb-2" />
                <p className="text-xs text-white/20">AI tracking off</p>
              </div>
            )}
          </div>
        </div>

        {/* REFERENCE VIDEO */}
        <div className="flex flex-col space-y-3">
          <p className="text-[10px] font-black tracking-[0.2em] text-white/40 uppercase flex items-center gap-2">
            <Play className="h-2 w-2 fill-white/40" /> Reference Model
          </p>
          {!isResting ? (
            <div className="aspect-video rounded-3xl overflow-hidden bg-black relative border border-white/5">
              <video
                ref={demoVideoRef} key={exercise.videoUrl} src={exercise.videoUrl}
                autoPlay={!isDemoPaused} loop muted playsInline
                className="w-full h-full object-cover"
              />
              <Button variant="ghost" size="icon"
                className="absolute bottom-4 right-4 bg-black/40 rounded-full h-10 w-10 border border-white/10"
                onClick={() => {
                  isDemoPaused ? demoVideoRef.current?.play() : demoVideoRef.current?.pause();
                  setIsDemoPaused(p => !p);
                }}>
                {isDemoPaused ? <Play className="h-5 w-5 fill-white" /> : <Pause className="h-5 w-5 fill-white" />}
              </Button>
            </div>
          ) : (
            <div className="aspect-video rounded-3xl bg-accent/10 border-2 border-accent/20 flex flex-col items-center justify-center">
              <div className="h-16 w-16 rounded-full border-4 border-accent flex items-center justify-center">
                <span className="text-2xl font-black text-accent">{restTimer}</span>
              </div>
              <p className="text-[10px] font-black text-accent tracking-widest uppercase mt-3">Rest</p>
            </div>
          )}
        </div>
      </div>

      {/* HUD */}
      <div className="grid grid-cols-2 gap-6 w-full max-w-xl mb-10">
        <div className="bg-zinc-900/80 border border-accent/30 p-6 rounded-[2rem] text-center">
          <p className="text-[10px] uppercase font-black tracking-[0.3em] text-accent/60 mb-1">Rep Count</p>
          <p className="text-6xl font-black text-accent">{repCount}</p>
        </div>
        <div className="bg-zinc-900/80 border border-white/10 p-6 rounded-[2rem] text-center">
          <p className="text-[10px] uppercase font-black tracking-[0.3em] text-white/40 mb-1">Time Left</p>
          <p className="text-6xl font-black font-mono">
            {Math.floor(exerciseTime / 60)}:{String(exerciseTime % 60).padStart(2, '0')}
          </p>
        </div>
      </div>

      {/* STATS + CONTROLS */}
      <div className="w-full max-w-2xl space-y-6">
        <div className="grid grid-cols-3 gap-4 py-6 border-y border-white/10">
          <div className="text-center"><p className="text-3xl font-black">{exercise.sets}</p><p className="text-[10px] uppercase font-bold text-white/40">Sets</p></div>
          <div className="text-center border-x border-white/10"><p className="text-3xl font-black">{exercise.reps}</p><p className="text-[10px] uppercase font-bold text-white/40">Reps</p></div>
          <div className="text-center"><p className="text-3xl font-black">{Math.round(exercise.durationMinutes)}m</p><p className="text-[10px] uppercase font-bold text-white/40">Time</p></div>
        </div>
        <p className="text-center text-white/60 text-sm italic px-6">&quot;{exercise.description}&quot;</p>
        <div className="grid grid-cols-2 gap-4">
          {exerciseTime === exercise.durationMinutes * 60 && isPaused ? (
            <Button size="lg"
              className="col-span-2 h-16 rounded-2xl font-black text-xl bg-accent hover:bg-accent/90 animate-pulse"
              onClick={() => setIsPaused(false)}>
              START WORKOUT
            </Button>
          ) : (
            <>
              <Button size="lg" variant="secondary"
                className="h-16 rounded-2xl font-black bg-zinc-900 border border-white/10"
                onClick={handleSkip}>
                SKIP EXERCISE <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg"
                className="h-16 rounded-2xl font-black bg-accent hover:bg-accent/90"
                onClick={() => setIsResting(true)} disabled={isResting}>
                {isResting ? 'RESTING…' : 'DONE SET'}
              </Button>
            </>
          )}
        </div>
        {isResting && (
          <Button variant="ghost" className="w-full text-white/40" onClick={() => setIsResting(false)}>
            Skip Break
          </Button>
        )}
      </div>
    </div>
  );
}

export default function WorkoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Initializing Studio…
      </div>
    }>
      <WorkoutClientContent />
    </Suspense>
  );
}
