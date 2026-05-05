'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Dumbbell, BrainCircuit, ChevronRight, Flame, Footprints } from 'lucide-react';
import { suggestedExercises, type Exercise } from '@/lib/exercise-data';
import { calculateDynamicWorkoutPlan } from '@/lib/workout-count-engine';
import { Loader2 } from 'lucide-react';

function TrackContent() {
  const router = useRouter();
  const [aiGoal, setAiGoal]     = useState<{kcal:number; km:number}|null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bodyFat, setBodyFat]   = useState(20);
  const [planTitle, setPlanTitle] = useState('');

  useEffect(() => {
    const scans   = JSON.parse(localStorage.getItem('fitjourney_scan_history') || '[]');
    const profile = JSON.parse(localStorage.getItem('fitjourney_profile') || '{}');
    const plan    = JSON.parse(localStorage.getItem('fitjourney_latest_ideal_body_plan') || 'null');

    if (plan?.planTitle) setPlanTitle(plan.planTitle);

    if (scans.length > 0) {
      const scan = scans[0];
      const bf = scan.bf || 20;
      setBodyFat(bf);
      const gap = bf - parseFloat(profile.goalBf || '15');
      let kcal = 150;
      if (gap > 10) kcal = 600;
      else if (gap > 5) kcal = 450;
      else if (gap > 2) kcal = 300;
      const km = parseFloat((kcal / 60).toFixed(1));
      setAiGoal({ kcal, km });
      const recs = suggestedExercises.slice(0, 5);
      setExercises(calculateDynamicWorkoutPlan(kcal, bf, recs));
    } else {
      setExercises(suggestedExercises.slice(0, 5));
    }
  }, []);

  return (
    <div style={{ minHeight:'100vh', background:'#0d0d14', color:'#fff', fontFamily:'system-ui,sans-serif', paddingBottom:'90px' }}>

      {/* ── Header ── */}
      <div style={{ padding:'28px 20px 0' }}>
        <p style={{ fontSize:'11px', color:'#22c55e', letterSpacing:'0.2em', textTransform:'uppercase', margin:'0 0 4px', fontWeight:700 }}>FITJOURNEY</p>
        <h1 style={{ fontSize:'30px', fontWeight:900, margin:0 }}>Activity Tracker</h1>
      </div>

      {/* ── AI Goal Banner ── */}
      {aiGoal && (
        <div style={{ margin:'20px 16px 0', borderRadius:'20px', background:'linear-gradient(135deg,#0f1f0f,#0d1b2a)', border:'1px solid #22c55e33', padding:'20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
            <BrainCircuit size={15} color='#22c55e' />
            <span style={{ fontSize:'11px', color:'#22c55e', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase' }}>AI Daily Goal</span>
          </div>
          <div style={{ display:'flex', gap:'20px' }}>
            <div>
              <p style={{ margin:0, fontSize:'26px', fontWeight:900 }}>{aiGoal.kcal} <span style={{ fontSize:'13px', color:'#6b7280', fontWeight:400 }}>kcal</span></p>
            </div>
            <div>
              <p style={{ margin:0, fontSize:'26px', fontWeight:900 }}>{aiGoal.km} <span style={{ fontSize:'13px', color:'#6b7280', fontWeight:400 }}>km</span></p>
            </div>
          </div>
          {planTitle && <p style={{ fontSize:'10px', color:'#6b7280', margin:'8px 0 0' }}>Plan: {planTitle}</p>}
        </div>
      )}

      {/* ── Start Activity Cards ── */}
      <div style={{ margin:'20px 16px 0', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
        {[
          { mode:'walk', label:'Walking', emoji:'🚶', color:'#22c55e', desc:'GPS + step tracking', bg:'#0f1f0f' },
          { mode:'run',  label:'Running', emoji:'🏃', color:'#3b82f6', desc:'GPS + pace tracking', bg:'#0d1a30' },
        ].map(({ mode, label, emoji, color, desc, bg }) => (
          <button
            key={mode}
            onClick={() => router.push(`/track/run-track?mode=${mode}`)}
            style={{ background:bg, border:`1px solid ${color}33`, borderRadius:'20px', padding:'20px 16px', cursor:'pointer', textAlign:'left', transition:'all 0.2s', color:'#fff' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = `${color}33`)}
          >
            <div style={{ fontSize:'28px', marginBottom:'10px' }}>{emoji}</div>
            <p style={{ margin:'0 0 4px', fontSize:'16px', fontWeight:800, color }}>{label}</p>
            <p style={{ margin:'0 0 14px', fontSize:'11px', color:'#6b7280' }}>{desc}</p>
            <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 0 16px ${color}55` }}>
              <Play size={16} color='#fff' fill='#fff' style={{ marginLeft:'2px' }} />
            </div>
          </button>
        ))}
      </div>

      {/* ── Stats Summary ── */}
      <div style={{ margin:'16px 16px 0', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
        {[
          { icon:<Footprints size={14} color='#22c55e'/>, label:'STEPS TODAY', val:'--' },
          { icon:<Flame size={14} color='#ef4444'/>, label:'KCAL BURNED', val:'--' },
          { icon:<BrainCircuit size={14} color='#a78bfa'/>, label:'BODY FAT', val:`${bodyFat}%` },
        ].map(s => (
          <div key={s.label} style={{ background:'#111118', borderRadius:'14px', padding:'14px 10px', textAlign:'center', border:'1px solid #1e1e30' }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:'8px' }}>{s.icon}</div>
            <p style={{ margin:'0 0 4px', fontSize:'18px', fontWeight:900 }}>{s.val}</p>
            <p style={{ margin:0, fontSize:'8px', color:'#6b7280', letterSpacing:'0.08em' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── AI Exercise Recommendations ── */}
      <div style={{ margin:'20px 16px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px' }}>
          <Dumbbell size={16} color='#22c55e' />
          <h2 style={{ fontSize:'14px', fontWeight:800, margin:0 }}>AI Coach Recommendations</h2>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {exercises.map(ex => (
            <div key={ex.id} onClick={() => router.push(`/track/workout?id=${ex.id}`)}
              style={{ display:'flex', alignItems:'center', gap:'14px', padding:'14px 16px', background:'#111118', borderRadius:'16px', border:'1px solid #1e1e30', cursor:'pointer', transition:'all 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor='#22c55e44')}
              onMouseLeave={e => (e.currentTarget.style.borderColor='#1e1e30')}
            >
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
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#0d0d14' }}><Loader2 className="h-10 w-10 animate-spin" color='#22c55e' /></div>}>
      <TrackContent />
    </Suspense>
  );
}
