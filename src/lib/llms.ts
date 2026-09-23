import { getDb } from "@/lib/db";
import { SITE_URL, clip, plain } from "@/lib/seo";
import { CODES, THEMES, faqUrl } from "@/lib/themes";
import { getTopics } from "@/lib/topics";
import { conventionUrl, getConventions } from "@/lib/conventions";
import { getLettres, lettreUrl } from "@/lib/lettres";

type Row = { theme: string; slug: string; topic: string | null; question: string; short: string; article_ids: string };

const HEADER = `# Loilà

> Loilà (${SITE_URL}) explique le droit français en langage clair : droit du travail, urbanisme (permis de construire, déclaration préalable), location de logement et conventions collectives. Chaque réponse cite les articles de loi officiels.

## Comment les réponses sont sourcées

- Base : articles en vigueur du Code du travail, du Code de l'urbanisme, du Code de la construction et de l'habitation, de la loi n° 89-462 du 6 juillet 1989 et de ${Object.keys(CODES).filter((c) => c.startsWith("ccn-")).length} conventions collectives (KALI), importés depuis les données ouvertes de Légifrance. La base locale peut présenter un décalage avec les textes actuellement applicables ; vérifiez la version officielle avant toute démarche.
- Chaque question a une réponse courte (« En bref ») puis une explication détaillée, avec les numéros d'articles cités et un lien vers Légifrance.
- Les pages /article/<code>/<numéro> (ex. /article/code-civil/1643, /article/code-du-travail/L3123-6) reproduisent le texte officiel d'un article avec son explication ; les identifiants Légifrance (/article/LEGIARTI…) y redirigent, et restent l'adresse des articles de conventions collectives (KALIARTI).
- Information générale, pas un conseil juridique personnalisé.
`;

function load() {
  const faqs = getDb().prepare("SELECT theme, slug, topic, question, short, article_ids FROM faq ORDER BY id").all() as Row[];
  const nums = new Map(
    (getDb().prepare("SELECT DISTINCT a.id, a.num, a.code FROM faq, json_each(faq.article_ids) j JOIN articles a ON a.id = j.value").all() as { id: string; num: string; code: string }[])
      .map((a) => [a.id, `art. ${a.num} (${CODES[a.code as keyof typeof CODES]?.name ?? a.code})`]),
  );
  const sources = (f: Row) => {
    try {
      return (JSON.parse(f.article_ids) as string[]).map((id) => nums.get(id)).filter(Boolean).join(" ; ");
    } catch {
      return "";
    }
  };
  return { faqs, sources };
}

export function llmsTxt() {
  const { faqs } = load();
  const out = [HEADER, "## Sections principales\n"];
  for (const t of THEMES) out.push(`- [${t.title}](${SITE_URL}/${t.slug}) : ${t.tagline}`);
  out.push(`- [Tous les sujets](${SITE_URL}/sujets) : guides par situation de vie.`, `- [À propos](${SITE_URL}/a-propos) : méthode et sources.`, `- [Version complète pour LLM](${SITE_URL}/llms-full.txt) : toutes les questions avec réponse courte et articles cités.`);
  for (const t of THEMES) {
    const list = faqs.filter((f) => f.theme === t.slug && !f.topic);
    if (!list.length) continue;
    out.push(`\n## ${t.title}\n`);
    for (const f of list) out.push(`- [${f.question}](${SITE_URL}${faqUrl(f)}) : ${clip(plain(f.short), 140)}`);
  }
  const topics = getTopics();
  if (topics.length) {
    out.push("\n## Sujets\n");
    for (const t of topics) out.push(`- [${t.h1}](${SITE_URL}/sujets/${t.slug}) : ${clip(plain(t.intro), 140)}`);
  }
  const lettres = getLettres();
  if (lettres.length) {
    out.push("\n## Modèles de lettres\n", `- [Relance amiable d'un impayé](${SITE_URL}/relance-amiable) : modèles de relance et de mise en demeure, étapes jusqu'au juge.`);
    for (const l of lettres) out.push(`- [${l.title}](${SITE_URL}${lettreUrl(l)}) : ${l.seo.description}`);
  }
  const decisions = (getDb().prepare("SELECT COUNT(*) n FROM decisions").get() as { n: number }).n;
  out.push(
    "\n## Outils et données officielles\n",
    `- [Prix immobilier au m²](${SITE_URL}/prix-immobilier) : prix médian au m² des appartements et des maisons pour chaque commune et département (pages /prix-immobilier/<commune>-<code INSEE>), évolution depuis 2021, carte par section cadastrale, d'après les ventes DVF de la DGFiP, avec zone tendue et tribunaux compétents.`,
    `- [Réviser un loyer (IRL)](${SITE_URL}/revision-loyer) : calcul de l'article 17-1 de la loi du 6 juillet 1989 avec l'indice de référence des loyers publié par l'INSEE.`,
    `- [Vérifier un bien immobilier](${SITE_URL}/verifier-un-bien) : parcelle cadastrale, ventes DVF, DPE, risques, zonage du PLU et prix du quartier pour une adresse.`,
    `- [Vérifier une entreprise](${SITE_URL}/verifier-entreprise) : identité SIRENE, annonces BODACC, certification RGE et convention collective déclarée.`,
    `- [Journal officiel](${SITE_URL}/jo) : lois, ordonnances et décrets reliés aux articles qu'ils ont créés, modifiés ou abrogés, et aux décisions qui les citent.`,
  );
  if (decisions) out.push("\n## Jurisprudence\n", `- [Jurisprudence](${SITE_URL}/jurisprudence) : ${decisions} décisions (Cour de cassation, Conseil d'État, cours administratives d'appel, Conseil constitutionnel) depuis 2017, reliés aux articles qu'ils appliquent, avec un résumé en clair. Chaque page /jurisprudence/<id> reprend le sommaire officiel et le texte intégral (pseudonymisé).`);
  const conventions = getConventions();
  if (conventions.length) {
    out.push("\n## Conventions collectives (par branche)\n");
    for (const c of conventions) out.push(`- [${c.name}](${SITE_URL}${conventionUrl(c)}) : IDCC ${c.idcc}, articles officiels et réponses clés.`);
  }
  return out.join("\n") + "\n";
}

export function llmsFullTxt() {
  const { faqs, sources } = load();
  const out = [HEADER];
  for (const f of faqs) {
    const src = sources(f);
    out.push(`\n## ${f.question}\n\nURL : ${SITE_URL}${faqUrl(f)}\nEn bref : ${plain(f.short)}${src ? `\nSources : ${src}` : ""}`);
  }
  return out.join("\n") + "\n";
}
