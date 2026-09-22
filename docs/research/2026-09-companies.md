# Vérifier une entreprise — sources officielles françaises (recherche, septembre 2026)

> Mission AGENT 1 (ENTREPRISE). Recherche uniquement, vérification live par `curl` le 21 septembre 2026.
> Toutes les commandes et extraits JSON ci-dessous ont réellement été exécutés depuis ce poste (macOS, curl 8.7.1).
> **Environnement de test** : l'accès réseau fonctionne. Points à connaître :
> - `api.insee.fr` **répond uniquement en TLS 1.2 + HTTP/1.1** depuis ce poste ; en HTTP/2 par défaut curl renvoie `HTTP 000` / `INTERNAL_ERROR (err 2)`. Contournement : `--tlsv1.2 --http1.1`.
> - `data.inpi.fr` renvoie **403** en direct (protection anti-bot).
> - `entreprise.api.gouv.fr` renvoie **401** sans token (normal, accès restreint).

---

## 1. Synthèse

En 2026, une feature « Vérifier une entreprise » peut être construite **à 90 % avec des sources 100 % ouvertes, sans clé et sans habilitation** :

| Besoin | Source retenue | Accessible sans clé ? | Licence | Confiance |
|---|---|---|---|---|
| Identité (SIREN, dénomination, forme) | **API Recherche d'entreprises** (DINUM) + SIRENE | Oui | LOV2 (données) / MIT (API) | Certaine |
| État administratif, NAF, effectif | API Recherche d'entreprises | Oui | LOV2 | Certaine |
| Établissements | API Recherche d'entreprises (siège + `matching_etablissements`) | Oui | LOV2 | Certaine (avec limite : pas tous les étab.) |
| Annonces BODACC / procédures collectives | **Opendatasoft BODACC (DILA)** | Oui | Licence Ouverte (fr-lo) | Certaine |
| Certification RGE | **ADEME data-fair** | Oui | LOV2 | Certaine |
| Convention collective SIRET→IDCC | **Jeu de données DSN Ministère du Travail** | Oui (CSV 99 Mo) | LOV2 | **CERTAIN** (déclaratif DSN) |
| Index égapro | MTE (xlsx/API) | Oui | LOV2 | Certaine |
| TVA intracom | DGFiP / API Recherche d'entreprises | Oui | LOV2 | Certaine |
| Dirigeants (mandats) | API Recherche d'entreprises / RNE INPI | API : oui ; RNE : compte + licence | LOV2 / Licence INPI | Certaine (RGPD à cadrer) |
| Actes, statuts, comptes (bilans) | INPI RNE (data.inpi.fr) | Non (compte + identifiants techniques) | Licence INPI homologuée | Probable |
| Attestations (URSSAF, fiscale), Qualibat… | API Entreprise | Non (réservé secteur public) | etalab-2.0 (portail) | Non éligible a priori |

### Recommandation

**Quick win = API Recherche d'entreprises (DINUM) comme colonne vertébrale + ADEME RGE + BODACC, le tout caché en SQLite avec provenance.**

L'API DINUM agrège déjà SIRENE + RNE + associations + RGE + égapro + organismes de formation, en un seul appel par SIREN/SIRET. Elle expose directement `complements.est_rge`, `complements.liste_idcc` (par SIRET), `complements.egapro_renseignee`, `dirigeants[]`, `finances`, `matching_etablissements[]`. C'est le meilleur rapport effort/valeur, et cela évite d'obtenir une clé INSEE SIRENE (qui n'apporte que le stock SIRENE brut, déjà dans l'API).

**Blocage principal** : la convention collective. La source officielle SIRET→IDCC existe (DSN Ministère du Travail) et est de confiance **CERTAIN** quand elle est renseignée — mais elle est **déclarative, partielle et en retard de plusieurs mois** (colonne `MOIS`, code `9999` = non renseigné). Il n'existe **aucune** source officielle NAF→IDCC : ce serait une **estimation (PROBABLE/POSSIBLE)**, à ne jamais présenter comme certaine.

---

## 2. Sources en détail

### 2.1 API Recherche d'entreprises (Annuaire des Entreprises) — DINUM

- **ORGANISME** : Direction interministérielle du numérique (DINUM), avec INSEE (SIRENE) et INPI (RNE) comme partenaires données.
- **DATASET / API** : « API Recherche d'entreprises » (v1.0.0). Alimente aussi l'app `annuaire-entreprises.data.gouv.fr`.
- **URL** : `https://recherche-entreprises.api.gouv.fr` — Documentation : `https://recherche-entreprises.api.gouv.fr/docs/` (ReDoc) et spec OpenAPI `https://recherche-entreprises.api.gouv.fr/openapi.json`. Fiche : `https://www.data.gouv.fr/dataservices/api-recherche-dentreprises`.
- **LICENCE** : code API **MIT** ; données issues de SIRENE/RNE sous **Licence Ouverte 2.0 (LOV2)**. Réutilisation commerciale et indexation autorisées, paternité « DINUM / Annuaire des Entreprises ».
- **CONDITIONS** : **accès totalement ouvert, sans clé ni compte**. Limite **7 req/s par IP**, **30 req/s par ASN** ; HTTP 429 au dépassement ; l'administration peut réduire la limite. Recherche directe : si `q` = 9 chiffres (SIREN) ou 14 chiffres (SIRET), recherche directe et **les autres filtres sont ignorés silencieusement**.
- **FRÉQUENCE** : temps quasi réel, vue agrégée SIRENE (mise à jour INSEE quotidienne) + RNE (`date_mise_a_jour_rne`). Champs `date_mise_a_jour`, `date_mise_a_jour_insee`, `date_mise_a_jour_rne` fournis.
- **IDENTIFIANTS** : SIREN, SIRET, NAF/APE (`activite_principale` + `activite_principale_naf25`), IDCC, FINESS, UAI, RNA, RNF, ID RGE, TVA, EPCI, code commune/INSEE.
- **LIMITES** :
  - **Exclut les entreprises non-diffusibles** et celles refusées au RCS (protection RGPD automatique, mais donc trou de couverture).
  - `matching_etablissements` ne contient **PAS tous les établissements** et est **toujours vide** en recherche directe par SIREN.
  - Ne permet pas de lister exhaustivement la base Sirene (recherche uniquement).
  - `liste_rge` dans `siege` observé `null` alors que `complements.est_rge=true` → le détail RGE doit venir d'ADEME.
- **DONNÉES PERSONNELLES** : `dirigeants[]` = personnes physiques (nom, prénoms, année/date de naissance, qualité, nationalité). **Republiables** car issus du RNE (registre légal public), mais : ne pas exposer adresse personnelle/date de naissance complète (minimisation), prévoir un canal d'opposition (art. 21 RGPD), et ne jamais réafficher les non-diffusibles (déjà exclus par l'API).
- **CONFIDENCE SIRET→IDCC** : **PROBABLE** via `complements.liste_idcc` / `matching_etablissements[].liste_idcc` (même source DSN que 2.7, agrégée) ; **CERTAIN** via le jeu de données source 2.7.
- **VÉRIFIÉ** :

```bash
$ curl -s -m 25 "https://recherche-entreprises.api.gouv.fr/search?q=la%20poste&per_page=1"
HTTP 200 en 0.25 s
# extrait (tronqué)
{"results":[{"siren":"356000000","nom_complet":"LA POSTE","nom_raison_sociale":"LA POSTE",
 "nombre_etablissements":13131,"nombre_etablissements_ouverts":8862,
 "siege":{"activite_principale":"53.10Z","activite_principale_naf25":"53.10Y","date_mise_a_jour_insee":"2025-12-05T15:39:38",
   "etat_administratif":"A","siret":"35600000000048","liste_idcc":["9999","5516"],...},
 "activite_principale":"53.10Z","categorie_entreprise":"GE","date_mise_a_jour":"2026-09-21T08:43:33",
 "date_mise_a_jour_rne":"2026-03-04T16:22:49",
 "dirigeants":[{"nom":"BAUDRY","prenoms":"IRENE","annee_de_naissance":"1976","qualite":"Autre","type_dirigeant":"personne physique"}, ...],
 "complements":{"convention_collective_renseignee":true,"liste_idcc":["5001","9999"],"egapro_renseignee":true,
   "est_rge":true,"est_organisme_formation":true,"est_qualiopi":true,"est_association":false,
   "est_entrepreneur_individuel":false,"est_finess":true,"est_siae":false,"est_societe_mission":false,
   "est_uai":true,"est_patrimoine_vivant":false,"bilan_ges_renseigne":true,"a_aide_minimis":true,
   "a_aide_ademe":true,"est_administration":false,"liste_finess_juridique":["750073215"],...}}]}
```

Champs `complements` réellement observés : `collectivite_territoriale, convention_collective_renseignee, liste_idcc, liste_finess_juridique, numero_rnf, egapro_renseignee, est_achats_responsables, est_alim_confiance, est_association, est_avocat, est_bio, est_entrepreneur_individuel, est_entrepreneur_spectacle, est_ess, est_finess, est_organisme_formation, est_qualiopi, liste_id_organisme_formation, est_rge, est_siae, est_societe_mission, est_uai, est_patrimoine_vivant, bilan_ges_renseigne, identifiant_association, statut_entrepreneur_spectacle, type_siae, a_aide_minimis, a_aide_ademe, est_administration, est_service_public, est_l100_3`.

```bash
$ curl -s -m 20 "https://recherche-entreprises.api.gouv.fr/search?q=82454695600023&per_page=1"
# SIRET d'une entreprise RGE : croisement confirmé avec ADEME (2.5)
{"siren":"824546956","etat_administratif":"A","statut_diffusion":"O",
 "complements":{"convention_collective_renseignee":true,"liste_idcc":["2332"],"est_rge":true,...}}
```

---

### 2.2 INSEE SIRENE (API Sirene v3.11)

- **ORGANISME** : Institut national de la statistique et des études économiques (INSEE).
- **DATASET / API** : « API Sirene » (version **3.11**, publiée 27/08/2026 sur le portail). Base de répertoire interadministratif.
- **URL** : API `https://api.insee.fr/api-sirene/3.11` (base documentée sur data.gouv : `https://api.insee.fr/entreprises/sirene/V3.11`). Portail + souscription : `https://portail-api.insee.fr/catalog/api/2ba0e549-5587-3ef1-9082-99cd865de66f`. Open data : `https://www.data.gouv.fr/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret`.
- **LICENCE** : **Licence Ouverte / Open Licence 2.0**. L'INSEE **alerte sur les données à caractère personnel** et les obligations légales qui en découlent.
- **CONDITIONS** : **accès restreint** → compte portail INSEE + création d'application + **souscription** + clé API (OAuth2 `client_credentials`). **Limite 30 interrogations/minute** (l'INSEE peut la modifier). via API Entreprise : 250 req/min (groupe).
- **FRÉQUENCE** : base temps réel via API (SIRENE mise à jour en continu). Fichiers stock open data : **mensuel**.
- **IDENTIFIANTS** : SIREN, SIRET, NAF/APE (rev.2 + NAF 2025), catégorie juridique, tranche effectif.
- **LIMITES** : clé obligatoire → **non adapté à un appel live** côté Loilà ; les fichiers stock mensuels sont le bon usage (import initial / rattrapage). Certaines unités en **diffusion partielle** (`statutDiffusionUniteLegale` = `P`) : ne pas publier tous les champs. Passage à **NAF 2025** en janvier 2026 (tables de correspondance fournies).
- **DONNÉES PERSONNELLES** : SIRENE ne contient **pas** les dirigeants des personnes morales (c'est le RNE) ; elle contient les personnes physiques des **entrepreneurs individuels**. Respecter la diffusion partielle.
- **CONFIDENCE SIRET→IDCC** : **UNKNOWN** (SIRENE ne porte pas l'IDCC).
- **VÉRIFIÉ** :

```bash
# HTTP/2 par défaut -> échec réseau sur ce poste :
$ curl -s -o /dev/null -w "%{http_code}\n" "https://api.insee.fr/entreprises/sirene/V3/siren/552081317"
000   # curl: (92) HTTP/2 stream 1 was not closed cleanly: INTERNAL_ERROR (err 2)

# Contournement TLS1.2 + HTTP/1.1 -> l'API répond, mais exige un token :
$ curl -s --tlsv1.2 --http1.1 -m 15 -w "\nHTTP:%{http_code}\n" \
    "https://api.insee.fr/api-sirene/3.11/siret/35600000000048"
{"message":"Unauthorized","http_status_code":401}
HTTP:401

# Fichiers stock open data (sans clé) : dataset confirmé
$ curl -s "https://www.data.gouv.fr/api/1/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret/" | ...
license: lov2 | frequency: monthly | last_update: 2026-09-01
# ressources : StockUniteLegale, StockEtablissement, StockUniteLegaleHistorique,
# StockEtablissementHistorique — formats zip (CSV) et parquet
```

---

### 2.3 BODACC (Bulletin officiel des annonces civiles et commerciales) — DILA

- **ORGANISME** : DILA (Direction de l'information légale et administrative), sous l'autorité du Premier ministre.
- **DATASET / API** : portail Opendatasoft `bodacc-datadila.opendatasoft.com`, dataset **`annonces-commerciales`**, API **Explore v2.1**.
- **URL** : `https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records`. Documentation dataset : portail `datadila`. Fiche data.gouv : `https://www.data.gouv.fr/datasets/bodacc` (licence `fr-lo`, org « Premier ministre », fréquence `punctual`).
- **LICENCE** : **Licence Ouverte / Open Licence (fr-lo)** — réutilisation commerciale et indexation autorisées, mention de source.
- **CONDITIONS** : **ouvert, sans clé**. En-têtes renvoyés : `X-RateLimit-Limit: 5000000`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (reset quotidien) — quotas généreux, mais **ne pas interroger en live à chaque vue** (voir plan).
- **FRÉQUENCE** : publication quotidienne (annonces du jour) ; `data_processed` observé = 2026-09-20. 50 722 116 enregistrements au total.
- **IDENTIFIANTS** : `registre` = **SIREN** (formaté « 752 461 681 » et brut), SIRET/n° RCS présents dans les blobs JSON (`listepersonnes`, `listeetablissements`), RCS/ville/greffe, département/région.
- **LIMITES** :
  - Le SIREN est dans le tableau `registre`, souvent en **deux formats** (`["752461681","752 461 681"]`) → normaliser.
  - Les détails (jugement, personnes, établissements, actes, dépôts de comptes) sont des **chaînes JSON imbriquées** (`jugement`, `listepersonnes`, `listeetablissements`, `acte`, `depot`, `radiationaurcs`) → à parser.
  - Volume énorme (50 M) : une requête non filtrée est lourde → **touj** filtrer par `registre`.
  - API Explore v2.1 : en-tête de dépréciation présente mais v2.1 est la version courante.
- **DONNÉES PERSONNELLES** : `listepersonnes` contient dirigeants/liquidateurs. Le BODACC est un **journal officiel public** (art. R 123-209 code de commerce) → **republication possible**, mais prudence sur les adresses personnelles et prévoir une procédure d'opposition ; les **liquidateurs/juges sont des professionnels** (peu sensibles).
- **CONFIDENCE SIRET→IDCC** : **UNKNOWN**.
- **VÉRIFIÉ** :

```bash
# Total
$ curl -s --compressed "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records?limit=0&select=count(*)%20as%20total"
{"total_count": 50722116, "results": []}

# Facettes des familles (extrait)
$ curl -s --compressed ".../facets?facet=familleavis&limit=20"
dpc 26416512 | modification 8523785 | creation 6587752 | radiation 4226327 |
collective 3336965 | vente 891695 | immatriculation 728116 | conciliation 4312 | ...
# -> les procédures collectives = familleavis = "collective" ("Procédures collectives")

# Par SIREN (EDF)
$ curl -s --compressed ".../records?limit=2&where=registre%3D%22552081317%22&order_by=dateparution%20desc"
total 121
B202601764255 2026-09-15 modification Modifications diverses ELECTRICITE DE FRANCE
C202601714396 2026-09-08 dpc Dépôts des comptes ELECTRICITE DE FRANCE

# Procédure collective réelle (liquidation)
$ curl -s --compressed ".../records?limit=1&where=familleavis%3D%22collective%22&order_by=dateparution%20desc"
{"id":"A202601803235","dateparution":"2026-09-20","familleavis_lib":"Procédures collectives",
 "typeavis_lib":"Avis initial","registre":["911093649","911 093 649"],"commercant":"2S CLEAN SERVICES",
 "jugement":"{\"type\":\"initial\",\"famille\":\"Jugement d'ouverture\",\"nature\":\"Jugement d'ouverture de liquidation judiciaire\",...}",
 "url_complete":"https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:C202500182618"}

# Filtre combiné SIREN + collective (retourne bien 1 résultat pour 911093649)
$ curl ... "?where=registre%3D%22911093649%22%20AND%20familleavis%3D%22collective%22"
total 1
```

Champs dataset : `id, publicationavis, parution, dateparution, numeroannonce, typeavis, typeavis_lib, familleavis, familleavis_lib, numerodepartement, departement_nom_officiel, region_code, region_nom_officiel, tribunal, commercant, ville, registre, cp, pdf_parution_subfolder, ispdf_unitaire, listepersonnes, listeetablissements, jugement, acte, modificationsgenerales, radiationaurcs, depot, listeprecedentexploitant, listeprecedentproprietaire, divers, parutionavisprecedent, url_complete`.

---

### 2.4 RNE / INPI (Registre national des entreprises)

- **ORGANISME** : INPI (Institut national de la propriété industrielle).
- **DATASET / API** : RNE. Portail **data.inpi.fr** (« Espace Open data » : API, FTP/SFTP), API interne `registre-national-entreprises.inpi.fr/api/companies/{siren}`. Fiche data.gouv : `https://www.data.gouv.fr/datasets/registre-national-des-entreprises` (org INPI, licence **`notspecified`** dans les métadonnées, mais une **licence propre homologuée** s'applique).
- **URL** : `https://data.inpi.fr` ; licence : `https://www.inpi.fr/sites/default/files/Licence données RNE_2024_0.pdf`.
- **LICENCE** : **Licence de réutilisation des informations de l'INPI — RNE, homologuée par l'État** (2024). Droit **non exclusif, gratuit, commercial ou non, monde entier, durée illimitée**, sous réserve de **mention de paternité + date de dernière mise à jour**. Réutilisation encadrée par le livre III du CRPA.
- **CONDITIONS** : **compte obligatoire** (nom, prénom, email) + acceptation de la licence ; pour les **API/FTP open data** : **identifiants techniques** délivrés par l'INPI. **Limite CGU** : interdiction d'extraire/réutiliser **> 10 % du flux annuel** et/ou **> 10 requêtes/minute**. (Actes, statuts, PV, comptes nécessitent aussi un compte.)
- **FRÉQUENCE** : flux RNE continu ; extractions open data périodiques.
- **IDENTIFIANTS** : SIREN, SIRET, dénomination, forme juridique, **dirigeants/mandataires**, **actes** (statuts, PV), **comptes annuels (bilans)**, RCS.
- **LIMITES** :
  - **Pas d'accès anonyme** : `data.inpi.fr` renvoie 403 en direct ; l'API renvoie 401. Toute exploitation nécessite une demande et des identifiants.
  - Beaucoup de documents (actes/comptes) sont **scannés/PDF**, peu structurés.
  - « > 10 % du flux annuel » = ambigu pour une base de 5 M d'entreprises ; à cadrer avec l'INPI.
  - Depuis le décret n° 2025-840, l'adresse du domicile des représentants peut être **occultée** (le RCS) → ne pas la rediffuser.
- **DONNÉES PERSONNELLES** : **dirigeants, associés, dates de naissance, nationalités, adresses** = données personnelles sensibles juridiquement. Le RNE est un registre public, la réutilisation est autorisée par la licence, **mais** : minimiser, prévoir l'opposition (art. 21 RGPD), ne pas refaire un « annuaire de personnes » indexable sans base légale, et respecter les occultations.
- **CONFIDENCE SIRET→IDCC** : **UNKNOWN**.
- **VÉRIFIÉ** :

```bash
$ curl -s -o /dev/null -w "data.inpi.fr HTTP:%{http_code}\n" "https://data.inpi.fr/"
data.inpi.fr HTTP:403            # protection anti-bot
$ curl -s -o /dev/null -w "api.inpi.fr HTTP:%{http_code}\n" "https://api.inpi.fr/"
api.inpi.fr HTTP:000             # hôte inexistant/fermé
$ curl -s -m 20 "https://registre-national-entreprises.inpi.fr/api/companies/552081317"
{"code":"401","message":"Vous n'avez pas les droits","type":"access_denied"}   HTTP:401
```

---

### 2.5 ADEME — Liste des entreprises RGE

- **ORGANISME** : ADEME (Agence de la transition écologique).
- **DATASET / API** : « **Liste des entreprises RGE** », dataset data-fair id `liste-des-entreprises-rge-2`. Fiche data.gouv : `https://www.data.gouv.fr/datasets/liste-des-entreprises-rge` (org ADEME, `lov2`, fréquence **daily**).
- **URL** : `https://data.ademe.fr/datasets/liste-des-entreprises-rge-2` ; API : `https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines`.
- **LICENCE** : **Licence Ouverte / Open Licence (LOV2)** — republication et indexation autorisées.
- **CONDITIONS** : **ouvert, sans clé ni token**. Pas de quota publicitaire documenté (API data-fair) → usage raisonnable, pas d'appel live par vue.
- **FRÉQUENCE** : « daily » (data.gouv, MAJ 2026-09-21) ; `updatedAt` data-fair observé 2026-06-30 ; `count` = **159 770** certifications.
- **IDENTIFIANTS** : **SIRET**, nom_entreprise ; code_qualification, domaine, organisme.
- **LIMITES** :
  - Clé de jointure = **SIRET** (pas SIREN) → agréger au niveau SIREN côté Loilà.
  - Plusieurs lignes par entreprise (une par domaine/qualification/organisme) → table 1-N.
  - Validité dans le temps via `lien_date_debut` / `lien_date_fin` (ex. `2099-01-01` = sans terme).
  - Contient aussi des particuliers (`particulier: true`) selon qualifications.
- **DONNÉES PERSONNELLES** : données d'entreprise (SIRET), téléphone/email d'établissement → pro ; pas de données personnelles de dirigeants.
- **CONFIDENCE SIRET→IDCC** : **UNKNOWN**.
- **VÉRIFIÉ** :

```bash
$ curl -s "https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines?qs=siret:82454695600023&size=3"
total 1
{"siret":"82454695600023","nom_entreprise":"EL ARCHITECTURE","domaine":"Architecte",
 "nom_qualification":"Architecte sur le site faire.fr (2)","organisme":"cnoa","code_postal":"59320",
 "lien_date_debut":"2019-10-16","lien_date_fin":"2099-01-01",
 "url_qualification":"https://ws-api.architectes.org/faire/v2/attestation/S19344/..."}

# Schéma complet confirmé
siret, nom_entreprise, adresse, code_postal, commune, latitude, longitude, telephone, email,
site_internet, code_qualification, nom_qualification, url_qualification, nom_certificat,
domaine, meta_domaine, organisme, particulier, lien_date_debut, lien_date_fin
```

---

### 2.6 API Entreprise (Bouquet DINUM)

- **ORGANISME** : DINUM (opérateur), producteurs multiples (INSEE, DGFiP, URSSAF, INPI, ADEME, Agence Bio, Qualibat, Qualifelec…).
- **DATASET / API** : « API Entreprise » (catalogue v3). Portail : `https://entreprise.api.gouv.fr`. Catalogue : `https://entreprise.api.gouv.fr/catalogue`.
- **URL** : base `https://entreprise.api.gouv.fr` (ex. `https://entreprise.api.gouv.fr/v3/insee/sirene/unites_legales/{siren}`).
- **LICENCE** : portail sous **etalab-2.0** ; chaque donnée garde la licence de son producteur.
- **CONDITIONS** : **accès restreint / sur habilitation**. Destiné prioritairement aux **administrations et collectivités** ; certaines API sont « Publique — API incluse par défaut » (ex. **TVA DGFiP**, **Certification Qualibat**, **Certification Qualifelec**, **Attestation d'immatriculation RNE**). **Token obligatoire** (`Authorization: Bearer`), **1000 requêtes/min par IP**. Vérification d'éligibilité obligatoire.
- **FRÉQUENCE** : dépend de l'API (généralement temps réel/producteur).
- **IDENTIFIANTS** : SIREN/SIRET, RNA, RNF.
- **LIMITES** : **Loilà (éditeur privé) n'est a priori PAS éligible** à la plupart des endpoints (réservés secteur public / cas d'usage légal). Les certificats Qualibat/Qualifelec ne sont accessibles **que** via API Entreprise (pas de jeu open data autonome équivalent vérifié). Ne pas bâtir la feature dessus.
- **DONNÉES PERSONNELLES** : cadrées par les habilitations producteurs.
- **CONFIDENCE SIRET→IDCC** : **UNKNOWN**.
- **VÉRIFIÉ** :

```bash
$ curl -s -m 20 "https://entreprise.api.gouv.fr/v3/insee/sirene/unites_legales/552081317"
{"errors":[{"code":"00101","title":"Interdit",
 "detail":"Votre token n'est pas renseigné","source":{"parameter":"token"},"meta":{}}]}   HTTP:401
```

---

### 2.7 Convention collective : source officielle SIRET → IDCC

- **ORGANISME** : Ministère du Travail, du Plein emploi et de l'Insertion.
- **DATASET / API** : « **Liste des conventions collectives par entreprise (SIRET)** ». Fiche : `https://www.data.gouv.fr/datasets/liste-des-conventions-collectives-par-entreprise-siret`. Exploité par le **Code du travail numérique** (`code.travail.gouv.fr`). **Pas d'API** : fichier **CSV**.
- **URL (ressource courante)** : `https://static.data.gouv.fr/resources/liste-des-conventions-collectives-par-entreprise-siret/20260915-072523/transsismmo-weez-idcc-0726.csv` — **99 359 678 octets (~99 Mo)**, 4 colonnes.
- **LICENCE** : **LOV2** (Licence Ouverte 2.0). Republication autorisée.
- **CONDITIONS** : **ouvert, sans clé**. Fichier volumineux → **import batch** (pas d'appel live).
- **FRÉQUENCE** : `punctual` ; `last_update` 2026-09-15. **Issue de la DSN**, « mise à jour ponctuellement avec **plusieurs mois de retard** ».
- **IDENTIFIANTS** : **SIRET**, **IDCC**, `MOIS`, `DATE_MAJ`.
- **LIMITES** :
  - **Déclaratif** (ce que l'employeur déclare en DSN), **pas exhaustif** (établissements sans salarié / sans DSN absents).
  - **`IDCC = 9999`** ⇒ convention **non renseignée/indéterminée** (observé ~ fréquent dans l'échantillon).
  - Latence de plusieurs mois.
  - La colonne IDCC est le n° de convention ; le texte se consulte via Légifrance/KALI.
- **DONNÉES PERSONNELLES** : aucune (couple SIRET/IDCC).
- **CONFIDENCE SIRET→IDCC** : **CERTAIN** lorsque le SIRET figure dans le fichier avec un IDCC ≠ 9999 (donnée officielle déclarative DSN). **UNKNOWN** si absent, **POSSIBLE→PROBABLE** via heuristique NAF→IDCC (voir 2.8).
- **VÉRIFIÉ** :

```bash
$ curl -sI ".../transsismmo-weez-idcc-0726.csv"
content-length: 99359678   last-modified: Tue, 15 Sep 2026 07:25:33 GMT

# En-tête + extrait (lecture partielle par Range)
$ curl -s -r 0-2000 ".../transsismmo-weez-idcc-0726.csv"
MOIS,SIRET,IDCC,DATE_MAJ
2026-07,40416412100141,2614  ,2026/08/25
2026-07,98531412900018,1486  ,2026/08/25
2026-07,39342630900018,2511  ,2026/08/25
2026-07,44460844215461,9999  ,2026/08/25    <- 9999 = non déterminée
2026-07,78088757600012,3218  ,2026/08/25
```

---

### 2.8 Convention collective : IDCC → texte, et NAF→IDCC

- **IDCC → texte** : **DILA KALI**, dataset `https://www.data.gouv.fr/datasets/kali-conventions-collectives-nationales` — licence **`fr-lo`**, fréquence **daily**, XML (`https://echanges.dila.gouv.fr/OPENDATA/KALI/`). Loilà en a déjà 18. Ressource utile : `Dila_Kali_Liste_correspondances_conventions-idcc-*.xlsx` (correspondance **intitulé ↔ IDCC**, PAS NAF↔IDCC).
- **NAF → IDCC** : **aucune source officielle n'existe**. Le jeu « Conventions collectives appliquées, par département et secteur d'activité » (`https://www.data.gouv.fr/datasets/conventions-collectives-appliquees-par-departement-et-secteur-dactivite`, LOV2, **producteur tiers Firmio**) est un **croisement statistique** NAF/département↔IDCC, pas une source normative → **estimation (POSSIBLE)**.
- **VÉRIFIÉ** : le dataset Firmio est bien **tiers** (org « Firmio »), donc non officiel. KALI est bien DILA, `fr-lo`, daily.

**Conclusion** : pour afficher une convention collective, utiliser le **SIRET→IDCC officiel DSN (2.7)** avec statut **CERTAIN** ; ne jamais déduire un IDCC du NAF comme fait établi.

---

### 2.9 Autres sources utiles (vérifiées)

- **Index égapro (MTE)** : « Index Egalité Professionnelle F/H des entreprises de 50 salariés ou plus », **LOV2**, **daily**, org Ministère du Travail. Ressource xlsx : `https://egapro.travail.gouv.fr/index-egalite-fh.xlsx`. ⚠️ `recherche-entreprises` expose seulement `complements.egapro_renseignee` (booléen). Fiche : `https://www.data.gouv.fr/datasets/index-egalite-professionnelle-f-h-des-entreprises-de-50-salaries-ou-plus`.
- **TVA intracommunautaire (DGFiP)** : dataset « Numéros de TVA Intracommunautaire français » (`.../datasets/numeros-de-tva-intracommunautaire-francais`), **LOV2** ; aussi exposé par `recherche-entreprises.tva` (ex. `["FR03552081317"]`).
- **KALI / LEGI** : déjà intégrés (DILA). Licence Ouverte.
- **Annonces BODACC PDF** : `url_complete` + `ispdf_unitaire` (`oui`) ; PDF parus sur `bodacc.fr`.
- **Non retenus / non vérifiables en ouvert** : actes et comptes RNE (compte + identifiants), URSSAF attestation vigilance, Qualibat/Qualifelec (API Entreprise uniquement).

---

## 3. Modèle de données proposé (SQLite)

À intégrer dans la table `provenance` existante (`dataset`, `source`, `origin_url`, `origin_ref`, `mirror`, `raw_checksum`, `extractor`, `extractor_version`, `imported_at`, `verified_at`). Chaque table porte `provenance_id` (FK) et, pour les entités « live », `verified_at` + `expires_at` (TTL de cache).

```sql
-- 1. Unité légale
CREATE TABLE company (
  siren                    TEXT PRIMARY KEY,
  nom_complet              TEXT,
  nom_raison_sociale       TEXT,
  sigle                    TEXT,
  nature_juridique         TEXT,          -- code (ex. 5599)
  categorie_entreprise     TEXT,          -- PME/PMI/ETI/GE
  activite_principale      TEXT,          -- NAF rev2 (ex. 53.10Z)
  activite_principale_naf25 TEXT,         -- NAF 2025 (ex. 53.10Y)
  section_activite_principale TEXT,
  etat_administratif       TEXT,          -- A=actif, C=cessé
  date_creation            TEXT,
  date_fermeture           TEXT,
  tranche_effectif_salarie TEXT,
  annee_tranche_effectif    INTEGER,
  caractere_employeur      TEXT,
  tva                      TEXT,          -- JSON array
  statut_diffusion         TEXT,          -- O / P (partiel => filtrer !)
  siege_siret              TEXT REFERENCES establishment(siret),
  -- complements (drapeaux API DINUM)
  convention_collective_renseignee INTEGER,
  egapro_renseignee        INTEGER,
  est_rge                  INTEGER,
  est_organisme_formation  INTEGER,
  est_qualiopi             INTEGER,
  est_association          INTEGER,
  est_ess                  INTEGER,
  est_societe_mission      INTEGER,
  est_entrepreneur_individuel INTEGER,
  est_finess               INTEGER,
  est_siae                 INTEGER,
  est_uai                  INTEGER,
  est_patrimoine_vivant    INTEGER,
  est_bio                  INTEGER,
  bilan_ges_renseigne      INTEGER,
  a_aide_minimis           INTEGER,
  a_aide_ademe             INTEGER,
  est_administration       INTEGER,
  complements_json         TEXT,          -- compléments non éclatés
  date_mise_a_jour_insee   TEXT,
  date_mise_a_jour_rne     TEXT,
  provenance_id            INTEGER REFERENCES provenance(id),
  fetched_at               TEXT,
  expires_at               TEXT
);

-- 2. Établissement
CREATE TABLE establishment (
  siret                    TEXT PRIMARY KEY,
  siren                    TEXT NOT NULL REFERENCES company(siren),
  est_siege                INTEGER,
  activite_principale      TEXT,
  activite_principale_naf25 TEXT,
  etat_administratif       TEXT,
  caractere_employeur      TEXT,
  numero_voie              TEXT,
  type_voie                TEXT,
  libelle_voie             TEXT,
  complement_adresse       TEXT,
  code_postal              TEXT,
  commune_code             TEXT,          -- code INSEE commune
  libelle_commune          TEXT,
  departement              TEXT,
  region                   TEXT,
  epci                     TEXT,
  latitude                 REAL,
  longitude                REAL,
  coordonnees              TEXT,
  date_creation            TEXT,
  date_debut_activite      TEXT,
  date_fermeture           TEXT,
  tranche_effectif_salarie TEXT,
  liste_enseignes          TEXT,          -- JSON
  liste_idcc               TEXT,          -- JSON (SIRET->IDCC API)
  liste_rge                TEXT,          -- JSON
  statut_diffusion_etablissement TEXT,
  provenance_id            INTEGER REFERENCES provenance(id),
  expires_at               TEXT
);
CREATE INDEX idx_etab_siren ON establishment(siren);

-- 3. Annonces BODACC
CREATE TABLE company_announcement (
  bodacc_id                TEXT PRIMARY KEY,   -- ex. A202601803235
  siren                    TEXT,               -- normalisé depuis registre
  dateparution             TEXT,
  familleavis              TEXT,               -- collective, dpc, modification...
  familleavis_lib          TEXT,
  typeavis                 TEXT,
  typeavis_lib             TEXT,               -- Avis initial, ...
  parution                 TEXT,
  numeroannonce            INTEGER,
  tribunal                 TEXT,
  departement              TEXT,
  ville                    TEXT,
  code_postal              TEXT,
  commercant               TEXT,
  url_complete             TEXT,
  ispdf_unitaire           TEXT,
  jugement_json            TEXT,               -- JSON brut
  listepersonnes_json      TEXT,               -- JSON brut (RGPD: filtrer)
  listeetablissements_json TEXT,
  acte_json                TEXT,
  depot_json               TEXT,
  radiationaurcs_json      TEXT,
  provenance_id            INTEGER REFERENCES provenance(id)
);
CREATE INDEX idx_ann_siren_date ON company_announcement(siren, dateparution DESC);
CREATE INDEX idx_ann_famille ON company_announcement(familleavis);

-- 4. Certification RGE (1-N par SIRET/domaine/organisme)
CREATE TABLE rge_certification (
  id                       INTEGER PRIMARY KEY,
  siret                    TEXT NOT NULL REFERENCES establishment(siret),
  siren                    TEXT,
  nom_entreprise           TEXT,
  organisme                TEXT,               -- qualitenr, cnoa, qualibat...
  domaine                  TEXT,
  meta_domaine             TEXT,
  code_qualification       TEXT,
  nom_qualification        TEXT,
  nom_certificat           TEXT,
  url_qualification        TEXT,
  particulier              INTEGER,
  lien_date_debut          TEXT,
  lien_date_fin            TEXT,               -- 2099-01-01 = sans terme
  provenance_id            INTEGER REFERENCES provenance(id),
  UNIQUE(siret, domaine, nom_qualification, organisme, lien_date_debut)
);
CREATE INDEX idx_rge_siren ON rge_certification(siren);

-- 5. Convention collective par entreprise/établissement
CREATE TABLE company_agreement (
  siret                    TEXT,
  siren                    TEXT,
  idcc                     TEXT NOT NULL,       -- 4 chiffres ("0843"), 9999 = non déterminée
  mois                     TEXT,                -- ex. 2026-07 (source DSN)
  date_maj_source          TEXT,                -- ex. 2026/08/25
  statut                   TEXT NOT NULL CHECK (statut IN ('CERTAIN','PROBABLE','POSSIBLE','UNKNOWN')),
  source                   TEXT,                -- 'DSN_MIN_TRAVAIL' | 'API_RECHERCHE_ENTREPRISES'
  provenance_id            INTEGER REFERENCES provenance(id),
  PRIMARY KEY (siret, idcc)
);
CREATE INDEX idx_agree_siren ON company_agreement(siren);

-- 6. Dirigeants (table distincte, régime RGPD explicite)
CREATE TABLE company_director (
  id                       INTEGER PRIMARY KEY,
  siren                    TEXT NOT NULL REFERENCES company(siren),
  type_dirigeant           TEXT,                -- personne physique / personne morale
  nom                      TEXT,
  prenoms                  TEXT,
  annee_de_naissance       INTEGER,             -- NE PAS stocker la date complète
  qualite                  TEXT,
  -- PAS de date_de_naissance complète, PAS d'adresse personnelle, PAS de nationalité
  provenance_id            INTEGER REFERENCES provenance(id),
  last_seen_at             TEXT,
  opposition_flagged       INTEGER DEFAULT 0    -- art. 21 RGPD : ne plus afficher
);
CREATE INDEX idx_dir_siren ON company_director(siren);
```

Règles de cache (SQLite, writer unique) :
- Toute requête sortante (DINUM, BODACC, ADEME) est **écrite en base avec `provenance`** avant restitution.
- `expires_at` par famille : identité/établissements **7–30 j** (SIRENE évolue peu) ; BODACC **24 h** (nouvelles annonces) ; RGE **7 j** (dataset daily) ; IDCC = import batch (pas de TTL).
- **Jamais d'appel live bloquant à chaque vue** : lire SQLite ; si absent, réponse « à rafraîchir » + job d'enrichissement.

---

## 4. API / endpoints exacts (récap des appels vérifiés)

```bash
# --- Recherche d'entreprises (DINUM) : identité + étab + dirigeants + complements
curl -s "https://recherche-entreprises.api.gouv.fr/search?q=<SIREN|SIRET|nom>&page=1&per_page=10"
# NB: per_page max 25 ; q=9/14 chiffres => recherche directe (filtres ignorés)

# --- BODACC par SIREN (normaliser le SIREN sans espaces)
curl -s --compressed "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records?\
limit=20&where=registre%3D%22<SIREN>%22&order_by=dateparution%20desc"
# Procédures collectives uniquement :
#   &where=registre%3D%22<SIREN>%22%20AND%20familleavis%3D%22collective%22

# --- ADEME RGE par SIRET
curl -s "https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines?qs=siret:<SIRET>&size=20"

# --- Convention collective SIRET->IDCC (fichier ~99 Mo, import batch)
curl -sI "https://static.data.gouv.fr/resources/liste-des-conventions-collectives-par-entreprise-siret/20260915-072523/transsismmo-weez-idcc-0726.csv"

# --- INSEE SIRENE (clé requise ; TLS1.2/HTTP1.1 sur certains réseaux)
curl -s --tlsv1.2 --http1.1 -H "Authorization: Bearer <TOKEN>" \
  "https://api.insee.fr/api-sirene/3.11/siret/<SIRET>"   # sans token => 401 Unauthorized

# --- egapro (xlsx) / TVA
curl -sO "https://egapro.travail.gouv.fr/index-egalite-fh.xlsx"
# TVA : exposé par recherche-entreprises (champ "tva") + dataset DGFiP LOV2
```

Réponses réelles tronquées : voir les blocs « VÉRIFIÉ » de chaque section (2.1 à 2.8).

---

## 5. Risques

**Licence**
- Toutes les sources retenues (DINUM, BODACC, ADEME, DSN MTE, egapro, DGFiP, KALI) sont en **Licence Ouverte / LOV2 / fr-lo** → réutilisation commerciale et indexation **autorisées** avec mention de source + date.
- **INPI RNE** : licence propre homologuée (réutilisation large mais **paternité obligatoire**, **plafond 10 % du flux annuel / 10 req/min**). À cadrer contractuellement.
- **API Entreprise** : accès restreint, Loilà probablement **non éligible** → ne pas en dépendre.

**RGPD**
- **Dirigeants (RNE / API DINUM / BODACC)** = données personnelles. Base légale = registre public ; republication possible mais : minimisation (pas de date de naissance complète, pas d'adresse perso, pas de nationalité), **procédure d'opposition** (art. 21), et exclusion des **non-diffusibles** (`statut_diffusion='P'`).
- Les nouvelles dispositions (loi 2025-594, décret 2025-840) renforcent l'occultation du **domicile des dirigeants** → ne jamais le rediffuser depuis le RNE.
- Éviter tout produit « annuaire de personnes » indexable (risque CNIL) ; indexer la **fiche entreprise**, pas la personne.

**Rate-limit**
- DINUM : **7 req/s/IP, 30 req/s/ASN** (429). Un import massif depuis un cloud peut saturer l'ASN → batch nocturne espacé.
- BODACC : quota généreux mais **50 M lignes** ; ne jamais requêter sans filtre `registre`.
- INSEE : **30/min** ; RNE INPI : **10/min**.
- **Conséquence** : cache SQLite obligatoire, jamais d'appel live par vue.

**Qualité / couverture**
- API DINUM exclut les non-diffusibles (trou assumé).
- `matching_etablissements` incomplet ; `liste_rge` (siège) observé vide → **toujours croiser avec ADEME**.
- IDCC : **partiel**, **en retard de plusieurs mois**, `9999` = inconnu.
- BODACC : blobs JSON hétérogènes (`jugement`, `listepersonnes`) → parsing défensif.
- NAF 2025 : double nomenclature (`activite_principale` + `_naf25`) à gérer.

---

## 6. Plan d'implémentation

### 6.1 Quick win (MVP, ~1 semaine)

1. **Table `company` + `establishment`** alimentées par **API Recherche d'entreprises** (1 appel par SIREN/SIRET), **cachées en SQLite** avec `provenance` (`dataset='recherche-entreprises.api.gouv.fr'`, `origin_ref=<siren>`).
   - Restitue : identité, état administratif, NAF, effectif, catégorie, TVA, dirigeants, drapeaux (`est_rge`, `est_organisme_formation`, `egapro_renseignee`, `liste_idcc`).
2. **`rge_certification`** : **import du dataset ADEME** (159 770 lignes) en batch ; jointure sur SIRET pour le détail RGE (domaines, qualifications, validité).
3. **`company_announcement`** : à l'ouverture d'une fiche, si cache absent, **1 appel BODACC par SIREN** (`registre=<siren>`), stockage, affichage. Mettre en avant `familleavis='collective'` (Procédures collectives), `radiation`, `vente`.
4. **`company_agreement`** : **import mensuel du CSV DSN** (SIRET→IDCC), statut **CERTAIN** ; fallback `complements.liste_idcc` (statut **PROBABLE**) si SIRET absent.
5. UI : un badge de confiance par bloc + lien « source » (provenance).

**Sans clé, sans habilitation, tout en LOV2.** Couvre ~100 % du besoin « identité / état / établissements / NAF / BODACC / RGE / convention ».

### 6.2 Complet (v2+)

- **SIRENE INSEE** (clé) : import des fichiers **stock mensuels** (UniteLegale/Etablissement + Historique) pour l'exhaustivité et l'historique.
- **RNE INPI** (compte + identifiants techniques + licence) : dirigeants, **actes**, **comptes/bilans** (PDF). Cadrer le plafond 10 %.
- **egapro** : import xlsx quotidien ; afficher le score quand `egapro_renseignee`.
- **TVA DGFiP** : dataset complet en complément.
- **API Entreprise** : uniquement si Loilà devient éligible (a priori non).
- **Historique** : conserver les versions (BODACC, SIRENE historique) pour un fil « due diligence » (créations/radiations dans le temps).

---

## 7. Annexe — tableau de confiance SIRET→convention collective

| Chemin | Statut | Justification |
|---|---|---|
| SIRET présent dans le CSV **DSN Ministère du Travail** (IDCC ≠ 9999) | **CERTAIN** | Donnée officielle déclarative, source unique de l'État |
| SIRET absent du CSV, IDCC via `complements.liste_idcc` (API DINUM, SIREN) | **PROBABLE** | Même source DSN mais agrégée au niveau unité légale |
| SIRET absent, déduction via **NAF** (aucune table officielle) | **POSSIBLE** | Heuristique statistique, jamais normative |
| SIRET introuvable partout, IDCC `9999` | **UNKNOWN** | Convention non déclarée |

---

*Rapport généré le 21 septembre 2026. Toutes les URL et statuts HTTP cités ont été vérifiés par curl à cette date. Les endpoints nécessitant une clé (INSEE) ou une habilitation (INPI RNE, API Entreprise) sont signalés explicitement avec leur code de retour réel.*
