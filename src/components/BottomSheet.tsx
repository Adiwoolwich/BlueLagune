import { useRef, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";

export type SheetStep = "peek" | "mid" | "full";

/** Sheet snap heights in dvh (phone). Mid is lower on md+. */
export function sheetSnaps(): { peek: number; mid: number; full: number } {
  const mid = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches ? 36.5 : 42;
  // Voll lässt oben Platz für Suche und Pflicht-Attribution (nie verdeckt): mind. 96 px frei.
  const vh = typeof window !== "undefined" ? window.innerHeight || 800 : 800;
  const full = Math.min(90, 100 - (96 / vh) * 100);
  return { peek: 24, mid, full };
}

function sheetH(sheet: "peek" | "mid" | "full"): number {
  return sheetSnaps()[sheet];
}

function nearestSheet(h: number, snaps: ReturnType<typeof sheetSnaps>): "peek" | "mid" | "full" {
  const entries: ["peek" | "mid" | "full", number][] = [
    ["peek", snaps.peek],
    ["mid", snaps.mid],
    ["full", snaps.full],
  ];
  let best: "peek" | "mid" | "full" = "mid";
  let bestD = Infinity;
  for (const [k, v] of entries) {
    const d = Math.abs(h - v);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

function rubber(h: number, min: number, max: number): number {
  if (h < min) return min - (min - h) * 0.22;
  if (h > max) return max + (h - max) * 0.22;
  return h;
}

export function SheetHandle({
  label,
  sheet,
  liveH,
  onLiveH,
  onSnap,
  onTap,
}: {
  label: string;
  sheet: "peek" | "mid" | "full";
  liveH: number | null;
  onLiveH: (h: number | null) => void;
  onSnap: (s: "peek" | "mid" | "full") => void;
  onTap: () => void;
}) {
  const startY = useRef<number | null>(null);
  const startH = useRef(0);
  const curH = useRef(0);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const vel = useRef(0);
  const dragged = useRef(false);

  function begin(y: number, target?: HTMLDivElement, pointerId?: number) {
    startY.current = y;
    lastY.current = y;
    lastT.current = performance.now();
    vel.current = 0;
    dragged.current = false;
    startH.current = liveH ?? sheetH(sheet);
    curH.current = startH.current;
    onLiveH(startH.current);
    if (target && pointerId != null) {
      try {
        target.setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    }
  }

  function move(y: number) {
    if (startY.current == null) return;
    const now = performance.now();
    const dt = Math.max(1, now - lastT.current);
    vel.current = (y - lastY.current) / dt; // px/ms; +down
    lastY.current = y;
    lastT.current = now;
    if (Math.abs(y - startY.current) > 6) dragged.current = true;
    const snaps = sheetSnaps();
    const vh = window.innerHeight || 1;
    // finger up → taller sheet
    const deltaVh = ((startY.current - y) / vh) * 100;
    const nextH = rubber(startH.current + deltaVh, snaps.peek, snaps.full);
    curH.current = nextH;
    onLiveH(nextH);
  }

  function end() {
    if (startY.current == null) return;
    startY.current = null;
    const snaps = sheetSnaps();
    // Use ref — React state liveH is stale in the same gesture
    const h = curH.current;
    const v = vel.current; // +down
    let next: "peek" | "mid" | "full";
    // Tesla-near: low velocity threshold, clear step on flick
    if (v < -0.45) {
      next = h < snaps.mid - 2 ? "mid" : "full";
    } else if (v > 0.45) {
      next = h > snaps.mid + 2 ? "mid" : "peek";
    } else {
      next = nearestSheet(h, snaps);
    }
    onLiveH(null);
    if (!dragged.current && Math.abs(h - startH.current) < 1.2) onTap();
    else onSnap(next);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      className="bl-sheet-handle flex h-11 shrink-0 touch-none select-none items-center justify-center pt-1"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        e.preventDefault();
        begin(e.clientY, e.currentTarget, e.pointerId);
      }}
      onPointerMove={(e) => move(e.clientY)}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          onSnap(sheet === "peek" ? "mid" : "full");
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          onSnap(sheet === "full" ? "mid" : "peek");
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTap();
        }
      }}
    >
      <span className="h-1 w-10 rounded-full bg-border-strong" />
    </div>
  );
}


/**
 * Bottom Sheet mit drei Stufen (peek/halb/voll). Ziehen per Touch und Maus (Pointer Events) mit Einrasten,
 * Tastatur (Pfeil hoch/runter, Enter), optional fester ×-Knopf (44 px). Animiert wird nur transform;
 * bei prefers-reduced-motion ohne Übergang (theme.css). Ab 1024 px als Seitenpanel (styles.css).
 */
export function BottomSheet({
  sheet,
  onSnap,
  cycleSteps = ["peek", "mid", "full"],
  label,
  onClose,
  closeLabel = "Schließen",
  children,
}: {
  sheet: SheetStep;
  onSnap: (s: SheetStep) => void;
  cycleSteps?: SheetStep[];
  label: string;
  onClose?: () => void;
  closeLabel?: string;
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLElement>(null);
  const liveHRef = useRef<number | null>(null);
  const liveRaf = useRef<number | null>(null);
  const applyLiveSheet = (h: number | null) => {
    const el = sheetRef.current;
    if (!el) return;
    liveHRef.current = h;
    if (liveRaf.current != null) {
      cancelAnimationFrame(liveRaf.current);
      liveRaf.current = null;
    }
    el.style.transition = "none";
    if (h == null) {
      el.style.setProperty("--sheet-offset", sheetSnaps().full - sheetH(sheet) + "dvh");
      el.style.removeProperty("transition");
      return;
    }
    liveRaf.current = requestAnimationFrame(() => {
      liveRaf.current = null;
      const live = liveHRef.current;
      if (live != null) el.style.setProperty("--sheet-offset", sheetSnaps().full - live + "dvh");
    });
  };
  function cycle() {
    const i = cycleSteps.indexOf(sheet);
    onSnap(cycleSteps[(i + 1) % cycleSteps.length] ?? "mid");
  }
  return (
    <aside
      ref={sheetRef}
      data-bl-sheet={sheet}
      className="bl-sheet bl-glass absolute inset-x-0 bottom-0 z-20 flex min-h-0 flex-col rounded-t-[1.25rem] bg-sheet text-fg shadow-[0_-4px_18px_rgb(0_0_0/0.12)] transition-transform duration-150 ease-out"
      style={
        {
          transform: "translate3d(0, var(--sheet-offset), 0)",
          height: sheetSnaps().full + "dvh",
          "--sheet-offset": sheetSnaps().full - sheetH(sheet) + "dvh",
        } as CSSProperties
      }
    >
      <SheetHandle
        label={label}
        sheet={sheet}
        liveH={liveHRef.current}
        onLiveH={applyLiveSheet}
        onSnap={(s) => {
          applyLiveSheet(null);
          onSnap(s);
        }}
        onTap={cycle}
      />
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="bl-tap absolute right-2 top-1 z-10 inline-flex size-11 items-center justify-center rounded-full text-fg"
        >
          <X className="size-5" />
        </button>
      ) : null}
      {children}
    </aside>
  );
}
