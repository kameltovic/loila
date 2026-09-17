import { CODES, type CodeSlug } from "@/lib/themes";

/** Articles code of a convention collective, e.g. "ccn-1486". */
export type ConventionCode = Extract<CodeSlug, `ccn-${string}`>;

// URL slug + short display name per convention. Must cover every `ccn-*` code in CODES.
const META: Record<ConventionCode, { slug: string; short: string }> = {
  "ccn-0016": { slug: "transports-routiers", short: "Transports routiers" },
  "ccn-1090": { slug: "services-de-l-automobile", short: "Services de l'automobile" },
  "ccn-1486": { slug: "syntec", short: "Syntec" },
  "ccn-1527": { slug: "immobilier", short: "Immobilier" },
  "ccn-1596": { slug: "batiment-jusqu-a-10-salaries", short: "Bâtiment (jusqu'à 10 salariés)" },
  "ccn-1597": { slug: "batiment-plus-de-10-salaries", short: "Bâtiment (plus de 10 salariés)" },
  "ccn-1979": { slug: "hcr", short: "HCR" },
  "ccn-1996": { slug: "pharmacie-officine", short: "Pharmacie d'officine" },
  "ccn-2120": { slug: "banque", short: "Banque" },
  "ccn-2216": { slug: "commerce-alimentaire", short: "Commerce alimentaire" },
  "ccn-2596": { slug: "coiffure", short: "Coiffure" },
  "ccn-3043": { slug: "proprete", short: "Propreté" },
  "ccn-3127": { slug: "services-a-la-personne", short: "Services à la personne" },
  "ccn-3239": { slug: "particulier-employeur", short: "Particulier employeur" },
  "ccn-3248": { slug: "metallurgie", short: "Métallurgie" },
};

export type Convention = {
  /** articles.code, e.g. "ccn-1486". */
  code: ConventionCode;
  /** URL slug under /conventions, e.g. "syntec". */
  slug: string;
  /** Concise name for nav, cards and titles. */
  short: string;
  /** Full official name. */
  name: string;
  /** IDCC number, e.g. "1486". */
  idcc: string;
  /** Légifrance KALICONT id. */
  legitext: string;
};

export function getConventions(): Convention[] {
  return (Object.keys(CODES) as CodeSlug[])
    .filter((c): c is ConventionCode => c.startsWith("ccn-"))
    .map((code) => ({ code, slug: META[code].slug, short: META[code].short, name: CODES[code].name, idcc: CODES[code].idcc, legitext: CODES[code].legitext }));
}

export const getConvention = (slug: string) => getConventions().find((c) => c.slug === slug);

export const conventionUrl = (c: Pick<Convention, "slug">) => `/conventions/branche/${c.slug}`;

/** Official text of the convention on Légifrance. */
export const conventionLegifranceUrl = (c: Pick<Convention, "legitext">) =>
  `https://www.legifrance.gouv.fr/conv_coll/id/${c.legitext}`;

/** Full name without the "(IDCC xxxx)" suffix, for headings. */
export const conventionHeading = (c: Pick<Convention, "name">) => c.name.replace(/ \(IDCC \d+\)$/, "");
