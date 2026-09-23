import { getAddress } from "@/lib/address";
import { getCompany } from "@/lib/company";
import { irlSeries, quarterLabel } from "@/lib/irl";
import { getJorfText } from "@/lib/jorf";
import { KIND_LABEL, mainKind, placeFromSlug, placeName, pointsOf, priceYears } from "@/lib/prices";
import { getDb, type Article, type Faq } from "@/lib/db";
import { articleByPath } from "@/lib/articles";
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
  if (a === "article" && (parts.length === 2 || (parts.length === 3 && c !== "jurisprudence"))) {
    // /og/article/<id>.png or, for readable URLs, /og/article/<code>/<num>.png
    const art = parts.length === 3 ? articleByPath(b, c) : (getDb().prepare("SELECT num, code, section FROM articles WHERE id = ?").get(b) as Pick<Article, "num" | "code" | "section"> | undefined);
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
  if (a === "jurisprudence" && parts.length === 1) return renderOg({ kind: "topic", title: "La loi, et ce qu’en disent les juges", label: "Jurisprudence · Cassation, Conseil d’État, Conseil constitutionnel" });
  if (a === "jurisprudence" && parts.length === 2) {
    const d = getDecision(b);
    return d ? renderOg({ kind: "topic", title: citation(d), label: `Jurisprudence · ${d.solution ?? d.juridiction}` }) : null;
  }
  if (a === "prix-immobilier" && parts.length === 1) return renderOg({ kind: "topic", title: "Le prix réel au m², commune par commune", label: "Prix immobilier · Ventes officielles DVF", theme: "logement" });
  if (a === "prix-immobilier" && parts.length === 2) {
    const p = placeFromSlug(b);
    if (!p || p.level === "nation") return null;
    const rows = priceYears(p.code);
    const kind = mainKind(rows);
    const last = pointsOf(rows, kind).at(-1);
    const where = p.level === "departement" ? `${p.name} (${p.code})` : placeName(p);
    return renderOg({ kind: "topic", title: last ? `${where} : ${last.median.toLocaleString("fr-FR")} €/m²` : `Prix immobilier ${where}`, label: `Prix immobilier${last ? ` ${last.year}` : ""} · ${KIND_LABEL[kind]} · DVF`, theme: "logement" });
  }
  if (a === "revision-loyer" && parts.length === 1) {
    const irl = irlSeries(1)[0];
    return renderOg({ kind: "topic", title: "Réviser un loyer avec l’IRL", label: irl ? `IRL ${quarterLabel(irl.period)} = ${irl.value.toLocaleString("fr-FR")} · Loi du 6 juillet 1989` : "Loi du 6 juillet 1989", theme: "logement" });
  }
  if (a === "jo" && parts.length === 1) return renderOg({ kind: "topic", title: "Les lois et décrets, reliés aux articles qu’ils modifient", label: "Journal officiel · DILA" });
  if (a === "jo" && parts.length === 2) {
    const t = getJorfText(b);
    return t ? renderOg({ kind: "topic", title: t.titre, label: `Journal officiel${t.date_publi ? ` · publié le ${new Date(`${t.date_publi}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" })}` : ""}` }) : null;
  }
  if (a === "verifier-un-bien" && parts.length === 1) return renderOg({ kind: "topic", title: "Vérifier un bien avant d’acheter ou de louer", label: "Parcelle · ventes · DPE · risques · PLU", theme: "urbanisme" });
  if (a === "bien" && parts.length === 1) return renderOg({ kind: "topic", title: "Les biens vérifiés sur Loilà", label: "Sources officielles", theme: "urbanisme" });
  if (a === "bien" && parts.length === 2) {
    const ad = getAddress(b);
    return ad ? renderOg({ kind: "topic", title: ad.label, label: "Parcelle · ventes · DPE · risques · PLU", theme: "urbanisme" }) : null;
  }
  if (a === "verifier-entreprise" && parts.length === 1) return renderOg({ kind: "topic", title: "Vérifier une entreprise en un instant", label: "SIRENE · BODACC · RGE · convention collective", theme: "travail" });
  if (a === "entreprise" && parts.length === 1) return renderOg({ kind: "topic", title: "Les entreprises vérifiées sur Loilà", label: "Sources officielles", theme: "travail" });
  if (a === "entreprise" && parts.length === 2) {
    const c = getCompany(b);
    return c && c.statut_diffusion !== "P" ? renderOg({ kind: "topic", title: c.nom_complet ?? `SIREN ${b}`, label: `SIREN ${b} · fiche entreprise`, theme: "travail" }) : null;
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
  // no-store: a CDN must not keep a 404 for an image whose data arrives later (new page, deploy, synced address).
  const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!last?.endsWith(".png")) return notFound();
  const res = image([...slug, last.slice(0, -4)]);
  if (!res) return notFound();
  res.headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
  return res;
}
