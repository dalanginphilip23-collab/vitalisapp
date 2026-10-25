// utils/activityShare.js — Vitalis share cards + native sharing.
// Renders a 1080x1350 portrait card (route + stats + Vitalis brand) on a
// <canvas> with zero external assets (no CORS taint), then shares via the
// Web Share API (native sheet on mobile) with download fallback on desktop.

export const SHARE_W = 1080;
export const SHARE_H = 1350;
const ACCENT_GREEN = '#43C85F';
const FONT = `'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`;

// Vitalis auto-titles activities by time of day — same touch here.
export const activityTitle = (created_at) => {
  const d = created_at ? new Date(created_at) : null;
  if (!d || Number.isNaN(d.getTime())) return 'Run';
  const h = d.getHours();
  const part = h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
  return `${part} Run`;
};

// 2312s -> "38m 22s", 3900s -> "1h 5m", 45s -> "45s"
export const formatShareDuration = (seconds) => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

export const formatShareDate = (created_at) => {
  const d = created_at ? new Date(created_at) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

// Accepts the stored JSON route ([lat,lng] pairs) in string or array form.
export const parseRoutePoints = (route) => {
  try {
    const raw = typeof route === 'string' ? JSON.parse(route) : route;
    if (!Array.isArray(raw)) return [];
    const pts = [];
    for (const p of raw) {
      if (Array.isArray(p)) {
        const lat = Number(p[0]);
        const lng = Number(p[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) pts.push([lat, lng]);
      } else if (p && typeof p === 'object') {
        const lat = Number(p.lat ?? p.latitude);
        const lng = Number(p.lng ?? p.lon ?? p.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) pts.push([lat, lng]);
      }
    }
    return pts;
  } catch {
    return [];
  }
};

// Deterministic pseudo-random (mulberry32) for the decorative street grid.
const rand = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const drawStreetGrid = (ctx, seed = 7) => {
  const r = rand(seed);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  for (let x = 40; x < SHARE_W; x += 92) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (r() - 0.5) * 60, SHARE_H);
    ctx.stroke();
  }
  for (let y = 40; y < SHARE_H; y += 92) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SHARE_W, y + (r() - 0.5) * 60);
    ctx.stroke();
  }
  // A few "main roads"
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i += 1) {
    const x0 = r() * SHARE_W;
    ctx.beginPath();
    ctx.moveTo(x0, -20);
    ctx.quadraticCurveTo(x0 + (r() - 0.5) * 500, SHARE_H / 2, x0 + (r() - 0.5) * 700, SHARE_H + 20);
    ctx.stroke();
  }
  ctx.restore();
};

// Input: { title, dateStr, distanceKm, durationSec, pace, route }.
// pace is the stored "/km" string (e.g. "5:55"), route the stored GPS track.
export const renderShareCanvas = ({ title, dateStr, distanceKm, durationSec, pace, route }) => {
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext('2d');

  // Dark map backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, SHARE_H);
  bg.addColorStop(0, '#333336');
  bg.addColorStop(0.55, '#1c1c1f');
  bg.addColorStop(1, '#0e0e10');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  drawStreetGrid(ctx);

  // Route (fitted into the upper area)
  const pts = parseRoutePoints(route);
  if (pts.length >= 2) {
    const step = Math.max(1, Math.ceil(pts.length / 200));
    const sampled = pts.filter((_, i) => i % step === 0);
    if (sampled[sampled.length - 1] !== pts[pts.length - 1]) sampled.push(pts[pts.length - 1]);
    const lats = sampled.map((p) => p[0]);
    const lngs = sampled.map((p) => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const spanLat = (maxLat - minLat) || 1e-6;
    const spanLng = (maxLng - minLng) || 1e-6;
    const RX = 90;
    const RY = 120;
    const RW = SHARE_W - RX * 2;
    const RH = 700;
    const scale = Math.min(RW / spanLng, RH / spanLat);
    const ox = RX + (RW - spanLng * scale) / 2;
    const oy = RY + (RH - spanLat * scale) / 2;
    const x = (lng) => ox + (lng - minLng) * scale;
    const y = (lat) => oy + (1 - (lat - minLat) / spanLat) * spanLat * scale;

    ctx.save();
    ctx.shadowColor = 'rgba(67,200,95,0.8)';
    ctx.shadowBlur = 34;
    ctx.strokeStyle = ACCENT_GREEN;
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    sampled.forEach(([lat, lng], i) => {
      if (i === 0) ctx.moveTo(x(lng), y(lat));
      else ctx.lineTo(x(lng), y(lat));
    });
    ctx.stroke();
    ctx.restore();

    const dot = (lat, lng, color) => {
      ctx.beginPath();
      ctx.arc(x(lng), y(lat), 17, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    };
    dot(sampled[0][0], sampled[0][1], '#22c55e');
    const last = sampled[sampled.length - 1];
    dot(last[0], last[1], '#ef4444');
  }

  // Bottom scrim for legibility
  const scrim = ctx.createLinearGradient(0, 640, 0, SHARE_H);
  scrim.addColorStop(0, 'rgba(0,0,0,0)');
  scrim.addColorStop(0.45, 'rgba(0,0,0,0.88)');
  scrim.addColorStop(1, 'rgba(0,0,0,0.92)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 640, SHARE_W, SHARE_H - 640);

  // Content
  const L = 90;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.font = `400 84px ${FONT}`;
  ctx.fillText('👟', L, 920);

  ctx.font = `800 70px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title || 'Run', L, 1015);

  if (dateStr) {
    ctx.font = `400 28px ${FONT}`;
    ctx.fillStyle = '#9a9aa0';
    ctx.fillText(dateStr, L, 1062);
  }

  const label = (text, lx, ly) => {
    ctx.font = `400 28px ${FONT}`;
    ctx.fillStyle = '#9a9aa0';
    ctx.fillText(text, lx, ly);
  };
  const value = (text, vx, vy, size = 62) => {
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, vx, vy);
    return ctx.measureText(text).width;
  };
  const unit = (text, ux, uy) => {
    ctx.font = `400 30px ${FONT}`;
    ctx.fillStyle = '#9a9aa0';
    ctx.fillText(text, ux, uy);
  };

  label('Pace', L, 1125);
  const pw = value(pace || '–', L, 1195);
  unit('/km', L + pw + 10, 1195);

  label('Time', 560, 1125);
  value(formatShareDuration(durationSec), 560, 1195);

  label('Distance', L, 1245);
  const dw = value(Number(distanceKm || 0).toFixed(2), L, 1315, 58);
  unit('km', L + dw + 10, 1315);

  ctx.font = `800 40px ${FONT}`;
  ctx.fillStyle = ACCENT_GREEN;
  ctx.textAlign = 'right';
  ctx.fillText('VITALIS', SHARE_W - L, 1315);
  ctx.textAlign = 'left';

  return canvas;
};

const canvasToBlob = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Render failed'))), 'image/png');
  });

// Shares the card via the native sheet (any app: IG, FB, X, Messenger…).
// Returns 'shared' or 'downloaded' (desktop fallback). Throws on AbortError
// when the user dismisses the sheet — callers should swallow that one.
export const shareActivityImage = async (canvas, { filename = 'vitalis-run.png', title = 'My run', text = '' } = {}) => {
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], filename, { type: 'image/png' });
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title, text });
    return 'shared';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
};
