import fs from "node:fs";
import path from "node:path";
import { faqsBySlugs } from "./metiers";

// Letter templates (/modeles-lettres/<slug>), one JSON per letter in seed/lettres (shipped via outputFileTracingIncludes).
export type LetterField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "date" | "select";
  placeholder?: string;
  /** select only: the chosen option's `text` is inserted in the letter (it may hold {{placeholders}} itself). */
  options?: { label: string; text: string }[];
};

export type Lettre = {
  slug: string;
  title: string;
  theme: string;
  seo: { title: string; description: string };
  h1: string;
  h1Accent: string;
  intro: string;
  when: string[];
  fields: LetterField[];
  /** Letter text with {{field}} placeholders. */
  body: string;
  tips: { title: string; detail: string; refs: string[]; link?: { href: string; label: string } }[];
  faqSlugs: string[];
};

const DIR = path.join(process.cwd(), "seed", "lettres");

let cache: Lettre[] | undefined;
export function getLettres(): Lettre[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort() : [];
  return (cache = files.map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as Lettre));
}

export const getLettre = (slug: string) => getLettres().find((l) => l.slug === slug);
export const lettreUrl = (l: Pick<Lettre, "slug">) => `/modeles-lettres/${l.slug}`;
export const lettreFaqs = (l: Lettre) => faqsBySlugs(l.faqSlugs);
/** Letters that answer a FAQ (reverse link from question pages). */
export const lettresForFaq = (slug: string) => getLettres().filter((l) => l.faqSlugs.includes(slug));
