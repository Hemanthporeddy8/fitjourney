'use client';

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Play, Pause, Square, MapPin, Clock, Flame, Footprints, TrendingUp, Activity, ArrowLeft, Wind } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const CALORIES_PER_KM: Record<string,number> = { walk: 60, run: 80 };
const STEP_LENGTH_M = 0.75;

function haversine(lat1:number,lon1:number,lat2:number,lon2:number){
  const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function fmtTime(s:number){
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
  if(h>0)return`${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return`${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

type Phase='idle'|'active'|'paused';
interface Coord{lat:number;lng:number}

function RunTrackContent(){
  const router=useRouter();
  const params=useSearchParams();
  const mode=(params.get('mode')||'walk') as 'walk'|'run';

  const [phase,setPhase]=useState<Phase>('idle');
  const [elapsed,setElapsed]=useState(0);
  const [distance,setDistance]=useState(0);
  const [steps,setSteps]=useState(0);
  const [calories,setCalories]=useState(0);
  const [pace,setPace]=useState(0);
  const [cadence,setCadence]=useState(0);
  const [route,setRoute]=useState<Coord[]>([]);
  const [offlineMode,setOfflineMode]=useState(false);
  const [aiGoal,setAiGoal]=useState<{kcal:number;km:number}|null>(null);

  const timerRef=useRef<NodeJS.Timeout|null>(null);
  const watchRef=useRef<number|null>(null);
  const lastPosRef=useRef<GeolocationPosition|null>(null);
  const startTimeRef=useRef<number>(0);
  const pauseAccRef=useRef<number>(0);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const accelBufRef=useRef<number[]>([]);
  const cleanupAccelRef=useRef<(()=>void)|null>(null);

  // Load AI goal
  useEffect(()=>{
    const scans=JSON.parse(localStorage.getItem('fitjourney_scan_history')||'[]');
    const profile=JSON.parse(localStorage.getItem('fitjourney_profile')||'{}');
    if(scans.length>0){
      const bf=scans[0].bf||20;
      const gap=bf-parseFloat(profile.goalBf||'15');
      let kcal=150;
      if(gap>10)kcal=600;else if(gap>5)kcal=450;else if(gap>2)kcal=300;
      setAiGoal({kcal,km:parseFloat((kcal/60).toFixed(1))});
    }
  },[]);

  // Derived stats
  useEffect(()=>{
    setCalories(Math.round(distance*(CALORIES_PER_KM[mode]||60)));
    if(elapsed>10&&distance>0)setPace(parseFloat(((elapsed/60)/distance).toFixed(2)));
    if(elapsed>0)setCadence(Math.round((steps/elapsed)*60));
  },[distance,elapsed,steps,mode]);

  // Timer
  useEffect(()=>{
    if(phase==='active'){
      timerRef.current=setInterval(()=>{
        setElapsed(Math.floor((Date.now()-startTimeRef.current)/1000)+pauseAccRef.current);
      },1000);
    }else if(timerRef.current){clearInterval(timerRef.current);}
    return()=>{if(timerRef.current)clearInterval(timerRef.current);};
  },[phase]);

  // Route canvas
  useEffect(()=>{
    if(route.length<2||!canvasRef.current)return;
    const canvas=canvasRef.current,ctx=canvas.getContext('2d');
    if(!ctx)return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const lats=route.map(c=>c.lat),lngs=route.map(c=>c.lng);
    const minLat=Math.min(...lats),maxLat=Math.max(...lats);
    const minLng=Math.min(...lngs),maxLng=Math.max(...lngs);
    const pad=24,W=canvas.width-2*pad,H=canvas.height-2*pad;
    const toX=(lng:number)=>maxLng===minLng?canvas.width/2:pad+((lng-minLng)/(maxLng-minLng))*W;
    const toY=(lat:number)=>maxLat===minLat?canvas.height/2:pad+((maxLat-lat)/(maxLat-minLat))*H;

    // Route line
    const grad=ctx.createLinearGradient(toX(route[0].lng),toY(route[0].lat),toX(route[route.length-1].lng),toY(route[route.length-1].lat));
    grad.addColorStop(0,'#3b82f6');grad.addColorStop(1,'#22c55e');
    ctx.strokeStyle=grad;ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.shadowColor='#22c55e';ctx.shadowBlur=6;
    ctx.beginPath();
    route.forEach((c,i)=>{const x=toX(c.lng),y=toY(c.lat);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
    ctx.stroke();

    // Dots
    const drawDot=(c:Coord,color:string)=>{
      ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=12;
      ctx.beginPath();ctx.arc(toX(c.lng),toY(c.lat),5,0,Math.PI*2);ctx.fill();
    };
    drawDot(route[0],'#3b82f6');drawDot(route[route.length-1],'#ef4444');
  },[route]);

  // GPS
  const startGps=useCallback(()=>{
    watchRef.current=navigator.geolocation.watchPosition(pos=>{
      if(lastPosRef.current){
        const inc=haversine(lastPosRef.current.coords.latitude,lastPosRef.current.coords.longitude,pos.coords.latitude,pos.coords.longitude);
        if(inc>0.003){
          setDistance(d=>d+inc);
          setSteps(s=>s+Math.round((inc*1000)/STEP_LENGTH_M));
          setRoute(r=>[...r.slice(-300),{lat:pos.coords.latitude,lng:pos.coords.longitude}]);
        }
      }
      lastPosRef.current=pos;
    },()=>setOfflineMode(true),{enableHighAccuracy:true,maximumAge:1000});
  },[]);

  // Accelerometer
  const startAccel=useCallback(()=>{
    const handler=(e:DeviceMotionEvent)=>{
      const acc=e.accelerationIncludingGravity;
      if(!acc)return;
      const mag=Math.sqrt((acc.x||0)**2+(acc.y||0)**2+(acc.z||0)**2);
      accelBufRef.current.push(mag);
      if(accelBufRef.current.length>5){
        const buf=accelBufRef.current.slice(-5);
        const peak=buf[2];
        if(peak>buf[1]&&peak>buf[3]&&peak>12){
          setSteps(s=>s+1);
          setDistance(d=>d+STEP_LENGTH_M/1000);
        }
        accelBufRef.current.shift();
      }
    };
    window.addEventListener('devicemotion',handler);
    return()=>window.removeEventListener('devicemotion',handler);
  },[]);

  const handleStart=()=>{
    startTimeRef.current=Date.now();
    setPhase('active');
    if('geolocation' in navigator){
      navigator.geolocation.getCurrentPosition(()=>startGps(),()=>{setOfflineMode(true);cleanupAccelRef.current=startAccel();});
    } else {
      setOfflineMode(true);cleanupAccelRef.current=startAccel();
    }
  };

  const handlePause=()=>{pauseAccRef.current=elapsed;setPhase('paused');if(watchRef.current!==null)navigator.geolocation.clearWatch(watchRef.current);};
  const handleResume=()=>{startTimeRef.current=Date.now();setPhase('active');if(!offlineMode)startGps();else cleanupAccelRef.current=startAccel();};

  const handleStop=()=>{
    setPhase('idle');
    if(watchRef.current!==null)navigator.geolocation.clearWatch(watchRef.current);
    if(cleanupAccelRef.current)cleanupAccelRef.current();
    if(elapsed>10){
      const sessions=JSON.parse(localStorage.getItem('fitjourney_run_sessions')||'[]');
      sessions.unshift({mode,elapsed,distance:parseFloat(distance.toFixed(2)),steps,calories,pace,date:new Date().toISOString()});
      localStorage.setItem('fitjourney_run_sessions',JSON.stringify(sessions.slice(0,30)));
    }
    router.back();
  };

  const prog=aiGoal?Math.min(100,(calories/aiGoal.kcal)*100):0;
  const isRun=mode==='run';
  const accentColor=isRun?'#3b82f6':'#22c55e';
  const accentBg=isRun?'#0d1a30':'#0f1f0f';

  return(
    <div style={{minHeight:'100vh',background:'#0a0a0f',color:'#fff',fontFamily:'system-ui,sans-serif',paddingBottom:'30px'}}>

      {/* ── Top Bar ── */}
      <div style={{padding:'20px 20px 0',display:'flex',alignItems:'center',gap:'12px'}}>
        <button onClick={()=>router.back()} style={{width:'40px',height:'40px',borderRadius:'12px',background:'#1a1a2e',border:'1px solid #2a2a4a',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff'}}>
          <ArrowLeft size={18}/>
        </button>
        <div>
          <p style={{margin:0,fontSize:'11px',color:accentColor,fontWeight:700,letterSpacing:'0.15em',textTransform:'uppercase'}}>{isRun?'Running':'Walking'} Mode</p>
          <h1 style={{margin:0,fontSize:'22px',fontWeight:900}}>{isRun?'🏃 Run Track':'🚶 Walk Track'}</h1>
        </div>
        <div style={{marginLeft:'auto',padding:'6px 12px',borderRadius:'999px',background:offlineMode?'#3b1a00':'#0f1f0f',border:`1px solid ${offlineMode?'#f9731644':accentColor+'44'}`,fontSize:'10px',fontWeight:700,color:offlineMode?'#f97316':accentColor}}>
          {offlineMode?'📡 Offline':'🛰 GPS'}
        </div>
      </div>

      {/* ── AI Goal Progress ── */}
      {aiGoal&&(
        <div style={{margin:'16px 16px 0',borderRadius:'16px',background:accentBg,border:`1px solid ${accentColor}33`,padding:'14px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
            <span style={{fontSize:'11px',color:accentColor,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em'}}>Daily Goal</span>
            <span style={{fontSize:'12px',color:'#9ca3af'}}>{Math.round(prog)}% · {calories} / {aiGoal.kcal} kcal</span>
          </div>
          <div style={{height:'6px',background:'#1e1e30',borderRadius:'999px',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${prog}%`,background:`linear-gradient(90deg,${accentColor},${isRun?'#a78bfa':'#3b82f6'})`,borderRadius:'999px',transition:'width 0.5s'}}/>
          </div>
        </div>
      )}

      {/* ── Main Stats ── */}
      <div style={{margin:'16px 16px 0',borderRadius:'24px',background:'#111118',border:'1px solid #1e1e30',padding:'24px',position:'relative',overflow:'hidden'}}>
        {phase==='active'&&<div style={{position:'absolute',top:'-80px',left:'50%',transform:'translateX(-50%)',width:'240px',height:'160px',background:`radial-gradient(ellipse,${accentColor}1a,transparent)`,pointerEvents:'none'}}/>}

        {/* Large stats */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px',marginBottom:'16px'}}>
          {[
            {icon:<MapPin size={15} color='#3b82f6'/>,label:'KM',val:distance.toFixed(2),color:'#3b82f6'},
            {icon:<Clock size={15} color='#a78bfa'/>,label:'TIME',val:fmtTime(elapsed),color:'#a78bfa'},
            {icon:<Flame size={15} color='#ef4444'/>,label:'KCAL',val:calories.toString(),color:'#ef4444'},
          ].map(s=>(
            <div key={s.label} style={{textAlign:'center',padding:'16px 8px',background:'#1a1a2e',borderRadius:'16px',border:'1px solid #2a2a4a'}}>
              <div style={{display:'flex',justifyContent:'center',marginBottom:'8px'}}>{s.icon}</div>
              <p style={{margin:'0 0 2px',fontSize:'9px',color:'#6b7280',letterSpacing:'0.1em'}}>{s.label}</p>
              <p style={{margin:0,fontSize:'22px',fontWeight:900,color:s.color}}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Secondary stats */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',marginBottom:'24px'}}>
          {[
            {icon:<Footprints size={13} color={accentColor}/>,label:'STEPS',val:steps.toLocaleString(),color:accentColor},
            {icon:<TrendingUp size={13} color='#f59e0b'/>,label:"PACE '/km",val:pace>0?`${pace}`:'--',color:'#f59e0b'},
            {icon:<Activity size={13} color='#ec4899'/>,label:'CADENCE /m',val:cadence>0?`${cadence}`:'--',color:'#ec4899'},
          ].map(s=>(
            <div key={s.label} style={{textAlign:'center',padding:'12px 6px',background:'#0f0f1a',borderRadius:'12px'}}>
              <div style={{display:'flex',justifyContent:'center',marginBottom:'6px'}}>{s.icon}</div>
              <p style={{margin:'0 0 2px',fontSize:'8px',color:'#6b7280',letterSpacing:'0.08em'}}>{s.label}</p>
              <p style={{margin:0,fontSize:'15px',fontWeight:800,color:s.color}}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:'20px'}}>
          {phase==='idle'&&(
            <button onClick={handleStart} style={{width:'76px',height:'76px',borderRadius:'50%',background:`linear-gradient(135deg,${accentColor},${isRun?'#1d4ed8':'#16a34a'})`,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 0 32px ${accentColor}66`,transition:'transform 0.15s'}} onMouseDown={e=>e.currentTarget.style.transform='scale(0.93)'} onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>
              <Play size={30} color='#fff' fill='#fff' style={{marginLeft:'3px'}}/>
            </button>
          )}
          {phase==='active'&&(<>
            <button onClick={handlePause} style={{width:'76px',height:'76px',borderRadius:'50%',background:'linear-gradient(135deg,#f59e0b,#d97706)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 32px #f59e0b55'}}>
              <Pause size={30} color='#fff' fill='#fff'/>
            </button>
            <button onClick={handleStop} style={{width:'56px',height:'56px',borderRadius:'50%',background:'#1a1a2e',border:'1px solid #ef444433',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Square size={22} color='#ef4444' fill='#ef4444'/>
            </button>
          </>)}
          {phase==='paused'&&(<>
            <button onClick={handleResume} style={{width:'76px',height:'76px',borderRadius:'50%',background:`linear-gradient(135deg,${accentColor},${isRun?'#1d4ed8':'#16a34a'})`,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 0 32px ${accentColor}66`}}>
              <Play size={30} color='#fff' fill='#fff' style={{marginLeft:'3px'}}/>
            </button>
            <button onClick={handleStop} style={{width:'56px',height:'56px',borderRadius:'50%',background:'#1a1a2e',border:'1px solid #ef444433',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Square size={22} color='#ef4444' fill='#ef4444'/>
            </button>
          </>)}
        </div>
      </div>

      {/* ── Live Route Map ── */}
      {route.length>1&&(
        <div style={{margin:'16px 16px 0',borderRadius:'20px',overflow:'hidden',border:'1px solid #1e1e30',background:'#0d0d1a'}}>
          <div style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:'8px',borderBottom:'1px solid #1e1e30'}}>
            <MapPin size={13} color={accentColor}/>
            <span style={{fontSize:'11px',fontWeight:700,color:accentColor,textTransform:'uppercase',letterSpacing:'0.1em'}}>Live Route</span>
            <span style={{marginLeft:'auto',fontSize:'10px',color:'#6b7280'}}>{route.length} GPS pts</span>
          </div>
          <canvas ref={canvasRef} width={400} height={220} style={{width:'100%',display:'block'}}/>
          <div style={{padding:'8px 16px',display:'flex',justifyContent:'space-between'}}>
            <span style={{fontSize:'10px',color:'#3b82f6'}}>● Start</span>
            <span style={{fontSize:'10px',color:'#ef4444'}}>● Now</span>
          </div>
        </div>
      )}

      {/* ── Speed Guide ── */}
      <div style={{margin:'16px 16px 0',borderRadius:'16px',background:'#111118',border:'1px solid #1e1e30',padding:'16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
          <Wind size={14} color={accentColor}/>
          <span style={{fontSize:'12px',fontWeight:700,color:'#fff'}}>{isRun?'Running Zones':'Walking Tips'}</span>
        </div>
        {isRun?(
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {[
              {zone:'Recovery',pace:'7:00+/km',color:'#22c55e',desc:'Conversational, breathe easy'},
              {zone:'Base',pace:'6:00-7:00/km',color:'#3b82f6',desc:'Sustainable long run pace'},
              {zone:'Tempo',pace:'5:00-6:00/km',color:'#f59e0b',desc:'Comfortably hard effort'},
              {zone:'Speed',pace:'<5:00/km',color:'#ef4444',desc:'Race pace, max effort'},
            ].map(z=>(
              <div key={z.zone} style={{display:'flex',alignItems:'center',gap:'12px'}}>
                <div style={{width:'8px',height:'8px',borderRadius:'50%',background:z.color,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <span style={{fontSize:'12px',fontWeight:700,color:z.color}}>{z.zone}</span>
                  <span style={{fontSize:'11px',color:'#6b7280',marginLeft:'8px'}}>{z.desc}</span>
                </div>
                <span style={{fontSize:'11px',fontWeight:700,color:'#9ca3af'}}>{z.pace}</span>
              </div>
            ))}
          </div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {[
              {tip:'Warm up',desc:'5 min slow walk before starting',color:'#22c55e'},
              {tip:'Posture',desc:'Keep back straight, swing arms naturally',color:'#3b82f6'},
              {tip:'Breathing',desc:'Breathe in for 3 steps, out for 3',color:'#a78bfa'},
              {tip:'Cool down',desc:'Last 5 min reduce pace gradually',color:'#f59e0b'},
            ].map(t=>(
              <div key={t.tip} style={{display:'flex',alignItems:'flex-start',gap:'10px'}}>
                <div style={{width:'6px',height:'6px',borderRadius:'50%',background:t.color,flexShrink:0,marginTop:'5px'}}/>
                <div>
                  <span style={{fontSize:'12px',fontWeight:700,color:t.color}}>{t.tip}: </span>
                  <span style={{fontSize:'11px',color:'#6b7280'}}>{t.desc}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RunTrackPage(){
  return(
    <Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#0a0a0f'}}><Loader2 className="h-10 w-10 animate-spin" color='#22c55e'/></div>}>
      <RunTrackContent/>
    </Suspense>
  );
}
