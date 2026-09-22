"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { BASE, palette } from "@/components/PropertyMap";

type Section = { code: string; median: number; sales: number };

// Sequential single-hue ramps, cheap → expensive (validated: dataviz validate_palette.js --ordinal, each mode).
const RAMP = { light: ["#ff8d61", "#f76a38", "#dd4a1a", "#b0360e", "#731c05"], dark: ["#a33512", "#cf4516", "#f2622f", "#ff9468", "#ffc6ad"] };
const eur = (n: number) => `${n.toLocaleString("fr-FR")} €`;
const CADASTRE = (commune: string) => `https://cadastre.data.gouv.fr/bundler/cadastre-etalab/communes/${commune}/geojson/sections`;

/**
 * Choropleth of the price per m² by cadastral section. Outlines: cadastre Etalab (fetched in the browser, CORS open);
 * prices: DVF statistics pooled over three years, passed in by the page. Loaded only when scrolled into view.
 */
export default function PriceMap({ token, communes, focus, sections, breaks, kind }: {
  token: string | undefined; communes: string[]; focus: string; sections: Section[]; breaks: number[]; kind: string; // focus "" = frame them all
}) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "ready" | "error">("idle");
  const [dark, setDark] = useState(false);
  const [hover, setHover] = useState<{ code: string; median: number | null; sales: number | null; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || !token || breaks.length !== 4) return;
    let map: import("mapbox-gl").Map | undefined;
    let cancelled = false;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const byCode = new Map(sections.map((s) => [s.code, s]));
    const colorExpr = (isDark: boolean) => {
      const r = isDark ? RAMP.dark : RAMP.light;
      return ["step", ["get", "price"], r[0], breaks[0], r[1], breaks[1], r[2], breaks[2], r[3], breaks[3], r[4]] as unknown as import("mapbox-gl").ExpressionSpecification;
    };

    const start = async () => {
      const [mapboxgl, geo] = await Promise.all([
        import("mapbox-gl").then((m) => m.default),
        Promise.all(communes.map((c) => fetch(CADASTRE(c)).then((r) => (r.ok ? r.json() : { features: [] })).catch(() => ({ features: [] })))),
      ]);
      if (cancelled) return;
      setDark(mq.matches);
      type Feat = { id?: string | number; type: "Feature"; geometry: { type: string; coordinates?: unknown }; properties: Record<string, unknown> };
      const features: Feat[] = geo.flatMap((g: { features: Feat[] }) => g.features).map((f, i) => {
        const s = byCode.get(String(f.properties.id));
        return { ...f, id: i, properties: { code: String(f.properties.id), commune: String(f.properties.commune), price: s?.median ?? null, sales: s?.sales ?? null } };
      });
      if (!features.length) { setState("error"); return; }

      mapboxgl.accessToken = token;
      map = new mapboxgl.Map({
        container: el,
        style: "mapbox://styles/mapbox/standard",
        config: { basemap: { ...BASE, ...palette(mq.matches), show3dObjects: false } },
        center: [2.35, 48.86],
        zoom: 11,
        cooperativeGestures: true,
        language: "fr",
        locale: { "ScrollZoomBlocker.CtrlMessage": "Ctrl + molette pour zoomer", "ScrollZoomBlocker.CmdMessage": "⌘ + molette pour zoomer", "TouchPanBlocker.Message": "Deux doigts pour déplacer la carte" },
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

      map.on("style.load", () => {
        if (!map) return;
        map.addSource("sections", { type: "geojson", data: { type: "FeatureCollection", features } as never });
        map.addLayer({
          id: "sections-fill", type: "fill", source: "sections", slot: "middle", filter: ["!=", ["get", "price"], null],
          paint: { "fill-color": colorExpr(mq.matches), "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.95, mq.matches ? 0.85 : 0.72], "fill-emissive-strength": 1 },
        });
        map.addLayer({
          id: "sections-line", type: "line", source: "sections", slot: "middle",
          paint: {
            "line-color": ["case", ["boolean", ["feature-state", "hover"], false], mq.matches ? "#f4f0e8" : "#0e0e0e", mq.matches ? "rgba(14,14,14,0.6)" : "rgba(255,253,248,0.85)"],
            "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 2.5, ["==", ["get", "commune"], focus], 0.8, 0.4],
            "line-emissive-strength": 1,
          },
        });
        // Frame the page's commune.
        const bounds = new mapboxgl.LngLatBounds();
        const extend = (c: unknown): void => { if (Array.isArray(c) && typeof c[0] === "number") bounds.extend(c as [number, number]); else if (Array.isArray(c)) c.forEach(extend); };
        for (const f of features) if ((!focus || f.properties.commune === focus) && "coordinates" in f.geometry) extend(f.geometry.coordinates);
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 32, duration: 0 });

        let hovered: number | string | undefined; // feature ids are the indexes set above
        map.on("mousemove", "sections-fill", (e) => {
          const f = e.features?.[0] as unknown as { id?: number | string; properties?: Record<string, unknown> } | undefined;
          if (!map || !f || f.id == null) return;
          if (hovered != null) map.setFeatureState({ source: "sections", id: hovered }, { hover: false });
          hovered = f.id;
          map.setFeatureState({ source: "sections", id: hovered }, { hover: true });
          map.getCanvas().style.cursor = "pointer";
          setHover({ code: String(f.properties?.code), median: (f.properties?.price as number) ?? null, sales: (f.properties?.sales as number) ?? null, x: e.point.x, y: e.point.y });
        });
        map.on("mouseleave", "sections-fill", () => {
          if (map && hovered != null) map.setFeatureState({ source: "sections", id: hovered }, { hover: false });
          hovered = undefined;
          if (map) map.getCanvas().style.cursor = "";
          setHover(null);
        });
        setState("ready");
      });

      const onTheme = (e: MediaQueryListEvent) => {
        setDark(e.matches);
        for (const [key, value] of Object.entries(palette(e.matches))) map?.setConfigProperty("basemap", key, value);
        map?.setConfigProperty("basemap", "show3dObjects", false);
        if (map?.getLayer("sections-fill")) {
          map.setPaintProperty("sections-fill", "fill-color", colorExpr(e.matches));
          map.setPaintProperty("sections-fill", "fill-opacity", ["case", ["boolean", ["feature-state", "hover"], false], 0.95, e.matches ? 0.85 : 0.72]);
        }
      };
      mq.addEventListener("change", onTheme);
      map.once("remove", () => mq.removeEventListener("change", onTheme));
    };

    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); void start(); }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); map?.remove(); };
  }, [token, communes, focus, sections, breaks]);

  if (!token || breaks.length !== 4) return null;
  const ramp = dark ? RAMP.dark : RAMP.light;
  const ranges = [`< ${eur(breaks[0])}`, `${eur(breaks[0])} – ${eur(breaks[1])}`, `${eur(breaks[1])} – ${eur(breaks[2])}`, `${eur(breaks[2])} – ${eur(breaks[3])}`, `> ${eur(breaks[3])}`];

  return (
    <figure className="border-2 border-ink bg-surface shadow-[5px_5px_0_0_var(--fg)]">
      <div className="relative">
        <div ref={box} role="region" aria-label={`Carte du prix au m² des ${kind} par section cadastrale`} className="h-[clamp(22rem,60vh,36rem)] w-full" />
        {state !== "ready" && (
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="font-mono text-xs uppercase tracking-wide text-fg-2">{state === "error" ? "Contours cadastraux indisponibles" : "Chargement de la carte…"}</span>
          </div>
        )}
        {hover && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 border-2 border-ink bg-bg px-3 py-2 text-sm shadow-[3px_3px_0_0_var(--fg)]"
            style={{ left: hover.x + 14, top: hover.y + 14 }}
          >
            <p className="font-mono text-xs text-fg-2">Section {hover.code.slice(-2)} · {hover.code.slice(0, 5)}</p>
            <p className="font-display text-lg font-extrabold">{hover.median ? `${eur(hover.median)}/m²` : "Trop peu de ventes"}</p>
            {hover.sales ? <p className="font-mono text-xs text-fg-2">{hover.sales} ventes sur 3 ans</p> : null}
          </div>
        )}
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t-2 border-ink px-4 py-3 font-mono text-xs">
        <span className="uppercase tracking-wide text-fg-2">Prix médian au m² · {kind}</span>
        {ramp.map((c, i) => (
          <span key={c} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-3 border border-ink/30" style={{ background: c }} />
            {ranges[i]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
