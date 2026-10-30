import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "~": path.resolve(__dirname, "./src"),
    },
  },
  // MapLibre 6 startet seinen Worker als ES-Modul; Vite muss ihn samt Abhängigkeiten bündeln.
  worker: { format: "es" },
  // Satelliten-Key nur aus der Umgebung (ESRI_API_KEY); leer → EOX-Rückfall.
  define: { __ESRI_API_KEY__: JSON.stringify(process.env.ESRI_API_KEY ?? "") },
  build: {
    outDir: "dist",
  },
});
