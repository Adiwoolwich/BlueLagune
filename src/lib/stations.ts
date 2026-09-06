import { CITIES, findCity, type City } from "./cities";
import { isFiniteLatLng, isSensibleNavCoords } from "./geo";
import partA from "../data/stations-a.json";
import partB from "../data/stations-b.json";
import partC from "../data/stations-c.json";
import partD from "../data/stations-d.json";
import partNl from "../data/stations-nl.json";
import partE from "../data/stations-e.json";
import partCc from "../data/stations-cc.json";
import partF from "../data/stations-f.json";

export { CITIES, findCity };
export type { City };

export type StationType =
  | "cassette"
  | "combo"
  | "camperclean"
  | "municipal"
  | "greywater";

export type FeeKind = "free" | "paid" | "guest";
export type HoursKind = "24h" | "daytime" | "seasonal" | "limited";
export type HoursCertainty = "exact" | "approx" | "unknown";
export type ChemicalRule = "none" | "green-only" | "banned";
export type DataSource = "osm" | "bordatlas" | "community" | "operator";
export type TrustStatus = "confirmed" | "stale" | "broken" | "closed" | "unknown";

export type DayKey = "mo" | "tu" | "we" | "th" | "fr" | "sa" | "su";
export type DayHours = { open: string; close: string } | "24h" | "closed";
export type WeeklyHours = Record<DayKey, DayHours>;

export type Station = {
  id: string;
  name: string;
  city: string;
  postalCode: string;
  state: string;
  lat: number;
  lng: number;
  address: string;
  type: StationType;
  fee: FeeKind;
  feeNote?: string;
  hours: HoursKind;
  hoursNote?: string;
  hoursCertainty?: HoursCertainty;
  weeklyHours?: WeeklyHours;
  cassette: boolean;
  greywater: boolean;
  freshwater: boolean;
  hose: boolean;
  lighting: boolean;
  covered: boolean;
  wheels: boolean;
  campsite?: boolean;
  chemical: ChemicalRule;
  lastVerified: string;
  source: DataSource;
  description: string;
  rating?: number;
  reviewCount?: number;
  photoUrl?: string;
  statusOverride?: "broken" | "closed";
  authorName?: string;
  ownerId?: string;
};

export const GERMANY_CENTER = { lat: 51.16, lng: 10.45 };
/** Startansicht, damit DE und NL gemeinsam auf der Karte liegen. */
export const MAP_CENTER = { lat: 51.55, lng: 7.6 };

export const DAY_ORDER: DayKey[] = ["mo", "tu", "we", "th", "fr", "sa", "su"];
export const DAY_LABEL: Record<DayKey, string> = {
  mo: "Montag",
  tu: "Dienstag",
  we: "Mittwoch",
  th: "Donnerstag",
  fr: "Freitag",
  sa: "Samstag",
  su: "Sonntag",
};
export const DAY_SHORT: Record<DayKey, string> = {
  mo: "Mo",
  tu: "Di",
  we: "Mi",
  th: "Do",
  fr: "Fr",
  sa: "Sa",
  su: "So",
};

const JS_DAY_TO_KEY: DayKey[] = ["su", "mo", "tu", "we", "th", "fr", "sa"];

function allDays(slot: DayHours): WeeklyHours {
  return {
    mo: slot,
    tu: slot,
    we: slot,
    th: slot,
    fr: slot,
    sa: slot,
    su: slot,
  };
}

function parseHourRange(note?: string): { open: string; close: string } | null {
  if (!note) return null;
  const m = note.match(/(\d{1,2})(?:[:.](\d{2}))?\s*[–\-—bis]+\s*(\d{1,2})(?:[:.](\d{2}))?/);
  if (!m) return null;
  const pad = (h: string, min?: string) =>
    `${h.padStart(2, "0")}:${(min ?? "00").padStart(2, "0")}`;
  return { open: pad(m[1], m[2]), close: pad(m[3], m[4]) };
}

export function getHoursCertainty(station: Station): HoursCertainty {
  if (station.hoursCertainty) return station.hoursCertainty;
  if (station.hours === "24h") return "exact";
  if (station.hoursNote && /\d/.test(station.hoursNote)) return "approx";
  if (station.hours === "seasonal" || station.hours === "limited") return "unknown";
  return "approx";
}

export function resolveWeeklyHours(station: Station): WeeklyHours {
  if (station.weeklyHours) return station.weeklyHours;
  if (station.hours === "24h") return allDays("24h");
  const parsed = parseHourRange(station.hoursNote);
  if (station.hours === "daytime") return allDays(parsed ?? { open: "07:00", close: "22:00" });
  if (station.hours === "limited") return allDays(parsed ?? { open: "08:00", close: "18:00" });
  if (station.hours === "seasonal") return allDays(parsed ?? { open: "08:00", close: "20:00" });
  return allDays({ open: "07:00", close: "22:00" });
}

export function formatDayHours(slot: DayHours): string {
  if (slot === "24h") return "durchgehend";
  if (slot === "closed") return "geschlossen";
  return `${slot.open}–${slot.close}`;
}

export function hoursSummary(station: Station): string {
  if (station.hours === "24h") return "Täglich rund um die Uhr";
  const week = resolveWeeklyHours(station);
  const first = week.mo;
  const uniform = DAY_ORDER.every((d) => formatDayHours(week[d]) === formatDayHours(first));
  if (uniform) {
    const core = `Täglich ${formatDayHours(first)}`;
    return station.hoursNote && !/\d/.test(station.hoursNote)
      ? `${core} · ${station.hoursNote}`
      : core;
  }
  return station.hoursNote ?? HOURS_LABEL[station.hours];
}

export const TYPE_LABEL: Record<StationType, string> = {
  cassette: "Kassette",
  combo: "Kombi V+E",
  camperclean: "CamperClean",
  municipal: "Kommunal",
  greywater: "Nur Grauwasser",
};

export const FEE_LABEL: Record<FeeKind, string> = {
  free: "Kostenlos",
  paid: "Gebühr",
  guest: "Nur Gäste / im Preis",
};

export const HOURS_LABEL: Record<HoursKind, string> = {
  "24h": "Rund um die Uhr",
  daytime: "Tagsüber",
  seasonal: "Saisonal",
  limited: "Eingeschränkt",
};

export const CERTAINTY_LABEL: Record<HoursCertainty, string> = {
  exact: "Zeiten bestätigt",
  approx: "Ungefähre Zeiten",
  unknown: "Zeiten unsicher",
};

export const SOURCE_LABEL: Record<DataSource, string> = {
  osm: "OpenStreetMap",
  bordatlas: "Bordatlas",
  community: "Community",
  operator: "Betreiber",
};

export const STATUS_LABEL: Record<TrustStatus, string> = {
  confirmed: "Bestätigt",
  stale: "Prüfung fällig",
  broken: "Defekt",
  closed: "Geschlossen",
  unknown: "Ungeprüft",
};

export type LocalReport = {
  stationId: string;
  kind?: "ok" | "broken" | "closed" | "dirty";
  status?: "confirmed" | "broken" | "closed" | "open";
  at: string | number;
  note?: string;
};

function reportKind(report?: LocalReport): LocalReport["kind"] | undefined {
  if (!report) return undefined;
  if (report.kind) return report.kind;
  if (report.status === "confirmed" || report.status === "open") return "ok";
  if (report.status === "broken") return "broken";
  if (report.status === "closed") return "closed";
  return undefined;
}

function reportAtMs(report?: LocalReport, fallback = Date.now()): number {
  if (!report) return fallback;
  if (typeof report.at === "number") return report.at;
  const n = new Date(report.at).getTime();
  return Number.isFinite(n) ? n : fallback;
}

export function daysSince(iso: string, now = Date.now()): number {
  return (now - new Date(iso).getTime()) / 86_400_000;
}

export function deriveStatus(
  station: Station,
  report?: LocalReport,
  now = Date.now(),
): TrustStatus {
  const kind = reportKind(report);
  if (kind === "broken") return "broken";
  if (kind === "closed") return "closed";
  if (station.statusOverride === "broken") return "broken";
  if (station.statusOverride === "closed") return "closed";
  if (kind === "ok" && (now - reportAtMs(report, now)) / 86_400_000 <= 21) return "confirmed";
  const age = daysSince(station.lastVerified, now);
  if (age <= 21) return "confirmed";
  if (age <= 90) return "stale";
  return "unknown";
}

export function trustScore(station: Station, report?: LocalReport): number {
  const status = deriveStatus(station, report);
  let score = 55;
  if (status === "confirmed") score = 88;
  if (status === "stale") score = 62;
  if (status === "unknown") score = 40;
  if (status === "closed") score = 20;
  if (status === "broken") score = 8;
  if (station.source === "operator" || station.source === "bordatlas") score += 6;
  if ((station.rating ?? 0) >= 4.4) score += 4;
  if (reportKind(report) === "dirty") score -= 10;
  return Math.max(0, Math.min(99, Math.round(score)));
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function isOpenNow(station: Station, date = new Date()): boolean {
  if (station.statusOverride) return false;
  const m = date.getMonth();
  if (station.hours === "seasonal" && (m < 2 || m > 9)) return false;
  if (station.hours === "24h") return true;
  const week = station.weeklyHours;
  if (week) {
    const slot = week[JS_DAY_TO_KEY[date.getDay()]];
    if (slot === "closed") return false;
    if (slot === "24h") return true;
    const now = date.getHours() * 60 + date.getMinutes();
    return now >= minutesOf(slot.open) && now < minutesOf(slot.close);
  }
  const parsed = parseHourRange(station.hoursNote);
  if (parsed) {
    const now = date.getHours() * 60 + date.getMinutes();
    return now >= minutesOf(parsed.open) && now < minutesOf(parsed.close);
  }
  return false;
}

export function isHttpPhotoUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const u = url.trim();
  if (!u) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function searchStations(query: string, list: Station[]): Station[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((s) => {
    const hay =
      `${s.name} ${s.city} ${s.postalCode} ${s.state} ${s.address} ${TYPE_LABEL[s.type]}`.toLowerCase();
    return hay.includes(q);
  });
}

export const STATIONS: Station[] = [
  ...(partA as Station[]),
  ...(partB as Station[]),
  ...(partC as Station[]),
  ...(partD as Station[]),
  ...(partNl as Station[]),
  ...(partE as Station[]),
  ...(partCc as Station[]),
  ...(partF as Station[]),
];

/** Cassette/combo/municipal/greywater dumps (excludes CamperClean overlay). */
export const DUMP_STATIONS: Station[] = STATIONS.filter((s) => s.type !== "camperclean");

const STREET_RE =
  /\d|straße|strasse|str\.|weg|platz|allee|ufer|ring|gasse|damm|chaussee|promenade|deich|hafen|kai|hof|park|straat|laan|kade|dijk|plein|gracht|singel|steeg|haven|kaai|brug|pad|baan/i;

export function hasPreciseCoords(s: { lat?: number; lng?: number }): boolean {
  return isFiniteLatLng(s.lat, s.lng);
}

export function hasStreetAddress(s: { address?: string; city?: string }): boolean {
  const a = (s.address ?? "").trim();
  if (a.length < 3) return false;
  if (s.city && a.toLowerCase() === s.city.toLowerCase()) return false;
  return STREET_RE.test(a);
}

export function canNavigateTo(s: {
  lat?: number;
  lng?: number;
  address?: string;
  city?: string;
}): boolean {
  return isSensibleNavCoords(s.lat, s.lng);
}

export function fullAddress(s: {
  address?: string;
  postalCode?: string;
  city?: string;
  name?: string;
}): string {
  const line = [s.address, [s.postalCode, s.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return line || (s.name ?? "");
}
