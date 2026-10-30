/**
 * Einzige Konfigurationsstelle für die Satellitenquelle.
 * - Mit ESRI_API_KEY (Build-Variable, Platzhalter in .env.example): Esri World Imagery über den
 *   Basemap-Dienst (ibasemaps-api) der ArcGIS Location Platform (kommerziell erlaubt, MapLibre/Leaflet ok).
 *   Pflichten: „Powered by Esri“ + Bildquellen sichtbar, kein Proxy, kein Server-Cache, kein Offline-Speichern
 *   (siehe /workspace/legal/bluelagune-satellit-agb-20261030.md). Lädt nur, wenn der Nutzer Satellit wählt.
 * - Ohne Key: EOxCloudless 2016 (CC BY 4.0, ohne Konto).
 * Weitere Anbieter (MapTiler, Mapbox) = neuer Eintrag in SAT_SOURCES, sonst kein Umbau.
 */
export type SatSource = {
  id: string;
  /** Leaflet-URL; {key} wird durch den API-Key ersetzt. */
  url: string;
  attribution: string;
  maxNativeZoom: number;
  tileSize?: number;
  zoomOffset?: number;
  needsKey?: boolean;
  /** Darf in Service Worker / Offline-Download landen? */
  cacheable: boolean;
};

const NAMES = 'Namen <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

export const SAT_SOURCES = {
  "esri-imagery": {
    id: "esri-imagery",
    // Location Platform, Basemap-Dienst (ibasemaps-api, zählt ins Basemap-Tiles-Freikontingent). Der Static-Basemap-Tiles-
    // Dienst hat kein reines Imagery (nur imagery/labels) → 404 im Echttest.
    url: "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token={key}",
    attribution: `Powered by <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a> | Esri, Maxar, Earthstar Geographics, and the GIS User Community · ${NAMES}`,
    maxNativeZoom: 19,
    needsKey: true,
    cacheable: false,
  },
  "eox-s2-2016": {
    id: "eox-s2-2016",
    url: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg",
    attribution: `Satellit: <a href="https://cloudless.eox.at" target="_blank" rel="noopener">EOxCloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016), <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a> · ${NAMES}`,
    maxNativeZoom: 15,
    cacheable: false,
  },
} satisfies Record<string, SatSource>;

declare const __ESRI_API_KEY__: string | undefined;
export const ESRI_API_KEY: string = typeof __ESRI_API_KEY__ === "string" ? __ESRI_API_KEY__ : "";

/** Quelle für die vom Nutzer gewählte Satellitenansicht. */
export function satSource(key: string = ESRI_API_KEY): SatSource {
  return key ? SAT_SOURCES["esri-imagery"] : SAT_SOURCES["eox-s2-2016"];
}

/** Rückfall ohne WebGL (nicht vom Nutzer gewählt) → nie kostenpflichtige/kontogebundene Quelle. */
export const SAT_FALLBACK: SatSource = SAT_SOURCES["eox-s2-2016"];

export function satTileUrl(src: SatSource, key: string = ESRI_API_KEY): string | null {
  if (!src.url.includes("{key}")) return src.url;
  if (!key) return null;
  return src.url.replace("{key}", encodeURIComponent(key));
}
