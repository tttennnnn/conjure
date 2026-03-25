"use client";

import { useCallback, useEffect, useRef } from "react";

/* ── Aurora blobs ─────────────────────────────────────────────── */

interface BlobConfig {
  baseX: number;
  baseY: number;
  size: number;
  color: string;
  speed: number;
  radius: number;
  phaseX: number;
  phaseY: number;
  attract: number;
}

const BLOBS: BlobConfig[] = [
  {
    baseX: 0.2, baseY: 0.75,
    size: 420, color: "rgba(100, 60, 200, 0.3)",
    speed: 0.25, radius: 0.06,
    phaseX: 0, phaseY: 1.2, attract: 1,
  },
  {
    baseX: 0.75, baseY: 0.2,
    size: 360, color: "rgba(30, 100, 180, 0.28)",
    speed: 0.3, radius: 0.07,
    phaseX: 2, phaseY: 0.5, attract: 1.4,
  },
  {
    baseX: 0.5, baseY: 0.5,
    size: 300, color: "rgba(20, 150, 170, 0.22)",
    speed: 0.2, radius: 0.05,
    phaseX: 4, phaseY: 3, attract: 0.8,
  },
  {
    baseX: 0.65, baseY: 0.8,
    size: 260, color: "rgba(160, 50, 140, 0.18)",
    speed: 0.35, radius: 0.08,
    phaseX: 1, phaseY: 4.5, attract: 1.6,
  },
];

/* ── Particles + infrastructure nodes ─────────────────────────── */

interface Particle {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  phase: number;
  speed: number;
  size: number;
  opacity: number;
  isNode: boolean;
  pulsePhase: number;
}

const GRID_SPACING = 70;
const JITTER = 0.4;
const CONNECT_DIST = 100;
const NODE_CONNECT_DIST = 180;
const MOUSE_RADIUS = 150;
const PUSH_STRENGTH = 60;
const LINE_MAX_OPACITY = 0.08;
const NODE_LINE_MAX_OPACITY = 0.18;
const LINE_WIDTH = 0.5;
const NODE_LINE_WIDTH = 0.8;

// Infrastructure node positions (fraction of container)
// Loosely suggests: user -> LB -> servers -> DB/cache
const NODE_POSITIONS = [
  { x: 0.15, y: 0.12 },
  { x: 0.40, y: 0.18 },
  { x: 0.70, y: 0.10 },
  { x: 0.25, y: 0.42 },
  { x: 0.55, y: 0.38 },
  { x: 0.80, y: 0.45 },
  { x: 0.18, y: 0.70 },
  { x: 0.50, y: 0.68 },
  { x: 0.75, y: 0.75 },
  { x: 0.38, y: 0.90 },
];

function initParticles(w: number, h: number): Particle[] {
  const particles: Particle[] = [];
  const cols = Math.ceil(w / GRID_SPACING) + 1;
  const rows = Math.ceil(h / GRID_SPACING) + 1;

  // Regular particles
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const jx = (Math.random() - 0.5) * GRID_SPACING * JITTER;
      const jy = (Math.random() - 0.5) * GRID_SPACING * JITTER;
      particles.push({
        baseX: c * GRID_SPACING + jx,
        baseY: r * GRID_SPACING + jy,
        x: 0, y: 0,
        phase: Math.random() * Math.PI * 2,
        speed: 0.15 + Math.random() * 0.25,
        size: 0.8 + Math.random() * 0.8,
        opacity: 0.15 + Math.random() * 0.2,
        isNode: false,
        pulsePhase: 0,
      });
    }
  }

  // Infrastructure nodes
  for (const pos of NODE_POSITIONS) {
    particles.push({
      baseX: pos.x * w,
      baseY: pos.y * h,
      x: 0, y: 0,
      phase: Math.random() * Math.PI * 2,
      speed: 0.1 + Math.random() * 0.15,
      size: 2.5 + Math.random() * 1,
      opacity: 0.4 + Math.random() * 0.15,
      isNode: true,
      pulsePhase: Math.random() * Math.PI * 2,
    });
  }

  return particles;
}

/* ── Component ────────────────────────────────────────────────── */

export default function AuthBrandingPanel({
  children,
}: {
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blobRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mouse = useRef({ x: 0.5, y: 0.5, active: false });
  const smooth = useRef({ x: 0.5, y: 0.5 });
  const smoothAttract = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const t0 = useRef(Date.now());
  const mousePx = useRef({ x: -9999, y: -9999 });
  const smoothMousePx = useRef({ x: -9999, y: -9999 });

  const setupCanvas = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    particlesRef.current = initParticles(rect.width, rect.height);
  }, []);

  const tick = useCallback(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) { rafRef.current = requestAnimationFrame(tick); return; }
    const rect = el.getBoundingClientRect();
    if (!rect.width) { rafRef.current = requestAnimationFrame(tick); return; }

    const t = (Date.now() - t0.current) / 1000;
    const { active } = mouse.current;

    // ── Smooth attraction ramp (fast up, gentle down) ──
    const attractTarget = active ? 1 : 0;
    const attractLerp = active ? 0.08 : 0.03;
    smoothAttract.current += (attractTarget - smoothAttract.current) * attractLerp;

    // ── Smooth mouse (tracks last known position, never snaps to center) ──
    const blobLerp = active ? 0.06 : 0.03;
    smooth.current.x += (mouse.current.x - smooth.current.x) * blobLerp;
    smooth.current.y += (mouse.current.y - smooth.current.y) * blobLerp;

    const mx = smooth.current.x - 0.5;
    const my = smooth.current.y - 0.5;

    // ── Smooth mouse pixels (same -- freezes at last position on leave) ──
    const pxLerp = active ? 0.07 : 0.03;
    smoothMousePx.current.x += (mousePx.current.x - smoothMousePx.current.x) * pxLerp;
    smoothMousePx.current.y += (mousePx.current.y - smoothMousePx.current.y) * pxLerp;

    // ── Update aurora blobs ──
    for (let i = 0; i < BLOBS.length; i++) {
      const b = BLOBS[i]!;
      const ref = blobRefs.current[i];
      if (!ref) continue;

      const dx = Math.sin(t * b.speed + b.phaseX) * b.radius;
      const dy = Math.cos(t * b.speed * 0.8 + b.phaseY) * b.radius;

      const pull = 0.22 * smoothAttract.current;
      const ax = mx * pull * b.attract;
      const ay = my * pull * b.attract;

      const px = (b.baseX + dx + ax) * rect.width - b.size / 2;
      const py = (b.baseY + dy + ay) * rect.height - b.size / 2;

      ref.style.transform = `translate3d(${px}px,${py}px,0)`;
    }

    // ── Draw particles on canvas ──
    const ctx = canvas.getContext("2d");
    if (!ctx) { rafRef.current = requestAnimationFrame(tick); return; }
    ctx.clearRect(0, 0, rect.width, rect.height);

    const particles = particlesRef.current;
    const smx = smoothMousePx.current.x;
    const smy = smoothMousePx.current.y;
    const distortAmount = smoothAttract.current;

    // Update positions
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]!;

      const driftX = Math.sin(t * p.speed + p.phase) * 3;
      const driftY = Math.cos(t * p.speed * 0.9 + p.phase + 1.5) * 3;

      let fx = p.baseX + driftX;
      let fy = p.baseY + driftY;

      // Mouse distortion
      const ddx = fx - smx;
      const ddy = fy - smy;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist < MOUSE_RADIUS && dist > 0.1) {
        const falloff = 1 - dist / MOUSE_RADIUS;
        const strength = falloff * falloff * PUSH_STRENGTH * distortAmount;
        fx += (ddx / dist) * strength;
        fy += (ddy / dist) * strength;
      }

      p.x = fx;
      p.y = fy;
    }

    // ── Draw node-to-node connections (brighter, thicker) ──
    ctx.lineWidth = NODE_LINE_WIDTH;
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i]!;
      if (!a.isNode) continue;
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j]!;
        if (!b.isNode) continue;
        const ddx = a.x - b.x;
        const ddy = a.y - b.y;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dist < NODE_CONNECT_DIST) {
          const alpha = (1 - dist / NODE_CONNECT_DIST) * NODE_LINE_MAX_OPACITY;
          ctx.strokeStyle = `rgba(180,200,255,${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // ── Draw regular connections ──
    ctx.lineWidth = LINE_WIDTH;
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i]!;
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j]!;
        if (a.isNode && b.isNode) continue; // already drawn above
        const ddx = a.x - b.x;
        const ddy = a.y - b.y;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dist < CONNECT_DIST) {
          const alpha = (1 - dist / CONNECT_DIST) * LINE_MAX_OPACITY;
          ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // ── Draw particles ──
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]!;

      if (p.isNode) {
        // Pulse animation
        const pulse = 0.85 + Math.sin(t * 1.5 + p.pulsePhase) * 0.15;

        // Outer glow ring
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,200,255,${0.04 * pulse})`;
        ctx.fill();

        // Mid ring (stroke, not fill)
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(180,200,255,${0.15 * pulse})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Bright core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,215,255,${p.opacity * pulse})`;
        ctx.fill();
      } else {
        // Soft glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.opacity * 0.12})`;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.opacity})`;
        ctx.fill();
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    setupCanvas();
    rafRef.current = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => setupCanvas());
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [tick, setupCanvas]);

  const onMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rx = e.clientX - rect.left;
    const ry = e.clientY - rect.top;
    mouse.current.x = rx / rect.width;
    mouse.current.y = ry / rect.height;
    mouse.current.active = true;
    mousePx.current.x = rx;
    mousePx.current.y = ry;
  }, []);

  const onLeave = useCallback(() => {
    mouse.current.active = false;
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="relative hidden flex-1 flex-col items-center justify-center overflow-hidden bg-[var(--text)] px-12 py-12 text-white lg:flex"
    >
      {/* Aurora blobs */}
      {BLOBS.map((b, i) => (
        <div
          key={i}
          ref={(el) => { blobRefs.current[i] = el; }}
          className="pointer-events-none absolute left-0 top-0 rounded-full"
          style={{
            width: b.size,
            height: b.size,
            background: `radial-gradient(circle, ${b.color} 0%, transparent 70%)`,
            filter: "blur(80px)",
            willChange: "transform",
          }}
        />
      ))}

      {/* Particle constellation canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0"
      />

      {/* Content */}
      <div className="relative w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
