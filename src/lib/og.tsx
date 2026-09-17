import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clip } from "./seo";
import { THEMES } from "./themes";

const THEME_CODES = Object.fromEntries(THEMES.map((t) => [t.slug, t.codes as readonly string[]]));

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const INK = "#0E0E0E";
const PAPER = "#F4F0E8";
const SIGNAL = "#FF4A1C";
export const THEME_COLORS: Record<string, string> = {
  travail: "#FFD23F",
  urbanisme: "#8FD3A8",
  logement: "#9DC4FF",
  conventions: "#FFB0C4",
  copropriete: "#C4B5FD",
  construction: "#7FDBDA",
};

// Static instances (satori cannot pick weights inside variable fonts). OFL, see src/assets/fonts/OFL-*.txt
let fonts: { name: string; data: Buffer; weight: 500 | 700 | 800 | 400; style: "normal" | "italic" }[] | undefined;
function loadFonts() {
  const f = (file: string) => readFileSync(join(process.cwd(), "src/assets/fonts", file));
  return (fonts ??= [
    { name: "Bricolage", data: f("BricolageGrotesque-ExtraBold.ttf"), weight: 800, style: "normal" },
    { name: "Instrument", data: f("InstrumentSerif-Italic.ttf"), weight: 400, style: "italic" },
    { name: "Inter", data: f("Inter-Medium.ttf"), weight: 500, style: "normal" },
    { name: "Inter", data: f("Inter-Bold.ttf"), weight: 700, style: "normal" },
  ]);
}

/**
 * Pick the biggest font size whose greedy word-wrap fits in `maxLines`; otherwise truncate on a word boundary.
 * ponytail: width estimated from char count (avg glyph ≈ 0.45em for Bricolage ExtraBold), swap for real
 * glyph metrics via opentype if a headline ever overflows.
 */
export function fitHeadline(text: string, width: number, sizes: number[], maxLines = 3, em = 0.45) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const wrap = (size: number) => {
    const perLine = Math.floor(width / (size * em));
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (next.length > perLine && cur) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return { lines, perLine };
  };
  for (const size of sizes) {
    const { lines, perLine } = wrap(size);
    if (lines.length <= maxLines && lines.every((l) => l.length <= perLine)) return { size, text: lines.join(" ") };
  }
  const size = sizes[sizes.length - 1];
  const { lines } = wrap(size);
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = kept[maxLines - 1].replace(/\s+\S*$/, "").replace(/[\s,;:.–—-]+$/, "") + "…";
  return { size, text: kept.join(" ") };
}

/** Split off the last word(s) (≥ 5 letters, trailing "?" included) to set them in the serif italic accent. */
function accent(text: string): [string, string] {
  const words = text.split(" ");
  let i = words.length;
  while (i > 1 && words.slice(i).join("").replace(/[^\p{L}]/gu, "").length < 5) i--;
  return i > 0 && i < words.length ? [words.slice(0, i).join(" "), words.slice(i).join(" ")] : [text, ""];
}

export type OgInput =
  | { kind: "home" }
  | { kind: "theme"; theme: string; title: string; tagline: string }
  | { kind: "faq"; theme: string; themeTitle: string; question: string }
  | { kind: "article"; num: string; code: string; theme?: string }
  | { kind: "topic"; title: string; label: string; theme?: string };

const labelStyle = { fontFamily: "Inter", fontWeight: 700, fontSize: 22, letterSpacing: "0.14em", textTransform: "uppercase" } as const;
const display = { fontFamily: "Bricolage", fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 0.95, color: INK } as const;

function Chip({ children, bg = PAPER }: { children: React.ReactNode; bg?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, border: `2px solid ${INK}`, borderRadius: 999, background: bg, padding: "8px 20px", color: INK, ...labelStyle, fontSize: 18 }}>
      {children}
    </div>
  );
}

const Dot = ({ size = 14 }: { size?: number }) => <div style={{ width: size, height: size, borderRadius: size, background: SIGNAL, display: "flex" }} />;

function Footer({ dark = false }: { dark?: boolean }) {
  const c = dark ? PAPER : INK;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", fontFamily: "Bricolage", fontWeight: 800, fontSize: 48, letterSpacing: "-0.05em", color: c }}>
        <span>Loilà</span>
        <span style={{ color: SIGNAL }}>.</span>
      </div>
      <div style={{ display: "flex", fontFamily: "Inter", fontWeight: 500, fontSize: 24, color: c, letterSpacing: "0.02em" }}>loila.fr</div>
    </div>
  );
}

const serif = { fontFamily: "Instrument", fontStyle: "italic", fontWeight: 400, letterSpacing: "-0.02em" } as const;

/** Satori has no inline layout: lay words out as wrapping flex items so fonts can mix within a line. */
function Words({ head, tail, size, width, tailColor = INK }: { head: string; tail: string; size: number; width: number; tailColor?: string }) {
  const words = head.split(" ").filter(Boolean);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", ...display, fontSize: size, width }}>
      {words.map((w, i) => (
        <span key={i} style={{ marginRight: size * 0.22 }}>{w}</span>
      ))}
      {tail && <span style={{ ...serif, color: tailColor }}>{tail}</span>}
    </div>
  );
}

function Headline({ text, width, sizes, lines = 3 }: { text: string; width: number; sizes: number[]; lines?: number }) {
  const fit = fitHeadline(text, width, sizes, lines);
  const [head, tail] = accent(fit.text);
  return <Words head={head} tail={tail} size={fit.size} width={width} />;
}

function Frame({ children, band }: { children: React.ReactNode; band?: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, color: INK }}>
      {band && <div style={{ display: "flex", width: 40, height: "100%", background: band, borderRight: `2px solid ${INK}` }} />}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "52px 64px 44px" }}>{children}</div>
    </div>
  );
}

function Template(input: OgInput) {
  switch (input.kind) {
    case "home":
      return (
        <Frame>
          <div style={{ display: "flex", alignItems: "center", gap: 14, ...labelStyle }}>
            <Dot />
            <span>Loi + voilà · Droit français</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Words head="Le droit français, enfin" tail="lisible." size={132} width={1072} tailColor={SIGNAL} />
            <div style={{ display: "flex", gap: 12, marginTop: 34 }}>
              {Object.entries(THEME_COLORS).map(([slug, bg]) => (
                <Chip key={slug} bg={bg}>{slug}</Chip>
              ))}
            </div>
          </div>
          <Footer />
        </Frame>
      );
    case "theme": {
      const bg = THEME_COLORS[input.theme] ?? SIGNAL;
      return (
        <Frame>
          <div style={{ display: "flex", alignItems: "center", gap: 14, ...labelStyle }}>
            <Dot />
            <span>Thème · Droit expliqué simplement</span>
          </div>
          <div style={{ display: "flex", position: "relative", width: 1060, marginTop: 8 }}>
            <div style={{ position: "absolute", left: 14, top: 14, width: 1046, height: "100%", background: INK, borderRadius: 28, display: "flex" }} />
            <div style={{ display: "flex", flexDirection: "column", width: 1046, background: bg, border: `2px solid ${INK}`, borderRadius: 28, padding: "40px 48px" }}>
              <Headline text={input.title} width={946} sizes={[128, 112, 96, 84]} lines={2} />
              <div style={{ display: "flex", fontFamily: "Inter", fontWeight: 500, fontSize: 30, marginTop: 20, color: INK }}>{input.tagline}</div>
            </div>
          </div>
          <Footer />
        </Frame>
      );
    }
    case "faq": {
      const bg = THEME_COLORS[input.theme] ?? SIGNAL;
      return (
        <Frame band={bg}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, ...labelStyle }}>
              <Dot />
              <span>{`${input.themeTitle} · Question`}</span>
            </div>
            <Chip bg={bg}>Réponse sourcée Légifrance</Chip>
          </div>
          <Headline text={input.question} width={1030} sizes={[112, 100, 90, 80, 72, 64]} />
          <Footer />
        </Frame>
      );
    }
    case "article": {
      const bg = (input.theme && THEME_COLORS[input.theme]) || THEME_COLORS.travail;
      const size = input.num.length <= 8 ? 196 : 150;
      return (
        <Frame>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, ...labelStyle }}>
              <div style={{ display: "flex", width: 40, height: 3, background: SIGNAL }} />
              <span>Texte officiel · Article</span>
            </div>
            <Chip bg={bg}>Légifrance</Chip>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: "Instrument", fontStyle: "italic", fontSize: 64, lineHeight: 1, color: INK }}>Article</div>
            {input.num.length <= 12 ? (
              <div style={{ display: "flex", ...display, fontSize: size, lineHeight: 0.9, marginTop: 4 }}>{input.num}</div>
            ) : (
              <Headline text={input.num} width={1072} sizes={[96, 84, 72, 62]} lines={2} />
            )}
            <div style={{ display: "flex", marginTop: 26 }}>
              <div style={{ display: "flex", background: bg, border: `2px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`, padding: "10px 20px", fontFamily: "Inter", fontWeight: 700, fontSize: 28, maxWidth: 1060 }}>
                {clip(input.code, 62)}
              </div>
            </div>
          </div>
          <Footer />
        </Frame>
      );
    }
    case "topic": {
      const bg = (input.theme && THEME_COLORS[input.theme]) || SIGNAL;
      return (
        <Frame band={bg}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, ...labelStyle }}>
            <Dot />
            <span>{input.label}</span>
          </div>
          <Headline text={input.title} width={1030} sizes={[120, 108, 96, 86, 76, 66]} />
          <Footer />
        </Frame>
      );
    }
  }
}

export function renderOg(input: OgInput) {
  return new ImageResponse(<Template {...input} />, { ...OG_SIZE, fonts: loadFonts() });
}

/** Wordmark "Loilà." for emails (2x for retina; displayed at half size). */
export function renderWordmark() {
  const h = 120;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: PAPER }}>
        <div style={{ display: "flex", alignItems: "baseline", fontFamily: "Bricolage", fontWeight: 800, fontSize: h * 0.8, lineHeight: 1, color: INK, letterSpacing: "-0.05em" }}>
          Loilà<div style={{ display: "flex", width: h * 0.16, height: h * 0.16, borderRadius: h, background: SIGNAL, marginLeft: h * 0.03 }} />
        </div>
      </div>
    ),
    { width: 300, height: h, fonts: loadFonts().slice(0, 1) },
  );
}

/** Brand mark: ink tile, paper "L", vermilion dot. */
export function renderIcon(px: number, padded = false) {
  const r = padded ? 0 : px * 0.22;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: INK, borderRadius: r }}>
        <div style={{ display: "flex", alignItems: "baseline", fontFamily: "Bricolage", fontWeight: 800, fontSize: px * 0.78, lineHeight: 1, color: PAPER, letterSpacing: "-0.06em", marginTop: -px * 0.08 }}>
          L<div style={{ display: "flex", width: px * 0.19, height: px * 0.19, borderRadius: px, background: SIGNAL, marginLeft: px * 0.02 }} />
        </div>
      </div>
    ),
    { width: px, height: px, fonts: loadFonts().slice(0, 1) },
  );
}

/** Topic card; `theme` colour comes from the topic's legal codes when they map to a theme. */
export function topicOg(topic: { title: string; h1: string; codes: string[] } | undefined) {
  if (!topic) return renderOg({ kind: "home" });
  const theme = Object.entries(THEME_CODES).find(([, codes]) => topic.codes.some((c) => codes.includes(c)))?.[0];
  return renderOg({ kind: "topic", title: topic.h1, label: `Sujet · ${topic.title}`, theme });
}
