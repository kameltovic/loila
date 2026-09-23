// Article URL resolution, shared by the /article pages and src/proxy.ts (which answers the redirects with a real 301).
import { getDb, type Article } from "./db";
import { CODES } from "./themes";
import { articleByPath, articlePath } from "./articles";
import { normalizeNum } from "./legal-refs";
import { getArticleByNum } from "./search";

export type Resolved = { a: Article; redirect?: undefined } | { redirect: string; a?: undefined };
export type Choice = Pick<Article, "id" | "code" | "num">;

export const byId = (id: string) => getDb().prepare("SELECT * FROM articles WHERE id = ?").get(id) as Article | undefined;
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
const NON_CCN = Object.keys(CODES).filter((c) => !c.startsWith("ccn-"));

/**
 * /article/<id>: a Légifrance id renders when it is its own canonical path, else redirects to /article/<code>/<num>.
 * Anything else is read as a bare number ("l3123-6", "art-2296"): one match across the codes redirects, several list.
 */
export function resolveId(id: string): Resolved | { choices: Choice[]; num: string } | undefined {
  const a = byId(id);
  if (a) {
    const p = articlePath(a);
    return p === `/article/${id}` ? { a } : { redirect: p };
  }
  const num = normalizeNum(decode(id).replace(/^art(?:icle)?[\s.-]*/i, ""));
  if (!num) return;
  const choices = getDb()
    .prepare(`SELECT id, code, num FROM articles WHERE code IN (${NON_CCN.map(() => "?").join(",")}) AND num_norm = ? LIMIT 20`)
    .all(...NON_CCN, num) as Choice[];
  if (choices.length === 1) return { redirect: articlePath(choices[0]) };
  if (choices.length > 1) return { choices, num };
}

/** /article/<code>/<num>: renders on the canonical spelling, redirects any other one (and ambiguous numbers to the id). */
export function resolvePath(code: string, rawNum: string): Resolved | undefined {
  const num = decode(rawNum);
  const a = articleByPath(code, num) ?? getArticleByNum(code, num);
  if (!a) return;
  const p = articlePath(a);
  return p === `/article/${code}/${encodeURIComponent(num)}` ? { a } : { redirect: p };
}
