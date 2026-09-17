import { getDb } from "@/lib/db";
import { SITE_URL, clip, plain } from "@/lib/seo";
import { CODES, THEMES, faqUrl } from "@/lib/themes";
import { getTopics } from "@/lib/topics";

type Row = { theme: string; slug: string; topic: string | null; question: string; short: string; article_ids: string };

const HEADER = `# Loilà

> Loilà (${SITE_URL}) explique le droit français en langage clair : droit du travail, urbanisme (permis de construire, déclaration préalable), location de logement et conventions collectives. Chaque réponse cite les articles de loi officiels.

## Comment les réponses sont sourcées

- Base : articles en vigueur du Code du travail, du Code de l'urbanisme, du Code de la construction et de l'habitation, de la loi n° 89-462 du 6 juillet 1989 et de ${Object.keys(CODES).filter((c) => c.startsWith("ccn-")).length} conventions collectives (KALI), importés depuis les données ouvertes de Légifrance. La base locale peut présenter un décalage avec les textes actuellement applicables ; vérifiez la version officielle avant toute démarche.
- Chaque question a une réponse courte (« En bref ») puis une explication détaillée, avec les numéros d'articles cités et un lien vers Légifrance.
- Les pages /article/<id> reproduisent le texte officiel d'un article (identifiant Légifrance LEGIARTI/KALIARTI).
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
