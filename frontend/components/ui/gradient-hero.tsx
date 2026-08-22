import { cn } from "@/lib/cn";

type HeroSize = "full" | "reduced";

interface Blob {
  size: number;
  color: string;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

/** Exact geometry from the approved visual-companion mockups (ADR-0003) - full is the Overview/
 * home hero, reduced is every other admin page (Decision 2: repeating the full hero everywhere
 * was rejected as exhausting before it was even built). */
const BLOBS: Record<HeroSize, Blob[]> = {
  full: [
    { size: 340, color: "var(--blob-1)", top: -140, left: -60 },
    { size: 300, color: "var(--blob-2)", top: -100, right: 80 },
    { size: 260, color: "var(--blob-3)", top: 60, right: -60 },
    { size: 220, color: "var(--blob-4)", bottom: -100, left: 200 },
  ],
  reduced: [
    { size: 220, color: "var(--blob-1)", top: -100, right: 60 },
    { size: 180, color: "var(--blob-3)", top: -60, right: 220 },
  ],
};

const BLUR: Record<HeroSize, number> = { full: 70, reduced: 60 };
const OPACITY: Record<HeroSize, number> = { full: 0.55, reduced: 0.35 };
const PADDING: Record<HeroSize, string> = {
  full: "px-12 pt-14 pb-10",
  reduced: "px-12 pt-9 pb-5",
};

export function GradientHero({
  size,
  padded = true,
  className,
  children,
}: {
  size: HeroSize;
  /** Set false when the caller supplies its own padding/layout classes via `className` (e.g. a
   * full-height centered page) instead of the default header-block padding. */
  padded?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden", padded && PADDING[size], className)}>
      {BLOBS[size].map((blob, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: blob.size,
            height: blob.size,
            background: blob.color,
            top: blob.top,
            bottom: blob.bottom,
            left: blob.left,
            right: blob.right,
            filter: `blur(${BLUR[size]}px)`,
            opacity: OPACITY[size],
          }}
        />
      ))}
      <div className="relative">{children}</div>
    </div>
  );
}
