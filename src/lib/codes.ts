import { getDb } from "./db";
import { indexableArticles } from "./eligibility";
import { byArticleNum } from "./jorf";
import { CODES, type CodeSlug } from "./themes";

export type SectionNode = {
  title: string; // raw breadcrumb segment: "Titre VIII : De la filiation adoptive"
  slugs: string[]; // URL path below /codes/<code>
  section: string; // full breadcrumb, as stored in articles.section
  count: number; // articles in the subtree
  first: string; // first / last article number, legal order
  last: string;
  indexable: boolean; // subtree holds ≥1 indexable article
  children: SectionNode[];
};
export type CodeTree = { code: CodeSlug; name: string; root: SectionNode; bySlug: Map<string, SectionNode>; bySection: Map<string, SectionNode> };

/** Codes and lois with their own hub (conventions collectives have /conventions). */
export const hubCodes = () => (Object.keys(CODES) as CodeSlug[]).filter((c) => !c.startsWith("ccn-"));
export const isHubCode = (c: string): c is CodeSlug => c in CODES && !c.startsWith("ccn-");

export const slugify = (s: string) => {
  const t = s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return t.length <= 40 ? t : t.slice(0, 41).replace(/-[^-]*$/, "");
};

/** "Titre VIII : De la filiation adoptive" → { kind: "Titre VIII", name: "De la filiation adoptive" }. */
export function splitTitle(title: string) {
  const i = title.indexOf(" : ");
  const clean = (s: string) => s.trim().replace(/\.$/, "");
  return i < 0 ? { kind: "", name: clean(title) } : { kind: clean(title.slice(0, i)), name: clean(title.slice(i + 3)) };
}

// Legal order: by number first, then L < R < D (a réglementaire section interleaves R and D articles). rowid order is not reliable.
const RANK = ["L", "LO", "R", "D", "A"];
const prefix = (n: string) => /^[A-Z]*/.exec(n)![0];
export const byLegalOrder = (a: { num: string }, b: { num: string }) =>
  byArticleNum({ num: a.num.slice(prefix(a.num).length) }, { num: b.num.slice(prefix(b.num).length) }) ||
  RANK.indexOf(prefix(a.num)) - RANK.indexOf(prefix(b.num)) ||
  byArticleNum(a, b);

// ponytail: built once per process (~50k rows max); articles only change on deploy, which restarts the server.
let indexable: Set<string> | undefined;
const trees = new Map<string, CodeTree>();

export function codeTree(code: string): CodeTree | undefined {
  if (!isHubCode(code)) return undefined;
  const cached = trees.get(code);
  if (cached) return cached;
  indexable ??= new Set(indexableArticles().map((a) => a.id));
  const node = (title: string, slugs: string[], section: string): SectionNode =>
    ({ title, slugs, section, count: 0, first: "", last: "", indexable: false, children: [] });
  const root = node(CODES[code].name, [], "");
  const bySlug = new Map<string, SectionNode>();
  const bySection = new Map<string, SectionNode>();
  const rows = (getDb().prepare("SELECT id, num, section FROM articles WHERE code = ? ORDER BY rowid").all(code) as { id: string; num: string; section: string | null }[]).sort(byLegalOrder);
  for (const r of rows) {
    let cur = root;
    const hit = (n: SectionNode) => {
      n.count++;
      n.first ||= r.num;
      n.last = r.num;
      if (indexable!.has(r.id)) n.indexable = true;
    };
    hit(root);
    for (const seg of (r.section ?? "").split(" > ").filter(Boolean)) {
      const section = cur.section ? `${cur.section} > ${seg}` : seg;
      let child = cur.children.find((c) => c.section === section);
      if (!child) {
        // Siblings sharing a slug get -2, -3…: first seen in legal order keeps the plain one, so URLs are stable.
        const base = slugify(seg) || "section";
        let slug = base;
        for (let i = 2; cur.children.some((c) => c.slugs.at(-1) === slug); i++) slug = `${base}-${i}`;
        child = node(seg, [...cur.slugs, slug], section);
        cur.children.push(child);
        bySlug.set(child.slugs.join("/"), child);
        bySection.set(section, child);
      }
      hit(child);
      cur = child;
    }
  }
  const tree = { code, name: CODES[code].name, root, bySlug, bySection };
  trees.set(code, tree);
  return tree;
}

export const sectionHref = (code: string, n: Pick<SectionNode, "slugs">) => `/codes/${code}${n.slugs.length ? `/${n.slugs.join("/")}` : ""}`;

/** Hub page of the section an article sits in (for "parent" links from article pages). */
export function articleSectionHref(a: { code: string; section: string | null }): string | undefined {
  const t = codeTree(a.code);
  if (!t || !a.section) return undefined;
  const n = t.bySection.get(a.section);
  return n && sectionHref(a.code, n);
}

/** Section node and its ancestors, root excluded. */
export function sectionTrail(t: CodeTree, n: SectionNode): SectionNode[] {
  return n.slugs.map((_, i) => t.bySlug.get(n.slugs.slice(0, i + 1).join("/"))!);
}

export const rangeLabel = (n: Pick<SectionNode, "count" | "first" | "last">) =>
  n.count === 1 ? `article ${n.first}` : `articles ${n.first} à ${n.last}`;

/** Articles of a section subtree in legal order. Prefix match on the breadcrumb, served by the (code, …) index. */
export function sectionArticles(code: string, section: string) {
  const sub = `${section} > `;
  return (getDb()
    .prepare("SELECT id, code, num, section, texte FROM articles WHERE code = ? AND (section = ? OR substr(section, 1, ?) = ?)")
    .all(code, section, sub.length, sub) as { id: string; code: string; num: string; section: string; texte: string }[]).sort(byLegalOrder);
}

export const isIndexableArticle = (id: string) => (indexable ??= new Set(indexableArticles().map((a) => a.id))).has(id);
