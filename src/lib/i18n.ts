import { useSyncExternalStore } from "react";
import {
  DAY_ORDER,
  formatDayHours,
  HOURS_LABEL,
  type ChemicalRule,
  type DayHours,
  type FeeKind,
  type HoursCertainty,
  type HoursKind,
  type Station,
  type StationType,
  type TrustStatus,
} from "./stations";
import { extraDe, extraEn, extraNl } from "./i18n-extra";

export type Lang = "de" | "en" | "nl";

const KEY = "bl-lang";

/** Aktive Sprachen: nur DE/EN (User 30.10. 12:42). NL-Texte bleiben im Code, werden aber nicht mehr gewählt. */
export const ACTIVE_LANGS = ["de", "en"] as const;

/** nl (gespeichert oder Browsersprache) → en; sonst en/de; Standard de. */
export function pickLang(saved: string | null | undefined, nav: string | null | undefined): "de" | "en" {
  const s = (saved ?? "").toLowerCase();
  if (s === "de" || s === "en") return s;
  if (s === "nl") return "en";
  const n = (nav ?? "").toLowerCase();
  if (n.startsWith("en") || n.startsWith("nl")) return "en";
  return "de";
}

function detect(): Lang {
  let saved: string | null = null;
  let nav = "";
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    /* ignore */
  }
  try {
    nav = navigator.language || "";
  } catch {
    /* ignore */
  }
  const lang = pickLang(saved, nav);
  if (saved === "nl") {
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* ignore */
    }
  }
  return lang;
}

let current: Lang = "de";
let booted = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function pageTitle(lang: Lang): string {
  if (lang === "en") return "Blue Lagune – cassette toilet dump stations | Germany & the Netherlands";
  if (lang === "nl") return "Blue Lagune – cassette legen | Stations in DE + NL";
  return "Blue Lagune – Chemietoilette entsorgen | Stationen in DE + NL";
}

function applyLangToDocument(lang: Lang) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.title = pageTitle(lang);
}

export function bootLang() {
  if (booted) return getLang();
  booted = true;
  current = detect();
  applyLangToDocument(current);
  return current;
}

export function getLang(): Lang {
  return current;
}

export function setLang(next: Lang) {
  if (next !== "de" && next !== "en" && next !== "nl") return;
  if (next === "nl") next = "en"; // NL nicht mehr wählbar
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  applyLangToDocument(next);
  emit();
}

export function toggleLang() {
  setLang(current === "de" ? "en" : "de");
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getLang,
    () => "de",
  );
}

const de = {
  footerEmpty: "Entleeren",
  footerImprint: "Impressum",
  footerFeedback: "Feedback",
  footerPrivacy: "Datenschutz",
  langDe: "DE",
  langEn: "EN",
  langNl: "NL",
  langToggle: "Sprache wechseln",
  landingKicker: "Entsorgungsstationen fürs Wohnmobil",
  landingH1: "Kassettentoilette entsorgen – ohne Sucherei.",
  landingLead:
    "Finde verlässliche Stationen in Deutschland und den Niederlanden, navigiere dorthin und halte die Karte gemeinsam aktuell.",
  landingOfflineHint: "Speichere Kartenbereiche vor der Fahrt – Stationen und Navigation bleiben auch ohne Netz erreichbar.",
  landingOfflineCta: "Offline-Karten öffnen",
  landingTileFind: "Finden & fahren",
  landingTileFindSub: "Karte, Suche, GPX",
  landingTileWater: "Wasser & Kassette",
  landingTileWaterSub: "V+E, Filter",
  landingTileSave: "Merken",
  landingTileSaveSub: "Liste & Notizen",
  landingCount: "Aktuell {n}+ Stationen",
  landingVisitors: "{n} Besucher",
  landingCta: "Zur Karte",
  landingNext: "Nächstes Mal direkt zur Karte.",
  landingOnce: "Nur diesmal zur Karte",
  srTitle: "Blue Lagune – Chemietoilette und Kassette entsorgen in Deutschland und den Niederlanden",
  srLead:
    "Interaktive Karte mit Entsorgungsstationen für Chemietoiletten und Kassettentoiletten in Deutschland und den Niederlanden.",
  sheetResize: "Liste größer oder kleiner",
  nearbyStations: "Nahegelegene Stationen",
  sortBy: "Sortieren nach",
  sortDistance: "Distanz",
  sortName: "Name",
  sortVerified: "Zuletzt geprüft",
  shareMap: "Teilen",
  mapLayers: "Kartenebene",
  filterToggle: "Filter",
  alongRoute: "Entlang Route",
  countryDE: "Deutschland",
  countryNL: "Niederlande",
  routeAir: "Straßenroute nicht verfügbar – Luftlinie mit Korridor.",
  guideTitle: "Kassette entleeren",
  close: "Schließen",
  closeDe: "Schließen",
  guide1t: "1. Station finden.",
  guide1: "Ort + Umkreis oder Standort.",
  guide2t: "2. Öffnungszeiten prüfen.",
  guide3t: "3. Nur gekennzeichnete Grube.",
  guide4t: "4. Nachspülen.",
  guide5t: "5. Status melden.",
  guide5: "Bei Defekt in der App markieren.",
  placePh: "Ort/PLZ",
  cityPh: "Stadt, Ort oder PLZ (DE / NL) …",
  radius: "Umkreis",
  radiusPlace: "Ort",
  noCity: "Kein Ort gefunden. Stadt in DE/NL, Ortsteil oder PLZ eingeben.",
  noCityHits: "Keine Treffer in {n} Orten. Stadt in DE/NL, Ortsteil oder PLZ versuchen.",
  didYouMean: "Meintest du …",
  popular: "Häufige Ziele",
  placesFooter: "{n} Orte · DE + NL · PLZ-Suche",
  clearPlace: "Ort löschen",
  showCities: "Städte anzeigen",
  chipCassette: "Kassette",
  chipGrey: "Grauwasser",
  chipGreyShort: "Grau",
  chipFresh: "Frischwasser",
  chipFree: "Kostenlos",
  chipPaid: "Bezahlt",
  chipGuest: "Nur Gäste",
  chipOpen: "Jetzt offen",
  chip24: "24h",
  chipCamp: "Campingplatz",
  chipCc: "CamperClean",
  chipHose: "Schlauch",
  chipOk: "Bestätigt",
  chipDe: "DE",
  chipNl: "NL",
  ariaCassette: "Kassette anzeigen",
  ariaGrey: "Nur mit Grauwasser",
  ariaFresh: "Nur mit Frischwasser",
  ariaFree: "Kostenlos",
  ariaPaid: "Mit Gebühr",
  ariaGuest: "Nur Gäste / im Preis",
  ariaOpen: "Jetzt geöffnet",
  aria24: "Rund um die Uhr",
  ariaCamp: "Campingplätze anzeigen",
  ariaCc: "CamperClean anzeigen",
  ariaHose: "Mit Schlauch",
  ariaOk: "Community bestätigt",
  ariaDe: "Stationen in Deutschland",
  ariaNl: "Stationen in den Niederlanden",
  reset: "Reset",
  inView: "{n} im Ausschnitt",
  route: "Route",
  saved: "Merkliste",
  addPlace: "Örtlichkeit hinzufügen",
  stationsN: "{n} Stationen",
  list: "Liste",
  backList: "← Liste",
  back: "← Zurück",
  emptyView: "Keine Stationen in diesem Kartenausschnitt.",
  emptyHint: "Zoome heraus oder Filter zurücksetzen.",
  emptyFilter: "Keine Stationen passen zu diesen Filtern.",
  emptyFilterHint: "Filter zurücksetzen oder andere Optionen wählen.",
  savedEmpty: "Noch keine Stationen gemerkt.",
  recently: "Zuletzt angesehen",
  routeLead: "Stationen entlang der Strecke, nicht nur Luftlinie.",
  from: "Von",
  to: "Nach",
  startPlace: "Startort",
  endPlace: "Zielort",
  corridor: "Korridor",
  routeNeedCities: "Start und Ziel aus der Vorschlagsliste wählen.",
  routeBusy: "Route wird berechnet …",
  routeApply: "Route anwenden",
  routeClear: "Route löschen",
  routeKmMin: "{km} km · ca. {min} min",
  delete: "Löschen",
  savedYes: "Gemerkt",
  save: "Merken",
  share: "Teilen",
  linkCopied: "Link kopiert",
  seasonalWarn: "Saisonale Station – im Winter oft geschlossen. Zeiten vor der Anfahrt prüfen.",
  reportStatus: "Status melden",
  usedNow: "Gerade genutzt",
  geht: "Geht",
  broken: "Defekt",
  closed: "Geschlossen",
  dirty: "Unsauber",
  note: "Persönliche Notiz",
  notePh: "Zufahrt, Münzen, Geruch …",
  locate: "Standort",
  typeCassette: "Kassette",
  typeCombo: "Kombi V+E",
  typeCc: "CamperClean",
  typeMunicipal: "Kommunal",
  typeGrey: "Nur Grauwasser",
  feeFree: "Kostenlos",
  feePaid: "Gebühr",
  feeGuest: "Nur Gäste / im Preis",
  hours24: "Rund um die Uhr",
  hoursDay: "Tagsüber",
  hoursSeason: "Saisonal",
  hoursLimited: "Eingeschränkt",
  certExact: "Zeiten bestätigt",
  certApprox: "Ungefähre Zeiten",
  certUnknown: "Zeiten unsicher",
  statusConfirmed: "Bestätigt",
  statusStale: "Prüfung fällig",
  statusBroken: "Defekt",
  statusClosed: "Geschlossen",
  statusUnknown: "Ungeprüft",
  hoursDaily24: "Täglich rund um die Uhr",
  hoursDaily: "Täglich {slot}",
  hoursOpen: "Öffnungszeiten",
  today: "heute",
  hoursCheck: "Vor der Anfahrt Zeiten prüfen – Angaben können saisonal abweichen.",
  allDay: "durchgehend",
  shut: "geschlossen",
  dayMo: "Mo",
  dayTu: "Di",
  dayWe: "Mi",
  dayTh: "Do",
  dayFr: "Fr",
  daySa: "Sa",
  daySu: "So",
  clusterN: "{n} Stationen",
  navMissing: "Keine genaue Position – Navigation nicht möglich.",
  navOpenFail: "App nicht geöffnet – bitte wählen",
  navStart: "Navigation starten",
  navChoose: "Navigations-App wählen",
  navOpenWith: "Navigation öffnen mit",
  navPick: "Wähle eine installierte App auf deinem Smartphone",
  navCancel: "Abbrechen",
  navSystem: "Installierte Navi-App wählen",
  navApple: "Apple Karten",
  navGoogle: "Google Maps",
  navWaze: "Waze",
  navOther: "Andere installierte App",
  addTitle: "Örtlichkeit hinzufügen",
  fieldName: "Name *",
  fieldCity: "Stadt *",
  fieldZip: "PLZ *",
  fieldState: "Bundesland / Provinz",
  fieldAddress: "Adresse *",
  fieldLat: "Latitude *",
  fieldLng: "Longitude *",
  useMyPos: "Meinen Standort verwenden",
  fieldType: "Typ",
  fieldFee: "Gebühr",
  fieldFeeNote: "Gebühren-Hinweis",
  fieldHours: "Öffnungszeiten",
  fieldHoursNote: "Öffnungszeiten-Hinweis",
  fieldChem: "Chemie-Regel",
  fieldGear: "Ausstattung",
  fieldDesc: "Beschreibung",
  light: "Beleuchtung",
  covered: "Überdacht",
  wheels: "Rollen/Räder",
  saveStation: "Station speichern",
  saveLocal: "Wird nur auf diesem Gerät gespeichert (Community-Eintrag).",
  namePh: "z. B. Wohnmobilstellplatz XY",
  addrPh: "Straße und Hausnummer",
  feePh: "z. B. 2 € Münze",
  hoursPh: "z. B. 8–20 Uhr, Winter zu",
  descPh: "Zufahrt, Hinweise, Öffnungszeiten …",
  errGeoOff: "Geolocation nicht verfügbar",
  errGeoFail: "Standort konnte nicht ermittelt werden",
  errRequired: "Name, Stadt, PLZ und Adresse sind Pflicht.",
  errCoords: "Gültige Koordinaten (Lat/Lng) erforderlich.",
  errBounds: "Koordinaten liegen außerhalb von DE/NL.",
  chemNone: "Keine Einschränkung",
  chemGreen: "Nur grüne Zusätze",
  chemBan: "Chemie verboten",
  communityEntry: "Community-Eintrag",
  fbKicker: "Kontakt",
  fbTitle: "Feedback",
  fbLead: "Hinweis zur Karte, ein Fehler, ein Wunsch. Wir lesen mit.",
  fbThanks: "Danke. Deine Nachricht ist raus.",
  fbName: "Name",
  fbEmail: "E-Mail",
  fbCompany: "Firma",
  fbMsg: "Nachricht",
  fbSend: "Absenden",
  fbSending: "Senden…",
  fbErrName: "Bitte einen Namen angeben (2–80 Zeichen).",
  fbErrMail: "Bitte eine gültige E-Mail-Adresse angeben.",
  fbErrMsg: "Die Nachricht sollte zwischen 10 und 4000 Zeichen haben.",
  fbErr429: "Zu viele Nachrichten. Bitte später noch einmal.",
  fbErrSend: "Senden hat nicht geklappt. Bitte später noch einmal.",
  backMap: "← Karte",
  legalKicker: "Rechtliches",
  imprintTitle: "Impressum",
  imprintP1: "Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG).",
  imprintProvider: "Diensteanbieter",
  imprintFallback:
    "Blue Lagune, erreichbar über die unten genannte E-Mail. Name und ladungsfähige Anschrift des Betreibers werden hier ergänzt.",
  imprintContact: "Kontakt",
  imprintResponsible: "Verantwortlich für den Inhalt",
  imprintResponsibleP: "Verantwortlich nach § 18 Abs. 2 MStV: {name}.",
  imprintOperator: "der Betreiber, siehe Kontakt",
  imprintLiability: "Haftung für Inhalte und Links",
  imprintLiabilityP:
    "Die Stationseinträge dienen der Orientierung. Öffnungszeiten und Ausstattung können sich ändern. Für verlinkte Websites sind deren Betreiber verantwortlich.",
  imprintOdr: "EU-Streitschlichtung",
  imprintOdrP:
    "Plattform der EU-Kommission: {url}. Wir nehmen nicht an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teil.",
  privacyTitle: "Datenschutz",
  privacyP1: "Verantwortlich im Sinne der DSGVO ist der im Impressum genannte Anbieter.",
  privacyWhich: "Welche Daten anfallen",
  privacyMap: "Karte:",
  privacyMapP: "Kartendaten © OpenStreetMap-Mitwirkende, Vektorkacheln von OpenFreeMap (OpenMapTiles), Satellitenbild EOxCloudless 2016 von EOX IT Services GmbH (CC BY 4.0, enthält modifizierte Copernicus-Sentinel-Daten). Beim Laden der Karte ruft dein Browser die Kacheln direkt bei diesen Anbietern ab; dabei wird deine IP-Adresse übertragen.",
  privacySatP: "Satellitenvorschau und -karte (Esri ArcGIS): Nur wenn du einwilligst („Erlauben“) oder die Satellitenansicht einschaltest, lädt dein Browser Kartenkacheln direkt von Servern der Environmental Systems Research Institute, Inc. (Esri), 380 New York Street, Redlands, CA 92373, USA. Dabei werden deine IP-Adresse, Browser- und Geräteinformationen, der angefragte Kartenausschnitt, der Zeitpunkt sowie unser API-Schlüssel übertragen. Zweck: Anzeige der Satellitenbilder sowie Abrechnung und Missbrauchsschutz bei Esri. Rechtsgrundlage: deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG). Deine Wahl speichern wir nur im Local Storage deines Geräts; das ist dafür unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Die Kacheln werden nur im Cache deines Browsers zwischengespeichert, nicht auf unseren Servern. Auftragsverarbeitung: Mit Esri besteht ein Auftragsverarbeitungsvertrag (Esri Data Processing Addendum) nach Art. 28 DSGVO. Übermittlung in die USA: Grundlage sind die EU-Standardvertragsklauseln im Data Processing Addendum (Art. 46 Abs. 2 lit. c DSGVO). Speicherdauer: Esri speichert die Daten nach eigenen Angaben nur so lange, wie es für die genannten Zwecke nötig ist. Widerruf: Du kannst deine Einwilligung jederzeit mit Wirkung für die Zukunft unter „Datenschutz“ → „Satellitenvorschau“ widerrufen (Art. 7 Abs. 3 DSGVO); danach lädt die App nichts mehr von Esri. Mehr Infos: https://www.esri.com/en-us/privacy/privacy-statements/privacy-statement und https://trust.arcgis.com/en/compliance/gdpr.htm.",
  privacyLoc: "Standort:",
  privacyLocP: "nur im Browser nach Freigabe, nicht an uns gesendet.",
  privacyLs: "Local Storage:",
  privacyLsP: "Filter, Merkliste, deine zuletzt eingegebenen Suchbegriffe („Zuletzt gesucht“) und deine Wahl zur Satellitenvorschau auf deinem Gerät; das Speichern dieser Wahl ist unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Die Suchbegriffe bleiben nur auf deinem Gerät und werden nicht an uns übertragen. Du kannst sie jederzeit in der Suche löschen oder über die Browser-Einstellungen entfernen.",
  privacyProP: "Anonyme Tageszähler (Test „Pro Europa“): Wenn dir der Hinweis „Pro Europa“ angezeigt wird, du auf „Interesse zeigen“ tippst oder welche Variante (Europa/Frankreich) du siehst, erhöht unser Server (Cloudflare Workers) einen Zähler für den jeweiligen Tag. Wir speichern dabei keine IP-Adresse, keine Kennung und keine Cookies und lesen nichts aus deinem Gerätespeicher; deine IP-Adresse wird technisch bedingt nur kurz für die Übertragung verarbeitet. Nur zur Missbrauchsbegrenzung bilden wir einen kurzlebigen Tages-Hash deiner IP-Adresse (mit täglich wechselndem Zufallswert); er wird täglich um 00:00 UTC gelöscht. Es entstehen nur Summen pro Tag, die keinen Bezug zu dir haben. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (unser Interesse, herauszufinden, ob genug Nachfrage für Pro Europa besteht). Der Test endet am 27.11.2026.",
  privacyHost: "Hosting:",
  privacyHostP: "Cloudflare-Logs (IP, Zeitpunkt, Datei) zur Sicherheit.",
  privacyLaw: "Rechtsgrundlagen",
  privacyLawP: "Art. 6 Abs. 1 lit. f DSGVO (Betrieb, Besucherzählung und Missbrauchsbremse), lit. a bei Standortfreigabe und Satellitenvorschau.",
  privacyRights: "Deine Rechte",
  privacyRightsP: "Auskunft, Löschung, Widerspruch. Kontakt:",
  privacyCookies: "Cookies",
  privacyCookiesP: "Keine Tracking- oder Werbe-Cookies.",
  privacyData: "Stationsdaten:",
  privacyDataP: "OpenStreetMap, Bordatlas, Betreiber und Community.",
  privacyGeo: "Ortssuche:",
  privacyGeoP: "Wenn du einen Ort oder eine PLZ eingibst, sendet dein Browser den eingegebenen Text und deine IP-Adresse an Nominatim der OpenStreetMap Foundation (Vereinigtes Königreich, Angemessenheitsbeschluss). Zweck: Ortsnamen finden. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.",
  hoursUnknown: "unbekannt",
  feeUnknown: "unbekannt",
  reportNote: "Kurzer Hinweis (öffentlich)",
  reportNotePh: "z. B. Münze klemmt …",
  reportErr: "Meldung hat nicht geklappt. Bitte später noch einmal.",
  reportRate: "Zu viele Meldungen. Bitte später noch einmal.",
  sourceCredits: "Stationsdaten: OpenStreetMap, Bordatlas, Betreiber, Community.",
} as const;

const en: Record<keyof typeof de, string> = {
  footerEmpty: "How to empty",
  footerImprint: "Imprint",
  footerFeedback: "Feedback",
  footerPrivacy: "Privacy",
  langDe: "DE",
  langEn: "EN",
  langNl: "NL",
  langToggle: "Switch language",
  landingKicker: "Dump stations for motorhomes",
  landingH1: "Empty the cassette toilet — no hunting around.",
  landingLead:
    "Find reliable dump stations in Germany and the Netherlands, navigate there, and keep the map up to date together.",
  landingOfflineHint: "Save map areas before you set off — stations and navigation stay available without a network.",
  landingOfflineCta: "Open offline maps",
  landingTileFind: "Find & drive",
  landingTileFindSub: "Map, search, GPX",
  landingTileWater: "Water & cassette",
  landingTileWaterSub: "Waste + fresh, filters",
  landingTileSave: "Save",
  landingTileSaveSub: "List & notes",
  landingCount: "Currently {n}+ stations",
  landingVisitors: "{n} visitors",
  landingCta: "Open map",
  landingNext: "Next time go straight to the map.",
  landingOnce: "Just this once to the map",
  srTitle: "Blue Lagune – cassette and chemical toilet dump stations in Germany and the Netherlands",
  srLead:
    "Interactive map of dump stations for chemical and cassette toilets in Germany and the Netherlands.",
  sheetResize: "Make the list larger or smaller",
  nearbyStations: "Nearby stations",
  sortBy: "Sort by",
  sortDistance: "Distance",
  sortName: "Name",
  sortVerified: "Last checked",
  shareMap: "Share",
  mapLayers: "Map layer",
  filterToggle: "Filters",
  alongRoute: "Along route",
  countryDE: "Germany",
  countryNL: "Netherlands",
  routeAir: "Road routing unavailable — straight line with corridor.",
  guideTitle: "Empty the cassette",
  close: "Close",
  closeDe: "Close",
  guide1t: "1. Find a station.",
  guide1: "Place + radius or your location.",
  guide2t: "2. Check opening hours.",
  guide3t: "3. Use only the marked drain.",
  guide4t: "4. Rinse afterwards.",
  guide5t: "5. Report status.",
  guide5: "Mark a fault in the app if it is broken.",
  placePh: "City/ZIP",
  cityPh: "City, place or postcode (DE / NL) …",
  radius: "Radius",
  radiusPlace: "Place",
  noCity: "No place found. Enter a city in DE/NL, a district or a postcode.",
  noCityHits: "No matches in {n} places. Try a city in DE/NL, a district or a postcode.",
  didYouMean: "Did you mean …",
  popular: "Popular destinations",
  placesFooter: "{n} places · DE + NL · postcode search",
  clearPlace: "Clear place",
  showCities: "Show cities",
  chipCassette: "Cassette",
  chipGrey: "Grey water",
  chipGreyShort: "Grey",
  chipFresh: "Fresh water",
  chipFree: "Free",
  chipPaid: "Paid",
  chipGuest: "Guests only",
  chipOpen: "Open now",
  chip24: "24h",
  chipCamp: "Campsite",
  chipCc: "CamperClean",
  chipHose: "Hose",
  chipOk: "Confirmed",
  chipDe: "DE",
  chipNl: "NL",
  ariaCassette: "Show cassette stations",
  ariaGrey: "Grey water only",
  ariaFresh: "Fresh water only",
  ariaFree: "Free of charge",
  ariaPaid: "With a fee",
  ariaGuest: "Guests only / included",
  ariaOpen: "Open now",
  aria24: "Open 24 hours",
  ariaCamp: "Show campsites",
  ariaCc: "Show CamperClean",
  ariaHose: "With hose",
  ariaOk: "Community confirmed",
  ariaDe: "Stations in Germany",
  ariaNl: "Stations in the Netherlands",
  reset: "Reset",
  inView: "{n} in view",
  route: "Route",
  saved: "Saved",
  addPlace: "Add a station",
  stationsN: "{n} stations",
  list: "List",
  backList: "← List",
  back: "← Back",
  emptyView: "No stations in this map view.",
  emptyHint: "Zoom out or reset the filters.",
  emptyFilter: "No stations match these filters.",
  emptyFilterHint: "Reset the filters or choose different options.",
  savedEmpty: "No stations saved yet.",
  recently: "Recently viewed",
  routeLead: "Stations along the drive, not just as the crow flies.",
  from: "From",
  to: "To",
  startPlace: "Start",
  endPlace: "Destination",
  corridor: "Corridor",
  routeNeedCities: "Pick start and destination from the suggestions.",
  routeBusy: "Calculating route …",
  routeApply: "Apply route",
  routeClear: "Clear route",
  routeKmMin: "{km} km · about {min} min",
  delete: "Delete",
  savedYes: "Saved",
  save: "Save",
  share: "Share",
  linkCopied: "Link copied",
  seasonalWarn: "Seasonal station — often closed in winter. Check hours before you go.",
  reportStatus: "Report status",
  usedNow: "Just used",
  geht: "Working",
  broken: "Broken",
  closed: "Closed",
  dirty: "Dirty",
  note: "Personal note",
  notePh: "Access, coins, smell …",
  locate: "Location",
  typeCassette: "Cassette",
  typeCombo: "Combo waste+fresh",
  typeCc: "CamperClean",
  typeMunicipal: "Municipal",
  typeGrey: "Grey water only",
  feeFree: "Free",
  feePaid: "Fee",
  feeGuest: "Guests only / included",
  hours24: "Around the clock",
  hoursDay: "Daytime",
  hoursSeason: "Seasonal",
  hoursLimited: "Limited",
  certExact: "Hours confirmed",
  certApprox: "Approximate hours",
  certUnknown: "Hours uncertain",
  statusConfirmed: "Confirmed",
  statusStale: "Due a check",
  statusBroken: "Broken",
  statusClosed: "Closed",
  statusUnknown: "Unchecked",
  hoursDaily24: "Open 24 hours every day",
  hoursDaily: "Daily {slot}",
  hoursOpen: "Opening hours",
  today: "today",
  hoursCheck: "Check hours before you arrive — they can change with the season.",
  allDay: "24 hours",
  shut: "closed",
  dayMo: "Mon",
  dayTu: "Tue",
  dayWe: "Wed",
  dayTh: "Thu",
  dayFr: "Fri",
  daySa: "Sat",
  daySu: "Sun",
  clusterN: "{n} stations",
  navMissing: "No precise position — navigation not available.",
  navOpenFail: "App did not open — please choose",
  navStart: "Start navigation",
  navChoose: "Choose a navigation app",
  navOpenWith: "Open navigation with",
  navPick: "Pick an app installed on your phone",
  navCancel: "Cancel",
  navSystem: "Choose an installed nav app",
  navApple: "Apple Maps",
  navGoogle: "Google Maps",
  navWaze: "Waze",
  navOther: "Another installed app",
  addTitle: "Add a station",
  fieldName: "Name *",
  fieldCity: "City *",
  fieldZip: "Postcode *",
  fieldState: "State / province",
  fieldAddress: "Address *",
  fieldLat: "Latitude *",
  fieldLng: "Longitude *",
  useMyPos: "Use my location",
  fieldType: "Type",
  fieldFee: "Fee",
  fieldFeeNote: "Fee note",
  fieldHours: "Opening hours",
  fieldHoursNote: "Hours note",
  fieldChem: "Chemical rule",
  fieldGear: "Facilities",
  fieldDesc: "Description",
  light: "Lighting",
  covered: "Covered",
  wheels: "Wheels",
  saveStation: "Save station",
  saveLocal: "Stored only on this device (community entry).",
  namePh: "e.g. motorhome stop XY",
  addrPh: "Street and number",
  feePh: "e.g. €2 coin",
  hoursPh: "e.g. 8–20, closed in winter",
  descPh: "Access, notes, opening hours …",
  errGeoOff: "Geolocation not available",
  errGeoFail: "Could not determine location",
  errRequired: "Name, city, postcode and address are required.",
  errCoords: "Valid coordinates (lat/lng) are required.",
  errBounds: "Coordinates are outside DE/NL.",
  chemNone: "No restriction",
  chemGreen: "Green additives only",
  chemBan: "Chemicals banned",
  communityEntry: "Community entry",
  fbKicker: "Contact",
  fbTitle: "Feedback",
  fbLead: "A map note, a bug, a wish. We read it.",
  fbThanks: "Thanks. Your message is on its way.",
  fbName: "Name",
  fbEmail: "Email",
  fbCompany: "Company",
  fbMsg: "Message",
  fbSend: "Send",
  fbSending: "Sending…",
  fbErrName: "Please enter a name (2–80 characters).",
  fbErrMail: "Please enter a valid email address.",
  fbErrMsg: "The message should be between 10 and 4000 characters.",
  fbErr429: "Too many messages. Please try again later.",
  fbErrSend: "Sending failed. Please try again later.",
  backMap: "← Map",
  legalKicker: "Legal",
  imprintTitle: "Imprint",
  imprintP1: "Information according to § 5 German DDG.",
  imprintProvider: "Service provider",
  imprintFallback:
    "Blue Lagune, reachable via the email below. The operator’s name and service address will be added here.",
  imprintContact: "Contact",
  imprintResponsible: "Responsible for content",
  imprintResponsibleP: "Responsible under § 18 (2) MStV: {name}.",
  imprintOperator: "the operator, see contact",
  imprintLiability: "Liability for content and links",
  imprintLiabilityP:
    "Station listings are for orientation. Hours and facilities can change. Operators of linked sites are responsible for their content.",
  imprintOdr: "EU dispute resolution",
  imprintOdrP: "EU Commission platform: {url}. We do not take part in consumer arbitration.",
  privacyTitle: "Privacy",
  privacyP1: "The controller under the GDPR is the provider named in the imprint.",
  privacyWhich: "What data occurs",
  privacyMap: "Map:",
  privacyMapP: "Map data © OpenStreetMap contributors, vector tiles from OpenFreeMap (OpenMapTiles), satellite imagery EOxCloudless 2016 by EOX IT Services GmbH (CC BY 4.0, contains modified Copernicus Sentinel data). Your browser loads the tiles directly from these providers, which transmits your IP address.",
  privacySatP: "Satellite preview and map (Esri ArcGIS): Only if you consent (\"Allow\") or switch on the satellite view does your browser load map tiles directly from servers of Environmental Systems Research Institute, Inc. (Esri), 380 New York Street, Redlands, CA 92373, USA. Your IP address, browser and device information, the requested map area, the time and our API key are transmitted. Purpose: displaying the satellite images, plus billing and abuse protection at Esri. Legal basis: your consent (Art. 6(1)(a) GDPR, § 25(1) TDDDG). We store your choice only in your device's local storage; this is strictly necessary for that purpose (§ 25(2) no. 2 TDDDG). Tiles are cached only in your browser's cache, not on our servers. Data processing agreement: An agreement (Esri Data Processing Addendum) under Art. 28 GDPR is in place with Esri. Transfer to the USA: based on the EU Standard Contractual Clauses in the Data Processing Addendum (Art. 46(2)(c) GDPR). Retention: According to Esri, data is kept only as long as necessary for these purposes. Withdrawal: You can withdraw your consent at any time with effect for the future under \"Privacy\" → \"Satellite preview\" (Art. 7(3) GDPR); the app then no longer loads anything from Esri. More information: https://www.esri.com/en-us/privacy/privacy-statements/privacy-statement and https://trust.arcgis.com/en/compliance/gdpr.htm.",
  privacyLoc: "Location:",
  privacyLocP: "only in the browser after you allow it, not sent to us.",
  privacyLs: "Local storage:",
  privacyLsP: "filters, saved list, your recent search terms (\"Recent searches\") and your satellite preview choice on your device; storing this choice is strictly necessary (§ 25(2) no. 2 TDDDG). The search terms stay on your device only and are not sent to us. You can delete them at any time in the search or via your browser settings.",
  privacyProP: "Anonymous daily counters (\"Pro Europa\" test): When the \"Pro Europa\" notice is shown to you, when you tap \"Show interest\", or depending on which variant (Europe/France) you see, our server (Cloudflare Workers) increases a counter for that day. We do not store an IP address, identifier or cookies, and we do not read anything from your device storage; for technical reasons your IP address is only processed briefly for the transmission. Only to limit abuse, we create a short-lived daily hash of your IP address (with a random value that changes daily); it is deleted every day at 00:00 UTC. Only daily totals are created, with no link to you. The legal basis is Art. 6(1)(f) GDPR (our interest in finding out whether there is enough demand for Pro Europa). The test ends on 27/11/2026.",
  privacyHost: "Hosting:",
  privacyHostP: "Cloudflare logs (IP, time, file) for security.",
  privacyLaw: "Legal bases",
  privacyLawP: "Art. 6 (1)(f) GDPR (operation, visitor count and abuse protection), (a) when you share location and for the satellite preview.",
  privacyRights: "Your rights",
  privacyRightsP: "Access, erasure, objection. Contact:",
  privacyCookies: "Cookies",
  privacyCookiesP: "No tracking or advertising cookies.",
  privacyData: "Station data:",
  privacyDataP: "OpenStreetMap, Bordatlas, operators and the community.",
  privacyGeo: "Place search:",
  privacyGeoP: "When you enter a place or postcode, your browser sends the text you entered and your IP address to Nominatim of the OpenStreetMap Foundation (United Kingdom, adequacy decision). Purpose: finding place names. Legal basis: Art. 6(1)(f) GDPR.",
  hoursUnknown: "unknown",
  feeUnknown: "unknown",
  reportNote: "Short public note",
  reportNotePh: "e.g. coin jammed …",
  reportErr: "Could not send the report. Please try again later.",
  reportRate: "Too many reports. Please try again later.",
  sourceCredits: "Station data: OpenStreetMap, Bordatlas, operators, community.",
};

/** NL ohne eigene Rechtstexte (privacySatP/LsP/ProP/LawP): diese fallen bewusst auf EN zurück (Lex-Nachtrag 30.10.). */
type NlOwnKeys = Exclude<keyof typeof de, "privacySatP" | "privacyLsP" | "privacyProP" | "privacyLawP">;
const nlOwn: Record<NlOwnKeys, string> = {
  footerEmpty: "Legen",
  footerImprint: "Colofon",
  footerFeedback: "Feedback",
  footerPrivacy: "Privacy",
  langDe: "DE",
  langEn: "EN",
  langNl: "NL",
  langToggle: "Taal wisselen",
  landingKicker: "Losstations voor de camper",
  landingH1: "Cassette legen – zonder zoekwerk.",
  landingLead: "Vind betrouwbare stations in Duitsland en Nederland, navigeer ernaartoe en houd de kaart samen actueel.",
  landingOfflineHint: "Sla kaartgebieden op voordat je vertrekt — stations en navigatie blijven zonder netwerk beschikbaar.",
  landingOfflineCta: "Offlinekaarten openen",
  landingTileFind: "Vinden & rijden",
  landingTileFindSub: "Kaart, zoeken, GPX",
  landingTileWater: "Water & cassette",
  landingTileWaterSub: "V+E, filters",
  landingTileSave: "Bewaren",
  landingTileSaveSub: "Lijst & notities",
  landingCount: "Momenteel {n}+ stations",
  landingVisitors: "{n} bezoekers",
  landingCta: "Naar de kaart",
  landingNext: "De volgende keer meteen naar de kaart.",
  landingOnce: "Alleen deze keer naar de kaart",
  srTitle: "Blue Lagune – chemisch toilet en cassette legen in Duitsland en Nederland",
  srLead: "Interactieve kaart met losstations voor chemische toiletten en cassettes in Duitsland en Nederland.",
  sheetResize: "Lijst groter of kleiner",
  nearbyStations: "Stations in de buurt",
  sortBy: "Sorteren op",
  sortDistance: "Afstand",
  sortName: "Naam",
  sortVerified: "Laatst gecontroleerd",
  shareMap: "Delen",
  mapLayers: "Kaartlaag",
  filterToggle: "Filters",
  alongRoute: "Langs de route",
  countryDE: "Duitsland",
  countryNL: "Nederland",
  routeAir: "Geen wegroute beschikbaar – luchtlijn met corridor.",
  guideTitle: "Cassette legen",
  close: "Sluiten",
  closeDe: "Sluiten",
  guide1t: "1. Station vinden.",
  guide1: "Plaats + straal of je locatie.",
  guide2t: "2. Openingstijden controleren.",
  guide3t: "3. Alleen de gemarkeerde put.",
  guide4t: "4. Naspoelen.",
  guide5t: "5. Status melden.",
  guide5: "Markeer een defect in de app.",
  placePh: "Plaats/PC",
  cityPh: "Stad, plaats of postcode (DE / NL) …",
  radius: "Straal",
  radiusPlace: "Plaats",
  noCity: "Geen plaats gevonden. Voer een stad in DE/NL, een wijk of een postcode in.",
  noCityHits: "Geen treffers in {n} plaatsen. Probeer een stad in DE/NL, een wijk of een postcode.",
  didYouMean: "Bedoelde je …",
  popular: "Populaire bestemmingen",
  placesFooter: "{n} plaatsen · DE + NL · postcodezoeken",
  clearPlace: "Plaats wissen",
  showCities: "Steden tonen",
  chipCassette: "Cassette",
  chipGrey: "Grijs water",
  chipGreyShort: "Grijs",
  chipFresh: "Drinkwater",
  chipFree: "Gratis",
  chipPaid: "Betaald",
  chipGuest: "Alleen gasten",
  chipOpen: "Nu open",
  chip24: "24u",
  chipCamp: "Camping",
  chipCc: "CamperClean",
  chipHose: "Slang",
  chipOk: "Bevestigd",
  chipDe: "DE",
  chipNl: "NL",
  ariaCassette: "Cassettestations tonen",
  ariaGrey: "Alleen met grijs water",
  ariaFresh: "Alleen met drinkwater",
  ariaFree: "Gratis",
  ariaPaid: "Met tarief",
  ariaGuest: "Alleen gasten / inbegrepen",
  ariaOpen: "Nu geopend",
  aria24: "Rond de klok",
  ariaCamp: "Campings tonen",
  ariaCc: "CamperClean tonen",
  ariaHose: "Met slang",
  ariaOk: "Door community bevestigd",
  ariaDe: "Stations in Duitsland",
  ariaNl: "Stations in Nederland",
  reset: "Reset",
  inView: "{n} in beeld",
  route: "Route",
  saved: "Bewaard",
  addPlace: "Plek toevoegen",
  stationsN: "{n} stations",
  list: "Lijst",
  backList: "← Lijst",
  back: "← Terug",
  emptyView: "Geen stations in dit kaartbeeld.",
  emptyHint: "Zoom uit of zet de filters terug.",
  emptyFilter: "Geen stations passen bij deze filters.",
  emptyFilterHint: "Wis de filters of kies andere opties.",
  savedEmpty: "Nog geen stations bewaard.",
  recently: "Onlangs bekeken",
  routeLead: "Stations langs de route, niet alleen hemelsbreed.",
  from: "Van",
  to: "Naar",
  startPlace: "Startplaats",
  endPlace: "Bestemming",
  corridor: "Corridor",
  routeNeedCities: "Kies start en bestemming uit de suggesties.",
  routeBusy: "Route wordt berekend …",
  routeApply: "Route toepassen",
  routeClear: "Route wissen",
  routeKmMin: "{km} km · ca. {min} min",
  delete: "Verwijderen",
  savedYes: "Bewaard",
  save: "Bewaren",
  share: "Delen",
  linkCopied: "Link gekopieerd",
  seasonalWarn: "Seizoensstation – in de winter vaak dicht. Check de tijden voor je vertrekt.",
  reportStatus: "Status melden",
  usedNow: "Net gebruikt",
  geht: "Gaat",
  broken: "Defect",
  closed: "Gesloten",
  dirty: "Vuil",
  note: "Persoonlijke notitie",
  notePh: "Toegang, munten, geur …",
  locate: "Locatie",
  typeCassette: "Cassette",
  typeCombo: "Combi V+E",
  typeCc: "CamperClean",
  typeMunicipal: "Gemeentelijk",
  typeGrey: "Alleen grijs water",
  feeFree: "Gratis",
  feePaid: "Tarief",
  feeGuest: "Alleen gasten / inbegrepen",
  hours24: "Rond de klok",
  hoursDay: "Overdag",
  hoursSeason: "Seizoensgebonden",
  hoursLimited: "Beperkt",
  certExact: "Tijden bevestigd",
  certApprox: "Ongeveerde tijden",
  certUnknown: "Tijden onzeker",
  statusConfirmed: "Bevestigd",
  statusStale: "Controle nodig",
  statusBroken: "Defect",
  statusClosed: "Gesloten",
  statusUnknown: "Niet gecontroleerd",
  hoursDaily24: "Dagelijks rond de klok",
  hoursDaily: "Dagelijks {slot}",
  hoursOpen: "Openingstijden",
  today: "vandaag",
  hoursCheck: "Check de tijden voor aankomst – ze kunnen seizoensafhankelijk zijn.",
  allDay: "doorlopend",
  shut: "gesloten",
  dayMo: "ma",
  dayTu: "di",
  dayWe: "wo",
  dayTh: "do",
  dayFr: "vr",
  daySa: "za",
  daySu: "zo",
  clusterN: "{n} stations",
  navMissing: "Geen exacte positie – navigatie niet mogelijk.",
  navOpenFail: "App niet geopend — kies opnieuw",
  navStart: "Navigatie starten",
  navChoose: "Kies een navigatie-app",
  navOpenWith: "Navigatie openen met",
  navPick: "Kies een app op je telefoon",
  navCancel: "Annuleren",
  navSystem: "Kies een geïnstalleerde navi-app",
  navApple: "Apple Kaarten",
  navGoogle: "Google Maps",
  navWaze: "Waze",
  navOther: "Andere geïnstalleerde app",
  addTitle: "Plek toevoegen",
  fieldName: "Naam *",
  fieldCity: "Stad *",
  fieldZip: "Postcode *",
  fieldState: "Deelstaat / provincie",
  fieldAddress: "Adres *",
  fieldLat: "Latitude *",
  fieldLng: "Longitude *",
  useMyPos: "Mijn locatie gebruiken",
  fieldType: "Type",
  fieldFee: "Tarief",
  fieldFeeNote: "Tarieftoelichting",
  fieldHours: "Openingstijden",
  fieldHoursNote: "Toelichting openingstijden",
  fieldChem: "Chemie-regel",
  fieldGear: "Voorzieningen",
  fieldDesc: "Beschrijving",
  light: "Verlichting",
  covered: "Overdekt",
  wheels: "Wielen",
  saveStation: "Station opslaan",
  saveLocal: "Alleen op dit apparaat opgeslagen (community-item).",
  namePh: "bijv. camperplaats XY",
  addrPh: "Straat en huisnummer",
  feePh: "bijv. €2 munt",
  hoursPh: "bijv. 8–20 uur, winter dicht",
  descPh: "Toegang, tips, openingstijden …",
  errGeoOff: "Geolocatie niet beschikbaar",
  errGeoFail: "Locatie kon niet worden bepaald",
  errRequired: "Naam, stad, postcode en adres zijn verplicht.",
  errCoords: "Geldige coördinaten (lat/lng) vereist.",
  errBounds: "Coördinaten liggen buiten DE/NL.",
  chemNone: "Geen beperking",
  chemGreen: "Alleen groene toevoegingen",
  chemBan: "Chemie verboden",
  communityEntry: "Community-item",
  fbKicker: "Contact",
  fbTitle: "Feedback",
  fbLead: "Een kaarttip, een fout, een wens. We lezen mee.",
  fbThanks: "Dank je. Je bericht is verstuurd.",
  fbName: "Naam",
  fbEmail: "E-mail",
  fbCompany: "Bedrijf",
  fbMsg: "Bericht",
  fbSend: "Versturen",
  fbSending: "Versturen…",
  fbErrName: "Vul een naam in (2–80 tekens).",
  fbErrMail: "Vul een geldig e-mailadres in.",
  fbErrMsg: "Het bericht moet tussen 10 en 4000 tekens zijn.",
  fbErr429: "Te veel berichten. Probeer het later opnieuw.",
  fbErrSend: "Versturen is mislukt. Probeer het later opnieuw.",
  backMap: "← Kaart",
  legalKicker: "Juridisch",
  imprintTitle: "Colofon",
  imprintP1: "Gegevens volgens § 5 Duitse DDG.",
  imprintProvider: "Dienstverlener",
  imprintFallback: "Blue Lagune, bereikbaar via het e-mailadres hieronder. Naam en vestigingsadres van de exploitant worden hier aangevuld.",
  imprintContact: "Contact",
  imprintResponsible: "Verantwoordelijk voor de inhoud",
  imprintResponsibleP: "Verantwoordelijk volgens § 18 lid 2 MStV: {name}.",
  imprintOperator: "de exploitant, zie contact",
  imprintLiability: "Aansprakelijkheid voor inhoud en links",
  imprintLiabilityP: "De stations dienen ter oriëntatie. Openingstijden en voorzieningen kunnen wijzigen. Voor gelinkte websites zijn hun exploitanten verantwoordelijk.",
  imprintOdr: "EU-geschillenbeslechting",
  imprintOdrP: "Platform van de Europese Commissie: {url}. Wij nemen niet deel aan procedures bij een consumentengeschillencommissie.",
  privacyTitle: "Privacy",
  privacyP1: "Verwerkingsverantwoordelijke in de zin van de AVG is de in het colofon genoemde aanbieder.",
  privacyWhich: "Welke gegevens ontstaan",
  privacyMap: "Kaart:",
  privacyMapP: "Kaartgegevens © OpenStreetMap-bijdragers, vectortegels van OpenFreeMap (OpenMapTiles), satellietbeeld EOxCloudless 2016 van EOX IT Services GmbH (CC BY 4.0, bevat gewijzigde Copernicus Sentinel-gegevens). Je browser laadt de tegels rechtstreeks bij deze aanbieders; daarbij wordt je IP-adres verzonden.",
  privacyLoc: "Locatie:",
  privacyLocP: "alleen in de browser na toestemming, niet naar ons gestuurd.",
  privacyLs: "Local Storage:",
  privacyHost: "Hosting:",
  privacyHostP: "Cloudflare-logs (IP, tijdstip, bestand) voor beveiliging.",
  privacyLaw: "Rechtsgrondslagen",
  privacyRights: "Jouw rechten",
  privacyRightsP: "Inzage, wissen, bezwaar. Contact:",
  privacyCookies: "Cookies",
  privacyCookiesP: "Geen tracking- of advertentiecookies.",
  privacyData: "Stationsgegevens:",
  privacyDataP: "OpenStreetMap, Bordatlas, exploitanten en de community.",
  privacyGeo: "Plaatszoeken:",
  privacyGeoP: "Nominatim (OpenStreetMap) voor plaatsnamen — niet voor de kaarttegels.",
  hoursUnknown: "onbekend",
  feeUnknown: "onbekend",
  reportNote: "Korte publieke toelichting",
  reportNotePh: "bijv. munt vast …",
  reportErr: "Melding is niet gelukt. Probeer het later opnieuw.",
  reportRate: "Te veel meldingen. Probeer het later opnieuw.",
  sourceCredits: "Stationsgegevens: OpenStreetMap, Bordatlas, exploitanten, community.",
};

const nl: Record<keyof typeof de, string> = { ...en, ...nlOwn };

type Key = keyof typeof de | keyof typeof extraDe;

function dictFor(lang: Lang): Record<string, string> {
  const extra = lang === "en" ? extraEn : lang === "nl" ? extraNl : extraDe;
  const base: Record<string, string> = lang === "en" ? en : lang === "nl" ? nl : de;
  return { ...base, ...extra };
}

export function t(key: Key, vars?: Record<string, string | number>): string {
  const table = dictFor(current);
  // Plural: bei n = 1 die Variante "<key>_one" nehmen, falls vorhanden (DE/EN).
  const one = vars && String(vars.n) === "1" ? table[`${key}_one`] : undefined;
  let out: string = one ?? table[key] ?? extraDe[key as keyof typeof extraDe] ?? de[key as keyof typeof de];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

export function typeLabel(type: StationType): string {
  const map: Record<StationType, Key> = {
    cassette: "typeCassette",
    combo: "typeCombo",
    camperclean: "typeCc",
    municipal: "typeMunicipal",
    greywater: "typeGrey",
  };
  return t(map[type]);
}

export function feeLabel(fee?: FeeKind | null): string {
  if (!fee) return t("feeUnknown");
  const map: Record<FeeKind, Key> = { free: "feeFree", paid: "feePaid", guest: "feeGuest" };
  return t(map[fee]);
}

export function hoursKindLabel(hours: HoursKind): string {
  const map: Record<HoursKind, Key> = {
    "24h": "hours24",
    daytime: "hoursDay",
    seasonal: "hoursSeason",
    limited: "hoursLimited",
  };
  return t(map[hours]);
}

export function certaintyLabel(c: HoursCertainty): string {
  const map: Record<HoursCertainty, Key> = {
    exact: "certExact",
    approx: "certApprox",
    unknown: "certUnknown",
  };
  return t(map[c]);
}

export function statusLabel(s: TrustStatus): string {
  const map: Record<TrustStatus, Key> = {
    confirmed: "statusConfirmed",
    stale: "statusStale",
    broken: "statusBroken",
    closed: "statusClosed",
    unknown: "statusUnknown",
  };
  return t(map[s]);
}

export function chemLabel(c: ChemicalRule): string {
  const map: Record<ChemicalRule, Key> = {
    none: "chemNone",
    "green-only": "chemGreen",
    banned: "chemBan",
  };
  return t(map[c]);
}

export function dayShort(d: "mo" | "tu" | "we" | "th" | "fr" | "sa" | "su"): string {
  const map = {
    mo: "dayMo",
    tu: "dayTu",
    we: "dayWe",
    th: "dayTh",
    fr: "dayFr",
    sa: "daySa",
    su: "daySu",
  } as const;
  return t(map[d]);
}

export function fmtSlot(slot: DayHours): string {
  if (slot === "24h") return t("allDay");
  if (slot === "closed") return t("shut");
  return `${slot.open}–${slot.close}`;
}

export function hoursLine(station: Station): string | null {
  if (station.hours === "24h") return t("hoursDaily24");
  if (station.weeklyHours) {
    const week = station.weeklyHours;
    const first = week.mo;
    const uniform = DAY_ORDER.every((d) => formatDayHours(week[d]) === formatDayHours(first));
    if (uniform) {
      const core = t("hoursDaily", { slot: fmtSlot(first) });
      return station.hoursNote && !/\d/.test(station.hoursNote) ? `${core} · ${station.hoursNote}` : core;
    }
    return station.hoursNote ?? hoursKindLabel(station.hours);
  }
  if (station.hoursNote && station.hoursNote.trim()) return station.hoursNote.trim();
  if (station.hours) return hoursKindLabel(station.hours);
  return null;
}

void HOURS_LABEL;
export { de, en, nl };

/** Pluralform wählen (Intl-Regeln, DE/EN: „one“ nur bei 1). */
export function plural(n: number, one: string, other: string, lang: string = current): string {
  const rule = new Intl.PluralRules(lang === "en" ? "en" : "de").select(n);
  return (rule === "one" ? one : other).replaceAll("{n}", String(n));
}
