import { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import Supercluster from "supercluster";
import "leaflet/dist/leaflet.css";

import { SAT_LABEL_STYLE } from "@/lib/map-label-style";
import { BASE_ATTRIBUTION, baseStyle, hasWebGL } from "@/lib/map-base-style";
import { SAT_FALLBACK, satSource, satTileUrl } from "@/lib/sat-source";
import {
  deriveStatus,
  findCity,
  GERMANY_CENTER,
  hasPreciseCoords,
  type Station,
} from "@/lib/stations";
import { isCampsite, serverToLocal, useAppStore, type MapView } from "@/lib/store";
import { replaceUrl } from "@/lib/url-state";
import { t, useLang } from "@/lib/i18n";
import { CAMPSITE_COLOR, STATUS_COLOR } from "./status-badge";

type StationProps = { id: string };

const iconCache = new Map<string, L.DivIcon>();

// Eigenes Tropfen-Glyph (BlueLagune), kein fremdes Icon.
const DROP_GLYPH = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="#ffffff" d="M12 2.5S5.5 10.4 5.5 15a6.5 6.5 0 0 0 13 0C18.5 10.4 12 2.5 12 2.5z"/></svg>`;

function pinIcon(color: string, selected: boolean) {
  const key = `pin-${color}-${selected ? "s" : "n"}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  // Trefferfläche 44 px, sichtbarer Kreis 26/34 px (Tesla-Stil).
  // Ausgewählt: großer Tropfen-Pin (eigenes SVG), Spitze auf dem Ort.
  const icon = selected
    ? L.divIcon({
        className: "bl-marker is-selected",
        html: `<span class="bl-pin bl-sel" style="--pin:${color}"><svg viewBox="0 0 52 72" width="44" height="61" aria-hidden="true"><path fill="${color}" d="M26 70C26 70 3 41 3 25a23 23 0 0 1 46 0C49 41 26 70 26 70z"/><path fill="#ffffff" transform="translate(15 12) scale(0.92)" d="M12 2.5S5.5 10.4 5.5 15a6.5 6.5 0 0 0 13 0C18.5 10.4 12 2.5 12 2.5z"/></svg></span>`,
        iconSize: [44, 61],
        iconAnchor: [22, 60],
      })
    : L.divIcon({
        className: "bl-marker",
        html: `<span class="bl-pin" style="--pin:${color}">${DROP_GLYPH}</span>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
  iconCache.set(key, icon);
  return icon;
}

function locIcon(heading: number | null) {
  const deg = heading == null ? 0 : Math.round(heading / 5) * 5;
  const key = `loc-${deg}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const icon = L.divIcon({
    className: "bl-marker",
    html: `<span class="bl-loc" aria-hidden="true"><span class="bl-loc-rot" style="transform:rotate(${deg}deg)"><span class="bl-loc-chevron"></span><span class="bl-loc-dot"></span></span></span>`,
    iconSize: [28, 36],
    iconAnchor: [14, 20],
  });
  iconCache.set(key, icon);
  return icon;
}

function clusterIcon(count: number) {
  const key = `cdrop-${count}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const size = count >= 100 ? "l" : count >= 20 ? "m" : "s";
  const icon = L.divIcon({
    className: "bl-marker bl-cluster",
    html: `<span class="bl-cl bl-cl-${size}">${count}</span>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
  iconCache.set(key, icon);
  return icon;
}

function MapChrome({
  stations,
  initialView,
}: {
  stations: Station[];
  initialView?: MapView;
}) {
  const map = useMap();
  const selectedId = useAppStore((s) => s.selectedId);
  const select = useAppStore((s) => s.select);
  const setPanel = useAppStore((s) => s.setPanel);
  const setSheet = useAppStore((s) => s.setSheet);
  const setBounds = useAppStore((s) => s.setBounds);
  const setMapView = useAppStore((s) => s.setMapView);
  const markMapGesture = useAppStore((s) => s.markMapGesture);
  const filters = useAppStore((s) => s.filters);
  const query = useAppStore((s) => s.query);
  const userPos = useAppStore((s) => s.userPos);
  const routePath = useAppStore((s) => s.routePath);
  const sheet = useAppStore((s) => s.sheet);
  const radiusKm = filters.radiusKm;
  const selected = stations.find((s) => s.id === selectedId);
  const place = findCity(filters.place) ?? findCity(query) ?? null;
  const userGesture = useRef(false);

  useEffect(() => {
    const container = map.getContainer();
    const markGesture = () => {
      userGesture.current = true;
    };
    const markTouchZoom = (event: TouchEvent) => {
      if (event.touches.length > 1) markGesture();
    };
    const markKeyboardZoom = (event: KeyboardEvent) => {
      if (["+", "=", "-", "_", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) markGesture();
    };
    const publish = () => {
      if (userGesture.current) {
        userGesture.current = false;
        markMapGesture();
      }
      const b = map.getBounds();
      const c = map.getCenter();
      const zoom = map.getZoom();
      setBounds({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
      setMapView({ lat: c.lat, lng: c.lng, zoom });
      replaceUrl({
        lat: c.lat,
        lng: c.lng,
        zoom,
        id: selectedId,
        filters,
        query,
      });
    };
    map.on("dragstart", markGesture);
    map.on("moveend", publish);
    container.addEventListener("wheel", markGesture, { passive: true });
    container.addEventListener("dblclick", markGesture, { passive: true });
    container.addEventListener("touchstart", markTouchZoom, { passive: true });
    container.addEventListener("keydown", markKeyboardZoom);
    publish();
    return () => {
      map.off("dragstart", markGesture);
      map.off("moveend", publish);
      container.removeEventListener("wheel", markGesture);
      container.removeEventListener("dblclick", markGesture);
      container.removeEventListener("touchstart", markTouchZoom);
      container.removeEventListener("keydown", markKeyboardZoom);
    };
  }, [map, selectedId, filters, query, setBounds, setMapView, markMapGesture]);

  useEffect(() => {
    map.invalidateSize();
  }, [sheet, map]);

  const sheetRef = useRef(sheet);
  useEffect(() => {
    sheetRef.current = sheet;
  }, [sheet]);

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (initialView && (initialView.zoom !== 6 || Math.abs(initialView.lat - GERMANY_CENTER.lat) > 0.05)) {
      map.setView([initialView.lat, initialView.lng], initialView.zoom, { animate: false });
    }
  }, [map, initialView]);

  useEffect(() => {
    if (!selected || !hasPreciseCoords(selected)) return;
    const zoom = Math.max(map.getZoom(), 12);
    map.flyTo([selected.lat, selected.lng], zoom, { duration: 0.45 });
    const shift = () => {
      if (window.innerWidth >= 768) return;
      const currentSheet = sheetRef.current;
      const fraction = currentSheet === "full" ? 0.28 : currentSheet === "mid" ? 0.18 : 0.08;
      map.panBy([0, map.getSize().y * fraction], { animate: true, duration: 0.3 });
    };
    map.once("moveend", shift);
    return () => {
      map.off("moveend", shift);
    };
  }, [selected, map]);

  const fitKey = `${place?.name ?? ""}|${userPos?.lat ?? ""}:${userPos?.lng ?? ""}|${routePath?.from ?? ""}>${routePath?.to ?? ""}:${routePath?.source ?? ""}`;
  const prevFit = useRef("");
  useEffect(() => {
    if (selected) return;
    if (!fitKey || fitKey === "||>") return;
    if (fitKey === prevFit.current) return;
    prevFit.current = fitKey;
    const currentSheet = sheetRef.current;
    const padBottom = currentSheet === "full" ? 300 : currentSheet === "mid" ? 220 : 120;
    const fit = (bounds: L.LatLngBoundsExpression, maxZoom = 13) => {
      map.fitBounds(bounds, {
        paddingTopLeft: [36, 72],
        paddingBottomRight: [36, padBottom],
        maxZoom,
        animate: true,
        duration: 0.5,
      });
    };
    if (routePath && routePath.coords.length >= 2) {
      fit(L.latLngBounds(routePath.coords.map((p) => [p.lat, p.lng] as [number, number])), 12);
      return;
    }
    const origin = place ?? userPos;
    if (origin && radiusKm > 0) {
      const dLat = radiusKm / 111;
      const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((origin.lat * Math.PI) / 180)));
      fit([
        [origin.lat - dLat, origin.lng - dLng],
        [origin.lat + dLat, origin.lng + dLng],
      ]);
      return;
    }
    if (origin) {
      map.flyTo([origin.lat, origin.lng], 11, { duration: 0.45 });
    }
  }, [fitKey, selected, map, radiusKm, place, userPos, routePath]);

  useEffect(() => {
    const onClick = (e: L.LeafletMouseEvent) => {
      const el = e.originalEvent?.target as HTMLElement | undefined;
      if (el?.closest(".leaflet-marker-icon, .bl-marker, .bl-cluster")) return;
      select(null);
      setPanel("list");
      if (window.innerWidth < 768) setSheet("peek");
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map, select, setSheet, setPanel]);

  return null;
}

function ClusterLayer({ stations }: { stations: Station[] }) {
  useLang();
  const map = useMap();
  const selectedId = useAppStore((s) => s.selectedId);
  const select = useAppStore((s) => s.select);
  const reports = useAppStore((s) => s.reports);
  const serverReports = useAppStore((s) => s.serverReports);
  const [, setTick] = useState(0);

  const pinned = useMemo(() => stations.filter(hasPreciseCoords), [stations]);
  const byId = useMemo(() => new Map(pinned.map((s) => [s.id, s])), [pinned]);

  const index = useMemo(() => {
    const sc = new Supercluster<StationProps>({
      radius: 56,
      maxZoom: 14,
      minPoints: 2,
    });
    sc.load(
      pinned.map((s) => ({
        type: "Feature" as const,
        properties: { id: s.id },
        geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] as [number, number] },
      })),
    );
    return sc;
  }, [pinned]);

  useEffect(() => {
    let frame: number | null = null;
    const bump = () => {
      if (frame != null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        setTick((n) => n + 1);
      });
    };
    map.on("moveend zoomend", bump);
    return () => {
      map.off("moveend zoomend", bump);
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [map]);

  const b = map.getBounds();
  const zoom = Math.round(map.getZoom());
  const clusters = index.getClusters([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom);

  const selected = selectedId ? byId.get(selectedId) : undefined;
  let selectedInView = false;

  const nodes = clusters.map((f) => {
    const [lng, lat] = f.geometry.coordinates;
    const props = f.properties as StationProps & { cluster?: boolean; cluster_id?: number; point_count?: number };
    if (props.cluster && props.cluster_id != null) {
      const count = props.point_count ?? 0;
      const cid = props.cluster_id;
      return (
        <Marker
          key={`c-${cid}`}
          position={[lat, lng]}
          icon={clusterIcon(count)}
          eventHandlers={{
            click: (e) => {
              L.DomEvent.stopPropagation(e.originalEvent);
              const exp = index.getClusterExpansionZoom(cid);
              map.setView([lat, lng], exp, { animate: true });
            },
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} opacity={1} className="bl-map-tooltip">
            <span className="bl-map-tooltip-name">{t("clusterN", { n: count })}</span>
          </Tooltip>
        </Marker>
      );
    }
    const s = byId.get(props.id);
    if (!s) return null;
    if (s.id === selectedId) selectedInView = true;
    const status = deriveStatus(s, serverToLocal(s.id, serverReports[s.id], reports[s.id]));
    const color = isCampsite(s) ? CAMPSITE_COLOR : STATUS_COLOR[status];
    const placeLabel = [s.postalCode, s.city].filter(Boolean).join(" ");
    return (
      <Marker
        key={s.id}
        position={[s.lat, s.lng]}
        icon={pinIcon(color, s.id === selectedId)}
        eventHandlers={{
          click: (e) => {
            L.DomEvent.stopPropagation(e.originalEvent);
            select(s.id);
          },
        }}
        zIndexOffset={s.id === selectedId ? 1000 : 0}
      >
        <Tooltip direction="top" offset={[0, -18]} opacity={1} className="bl-map-tooltip">
          <span className="bl-map-tooltip-name">{s.name}</span>
          {placeLabel ? <span className="bl-map-tooltip-place">{placeLabel}</span> : null}
        </Tooltip>
      </Marker>
    );
  });

  if (selected && hasPreciseCoords(selected) && !selectedInView) {
    const status = deriveStatus(selected, serverToLocal(selected.id, serverReports[selected.id], reports[selected.id]));
    const color = isCampsite(selected) ? CAMPSITE_COLOR : STATUS_COLOR[status];
    nodes.push(
      <Marker
        key={`sel-${selected.id}`}
        position={[selected.lat, selected.lng]}
        icon={pinIcon(color, true)}
        eventHandlers={{
          click: (e) => {
            L.DomEvent.stopPropagation(e.originalEvent);
            select(selected.id);
          },
        }}
        zIndexOffset={2000}
      >
        <Tooltip direction="top" offset={[0, -58]} opacity={1} className="bl-map-tooltip" permanent>
          <span className="bl-map-tooltip-name">{selected.name}</span>
        </Tooltip>
      </Marker>,
    );
  }

  return <>{nodes}</>;
}


function VectorLabels() {
  const map = useMap();
  const mapLabels = useAppStore((s) => s.mapLabels);
  const mapStyle = useAppStore((s) => s.mapStyle);
  useEffect(() => {
    if (!mapLabels || mapStyle !== "sat" || !hasWebGL()) return;
    if (!map.getPane("bl-labels")) {
      const pane = map.createPane("bl-labels");
      pane.style.zIndex = "350";
      pane.style.pointerEvents = "none";
    }
    let disposed = false;
    let layer: L.Layer | null = null;
    void Promise.all([import("@maplibre/maplibre-gl-leaflet"), import("maplibre-gl/dist/maplibre-gl.css"), import("@/lib/maplibre-worker")]).then(([{ default: maplibreGL }]) => {
      if (disposed) return;
      const nextLayer = maplibreGL({
        style: SAT_LABEL_STYLE,
        interactive: false,
        attributionControl: false,
        pane: "bl-labels",
        // MapLibre 6 default (4) splits tiles above source maxzoom 14 and
        // fetches empty z15 OpenFreeMap 200s. 8 keeps covering at z14 overscale.
        zoomLevelsToOverscale: 8,
      });
      layer = nextLayer;
      nextLayer.addTo(map);
      const canvas = nextLayer.getContainer();
      if (canvas) canvas.style.pointerEvents = "none";
    }).catch(() => {});
    return () => {
      disposed = true;
      if (layer) map.removeLayer(layer);
    };
  }, [map, mapLabels, mapStyle]);
  return null;
}

/** Gestochen scharfe Vektor-Basiskarte (MapLibre GL, WebGL, rendert mit devicePixelRatio). */
function VectorBase({ dark, onFail }: { dark: boolean; onFail: () => void }) {
  const map = useMap();
  useEffect(() => {
    let disposed = false;
    let layer: L.Layer | null = null;
    void Promise.all([import("@maplibre/maplibre-gl-leaflet"), import("maplibre-gl/dist/maplibre-gl.css"), import("@/lib/maplibre-worker")]).then(([{ default: maplibreGL }]) => {
      if (disposed) return;
      try {
        const next = maplibreGL({
          style: baseStyle(dark ? "dark" : "light"),
          interactive: false,
          attribution: BASE_ATTRIBUTION,
          attributionControl: false,
          zoomLevelsToOverscale: 8,
        } as Parameters<typeof maplibreGL>[0]);
        layer = next;
        if (import.meta.env.VITE_BL_DEBUG) (window as unknown as Record<string, unknown>).__blgl = next;
        next.addTo(map);
        map.attributionControl?.addAttribution(BASE_ATTRIBUTION);
        const gl = (next as unknown as { getMaplibreMap?: () => { on: (e: string, f: (ev: { error?: Error }) => void) => void } }).getMaplibreMap?.();
        gl?.on("error", (ev) => {
          // Einzelne fehlende Kacheln ignorieren; nur Kontextverlust → Fallback.
          if (ev?.error && /webgl/i.test(String(ev.error.message))) onFail();
        });
        const canvas = next.getContainer();
        if (canvas) {
          canvas.dataset.blVector = "1";
          canvas.addEventListener("webglcontextlost", onFail);
        }
      } catch {
        onFail();
      }
    }).catch(onFail);
    return () => {
      disposed = true;
      map.attributionControl?.removeAttribution(BASE_ATTRIBUTION);
      if (layer) map.removeLayer(layer);
    };
  }, [map, dark, onFail]);
  return null;
}

function useDarkScheme() {
  const q = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => typeof matchMedia === "function" && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setDark(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return dark;
}

function useOnline() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine !== false);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  return online;
}

export function StationMap({
  stations,
  initialView,
}: {
  stations: Station[];
  initialView?: MapView;
}) {
  const userPos = useAppStore((s) => s.userPos);
  const mapStyle = useAppStore((s) => s.mapStyle);
  const dark = useDarkScheme();
  const online = useOnline();
  const [glOk, setGlOk] = useState(() => hasWebGL());
  const onGlFail = useMemo(() => () => setGlOk(false), []);
  // Satellit auf Wunsch oder als Fallback ohne WebGL (EOX Sentinel-2 cloudless 2016, CC BY 4.0).
  // Offline nur die gespeicherte Vektorkarte (OpenFreeMap); Satellit gibt es offline nicht.
  const userSat = online && mapStyle === "sat";
  const sat = userSat || (online && !glOk);
  // Gewählte Quelle (Esri mit Key, sonst EOX) nur bei Nutzerwahl; Rückfall ohne WebGL immer EOX.
  const satSrc = userSat ? satSource() : SAT_FALLBACK;
  const satUrl = satTileUrl(satSrc) ?? satTileUrl(SAT_FALLBACK)!;
  const [heading, setHeading] = useState<number | null>(null);
  useEffect(() => {
    const onOri = (e: DeviceOrientationEvent) => {
      const w = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
      let h: number | null = null;
      if (typeof w.webkitCompassHeading === "number") h = w.webkitCompassHeading;
      else if (typeof e.alpha === "number") h = (360 - e.alpha) % 360;
      if (h != null && Number.isFinite(h)) setHeading(h);
    };
    window.addEventListener("deviceorientation", onOri);
    return () => window.removeEventListener("deviceorientation", onOri);
  }, []);
  const routePath = useAppStore((s) => s.routePath);
  const placeName = useAppStore((s) => s.filters.place);
  const query = useAppStore((s) => s.query);
  const radiusKm = useAppStore((s) => s.filters.radiusKm);
  const place = findCity(placeName) ?? findCity(query) ?? null;
  const searchOrigin = place ?? userPos;
  const center: [number, number] = initialView
    ? [initialView.lat, initialView.lng]
    : [GERMANY_CENTER.lat, GERMANY_CENTER.lng];
  const zoom = initialView?.zoom ?? 6;
  const routeLine = useMemo(() => {
    if (!routePath?.coords.length) return null;
    return routePath.coords.map((p) => [p.lat, p.lng] as [number, number]);
  }, [routePath]);

  return (
    <MapContainer
      ref={(m) => { if (m) installAttrToggle(m); }}
      center={center}
      zoom={zoom}
      className="h-full w-full"
      zoomControl={false}
      attributionControl
      minZoom={1}
      maxZoom={22}
    >
      {sat ? (
        <TileLayer
          key={satSrc.id}
          attribution={satSrc.attribution}
          url={satUrl}
          maxZoom={22}
          maxNativeZoom={satSrc.maxNativeZoom}
          tileSize={satSrc.tileSize ?? 256}
          zoomOffset={satSrc.zoomOffset ?? 0}
          detectRetina={!satSrc.tileSize}
          className="bl-sat"
        />
      ) : (
        <VectorBase dark={dark} onFail={onGlFail} />
      )}
      <VectorLabels />
      <MapChrome stations={stations} initialView={initialView} />
      {searchOrigin && radiusKm > 0 && !routeLine ? (
        <Circle
          center={[searchOrigin.lat, searchOrigin.lng]}
          radius={radiusKm * 1000}
          pathOptions={{
            color: "#1f5fd1",
            weight: 1.5,
            opacity: 0.6,
            fillColor: "#1f5fd1",
            fillOpacity: 0.06,
          }}
        />
      ) : null}
      {routeLine ? (
        <Polyline
          positions={routeLine}
          pathOptions={{
            color: routePath?.source === "straight" ? "#b45309" : "#1f5fd1",
            weight: 5,
            opacity: 0.92,
          }}
        />
      ) : null}
      {userPos ? (
        <Marker position={[userPos.lat, userPos.lng]} icon={locIcon(heading)} zIndexOffset={800} />
      ) : null}
      <ClusterLayer stations={stations} />
    </MapContainer>
  );
}

/** ⓘ neben der Attribution: klappt die einzeilige Mobil-Attribution vollständig auf. */
function installAttrToggle(map: L.Map) {
  const m = map as L.Map & { _blAttrToggle?: boolean };
  if (m._blAttrToggle) return;
  m._blAttrToggle = true;
  const Ctl = L.Control.extend({
    onAdd() {
      const b = L.DomUtil.create("button", "bl-attr-toggle leaflet-control") as HTMLButtonElement;
      b.type = "button";
      b.textContent = "ⓘ";
      b.setAttribute("data-bl-attr-toggle", "");
      b.setAttribute("aria-label", "Quellen / Attribution");
      b.setAttribute("aria-expanded", "false");
      L.DomEvent.disableClickPropagation(b);
      L.DomEvent.on(b, "click", () => {
        const corner = b.parentElement;
        const open = !corner?.classList.contains("bl-attr-open");
        corner?.classList.toggle("bl-attr-open", open);
        b.setAttribute("aria-expanded", String(open));
      });
      return b;
    },
  });
  new Ctl({ position: "bottomright" }).addTo(map);
}
