// src/lib/progress-tracker.ts
// Stores scan history in localStorage
// All data stays on device

import type { ScanResult } from './physiquenet';

const SCAN_HISTORY_KEY = 'fitjourney_scan_history';
const PROFILE_KEY      = 'fitjourney_profile';

export interface StoredScan extends ScanResult {
  date:  string;
  photo: string | null;  // base64 dataUrl optional
}

export interface FitProfile {
  name:     string;
  gender:   'male' | 'female';
  age:      number;
  heightCm: number;
  weightKg: number;
  goalBf:   number;   // target body fat %
}

// ── SCAN HISTORY ──────────────────────────────────────────────

export function saveScan(scan: ScanResult, photoDataUrl?: string): StoredScan {
  const history = loadAllScans();
  const entry: StoredScan = {
    ...scan,
    date:  new Date().toLocaleDateString('en-US',
             { month:'short', day:'numeric', year:'numeric' }),
    photo: photoDataUrl ?? null,
  };
  history.unshift(entry); // newest first
  // Keep last 365 days
  const trimmed = history.slice(0, 365);
  localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(trimmed));
  return entry;
}

export function loadAllScans(): StoredScan[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(SCAN_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function loadLatestScan(): StoredScan | null {
  const all = loadAllScans();
  return all.length > 0 ? all[0] : null;
}

export function loadRecentScans(days: number): StoredScan[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return loadAllScans().filter(s => s.timestamp > cutoff);
}

export function clearAllScans(): void {
  localStorage.removeItem(SCAN_HISTORY_KEY);
}

// ── PROFILE ───────────────────────────────────────────────────

export function saveProfile(profile: FitProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadProfile(): FitProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const d = localStorage.getItem(PROFILE_KEY);
    // Also try existing fitjourney profile format
    if (!d) {
      const existing = localStorage.getItem('fitjourney_profile_data');
      if (existing) {
        const p = JSON.parse(existing);
        return {
          name:     p.name     || 'User',
          gender:   p.gender   || 'male',
          age:      p.age      || 25,
          heightCm: parseFloat(p.heightCm) || 175,
          weightKg: parseFloat(p.weightKg) || 70,
          goalBf:   p.goalBf   || 18,
        };
      }
      return null;
    }
    return JSON.parse(d);
  } catch {
    return null;
  }
}

// ── ANALYTICS ─────────────────────────────────────────────────

export interface WeeklyStats {
  bfChange:    number;
  shapeChange: number;
  scanCount:   number;
  startBf:     number;
  currentBf:   number;
}

export function getWeeklyStats(): WeeklyStats | null {
  const scans = loadRecentScans(7);
  if (scans.length < 2) return null;
  const first = scans[scans.length - 1]; // oldest of the week
  const last  = scans[0];               // newest
  return {
    bfChange:    Math.round((last.bf    - first.bf)    * 10) / 10,
    shapeChange: Math.round((last.shape - first.shape) * 10) / 10,
    scanCount:   scans.length,
    startBf:     first.bf,
    currentBf:   last.bf,
  };
}

export function getGoalProgress(goalBf: number): number {
  const all   = loadAllScans();
  if (all.length === 0) return 0;
  const startBf   = all[all.length - 1].bf;  // first scan ever
  const currentBf = all[0].bf;               // latest scan
  const total     = startBf - goalBf;
  if (total <= 0) return 100;
  const done  = startBf - currentBf;
  return Math.min(100, Math.max(0, Math.round(done / total * 100)));
}

// ── PDF REPORT ────────────────────────────────────────────────

export function exportPDFReport(days = 30): void {
  const scans   = loadRecentScans(days);
  const profile = loadProfile();
  if (scans.length === 0) {
    alert('No scan data yet. Complete at least one scan first!');
    return;
  }

  const first   = scans[scans.length - 1];
  const last    = scans[0];
  const bfChg   = Math.round((last.bf - first.bf) * 10) / 10;
  const shChg   = Math.round((last.shape - first.shape));

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>FitJourney Body Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #1a1a1a; }
    h1   { color: #1a73e8; font-size: 28px; margin-bottom: 4px; }
    h2   { color: #333; border-bottom: 2px solid #eee; padding-bottom: 8px; margin-top: 32px; }
    .sub { color: #666; font-size: 14px; margin-bottom: 32px; }
    .grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin: 16px 0; }
    .card { background: #f8f9ff; border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #e0e8ff; }
    .val  { font-size: 32px; font-weight: 700; color: #1a73e8; }
    .lbl  { font-size: 12px; color: #666; margin-top: 4px; }
    .good { color: #00aa44; }
    .bad  { color: #cc0000; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
    th,td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; }
    th    { background: #f0f4ff; font-weight: 600; color: #333; }
    tr:hover { background: #fafbff; }
    .footer { margin-top: 48px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 16px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 600; }
    .badge-blue { background: #e8f0fe; color: #1a73e8; }
    .note { background: #fff8e1; border-left: 4px solid #ffa000; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 13px; margin: 16px 0; }
  </style>
</head>
<body>
  <h1>🏋️ FitJourney Body Report</h1>
  <p class="sub">
    ${profile?.name ? `${profile.name} · ` : ''}
    ${first.date} → ${last.date} ·
    ${scans.length} scans in ${days} days
  </p>

  <h2>Current Status</h2>
  <div class="grid">
    <div class="card">
      <div class="val">${last.bf}%</div>
      <div class="lbl">Body Fat</div>
      <div class="badge badge-blue" style="margin-top:8px">${last.category}</div>
    </div>
    <div class="card">
      <div class="val ${bfChg < 0 ? 'good' : bfChg > 0 ? 'bad' : ''}">
        ${bfChg > 0 ? '+' : ''}${bfChg}%
      </div>
      <div class="lbl">BF% Change (${days} days)</div>
    </div>
    <div class="card">
      <div class="val">${last.shape}/100</div>
      <div class="lbl">Shape Score</div>
    </div>
    <div class="card">
      <div class="val">${last.fatMass}kg</div>
      <div class="lbl">Fat Mass</div>
    </div>
    <div class="card">
      <div class="val">${last.leanMass}kg</div>
      <div class="lbl">Lean Mass</div>
    </div>
    <div class="card">
      <div class="val">${last.conf >= 0.6 ? 'High' : last.conf >= 0.35 ? 'Med' : 'Low'}</div>
      <div class="lbl">Scan Confidence</div>
    </div>
  </div>

  ${profile?.goalBf ? `
  <h2>Goal Progress</h2>
  <p>Target: <strong>${profile.goalBf}% body fat</strong> · 
     Gap remaining: <strong>${Math.max(0, last.bf - profile.goalBf).toFixed(1)}%</strong>
  </p>
  ` : ''}

  <h2>Scan History</h2>
  <table>
    <tr>
      <th>Date</th>
      <th>Body Fat %</th>
      <th>Shape</th>
      <th>Fat (kg)</th>
      <th>Lean (kg)</th>
      <th>Confidence</th>
    </tr>
    ${scans.slice().reverse().map(s => `
    <tr>
      <td>${s.date}</td>
      <td>${s.bf}%</td>
      <td>${s.shape}/100</td>
      <td>${s.fatMass}kg</td>
      <td>${s.leanMass}kg</td>
      <td>${Math.round(s.conf * 100)}%</td>
    </tr>`).join('')}
  </table>

  <h2>Body Fat Reference</h2>
  <table>
    <tr><th>Category</th><th>Male</th><th>Female</th></tr>
    <tr><td>Essential Fat</td><td>2–5%</td><td>10–13%</td></tr>
    <tr><td>Athlete</td><td>6–13%</td><td>14–20%</td></tr>
    <tr><td>Fitness</td><td>14–17%</td><td>21–24%</td></tr>
    <tr><td>Average</td><td>18–24%</td><td>25–31%</td></tr>
    <tr><td>Above Average</td><td>25%+</td><td>32%+</td></tr>
  </table>

  <div class="note">
    ⚠️ This is not a medical device. Results are for fitness tracking only.
    For clinical body composition assessment, consult a healthcare professional.
  </div>

  <div class="footer">
    Generated by FitJourney · Your data stays on your device · 
    ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 800);
  }
}
