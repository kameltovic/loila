import topicsJson from "../../seed/topics.json";
import { getDb, type Faq } from "./db";

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

export { faqUrl } from "./themes";
