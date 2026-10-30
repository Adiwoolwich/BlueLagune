import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";

/**
 * Ruhige Vektor-Basiskarte (eigener Stil, abgeleitet aus OpenFreeMap Positron/OpenMapTiles-Schema).
 * Daten: OpenFreeMap / OpenStreetMap, kein API-Key, kein Konto.
 * Deutsch bevorzugt, dann lokaler Name.
 */
const NAME: ExpressionSpecification = ["coalesce", ["get", "name:de"], ["get", "name_de"], ["get", "name"], ["get", "name:latin"]];

type Pal = {
  bg: string; wood: string; park: string; water: string; waterLine: string; building: string;
  road: string; roadCase: string; major: string; majorCase: string; motorway: string; motorwayCase: string;
  rail: string; boundary: string; ink: string; inkMuted: string; halo: string; waterInk: string;
};

export const BASE_PALETTE: Record<"light" | "dark", Pal> = {
  light: {
    bg: "#efefef", wood: "#e6e8e4", park: "#e6e9e4", water: "#cfd8e0", waterLine: "#c3ced8", building: "#e2e2e2",
    road: "#ffffff", roadCase: "#dedede", major: "#ffffff", majorCase: "#d4d4d4", motorway: "#d9d9d9", motorwayCase: "#c6c6c6",
    rail: "#d2d2d2", boundary: "#b9b9c3", ink: "#393c41", inkMuted: "#5c5e62", halo: "rgba(255,255,255,0.92)", waterInk: "#5b7a99",
  },
  dark: {
    bg: "#262626", wood: "#2a2d2a", park: "#2a2e2a", water: "#1b2430", waterLine: "#22303f", building: "#303030",
    road: "#383838", roadCase: "#262626", major: "#454545", majorCase: "#2c2c2c", motorway: "#525252", motorwayCase: "#303030",
    rail: "#3a3a3a", boundary: "#5a5a66", ink: "#d4d4d8", inkMuted: "#a1a1aa", halo: "rgba(0,0,0,0.85)", waterInk: "#7d97b3",
  },
};

const lerpW = (a: number, b: number): ExpressionSpecification => ["interpolate", ["exponential", 1.4], ["zoom"], 6, a, 18, b];

export function baseStyle(scheme: "light" | "dark"): StyleSpecification {
  const p = BASE_PALETTE[scheme];
  const road = (id: string, classes: string[], color: string, w: [number, number], minzoom = 5): StyleSpecification["layers"][number] => ({
    id, type: "line", source: "openmaptiles", "source-layer": "transportation", minzoom,
    filter: ["all", ["in", ["get", "class"], ["literal", classes]], ["!=", ["get", "brunnel"], "tunnel"]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": color, "line-width": lerpW(w[0], w[1]) },
  });
  return {
    version: 8,
    name: `bl-base-${scheme}`,
    sources: {
      openmaptiles: {
        type: "vector",
        tiles: ["https://tiles.openfreemap.org/planet/bluelagune/{z}/{x}/{y}.pbf"],
        maxzoom: 14,
        attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Daten © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende',
      },
    },
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    layers: [
      { id: "bg", type: "background", paint: { "background-color": p.bg } },
      { id: "wood", type: "fill", source: "openmaptiles", "source-layer": "landcover", filter: ["in", ["get", "class"], ["literal", ["wood", "forest"]]], paint: { "fill-color": p.wood, "fill-opacity": 0.8 } },
      { id: "park", type: "fill", source: "openmaptiles", "source-layer": "park", paint: { "fill-color": p.park, "fill-opacity": 0.7 } },
      { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: { "fill-color": p.water } },
      { id: "waterway", type: "line", source: "openmaptiles", "source-layer": "waterway", minzoom: 8, paint: { "line-color": p.waterLine, "line-width": lerpW(0.5, 3) } },
      { id: "building", type: "fill", source: "openmaptiles", "source-layer": "building", minzoom: 14, paint: { "fill-color": p.building, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.5, 1] } },
      { id: "boundary", type: "line", source: "openmaptiles", "source-layer": "boundary", filter: ["all", ["<=", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]], paint: { "line-color": p.boundary, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 10, 1.4], "line-dasharray": [3, 2] } },
      { id: "rail", type: "line", source: "openmaptiles", "source-layer": "transportation", minzoom: 10, filter: ["==", ["get", "class"], "rail"], paint: { "line-color": p.rail, "line-width": lerpW(0.4, 2) } },
      road("minor-case", ["minor", "service", "track"], p.roadCase, [0.5, 14], 12),
      road("minor", ["minor", "service", "track"], p.road, [0.3, 11], 12),
      road("major-case", ["secondary", "tertiary", "primary", "trunk"], p.majorCase, [0.8, 20], 7),
      road("major", ["secondary", "tertiary", "primary", "trunk"], p.major, [0.5, 17], 7),
      road("motorway-case", ["motorway"], p.motorwayCase, [1.2, 24], 5),
      road("motorway", ["motorway"], p.motorway, [0.8, 20], 5),
      {
        id: "water-name", type: "symbol", source: "openmaptiles", "source-layer": "water_name",
        layout: { "text-field": NAME, "text-font": ["Noto Sans Italic"], "text-size": 12, "text-max-width": 6 },
        paint: { "text-color": p.waterInk, "text-halo-color": p.halo, "text-halo-width": 1.2 },
      },
      {
        id: "road-name", type: "symbol", source: "openmaptiles", "source-layer": "transportation_name", minzoom: 13,
        layout: { "symbol-placement": "line", "text-field": NAME, "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 17, 13] },
        paint: { "text-color": p.inkMuted, "text-halo-color": p.halo, "text-halo-width": 1.4 },
      },
      {
        id: "place-minor", type: "symbol", source: "openmaptiles", "source-layer": "place", minzoom: 10,
        filter: ["in", ["get", "class"], ["literal", ["village", "suburb", "hamlet"]]],
        layout: { "text-field": NAME, "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 10, 11, 15, 14], "text-max-width": 8 },
        paint: { "text-color": p.inkMuted, "text-halo-color": p.halo, "text-halo-width": 1.4 },
      },
      {
        id: "place-town", type: "symbol", source: "openmaptiles", "source-layer": "place", minzoom: 7,
        filter: ["==", ["get", "class"], "town"],
        layout: { "text-field": NAME, "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 7, 11, 14, 16], "text-max-width": 8 },
        paint: { "text-color": p.ink, "text-halo-color": p.halo, "text-halo-width": 1.5 },
      },
      {
        id: "place-city", type: "symbol", source: "openmaptiles", "source-layer": "place", minzoom: 4,
        filter: ["==", ["get", "class"], "city"],
        layout: { "text-field": NAME, "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 4, 11, 12, 18], "text-max-width": 8 },
        paint: { "text-color": p.ink, "text-halo-color": p.halo, "text-halo-width": 1.6 },
      },
      {
        id: "place-country", type: "symbol", source: "openmaptiles", "source-layer": "place", maxzoom: 7,
        filter: ["==", ["get", "class"], "country"],
        layout: { "text-field": NAME, "text-font": ["Noto Sans Bold"], "text-size": 13, "text-transform": "uppercase", "text-letter-spacing": 0.1 },
        paint: { "text-color": p.inkMuted, "text-halo-color": p.halo, "text-halo-width": 1.5 },
      },
    ],
  };
}

export const BASE_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Daten © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

export function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
