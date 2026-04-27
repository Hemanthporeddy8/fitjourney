
'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Pause, ChevronRight, BrainCircuit } from 'lucide-react';
import { suggestedExercises, type Exercise } from '@/lib/exercise-data';
import { runPoseInference, loadWorkoutModel, CONNECTING_LINES } from '@/lib/workout-engine';

// ── WorkoutNet COCO 17 Landmark Indices ────────────────────────
const WN = { NOSE:0, L_SHOULDER:5, R_SHOULDER:6, L_ELBOW:7, R_ELBOW:8,
             L_WRIST:9, R_WRIST:10, L_HIP:11, R_HIP:12,
             L_KNEE:13, R_KNEE:14, L_ANKLE:15, R_ANKLE:16 };

function WorkoutClientContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const exerciseId = searchParams.get('id');

    const [exercise, setExercise] = useState<Exercise | null>(null);
    const [queue, setQueue] = useState<Exercise[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(true);
    const [exerciseTime, setExerciseTime] = useState(0);
    const [isDemoPaused, setIsDemoPaused] = useState(false);
    const [isResting, setIsResting] = useState(false);
    const [restTimer, setRestTimer] = useState(10);
    const [aiEnabled, setAiEnabled] = useState(true);
    const [isAiReady, setIsAiReady] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(true);
    const [repCount, setRepCount] = useState(0);
    const [countdown, setCountdown] = useState(10);
    const [aiProgress, setAiProgress] = useState(0);

    const videoRef    = useRef<HTMLVideoElement | null>(null);
    const canvasRef   = useRef<HTMLCanvasElement | null>(null);
    const demoVideoRef = useRef<HTMLVideoElement | null>(null);
    const poseRef     = useRef<any>(null);
    const cameraRef   = useRef<any>(null);
    const timerRef    = useRef<NodeJS.Timeout | null>(null);
    const restTimerRef = useRef<NodeJS.Timeout | null>(null);
    const reqFrameRef = useRef<number>();
    const streamRef   = useRef<MediaStream | null>(null);
    const poseStateRef = useRef<'up'|'down'>('up');
    const repRef      = useRef(0);
    const exRef       = useRef<Exercise | null>(null);

    // ── EXERCISE QUEUE ────────────────────────────────────────
    useEffect(() => {
        const savedScans = JSON.parse(localStorage.getItem('fitjourney_scan_history') || '[]');
        const savedPlan  = JSON.parse(localStorage.getItem('fitjourney_latest_ideal_body_plan') || 'null');
        let recs: Exercise[] = [];
        if (savedScans.length > 0) {
            const bt = savedScans[0].bodyType;
            const focus = savedPlan?.workoutPlan?.focus?.toLowerCase() || '';
            if (bt === 'upper_body') recs = suggestedExercises.filter(e => ['3','7'].includes(e.id));
            else if (bt === 'lower_body') recs = suggestedExercises.filter(e => ['4','6','8'].includes(e.id));
            else recs = suggestedExercises.filter(e => ['5','1','9'].includes(e.id));
            if (focus.includes('hypertrophy')) recs = recs.map(r => ({...r, reps:'15-20 reps', sets:'4 sets'}));
        }
        if (!recs.length) recs = suggestedExercises.slice(0, 3);
        setQueue(recs);
        const idx = Math.max(0, recs.findIndex(e => e.id === exerciseId));
        const ex = recs[idx];
        if (ex) { setExercise(ex); exRef.current = ex; setCurrentIndex(idx); setExerciseTime(ex.durationMinutes * 60); }
    }, [exerciseId]);

    // ── TIMERS ────────────────────────────────────────────────
    useEffect(() => {
        if (!isResting && !isPaused && exerciseTime > 0) {
            timerRef.current = setInterval(() => setExerciseTime(p => { if (p<=1){setIsResting(true);return 0;} return p-1; }), 1000);
        } else { if (timerRef.current) clearInterval(timerRef.current); }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isResting, isPaused, exerciseTime]);

    useEffect(() => {
        if (isResting) {
            setRestTimer(10);
            restTimerRef.current = setInterval(() => setRestTimer(p => p > 0 ? p-1 : 0), 1000);
        } else { if (restTimerRef.current) clearInterval(restTimerRef.current); }
        return () => { if (restTimerRef.current) clearInterval(restTimerRef.current); };
    }, [isResting]);

    useEffect(() => { if (isResting && restTimer === 0) handleNext(); }, [isResting, restTimer]);

    // ── COUNTDOWN TIMER ───────────────────────────────────────
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => {
                if (countdown === 1) setIsPaused(false);
                setCountdown(c => c - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    async function initWorkoutNet() {
        if (!videoRef.current || !canvasRef.current) return;
        setIsAiLoading(true);
        await loadWorkoutModel();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            videoRef.current.srcObject = stream;
            streamRef.current = stream;
            
            const startAI = async () => {
                if (videoRef.current) {
                    setIsAiReady(true);
                    setIsAiLoading(false);
                    if (!reqFrameRef.current) {
                        reqFrameRef.current = requestAnimationFrame(loopWorkoutNet);
                    }
                    try {
                        await videoRef.current.play();
                    } catch (e) {
                         console.log("Play interrupted or waiting for user gesture...");
                    }
                }
            };

            videoRef.current.onloadedmetadata = startAI;
            videoRef.current.onloadeddata = startAI;
            videoRef.current.oncanplay = startAI;
            
            if (videoRef.current.readyState >= 2) {
                startAI();
            }
        } catch (err) {
            console.error("Camera access denied or failed", err);
            setIsAiReady(false);
            setIsAiLoading(false);
        }
    }

    async function loopWorkoutNet() {
        if (!canvasRef.current || !videoRef.current || !aiEnabled) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const res = await runPoseInference(video);
            if (res) {
                const ctx = canvas.getContext('2d')!;
                canvas.width  = video.videoWidth  || 640;
                canvas.height = video.videoHeight || 480;
                
                ctx.save();
                ctx.scale(-1, 1);
                ctx.translate(-canvas.width, 0); // mirror alignment
                // We do not draw the video frame onto the canvas here because
                // the <video> element itself is rendered directly behind it!
                ctx.restore();

                drawSkeleton(ctx, res.keypoints, canvas.width, canvas.height);
                countReps(res.keypoints);
            }
        }
        reqFrameRef.current = requestAnimationFrame(loopWorkoutNet);
    }

    function drawSkeleton(ctx: CanvasRenderingContext2D, kp: any[], W: number, H: number) {
        ctx.strokeStyle = '#F49B33'; ctx.lineWidth = 3;
        for (const [a, b] of CONNECTING_LINES) {
            if ((kp[a]?.confidence||0) > 0.1 && (kp[b]?.confidence||0) > 0.1) {
                ctx.beginPath();
                ctx.moveTo((1 - kp[a].x) * W, kp[a].y * H); // Mirror the drawn points
                ctx.lineTo((1 - kp[b].x) * W, kp[b].y * H);
                ctx.stroke();
            }
        }
        ctx.fillStyle = '#ffffff';
        for (const pt of kp) {
            if ((pt.confidence||0) > 0.1) {
                ctx.beginPath();
                ctx.arc((1 - pt.x) * W, pt.y * H, 5, 0, Math.PI*2);
                ctx.fill();
            }
        }
    }

    function countReps(kp: any[]) {
        const ex = exRef.current; if (!ex) return;
        const lHip = kp[WN.L_HIP], lKnee = kp[WN.L_KNEE];
        const lWrist = kp[WN.L_WRIST], nose = kp[WN.NOSE];

        if (['5','4','8','6'].includes(ex.id) && (lHip?.confidence||0) > 0.1 && (lKnee?.confidence||0) > 0.1) {
            if (lHip.y > lKnee.y && poseStateRef.current === 'up')   { poseStateRef.current = 'down'; }
            if (lHip.y < lKnee.y && poseStateRef.current === 'down') { poseStateRef.current = 'up'; repRef.current++; setRepCount(repRef.current); }
        } else if (ex.id === '1' && (lWrist?.confidence||0) > 0.1 && (nose?.confidence||0) > 0.1) {
            if (lWrist.y < nose.y && poseStateRef.current === 'up')   { poseStateRef.current = 'down'; repRef.current++; setRepCount(repRef.current); }
            if (lWrist.y > nose.y && poseStateRef.current === 'down') { poseStateRef.current = 'up'; }
        }
    }

    // ── AI TOGGLE ─────────────────────────────────────────────
    const prevAiRef = useRef(true);
    useEffect(() => {
        if (!aiEnabled && prevAiRef.current) {
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            if (reqFrameRef.current) cancelAnimationFrame(reqFrameRef.current);
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
            setIsAiReady(false);
            setIsAiLoading(false);
        } else if (aiEnabled && !prevAiRef.current) {
            initWorkoutNet();
        }
        prevAiRef.current = aiEnabled;
    }, [aiEnabled]);

    // ── CLEANUP ───────────────────────────────────────────────
    useEffect(() => {
        if (aiEnabled) initWorkoutNet();
        return () => {
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            if (reqFrameRef.current) cancelAnimationFrame(reqFrameRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
            if (restTimerRef.current) clearInterval(restTimerRef.current);
        };
    }, []);

    const handleNext = () => {
        setIsResting(false); repRef.current = 0; setRepCount(0); poseStateRef.current = 'up';
        router.replace(`/track/workout?id=${queue[(currentIndex + 1) % queue.length].id}`);
    };

    if (!exercise) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center p-4 pb-24">

            {/* HEADER */}
            <div className="w-full max-w-lg flex items-center justify-between mb-6">
                <Button variant="ghost" className="text-white hover:bg-white/10 rounded-full h-12 w-12 p-0" onClick={() => router.push('/track')}>
                    <ArrowLeft className="h-6 w-6" />
                </Button>
                <div className="text-center">
                    <p className="text-[10px] font-black tracking-widest text-accent uppercase">Exercise {currentIndex+1} of {queue.length}</p>
                    <h1 className="text-xl font-black">{exercise.name}</h1>
                </div>
                <Button variant="outline" size="sm"
                    className={`rounded-full h-10 px-4 ${aiEnabled ? 'bg-accent/10 border-accent text-accent' : 'bg-zinc-800 text-white/40'}`}
                    onClick={() => setAiEnabled(p => !p)}>
                    <BrainCircuit className={`h-4 w-4 mr-2 ${aiEnabled && isAiReady ? 'animate-pulse' : ''}`} />
                    {aiEnabled ? 'AI On' : 'AI Off'}
                </Button>
            </div>

            {/* DUAL SPLIT */}
            <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* AI CAM */}
                <div className="flex flex-col space-y-3">
                    <p className="text-[10px] font-black tracking-[0.2em] text-accent uppercase flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-accent animate-pulse" /> Live AI Trainer
                    </p>
                    <div className="aspect-video rounded-3xl overflow-hidden bg-black relative border-2 border-accent/20">
                        <video ref={videoRef} playsInline muted style={{ transform: 'scaleX(-1)' }} className="absolute inset-0 w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                        {isAiLoading && aiEnabled && (
                            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                                <div className="h-10 w-10 border-4 border-accent border-t-transparent rounded-full animate-spin mb-3" />
                                <p className="text-xs font-bold text-accent uppercase tracking-widest">Loading AI Trainer...</p>
                            </div>
                        )}
                        {!aiEnabled && (
                            <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
                                <BrainCircuit className="h-12 w-12 text-white/10" />
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
                            <video ref={demoVideoRef} key={exercise.videoUrl} src={exercise.videoUrl}
                                autoPlay={!isDemoPaused} loop muted playsInline className="w-full h-full object-cover" />
                            <Button variant="ghost" size="icon"
                                className="absolute bottom-4 right-4 bg-black/40 rounded-full h-10 w-10 border border-white/10"
                                onClick={() => { isDemoPaused ? demoVideoRef.current?.play() : demoVideoRef.current?.pause(); setIsDemoPaused(p=>!p); }}>
                                {isDemoPaused ? <Play className="h-5 w-5 fill-white"/> : <Pause className="h-5 w-5 fill-white"/>}
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
                    <p className="text-6xl font-black font-mono">{Math.floor(exerciseTime/60)}:{String(exerciseTime%60).padStart(2,'0')}</p>
                </div>
            </div>

            {/* STATS + CONTROLS */}
            <div className="w-full max-w-2xl space-y-6">
                <div className="grid grid-cols-3 gap-4 py-6 border-y border-white/10">
                    <div className="text-center"><p className="text-3xl font-black">{exercise.sets}</p><p className="text-[10px] uppercase font-bold text-white/40">Sets</p></div>
                    <div className="text-center border-x border-white/10"><p className="text-3xl font-black">{exercise.reps}</p><p className="text-[10px] uppercase font-bold text-white/40">Reps</p></div>
                    <div className="text-center"><p className="text-3xl font-black">{exercise.durationMinutes}m</p><p className="text-[10px] uppercase font-bold text-white/40">Time</p></div>
                </div>
                <p className="text-center text-white/60 text-sm italic px-6">&quot;{exercise.description}&quot;</p>
                <div className="grid grid-cols-2 gap-4">
                    {exerciseTime === exercise.durationMinutes*60 && isPaused ? (
                        <Button size="lg" className="col-span-2 h-16 rounded-2xl font-black text-xl bg-accent hover:bg-accent/90 animate-pulse"
                            onClick={() => setIsPaused(false)}>
                            START WORKOUT
                        </Button>
                    ) : (
                        <>
                            <Button size="lg" variant="secondary" className="h-16 rounded-2xl font-black bg-zinc-900 border border-white/10" onClick={handleNext}>
                                NEXT <ChevronRight className="ml-2 h-5 w-5"/>
                            </Button>
                            <Button size="lg" className="h-16 rounded-2xl font-black bg-accent hover:bg-accent/90"
                                onClick={() => setIsResting(true)} disabled={isResting}>
                                {isResting ? 'RESTING...' : 'DONE SET'}
                            </Button>
                        </>
                    )}
                </div>
                {isResting && <Button variant="ghost" className="w-full text-white/40" onClick={() => setIsResting(false)}>Skip Break</Button>}
            </div>

            {/* STATS + CONTROLS END */}
        </div>
    );
}

export default function WorkoutPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">Initializing Studio...</div>}>
            <WorkoutClientContent />
        </Suspense>
    );
}
