import topicsJson from "../../seed/topics.json";
import { getDb, type Faq } from "./db";
import { THEMES } from "./themes";

export type TopicQuestion = { slug: string; question: string; hints: string[] };
export type Topic = {
  slug: string;
  title: string;
  h1: string;
  category: string;
  intro: string;
  keywords: string[];
  codes: string[];
  questions: TopicQuestion[];
  relatedFaqs?: string[];
};
type Catalogue = { categories: { slug: string; title: string }[]; topics: Topic[] };

const catalogue = topicsJson as Catalogue;

export const getTopics = (): Topic[] => catalogue.topics;

export const getTopic = (slug: string): Topic | undefined => catalogue.topics.find((t) => t.slug === slug);

export const getCategories = (): { slug: string; title: string; topics: Topic[] }[] =>
  catalogue.categories.map((c) => ({ ...c, topics: catalogue.topics.filter((t) => t.category === c.slug) }));

/** Answered questions of a topic (in seed order), then its related theme FAQs. */
export function getTopicFaqs(slug: string): Faq[] {
  const topic = getTopic(slug);
  if (!topic) return [];
  const db = getDb();
  const own = db.prepare("SELECT * FROM faq WHERE topic = ?").all(slug) as Faq[];
  const order = topic.questions.map((q) => q.slug);
  own.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
  const related = topic.relatedFaqs?.length
    ? (db.prepare(`SELECT * FROM faq WHERE slug IN (${topic.relatedFaqs.map(() => "?").join(",")})`).all(...topic.relatedFaqs) as Faq[])
    : [];
  return [...own, ...related.filter((r) => r.topic !== slug)];
}

export type RelatedFaq = Pick<Faq, "id" | "theme" | "topic" | "slug" | "question" | "short"> & { color: string; kicker: string };

/** Theme colour + kicker of a FAQ: topic questions borrow the theme whose codes they cite. */
function decorate(f: Pick<Faq, "id" | "theme" | "topic" | "slug" | "question" | "short">): RelatedFaq {
  const topic = f.topic ? getTopic(f.topic) : undefined;
  const theme = topic
    ? THEMES.find((t) => topic.codes.some((c) => (t.codes as readonly string[]).includes(c)))
    : THEMES.find((t) => t.slug === f.theme);
  return { ...f, color: theme?.slug ?? "travail", kicker: topic?.title ?? theme?.title ?? "Droit" };
}

/**
 * "À lire aussi": FAQs citing the most articles in common (strongest legal proximity), then questions of the same
 * topic (or theme), in seed order. ponytail: no text similarity fallback; add FTS on faq_fts if pages end up short.
 */
export function relatedFaqs(faq: Pick<Faq, "id" | "theme" | "topic" | "article_ids">, limit = 3): RelatedFaq[] {
  const db = getDb();
  const cols = "f.id, f.theme, f.topic, f.slug, f.question, f.short";
  const shared = db
    .prepare(
      `SELECT ${cols}, COUNT(*) n FROM faq f, json_each(f.article_ids) j
       WHERE f.id != ? AND j.value IN (SELECT value FROM json_each(?))
       GROUP BY f.id ORDER BY n DESC, (f.topic IS ?) DESC, (f.theme = ?) DESC, f.id LIMIT ?`,
    )
    .all(faq.id, faq.article_ids, faq.topic, faq.theme, limit) as RelatedFaq[];
  const picked = new Set([faq.id, ...shared.map((f) => f.id)]);
  const fill = shared.length < limit
    ? (db
        .prepare(`SELECT ${cols} FROM faq f WHERE ${faq.topic ? "f.topic = ?" : "f.theme = ? AND f.topic IS NULL"} ORDER BY f.id`)
        .all(faq.topic ?? faq.theme) as RelatedFaq[]).filter((f) => !picked.has(f.id))
    : [];
  return [...shared, ...fill].slice(0, limit).map(decorate);
}

export { faqUrl } from "./themes";
