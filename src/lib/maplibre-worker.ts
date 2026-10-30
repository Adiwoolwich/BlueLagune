// MapLibre 6 sucht seinen Worker neben dem eigenen Modul (maplibre-gl-worker.mjs).
// Im Vite-Build liegt der dort nicht → Worker 404 → Kacheln bleiben ewig "loading".
// Daher Worker explizit bündeln und die URL setzen (Fix für Vektorbasis und Satelliten-Labels).
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { setWorkerUrl } from "maplibre-gl";

setWorkerUrl(workerUrl);
