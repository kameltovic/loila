# Catalogue open data — datasets à fort effet de levier pour Loilà

> Mission AGENT 5 (OPEN DATA DISCOVERY) — recherche pure, aucun fichier applicatif modifié.
> Date de vérification : **2026-09-21**. Toutes les URLs listées ont été testées en direct (`curl`).
> Principe de sélection : **un dataset ne vaut que s'il branche une entité Loilà existante sur une autre**
> (article ↔ décision ↔ convention ↔ entreprise ↔ adresse ↔ bien). Les datasets qui ne produisent que des pages
> sans connexion au graphe sont explicitement écartés (§5).

---

## 1. Méthode

### 1.1 Catalogues interrogés

| Catalogue | Endpoint utilisé | Ce qu'on en tire |
|---|---|---|
| data.gouv.fr — jeux de données | `https://www.data.gouv.fr/api/1/datasets/?q=…&page_size=N` | métadonnées, org, licence, fréquence, resources (URL/format/taille) |
| data.gouv.fr — **API/dataservices** | `https://www.data.gouv.fr/api/1/dataservices/?page_size=200&page=1..7` | **1 254 API publiques** recensées (dont 1 238 titres uniques) ; champs `base_api_url`, `access_type` (`open` / `open_with_account` / `restricted`), `organization` |
| data.gouv.fr — orgs | `/api/1/organizations/<slug>/datasets/` | périmètre d'un producteur (Ministère de la Justice = 11 datasets, Ministère du Travail = 80…) |
| api.gouv.fr | portail + `/api/v2/*` (redirige vers la fiche web) | bouquet API Entreprise / API Particulier, habilitations |
| DILA OpenData | `https://echanges.dila.gouv.fr/OPENDATA/<BASE>/` (listing Apache) | vérification de la cadence réelle des fonds LEGI/KALI/ACCO/CASS/JADE/INCA |
| data.economie.gouv.fr | `api/explore/v2.1/catalog/datasets/<id>/records` | taux, impôts locaux, DMTO |
| ADEME data-fair | `https://data.ademe.fr/data-fair/api/v1/datasets/<id>/lines` | DPE, RGE, audits |
| INSEE BDM | `https://api.insee.fr/series/BDM/V1/data/SERIES_BDM/<idbank>` | séries (IRL vérifiée) |
| open.urssaf.fr | `api/explore/v2.1/catalog/datasets` | effectifs, comptes cotisants |
| opendatasoft DILA | `bodacc-datadila.opendatasoft.com`, `boamp-…`, `journal-officiel-…` | BODACC, BOAMP, JOAFE/BALO |

### 1.2 Protocole de vérification

1. **Existence + statut HTTP** : requête `curl -s -o /dev/null -w "%{http_code}"` sur chaque endpoint.
2. **Forme de la réponse** : lecture d'un enregistrement réel pour confirmer les champs (identifiants, SIREN, BAN, code INSEE, parcelles…).
3. **Test d'un cas d'usage représentatif** : ex. `recherche-entreprises?id_convention_collective=1486` renvoie bien des entreprises Syntec ; `resultats_rapport_risque?latlon=…` renvoie les risques d'une adresse.
4. **Licence / cadence** : lues dans les métadonnées data.gouv (`license`, `frequency`) et sur les fiches dataservices.

Codes HTTP observés le 2026-09-21 : `200` = vérifié live. `403/404/000` = non exploitable en l'état (WAF, endpoint déplacé, ou absence de la donnée) — signalé dans chaque bloc.

### 1.3 Rappel du graphe Loilà (cible des jointures)

Tables existantes (`src/lib/db.ts`, `src/lib/legal-graph.ts`) : `articles` (code, num),
`decisions`, `decision_articles`, `citations`, `article_relations`, `decision_numbers`,
`legal_codes`, `provenance`, `legal_topics`, `faq`.
Codes couverts (`src/lib/themes.ts`) : Code du travail, urbanisme, CCH, loi 89-462, loi 65-557 (+décrets),
Code civil, pénal, consommation, assurances, environnement, commerce, sécurité sociale, santé publique,
**18 conventions collectives** (ccn-0016 … ccn-3248).
Entités externes à créer pour brancher les datasets : `entreprise` (SIREN/SIRET), `adresse` (BAN id),
`bien` (parcelle/copropriété/bâtiment), `juridiction` (commune → TJ/CPH/CA), `indice` (IRL/ICC).

---

## 2. Catalogue complet

### A. Entreprises, travail, conventions collectives

---

**DATASET** — API Recherche d'entreprises (annuaire-entreprises)
**SOURCE** — DINUM, `https://recherche-entreprises.api.gouv.fr` (sources INSEE Sirene + INPI RNE + DRESS/ADEME…). Fiche data.gouv : `dataservices/api-recherche-dentreprises`.
**USE CASE** — L'utilisateur saisit un nom ou un SIRET/SIREN ; Loilà renvoie la fiche entreprise **et applique la convention collective applicable** (`siege.liste_idcc`, `complements.convention_collective_renseignee`) pour afficher les articles de la CCN correspondante (préavis, minima, primes). Filtres `id_convention_collective`, `activite_principale`, `departement`, `tranche_effectif_salarie`, `code_commune`, `near_point`.
**SEO INTENT** — « quelle convention collective s'applique à mon entreprise », « convention collective [secteur] », « mon employeur doit-il appliquer la CCN X », « entreprise [nom] effectif ».
**GRAPH VALUE** — Très forte : crée l'arête **entreprise → (IDCC) → convention (`ccn-*`) → articles**, inexistante aujourd'hui. Relie aussi `entreprise → adresse` (BAN) et `entreprise → NAF/secteur → métiers` (`src/lib/metiers.ts`).
**UPDATE FREQUENCY** — Quotidienne (Sirene/RNE) ; `date_mise_a_jour` renvoyée par l'API.
**LEGAL/LICENCE** — Licence Ouverte 2.0. Accès **ouvert**, 7 appels/s (l'administration peut réduire).
**IMPLEMENTATION COMPLEXITY** — **Faible.** REST JSON, sans clé. `GET /search?id_convention_collective=1486` vérifié → 10 000 résultats, `liste_idcc` corrects (Carrefour → 2216, TotalEnergies Charging → 1486). `/near_point` vérifié.
**DATA QUALITY** — SIREN/SIRET fiables ; **piège** : `complements.liste_idcc` peut contenir `9999` (« convention non renseignée ») ou plusieurs IDCC ; entreprises non diffusibles exclues ; l'API n'est pas la base Sirene complète.
**VÉRIFIÉ live ?** — OUI. `GET /search?q=…&per_page=1` → 200 ; `GET /near_point?lat=48.85&long=2.35` → 200 ; `GET /search?id_convention_collective=1486` → 200 ; `/openapi.json` → 200.

---

**DATASET** — ACCO : Accords d'entreprise
**SOURCE** — DILA / Premier ministre. data.gouv `5a0b0be188ee3871db07ce4e` ; flux `https://echanges.dila.gouv.fr/OPENDATA/ACCO/`.
**USE CASE** — Retrouver les accords collectifs signés **par une entreprise donnée** (SIRET) : épargne salariale, télétravail, temps de travail, primes. Complète la CCN de branche par les accords d'entreprise.
**SEO INTENT** — « accord d'entreprise [thème] », « mon entreprise a-t-elle un accord télétravail », « accord intéressement [société] ».
**GRAPH VALUE** — Très forte : **entreprise → accord → thèmes → articles du Code du travail** (L.2231-5 et s., L.2242-1…). Réutilise la même clé SIRET que Recherche d'entreprises.
**UPDATE FREQUENCY** — **Hebdomadaire** (listing vérifié : `ACCO_20260921-064627.tar.gz`, archives de 105 à 230 Mo).
**LEGAL/LICENCE** — Licence Ouverte. Noms des négociateurs publiés sauf anonymisation demandée à la DGT (RGPD sensible).
**IMPLEMENTATION COMPLEXITY** — **Élevée.** XML DTD Légifrance, archives lourdes, parsing et stockage volumineux ; nécessite un pipeline incrémental (delta hebdo).
**DATA QUALITY** — Accords conclus depuis le 01/09/2017 ; SIRET présents ; quelques textes anonymisés ; qualité inégale des métadonnées thématiques.
**VÉRIFIÉ live ?** — OUI. `https://echanges.dila.gouv.fr/OPENDATA/ACCO/` → 200 ; data.gouv ressource XML → 200 (redirige vers le listing).

---

**DATASET** — Base Sirene des entreprises et de leurs établissements (SIREN/SIRET)
**SOURCE** — INSEE. data.gouv `base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret` ; API `https://portail-api.insee.fr` (clé requise).
**USE CASE** — Référentiel de base `entreprise` (état administratif, NAF, adresse, effectif, établissements). Résout un SIRET cité dans une décision ou un BODACC vers une entité locale.
**SEO INTENT** — Pages entreprise / SIRET (volume mais faible intention juridique).
**GRAPH VALUE** — Moyenne en direct (redondant avec Recherche d'entreprises), mais **clé de jointure** indispensable pour d'autres datasets (BODACC, RGE, ACCO, RPLS syndics).
**UPDATE FREQUENCY** — Mensuelle (fichiers) / temps réel (API).
**LEGAL/LICENCE** — Licence Ouverte ; API `open_with_account` (clé), non-diffusibles exclus.
**IMPLEMENTATION COMPLEXITY** — **Moyenne/élevée** (volumétrie 2M+ entités, clé API, RGPD sur personnes physiques).
**DATA QUALITY** — Référence nationale, identifiants stables ; adresses non normalisées BAN (géocodage nécessaire).
**VÉRIFIÉ live ?** — Partiel : fiche data.gouv 200 ; portail API INSEE annoncé `open_with_account` (clé non testée ici).

---

**DATASET** — Professionnels RGE (Reconnu Garant de l'Environnement)
**SOURCE** — ADEME, data-fair `liste-des-entreprises-rge-2`.
**USE CASE** — Vérifier qu'un artisan est bien RGE (condition d'accès aux aides MaPrimeRénov'), croiser avec une entreprise/chantier BTP.
**SEO INTENT** — « [entreprise] est-elle RGE », « trouver un artisan RGE ».
**GRAPH VALUE** — Moyenne : **SIRET → qualification/domaine → obligations BTP** ; branche `entreprise` et le thème construction.
**UPDATE FREQUENCY** — Quasi quotidienne (dataset « mis à jour today »).
**LEGAL/LICENCE** — Licence Ouverte ; emails/téléphones exposés (attention RGPD si republication).
**IMPLEMENTATION COMPLEXITY** — **Faible.** data-fair `lines?size=…` + `where siret="…"`.
**DATA QUALITY** — SIRET valides ; périmètre = entreprises certifiées (qualification, organisme), dates de validité.
**VÉRIFIÉ live ?** — OUI : `…/liste-des-entreprises-rge-2/lines?size=1` → 200 (champs `siret`, `domaine`, `nom_certificat`, `lien_date_fin`).

---

**DATASET** — BODACC (Bulletin officiel des annonces civiles et commerciales)
**SOURCE** — DILA / Premier ministre, `https://bodacc-datadila.opendatasoft.com`.
**USE CASE** — Détecter qu'une entreprise est en **procédure collective** (redressement, liquidation), changement de dirigeant, dépôt de comptes. Sert un outil « mon débiteur / mon employeur est-il en difficulté ».
**SEO INTENT** — « [entreprise] liquidation judiciaire », « redressement judiciaire [société] », « annonces légales [société] ».
**GRAPH VALUE** — Forte : **SIREN → procédure (jugement) → articles** (Code de commerce, procédures civiles d'exécution) et lien avec les templates de recouvrement.
**UPDATE FREQUENCY** — Quotidienne.
**LEGAL/LICENCE** — Licence Ouverte (DILA). Données d'annonces publiques.
**IMPLEMENTATION COMPLEXITY** — **Faible.** API Opendatasoft v2.1, filtres `registre="552032534"`, `familleavis_lib="Procédures collectives"`.
**DATA QUALITY** — 50 M+ enregistrements ; `registre` contient le **SIREN** (souvent doublon formaté/brut) ; `jugement`/`depot`/`modificationsgenerales` en JSON imbriqué ; historique très profond.
**VÉRIFIÉ live ?** — OUI : `…/annonces-commerciales/records?limit=1&where=registre="552032534"` → 200 (107 annonces).

---

**DATASET** — Open data Urssaf (effectifs salariés, comptes cotisants)
**SOURCE** — Urssaf, `https://open.urssaf.fr` (Opendatasoft v2.1).
**USE CASE** — Contexte économique local : nombre d'établissements employeurs et effectifs par commune/APE/département (pas par entreprise).
**SEO INTENT** — faible (« effectifs salariés [département] »).
**GRAPH VALUE** — Faible/moyenne : agrégats, **pas de clé SIREN** → ne relie pas le graphe entreprise.
**UPDATE FREQUENCY** — Annuelle/trimestrielle.
**LEGAL/LICENCE** — Licence Ouverte.
**IMPLEMENTATION COMPLEXITY** — **Faible.**
**DATA QUALITY** — Bonne mais agrégée ; utile en « backdrop » éditorial uniquement.
**VÉRIFIÉ live ?** — OUI : `open.urssaf.fr/api/explore/v2.1/catalog/datasets` → 200 (30+ datasets listés).

---

### B. Justice, procédures, délais

---

**DATASET** — Liste des juridictions compétentes pour les communes de France
**SOURCE** — Ministère de la Justice. data.gouv `6392017edf7251532fda4bab`.
**USE CASE** — Pour une adresse/commune, donner la **juridiction compétente** : Cour d'appel, Tribunal judiciaire, Tribunal de proximité, **Conseil de prud'hommes**. Pièce manquante pour « où agir » : après avoir lu un article ou une décision, l'utilisateur sait *où* et *devant qui*.
**SEO INTENT** — « tribunal compétent pour [ville] », « quel conseil de prud'hommes pour mon adresse », « cour d'appel de [ville] compétente ».
**GRAPH VALUE** — Très forte : **adresse/commune → juridiction → décisions (CASS/CAPP/INCA) rendues par cette juridiction** et → articles de procédure (CPC, Code du travail). Nouvelle arête commune ↔ décision.
**UPDATE FREQUENCY** — Annuelle (millésime « 2026 juillet »).
**LEGAL/LICENCE** — Licence Ouverte 2.0. CSV ~4,9 Mo.
**IMPLEMENTATION COMPLEXITY** — **Faible.** Un CSV commune → CA/TJ/TPRX/CPH ; jointure directe avec `geo.api.gouv.fr` et la table `decisions` (par ressort, à défaut par `juridiction` textuelle).
**DATA QUALITY** — Une ligne par commune (code INSEE 5 car.) ; colonnes `Orig./N°` d'origine ; pas de géolocalisation (à compléter par geo.api).
**VÉRIFIÉ live ?** — OUI : ressource `2026-juillet-competences-territoriales.csv` → 200 (échantillon : `01001 → CA Lyon / TJ Bourg-en-Bresse / TPRX Trévoux / CPH Bourg-en-Bresse`).

---

**DATASET** — Données géocodées des structures de la Justice
**SOURCE** — Ministère de la Justice. data.gouv `5369932fa3a729239d20410c`.
**USE CASE** — Localiser physiquement un tribunal / service (adresse, coordonnées), afficher une carte « ma juridiction ».
**SEO INTENT** — « adresse tribunal judiciaire [ville] », « horaires greffe [ville] ».
**GRAPH VALUE** — Moyenne : complète l'arête adresse → juridiction (géométrie + contact).
**UPDATE FREQUENCY** — Ponctuelle/annuelle.
**LEGAL/LICENCE** — Licence Ouverte.
**IMPLEMENTATION COMPLEXITY** — **Faible** (CSV/geo).
**DATA QUALITY** — Bonne ; libellés à rapprocher des codes des juridictions (pas toujours d'ID pivot).
**VÉRIFIÉ live ?** — OUI (dataset listé sous l'org Justice ; métadonnées accessibles).

---

**DATASET** — Nomenclature NATINF (liste des infractions en vigueur)
**SOURCE** — Ministère de la Justice. data.gouv `62c7daa168ebd3a2212821c5`.
**USE CASE** — Dictionnaire officiel des infractions (code NATINF, qualification, texte de référence) : expliciter les infractions citées dans une décision ou un article.
**SEO INTENT** — « qu'est-ce que l'infraction [NATINF/qualification] », « contravention de 4e classe [libellé] ».
**GRAPH VALUE** — Forte : **infraction → texte d'incrimination → article** (Code pénal, routier…) et vers les décisions qui la mentionnent.
**UPDATE FREQUENCY** — Mise à jour régulière (nomenclature vivante).
**LEGAL/LICENCE** — Licence Ouverte.
**IMPLEMENTATION COMPLEXITY** — **Moyenne** : rapprochement NATINF ↔ numéros d'articles souvent indirect (texte + numéro).
**DATA QUALITY** — Référentiel officiel ; libellés et codes stables ; couverture des infractions en vigueur.
**VÉRIFIÉ live ?** — OUI (dataset listé dans l'org Justice).

---

**DATASET** — Nomenclatures des affaires civiles et des procédures particulières
**SOURCE** — Ministère de la Justice. data.gouv `634674de7b8614146f4090fe`.
**USE CASE** — Classer/mapper les procédures civiles (objet, code), utile pour ranger les dossiers et rattacher une situation à la bonne procédure.
**SEO INTENT** — « quelle procédure pour [litige] », « code de procédure civile [matière] ».
**GRAPH VALUE** — Moyenne/forte : **objet de litige → procédure → articles** (CPC, procédures civiles d'exécution).
**UPDATE FREQUENCY** — Quasi annuelle (+ archive 2002-2022).
**LEGAL/LICENCE** — Licence Ouverte.
**IMPLEMENTATION COMPLEXITY** — **Moyenne** (nomenclature à modéliser).
**DATA QUALITY** — Référentiel officiel ; rattachement aux codes parfois implicite.
**VÉRIFIÉ live ?** — OUI (dataset listé).

---

**DATASET** — Jours fériés (calendrier de l'API « Jours fériés »)
**SOURCE** — DINUM, `https://calendrier.api.gouv.fr`.
**USE CASE** — Calculer les **délais** en jours ouvrés/francs : préavis, mise en demeure, délais de rétractation, forclusion, computation de prescription.
**SEO INTENT** — « jours fériés 2026 », « délai de préavis en jours ouvrés », « calculer un délai avant [date] ».
**GRAPH VALUE** — Forte et transversale : brique utilitaire branchée sur les articles de **procédure** et les templates de courrier (calcul de date d'envoi).
**UPDATE FREQUENCY** — Annuelle (publiée à l'avance).
**LEGAL/LICENCE** — Licence Ouverte.
**IMPLEMENTATION COMPLEXITY** — **Faible.** JSON par zone (`metropole`, `alsace-moselle`, DOM), `…/2026.json`.
**DATA QUALITY** — Fiable ; gère les spécificités Alsace-Moselle via zones distinctes.
**VÉRIFIÉ live ?** — OUI : `…/jours-feries/metropole/2026.json` → 200 (11 dates 2026).

---

### C. Adresse, logement, immobilier, risques

---

**DATASET** — API Adresse (Base Adresse Nationale — BAN)
**SOURCE** — IGN / Etalab, `https://data.geopf.fr/geocodage/` (ex `api-adresse.data.gouv.fr`).
**USE CASE** — **Pivot adresse** : normaliser toute saisie utilisateur en `banId`, code INSEE, coordonnées, puis brancher tous les autres datasets (DPE, Géorisques, PLU, RNIC, DVF, juridictions).
**SEO INTENT** — géocodage interne (pas une page SEO directe, mais condition de toutes les pages locales).
**GRAPH VALUE** — Très forte : c'est la **clé `adresse`** du graphe.
**UPDATE FREQUENCY** — Continue (BAN).
**LEGAL/LICENCE** — Licence Ouverte.
**IMPLEMENTATION COMPLEXITY** — **Faible/ moyenne** (bulk BAN lourd si offline ; API légère pour usage à la volée).
**DATA QUALITY** — Excellente ; `id`/`banId` stables, score de confiance ; adresses hors BAN possibles (rural).
**VÉRIFIÉ live ?** — OUI : `data.geopf.fr/geocodage/search?q=…` → 200 ; `api-adresse.data.gouv.fr/search` et `/reverse` → 200.

---

**DATASET** — API Découpage administratif (API Géo)
**SOURCE** — DINUM, `https://geo.api.gouv.fr`.
**USE CASE** — Résoudre commune → département / région / **EPCI** / arrondissement ; indispensable pour appliquer une règle locale (zonage, taxes, juridiction).
**SEO INTENT** — « commune de [code postal] », pages locales.
**GRAPH VALUE** — Forte : nœud `commune` reliant adresse, juridictions, zonage ABC, taxes.
**UPDATE FREQUENCY** — Continue (COG annuel).
**LEGAL/LICENCE** — Licence Ouverte 2.0.
**IMPLEMENTATION COMPLEXITY** — **Faible.** `GET /communes?nom=…&fields=…`, `/epcis`, `/departements`, `/regions`.
**DATA QUALITY** — Référentiel COG officiel ; populations, codes postaux multiples.
**VÉRIFIÉ live ?** — OUI : `/communes?nom=Lyon` → 200 (Lyon 69123, 9 codes postaux).

---

**DATASET** — Encadrement des loyers (loyers de référence, majorés, minorés)
**SOURCE** — DHUP / préfectures / villes. data.gouv `5d6f392a06e3e743b4d78afd` (Paris) + millésimes Lille, Bordeaux, Montpellier, Lyon… ; `opendata.paris.fr`.
**USE CASE** — Pour une adresse + nb de pièces + époque + meublé : donner le **loyer de référence, le max et le min** → outil « mon loyer est-il légal », contestation, complément de loyer.
**SEO INTENT** — « loyer de référence [quartier/ville] », « encadrement des loyers [année] », « mon loyer est-il trop élevé ».
**GRAPH VALUE** — Très forte : **adresse/quartier → plafond légal → loi 89-462 (art. 17, 17-1) → template de contestation**.
**UPDATE FREQUENCY** — Annuelle.
**LEGAL/LICENCE** — ODC-ODbL (Paris) / Licence Ouverte selon les villes ; géométries de quartiers incluses (`geo_shape`).
**IMPLEMENTATION COMPLEXITY** — **Moyenne.** Une source par ville (schémas proches mais non identiques) ; jointure spatiale quartier ↔ adresse.
**DATA QUALITY** — Bonne à Paris (17 920 lignes 2025, `ref/max/min` par quartier×pièces×époque×meublé) ; couverture limitée aux villes sous encadrement.
**VÉRIFIÉ live ?** — OUI : `opendata.paris.fr/api/explore/v2.1/.../logement-encadrement-des-loyers/records` → 200.

---

**DATASET** — Résultats des observatoires locaux des loyers (OLL)
**SOURCE** — OLL, data.gouv `56fd8e8788ee387079c352f7` (+ par agglomération `56fd90e8c751df174ac485cb`).
**USE CASE** — Loyer de marché observé par agglomération (déciles, médiane, par type/époque/ancienneté) là où l'encadrement ne s'applique pas.
**SEO INTENT** — « loyer moyen [agglomération] », « prix au m² location [ville] ».
**GRAPH VALUE** — Moyenne : référence de marché, **pas de granularité adresse** (agglomération).
**UPDATE FREQUENCY** — Annuelle.
**LEGAL/LICENCE** — Licence Ouverte 2.0.
**IMPLEMENTATION COMPLEXITY** — **Faible** (CSV annuel).
**DATA QUALITY** — Méthodologie documentée ; encodage CSV en latin-1 (accents cassés, `Agglom�ration`) → normalisation nécessaire.
**VÉRIFIÉ live ?** — OUI : `observatoires-des-loyers.org/datagouv/2025/Base_OP_2025_Nationale.csv` → 200.

---

**DATASET** — Indice de référence des loyers (IRL) — INSEE BDM série `001515333`
**SOURCE** — INSEE, `https://api.insee.fr/series/BDM/V1/data/SERIES_BDM/001515333`.
**USE CASE** — Calculer la **révision annuelle d'un loyer** : `loyer × (IRL_nouveau / IRL_ référence)`. Fournit la valeur du trimestre + variation annuelle (`001515334`).
**SEO INTENT** — « IRL 2026 », « révision de loyer formule », « augmentation de loyer maximum 2026 ».
**GRAPH VALUE** — Très forte : **indice → loi 89-462 art. 17-1 → template « révision de loyer »**, et vers le logement (adresse).
**UPDATE FREQUENCY** — Trimestrielle (publication mi-janvier/avril/juillet/octobre ; ici 2026-Q2 = **148,37**).
**LEGAL/LICENCE** — Données INSEE sous Licence Ouverte ; API BDM peut exiger une clé selon les quotas.
**IMPLEMENTATION COMPLEXITY** — **Faible.** SDMX-XML ; série unique ; stockage local du dernier point.
**DATA QUALITY** — Excellente ; série officielle, valeurs révisées signalées (`OBS_STATUS`).
**VÉRIFIÉ live ?** — OUI : `SERIES_BDM/001515333` → 200 (2026-Q2 = 148,37) ; `001515334` (variation) → 200.

---

**DATASET** — DPE Logements existants (depuis juillet 2021)
**SOURCE** — ADEME, data-fair `meg-83tjwtg8dyz4vv7h1dqe` (« DPE Logements existants »).
**USE CASE** — Par adresse/`identifiant_ban` : étiquette DPE/GES, date, surface, coût, consommation → « ce logement est-il une passoire thermique », « DPE du logement que je loue/achète ».
**SEO INTENT** — « DPE [adresse] », « passoire thermique interdite à la location », « classe DPE F/G ».
**GRAPH VALUE** — Très forte : **adresse/BAN → diagnostic → articles (CCH, loi 89-462, loi Climat 2021-1104) → obligations bailleur**, et croisement DVF/RNIC.
**UPDATE FREQUENCY** — Continue (dataset mis à jour ; `updatedAt` = 2026-06-30).
**LEGAL/LICENCE** — Licence Ouverte (Etalab).
**IMPLEMENTATION COMPLEXITY** — **Moyenne.** 15,6 M de lignes ; data-fair `lines?q=identifiant_ban:…` ; prévoir index BAN local plutôt que requêter à chaque page.
**DATA QUALITY** — Identifiants `identifiant_ban` + `adresse_ban` ; **piège** : pour certaines lignes `identifiant_ban` = code commune seulement ; plusieurs DPE par logement (garder le plus récent via `date_etablissement_dpe`).
**VÉRIFIÉ live ?** — OUI : `…/meg-83tjwtg8dyz4vv7h1dqe/lines?size=1` → 200 (total 15 604 436).

---

**DATASET** — Audits énergétiques logements existants
**SOURCE** — ADEME, data-fair `ync2epx48x9azbdnggbygqp0` (depuis 01/09/2023).
**USE CASE** — Audit énergétique obligatoire (vente/location passoire) : compléter le DPE avec les scénarios de travaux.
**SEO INTENT** — « audit énergétique obligatoire », « DPE vs audit ».
**GRAPH VALUE** — Moyenne : prolonge DPE → obligations → articles Climat & résilience.
**UPDATE FREQUENCY** — Continue.
**LEGAL/LICENCE** — Licence Ouverte.
**IMPLEMENTATION COMPLEXITY** — **Faible/moyenne.**
**DATA QUALITY** — Volume faible (post-2023), adresses BAN.
**VÉRIFIÉ live ?** — OUI (dataset listé et interrogeable via data-fair).

---

**DATASET** — Registre national d'Immatriculation des Copropriétés (RNIC)
**SOURCE** — DHUP / ANAH. data.gouv `62da71c068871f4c54258c7c` (fichier trimestriel).
**USE CASE** — Par adresse ou référence cadastrale : retrouver la **copropriété** (n° d'immatriculation, lots, période de construction, syndic SIRET, copro aidée/ACV/QPV) → contexte d'un litige copro, identification du syndic.
**SEO INTENT** — « copropriété [adresse] immatriculation », « qui est le syndic de [résidence] », « nombre de lots [immeuble] ».
**GRAPH VALUE** — Très forte : **adresse/parcelle → copropriété → syndic (SIRET) → entreprise/CCN immobilier (IDCC 1527)** ; branche les thèmes copropriété (loi 65-557, décrets 67-223 / 2015-342 / 2005-240).
**UPDATE FREQUENCY** — Trimestrielle (fichier T3 2025 publié ; métadonnée « daily »).
**LEGAL/LICENCE** — Licence Ouverte 2.0.
**IMPLEMENTATION COMPLEXITY** — **Moyenne/élevée.** Pas d'API de requête officielle → import du CSV trimestriel (~gros), index par adresse/parcelle, normalisation d'adresses.
**DATA QUALITY** — 60+ colonnes ; `reference_cadastrale_1..3`, `code_insee`, `lat/long`, `siret_du_representant_legal`, `nombre_total_de_lots`, `periode_de_construction`, codes QPV/ACV/PVD, `copro_aidee`. Adresses non systématiquement BAN.
**VÉRIFIÉ live ?** — OUI : ressource `Fichier T3 2025.csv` → 200 (en-tête complet confirmé).

---

**DATASET** — RPLS — Répertoire des logements locatifs des bailleurs sociaux (détail au logement)
**SOURCE** — SDES. data.gouv `689c42dc21932fa1640d99c3` (API dido `data.statistiques.developpement-durable.gouv.fr`).
**USE CASE** — Savoir si un logement précis est du parc social (bailleur, financement, occupation) ; utile pour les litiges locatifs sociaux et l'analyse d'un immeuble.
**SEO INTENT** — « ce logement est-il social », « bailleur social [adresse] ».
**GRAPH VALUE** — Forte : **adresse/parcelle → logement social → bailleur → loi 89-462 / CCH**.
**UPDATE FREQUENCY** — Annuelle.
**LEGAL/LICENCE** — Licence Ouverte (fr-lo).
**IMPLEMENTATION COMPLEXITY** — **Moyenne/élevée.** Gros volume, API dido spécifique, géocodage BAN à faire.
**DATA QUALITY** — Détail au logement (BAN) ; périmètre = logements sociaux conventionnés ; délais de collecte.
**VÉRIFIÉ live ?** — OUI (dataset + ressource dido listés).

---

**DATASET** — Demandes de valeurs foncières (DVF / DVF géolocalisé)
**SOURCE** — DGFiP / Etalab. data.gouv `5c4ae55a634f4117716d5656` (millésimes) et `5cc1b94a634f4165e96436c1` (fichier unique 2021-2025).
**USE CASE** — Prix réel d'une **mutation immobilière** (adresse/parcelle) : « combien s'est vendu mon voisin », estimation, contrôle de valeur.
**SEO INTENT** — « prix immobilier [adresse/ville] », « DVF valeur foncière [rue] », « estimation bien [ville] ».
**GRAPH VALUE** — Forte : **bien/parcelle → mutation → propriétaire (via cadastre) → fiscalité** ; relie l'adresse à l'économie du bien (avec DPE, RNIC).
**UPDATE FREQUENCY** — Semestrielle (millésimes) ; fichier géolocalisé mis à jour régulièrement.
**LEGAL/LICENCE** — Licence Ouverte 2.0. Pas d'identité des vendeurs/acheteurs (RGPD).
**IMPLEMENTATION COMPLEXITY** — **Élevée.** Volumétrie importante (`.txt.zip` par an + `dvf.csv.gz`), géocodage/parcelle, dédup multi-lots.
**DATA QUALITY** — Identifiants de mutation (`id_mutation`), parcelles, adresse ; doublons lots/parts, valeurs atypiques (viagers, échanges), départements 57/67/68 partiellement absents historiquement.
**VÉRIFIÉ live ?** — OUI : ressources data.gouv → 200 (`valeursfoncieres-2025.txt…`, `dvf.csv.gz`).

---

**DATASET** — API Carto — module Cadastre
**SOURCE** — IGN, `https://apicarto.ign.fr/api/cadastre/parcelle`.
**USE CASE** — Géométrie de parcelle à partir d'un point/adresse : contenance, section, commune → base `bien` et clé de jointure avec DVF/RNIC.
**SEO INTENT** — « parcelle cadastrale [adresse] », « contenance terrain ».
**GRAPH VALUE** — Forte : nœud **parcelle** reliant adresse, DVF, RNIC, PLU, risques.
**UPDATE FREQUENCY** — Continue (cadastre).
**LEGAL/LICENCE** — Licence Ouverte.
**IMPLEMENTATION COMPLEXITY** — **Faible/moyenne** (`GET ?geom=Point`).
**DATA QUALITY** — Référentiel EDIGÉO ; identifiants parcelle (commune+préfixe+section+numéro) cohérents avec RNIC.
**VÉRIFIÉ live ?** — OUI : `apicarto.ign.fr/api/cadastre/parcelle?geom=…` → 200.

---

**DATASET** — API Carto — module Géoportail de l'Urbanisme (GPU)
**SOURCE** — IGN, `https://apicarto.ign.fr/api/gpu/zone-urba` (et `prescription-surf`, `info-surf`, `servitude-*`).
**USE CASE** — Pour une adresse : **zonage PLU (U/AU/A/N), libellé de zone, lien vers le règlement PDF** et prescriptions/servitudes → « que puis-je construire », « mon terrain est-il constructible ».
**SEO INTENT** — « zone PLU [adresse] », « terrain constructible [commune] », « servitude [rue] ».
**GRAPH VALUE** — Très forte : **adresse → zonage/prescription → code de l'urbanisme → dossier (permis/déclaration préalable)** ; branche le thème urbanisme.
**UPDATE FREQUENCY** — Continue (documents d'urbanisme géo-référencés, `gpu_timestamp`).
**LEGAL/LICENCE** — Licence Ouverte.
**IMPLEMENTATION COMPLEXITY** — **Moyenne** : géométries à interpréter, `urlfic` du règlement parfois vide, couverture inégale selon les communes.
**DATA QUALITY** — Champs `libelle`, `libelong`, `typezone`, `datvalid`, `idurba`, `nomfic` ; `gpu_status: production` ; hétérogénéité documentaire.
**VÉRIFIÉ live ?** — OUI : `gpu/zone-urba?geom=…` (Paris) → 200, `libelle=UG`, `libelong=Zone urbaine générale`, `nomfic=75056_reglement_20260616.pdf`.

---

**DATASET** — API Géorisques (rapport de risque par adresse, GASPAR, sismicité, ICPE)
**SOURCE** — BRGM / MTECT, `https://www.georisques.gouv.fr/api/v1/`.
**USE CASE** — Pour une adresse/commune : risques naturels (inondation, retrait-gonflement des argiles, sismicité, radon, nappes) et technologiques (SEVESO, TMD) → obligations d'information, assurance, IAL, état des risques (ERP).
**SEO INTENT** — « risques [adresse/commune] », « ma commune est-elle inondable », « état des risques location vente ».
**GRAPH VALUE** — Très forte : **adresse/commune → aléa → articles (environnement, assurances, CCH, Code minier) + obligations vendeur/bailleur**, et combinaison avec DPE pour l'ERP.
**UPDATE FREQUENCY** — Continue/quotidienne selon service.
**LEGAL/LICENCE** — Licence Ouverte 2.0 (BRGM). Service public.
**IMPLEMENTATION COMPLEXITY** — **Faible/moyenne.** `resultats_rapport_risque?latlon=lat,lon` renvoie un JSON riche par adresse ; `gaspar/risques?code_insee=…` par commune.
**DATA QUALITY** — Bonne ; la clé d'entrée est `latlon` (pas d'adresse en clair) → passer par la BAN ; libellés de statut (`Risque Existant`).
**VÉRIFIÉ live ?** — OUI : `resultats_rapport_risque?latlon=48.850006,2.349908` → 200 (inondation + remontée de nappe présents) ; `gaspar/risques?code_insee=75056` → 200 ; `zonage_sismique` → 200. *(Note : `resultats_rapport_risque` peut être lent — quelques timeouts constatés, prévoir un cache.)*

---

**DATASET** — BDNB — Base de Données Nationale des Bâtiments (+ API RNB)
**SOURCE** — CSTB / ADEME / IGN. data.gouv `61dc7157488f8cdb4283e3c3` ; API `https://api.bdnb.io` ; RNB `https://rnb-api.beta.gouv.fr`.
**USE CASE** — Identifiant **bâtiment** unifiant adresse, parcelles, DPE, volumétrie : socle « bâtiment » du graphe immobilier, permettant de rattacher diagnostics, copro, risques à une même entité.
**SEO INTENT** — faible/moyen (données techniques, pages locales possibles).
**GRAPH VALUE** — Forte : **bâtiment → adresse/parcelle/DPE/copro/risques**, clé pivot de consolidation.
**UPDATE FREQUENCY** — Semestrielle (millésimes, ex. `2026-02-a`).
**LEGAL/LICENCE** — Licence Ouverte 2.0 ; exports Parquet/CSV/pgDump (volumineux).
**IMPLEMENTATION COMPLEXITY** — **Élevée.** Millésimes lourds (S3), API PostgREST à périmètre restreint, mapping ID bâtiment/parcelle à faire.
**DATA QUALITY** — Consolidation multi-sources, colonnes hétérogènes ; `batiment_groupe_complet` non exposé tel quel par l'API publique (filtre par département a échoué).
**VÉRIFIÉ live ?** — OUI (data.gouv resources 200 ; RNB `…/buildings/?insee_code=75056` → 200 avec `rnb_id`). BDNB API : `api.bdnb.io` répond mais certaines colonnes `code_departement` inexistantes → schéma à valider avant usage.

---

**DATASET** — Zonage ABC / zones tendues (communes)
**SOURCE** — Ministère de la Transition écologique. data.gouv `656715871172d08f8f680063`.
**USE CASE** — Pour une commune : classement **A bis / A / B / C** (« zone tendue ») → droits au préavis réduit, encadrement, dispositifs fiscaux, plafonds de loyer.
**SEO INTENT** — « ma ville est-elle en zone tendue », « zonage ABC [commune] », « préavis réduit 1 mois zone tendue ».
**GRAPH VALUE** — Forte : **commune → zone tendue → loi 89-462 / CCH** ; complète adresse et encadrement des loyers.
**UPDATE FREQUENCY** — Ponctuelle (arrêtés de reclassement : vintages 26/06/2026, 05/09/2025).
**LEGAL/LICENCE** — Licence Ouverte 2.0.
**IMPLEMENTATION COMPLEXITY** — **Faible.** CSV commune (code INSEE) → zone ; listes de reclassements fournies séparément.
**DATA QUALITY** — Référentiel officiel ; attention aux millésimes et aux communes reclassées/déclassées.
**VÉRIFIÉ live ?** — OUI : ressources CSV/XLSX « Zonage ABC en vigueur 26 juin 2026 » → 200.

---

**DATASET** — ICPE — Base des installations classées (protection de l'environnement)
**SOURCE** — MTECT / BRGM. data.gouv `5d8da992634f414b1c98117b` (miroir `data.cquest.org/icpe` + Géorisques).
**USE CASE** — Savoir si une adresse/entreprise est une **installation classée** et sous quel régime (autorisation, enregistrement, déclaration) → obligations, servitudes, risques.
**SEO INTENT** — « installation classée [adresse] », « ICPE près de chez moi », « site Seveso [commune] ».
**GRAPH VALUE** — Forte : **entreprise/adresse → régime ICPE → code de l'environnement → articles 511 et s.**, articulation avec les décisions.
**UPDATE FREQUENCY** — Quotidienne.
**LEGAL/LICENCE** — Licence Ouverte (fr-lo).
**IMPLEMENTATION COMPLEXITY** — **Moyenne.** GeoJSON + détails JSON volumineux ; géocodage et rattachement SIRET à consolider.
**DATA QUALITY** — Localisation géographique, rubriques, régime ; pas systématiquement de SIREN.
**VÉRIFIÉ live ?** — Partiel : métadonnées data.gouv 200 ; le miroir cquest est communautaire (stabilité à surveiller).

---

**DATASET** — API Annuaire de l'administration et des services publics (+ compétence géographique)
**SOURCE** — DILA / DINUM, `https://api-lannuaire.service-public.gouv.fr/api/explore/v2.1`.
**USE CASE** — Pour une adresse/commune : trouver **le service compétent** (mairie, préfecture, DREETS, CAF, CPAM…) et son ressort → « à qui j'écris », « quelle administration pour [démarche] ».
**SEO INTENT** — « quelle administration pour [démarche] », « contacter [service] [ville] », « compétence [commune] ».
**GRAPH VALUE** — Forte : **adresse/commune → service compétent → procédure → fiche/démarche** ; complète l'arête juridiction.
**UPDATE FREQUENCY** — Continue (93 780 services recensés).
**LEGAL/LICENCE** — Licence Ouverte.
**IMPLEMENTATION COMPLEXITY** — **Moyenne** : deux datasets (`api-lannuaire-administration`, `…-competence-geographique`), champs JSON imbriqués (horaires, contacts).
**DATA QUALITY** — Très riche (SIRET parfois absent, `itm_identifiant`, adresses) ; doublons et qualité variable selon producteurs.
**VÉRIFIÉ live ?** — OUI : `…/catalog/datasets` → 200 ; `…/api-lannuaire-administration/records` → 200.

---

**DATASET** — Taxe foncière sur les propriétés bâties — tarifs des locaux d'habitation
**SOURCE** — DGFiP / Ministères économiques, `data.economie.gouv.fr` dataset `descriptif-tarifs-des-locaux-d-habitation_2024`.
**USE CASE** — Pour une commune/catégorie : valeurs locatives et tarifs → estimation de taxe foncière, contexte fiscal du bien.
**SEO INTENT** — « taxe foncière [commune] », « taux taxe foncière [ville] ».
**GRAPH VALUE** — Faible/moyenne : **commune → fiscalité locale**, se branche sur adresse/bien sans forte valeur juridique.
**UPDATE FREQUENCY** — Annuelle.
**LEGAL/LICENCE** — Licence Ouverte.
**IMPLEMENTATION COMPLEXITY** — **Faible/moyenne** (506 284 lignes).
**DATA QUALITY** — Bonne ; millésimes ; pas de calcul de la taxe réelle (dépend de la base nette).
**VÉRIFIÉ live ?** — OUI : `…/descriptif-tarifs-des-locaux-d-habitation_2024/records?limit=1` → 200 (Mulhouse, `vl_au_m2`).

---

**DATASET** — Taux de l'intérêt légal
**SOURCE** — Ministères économiques (`data.economie.gouv.fr` `taux-de-linteret-legal-depuis-2011`) et data.gouv `5369a18da3a729239d206626`.
**USE CASE** — Calculer les **intérêts au taux légal** d'une créance impayée (mise en demeure, lettre de relance) et les intérêts majorés.
**SEO INTENT** — « taux de l'intérêt légal 2026 », « calcul intérêts légaux impayé ».
**GRAPH VALUE** — Moyenne/forte : **taux → articles Code monétaire/civil → templates de recouvrement**.
**UPDATE FREQUENCY** — Semestrielle (publication par arrêté au JO).
**LEGAL/LICENCE** — Licence Ouverte ; le jeu data.gouv principal est en `fr-lo`.
**IMPLEMENTATION COMPLEXITY** — **Moyenne** : *l'API explore v2.1 renvoie 0 enregistrement* ; l'export CSV est quasi vide ; la ressource XLS data.gouv est ancienne (2011). → **préférer l'extraction depuis les arrêtés JORF/LEGI** (déjà dans le graphe) ou une table maintenue éditorialement.
**DATA QUALITY** — **Problème de fiabilité identifié** : pas de source API propre et à jour. À traiter en priorité basse.
**VÉRIFIÉ live ?** — Partiellement : endpoints → 200 mais sans données exploitables (`records` vide, CSV 109 octets). **Ne pas s'appuyer dessus en l'état.**

---

## 3. Classement par intérêt

Score = `(UV×0,25 + GV×0,30 + SEO×0,20 + REL×0,15 + EASE×0,10) × 20`, noté sur 100.
- **UV** = valeur utilisateur · **GV** = valeur pour le graphe · **SEO** = potentiel de requête · **REL** = fiabilité/maintenance · **EASE** = facilité d'intégration (5 = très facile).

| # | Dataset | UV | GV | SEO | REL | EASE | Score | Justification |
|---|---|---|---|---|---|---|---|---|
| 1 | Juridictions compétentes | 5 | 5 | 5 | 5 | 5 | **100** | Referme la boucle « article/décision → où agir » ; CSV simple ; arête commune→décision inédite |
| 2 | API Recherche d'entreprises | 5 | 5 | 4 | 5 | 5 | **96** | Crée entreprise→IDCC→convention→articles ; ouvert, sans clé, filtre `id_convention_collective` vérifié |
| 3 | IRL (INSEE BDM) | 5 | 4 | 5 | 5 | 5 | **94** | Outil de révision de loyer immédiat ; série officielle trimestrielle ; branche loi 89-462 + template |
| 4 | API Adresse (BAN) | 5 | 5 | 3 | 5 | 4 | **90** | Clé pivot `adresse` de tout le reste ; indispensable même si peu SEO |
| 5 | DPE Logements (ADEME) | 5 | 4 | 5 | 4 | 4 | **89** | Adresse→diagnostic→obligations passoires ; volume et BAN ; très forte demande |
| 6 | Encadrement des loyers | 5 | 4 | 5 | 4 | 3 | **87** | Adresse→plafond légal→contentieux ; éclaté par ville (schémas proches) |
| 7 | API Géorisques | 4 | 4 | 4 | 5 | 5 | **85** | Adresse→risques→obligations/assurance ; API directe par latlon ; léger risque de latence |
| 8 | APICarto GPU (PLU) | 4 | 4 | 4 | 5 | 4 | **83** | Adresse→zonage/règlement→code urbanisme ; géométries et couverture à gérer |
| 9 | Zonage ABC / zones tendues | 4 | 3 | 5 | 5 | 5 | **83** | Commune→zone tendue ; CSV trivial ; forte intention SEO |
| 10 | BODACC | 4 | 4 | 3 | 5 | 5 | **81** | SIREN→procédures collectives ; API Opendatasoft immédiate ; JSON imbriqué à parser |
| 11 | API Géo (découpage admin.) | 4 | 4 | 3 | 5 | 5 | **81** | Nœud `commune` indispensable ; trivial |
| 12 | Cadastre (APICarto) | 4 | 4 | 3 | 5 | 4 | **79** | Nœud `parcelle` (DVF/RNIC/PLU) ; stable |
| 13 | RNIC copropriétés | 4 | 4 | 4 | 4 | 3 | **78** | Adresse→copro→syndic(SIRET) ; pas d'API de requête, import lourd |
| 14 | ACCO accords d'entreprise | 4 | 5 | 3 | 4 | 2 | **78** | SIRET→accord→articles ; très riche mais XML hebdo volumineux |
| 15 | Annuaire administration | 3 | 4 | 4 | 5 | 4 | **78** | Adresse→service compétent ; données riches mais JSON complexe |
| 16 | Jours fériés | 3 | 4 | 4 | 5 | 5 | **80** | Calcul de délais ; minuscule, instantané |
| 17 | DVF (valeurs foncières) | 4 | 4 | 5 | 4 | 2 | **80** | Prix réels ; très forte demande mais volumétrie/parsing lourds |
| 18 | RGE (ADEME) | 3 | 4 | 3 | 4 | 4 | **71** | SIRET→qualification→aides BTP ; faible coût |
| 19 | RPLS logements sociaux | 3 | 4 | 3 | 4 | 3 | **69** | Adresse→parc social ; volumétrie et API dido |
| 20 | Taux d'intérêt légal | 4 | 3 | 5 | 2 | 2 | **68** | Intention forte mais **source non fiable en l'état** |
| 21 | Base Sirene (INSEE) | 3 | 4 | 2 | 5 | 3 | **68** | Référentiel entreprise ; clé API + volumétrie ; doublon partiel |
| 22 | Structures justice géocodées | 3 | 3 | 3 | 4 | 5 | **67** | Complément carte/juridiction ; trivial |
| 23 | NATINF (infractions) | 3 | 4 | 2 | 4 | 3 | **65** | Infraction→incrimination→article ; rapprochement indirect |
| 24 | BDNB / RNB (bâtiment) | 3 | 4 | 2 | 4 | 2 | **63** | Clé pivot bâtiment ; millésimes lourds, API partielle |
| 25 | ICPE installations classées | 3 | 3 | 3 | 4 | 3 | **63** | Adresse/entreprise→régime environnemental |
| 26 | Audits énergétiques | 3 | 3 | 3 | 4 | 3 | **63** | Prolonge DPE ; volume faible |
| 27 | Nomenclature affaires civiles | 2 | 4 | 2 | 4 | 3 | **60** | Objet→procédure→articles ; modélisation à faire |
| 28 | OLL (observatoires loyers) | 3 | 2 | 3 | 4 | 4 | **59** | Marché locatif ; granularité agglomération seulement |
| 29 | Taxe foncière (tarifs) | 3 | 2 | 4 | 3 | 3 | **58** | SEO correct mais faible valeur juridique |
| 30 | Open data Urssaf | 2 | 2 | 2 | 5 | 4 | **53** | Agrégats sans clé SIREN ; contexte uniquement |

---

## 4. Les 10 candidats à plus fort effet de levier pour Loilà

1. **Liste des juridictions compétentes (Min. Justice).** Le chaînon manquant entre le droit et l'action. Transforme chaque page article/décision en « ici, c'est le TJ de X / le CPH de Y qui est compétent ». Arête `commune → juridiction → décision` totalement absente aujourd'hui.
2. **API Recherche d'entreprises (IDCC).** Le pont `entreprise → convention collective → articles`. Permet un parcours unique : l'utilisateur tape son employeur, Loilà affiche sa CCN et les articles applicables. Filtre `id_convention_collective` vérifié, API ouverte à 7 req/s.
3. **IRL (INSEE BDM).** Instantané, officiel, trimestriel. Débloque la révision de loyer (`loi 89-462 art. 17-1`) + le template correspondant, avec un calcul de date fiable.
4. **API Adresse (BAN) + API Géo.** Fondation technique : sans `banId`/code INSEE normalisé, aucun autre dataset « adresse » n'est exploitable. À intégrer en premier, même si le SEO direct est nul.
5. **DPE Logements (ADEME).** Adresse → diagnostic → obligations bailleur/vendeur (passoires, Climat & résilience). Très forte demande, identifiant BAN présent, dataset maintenu.
6. **Encadrement des loyers (villes).** Adresse/quartier → plafond légal → contentieux du loyer. À combiner avec IRL et la loi 89-462 : c'est un outil, pas une page.
7. **API Géorisques.** Adresse → risques → obligations d'information, assurance, ERP. Entrée `latlon` simple, JSON exploitable, s'articule avec DPE pour l'état des risques.
8. **API Carto GPU (PLU).** Adresse → zone + règlement → code de l'urbanisme. Ouvre le thème « construire & aménager » avec des règles locales réelles, pas seulement des articles.
9. **Zonage ABC / zones tendues.** Commune → zone tendue → droits (préavis réduit, encadrement, fiscalité). Coût quasi nul, intention SEO très élevée.
10. **BODACC.** SIREN → procédures collectives/changements → articles du Code de commerce et outils de recouvrement. API interrogeable immédiatement.

> **Juste derrière** : ACCO (accords d'entreprise) et l'Annuaire de l'administration — forte valeur de graphe, mais coût d'ingestion/parsing supérieur. À planifier en second lot.

---

## 5. Ce qu'il ne faut PAS intégrer et pourquoi

| Dataset / source | Pourquoi l'écarter |
|---|---|
| **BOSS (Bulletin officiel de la sécurité sociale)** | `boss.gouv.fr` renvoie `000` en `curl` (WAF) et n'expose **pas d'API ni de jeu de données open data structuré**. Contenu réglementaire HTML → scraping fragile, maintenance lourde, faible connexion au graphe (déjà couvert par les articles LEGI). À citer en éditorial seulement. |
| **BOAMP / marchés publics** | `boamp-datadila.opendatasoft.com` fonctionne (`200`), mais la valeur pour un outil juridique grand public est faible (veille marché, pas de règle de droit). Pas d'arête forte vers articles/décisions. |
| **Statistiques justice** (population carcérale, condamnations, milieu ouvert, annuaires statistiques) | Séries agrégées (criminologie/administration). Aucune clé adresse/entreprise/article. Intérêt éditorial, **pas** un tool. |
| **INSEE BPE, Filosofi, DVF « contexte », zonages IRIS** | Données de contexte socio-économique par commune/IRIS. Enrichissent des pages mais ne connectent aucun dataset juridique → « pages sans graphe », précisément l'anti-objectif. |
| **Météo-France (AROME, vigilance, radar…)**, **VigiEau**, **Camino**, **qualité de l'air/pollen** | `open_with_account` ou non pertinents ; aucun lien avec le droit applicable à une adresse hors cas très spécifiques. VigiEau (`200`) pourrait n'être qu'une pastille de contexte → non prioritaire. |
| **API Entreprise / API Particulier (bouquet)** | `access_type: restricted`, **habilitation obligatoire**, finalité contrôlée, cadre contractuel. Non intégrable sans démarche ; la version open data (Recherche d'entreprises) suffit. |
| **Data.Subvention** | `restricted` ; objet associatif/subventions, pas de règle de droit. |
| **API Judilibre / Légifrance via PISTE** | `restricted` (compte gratuit mais quota/jeton). À réserver à un **usage de fraîcheur** des fonds déjà ingérés (LEGI/KALI/CASS/JADE), pas à un nouveau dataset. Ne pas dupliquer l'ingestion DILA existante. |
| **Fonds DILA déjà couverts** (LEGI, KALI, CASS, CAPP, INCA, JADE, CONSTIT, JORF) | **Déjà dans Loilà** (101 k articles, 57 k décisions, 18 CCN). Ne pas « réintégrer » : surveiller les deltas via `echanges.dila.gouv.fr` / l'API et alimenter `provenance`. Seul ajout utile : **ACCO** (+ éventuellement BOCC) pour les accords et l'extension des CCN. |
| **Sous-datasets locaux de collectivités** (Poitiers, Brest, régions…) | Des centaines de jeux redondants/partiels ; aucun intérêt national, forte hétérogénéité. |
| **Bilans sociaux d'EDF, accords SNCF, données d'entreprises isolées** | Mono-entreprise, pas de généralisation. |
| **Taxe foncière / DMTO / impôts locaux** | À garder en contexte « info » éventuel, mais valeur juridique et graphe trop faibles pour être mis en avant dans le catalogue principal. |
| **RNE des élus, licences d'entrepreneurs de spectacles, RPPS** | Aucune connexion aux entités Loilà (hors annuaire d'entreprises, déjà couvert). |

---

## 6. Risques transverses

### 6.1 Licences et attribution

- **Majorité en Licence Ouverte 2.0** (Etalab) : réutilisation commerciale permise **avec attribution** (« Source : … , Licence Ouverte 2.0 »). Loilà, produit commercial, doit afficher la source et la date du millésime sur chaque bloc de données dérivé.
- **OdbL (ex. encadrement des loyers Paris)** : licence virale sur les bases dérivées → si la donnée est fusionnée dans une base Loilà, obligation de partage à l'identique du **contenu dérivé**. À isoler (table dédiée, attribution) ou à éviter de mélanger avec du contenu propriétaire.
- **Codes INSEE/BDM, DILA, ADEME, Géorisques** : Licence Ouverte mais **conditions d'usage API** (quotas, User-Agent, pas de revente brute). Prévoir un cache et du rate-limiting côté Loilà.
- **Attribution & millésime** : beaucoup de datasets sont versionnés (zonage 26/06/2026, DPE au 30/06/2026, RNIC T3 2025, IRL 2026-Q2). Le graphe doit tracer la **date de millésime** (proche de la table `provenance`) pour pouvoir dater une réponse (« à jour au … »).

### 6.2 RGPD

- **Personnes physiques** : dirigeants (Recherche d'entreprises, RNE), signataires d'accords ACCO, noms dans RGE (emails/téléphones), listepersonnes BODACC. Ne pas republier de coordonnées personnelles ; ne pas construire de profilage.
- **Adresses et biens** : DVF, RNIC, RPLS, DPE sont des données « logement », pas des données personnelles en soi, mais leur croisement avec un SIREN/nom peut ré-identifier un propriétaire ou un bailleur. Éviter toute jointure adresse ↔ personne physique.
- **Non-diffusibles** : respecter `statut_diffusion` Sirene et les entreprises non diffusibles (exclues des datasets ouverts).
- **Minimisation** : ne stocker que les attributs nécessaires à la fonction (ex. étiquette DPE, plafond de loyer), pas le dump intégral.

### 6.3 Maintenance et fiabilité

- **Sources sans API officielle** : RNIC, RPLS, DVF, BDNB, zonage ABC, taux d'intérêt légal → imports par fichier, à rejouer à chaque millésime. Prévoir un job idempotent + checksum (le modèle `provenance` de Loilà est déjà adapté).
- **Endpoints mouvants / non stabilisés** : BAN a migré vers `data.geopf.fr/geocodage` (l'ancien `api-adresse` répond encore) ; BDNB expose un schéma PostgREST partiel ; `resultats_rapport_risque` (Géorisques) connaît des timeouts.
- **Sources à fiabilité douteuse** : **taux de l'intérêt légal** (API data.economie vide, XLS de 2011) → **ne pas automatiser**, extraire des arrêtés JORF déjà présents dans Loilà.
- **Hétérogénéité des identifiants** : BAN id indispensable pour joindre DPE/DVF/RNIC/PLU ; SIREN/SIRET pour joindre ACCO/BODACC/RGE/Sirene. **Priorité technique : normaliser `adresse` (BAN) et `entreprise` (SIREN/SIRET) avant tout.**
- **Volumétrie** : DPE (15,6 M), DVF, BDNB, ACCO (jusqu'à 230 Mo/semaine). SQLite single-file : privilégier des **tables d'index légères** (adresse/banId → valeur) plutôt que l'import intégral, et une base séparée si besoin.
- **Faux positifs de jointure** : IDCC `9999` (non renseigné), plusieurs DPE par logement, mutations multi-lots, adresses non normalisées → toujours afficher un niveau de confiance (le graphe Loilà a déjà `LINK_CONFIDENCE` dans `legal-refs.ts`, à réutiliser).
- **Dépendance** : 12+ APIs tierces = 12+ points de panne. Prévoir dégradation gracieuse (la page reste utile sans l'enrichissement) et cache local des réponses.

### 6.4 Recommandation d'ordonnancement

1. **Socle identifiants** : BAN + API Géo + SIREN/SIRET (via Recherche d'entreprises).
2. **Premier lot à effet immédiat** : Juridictions + IDCC/conventions + IRL.
3. **Lot immobilier** : DPE + Géorisques + encadrement des loyers + zonage ABC.
4. **Lot enrichissement** : GPU/PLU + BODACC + RGE.
5. **Second lot coûteux** : RNIC + DVF + ACCO (après stabilisation du socle).

Chaque intégration doit vérifier une seule question : *« quelle arête nouvelle du graphe apparaît ? »*. Si la réponse est « aucune », le dataset va en §5.
