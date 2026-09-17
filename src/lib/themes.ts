// Code slugs used in articles.code. LEGITEXT ids are the Légifrance text ids.
export const CODES = {
  "code-du-travail": { name: "Code du travail", legitext: "LEGITEXT000006072050" },
  "code-urbanisme": { name: "Code de l'urbanisme", legitext: "LEGITEXT000006074075" },
  "code-construction-habitation": { name: "Code de la construction et de l'habitation", legitext: "LEGITEXT000006074096" },
  "loi-89-462": { name: "Loi n° 89-462 du 6 juillet 1989 (baux d'habitation)", legitext: "JORFTEXT000000509310" },
  "loi-65-557": { name: "Loi n° 65-557 du 10 juillet 1965 (copropriété)", legitext: "JORFTEXT000000880200" },
  "decret-67-223": { name: "Décret n° 67-223 du 17 mars 1967 (application de la loi copropriété)", legitext: "JORFTEXT000000305770" },
  "decret-2015-342": { name: "Décret n° 2015-342 du 26 mars 2015 (contrat type de syndic)", legitext: "JORFTEXT000030405166" },
  "decret-2005-240": { name: "Décret n° 2005-240 du 14 mars 2005 (comptes du syndicat des copropriétaires)", legitext: "JORFTEXT000000258200" },
  "code-penal": { name: "Code pénal", legitext: "LEGITEXT000006070719" },
  "code-civil": { name: "Code civil", legitext: "LEGITEXT000006070721" },
  "code-procedures-civiles-execution": { name: "Code des procédures civiles d'exécution", legitext: "LEGITEXT000025024948" },
  "code-securite-sociale": { name: "Code de la sécurité sociale", legitext: "LEGITEXT000006073189" },
  "code-forestier": { name: "Code forestier", legitext: "LEGITEXT000025244092" },
  "code-environnement": { name: "Code de l'environnement", legitext: "LEGITEXT000006074220" },
  // Mirror files it under its pre-2010 title "Code rural (nouveau)"; LEGITEXT000022197698 does not exist there.
  "code-rural": { name: "Code rural et de la pêche maritime", legitext: "LEGITEXT000006071367" },
  "code-education": { name: "Code de l'éducation", legitext: "LEGITEXT000006071191" },
  "code-consommation": { name: "Code de la consommation", legitext: "LEGITEXT000006069565" },
  "code-action-sociale": { name: "Code de l'action sociale et des familles", legitext: "LEGITEXT000006074069" },
  "code-assurances": { name: "Code des assurances", legitext: "LEGITEXT000006073984" },
  "loi-75-1334": { name: "Loi n° 75-1334 du 31 décembre 1975 (sous-traitance)", legitext: "JORFTEXT000000889241" },
  "loi-71-584": { name: "Loi n° 71-584 du 16 juillet 1971 (retenues de garantie)", legitext: "JORFTEXT000000687670" },
  "code-sante-publique": { name: "Code de la santé publique", legitext: "LEGITEXT000006072665" },
  "decret-2002-120": { name: "Décret n° 2002-120 du 30 janvier 2002 (logement décent)", legitext: "JORFTEXT000000217471" },
  "loi-2021-1104": { name: "Loi n° 2021-1104 du 22 août 2021 (Climat et résilience)", legitext: "JORFTEXT000043956924" },
  "code-commerce": { name: "Code de commerce", legitext: "LEGITEXT000005634379" },
  // Conventions collectives (KALI): legitext holds the KALICONT (IDCC container) id.
  "ccn-1486": { name: "Convention collective Syntec, bureaux d'études techniques (IDCC 1486)", legitext: "KALICONT000005635173", idcc: "1486" },
  "ccn-1979": { name: "Convention collective HCR, hôtels cafés restaurants (IDCC 1979)", legitext: "KALICONT000005635534", idcc: "1979" },
  "ccn-2216": { name: "Convention collective Commerce de détail et de gros à prédominance alimentaire (IDCC 2216)", legitext: "KALICONT000005635085", idcc: "2216" },
  "ccn-3248": { name: "Convention collective Métallurgie (IDCC 3248)", legitext: "KALICONT000046993250", idcc: "3248" },
  "ccn-1597": { name: "Convention collective Bâtiment ouvriers, plus de 10 salariés (IDCC 1597)", legitext: "KALICONT000005635220", idcc: "1597" },
  "ccn-1596": { name: "Convention collective Bâtiment ouvriers, jusqu'à 10 salariés (IDCC 1596)", legitext: "KALICONT000005635221", idcc: "1596" },
  "ccn-3127": { name: "Convention collective Services à la personne (IDCC 3127)", legitext: "KALICONT000027084096", idcc: "3127" },
  "ccn-3239": { name: "Convention collective Particulier employeur et emploi à domicile (IDCC 3239)", legitext: "KALICONT000044594539", idcc: "3239" },
  "ccn-3043": { name: "Convention collective Propreté et services associés (IDCC 3043)", legitext: "KALICONT000027172335", idcc: "3043" },
  "ccn-1090": { name: "Convention collective Services de l'automobile (IDCC 1090)", legitext: "KALICONT000005635191", idcc: "1090" },
  "ccn-2120": { name: "Convention collective Banque (IDCC 2120)", legitext: "KALICONT000005635780", idcc: "2120" },
  "ccn-1527": { name: "Convention collective Immobilier (IDCC 1527)", legitext: "KALICONT000005635413", idcc: "1527" },
  "ccn-2596": { name: "Convention collective Coiffure (IDCC 2596)", legitext: "KALICONT000018563755", idcc: "2596" },
  "ccn-0016": { name: "Convention collective Transports routiers (IDCC 0016)", legitext: "KALICONT000005635624", idcc: "0016" },
  "ccn-1996": { name: "Convention collective Pharmacie d'officine (IDCC 1996)", legitext: "KALICONT000005635528", idcc: "1996" },
  "ccn-2609": { name: "Convention collective Bâtiment ETAM (IDCC 2609)", legitext: "KALICONT000018773893", idcc: "2609" },
  "ccn-2420": { name: "Convention collective Cadres du bâtiment (IDCC 2420)", legitext: "KALICONT000017941839", idcc: "2420" },
  "ccn-1702": { name: "Convention collective Travaux publics ouvriers (IDCC 1702)", legitext: "KALICONT000005635467", idcc: "1702" },
} as const;
export type CodeSlug = keyof typeof CODES;

export const THEMES = [
  { slug: "travail", emoji: "💼", title: "Travail", tagline: "Contrat, congés, licenciement, rupture conventionnelle.", codes: ["code-du-travail"] },
  { slug: "urbanisme", emoji: "🏡", title: "Construire & aménager", tagline: "Permis de construire, déclaration préalable, PLU.", codes: ["code-urbanisme"] },
  { slug: "logement", emoji: "🔑", title: "Louer un logement", tagline: "Bail, dépôt de garantie, préavis, loyers.", codes: ["loi-89-462", "code-construction-habitation"] },
  { slug: "copropriete", emoji: "🏢", title: "Copropriété", tagline: "Assemblée générale, syndic, charges, travaux.", codes: ["loi-65-557", "decret-67-223", "decret-2015-342", "decret-2005-240"] },
  { slug: "construction", emoji: "🦺", title: "Construction et BTP", tagline: "Garanties, assurances, paiement, sous-traitance.", codes: ["code-civil", "code-construction-habitation", "code-assurances", "loi-75-1334", "loi-71-584", "code-commerce"] },
  { slug: "diagnostics", emoji: "🌡️", title: "Diagnostics et DPE", tagline: "DPE, amiante, plomb, audit énergétique, passoires thermiques.", codes: ["code-construction-habitation", "code-sante-publique", "loi-89-462"] },
  { slug: "conventions", emoji: "📑", title: "Conventions collectives", tagline: "Salaires minimums, primes, préavis, congés propres à votre branche.", codes: ["ccn-1486", "ccn-1979", "ccn-2216", "ccn-3248", "ccn-1597", "ccn-1596", "ccn-3127", "ccn-3239", "ccn-3043", "ccn-1090", "ccn-2120", "ccn-1527", "ccn-2596", "ccn-0016", "ccn-1996", "ccn-2609", "ccn-2420", "ccn-1702"] },
] as const;
export type ThemeSlug = (typeof THEMES)[number]["slug"];

// Codes shared by too many subjects to identify a theme (a succession topic cites the Code civil, not construction).
const GENERIC_CODES = new Set(["code-civil"]);

/** Colour theme of a /sujets topic: its category when it is a theme (copropriete, construction), else its specific codes. */
export function topicThemeSlug(topic: { category: string; codes: readonly string[] }): ThemeSlug | undefined {
  return (
    THEMES.find((t) => t.slug === topic.category)?.slug ??
    THEMES.find((t) => topic.codes.some((c) => !GENERIC_CODES.has(c) && (t.codes as readonly string[]).includes(c)))?.slug
  );
}

/** Public URL of a FAQ: topic questions live under /sujets. Kept here (no DB import) so client components can use it. */
export function faqUrl(faq: { theme: string; slug: string; topic?: string | null }): string {
  return faq.topic ? `/sujets/${faq.topic}/${faq.slug}` : `/${faq.theme}/${faq.slug}`;
}
