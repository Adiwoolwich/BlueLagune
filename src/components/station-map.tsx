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
import { STATUS_COLOR } from "./status-badge";

type StationProps = { id: string };

const iconCache = new Map<string, L.DivIcon>();

function pinIcon(color: string, selected: boolean) {
  const key = `drop-${color}-${selected ? "s" : "n"}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const w = selected ? 28 : 22;
  const h = selected ? 38 : 30;
  const icon = L.divIcon({
    className: `bl-marker${selected ? " is-selected" : ""}`,
    html: `<span class="bl-drop" style="--pin:${color}"><svg viewBox="0 0 24 32" width="${w}" height="${h}" aria-hidden="true"><path fill="${color}" stroke="#ffffff" stroke-width="1.7" stroke-linejoin="round" d="M12 1.5C12 1.5 3.5 12.2 3.5 19.2a8.5 8.5 0 0 0 17 0C20.5 12.2 12 1.5 12 1.5z"/><circle cx="12" cy="19.2" r="3.2" fill="#ffffff"/></svg></span>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h - 2],
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
  const w = count >= 100 ? 36 : count >= 20 ? 30 : 26;
  const h = Math.round((w * 32) / 24);
  const fs = count >= 100 ? 8 : 10;
  const icon = L.divIcon({
    className: "bl-marker bl-cluster",
    html: `<span class="bl-drop"><svg viewBox="0 0 24 32" width="${w}" height="${h}" aria-hidden="true"><path fill="#e11d2e" stroke="#ffffff" stroke-width="1.7" stroke-linejoin="round" d="M12 1.5C12 1.5 3.5 12.2 3.5 19.2a8.5 8.5 0 0 0 17 0C20.5 12.2 12 1.5 12 1.5z"/><text x="12" y="21.2" text-anchor="middle" fill="#ffffff" font-size="${fs}" font-weight="700" font-family="Inter,system-ui,sans-serif">${count}</text></svg></span>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h - 2],
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
  const filters = useAppStore((s) => s.filters);
  const query = useAppStore((s) => s.query);
  const userPos = useAppStore((s) => s.userPos);
  const routePath = useAppStore((s) => s.routePath);
  const sheet = useAppStore((s) => s.sheet);
  const radiusKm = filters.radiusKm;
  const selected = stations.find((s) => s.id === selectedId);
  const place = findCity(filters.place) ?? findCity(query) ?? null;

  useEffect(() => {
    const publish = () => {
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
    map.on("moveend", publish);
    publish();
    return () => {
      map.off("moveend", publish);
    };
  }, [map, selectedId, filters, query, setBounds, setMapView]);

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
    const color = isCampsite(s) ? "#16a34a" : STATUS_COLOR[status];
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
        <Tooltip direction="top" offset={[0, -14]} opacity={1} className="bl-map-tooltip">
          <span className="bl-map-tooltip-name">{s.name}</span>
          {placeLabel ? <span className="bl-map-tooltip-place">{placeLabel}</span> : null}
        </Tooltip>
      </Marker>
    );
  });

  if (selected && hasPreciseCoords(selected) && !selectedInView) {
    const status = deriveStatus(selected, serverToLocal(selected.id, serverReports[selected.id], reports[selected.id]));
    const color = isCampsite(selected) ? "#16a34a" : STATUS_COLOR[status];
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
        <Tooltip direction="top" offset={[0, -14]} opacity={1} className="bl-map-tooltip" permanent>
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
  useEffect(() => {
    if (!mapLabels) return;
    if (!map.getPane("bl-labels")) {
      const pane = map.createPane("bl-labels");
      pane.style.zIndex = "350";
      pane.style.pointerEvents = "none";
    }
    let disposed = false;
    let layer: L.Layer | null = null;
    void Promise.all([import("@maplibre/maplibre-gl-leaflet"), import("maplibre-gl/dist/maplibre-gl.css")]).then(([{ default: maplibreGL }]) => {
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
  }, [map, mapLabels]);
  return null;
}

const ESRI_WORLD = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_CLARITY = "https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export function StationMap({
  stations,
  initialView,
}: {
  stations: Station[];
  initialView?: MapView;
}) {
  const userPos = useAppStore((s) => s.userPos);
  const satClarity = useAppStore((s) => s.satClarity);
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
      center={center}
      zoom={zoom}
      className="h-full w-full"
      zoomControl={false}
      attributionControl
      minZoom={1}
      maxZoom={22}
    >
      <TileLayer
        attribution='Satellit &copy; <a href="https://www.esri.com/">Esri</a>, Maxar · Straßen &copy; Esri · Namen &copy; <a href="https://openfreemap.org/">OpenFreeMap</a> / OSM'
        url={satClarity ? ESRI_CLARITY : ESRI_WORLD}
        maxZoom={22}
        maxNativeZoom={19}
        detectRetina
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
        maxZoom={22}
        maxNativeZoom={19}
        detectRetina
        opacity={0.88}
      />
      <VectorLabels />
      <MapChrome stations={stations} initialView={initialView} />
      {searchOrigin && radiusKm > 0 && !routeLine ? (
        <Circle
          center={[searchOrigin.lat, searchOrigin.lng]}
          radius={radiusKm * 1000}
          pathOptions={{
            color: "#ffffff",
            weight: 1.5,
            opacity: 0.7,
            fillColor: "#14c4d4",
            fillOpacity: 0.12,
          }}
        />
      ) : null}
      {routeLine ? (
        <Polyline
          positions={routeLine}
          pathOptions={{
            color: routePath?.source === "straight" ? "#f5c84c" : "#7ef0ea",
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
