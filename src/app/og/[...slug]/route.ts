import { getDb, type Article, type Faq } from "@/lib/db";
import { renderOg, renderWordmark, topicOg } from "@/lib/og";
import { CODES, THEMES } from "@/lib/themes";
import { getTopic } from "@/lib/topics";
import { getMetier } from "@/lib/metiers";
import { getLettre } from "@/lib/lettres";
import { citation, getDecision } from "@/lib/decisions";
import { conventionHeading, getConvention } from "@/lib/conventions";

// Share images live at /og/<page path>.png (home: /og/index.png). A real .png extension:
// some link-preview crawlers skip image URLs without one (Next's opengraph-image files have none).
function image(parts: string[]) {
  const [a, b, c] = parts;
  const theme = THEMES.find((t) => t.slug === a);
  if (parts.length === 1 && a === "index") return renderOg({ kind: "home" });
  if (parts.length === 1 && a === "logo") return renderWordmark(); // email header
  if (a === "sujets" && parts.length === 1)
    return renderOg({ kind: "topic", title: "Tous les sujets du droit, expliqués simplement", label: "Sujets · Guides pratiques" });
  if (a === "sujets" && parts.length === 2) return topicOg(getTopic(b));
  if (a === "sujets" && parts.length === 3) {
    const topic = getTopic(b);
    const faq = getDb().prepare("SELECT theme, question FROM faq WHERE topic = ? AND slug = ?").get(b, c) as Pick<Faq, "theme" | "question"> | undefined;
    if (!faq && !topic) return null;
    return renderOg({ kind: "faq", theme: faq?.theme ?? "", themeTitle: topic?.title ?? "Sujet", question: faq?.question ?? topic?.h1 ?? "" });
  }
  if (a === "article" && parts.length === 2) {
    const art = getDb().prepare("SELECT num, code, section FROM articles WHERE id = ?").get(b) as Pick<Article, "num" | "code" | "section"> | undefined;
    if (!art) return null;
    return renderOg({
      kind: "article",
      num: art.num || art.section?.split(" > ").pop() || "Texte officiel",
      code: CODES[art.code as keyof typeof CODES]?.name ?? art.code,
      theme: THEMES.find((t) => (t.codes as readonly string[]).includes(art.code))?.slug,
    });
  }
  if (a === "conventions" && b === "branche" && parts.length === 3) {
    const conv = getConvention(c);
    if (conv) return renderOg({ kind: "topic", title: conventionHeading(conv), label: `Convention collective · IDCC ${conv.idcc}`, theme: "conventions" });
  }
  if (a === "pour" && parts.length === 1) return renderOg({ kind: "topic", title: "Le droit de votre métier, expliqué simplement", label: "Pour les pros" });
  if (a === "pour" && parts.length === 2) {
    const m = getMetier(b);
    return m ? renderOg({ kind: "topic", title: `${m.h1} ${m.h1Accent}`, label: `Pour les pros · ${m.title}`, theme: m.theme }) : null;
  }
  if (a === "avocats" && parts.length === 1) return renderOg({ kind: "topic", title: "La jurisprudence, reliée à la loi", label: "Loilà pour les avocats et juristes" });
  if (a === "jurisprudence" && parts.length === 1) return renderOg({ kind: "topic", title: "La loi, et ce qu’en disent les juges", label: "Jurisprudence · Cour de cassation" });
  if (a === "jurisprudence" && parts.length === 2) {
    const d = getDecision(b);
    return d ? renderOg({ kind: "topic", title: citation(d), label: `Jurisprudence · ${d.solution ?? d.juridiction}` }) : null;
  }
  if (a === "relance-amiable" && parts.length === 1) return renderOg({ kind: "topic", title: "Un impayé ? Relancez d’abord à l’amiable", label: "Relances et mise en demeure · Modèles gratuits" });
  if (a === "modeles-lettres" && parts.length === 1) return renderOg({ kind: "topic", title: "La bonne lettre, avec le bon article", label: "Modèles de lettres gratuits" });
  if (a === "modeles-lettres" && parts.length === 2) {
    const l = getLettre(b);
    return l ? renderOg({ kind: "topic", title: l.title, label: "Modèle de lettre gratuit", theme: l.theme }) : null;
  }
  if (theme && parts.length === 1) return renderOg({ kind: "theme", theme: theme.slug, title: theme.title, tagline: theme.tagline });
  if (theme && parts.length === 2) {
    const faq = getDb().prepare("SELECT question FROM faq WHERE theme = ? AND slug = ? AND topic IS NULL").get(a, b) as Pick<Faq, "question"> | undefined;
    if (!faq) return null;
    return renderOg({ kind: "faq", theme: a, themeTitle: theme.title, question: faq.question });
  }
  return null; // static pages (tarifs, cgv…) use /og/index.png via pageMetadata
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const slug = [...(await params).slug];
  const last = slug.pop();
  if (!last?.endsWith(".png")) return new Response("Not found", { status: 404 });
  const res = image([...slug, last.slice(0, -4)]);
  if (!res) return new Response("Not found", { status: 404 });
  res.headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
  return res;
}
