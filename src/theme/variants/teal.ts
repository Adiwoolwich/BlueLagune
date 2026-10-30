import { DESIGN_DARK, type ThemeVariant } from "../tokens";

/**
 * Teal/Wald: dunkle Graphit-/Waldkarte, Wasser in Teal, warmer Amber-Akzent für Highlights
 * (aktiver Pin, 24h, Van). Titel in Barlow Condensed (OFL-1.1, @fontsource, selbst gehostet).
 */
const t = {
  ...DESIGN_DARK,
  bg: "#0f1514",
  surface: "#141c1b",
  "surface-glass": "rgb(18 27 25 / 0.86)",
  text: "#ecf5f2",
  "text-muted": "#b2c3be",
  accent: "#2dd4bf",
  "accent-contrast": "#04201c",
  marker: "#2dd4bf",
  "marker-active": "#ffb547",
  "cluster-bg": "#173a33",
  "cluster-text": "#ecf5f2",
  "chip-bg": "#1b2624",
  "chip-text": "#ecf5f2",
  "chip-active-bg": "#2dd4bf",
  "chip-active-text": "#04201c",
  border: "#2b3d39",
  focus: "#5eead4",
  "accent-warm": "#ffb547",
  glow: "rgb(45 212 191 / 0.5)",
  "glow-active": "rgb(255 181 71 / 0.7)",
  "map-labels": "reduced",
};

export const teal: ThemeVariant = {
  name: "teal",
  forceDark: true,
  light: t,
  dark: t,
  mapPalette: {
    bg: "#121917", wood: "#15221d", park: "#15211c", water: "#0c3a38", waterLine: "#11524f", building: "#1a2220",
    road: "#1f2a27", roadCase: "#121917", major: "#2a3835", majorCase: "#141b19", motorway: "#384a43", motorwayCase: "#18201e",
    rail: "#222d2a", boundary: "#3b4f49", ink: "#c6d6d1", inkMuted: "#82968f", halo: "rgba(9,14,13,0.9)", waterInk: "#4fb3a8",
  },
  loadFonts: () => Promise.all([import("@fontsource/barlow-condensed/latin-600.css"), import("@fontsource/barlow-condensed/latin-700.css")]),
};
