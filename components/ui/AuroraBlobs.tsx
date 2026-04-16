"use client";

import { useEffect, useRef } from "react";

export interface BlobConfig {
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

export default function AuroraBlobs({
  blobs,
  interactive = false,
}: {
  blobs: BlobConfig[];
  interactive?: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const blobRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mouse = useRef({ x: 0.5, y: 0.5, active: false });
  const smooth = useRef({ x: 0.5, y: 0.5 });
  const smoothAttract = useRef(0);
  const rafRef = useRef<number>(0);
  const t0 = useRef(Date.now());

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouse.current.x = (e.clientX - rect.left) / rect.width;
      mouse.current.y = (e.clientY - rect.top) / rect.height;
      mouse.current.active = true;
    }

    function onMouseLeave() {
      mouse.current.active = false;
    }

    if (interactive) {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseleave", onMouseLeave);
    }

    function tick() {
      const wrapper = wrapperRef.current;
      if (!wrapper) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const rect = wrapper.getBoundingClientRect();
      if (!rect.width) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const t = (Date.now() - t0.current) / 1000;
      const { active } = mouse.current;

      const attractTarget = active ? 1 : 0;
      const attractLerp = active ? 0.08 : 0.03;
      smoothAttract.current += (attractTarget - smoothAttract.current) * attractLerp;

      const blobLerp = active ? 0.06 : 0.03;
      smooth.current.x += (mouse.current.x - smooth.current.x) * blobLerp;
      smooth.current.y += (mouse.current.y - smooth.current.y) * blobLerp;

      const mx = smooth.current.x - 0.5;
      const my = smooth.current.y - 0.5;

      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i]!;
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

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (interactive) {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseleave", onMouseLeave);
      }
    };
  }, [blobs, interactive]);

  return (
    <div ref={wrapperRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {blobs.map((b, i) => (
        <div
          key={i}
          ref={(el) => { blobRefs.current[i] = el; }}
          className="absolute left-0 top-0 rounded-full"
          style={{
            width: b.size,
            height: b.size,
            background: `radial-gradient(circle, ${b.color} 0%, transparent 70%)`,
            filter: "blur(80px)",
            willChange: "transform",
          }}
        />
      ))}
    </div>
  );
}
