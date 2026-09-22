# Loilà — Catalogue des sources de données (open data)

> Document de référence consolidé. Sources : `docs/research/2026-09-companies.md`,
> `docs/research/2026-09-real-estate.md`, `docs/research/2026-09-labour.md`,
> `docs/research/2026-09-open-data-catalog.md`, `docs/research/2026-09-seo-search.md`,
> `docs/OPEN_DATA_ROADMAP.md` et le registre runtime `src/lib/sources.ts`.
> Toutes les URLs et statuts HTTP cités dans les recherches ont été vérifiés en direct (`curl`) le 21/09/2026.
> Le registre runtime (`src/lib/sources.ts`) fait foi pour ce qui est réellement câblé.

---

## 1. Comment Loilà utilise l'open data

Principes (décisions d'architecture, `docs/OPEN_DATA_ROADMAP.md` §2) :

1. **Sources officielles d'abord.** Chaque donnée vient d'un producteur public (DINUM, DILA, ADEME,
   MTE, IGN, DGFiP, BRGM, INSEE, Ministère de la Justice), sous **Licence Ouverte 2.0 / fr-lo** dans
   la quasi-totalité des cas. Les sources à clé ou à habilitation (INSEE SIRENE, INPI RNE, API
   Entreprise) ne sont pas utilisées en live.
2. **Cache SQLite obligatoire.** Aucun appel API externe au rendu d'une page. Les entités « live »
   (entreprise, adresse) sont enrichies par des scripts (`scripts/open-data-*.ts`) et lues en base.
   Une page affiche « à rafraîchir » si le cache est absent/périmé, jamais un appel bloquant.
3. **`source_records`** = modèle commun de provenance runtime (`src/lib/sources.ts`) : `provider`,
   `dataset`, `external_id`, `official_url`, `retrieved_at`, `published_at`, `updated_at`, `licence`,
   `checksum` (SHA-256 du payload), `expires_at` (TTL). Chaque affirmation affichable remonte à sa source.
4. **Couche d'entités** (`src/lib/entities.ts`) : `entities` + `entity_ids` donnent un identifiant
   interne unique par entité réelle ; un SIREN cité par BODACC, la DSN et l'API n'est jamais dupliqué.
5. **Match quality explicite** : `CERTAIN` / `PROBABLE` / `POSSIBLE` / `UNKNOWN`
   (`src/lib/sources.ts:17`). Un match `POSSIBLE` (ex. DVF par adresse) n'est jamais présenté comme
   une preuve.
6. **RGPD** : on indexe la fiche entreprise, jamais un annuaire de personnes. Dirigeants non stockés,
   non-diffusibles exclus, pas de jointure adresse ↔ personne (voir §4).
7. **SEO_ELIGIBLE** : une fonction unique décide l'indexabilité (métadonnées = sitemap). Une fiche
   vide ne devient jamais indexable (`docs/research/2026-09-seo-search.md` §3).

---

## 2. Tableau maître des sources

### 2.1 Sources intégrées (registre `src/lib/sources.ts`)

TTL = durée du cache local (`expires_at`). `0` = import batch sans TTL.

| Organisme | Dataset / API | URL + doc | Licence | Auth / rate-limits | Fréquence | Identifiants | Données perso | Répub. / indexation | Usage Loilà | Statut |
|---|---|---|---|---|---|---|---|---|---|---|
| DINUM | API Recherche d'entreprises | `recherche-entreprises.api.gouv.fr` · doc `/docs/` | LOV2 (code MIT) | aucune clé · 7 req/s/IP, 30 req/s/ASN (429) | quotidien (SIRENE/RNE) | SIREN, SIRET, NAF/APE, IDCC, FINESS, UAI, RNA, RNF, TVA, EPCI | dirigeants (nom, prénoms, année naissance) — minimisés | autorisée (mention source) | colonne vertébrale entreprise : identité, état, NAF, établissements, IDCC déclarés, drapeaux (`est_rge`, `egapro_renseignee`…) | **intégré** (TTL 30 j) |
| DINUM | Référentiel IDCC (`/idcc/metadata`) | `recherche-entreprises.api.gouv.fr/idcc/metadata` | LOV2 | aucune clé | quotidien | IDCC (non zéro-padded → normaliser), `id_kali` | aucune | autorisée | `collective_agreements` : titre, état, conteneur KALI par IDCC | **intégré** (import, `open-data:idcc`) |
| DILA | BODACC (annonces commerciales) | `bodacc-datadila.opendatasoft.com` · dataset `annonces-commerciales` | fr-lo | aucune clé · quota 5 M/j (reset quotidien) | quotidien | SIREN (`registre`, 2 formats), SIRET/n° RCS, greffe | `listepersonnes` (dirigeants/liquidateurs) — journal officiel public | autorisée (mention source) | procédures collectives (`familleavis=collective`), radiations, dépôts de comptes | **intégré** (TTL 1 j) |
| ADEME | Liste des entreprises RGE | `data.ademe.fr/datasets/liste-des-entreprises-rge-2` · API data-fair | LOV2 | aucune clé · usage raisonnable | quotidien | SIRET, `code_qualification`, `domaine`, `organisme` | téléphone/email d'établissement (pro) | autorisée | certification RGE par SIRET (1-N par domaine/qualification) | **intégré** (TTL 7 j) |
| MTE | Conventions collectives par entreprise (DSN) | `data.gouv.fr/datasets/liste-des-conventions-collectives-par-entreprise-siret` · CSV ~99 Mo | LOV2 | aucune clé · import batch | ponctuel, retard de plusieurs mois | SIRET, IDCC, `MOIS`, `DATE_MAJ` | aucune | autorisée | IDCC **CERTAIN** (déclaratif DSN) ; `9999` = non déclaré | **intégré** (import) |
| DILA | KALI (textes des conventions) | `echanges.dila.gouv.fr/OPENDATA/KALI/` · miroir git `tricoteuses.fr/dila/kali` | fr-lo | libre, sans compte | quotidien | `KALICONT`, `KALITEXT`, `KALIARTI`, `KALISCTA` | aucune | autorisée | textes des 18 CCN déjà ingérées ; grilles de salaires (tables HTML) | **intégré** (import) |
| IGN / DINUM | BAN + géocodage (Géoplateforme) | `data.geopf.fr/geocodage/` (successeur d'`api-adresse`, déprécié au 31/01/2026) | LOV2 | aucune clé · 50 req/s/IP | continu (BAN quotidienne, index 2×/sem.) | `id`/`banId`/`idban`, `citycode`, x/y Lambert-93 | aucune | autorisée | pivot adresse : normalisation, coordonnées, clé de jointure de toute la verticale immobilier | **intégré** (TTL 90 j) |
| IGN | Cadastre (API Carto) | `apicarto.ign.fr/api/cadastre` | LOV2 | aucune clé · WFS 30 req/s/IP | continu (trimestriel) | `idu` 14 car., section, numéro, contenance | aucune (pas de propriétaires dans le PCI ouvert) | autorisée | pivot parcelle : coordonnées → `idu` (point-in-polygon) | **intégré** (TTL 90 j) |
| DGFiP / Etalab | DVF (valeurs foncières) | `dvf-api.data.gouv.fr` (nouvelle API officielle) · fichiers `geo-dvf` | LOV2 | aucune clé · pas de rate-limit documenté | semestriel (avril + octobre) | `id_mutation`, `id_parcelle`, `adresse_numero/voie`, lots | risque de ré-identification indirecte (pas de noms dans l'en-tête brut) | autorisée sous conditions RGPD | transactions à la parcelle ; `is_dwelling_attributable` ; jamais « au logement » si multi-lots | **intégré** (TTL 30 j) |
| ADEME | DPE logements existants | `data.ademe.fr/datasets/dpe03existant` · API data-fair | LOV2 | aucune clé · paginée (`size`, `after`) | continu (15,6 M enregistrements) | `numero_dpe`, `identifiant_ban`, `adresse_ban`, `etiquette_dpe/ges` | aucune (diagnostic du bien) | autorisée | diagnostic par adresse BAN ; `q=` est un plein-texte flou → filtrer sur `identifiant_ban` | **intégré** (TTL 14 j) |
| BRGM / MTECT | Géorisques | `georisques.gouv.fr/api/v1/` | LOV2 (de fait, fiche `null`) | aucune clé · 1 req/s sur `resultats_rapport_risque`, 5 req/s ailleurs, 1000 req/min/IP | continu | `code_insee`, `latlon` (**longitude d'abord**) | aucune | autorisée | risques par adresse/commune ; instable → retries + `--http1.1` | **intégré** (TTL 30 j) |
| IGN | Géoportail de l'urbanisme (GPU) | `apicarto.ign.fr/api/gpu` | **notspecified** (à sécuriser) | aucune clé · rate-limit Géoplateforme | continu (`gpu_timestamp`) | `gpu_doc_id`, `idurba`, `typezone`, `nomfic` | aucune | open data (licence à confirmer) | zonage PLU (U/AU/A/N) + règlement PDF ; servitudes non exposées (404) | **intégré** (TTL 90 j) |
| INSEE | IRL (indice de référence des loyers) | série BDM `001515333` · `api.insee.fr/series/BDM` | LOV2 | clé possible selon quotas | trimestriel | série BDM, valeur + variation (`001515334`) | aucune | autorisée | révision de loyer (loi 89-462 art. 17-1) | **intégré** (TTL 30 j) |
| Justice | Juridictions compétentes par commune | `data.gouv.fr/datasets/liste-des-juridictions-competentes-pour-les-communes-de-france` · CSV ~4,9 Mo | LOV2 | aucune clé · import | annuel (millésime) | code INSEE commune → CA / TJ / TPRX / CPH | aucune | autorisée | « où agir » : commune → juridiction compétente | **intégré** (import) |

### 2.2 Candidats importants (recherche vérifiée, non encore câblés)

| Source | Organisme | Licence | Fréquence | Identifiants | Usage Loilà | Statut |
|---|---|---|---|---|---|---|
| INSEE SIRENE (API + fichiers stock) | INSEE | LOV2 | mensuel (fichiers) / temps réel (API) | SIREN, SIRET, NAF | exhaustivité + historique ; clé API → import stock, pas de live | **prévu** (v2) |
| INPI RNE (actes, comptes, dirigeants) | INPI | licence RNE homologuée (paternité + plafond 10 %/an, 10 req/min) | continu | SIREN, SIRET, actes, bilans | dirigeants/actes/comptes ; compte + identifiants requis | **prévu** (v2, à cadrer) |
| Index égapro | MTE | LOV2 | quotidien | SIREN | score égapro quand `egapro_renseignee` | **prévu** (v2) |
| TVA intracommunautaire | DGFiP | LOV2 | — | SIREN → TVA | complément (déjà exposé par DINUM `tva`) | **prévu** (v2) |
| Zonage ABC / zones tendues | MTECT | LOV2 | ponctuel (arrêtés) | code INSEE → zone A/B/C | préavis réduit, encadrement, fiscalité | **prévu** (P2) |
| Encadrement des loyers | DHUP / villes | ODbL (Paris) / LOV2 | annuel | quartier × pièces × époque | loyer de référence (outil, pas une page) | **prévu** (P2) |
| ACCO (accords d'entreprise) | DILA | Licence Ouverte | hebdomadaire | SIRET | SIRET → accord → articles ; XML lourd | **prévu** (P3) |
| RNIC (copropriétés) | DHUP / ANAH | LOV2 | trimestriel | adresse/parcelle → copro, syndic SIRET | contexte litige copro | **prévu** (P3) |
| Annuaire de l'administration | DILA / DINUM | Licence Ouverte | continu | adresse → service compétent | « à qui j'écris » | **prévu** (P3) |
| Jours fériés | DINUM | Licence Ouverte | annuel | zone, année | calcul de délais (préavis, forclusion) | **prévu** (P3) |
| NATINF (infractions) | Justice | Licence Ouverte | régulier | code NATINF | infraction → texte d'incrimination | **prévu** (P3) |
| BDNB / RNB (bâtiment) | CSTB / ADEME / IGN | LOV2 | semestriel | `batiment_groupe_id`, `l_parcelle_id`, `identifiant_dpe` | pivot bâtiment (adresse ↔ parcelle ↔ DPE) | **prévu** (P3) |
| API Géo (découpage admin.) | DINUM | LOV2 | continu (COG annuel) | code INSEE, EPCI | nœud commune (socle) | **prévu** (socle) |
| BAN-PLUS (WFS `lien_adresse_parcelle`) | IGN | LOV2 | continu | `id_adr` ↔ `idu` | jointure déterministe adresse↔parcelle (batch) | **prévu** (batch) |
| OLL (observatoires des loyers) | OLL | LOV2 | annuel | agglomération | loyer de marché (granularité agglomération) | **prévu** (faible) |
| ICPE (installations classées) | MTECT / BRGM | fr-lo | quotidien | adresse/entreprise → régime | obligations environnementales | **prévu** (P3) |

---

## 3. Sources écartées et pourquoi

| Source | Raison de l'écart |
|---|---|
| **BOSS** (Bulletin officiel de la sécurité sociale) | `boss.gouv.fr` renvoie `000` en curl (WAF), pas d'API ni de jeu open data structuré ; scraping HTML fragile, déjà couvert par LEGI. Citer en éditorial seulement. |
| **API Entreprise** (bouquet DINUM) | `access_type: restricted`, habilitation obligatoire, finalité contrôlée ; Loilà (éditeur privé) n'est a priori pas éligible. La version ouverte (Recherche d'entreprises) suffit. |
| **API Entreprise « conventions collectives »** (fabrique numérique) | dépréciée, accès restreint, réutilisation interdite. |
| **siret2idcc.fabrique.social.gouv.fr** | dépréciée, données périmées (réponse vide vérifiée) ; l'équipe renvoie vers recherche-entreprises. |
| **Judilibre / Légifrance via PISTE** | `restricted` (compte + quota/jeton) ; à réserver à un usage de fraîcheur des fonds déjà ingérés, pas à un nouveau dataset. |
| **BOAMP / marchés publics** | fonctionne (200) mais faible valeur juridique grand public, pas d'arête vers articles/décisions. |
| **Statistiques justice** (criminologie, population carcérale) | séries agrégées, aucune clé adresse/entreprise/article. |
| **Taux d'intérêt légal** | source non fiable vérifiée : API `data.economie.gouv.fr` renvoie 0 enregistrement, CSV quasi vide, XLS de 2011. Extraire des arrêtés JORF/LEGI déjà présents dans le graphe. |
| **DV3F / Fichiers fonciers (Cerema)** | accès restreint (public habilité) ; `apidf-preprod.cerema.fr` en HTTP 503 le 21/09/2026. |
| **BPE, Filosofi, zonages IRIS, DVF « contexte »** | données de contexte socio-économique sans connexion au graphe juridique (« pages sans graphe »). |
| **Météo-France, VigiEau, Camino, qualité de l'air** | `open_with_account` ou non pertinents ; pas de lien avec le droit applicable à une adresse. |
| **Data.Subvention** | `restricted`, objet associatif, pas de règle de droit. |
| **Taxe foncière / DMTO / impôts locaux** | valeur juridique et graphe trop faibles ; contexte « info » éventuel. |
| **SMIC** | aucun jeu de données ouvert officiel ; maintenu manuellement (table versionnée `valid_from`/`valid_to`) depuis Urssaf + arrêté. |
| **NAF → IDCC** | aucune table officielle ; un même NAF renvoie à plusieurs IDCC, l'activité réelle prime. **POSSIBLE** uniquement, jamais « certain ». |
| **Fonds DILA déjà ingérés** (LEGI, KALI, CASS, CAPP, INCA, JADE, CONSTIT, JORF) | déjà dans Loilà (101 981 articles, 57 957 décisions, 18 CCN) ; surveiller les deltas, ne pas réintégrer. |

---

## 4. Règles RGPD appliquées

1. **Dirigeants non stockés.** `src/lib/company.ts` : « Directors (RNE) are deliberately NOT stored ».
   On indexe la fiche entreprise, jamais un annuaire de personnes. Pas de date de naissance complète,
   pas d'adresse personnelle, pas de nationalité.
2. **Non-diffusibles exclus.** `statut_diffusion = 'P'` (diffusion partielle) et entreprises non
   diffusibles : déjà exclues par l'API DINUM, à ne jamais réafficher. Occultation du domicile des
   dirigeants (loi 2025-594, décret 2025-840) respectée.
3. **Pas d'annuaire de personnes indexable.** Les dirigeants issus du RNE/BODACC sont republiables
   (registres publics) mais minimisés, avec canal d'opposition (art. 21 RGPD) prévu
   (`opposition_flagged` dans le modèle proposé).
4. **Pas de jointure adresse ↔ personne.** DVF, RNIC, RPLS, DPE sont des données « logement » ; leur
   croisement avec un SIREN/nom peut ré-identifier un propriétaire ou un bailleur. Aucune jointure
   adresse ↔ personne physique, pas de profilage nominatif, prudence sur l'indexation publique des
   historiques de vente.
5. **Minimisation.** Ne stocker que les attributs nécessaires à la fonction (étiquette DPE, plafond de
   loyer, IDCC), pas le dump intégral. SIRET/IDCC = donnée professionnelle, pas personnelle ; ne pas
   journaliser d'association SIRET ↔ requête utilisateur, ne pas conserver d'IP.

---

## 5. Cycle de vie d'une donnée

```
fetch (script / job)
  → source_records  (provider, dataset, external_id, official_url, licence,
                     payload, checksum SHA-256, match_quality, retrieved_at, expires_at)
  → table métier    (companies, establishments, company_announcements, rge_certifications,
                     collective_agreements, company_agreements, addresses, parcels, transactions,
                     dpe_diagnostics, risks, urban_zones, jurisdictions, legal_indices)
  → entités         (entities / entity_ids : un id interne par entité réelle)
  → affichage       (SourceBadge : source + licence + date de récupération + match quality)
  → observabilité   (npm run open-data:health)
```

- **Écriture** : `saveSourceRecord()` / `recordImport()` (`src/lib/sources.ts`) insèrent ou
  rafraîchissent la ligne `source_records` (upsert sur `id = provider:dataset:external_id`), avec
  `checksum` = SHA-256 du payload et `expires_at` = `retrieved_at + ttl`.
- **Lecture** : `getSourceRecord()` + `isFresh()` ; le rendu de page lit **uniquement SQLite**, jamais
  le réseau. Si le cache est absent/périmé → carte « à rafraîchir » + job d'enrichissement.
- **Affichage** : `SourceBadge` (`src/components/SourceBadge.tsx`) porte le nom de la source (lien),
  la licence (`LICENCE_LABEL`), la date de récupération et le badge `match_quality`
  (`CERTAIN`/`PROBABLE`/`POSSIBLE`/`UNKNOWN` avec libellé explicatif).
- **Contrôle** : `npm run open-data:health` vérifie le cache local (voir §6).

---

## 6. Commandes opérateur

| Commande | Rôle |
|---|---|
| `npm run open-data:idcc` | Importe le référentiel IDCC (`recherche-entreprises.api.gouv.fr/idcc/metadata`, 1 665 entrées) dans `collective_agreements` : titre, état, conteneur KALI. Batch, sans TTL. |
| `npm run open-data:company <siren\|siret\|nom>` | Synchronise une entreprise dans le cache : identité + établissements + IDCC déclarés (DINUM), annonces BODACC (DILA), certifications RGE (ADEME). Option `--bodacc-only`. Sans clé. |
| `npm run open-data:address "<adresse>"` | Chaîne complète adresse/bien : BAN (géocodage) → parcelle (cadastre) → transactions DVF → DPE (ADEME) → risques (Géorisques) → zonage PLU (GPU), tout en cache SQLite avec provenance. Affiche aussi `Indexable` (SEO_ELIGIBLE). |
| `npm run legal-graph:stats` | Rapport d'observabilité déterministe et read-only : métriques du graphe légal (articles, décisions, liens, taux de résolution) + volumétrie de toutes les tables open data. Option `--json`. |
| `npm run open-data:health` | Contrôle de santé du cache `source_records`, **local et sans réseau** : volume, dernière synchro, fraîcheur/TTL par source, sources hors registre, entités par type. Code de sortie 1 si une source a toutes ses lignes périmées au-delà de 2× le TTL. Option `--json`. |

---

## 7. Comment ajouter une source

1. **Registre** : ajouter l'entrée dans `SOURCES` (`src/lib/sources.ts`) — clé `"<provider>:<dataset>"`,
   avec `provider`, `dataset`, `name`, `url`, `licence` (LOV2 / fr-lo / ODbL / notspecified) et `ttl`
   (0 = import batch). C'est la liste blanche des sources autorisées.
2. **Migration additive** : créer la table métier (ex. `companies`, `transactions`) dans
   `src/lib/db.ts` — jamais de réécriture, uniquement des tables additives. Chaque table porte
   `source_record_id` (FK vers `source_records`) et `fetched_at`/`expires_at` pour les entités live.
3. **Fonction de sync** : écrire `syncXxx()` dans un module `src/lib/<verticale>.ts` qui appelle
   `fetchJson()` (timeout + retries bornés, User-Agent Loilà), écrit la ligne `source_records` via
   `saveSourceRecord()`/`recordImport()` puis remplit la table métier, en liant les entités via
   `linkExternalId()` (`src/lib/entities.ts`). Le réseau n'existe que dans les `sync*` et les jobs.
4. **Script opérateur** : ajouter `scripts/open-data-<source>.ts` + l'entrée dans `package.json`
   (`npm run open-data:<source>`), en suivant le pattern des scripts existants (déclare son propre
   `main()`, `process.loadEnvFile()`, sortie console concise).
5. **Affichage** : poser un `SourceBadge` (source + licence + date + `match_quality`) sur chaque bloc
   de données de la page. Ne jamais afficher un match `POSSIBLE`/`UNKNOWN` comme une preuve.
6. **Règle d'éligibilité** : si une page est créée (`/entreprise/<siren>`, `/bien/<id>`…), ajouter la
   règle dans la fonction unique `SEO_ELIGIBLE` (métadonnées = sitemap) : une fiche vide n'est jamais
   indexable (`docs/research/2026-09-seo-search.md` §3.5–3.7).
7. **Vérifier** : `npm run open-data:health` (cache sain), `npm run legal-graph:stats` (volumétrie),
   `npm run check` (typecheck + assertions). Vérifier aussi la licence, la fréquence et les
   rate-limits réels par `curl` avant de câbler (protocole des recherches 2026-09).