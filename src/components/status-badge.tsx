import { deriveStatus, type LocalReport, type Station, type TrustStatus } from "@/lib/stations";
import { statusLabel, useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const tone: Record<TrustStatus, string> = {
  confirmed: "bg-ok/12 text-ok ring-1 ring-ok/25",
  stale: "bg-stale/12 text-stale ring-1 ring-stale/25",
  broken: "bg-bad/12 text-bad ring-1 ring-bad/25",
  closed: "bg-muted/10 text-muted ring-1 ring-border",
  unknown: "bg-surface-2 text-muted ring-1 ring-border",
};

export function StatusBadge({
  status,
  station,
  report,
  className,
  compact,
}: {
  status?: TrustStatus;
  station?: Station;
  report?: LocalReport;
  className?: string;
  compact?: boolean;
}) {
  useLang();
  const resolved = status ?? (station ? deriveStatus(station, report) : "unknown");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold tracking-wide",
        compact ? "h-5 px-1.5 text-[10px]" : "h-7 px-2.5 text-xs",
        tone[resolved],
        className,
      )}
    >
      {statusLabel(resolved)}
    </span>
  );
}

// Markerfarben (Tesla-Stil: runde Pins, klare Semantik). Rot ausschließlich für „defekt".
export const STATUS_COLOR: Record<string, string> = {
  confirmed: "#1a9e8f",
  stale: "#c27803",
  broken: "#e5484d",
  closed: "#5f5f60",
  unknown: "#3e6ae1",
  open: "#1a9e8f",
  limited: "#c27803",
};
export const CAMPSITE_COLOR = "#15803d";
/** Kartengrund der Basiskarte (hell/dunkel) für Kontrastprüfung. */
export const MARKER_BG = { light: "#efefef", dark: "#262626" };
