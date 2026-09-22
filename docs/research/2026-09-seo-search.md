# Loilà — Audit SEO / Architecture de l'information & Recherche (Loilà Pro)

Agent 6 (SEO / IA) + Agent 7 (Search / Loilà Pro). Septembre 2026.
Périmètre : audit de l'état courant + architecture cible. Aucun fichier applicatif modifié.

Chiffres du corpus lus dans `data/loila.db` (read-only, `sqlite3 3.51.0`) :

| Table | Lignes |
|---|---|
| `articles` | 101 981 |
| `decisions` | 57 957 |
| `decision_articles` | 179 803 |
| `citations` | 1 281 444 |
| `article_relations` (co-citation) | 117 382 |
| `article_stats` | 16 807 |
| `decision_summaries` | 2 356 |
| `article_summaries` | 2 197 |
| `faq` | 793 |

Articles réellement **indexables** (règle actuelle) : **2 225**. Décisions en sitemap : **2 356**.
Listes `/article/<id>/jurisprudence` en sitemap : **462**. Sitemap total estimé : **~6 000 URLs**.

---

## 1. État des lieux SEO

### 1.1 Ce qui marche déjà (à ne pas casser)

- **Canonical systématique.** `pageMetadata()` pose `alternates.canonical: path` pour toute page qui l'utilise (`src/lib/seo.ts:32`), et `metadataBase` est défini une fois pour toutes (`src/app/layout.tsx:14`), donc les canonicals relatifs sont résolus en absolu. C'est la bonne architecture.
- **Une entité = une URL, dès aujourd'hui, pour les articles et les décisions.** L'URL d'un article est `/article/<id Légifrance>` (`src/app/article/[id]/page.tsx:38`) et celle d'une décision `/jurisprudence/<id>` (`src/lib/decisions.ts:41`). Les IDs sont uniques : **il n'existe aujourd'hui aucune page dupliquée par variante lexicale**. « 1643 cc » et « article 1643 code civil » pointent tous deux vers la même page `/article/LEGIARTI…`. C'est un point fort à préserver.
- **Noindex piloté par la valeur, avec sitemap cohérent en intention.** Article indexable seulement s'il est cité (FAQ/lettre) ou résumé + appliqué par de la jurisprudence (`src/app/article/[id]/page.tsx:40-42`) ; décision indexable seulement si elle a un résumé rédigé (`src/app/jurisprudence/[id]/page.tsx:21-22`) ; page 2+ de pagination noindex (`src/app/article/[id]/jurisprudence/page.tsx:29`). Le sitemap rejoue les mêmes règles (`src/app/sitemap.ts:22-34`). C'est le bon réflexe.
- **Breadcrumbs JSON-LD partout** (`src/lib/seo.ts:81-92`), avec fil d'Ariane visible correspondant.
- **Robots ouverts aux crawlers IA** explicitement (`src/app/robots.ts:5`), `llms.txt` + `llms-full.txt` (`src/lib/llms.ts`) : cohérent avec une stratégie GEO (être cité par les IA).
- **Maillage interne réel et déterministe** : liens article↔décision (`src/lib/decisions.ts:56-83`), co-citation (`concept` + `coCitedByCaseLaw` `src/lib/decisions.ts:102-108`), liens dans le texte légal (`src/lib/articles.ts:21-39`), liens dans les sommaires de décisions (`src/app/jurisprudence/[id]/page.tsx:40-44`). Le maillage n'est pas « du texte » : c'est un graphe.
- **Instrumentation GSC déjà là** : `/admin/seo` lit la Search Console et résume par section/requête/page (`src/lib/gsc.ts:81-122`, `src/app/admin/seo/page.tsx`).
- **Sitemap unique suffisant aujourd'hui** : ~6 000 URLs, très loin de la limite 50 000 (`src/app/sitemap.ts:12`). La remarque « switch to generateSitemaps once it nears 45k URLs » (`src/app/sitemap.ts:12`) est correcte.

### 1.2 Ce qui menace (constats précis)

**a) Le sitemap peut lister des pages noindex, et oublie des pages indexables.** La règle article du sitemap (`src/app/sitemap.ts:24-26`) est *presque* celle de la page (`src/app/article/[id]/page.tsx:40-41`) mais pas exactement :
  - le sitemap joint `article_summaries` **sans tester `texte_sha`** (`src/app/sitemap.ts:25`), alors que la page n'affiche un résumé que si le texte n'a pas changé (`src/lib/articles.ts:7-15`). Un résumé devenu obsolète après ré-ingestion met l'URL au sitemap alors que la page passe `robots: { index: false }` → **sitemap et noindex se contredisent**.
  - la page indexe un article cité par une **lettre** (`lettresForArticle`, `src/app/article/[id]/page.tsx:41`) ; le sitemap, lui, ne regarde que les FAQ (`src/app/sitemap.ts:24`). Ces pages sont indexables mais absentes du sitemap.
  - Conclusion : les deux règles doivent venir d'**une seule fonction partagée** (voir §3).

**b) `/article/<id>/jurisprudence` est indexable sans aucun garde-fou.** `generateMetadata` ne met noindex que si `?avant=` est présent (`src/app/article/[id]/jurisprudence/page.tsx:29`) ; elle n'applique **pas** la règle d'indexabilité de l'article parent ni la présence d'un résumé. Une page article noindex (texte brut) avec >6 décisions produit donc une liste indexable. La page article ne lie cette liste que si `total > 6` (`src/app/article/[id]/page.tsx:207-213`), soit ~3 820 articles d'après `article_stats.decisions > 6`, alors que le sitemap n'en déclare que 462. **Écart entre pages liées, pages indexables et pages déclarées.**

**c) `lastModified` global et faux.** Toutes les URLs reçoivent la mtime du fichier SQLite (`src/lib/seo.ts:111-117`, appliquée `src/app/sitemap.ts:16-17`). À chaque import de contenu, **6 000 URLs** déclarent une modification, même celles qui n'ont pas changé. Google apprend à ignorer un `lastmod` non fiable. Seuls les articles (`:51`) et décisions (`:46`) écrasent la date. Les hubs, FAQ, lettres, conventions, sujets héritent d'une date fausse.

**d) Tout est `force-dynamic`.** `article`, `article/[id]/jurisprudence`, `[theme]`, `[theme]/[faq]`, `sujets*`, `pour*`, `conventions/branche`, `relance-amiable`, `avocats` sont déclarés `dynamic = "force-dynamic"` (ex. `src/app/article/[id]/page.tsx:15`, `src/app/jurisprudence/[id]/page.tsx:10`). Chaque hit Googlebot rejoue les requêtes SQLite. Pas critique à 6 000 URLs, mais c'est du budget de crawl gaspillé et une latence TTFB inutile : le contenu ne change qu'à l'import (`importContent`, `src/lib/db.ts:412`). Un `revalidate` (comme `sitemap.ts:10` et `llms.txt/route.ts:3`) suffirait.

**e) URL article non lisible.** `/article/LEGIARTI000006901112`. Excellent pour la stabilité (l'ID Légifrance ne changera jamais), mauvais pour le CTR et le partage. **Ne pas changer le canonical** (les impressions observées portent sur ces URLs). Voir l'option alias 301 §2.4.

**f) `contact` indexable.** La page `/contact` n'a pas de `robots: { index: false }` (contrairement à `compte`, `connexion`, `merci`, `admin`, `pro/jurisprudence`). Détail, mais une page de formulaire vide qui s'indexe, c'est du thin content évitable.

**g) Contenu mince à l'échelle.** 101 981 articles, seuls 2 225 indexables ; 57 957 décisions, 2 356 indexables ; 16 807 articles ont de la jurisprudence (donc du contenu réel) mais ~14 500 restent noindex faute de résumé. C'est le **choix correct** (éviter 100 k pages de texte brut), mais c'est aussi la plus grosse réserve de croissance : chaque résumé `article_summaries` bien posé transforme une page noindex en page indexable à forte intention (« article 1643 code civil »).

**h) Requêtes observées non servies par une page dédiée.** « L3123-6 », « 1377 cc », « R111-22 code urbanisme », « article 2296 » sont des requêtes **numéro d'article**. Elles sont couvertes par la page article générique, mais rien ne cible spécifiquement la variante « 1643 cc », « article L3123-6 ». Aujourd'hui ce n'est **pas** un problème de duplication (ID unique) : c'est un problème de **matching** (titre/H1/metadata) et d'**absence d'alias lisible**. À traiter par métadonnées, pas par nouvelles URLs.

### 1.3 Duplication / facettes : verdict honnête

- Pas de navigation à facettes : aucune page `/recherche`, aucun paramètre `?theme=`, `?code=` indexable. **Risque de duplication facettée = nul aujourd'hui.**
- `faq.slug` est `UNIQUE` (`src/lib/db.ts:42`) et `faqUrl()` choisit **une** URL selon `topic` (`src/lib/themes.ts:74-76`) : une question n'existe qu'à une seule URL. Le chargement de `[theme]/[faq]` exige `topic IS NULL` (`src/app/[theme]/[faq]/page.tsx:19`) et `sujets/[topic]/[question]` exige `topic = ?` (`src/app/sujets/[topic]/[question]/page.tsx:19`). Étanche.
- Les hubs thème agrègent des questions de topics (`src/app/[theme]/page.tsx:26-35`) mais ne republient pas leur contenu intégral : pas de duplicate content.
- `mergeRepublished()` fusionne les décisions republiées (vérifié dans `scripts/check-legal-graph.ts`), donc pas de doublons de décisions.
- **Le vrai risque de duplication arrive avec les verticales à venir** (entreprise, adresse/bien) où plusieurs formes lexicales désignent la même entité (raison sociale vs enseigne, adresse vs parcelle). À cadrer **avant** de créer les routes (§2).

---

## 2. Architecture cible : une entité = une URL canonique

### 2.1 Route map complète

| Entité | URL canonique | Type JSON-LD | Fil d'Ariane | Indexable si |
|---|---|---|---|---|
| Article de loi | `/article/<id Légifrance>` *(inchangé)* | `Legislation` | Accueil › `<Code>` › Article N | règle §3.1 |
| Décision | `/jurisprudence/<id>` *(inchangé)* | `WebPage` (+ `citation` Legislation) | Accueil › Jurisprudence › citation | résumé rédigé |
| Liste jurisprudence article | `/article/<id>/jurisprudence` *(inchangé)* | `CollectionPage` + `ItemList` | Accueil › Article N › Jurisprudence | article indexable **et** ≥1 décision ; `?avant=` noindex |
| Question (topic) | `/sujets/<topic>/<question>` *(inchangé)* | `Article` + `FAQPage` | Accueil › Sujets › Topic › Question | toujours (contenu rédigé) |
| Sujet (topic) | `/sujets/<topic>` *(inchangé)* | `CollectionPage` + `FAQPage` | Accueil › Sujets › Topic | toujours |
| FAQ de thème | `/<theme>/<slug>` *(inchangé)* | `Article` + `FAQPage` | Accueil › Thème › Question | toujours |
| Lettre | `/modeles-lettres/<slug>` *(inchangé)* | `WebPage` (+ `HowTo` proposé) | Accueil › Modèles › Groupe? › Lettre | toujours |
| Métier | `/pour/<slug>` *(inchangé)* | `CollectionPage` + `FAQPage` | Accueil › Pour les pros › Métier | toujours |
| Convention | `/conventions/branche/<slug>` *(inchangé)* | `Legislation` | Accueil › Conventions › Branche | toujours |
| **Entreprise** | `/entreprise/<siren>` *(nouveau)* | `Organization` | Accueil › Entreprises › `<siren>` | règle §3.5 |
| **Bien / adresse** | `/bien/<id>` (BAN/IDU/DPE) *(nouveau)* | `Place` (+ `PostalAddress`, `geo`) | Accueil › Biens › `<id>` | règle §3.6 |
| **Outil / calculateur** | `/outils/<slug>` *(nouveau)* | `WebApplication` (+ `HowTo`/`FAQPage`) | Accueil › Outils › Nom | règle §3.7 |
| Hub entreprise | `/entreprise` | `CollectionPage` + `ItemList` | Accueil › Entreprises | liste d'entités indexables seulement |
| Hub bien | `/bien` | `CollectionPage` | Accueil › Biens | idem |
| Hub outils | `/outils` | `CollectionPage` + `ItemList` | Accueil › Outils | toujours |
| Hub conventions | `/conventions` *(existant via `[theme]`)* | `CollectionPage` | Accueil › Conventions | toujours |

> **Piège de routage** : `[theme]` est un segment dynamique racine (`src/app/[theme]/page.tsx`). Tout nouveau hub top-level (`/entreprise`, `/bien`, `/outils`) **doit** être un dossier statique, sinon il est intercepté comme thème puis `notFound()` (`src/app/[theme]/page.tsx:62-63`). Un dossier statique gagne la priorité — c'est déjà le cas de `/conventions/branche` face à `[theme]`.

### 2.2 Old → new et redirections (sans casser l'existant)

Aucune page actuellement indexée ne change d'URL. Les redirections ci-dessous sont **uniquement des alias** vers des canonicals existants ou nouveaux, à poser dans `next.config.ts` (`redirects()`, absent aujourd'hui) ou en route handlers `permanentRedirect`. Elles doivent renvoyer **301**.

| Ancien / variante | Cible 301 | Raison |
|---|---|---|
| `/conventions/<idcc>` (ex. `/conventions/1486`) | `/conventions/branche/syntec` | IDCC en mot-clé très recherché |
| `/conventions/<slug>` (sans `branche`) | `/conventions/branche/<slug>` | éviter un futur doublon |
| `/article/<code>/<num>` (lisible) | `/article/<id>` | alias humain **jamais canonical** (§2.4) |
| `/siren/<siren>`, `/societe/<siren>` | `/entreprise/<siren>` | verticale entreprise |
| `/adresse/<id>` | `/bien/<id>` | verticale bien |
| `/calculateurs/<slug>` | `/outils/<slug>` | verticale outils |
| `/jurisprudence/<id>/<sous-page>` | pas de sous-route | garder la décision sur une seule URL |

**Ce qu'il ne faut pas faire** : rediriger `/article/LEGIARTI…` vers une URL lisible. Les impressions observées portent sur `/article/LEGIARTI…` ; un changement de canonical casserait les signaux accumulés. L'alias lisible est un **301 entrant**, le canonique reste l'ID opaque.

### 2.3 Règle « une entité = une URL » pour les verticales

- **Entreprise** : clé canonique = **SIREN** (9 chiffres, stable, unique). La raison sociale, l'enseigne, le nom commercial et le sigle sont des **attributs de la même page**, pas des URLs. Pas de `/entreprise/<nom>`. Si un alias nom est utile : 301 vers `/entreprise/<siren>`.
- **Bien / adresse** : clé canonique = identifiant stable et unique de la source (`id` BAN pour une adresse, `IDU` pour une parcelle, n° DPE pour un diagnostic). Jamais `/bien/<adresse-en-clair>` (variantes « 12 rue X », « 12 rue X 75011 », « 12, rue X »).
- **Outil** : clé = `slug` éditorial unique par intention (« calcul-preavis-location », « surface-plancher-extension »). Un outil = une réponse déterministe = une URL.

### 2.4 Alias lisibles d'articles (option, non bloquante)

Objectif : servir « article 1643 code civil » et « 1643  », sans créer de doublon.
- Canonical **inchangé** : `/article/<id>`.
- Alias `GET /article/<code-slug>/<num>` → `permanentRedirect(`/article/${id}`)` (301). Le code route existe déjà partiellement puisque `[theme]` occupe le premier segment : `/article/code-civil/1643` doit être une **route statique dédiée** sous `app/article/` ou un matching explicite dans `[id]` (le plus simple : un dossier `app/article/[...alias]/route.ts` qui résout `code + num` via `getArticleByNum` (`src/lib/search.ts:98-100`) puis 301).
- Aucun `canonical` vers l'alias, jamais. Aucun sitemap d'alias.
- Métadonnées : le titre de la page article contient déjà « Article 1643 du Code civil expliqué » (`src/app/article/[id]/page.tsx:35`) et le H1 « Article 1643 » (`:100`). Les variantes « cc », « C. civ. » sont donc couvertes par le texte, pas par des URLs.

---

## 3. SEO_ELIGIBLE : règles déterministes par type d'entité

Concept : une page **peut exister** et être crawlée (`index: false, follow: true`) mais n'est **publiée en sitemap et indexable** que si elle franchit un seuil de valeur déterministe, calculé sur des données présentes en base (jamais par IA). Aujourd'hui ces règles sont dispersées et divergent ; elles doivent vivre dans **une fonction unique** `isIndexable(entity)` consommée à la fois par `generateMetadata` et par le sitemap.

### 3.1 Article (`/article/<id>`)
Indexable **si et seulement si** (reprend et unifie `src/app/article/[id]/page.tsx:40-41` + `src/app/sitemap.ts:24-26`) :
1. au moins une FAQ cite l'article (`faq.article_ids` contient l'id), **OR**
2. au moins une lettre le cite (`lettresForArticle`, `src/lib/lettres.ts:53-54`), **OR**
3. un résumé **frais** existe (`articleSummary` avec `texte_sha` à jour, `src/lib/articles.ts:7-15`) **ET** ≥1 décision liée (`decision_articles`).

Non indexable sinon (`robots: { index: false, follow: true }`). Correctif : le sitemap doit réutiliser cette même fonction, y compris le test `texte_sha` et les lettres.

### 3.2 Décision (`/jurisprudence/<id>`)
Indexable **si** une ligne `decision_summaries` existe (`src/app/jurisprudence/[id]/page.tsx:18-22`). Sinon noindex (texte brut dupliqué de Légifrance). Règle conservée telle quelle : elle est bonne.

### 3.3 Liste jurisprudence (`/article/<id>/jurisprudence`)
Indexable **si** l'article parent est indexable (§3.1) **ET** `article_stats.decisions >= 1`. `?avant=` → noindex. Correctif : appliquer la condition parente (aujourd'hui absente, `src/app/article/[id]/jurisprudence/page.tsx:29`).

### 3.4 Question / Sujet / FAQ / Lettre / Métier / Convention
Indexable si la page a **un contenu rédigé propre** (c'est déjà le cas) : `answer_md` non vide pour une question, `intro` + FAQ liées pour un topic, lettre avec corps + conseils, métier avec obligations, convention avec ≥1 FAQ liée **ou** ≥1 article cité. Aujourd'hui ces pages sont toutes indexables, à raison : leur contenu est éditorial, pas du texte légal brut. Ne pas introduire de noindex ici.

### 3.5 Entreprise (`/entreprise/<siren>`) — à construire
Indexable **si** :
1. le SIREN est **actif** et la source officielle (INSEE/INPI) a été ingérée avec `provenance.verified_at` renseigné (`src/lib/db.ts:245-259`), **ET**
2. au moins **un** contenu Loilà est rattaché : ≥1 décision où l'entité est partie (via un futur `decision_parties`), **OR** ≥1 annonce/obligation vérifiée, **OR** ≥1 résumé rédigé.

Sinon `noindex, follow`. Interdit : indexer des millions de fiches SIREN brutes (thin content, zéro valeur ajoutée par rapport à l'Annuaire des entreprises).

### 3.6 Bien / adresse (`/bien/<id>`) — à construire
Indexable **si** ≥1 élément de contenu Loilà spécifique existe : un diagnostic (DPE, amiante…), **OR** une obligation/contrainte (zone PLU, risque), **OR** un résumé rédigé. Sinon `noindex, follow`. Interdit : indexer une adresse pour elle-même.

### 3.7 Outil (`/outils/<slug>`) — à construire
Indexable **si** l'outil produit un résultat déterministe, **cité** par au moins un article de loi (`article_ids` non vide − référence), **ET** affiche le calcul (pas un formulaire vide). Un formulaire sans résultat rendu = non indexable. Sinon `noindex, follow`.

### 3.8 Contrat de données
Toute règle ci-dessus doit être exprimable en SQL sur des colonnes existantes/futures, sans appel IA. Recommandation : exposer ces requêtes comme vues/`SELECT` dans un module `src/lib/eligibility.ts` (à créer plus tard), consommé par `sitemap.ts` et les `generateMetadata`. Test : un script `check-seo.ts` assertant qu'aucune URL du sitemap ne renvoie `robots.noindex` et réciproquement (voir §8).

---

## 4. Sitemaps : architecture cible et API Next.js 16 exacte

### 4.1 Pourquoi et quand découper

- Limite dure : **50 000 URLs par sitemap** (documentée dans `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-sitemaps.md:39`).
- Aujourd'hui ~6 000 URLs → **un seul sitemap suffit**. `src/app/sitemap.ts` est correct.
- Le découpage devient nécessaire quand (a) on approche 45–50 k URLs (le commentaire `src/app/sitemap.ts:12` le dit), ou (b) on veut **diagnostiquer par section dans la Search Console** (un sitemap par type = couverture et erreurs par section).
- Projection : si 14 500 articles supplémentaires passent indexables (résumés), on reste sous 25 k. Le découpage reste surtout **opérationnel**, pas vital.

### 4.2 Architecture cible (quand le volume le justifiera)

Sitemaps séparés par type d'entité :
- `sitemap-pages` : accueil, hubs, `a-propos`, `tarifs`, `cgv`, `mentions-legales`, `pour`, `sujets`, `modeles-lettres`, `relance-amiable`, `avocats`, `outils`, `entreprise`, `bien`, `conventions`, thèmes.
- `sitemap-articles` : `/article/<id>` indexables.
- `sitemap-article-jurisprudence` : `/article/<id>/jurisprudence`.
- `sitemap-decisions` : `/jurisprudence/<id>`.
- `sitemap-sujets` : `/sujets/<topic>`, `/sujets/<topic>/<question>`.
- `sitemap-faq` : `/<theme>/<slug>`.
- `sitemap-tools`, `sitemap-companies`, `sitemap-agreements`.

### 4.3 API Next.js 16 exacte (citer le doc)

**Deux mécanismes**, documentés dans `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/sitemap.md:332-394` :

1. **Sitemaps imbriqués** (recommandé ici, simple) : un fichier `sitemap.ts` dans un segment de route, ex. `app/article/sitemap.ts` → `/article/sitemap.xml`. Citation : `sitemap.md:338` (« By nesting `sitemap.(xml|js|ts)` inside multiple route segments »).
2. **`generateSitemaps`** (pour paginer un même type) : `sitemap.md:341-394` et `generate-sitemaps.md`. La fonction exporte `generateSitemaps()` qui retourne `[{ id }]` ; les fichiers générés sont servis sous `/.../sitemap/[id].xml` (`generate-sitemaps.md:20`).

**Changement cassant Next 16** : l'`id` est désormais une **promesse** résolue en `string`, pas une valeur :
```ts
// génération des entrées
export async function generateSitemaps() { return [{ id: 0 }, { id: 1 }] }

// Next 16 : id est un Promise<string>
export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = await props.id
  ...
}
```
Source : `generate-sitemaps.md:35-49` et `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md:354-378` (« Starting with Next.js 16, the sitemap generating function now receives `id` as a promise »). Vérifié dans l'implémentation : `next-metadata-route-loader.js:252-280` (`params?.__metadata_id__`, `await idPromise`).

**Point important** : `generateSitemaps` génère `/sitemap/<id>.xml` mais **pas** d'index `/sitemap.xml`. Or `robots.ts` pointe sur `${SITE_URL}/sitemap.xml` (`src/app/robots.ts:14`). Il faut donc :
- soit garder un `sitemap.ts` racine pour le « noyau » et pointer `robots.sitemap` vers le tableau des sitemaps découpés ;
- `MetadataRoute.Robots.sitemap` accepte `string | string[]` (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/robots.md:194`). C'est l'API à utiliser pour déclarer plusieurs sitemaps sans index.

**Squelette cible** (à écrire uniquement quand le volume le justifiera) :
```
app/
  sitemap.ts                    → /sitemap.xml : pages "noyau" (hubs, légal, lettres, conventions)
  article/sitemap.ts            → /article/sitemap.xml (articles indexables + listes juri)
  jurisprudence/sitemap.ts      → /jurisprudence/sitemap.xml (décisions indexables)
  sujets/sitemap.ts             → /sujets/sitemap.xml
  ... (tools/, companies/, agreements/ au moment des verticales)
```
puis `robots.ts` : `sitemap: [abs("/sitemap.xml"), abs("/article/sitemap.xml"), abs("/jurisprudence/sitemap.xml"), abs("/sujets/sitemap.xml")]`.

Si un type dépasse 50 k : passer ce seul fichier à `generateSitemaps` avec des ids `"article-0"…`, et lister chaque URL `/article/sitemap/<id>.xml` dans `robots.sitemap`.

**Vérification faite** : `generateStaticParams` du loader produit `__metadata_id__` + `.xml` (`next-metadata-route-loader.js:291-302`), donc les URLs sont bien `/.../sitemap/<id>.xml` — pas d'index automatique. Ne pas supposer le contraire.

---

## 5. Structured data par type d'entité (JSON-LD exact)

Ce qui existe est bon ; voici ce qu'il faut garder et ce qu'il faut ajouter.

### 5.1 Article — `Legislation` (existant, `src/app/article/[id]/page.tsx:66-81`)
```json
{
  "@context": "https://schema.org",
  "@type": "Legislation",
  "name": "Article 1643 du Code civil",
  "legislationIdentifier": "LEGIARTI000006438685",
  "legislationJurisdiction": "FR",
  "legislationLegalForce": "InForce",
  "inLanguage": "fr-FR",
  "legislationDate": "1804-03-15",
  "url": "https://loila.fr/article/LEGIARTI…",
  "isBasedOn": "https://www.legifrance.gouv.fr/codes/article_lc/…",
  "sameAs": "https://www.legifrance.gouv.fr/codes/article_lc/…",
  "text": "Les vices cachés…",
  "abstract": "Résumé Loilà",
  "isPartOf": { "@type": "Legislation", "name": "Code civil", "legislationIdentifier": "LEGITEXT000006070721" }
}
```
Note honnête : `Legislation` **n'est pas** un type à rich result Google. Il sert l'entité et les moteurs IA (GEO). Le garder.

### 5.2 Décision — `WebPage` + `citation` (existant, `src/app/jurisprudence/[id]/page.tsx:52-61`)
Conserver. Ajouter `datePublished: d.date` et `about` (liste des articles cités, déjà fait via `citation`). Il n'existe pas de type schema.org officiel de décision de justice ; ne pas inventer de faux type.

### 5.3 Question FAQ — `Article` + `FAQPage` (existant, `src/app/[theme]/[faq]/page.tsx:41-58` et `src/app/sujets/[topic]/[question]/page.tsx:40-57`)
Conserver. `FAQPage` n'a plus de rich result généraliste chez Google (réservé santé/gouvernement) mais reste utile pour les IA. Ne pas compter dessus pour du trafic.

### 5.4 Convention — `Legislation` (existant, `src/app/conventions/branche/[slug]/page.tsx:72-83`)
Conserver. `legislationIdentifier: "IDCC 1486"` est correct.

### 5.5 Entreprise — `Organization` (à créer)
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Raison sociale",
  "alternateName": "Enseigne / sigle",
  "identifier": { "@type": "PropertyValue", "propertyID": "SIREN", "value": "123456789" },
  "legalName": "Raison sociale",
  "vatID": "FR…",
  "url": "https://loila.fr/entreprise/123456789",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "…",
    "postalCode": "75011",
    "addressLocality": "Paris",
    "addressCountry": "FR"
  },
  "sameAs": ["https://annuaire-entreprises.data.gouv.fr/entreprise/123456789"],
  "knowsAbout": [{ "@type": "Legislation", "name": "Article L1234-9 du Code du travail", "url": "…" }]
}
```
`@type: Corporation` possible si société commerciale ; `Organization` est le plus sûr par défaut.

### 5.6 Bien / adresse — `Place` (à créer)
```json
{
  "@context": "https://schema.org",
  "@type": "Place",
  "name": "12 rue de la Paix, 75002 Paris",
  "url": "https://loila.fr/bien/<id>",
  "address": { "@type": "PostalAddress", "streetAddress": "12 rue de la Paix", "postalCode": "75002", "addressLocality": "Paris", "addressCountry": "FR" },
  "geo": { "@type": "GeoCoordinates", "latitude": 48.869, "longitude": 2.331 },
  "sameAs": ["https://www.data.gouv.fr/…/ban/…"]
}
```

### 5.7 Outil — `WebApplication` + `HowTo` / `FAQPage` (à créer)
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Calcul du préavis de départ d'un logement",
  "url": "https://loila.fr/outils/calcul-preavis-location",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "inLanguage": "fr-FR",
  "isAccessibleForFree": true,
  "about": [{ "@type": "Legislation", "name": "Article 15 de la loi du 6 juillet 1989", "url": "…" }],
  "publisher": { "@type": "Organization", "name": "Loilà", "url": "https://loila.fr" }
}
```
Ajouter `HowTo` (étapes du calcul) et/ou `FAQPage` (mêmes règles que §5.3).

### 5.8 Hubs — `CollectionPage` + `ItemList` (à généraliser)
`ItemList` est déjà utilisé sur `/modeles-lettres` (`src/app/modeles-lettres/page.tsx:29-33`). Le généraliser aux hubs `/entreprise`, `/bien`, `/outils`, `/sujets` avec `@type: "CollectionPage"` + `mainEntity: ItemList`.

### 5.9 Règle transverse
Toujours embarquer `BreadcrumbList` (déjà via `breadcrumbJsonLd`, `src/lib/seo.ts:81-92`) et un seul `@context`. Ne jamais dupliquer `FAQPage` sur une page qui n'affiche pas les questions.

---

## 6. Search / Loilà Pro

### 6.1 Audit SQLite vs alternatives

**Ce qui existe et fonctionne :**
- Trois index FTS5 en *external content* avec triggers de synchronisation : `articles_fts(num, section, texte)` (`src/lib/db.ts:23-36`), `faq_fts (question, short)` (`:49-62`), `decisions_fts(titre, sommaire, texte)` (`:212-225`). Tokenizer `unicode61 remove_diacritics 2` partout.
- Ranking **bm25 pondéré** : articles `bm25(2.0, 1.5, 1.0)` (`src/lib/search.ts:90`), décisions `bm25(5, 3, 1)` (`src/lib/legal-search.ts:72`). Pondérations saines (num > section > texte ; titre > sommaire > texte).
- Snippets natifs `snippet(...)` avec marqueurs (`search.ts:87`, `legal-search.ts:69`, `decisionPassages` `:90-94`).
- **Graphe juridique relationnel** exploité : `decision_articles` (index `decision_articles_article`, `src/lib/db.ts:211`), `article_relations` (co-citation cosine-Ochiai, `:300-313`), `decision_relations`, `article_stats`, `citations` (1,28 M) avec statut `resolved/unknown/historical/versioned`.
- Pagination par curseur (keyset) sur dates (`legal-search.ts:62-66`, `decisions.ts:121-132`), pas d'OFFSET coûteux.
- **Un banc d'évaluation existe** : `scripts/check-retrieval.ts` mesure `recall@8` et « decisive passage in prompt » sur 26 cas réels, avec expansions mises en cache. C'est l'outil de décision.

**Ce que PostgreSQL apporterait :**
- Un vrai stemmer français (Snowball) → « licencier » matcherait « licenciement ». Aujourd'hui compensé par l'expansion LLM (`expandQuery`, `src/lib/ask.ts:97-111`) et `EXPAND` manuel (`src/lib/search.ts:17-22`).
- `tsvector` pondéré + `ts_rank_cd`, GIN. Performance comparable à FTS5 à ce volume.
- `pgvector` pour un retrieval sémantique ; `pg_trgm` pour fautes de frappe/substrings.
- Concurrence en écriture et réplicas de lecture.

**Faut-il pgvector / Elasticsearch ? Réponse : non, pas aujourd'hui.** Arguments factuels :
1. Volume petit : 2 225 articles indexables, 2 356 décisions résumées, 793 FAQ. Même le corpus complet (102 k articles) reste à l'échelle de SQLite FTS5 en local, sans I/O réseau.
2. `pg_trgm` est remplaçable **dans SQLite** : le tokenizer FTS5 `trigram` est disponible dans le binaire déployé. Testé : `CREATE VIRTUAL TABLE t USING fts5(x, tokenize='trigram')` puis `MATCH 'jour'` sur `bonjour` renvoie la ligne (SQLite 3.51.0, `PRAGMA compile_options` contient `ENABLE_FTS5`). On peut donc ajouter une table trigram pour la recherche floue de numéros d'articles **sans nouvelle infra**.
3. Le goulot n'est pas le moteur mais la **couverture** : le retrieval se joue sur l'expansion et le rerank (couverture de stems, `src/lib/ask.ts:215-225`), pas sur le moteur. Passer à Postgres ne corrige pas un recall manquant.
4. Coût / risque : un second système de stockage à opérer, synchroniser et sauvegarder (SQLite est ici monolithique et transactionnel avec les données utilisateur). Non justifié par les métriques.
- **Décision** : rester SQLite FTS5. Ajouter (a) une table FTS5 **trigram** d'articles pour la tolérance aux fautes et aux numéros, (b) un rérank optionnel (embeddings locaux ou LLM) **seulement si** `check-retrieval.ts` montre un `recall@8` insuffisant. Ne poser pgvector/ES que si un besoin mesuré (multilingue, >5 M docs, écriture concurrente forte) apparaît.

### 6.2 Pipeline cible de recherche

```
QUERY
  → QUERY PARSING        normalisation, langue, détection IDCC, numéros d'articles, thème
  → FILTERS              code, juridiction, formation, source, date, publié, n° de pourvoi
  → FULL TEXT            articles_fts / decisions_fts / faq_fts, bm25 pondéré
  → LEGAL GRAPH          décisions des articles retrouvés, co-citations, décisions liées
  → RELEVANT PASSAGES    snippets FTS + excerpt par densité (budget par rang)
  → SOURCES              lignes stockées (articles, décisions), citation() + URL
  → OPTIONAL LLM         rédaction contrainte aux sources (ask / askJuri)
  → CITED ANSWER         réponse avec repères [D1] et (art. X) cliquables
```

Mapping vers le code existant et **écarts** :

| Étape | Code existant | Écart / à faire |
|---|---|---|
| Parsing | `mentionedConventions` (`search.ts:63-70`), `toFtsQuery` (`search.ts:25-38`), `ftsQuery` (`legal-search.ts:31-34`), `expandQuery` (`ask.ts:97-111`) | `ftsQuery` ignore les mots <4 caractères (`legal-search.ts:32`) : « L3123-6 » se fragmente ; prévoir un parseur de numéros d'articles explicite (regex `[LRD]\.?\s?\d+`) commun aux deux moteurs |
| Filtres | `DecisionFilters` (`legal-search.ts:8-23`) — code, article, date, juridiction, formation, source, numéro, solution, publié | Complet. Manque un filtre **partie/entreprise** (à venir avec la verticale) |
| Full text | `searchArticles` (`search.ts:72-92`), `searchDecisions` (`legal-search.ts:36-82`) | Pas de stemmer FR : dépend de l'expansion. Rerank par couverture de stems (`ask.ts:215-225`) uniquement pour les articles, pas pour les décisions |
| Graphe | `decisionsForArticle`, `articleStats`, `coCitedByCaseLaw`, `relatedDecisions`, `decisionLinks` (`decisions.ts:56-157`) ; `findDecisions` (`juri-ask.ts:32-47`) | `findDecisions` interleave articles/décisions mais ne pondère pas le graphe ; pas d'exposition API publique du graphe |
| Passages | `decisionPassages` (`legal-search.ts:85-95`), `excerpt` + `excerptBudgets` (`ask.ts:124-178`) | `decisionPassages` ne renvoie que 2 snippets (a/b) ; le budget par rang n'est appliqué qu'aux articles |
| Sources | `articlesByIds` (`ask.ts:45-51`), `citation`/`decisionUrl` (`decisions.ts:39-41`) | OK |
| LLM | `ask` (`ask.ts:233-294`), `askJuri` (`juri-ask.ts:61-92`), `chat` (`lib/openrouter.ts`) | Contraint aux sources, vérifie les citations ; bien conçu |

### 6.3 API proposée pour Loilà Pro

Réutilise **tel quel** `searchDecisions` (`DecisionFilters`) et `searchArticles`. Nouvelle route `src/app/api/pro/search/route.ts` (mêmes garde-fous que `api/juri-ask` : `sameOrigin`, `rateLimited`, plan Pro ; `src/app/api/juri-ask/route.ts:10-31`).

**`GET /api/pro/search`** (lecture, cacheable) :
- `q` (string, requis) — question ou mots-clés.
- `scope` (`articles|decisions|all`, défaut `all`).
- `codes` (csv de slugs), `articleIds` (csv), `juridictions` (csv), `formations` (csv), `sources` (csv : `cass|inca|capp|jade|constit`), `numero`, `solution`, `publie` (bool), `since`, `until`.
- `passages` (`bool`, défaut `false`) — ajoute les extraits pertinents.
- `limit` (1–100, défaut 20), `offset` (ordre pertinence) ou `cursor` (ordre date).
- `expand` (`bool`, défaut `true` si Pro) — active `expandQuery`.

**Réponse** (forme stable, adossée aux lignes stockées) :
```jsonc
{
  "query": {
    "raw": "vice caché immobilier vendeur professionnel",
    "normalized": "vice cache immobilier vendeur professionnel",
    "fts": "\"vice\"* OR \"cache\"* OR \"immobilier\"* OR \"vendeur\"* OR \"professionnel\"*",
    "expansion": { "words": "garantie des vices cachés, …", "nums": ["1641", "1643"] },
    "conventions": []
  },
  "articles": [
    { "id": "LEGIARTI…", "num": "1643", "code": "code-civil", "codeName": "Code civil",
      "url": "/article/LEGIARTI…", "snippet": "…«vices cachés»…", "score": 12.4, "indexable": true }
  ],
  "decisions": [
    { "id": "JURITEXT…", "url": "/jurisprudence/JURITEXT…",
      "citation": "Cass. civ. 3e, 2 juillet 2025, n° 23-20.428",
      "juridiction": "Cour de cassation", "formation": "CHAMBRE_CIVILE_3",
      "date": "2025-07-02", "numero": "23-20428", "solution": "Rejet", "publie": 1,
      "snippet": "…«vices cachés»…", "summary": "Résumé Loilà ou null", "score": 9.1 }
  ],
  "passages": { "JURITEXT…": ["extrait 1", "extrait 2"] },
  "graph": {
    "coCited": [{ "id": "LEGIARTI…", "num": "1641", "code": "code-civil", "shared": 42, "score": 0.31 }],
    "relatedDecisions": [{ "id": "JURITEXT…", "citation": "…", "shared": 4 }]
  },
  "meta": { "tookMs": 18, "total": { "articles": 8, "decisions": 120 }, "next": "2024-03-01_JURITEXT…" }
}
```

- Le tableau `decisions` sort directement de `searchDecisions` (`legal-search.ts:36-82`) — mêmes colonnes, plus `url`/`citation` déjà calculés (`:80`).
- `passages` sort de `decisionPassages` (`legal-search.ts:85-95`) quand `passages=true`.
- `graph` sort de `coCitedByCaseLaw` (`decisions.ts:102-108`) et `relatedDecisions` (`decisions.ts:75-83`).
- Une variante **réponse rédigée** existe déjà : `POST /api/juri-ask` (`src/lib/juri-ask.ts:61-92`). La nouvelle API est l'étage *recherche* sous-jacent, réutilisable par l'UI Pro et par un futur mode RAG.

### 6.4 Limites à assumer par écrit

- **Pas de recherche sémantique** : deux formulations sans mots communs ne se rejoignent que via l'expansion LLM (payante, ~100 tokens/appel, `ask.ts:97-111`). Si `expand=false`, la qualité chute.
- **Pas de stemmer français** : « licencier » ≠ « licenciement » sans expansion.
- **bm25 non appris** : pas de re-ranking par feedback clics. Améliorable par un rérank local, pas par Elasticsearch.
- **SQLite mono-écrivain** : OK pour un service en lecture ; un usage Pro intensif en écriture (annotations, dossiers) devra être mesuré.
- **FTS sur décisions complètes** : 57 957 textes ; `snippet` sur `decisions_fts` est correct mais l'indexation d'un corpus 10× plus grand inviterait à revoir la mémoire. À ce stade, non.

---

## 7. Risques SEO et ce qu'il ne faut PAS faire

1. **Ne pas changer le canonical des articles** (`/article/LEGIARTI…`). Des impressions existent dessus. Toute migration vers une URL lisible doit être un 301 **entrant**, jamais un changement de canonique.
2. **Ne pas indexer les verticales en masse** (SIREN, adresses). Des millions de fiches brutes = thin content, risque de pénalité, dilution du crawl. `SEO_ELIGIBLE` (§3) est le garde-fou.
3. **Ne pas créer d'URLs par variante lexicale** (« 1643 cc », « article 1643 », « art. 1643 C. civ. »). Une entité = une URL. Les variantes sont du contenu, pas des routes.
4. **Ne pas laisser `FAQPage` sur des pages qui n'affichent pas les questions**, ni dupliquer le même `FAQPage` sur un hub et ses enfants.
5. **Ne pas publier un sitemap contenant des pages noindex** (bug actuel potentiel, §1.2a). Un sitemap n'est pas une liste de souhaits : il doit valider la même règle que `generateMetadata`.
6. **Ne pas garder `lastModified = mtime(DB)` pour tout** : un `lastmod` non fiable est ignoré par Google et fait perdre l'effet du signal.
7. **Ne pas mettre `force-dynamic` par défaut** sur des pages dont le contenu ne change qu'à l'import. Cela consomme du budget de crawl et dégrade le TTFB.
8. **Ne pas bloquer les crawlers IA** : `robots.ts:5-11` est volontairement ouvert. Le maintenir.
9. **Ne pas introduire pgvector/Elasticsearch « par défaut »** : aucune donnée ne le justifie (§6.1). Toute introduction doit être conditionnée à une métrique (`check-retrieval.ts`).
10. **Ne pas confondre pagination et pages indexables** : toute page 2+ doit rester noindex + canonical vers la page 1 (déjà fait, `article/[id]/jurisprudence/page.tsx:29-30`). À reproduire pour les nouveaux hubs.

---

## 8. Quick wins mesurables vs chantiers lourds

### 8.1 Quick wins (jours, mesurables en GSC)

| # | Action | Fichier(s) | Mesure |
|---|---|---|---|
| 1 | **Unifier `SEO_ELIGIBLE`** en une fonction unique consommée par `generateMetadata` et `sitemap.ts`, incluant le test `texte_sha` et les lettres | `src/app/article/[id]/page.tsx:40-42`, `src/app/sitemap.ts:22-34`, `src/lib/articles.ts:7-15` | 0 URL du sitemap en noindex (test `check-seo.ts`) ; indexables gagnés |
| 2 | **Corriger l'indexabilité des listes jurisprudence** (hériter de l'article parent) | `src/app/article/[id]/jurisprudence/page.tsx:23-29` | pages « Explorée, non indexée » en baisse ; pas de thin content |
| 3 | **`lastModified` fiable** : date réelle par entité (article = `date_debut`, décision = `date`, hub = date d'édition), pas la mtime DB | `src/app/sitemap.ts:16-17` | taux de ré-analyse GSC ; fraîcheur des impressions |
| 4 | **Noindex `/contact`** | `src/app/contact/page.tsx` | une page thin en moins |
| 5 | **Passer les pages de contenu en `revalidate`** (ex. 3600 s) au lieu de `force-dynamic`, l'import invalidant déjà | `src/app/article/[id]/page.tsx:15` etc. | TTFB, budget de crawl |
| 6 | **Alias 301 lisibles d'articles** (`/article/<code>/<num>` → `/article/<id>`) | `app/article/…` ou `next.config.ts` | CTR sur requêtes « article <num> », liens entrants propres |
| 7 | **Aligner le sitemap et `robots.ts`** : préparer `sitemap: string[]` | `src/app/robots.ts:14` | prêt pour le découpage |
| 8 | **Annoter les requêtes en échec dans GSC** (numéros, « cc ») et vérifier le titre/H1 de la page cible | `src/app/admin/seo/page.tsx` | position moyenne sur les requêtes numéro |

### 8.2 Chantiers lourds (semaines, à séquencer)

| # | Chantier | Dépendances | Mesure de succès |
|---|---|---|---|
| A | **Génération massive de `article_summaries`** (les 16 807 articles avec jurisprudence) | batch LLM + `texte_sha` (`src/lib/articles.ts`) | +X pages indexables, impressions sur « article <num> <code> » |
| B | **Découpage sitemap + API Next 16 `generateSitemaps`** (§4.3) | fonctions `SEO_ELIGIBLE` unifiées | couverture GSC par section, erreurs localisées |
| C | **Verticale entreprise** : schéma (`companies`, `decision_parties`), route `/entreprise/<siren>`, `Organization`, règle §3.5 | ingestion INSEE/INPI + `decision_parties` | pages indexables et non thin ; CTR sur requêtes de sociétés |
| D | **Verticale bien/adresse** : `places`, route `/bien/<id>`, `Place`, règle §3.6 | BAN/DPE/cadastre | idem |
| E | **Verticale outils** : `/outils/*`, `WebApplication` + `HowTo`, règle §3.7 | calculateurs déterministes sourcés | requêtes « calcul … », backlinks |
| F | **Résumés de décisions** au-delà des 2 356 actuelles | batch + provenance | décisions indexables, trafic longue traîne jurisprudence |
| G | **API Pro `/api/pro/search`** (§6.3) + FTS trigram + rérank mesuré | `searchDecisions` réutilisé, `check-retrieval.ts` | recall@8, latence p95, adoption Pro |
| H | **`check-seo.ts`** : assertions sitemap↔noindex, canonical unique par entité, JSON-LD valide | `SEO_ELIGIBLE` | CI verte, zéro régression |

---

## Annexe — synthèse des fichiers audités

- SEO : `src/lib/seo.ts`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/lib/llms.ts`, `src/app/llms.txt/route.ts`, `src/app/llms-full.txt/route.ts`, `src/app/layout.tsx`
- Routes d'entités : `src/app/article/[id]/page.tsx`, `src/app/article/[id]/jurisprudence/page.tsx`, `src/app/jurisprudence/page.tsx`, `src/app/jurisprudence/[id]/page.tsx`, `src/app/[theme]/page.tsx`, `src/app/[theme]/[faq]/page.tsx`, `src/app/sujets/**`, `src/app/pour/**`, `src/app/modeles-lettres/**`, `src/app/conventions/branche/[slug]/page.tsx`, `src/app/relance-amiable/page.tsx`, `src/app/avocats/page.tsx`
- Search : `src/lib/legal-search.ts`, `src/lib/decisions.ts`, `src/lib/search.ts`, `src/lib/ask.ts`, `src/lib/articles.ts`, `src/lib/legal-graph.ts`, `scripts/check-retrieval.ts`, `scripts/check-search.ts`, `scripts/check-legal-graph.ts`
- Données : `src/lib/db.ts` (schéma complet)
- Instrumentation : `src/app/admin/seo/page.tsx`, `src/lib/gsc.ts`
- Docs Next.js 16 lues : `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-sitemaps.md`, `…/03-file-conventions/01-metadata/sitemap.md`, `…/01-metadata/robots.md`, `…/02-guides/upgrading/version-16.md` ; implémentation : `node_modules/next/dist/build/webpack/loaders/next-metadata-route-loader.js`
