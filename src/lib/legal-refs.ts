// Legal reference normalization: "art. 1643 C. civ.", "L. 3123-6 du code du travail", "1643 cc" → (code, normalized
// number), with how it was matched, a confidence, and a status. Deterministic, no DB access: resolution against the
// `articles` table is done by the caller (see resolveRef in legal-graph.ts).
//
// Status (only "resolved" may become an article link; everything else is kept, with its context, for review):
//   resolved        code and number identified, article exists (set by the caller)
//   unknown_article code identified but number not in Loilà (abrogated, not ingested, typo) (set by the caller)
//   historical      "ancien article", "dans sa rédaction antérieure", "devenu", "applicable à l'époque", or cited
//                   before the code was renumbered: NOT today's article
//   versioned       "dans sa rédaction issue de …": a specific version; the caller links it only if the decision is
//                   not older than the article's current version
//   no_code         a number without any code: ambiguous, never linked
//   code_not_carried a code Loilà does not import yet (procédure civile, CGI…): counted to prioritize ingestion

export const EXTRACTOR_VERSION = "legal-refs/1.2.0";

export type RefStatus = "resolved" | "unknown_article" | "historical" | "versioned" | "no_code" | "code_not_carried";
export type ParsedRef = {
  raw: string; // the reference as written
  index: number; // position in the text
  code: string | null; // code slug (themes.ts CODES keys)
  num: string; // normalized number ("L1221-1", "1643", "R*151-20")
  status: RefStatus;
  method: string; // how the code was identified
  confidence: number; // 0..1, links need >= LINK_CONFIDENCE
  context: string; // ~200 chars around, for review and search snippets
};

export const LINK_CONFIDENCE = 0.9;

/** "L. 3123-6", "L3123-6", "L 3123 6", "L.3123-6", "R.*151-20" → "L3123-6" / "R*151-20"; "1643" → "1643". */
export function normalizeNum(raw: string): string {
  const s = raw.trim().replace(/[‐‑–—]/g, "-").replace(/\s+/g, " ");
  const m = s.match(/^([LRDA])\s*\.?\s*(\*?)\s*(\d+(?:[\s-]\d+)*)$/i);
  if (m) return `${m[1].toUpperCase()}${m[2]}${m[3].replace(/\s+/g, "-")}`;
  return s.replace(/^(\d+)er\b/, "$1").replace(/\s+/g, "-");
}

/** "L1234-5" → "L. 1234-5" (how articles are written in French legal texts). */
export const displayNum = (num: string) => num.replace(/^([LRDA])(\*?)(\d)/, "$1. $2$3");

// Code names and abbreviations → slug. Full names are matched after "du / de la / de l'", abbreviations right after
// the number. Longest first.
const NAMES: [string, string][] = [
  ["code de la construction et de l'habitation", "code-construction-habitation"],
  ["code des procédures civiles d'exécution", "code-procedures-civiles-execution"],
  ["code de l'action sociale et des familles", "code-action-sociale"],
  ["code rural et de la pêche maritime", "code-rural"],
  ["code de la sécurité sociale", "code-securite-sociale"],
  ["code de la santé publique", "code-sante-publique"],
  ["code de la consommation", "code-consommation"],
  ["code de l'environnement", "code-environnement"],
  ["code de l'urbanisme", "code-urbanisme"],
  ["code de l'éducation", "code-education"],
  ["code des assurances", "code-assurances"],
  ["code de commerce", "code-commerce"],
  ["code du travail", "code-du-travail"],
  ["code forestier", "code-forestier"],
  ["code pénal", "code-penal"],
  ["code civil", "code-civil"],
  ["loi n° 89-462 du 6 juillet 1989", "loi-89-462"],
  ["loi du 6 juillet 1989", "loi-89-462"],
  ["loi n° 65-557 du 10 juillet 1965", "loi-65-557"],
  ["loi du 10 juillet 1965", "loi-65-557"],
  ["loi n° 75-1334 du 31 décembre 1975", "loi-75-1334"],
  ["loi du 31 décembre 1975", "loi-75-1334"],
  ["loi n° 71-584 du 16 juillet 1971", "loi-71-584"],
  ["décret n° 67-223 du 17 mars 1967", "decret-67-223"],
  ["décret du 17 mars 1967", "decret-67-223"],
  // Codes Loilà does not carry yet: recognized (so they are not "no_code"), never linked.
  ["code de procédure civile", "~code-procedure-civile"],
  ["code de procédure pénale", "~code-procedure-penale"],
  ["code de justice administrative", "~code-justice-administrative"],
  ["code de l'entrée et du séjour des étrangers et du droit d'asile", "~ceseda"],
  ["code général des impôts", "~cgi"],
  ["livre des procédures fiscales", "~lpf"],
  ["code des relations entre le public et l'administration", "~crpa"],
  ["code général des collectivités territoriales", "~cgct"],
  ["code monétaire et financier", "~code-monetaire-financier"],
  ["code de la route", "~code-de-la-route"],
  ["code de la propriété intellectuelle", "~cpi"],
  ["code des transports", "~code-transports"],
  ["code de la mutualité", "~code-mutualite"],
  ["code de l'organisation judiciaire", "~coj"],
  ["code général de la propriété des personnes publiques", "~cg3p"],
  ["code de la commande publique", "~code-commande-publique"],
];
const ABBREVS: [string, string][] = [
  ["c. constr. et hab.", "code-construction-habitation"],
  ["c. constr. hab.", "code-construction-habitation"],
  ["cch", "code-construction-habitation"],
  ["c. séc. soc.", "code-securite-sociale"],
  ["c. sécu. soc.", "code-securite-sociale"],
  ["css", "code-securite-sociale"],
  ["c. santé publ.", "code-sante-publique"],
  ["csp", "code-sante-publique"],
  ["c. consom.", "code-consommation"],
  ["c. consomm.", "code-consommation"],
  ["c. env.", "code-environnement"],
  ["c. urb.", "code-urbanisme"],
  ["c. éduc.", "code-education"],
  ["c. assur.", "code-assurances"],
  ["c. com.", "code-commerce"],
  ["c. trav.", "code-du-travail"],
  ["c. pén.", "code-penal"],
  ["c. rur.", "code-rural"],
  ["c. for.", "code-forestier"],
  ["cpce", "code-procedures-civiles-execution"],
  ["casf", "code-action-sociale"],
  ["c. civ.", "code-civil"],
  ["cc", "code-civil"],
  ["cpc", "~code-procedure-civile"],
  ["c. pr. civ.", "~code-procedure-civile"],
  ["cpp", "~code-procedure-penale"],
  ["cja", "~code-justice-administrative"],
  ["cgi", "~cgi"],
];
/** "~slug": a code recognized but not imported in Loilà. */
export const isCarried = (code: string) => !code.startsWith("~");

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const flexible = (s: string) => esc(s).replace(/'/g, "['’]").replace(/n°\\? /g, "n°\\s*").replace(/ /g, "\\s+").replace(/\\\./g, "\\.?");
const NAME_RE = NAMES.map(([n, slug]) => [new RegExp(`^\\s*(?:du|de\\s+la|de\\s+l['’]|des)\\s*${flexible(n)}`, "i"), slug] as const);
const ABBREV_RE = ABBREVS.map(([a, slug]) => [new RegExp(`^\\s*${flexible(a)}(?![\\p{L}\\d])`, "iu"), slug] as const);
const SAME_CODE = /^\s*(?:du\s+même\s+code|dudit\s+code|de\s+ce\s+code|du\s+code\s+précité)/i;

// One article number: "L. 1221-1", "L1221-1", "R.* 151-20", "1643", "25-8". Numbers glued to "%", "€", years… are
// not preceded by "article" nor followed by a code abbreviation, so they never match.
// Prefixed numbers also accept spaces as separators ("L 3123 6"); plain ones only dashes, so "12 mars" stays out.
const NUM = String.raw`(?:[LRDA]\s?\.?\s?\*?\s?\d{1,4}(?:(?:-|\s(?=\d{1,3}\b))\d+)*|\d{1,4}(?:er)?(?:-\d+){0,3})`;
const LIST = String.raw`${NUM}(?:\s*(?:,|et|ou|à)\s*${NUM})*`;
const WITH_WORD = new RegExp(String.raw`\b(?:articles?|art\.)\s+(${LIST})`, "gi");
// Without "article": a number (prefixed, or a plain one) directly followed by an abbreviation ("1643 C. civ.").
const BARE = new RegExp(String.raw`(?<![\p{L}\d/.,-])(${NUM})(?=\s*,?\s*(?:c\.|cc\b|cch\b|css\b|csp\b|cpce\b|casf\b))`, "giu");

const HISTORICAL_BEFORE = /(?:\banciens?\s+|\bex-\s*)$/i;
const HISTORICAL_AFTER =
  /^[^.;]{0,120}?(?:dans\s+(?:sa|leur)\s+(?:rédaction|version)\s+(?:antérieure|applicable|alors|en\s+vigueur\s+(?:à|au|avant))|alors\s+applicable|applicable\s+(?:à\s+l['’]époque|en\s+la\s+cause|au\s+litige|aux\s+faits|à\s+la\s+cause)|devenue?s?\s+(?:l['’])?articles?|\babrogée?s?\b)/i;
const VERSIONED_AFTER = /^[^.;]{0,120}?dans\s+(?:sa|leur)\s+(?:rédaction|version)\s+issue\s+de/i;

// Codes renumbered at a date: before it, a number designates the old article, not today's.
const RENUMBERED: { code: string; before: string; applies?: (num: string) => boolean }[] = [
  { code: "code-du-travail", before: "2008-05-01" },
  { code: "code-consommation", before: "2016-07-01" },
  { code: "code-civil", before: "2016-10-01", applies: (n) => /^\d+/.test(n) && +n.match(/^\d+/)![0] >= 1100 && +n.match(/^\d+/)![0] <= 1386 },
];
// Civil code, contract law reform (ordonnance n° 2016-131, in force 1 Oct 2016): articles 1100 to 1386-1 were
// renumbered, and the Cour de cassation still applies the old law to older contracts, often without a marker next to
// each number. A decision applies one regime: if it shows an old-law marker, all its references in that range are
// historical. Markers: the old wording explicitly mentioned, or a "landmark" number whose old meaning dominates
// citations (measured on CASS 2017+: 1134, 1382, 1147, 1315, 1154, 1184, 1351… vs today's 1240, 1103, 1353, 1231-1).
export const inCivilReformRange = (code: string | null, num: string) => {
  if (code !== "code-civil") return false;
  const n = Number(num.match(/^\d+/)?.[0]);
  return n >= 1100 && n <= 1386;
};
export const OLD_CIVIL_LANDMARKS = new Set([
  "1134", "1135", "1147", "1148", "1149", "1150", "1151", "1152", "1153", "1154", "1156", "1165", "1184",
  "1244-1", "1289", "1290", "1315", "1341", "1347", "1351", "1382", "1383", "1384", "1385", "1386",
]);
const OLD_CIVIL_TEXT = /2016-131[\s\S]{0,200}?antérieur|antérieur[\s\S]{0,200}?2016-131/i;
/** Decision-level: does this decision apply the pre-2016 civil law of obligations? */
export const appliesOldCivilLaw = (text: string, refs: ParsedRef[]) =>
  OLD_CIVIL_TEXT.test(text) || refs.some((r) => inCivilReformRange(r.code, r.num) && (r.status === "historical" || OLD_CIVIL_LANDMARKS.has(r.num)));

export const renumberedAt = (code: string, num: string, date: string) =>
  RENUMBERED.some((r) => r.code === code && date < r.before && (!r.applies || r.applies(num)));

// Subdivisions written between the number and the code: ", alinéa 2,", ", 2°,", ", I,", ", a)", ", al. 3".
const SUBDIV = /^\s*,?\s*(?:(?:alinéas?|al\.)\s*\d+(?:er)?|\d+°|[IVX]{1,5}\b|[a-z]\)|(?:premier|deuxième|second|troisième|dernier)\s+alinéa)\s*(?=,|du|de|des)/i;
const skipSubdivisions = (after: string) => {
  let s = after;
  for (let i = 0; i < 4 && SUBDIV.test(s); i++) s = s.replace(SUBDIV, "").replace(/^\s*,/, "");
  return s;
};

function codeAfter(rawAfter: string): { code: string; method: string; confidence: number } | null {
  const after = skipSubdivisions(rawAfter);
  for (const [re, slug] of NAME_RE) if (re.test(after)) return { code: slug, method: "code_name", confidence: 0.98 };
  const abbr = after.replace(/^\s*,?\s*/, "");
  for (const [re, slug] of ABBREV_RE) {
    if (re.test(abbr)) return { code: slug, method: slug === "code-civil" && /^\s*cc/i.test(abbr) ? "abbrev_cc" : "abbrev", confidence: /^\s*cc\b/i.test(abbr) ? 0.85 : 0.95 };
  }
  return null;
}

/**
 * Every article reference in a text, one entry per number. `date` (the decision's date, YYYY-MM-DD) enables the
 * renumbering rule. "du même code" resolves to the last code named before it in the same text.
 */
export function parseRefs(text: string, date?: string): ParsedRef[] {
  const out: ParsedRef[] = [];
  const found: { index: number; end: number; list: string; code: ReturnType<typeof codeAfter>; raw: string; bare: boolean }[] = [];
  for (const m of text.matchAll(WITH_WORD)) {
    const end = m.index + m[0].length;
    // "Article 1er : La requête est rejetée." (operative part of administrative decisions) is not a reference.
    if (/^Article\s/.test(m[0]) && /^\s*:/.test(text.slice(end))) continue;
    found.push({ index: m.index, end, list: m[1], code: codeAfter(text.slice(end)), raw: m[0], bare: false });
  }
  for (const m of text.matchAll(BARE)) {
    if (found.some((f) => m.index >= f.index && m.index < f.end)) continue; // already part of an "article …" match
    const end = m.index + m[0].length;
    const code = codeAfter(text.slice(end));
    if (code) found.push({ index: m.index, end, list: m[1], code, raw: m[0], bare: true });
  }
  found.sort((a, b) => a.index - b.index);
  let lastCode: string | null = null;
  for (const f of found) {
    const after = text.slice(f.end);
    const before = text.slice(Math.max(0, f.index - 12), f.index);
    let code = f.code?.code ?? null;
    let method = f.code?.method ?? "none";
    let confidence = f.code?.confidence ?? 0;
    if (!code && SAME_CODE.test(skipSubdivisions(after)) && lastCode) {
      code = lastCode;
      method = "same_code_backref";
      confidence = 0.9;
    }
    if (f.code) lastCode = f.code.code;
    const nameEnd = f.code ? (after.match(NAME_RE.find(([re]) => re.test(after))?.[0] ?? /$^/)?.[0].length ?? 0) : 0;
    const tail = after.slice(nameEnd);
    const historical = HISTORICAL_BEFORE.test(before) || HISTORICAL_AFTER.test(tail);
    const versioned = !historical && VERSIONED_AFTER.test(tail);
    const context = text.slice(Math.max(0, f.index - 80), Math.min(text.length, f.end + 120)).replace(/\s+/g, " ").trim();
    // "articles 1 à 5": a range; only the bounds are listed, never the numbers in between.
    for (const n of f.list.split(/\s*(?:,|\bet\b|\bou\b|\bà\b)\s*/)) {
      if (!n.trim()) continue;
      const num = normalizeNum(n);
      let status: RefStatus = !code ? "no_code" : !isCarried(code) ? "code_not_carried" : historical ? "historical" : versioned ? "versioned" : "resolved";
      if (status === "resolved" && date && code && renumberedAt(code, num, date)) status = "historical";
      out.push({ raw: f.raw.trim(), index: f.index, code, num, status, method: historical && code ? `${method}+historical` : method, confidence: code ? confidence : 0.2, context });
    }
  }
  return out;
}
