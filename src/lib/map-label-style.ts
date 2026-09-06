import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";

/** Local OSM name, then German, then Latin. Never English exonyms first. */
const NAME: ExpressionSpecification = [
  "coalesce",
  ["get", "name"],
  ["get", "name_de"],
  ["get", "name:de"],
  ["get", "name:latin"],
  ["get", "name_int"],
];

const HALO = "rgba(0,0,0,0.88)";
const INK = "#ffffff";
const MUTED = "#f4f4f5";
const WATER = "#e8f1ff";

const HALO_W = 2;

/**
 * Labels-only MapLibre style over Esri satellite.
 * OpenFreeMap / OpenMapTiles, no API key. Transparent background.
 * Tesla-near: bright ink, thick dark halo, POI + water visible on sat at z15–17.
 */
export const SAT_LABEL_STYLE: StyleSpecification = {
  version: 8,
  name: "bl-sat-labels",
  sources: {
    openmaptiles: {
      type: "vector",
      // Stable wildcard path: the same z/x/y URLs can be prefetched for offline use.
      tiles: ["https://tiles.openfreemap.org/planet/bluelagune/{z}/{x}/{y}.pbf"],
      maxzoom: 14,
    },
  },
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sprite: "https://tiles.openfreemap.org/sprites/ofm_f384/ofm",
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#000000", "background-opacity": 0 },
    },
    {
      id: "waterway-label",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "waterway",
      minzoom: 11,
      layout: {
        "symbol-placement": "line",
        "text-field": NAME,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 12, 12, 16, 14],
        "text-rotation-alignment": "map",
        "symbol-spacing": 160,
        "text-padding": 1,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": WATER,
        "text-halo-color": HALO,
        "text-halo-width": HALO_W,
      },
    },
    {
      id: "waterway-point",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "waterway",
      minzoom: 12,
      layout: {
        "symbol-placement": "point",
        "text-field": NAME,
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
        "text-max-width": 8,
        "text-padding": 0,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": WATER,
        "text-halo-color": HALO,
        "text-halo-width": HALO_W,
      },
    },
    {
      id: "water-name-line",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "water_name",
      minzoom: 10,
      layout: {
        "symbol-placement": "line",
        "text-field": NAME,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 11, 12, 16, 14],
        "text-max-width": 8,
        "symbol-spacing": 120,
        "text-padding": 1,
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": WATER,
        "text-halo-color": HALO,
        "text-halo-width": HALO_W,
      },
    },
    {
      id: "water-name-point",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "water_name",
      minzoom: 10,
      layout: {
        "symbol-placement": "point",
        "text-field": NAME,
        "text-font": ["Noto Sans Regular"],
        "text-size": 13,
        "text-max-width": 8,
        "text-padding": 1,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": WATER,
        "text-halo-color": HALO,
        "text-halo-width": HALO_W,
      },
    },
    {
      id: "poi-hotel",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "poi",
      // Overscaled z14 tiles: Liberty minzoom 15–16 can drop the layer. 0 is the bind test.
      minzoom: 0,
      filter: [
        "any",
        ["==", ["get", "class"], "lodging"],
        ["==", ["get", "subclass"], "hotel"],
      ],
      layout: {
        "symbol-placement": "point",
        "text-field": NAME,
        "text-font": ["Noto Sans Regular"],
        "text-size": 14,
        "text-anchor": "center",
        "text-optional": false,
        "text-max-width": 10,
        "text-padding": 0,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": "#f3e8ff",
        "text-halo-color": HALO,
        "text-halo-width": HALO_W,
      },
    },
    {
      id: "poi-park",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "poi",
      minzoom: 14,
      filter: ["==", ["get", "class"], "park"],
      layout: {
        "text-field": NAME,
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-anchor": "top",
        "text-offset": [0, 0.6],
        "text-optional": false,
        "text-max-width": 8,
        "text-padding": 0,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": "#d9f99d",
        "text-halo-color": HALO,
        "text-halo-width": HALO_W,
      },
    },
    {
      id: "road-minor",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "transportation_name",
      minzoom: 14,
      filter: ["match", ["get", "class"], ["minor", "service", "track", "path"], true, false],
      layout: {
        "symbol-placement": "line",
        "text-field": NAME,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 14, 12, 16, 14, 18, 15],
        "text-rotation-alignment": "map",
        "text-padding": 1,
      },
      paint: {
        "text-color": MUTED,
        "text-halo-color": HALO,
        "text-halo-width": HALO_W,
        "text-halo-blur": 0,
      },
    },
    {
      id: "road-major",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "transportation_name",
      minzoom: 11,
      filter: ["match", ["get", "class"], ["primary", "secondary", "tertiary", "trunk", "motorway"], true, false],
      layout: {
        "symbol-placement": "line",
        "text-field": NAME,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 11, 12, 14, 14, 16, 15],
        "text-rotation-alignment": "map",
      },
      paint: {
        "text-color": INK,
        "text-halo-color": HALO,
        "text-halo-width": HALO_W,
        "text-halo-blur": 0,
      },
    },
    {
      id: "place-village",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      minzoom: 9,
      maxzoom: 18,
      filter: ["match", ["get", "class"], ["village", "hamlet", "suburb", "neighbourhood"], true, false],
      layout: {
        "text-field": NAME,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 9, 11, 13, 13, 15, 14],
        "text-padding": 4,
        "text-max-width": 8,
      },
      paint: {
        "text-color": INK,
        "text-halo-color": HALO,
        "text-halo-width": HALO_W,
        "text-halo-blur": 0,
      },
    },
    {
      id: "place-town",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      minzoom: 6,
      maxzoom: 14,
      filter: ["==", ["get", "class"], "town"],
      layout: {
        "text-field": NAME,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 6, 11, 10, 14, 13, 16],
        "text-padding": 6,
        "text-max-width": 8,
      },
      paint: {
        "text-color": INK,
        "text-halo-color": HALO,
        "text-halo-width": HALO_W,
        "text-halo-blur": 0,
      },
    },
    {
      id: "place-city",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      minzoom: 4,
      maxzoom: 13,
      filter: ["==", ["get", "class"], "city"],
      layout: {
        "text-field": NAME,
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 11, 8, 15, 12, 18],
        "text-padding": 8,
        "text-max-width": 8,
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": HALO,
        "text-halo-width": 2.1,
        "text-halo-blur": 0,
      },
    },
  ],
};
