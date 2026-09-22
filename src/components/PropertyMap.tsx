"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

/**
 * Property hero map (Mapbox Standard, monochrome, 3D buildings): flies in to the address, outlines the cadastral
 * parcel in the signal color, and follows the site's light/dark theme. mapbox-gl is loaded only when the map
 * scrolls into view. Renders nothing without a token. The token is read on the server at request time and passed
 * in, so a runtime env var is enough (a NEXT_PUBLIC_ value would otherwise be frozen at build time).
 */
export default function PropertyMap({ token, lat, lon, label, parcel, className, children }: {
  token: string | undefined; lat: number; lon: number; label: string; parcel: string | null; className: string; children?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || !token) return;
    let map: import("mapbox-gl").Map | undefined;
    let cancelled = false;
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const signal = getComputedStyle(document.documentElement).getPropertyValue("--signal").trim() || "#ff4a1c";

    const start = async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      mapboxgl.accessToken = token;
      map = new mapboxgl.Map({
        container: el,
        style: "mapbox://styles/mapbox/standard",
        config: {
          basemap: {
            theme: "monochrome",
            lightPreset: dark.matches ? "night" : "day",
            showPointOfInterestLabels: false,
            showTransitLabels: false,
            show3dObjects: true,
          },
        },
        center: [lon, lat],
        zoom: reduced ? 17.2 : 13,
        pitch: reduced ? 55 : 0,
        bearing: reduced ? -20 : 0,
        antialias: true,
        cooperativeGestures: true, // no scroll trap: ctrl/⌘ + wheel, two fingers on touch
        attributionControl: true,
        locale: { "ScrollZoomBlocker.CtrlMessage": "Ctrl + molette pour zoomer", "ScrollZoomBlocker.CmdMessage": "⌘ + molette pour zoomer", "TouchPanBlocker.Message": "Deux doigts pour déplacer la carte" },
      });
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true, showCompass: true }), "top-right");

      map.on("style.load", () => {
        if (!map) return;
        if (parcel) {
          map.addSource("parcel", { type: "geojson", data: { type: "Feature", properties: {}, geometry: JSON.parse(parcel) } });
          // slot "middle": above roads, below 3D buildings and labels (Mapbox Standard slots)
          map.addLayer({ id: "parcel-fill", type: "fill", source: "parcel", slot: "middle", paint: { "fill-color": signal, "fill-opacity": 0.28, "fill-emissive-strength": 1 } });
          map.addLayer({ id: "parcel-line", type: "line", source: "parcel", slot: "middle", paint: { "line-color": signal, "line-width": 3.5, "line-emissive-strength": 1 } });
        }
        const pin = document.createElement("div");
        pin.className = "loila-pin";
        pin.setAttribute("aria-hidden", "true");
        new mapboxgl.Marker({ element: pin, anchor: "center" }).setLngLat([lon, lat]).addTo(map);
        setReady(true);
        // The hero text covers the lower part of the map: keep the address in the visible upper part.
        const padding = { top: 40, bottom: Math.round(el.clientHeight * 0.4), left: 0, right: 0 };
        map.setPadding(padding);
        if (!reduced) {
          map.flyTo({ center: [lon, lat], zoom: 17.2, pitch: 58, bearing: -22, duration: 4200, curve: 1.6, padding, essential: false });
          // A slow quarter turn once arrived, stopped by any user interaction.
          map.once("moveend", () => {
            if (!map) return;
            map.easeTo({ bearing: 20, duration: 24000, easing: (t) => t });
            const stop = () => map?.stop();
            map.once("mousedown", stop);
            map.once("touchstart", stop);
            map.once("wheel", stop);
          });
        }
      });

      const onTheme = (e: MediaQueryListEvent) => map?.setConfigProperty("basemap", "lightPreset", e.matches ? "night" : "day");
      dark.addEventListener("change", onTheme);
      map.once("remove", () => dark.removeEventListener("change", onTheme));
    };

    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        void start();
      }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      map?.remove();
    };
  }, [token, lat, lon, parcel]);

  if (!token) return null;
  return (
    <div className="relative">
      <div ref={box} role="region" aria-label={`Carte : ${label}${parcel ? ", contour de la parcelle cadastrale" : ""}`} className={`bg-surface ${className}`} />
      {!ready && (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="font-mono text-xs uppercase tracking-wide text-fg-2">Chargement de la carte…</span>
        </div>
      )}
      {children}
    </div>
  );
}
