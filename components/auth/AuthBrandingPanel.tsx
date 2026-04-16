"use client";

import AuroraBlobs, { type BlobConfig } from "@/components/ui/AuroraBlobs";

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

export default function AuthBrandingPanel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative hidden flex-1 flex-col items-center justify-center overflow-hidden bg-[var(--text)] px-12 py-12 text-white lg:flex">
      <AuroraBlobs blobs={BLOBS} interactive />

      {/* Content */}
      <div className="relative w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
