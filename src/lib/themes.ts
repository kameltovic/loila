// Code slugs used in articles.code. LEGITEXT ids are the Légifrance text ids.
export const CODES = {
  "code-du-travail": { name: "Code du travail", legitext: "LEGITEXT000006072050" },
  "code-urbanisme": { name: "Code de l'urbanisme", legitext: "LEGITEXT000006074075" },
  "code-construction-habitation": { name: "Code de la construction et de l'habitation", legitext: "LEGITEXT000006074096" },
  "loi-89-462": { name: "Loi n° 89-462 du 6 juillet 1989 (baux d'habitation)", legitext: "JORFTEXT000000509310" },
} as const;
export type CodeSlug = keyof typeof CODES;

export const THEMES = [
  { slug: "travail", emoji: "💼", title: "Travail", tagline: "Contrat, congés, licenciement, rupture conventionnelle.", codes: ["code-du-travail"] },
  { slug: "urbanisme", emoji: "🏡", title: "Construire & aménager", tagline: "Permis de construire, déclaration préalable, PLU.", codes: ["code-urbanisme"] },
  { slug: "logement", emoji: "🔑", title: "Louer un logement", tagline: "Bail, dépôt de garantie, préavis, loyers.", codes: ["loi-89-462", "code-construction-habitation"] },
] as const;
export type ThemeSlug = (typeof THEMES)[number]["slug"];
