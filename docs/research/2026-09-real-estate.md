# Loilà — Recherche open data immobilier (Bien / Adresse)

Date de rédaction : 2026-09-21. Toutes les URLs ont été testées live (`curl`) depuis le poste le 2026-09-21 entre 20:35 et 20:45 UTC. Les réponses sont reproduites tronquées. Les statuts HTTP exacts sont indiqués quand un service est indisponible.

Objet : construire la fonctionnalité **« Vérifier un bien / une adresse »** par le chaînage
`ADRESSE → coordonnées → parcelle → transactions → DPE → risques → urbanisme → droit Loilà`.

---

## 1. Synthèse (état 2026)

Tout le chaînage est **réalisable sans clé API**, en open data, sous Licence Ouverte (Etalab 2.0) sauf exceptions signalées. Les briques accessibles live aujourd'hui :

| Maillon | Source recommandée 2026 | Statut live | Match |
|---|---|---|---|
| Adresse → coordonnées | **Géoplateforme `data.geopf.fr/geocodage`** | ✅ 200 | CERTAIN |
| Adresse ↔ parcelle | **BAN-PLUS `lien_adresse_parcelle` (WFS Géoplateforme)** | ✅ 200 | CERTAIN |
| Parcelle (géométrie) | **apicarto IGN `/api/cadastre/parcelle`** | ✅ 200 | CERTAIN (au point) |
| Transactions DVF | **`dvf-api.data.gouv.fr`** (nouvelle API) + fichiers `geo-dvf` | ✅ 200 | POSSIBLE/PROBABLE |
| DPE | **ADEME data-fair `dpe03existant`** | ✅ 200 | PROBABLE |
| Risques | **Géorisques `/api/v1/resultats_rapport_risque`** | ⚠️ 200 mais instable | POSSIBLE |
| Urbanisme (PLU) | **apicarto IGN `/api/gpu/zone-urba`** (+ prescriptions/info) | ✅ 200 | CERTAIN (au point) |
| Pont bâtiment (bonus décisif) | **BDNB `api.bdnb.io`** | ✅ 200 | PROBABLE→CERTAIN |

**Constats importants à retenir :**

1. **`api-adresse.data.gouv.fr` est dépréciée.** Les en-têtes HTTP le prouvent (`deprecation`/`sunset` au **31 janv. 2026**, `x-api-new-host: https://data.geopf.fr/geocodage/`). Elle répond encore mais il faut migrer sur `data.geopf.fr/geocodage`.
2. **`api.dvf.etalab.gouv.fr` est morte** : `curl` → `Could not resolve host` (NXDOMAIN). La micro-API communautaire `api.cquest.org/dvf` n'est plus fiable (502). **La nouvelle API officielle est `https://dvf-api.data.gouv.fr`** (retrouvée dans le bundle JS de `explore.data.gouv.fr`), adossée à `datagouv/api-dvf`.
3. **L'API Cerema « données foncières » (`apidf-preprod.cerema.fr`) est HS aujourd'hui** : `HTTP 503` sur `/dvf_opendata/mutations/` et `/docs`. À ne pas utiliser en production tant que non stabilisée (beta + preprod).
4. **Chaînage déterministe possible** : `adresse → id_adr → idu (parcelle)` via BAN-PLUS, et `parcelle → DPE/copro` via `dvf-api/dpe-copro` + BDNB. C'est la clé pour ne pas se contenter d'un match par adresse.
5. **Quick win** : géocodage (Géoplateforme) + parcelle (apicarto) + DVF API + DPE ADEME + risques Géorisques + zonage GPU, le tout caché en SQLite avec `source_id`/`fetched_at`/`match_quality`.

**Blockers / pièges :**
- Géorisques renvoie régulièrement `Connection reset by peer` (HTTP/2) : retries + `--http1.1` obligatoires.
- `latlon` Géorisques = **longitude d'abord, latitude ensuite** (inversé = rapport vide, pas d'erreur).
- Certaines URL de fichiers `geo-dvf` par commune sont absentes (`communes/75107.csv.gz` → 404) : préférer le fichier département ou le fichier unique.
- DVF : une mutation peut regrouper plusieurs parcelles/lots → **impossible d'attribuer systématiquement à un logement précis**.
- DPE **avant juillet 2021** (`dpe-france`) n'a **pas d'adresse BAN** ni de géocodage fin → match quasi impossible.

---

## 2. Détail par source

Légende `MATCH QUALITY` : **CERTAIN** (lien par identifiant stable), **PROBABLE** (identifiant bâtiment/adresse BAN, résidu d'incertitude), **POSSIBLE** (match textuel/communal), **UNKNOWN** (non attribuable).

---

### 2.1 BAN — Base Adresse Nationale et géocodage

- **ORGANISME** : DINUM + IGN (capé ETALAB/ANCT pour les BAL).
- **DATASET/API** :
  - Géocodeur : `https://data.geopf.fr/geocodage/` (successeur) ; ancien `https://api-adresse.data.gouv.fr/` (déprécié).
  - Données : `base-adresse-nationale` sur data.gouv.fr.
- **URL / DOC** : https://adresse.data.gouv.fr/outils/api-doc/adresse ; https://adresse.data.gouv.fr/donnees-nationales
- **LICENCE** : Licence Ouverte Etalab 2.0 (`lov2`). Donnée « base-adresse-nationale » sur data.gouv : `license = lov2`.
- **CONDITIONS** : aucune clé. Doc annonce **50 appels/IP/seconde**. L'ancien hôte renvoie `x-ratelimit-limit-second: 1` (ancien).
- **FRÉQUENCE** : BAN mise à jour **quotidienne** (source : data.gouv, `last_update 2026-09-21`) ; le moteur de géocodage est réindexé **2×/semaine**. Spécification **BAL 1.5** en vigueur depuis mars 2026 ; nouvel identifiant **idban**.
- **IDENTIFIANTS** : `id` = `{code_insee}{code_voie}{numéro}` (ex. `75107_8909_00020`), `banId` (UUID), `idban` (nouveau), `citycode` (INSEE), `x`/`y` (Lambert-93).
- **LIMITES** : score de géocodage < 1 possible ; adresses hors BAN (lieux-dits, résidences) ; arrondissements (Paris/Lyon/Marseille) : `citycode` = code d'arrondissement (75107) alors que `commune` INSEE = 75056.
- **DONNÉES PERSONNELLES** : aucune (l'adresse n'est pas une donnée personnelle en soi ; pas de nom d'occupant).
- **REPUBLICATION/INDEXATION** : autorisée (LO 2.0, mention de la source).
- **VÉRIFIÉ live** :

```bash
curl -sS -G --data-urlencode "q=20 avenue de Ségur" --data-urlencode "limit=1" \
  "https://data.geopf.fr/geocodage/search"
```
Réponse (tronquée) :
```json
{"type":"FeatureCollection","features":[{"geometry":{"type":"Point","coordinates":[2.308628,48.850699]},"properties":{"label":"20 Avenue de Ségur 75007 Paris","score":0.9716,"housenumber":"20","id":"75107_8909_00020","banId":"c575af14-f697-464c-b70b-914cedb239a4","postcode":"75007","citycode":"75107","x":649266.35,"y":6861406.23,"type":"housenumber","depcode":"75","_type":"address"}}]}
```
Preuve de dépréciation de l'ancien hôte :
```bash
curl -sS -D - -o /dev/null "https://api-adresse.data.gouv.fr/search/?q=test&limit=1"
# deprecation: Sat, 31 Jan 2026 22:59:59 GMT
# sunset: Sat, 31 Jan 2026 22:59:59 GMT
# x-api-deprecated: true
# x-api-new-host: https://data.geopf.fr/geocodage/
```
Reverse :
```bash
curl -sS "https://data.geopf.fr/geocodage/reverse?lon=2.3039&lat=48.8506&limit=1"
# properties: {"label":"95 Avenue de Suffren 75007 Paris","id":"75107_9114_00095","banId":"d0e3a8c6-...","citycode":"75107","type":"housenumber","score":0.9921}
```
- **MATCH QUALITY** : adresse → coordonnées = **CERTAIN** (si `type=housenumber` et score élevé) ; sinon `street`/`locality` = POSSIBLE.

---

### 2.2 Cadastre — PCI / Parcellaire Express

- **ORGANISME** : IGN / DGFiP (PCI = Plan Cadastral Informatisé). Diffusion Etalab/IGN.
- **DATASET/API** : `apicarto.ign.fr/api/cadastre`, `cadastre.data.gouv.fr`, WFS Géoplateforme (`BDPARCELLAIRE-VECTEUR_WLD_BDD_WGS84G:parcelle`).
- **URL / DOC** : https://apicarto.ign.fr/api/doc/cadastre ; https://cadastre.data.gouv.fr/datasets (jeu « Cadastre »).
- **LICENCE** : **Licence Ouverte Etalab** — dataset « Cadastre » sur data.gouv : `license = fr-lo`.
- **CONDITIONS** : pas de clé. apicarto et WFS Géoplateforme soumis au rate-limit (WFS : **30 req/s/IP**).
- **FRÉQUENCE** : mise à jour **trimestrielle/continue** ; dataset `last_update 2026-09-16`.
- **IDENTIFIANTS** : `idu` = identifiant de parcelle **14 car.** `{code_insee 5}{préfixe 3}{section 2}{numéro 4}` (ex. `75107000BT0001`) ; champs séparés `code_insee`, `code_dep`, `code_com`, `code_arr`, `prefixe`, `section`, `numero`, `contenance`, `gid`.
- **LIMITES** : l'`idu` peut changer après remaniement (DVF fournit `ancien_id_parcelle`) ; géométrie au point exact ; le cadastre ne dit pas qui/quoi occupe.
- **DONNÉES PERSONNELLES** : aucune (les propriétaires ne sont PAS dans le PCI ouvert).
- **REPUBLICATION/INDEXATION** : autorisée (LO).
- **VÉRIFIÉ live** :

```bash
curl -sS "https://apicarto.ign.fr/api/cadastre/parcelle?geom=%7B%22type%22%3A%22Point%22%2C%22coordinates%22%3A%5B2.3039%2C48.8506%5D%7D"
```
Réponse (propriétés tronquées, géométrie coupée) :
```json
{"features":[{"id":"parcelle.94484729","properties":{"gid":171158,"numero":"0001","section":"BT","code_dep":"75","nom_com":"Paris","code_com":"056","com_abs":"000","code_arr":"107","idu":"75107000BT0001","contenance":50020,"code_insee":"75056"}}],"totalFeatures":1}
```
Géométrie à la commune (bundler) et fichiers GeoJSON :
```bash
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://cadastre.data.gouv.fr/bundler/cadastre-etalab/communes/75107/geojson/parcelles"   # 200
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/communes/75/75107/"      # 200
```
- **MATCH QUALITY** : coordonnées → parcelle = **CERTAIN** (point-in-polygon, l'`idu` identifie la parcelle).

---

### 2.3 DVF — Demandes de Valeurs Foncières

- **ORGANISME** : DGFiP (producteur) ; Etalab/data.gouv (diffusion) ; Cerema/DGALN (DVF+).
- **DATASET/API** :
  - **Nouvelle API officielle : `https://dvf-api.data.gouv.fr`** (repo `datagouv/api-dvf`), utilisée par `explore.data.gouv.fr/immobilier`.
  - Fichiers géolocalisés : `geo-dvf` (data.gouv « Demandes de valeurs foncières géolocalisées »), licence `lov2`.
  - Fichiers DGFiP bruts : « Demandes de valeurs foncières » (`valeursfoncieres-YYYY.txt.zip`, licence `lov2`).
  - **Cerema API données foncières** : `https://apidf-preprod.cerema.fr` — ⚠️ **HTTP 503 aujourd'hui** (beta/preprod).
  - Anciennes APIs **mortes** : `api.dvf.etalab.gouv.fr` (NXDOMAIN), `api.cquest.org/dvf` (instable/502).
- **URL / DOC** : https://www.data.gouv.fr/dataservices/api-donnees-foncieres ; https://github.com/datagouv/api-dvf ; https://github.com/etalab/dvf (README-CSV).
- **LICENCE** : **Licence Ouverte Etalab 2.0** (`lov2`).
- **CONDITIONS** : pas de clé pour `dvf-api`. Pas de rate-limit documenté sur `dvf-api` (attention à l'auto-hébergement).
- **FRÉQUENCE** : **semestrielle** (avril + octobre) ; `geo-dvf` « latest » par année. Dernières livraisons : avril 2026 (données jusqu'à fin 2025 pour DVF+ 2026.1).
- **IDENTIFIANTS — CRITIQUE pour le rattachement à un logement** :
  - `id_mutation` : identifiant de **la mutation** (groupe plusieurs lignes) — **non stable dans le temps**.
  - `numero_disposition` : distingue les dispositions à l'intérieur d'une mutation.
  - `id_parcelle` (14 car.) / `ancien_id_parcelle` : **lien à la parcelle cadastrale** (clé de jointure déterministe).
  - `adresse_numero`, `adresse_suffixe` (B/T/Q), `adresse_code_voie` (FANTOIR), `adresse_nom_voie`, `code_postal`, `code_commune`.
  - `lot1_numero` … `lot5_numero`, `lot1_surface_carrez` … `lot5`, `nombre_lots`, `numero_volume` : **lots de copropriété**.
  - `code_type_local`/`type_local`, `surface_reelle_bati`, `nombre_pieces_principales`, `surface_terrain`, `longitude`, `latitude`, `valeur_fonciere`, `nature_mutation`, `date_mutation`.
- **QUAND UNE TRANSACTION N'EST PAS ATTRIBUABLE À UN LOGEMENT PRÉCIS** :
  1. Si `nombre_lots > 1` ou plusieurs `id_parcelle` dans la même `id_mutation` : la vente porte sur **plusieurs lots/biens** → la valeur foncière est globale, non répartissable. Match = **UNKNOWN** pour un logement.
  2. Si `type_local` vide (mutation de terrain, dépendance, échange) → **UNKNOWN**.
  3. Si l'adresse de la mutation est une voie sans `adresse_numero` exploitable, ou si le géocodage n'est qu'à la parcelle → **POSSIBLE** au mieux.
  4. Un logement précis n'est **attribuable** que si : une seule parcelle, un seul lot (`nombre_lots = 1`), `type_local` = Appartement/Maison, et adresse (n° + voie) correspondant à celle du bien → **PROBABLE** (jamais CERTAIN : la mutation ne nomme pas le lot vendu de façon univoque).
- **DONNÉES PERSONNELLES (RGPD)** : ⚠️ la fiche data.gouv de la DGFiP avertit noir sur blanc : « **Le fichier DVF contient des données à caractère personnel** et la DGFiP attire votre attention sur les obligations légales qui en découlent » + document d'information à l'attention des acquéreurs. **Cependant**, l'en-tête réel du fichier brut vérifié **ne contient AUCUN nom d'acquéreur/vendeur** : seulement `Identifiant/Reference document`, `Articles CGI`, `No disposition`, dates, nature, valeur, adresse, `Prefixe de section`, `Section`, `No plan`, lots, `Code type local`, `Identifiant local`, surfaces. Le risque RGPD est donc un **risque de ré-identification indirecte** (croisement avec cadastre/autres bases) et une obligation d'information des personnes — pas une exposition directe de noms. À traiter côté Loilà : ne pas indexer les couples adresse+date+valeur dans un but de profilage, mention de source, et exclusion du référencement public si profilage.
- **REPUBLICATION/INDEXATION** : autorisée sous LO **sous conditions RGPD** ci-dessus (la DGFiP référence une CGU spécifique).
- **VÉRIFIÉ live** :

```bash
curl -sS "https://dvf-api.data.gouv.fr/commune/75107/sections" | head -c 400
# {"data":[{"c":"75107000AB","n":"75107000AB","p":"75107","l":13,...}, ...]}

curl -sS "https://dvf-api.data.gouv.fr/mutations/75107/000AB" | head -c 600
# {"data":[{"id_mutation":"2025-1309404","date_mutation":"2025-10-10","numero_disposition":1,
#  "nature_mutation":"Vente","valeur_fonciere":105000.0,"adresse_numero":44,"adresse_suffixe":null,
#  "adresse_nom_voie":"RUE DE LILLE","adresse_code_voie":"5686","code_postal":"75007",
#  "code_commune":"75107","nom_commune":"Paris 7e Arrondissement","code_departement":"75",
#  "id_parcelle":"75107000AB0013", ... }]}
```
Autres endpoints vérifiés (200) : `/nation`, `/nation/mois`, `/departement/75`, `/departement/75/communes`, `/commune/75107`, `/section/75107000BT`, `/dpe-copro/{id_parcelle}`, `/epci`, `/distribution/75107`. `GET /dvf?...` → **502**.
Fichiers bruts :
```bash
curl -sSL -o /dev/null -w "%{http_code} %{size_download}\n" \
  "https://files.data.gouv.fr/geo-dvf/latest/csv/2024/departements/75.csv.gz"   # 200 → 302 vers OVH S3, ~1.8 Mo
# communes/75107.csv.gz -> 302 puis 404 "NoSuchKey" (fichier absent)
# https://static.data.gouv.fr/resources/demandes-de-valeurs-foncieres-geolocalisees/20260717-142041/dvf.csv.gz  (fichier unique 499 Mo, 2021-2025)
```
- **MATCH QUALITY** : transaction → bien = **POSSIBLE** en général, **PROBABLE** si lot unique + parcelle unique + adresse n° exacte, **UNKNOWN** si multi-lots/terrains.

---

### 2.4 DPE — ADEME

- **ORGANISME** : ADEME (collecte depuis 2013 ; réforme 1er juillet 2021).
- **DATASET/API** : `dpe03existant` (logements existants depuis 07/2021), `dpe03neuf`, `dpe-france` (avant 07/2021), `j9ol0fw...` (tertiaire). Base API : `https://data.ademe.fr/data-fair/api/v1/datasets/<id>`.
- **URL / DOC** : https://data.ademe.fr/datasets/dpe03existant ; https://www.data.gouv.fr/dataservices/api-dpe-logements
- **LICENCE** : **Licence Ouverte / Open Licence 2.0** (renvoyée par l'API : `license.title = "Licence Ouverte / Open Licence version 2.0"`).
- **CONDITIONS** : pas de clé. API data-fair paginée (`size`, `after`, `q`, `select`, `q_fields`). Attention : `q=` fait une **recherche plein-texte**, pas un filtre exact.
- **FRÉQUENCE** : continue ; `updatedAt = 2026-06-30`, **15 604 436 enregistrements** (dpe03existant).
- **IDENTIFIANTS** : `numero_dpe` (ex. `2675E0864501D`), `identifiant_ban` (id BAN déterministe, ex. `75107_8909_00061`), `adresse_ban`, `code_insee_ban`, `code_postal_ban`, `numero_voie_ban`, `score_ban`, `statut_geocodage`, `complement_adresse_batiment`, `complement_adresse_logement`, `numero_etage_appartement`, `_geopoint` (lat,lon), `type_batiment`, `surface_habitable_logement`, `etiquette_dpe`, `etiquette_ges`, `date_etablissement_dpe`, `date_fin_validite_dpe`, `version_dpe`, `methode_application_dpe`, `_id`.
- **LIMITES** :
  - `score_ban` peut être < 1 (adresse imprécise ou niveau voie) ; plusieurs DPE par bâtiment ; `complement_adresse_logement` renseigné de façon hétérogène (ex. « 1er étage - Chambre 7 »).
  - **`dpe-france` (avant 07/2021) n'a ni `adresse_ban` ni BAN** : uniquement `code_insee_commune_actualise`, `tv016_departement_code`, `geo_score` → **match quasi impossible**.
- **DONNÉES PERSONNELLES** : non (le DPE est un diagnostic du bien ; pas de nom d'occupant dans l'open data).
- **REPUBLICATION/INDEXATION** : autorisée (LO 2.0).
- **VÉRIFIÉ live** :

```bash
curl -sS -G --data-urlencode "size=1" --data-urlencode "q=20 avenue de Ségur 75007" \
  "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines"
```
Réponse (champs clés) :
```json
{"total":23600,"results":[{"numero_dpe":"2675E0864501D","identifiant_ban":"75107_8909_00061",
"adresse_ban":"61 Avenue de Ségur 75007 Paris","code_insee_ban":"75107","score_ban":0.69,
"statut_geocodage":"adresse géocodée ban à l'adresse","complement_adresse_batiment":"9271",
"complement_adresse_logement":"1er étage - Chambre 7","numero_etage_appartement":0,
"type_batiment":"appartement","surface_habitable_logement":11,"etiquette_dpe":"D","etiquette_ges":"D",
"date_etablissement_dpe":"2026-03-27","_geopoint":"48.84886201351127,2.3074769864369857"}]}
```
> NB : la requête `q=` a renvoyé « 61 Avenue de Ségur » (score_ban 0.69) alors qu'on cherchait le n°20 : **preuve que `q=` est un plein-texte flou**. Pour un match fiable, filtrer sur `identifiant_ban`/`adresse_ban`/`code_insee_ban`+`numero_voie_ban`.
- **MATCH QUALITY** : DPE → logement = **PROBABLE** (via `identifiant_ban`) ; si `statut_geocodage` = voie/commune ou `complement_adresse_logement` absent → **POSSIBLE** ; avant 2021 = **UNKNOWN**.

---

### 2.5 Géoplateforme / IGN (WFS/WMTS/géocodage)

- **ORGANISME** : IGN.
- **DATASET/API** : `https://data.geopf.fr/wfs/ows` (WFS 2.0.0), `https://data.geopf.fr/wmts` (WMTS), `https://data.geopf.fr/geocodage` (BAN).
- **URL / DOC** : https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/diffusion/
- **LICENCE** : données open data Géoplateforme **sous Licence Ouverte** ; exception : SCAN 25/100/OACI sous licence payante spécifique (document `data.geopf.fr/annexes/ressources/documentation/conditions-de-licence.pdf`).
- **CONDITIONS** : WFS limité à **5000 objets/requête**, **30 req/s/IP** (depuis févr. 2025). Pas de clé pour l'open data.
- **FRÉQUENCE** : variable selon la base (BD TOPO ~ trimestrielle, BAN 2×/sem., cadastre PCI continu).
- **IDENTIFIANTS / couches utiles** (vérifiées dans les capabilities) :
  - `BAN-PLUS:adresse`, **`BAN-PLUS:lien_adresse_parcelle`** (champs `id_adr`, `idu`, `type_lien`, `nb_adr`, `nb_parc`), `BAN-PLUS:lien_adresse_bati`, `BAN-PLUS:lien_bati_parcelle`.
  - `BDPARCELLAIRE-VECTEUR_WLD_BDD_WGS84G:parcelle`.
  - `BDTOPO_V3:batiment`, `BDTOPO_V3:adresse_ban`.
- **LIMITES** : WFS lourd pour un usage page-par-page ; préférer apicarto (parcelle) + BAN-PLUS en ingestion batch.
- **DONNÉES PERSONNELLES** : non.
- **REPUBLICATION/INDEXATION** : autorisée (LO) pour les couches open data.
- **VÉRIFIÉ live** :

```bash
curl -sS "https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&typeNames=BAN-PLUS:lien_adresse_parcelle&count=2&outputFormat=application/json"
```
Réponse (propriétés) :
```json
{"features":[{"id":"lien_adresse_parcelle.1","properties":{"id_adr":"01093_0118_00012_b",
"idu":"010930000C3927","type_lien":"BAN","nb_adr":9,"nb_parc":79}}, ...],"totalFeatures":28493961}
```
- **MATCH QUALITY** : `id_adr ↔ idu` = **CERTAIN** (c'est LA jointure déterministe adresse↔parcelle).

---

### 2.6 GPU — Géoportail de l'urbanisme (PLU, prescriptions, servitudes)

- **ORGANISME** : IGN / MTE (GPU). API exposée par apicarto IGN.
- **DATASET/API** : `https://apicarto.ign.fr/api/gpu/` ; portail `geoportail-urbanisme.gouv.fr`.
- **URL / DOC** : https://apicarto.ign.fr/api/doc/gpu ; https://www.geoportail-urbanisme.gouv.fr/
- **LICENCE** : données d'urbanisme diffusées en open data (Licence Ouverte). ⚠️ **Nuance vérifiée** : les fiches data.gouv « DONNEES : Géoportail de l'Urbanisme - … » déclarent `license = notspecified`. À confirmer contractuellement avant réutilisation commerciale (le portail a des CGU dédiées `/cgu/`).
- **CONDITIONS** : pas de clé ; rate-limit Géoplateforme applicable.
- **FRÉQUENCE** : à chaque évolution des documents d'urbanisme ; champ `gpu_timestamp` (ex. `2026-06-23`), `datvalid` (date de validité du zonage).
- **IDENTIFIANTS** : `gpu_doc_id`, `partition` (ex. `DU_75056`), `du_type` (PLU, PLUi, POS, CC…), `idurba`, `libelle` (ex. `UG`), `libelong` (ex. « Zone urbaine générale »), `typezone` (U/AU/A/N…), `datappro`, `datvalid`, `nomfic`/`urlfic` (règlement PDF), `insee`.
- **ENDPOINTS VÉRIFIÉS (200)** : `zone-urba`, `prescription-surf`, `prescription-lin`, `prescription-pct`, `info-surf`, `info-lin`, `info-pct`, `document`. **Servitudes d'utilité publique : non exposées** — `servitude-*` renvoient **404** (à traiter via d'autres canaux : SUP non intégrées dans ces endpoints).
- **LIMITES** : couverture dépendante des communes ayant numérisé leur PLU (GPU non exhaustif) ; les servitudes d'utilité publique ne sont pas accessibles via ces endpoints.
- **DONNÉES PERSONNELLES** : non.
- **REPUBLICATION/INDEXATION** : open data (à confirmer licence « notspecified » des fiches data.gouv).
- **VÉRIFIÉ live** :

```bash
curl -sS "https://apicarto.ign.fr/api/gpu/zone-urba?geom=%7B%22type%22%3A%22Point%22%2C%22coordinates%22%3A%5B2.3039%2C48.8506%5D%7D"
```
Réponse (propriétés) :
```json
{"id":"zone_urba.4497504","properties":{"gpu_doc_id":"ab895285a1be6ca045127a6bb628cfaa",
"gpu_status":"production","gpu_timestamp":"2026-06-23T07:33:55.310Z","partition":"DU_75056",
"libelle":"UG","libelong":"Zone urbaine générale","typezone":"U","nomfic":"75056_reglement_20260616.pdf",
"datvalid":"20260616","idurba":"75056_PLU_20260616"},"totalFeatures":1}
```
`document` :
```json
{"gid":26481,"grid_title":"PARIS","name":"75056_PLU_20260616","gpu_doc_id":"ab895285...","partition":"DU_75056","du_type":"PLU","gpu_status":"production"}
```
- **MATCH QUALITY** : coordonnées → zonage = **CERTAIN** (point-in-polygon au document en vigueur).

---

### 2.7 Géorisques — risques naturels & technologiques

- **ORGANISME** : MTE / BRGM (back-end `api-georisques.bike-prod.brgm.fr`).
- **DATASET/API** : `https://georisques.gouv.fr/api/v1/` (V2 publiée 2025).
- **URL / DOC** : https://www.georisques.gouv.fr/doc-api ; https://www.data.gouv.fr/dataservices/api-georisques
- **LICENCE** : open data (licence non renseignée dans la fiche data.gouv — `license = null`) ; de fait en Licence Ouverte Etalab. À confirmer.
- **CONDITIONS** : pas de clé pour la V1 publique. Rate : **1 req/s** sur `resultats_rapport_risque` et `rapport_pdf`, **5 req/s** sur le reste `/api/v1/**`, plafond global **1000 req/min/IP** (V2, 19/06/2025). Une clé `X-API-Key` existe pour des quotas supérieurs.
- **FRÉQUENCE** : variable par couche (catnat à chaque arrêté publié ; PPR/PPRi à chaque révision).
- **IDENTIFIANTS** : entrée par `code_insee`, `latlon=lon,lat`, ou parcelle ; sortie : `adresse{libelle,longitude,latitude}`, `commune{codeInsee,codePostal}`, `risquesNaturels{inondation, remonteeNappe, seisme, mouvementTerrain, retraitGonflementArgile, radon, …}`, `risquesTechnologiques{icpe, nucleaire, canalisationsMatieresDangereuses, pollutionSols, ruptureBarrage, risqueMinier}`, `url` (rapport web).
- **ENDPOINTS VÉRIFIÉS** : `resultats_rapport_risque?latlon=lon,lat` = **200** (après retries) ; `gaspar/risques?code_insee=`, `gaspar/azi`, `gaspar/dicrim`, `gaspar/tim`, `gaspar/tri`, `gaspar/catnat` = 200 ; `gaspar/pcs|sis|ppr|icpe|radon|ssp|olde` = **404** ; `argiles`/`rga` = **404/500** ; `api/v2/...` = **404**.
- **LIMITES / PIÈGES VÉRIFIÉS** :
  - **`latlon` = LONGITUDE d'abord** (`latlon=2.3039,48.8506`). L'inverser renvoie un rapport vide **sans erreur**.
  - **Instabilité** : `curl: (56) Recv failure` / `HTTP/2 INTERNAL_ERROR` fréquents → **retries + `--http1.1`** nécessaires.
  - `resultats_rapport_risque` peut retomber à l'échelle **commune** si l'adresse ne se géocode pas (le `adresse.libelle` est alors absent/renvoyé à la commune) → perte de granularité.
  - Les degrés (« Modéré/Faible/Important ») affichés sur le site **ne sont pas** tous exposés par l'API (retours d'usagers documentés).
- **DONNÉES PERSONNELLES** : aucune (risques sur un lieu).
- **REPUBLICATION/INDEXATION** : autorisée (open data).
- **VÉRIFIÉ live** :

```bash
curl -sS --http1.1 -H "Accept: application/json" \
  "https://georisques.gouv.fr/api/v1/resultats_rapport_risque?latlon=2.3039,48.8506"
```
Réponse (tronquée) :
```json
{"adresse":{"libelle":"95 Avenue de Suffren, 75007 Paris","longitude":2.303124,"latitude":48.850105},
"commune":{"libelle":"Paris","codePostal":"75007","codeInsee":"75056"},
"risquesNaturels":{"inondation":{"present":true,"libelleStatutCommune":"Risque Existant","libelleStatutAdresse":"Risque non Connu"},
"remonteeNappe":{"present":true,"libelleStatutAdresse":"Risque Existant"}, ...}}
```
Catastrophes naturelles :
```bash
curl -sS --http1.1 "https://georisques.gouv.fr/api/v1/gaspar/catnat?code_insee=75056&page_size=1"
# {"results":20,"data":[{"code_national_catnat":"INTE0100460A","date_debut_evt":"06/07/2001",
#  "libelle_risque_jo":"Inondations et/ou Coulées de Boue","code_insee":"75056"}]}
```
- **MATCH QUALITY** : risques → bien = **POSSIBLE** (adresse si géocodage OK, sinon commune) ; `libelleStatutAdresse` distingue explicitement « Risque non Connu » à l'adresse.

---

### 2.8 Autres datasets utiles (vérifiés)

| Source | API/URL (vérifiée) | Licence | Identifiants clés | Match |
|---|---|---|---|---|
| **BDNB** (CSTB) | `https://api.bdnb.io/v1/bdnb/donnees/batiment_groupe_complet` (PostgREST) — 200 | `lov2` (dataset data.gouv) | `batiment_groupe_id`, `cle_interop_adr_principale_ban`, `l_parcelle_id`, `identifiant_dpe`, `code_commune_insee`, `classe_bilan_dpe`, `annee_construction`, `alea_argile`, `geom_groupe`, `fiabilite_cr_adr_niv_1/2`, `nb_logements` | **PROBABLE→CERTAIN** : c'est le meilleur pivot bâtiment (adresse BAN ↔ parcelle ↔ DPE) |
| **RNB** (Référentiel National des Bâtiments) | `https://rnb-api.beta.gouv.fr/api/alpha/buildings/closest/?point=lon,lat&radius=...` — 200 (`radius` obligatoire ; l'ancien `?lon=&lat=` renvoie 400) | Licence Ouverte | `rnb_id`, empreintes bâtiment | CERTAIN (bâtiment) |
| **Recherche d'entreprises / RNA** | `https://recherche-entreprises.api.gouv.fr/search?q=...` — 200 (remplace `entreprise.data.gouv.fr/api/rna` qui échoue) | LO 2.0 | SIREN, associations | n/a immobilier (utile syndic/gestionnaire) |
| **Zonage ABC** (ANAH) | fichiers data.gouv « Zonages logement ABC et zonages I-II-III » — `lov2` ; ⚠️ pas d'API live (`apidf.anah.fr`, `apiv2.apicra.anah.gouv.fr` = NXDOMAIN) | `lov2` | `code_insee`, zone A/Abis/B1/B2/C | CERTAIN (par commune) |
| **Catastrophes naturelles (arrêtés)** | `georisques /api/v1/gaspar/catnat` — 200 | open data | `code_national_catnat`, dates, `libelle_risque_jo` | CERTAIN (commune) |
| **OCSGE / artificialisation** | `data.geopf.fr/wfs` (capabilities 200) | LO | usage du sol | CERTAIN (au point) |
| **SITADEL** (permis de construire) | dataset data.gouv `sitadel-logements` | LO | permis, logements | commune/adresse |
| **DV3F / Fichiers fonciers** (Cerema) | `apidf-preprod.cerema.fr` (503) — **accès restreint** (public habilité) | restreinte | propriétaires, locaux | à écarter (non open) |

> Note BDNB : l'appel `batiment_groupe_complet?code_departement=eq.75` **échoue** (`column ... does not exist`) ; le bon nom de colonne est **`code_departement_insee`**. En-têtes de quota observés : `x-quota-limit: 10000`, `x-max-items-per-call: 10`.
> Note BRGM/DRIEAT : BRGM alimente Géorisques (pas d'API open directe nécessaire) ; DRIEAT = données régionales Île-de-France, à traiter en complément local, non vérifiées ici.

---

## 3. Modèle de données SQLite proposé

Principe : chaque entité externe est **cachée** avec sa **provenance** (`source_id`), sa **fraîcheur** (`fetched_at`) et un **`match_quality`** normalisé. On ne requête jamais les APIs en live sur le rendu de page. SQLite = un seul écrivain → ingestion en batch (job séparé du rendu).

```sql
-- Catalogue des sources : une ligne par API/jeu de données
CREATE TABLE data_source (
  id                INTEGER PRIMARY KEY,
  code              TEXT NOT NULL UNIQUE,        -- 'ban_geopf', 'apicarto_cadastre', 'dvf_api', 'ademe_dpe', 'georisques', 'gpu_ign', 'bdnb'...
  organisme         TEXT NOT NULL,
  dataset           TEXT,
  api_url           TEXT,
  doc_url           TEXT,
  licence           TEXT,                         -- 'lov2', 'fr-lo', 'notspecified', ...
  update_frequency  TEXT,                         -- 'daily','semester','continuous',...
  rgpd_notes        TEXT,
  last_fetched_at   TEXT,                         -- ISO8601, fraîcheur globale
  last_ok_at        TEXT,
  notes             TEXT
);

-- Adresse (BAN)
CREATE TABLE address (
  id                INTEGER PRIMARY KEY,
  ban_id            TEXT,                         -- '75107_8909_00020'
  idban             TEXT,                         -- UUID BAN (nouveau)
  label             TEXT NOT NULL,
  housenumber       TEXT,
  street            TEXT,
  postcode          TEXT,
  insee_code        TEXT NOT NULL,                -- citycode BAN (arrondissement possible)
  insee_commune     TEXT,                         -- commune INSEE réelle
  city              TEXT,
  lon               REAL NOT NULL,
  lat               REAL NOT NULL,
  lambert_x         REAL,
  lambert_y         REAL,
  geocode_score     REAL,
  geocode_type      TEXT,                         -- housenumber|street|locality|municipality
  match_quality     TEXT NOT NULL DEFAULT 'UNKNOWN' REFERENCES ... , -- CERTAIN si housenumber
  source_id         INTEGER NOT NULL REFERENCES data_source(id),
  fetched_at        TEXT NOT NULL,
  UNIQUE (ban_id)
);

-- Parcelle cadastrale
CREATE TABLE parcel (
  id                INTEGER PRIMARY KEY,
  idu               TEXT NOT NULL,                -- 14 car.
  insee_code        TEXT NOT NULL,
  prefixe           TEXT,
  section           TEXT,
  numero            TEXT,
  contenance_m2     INTEGER,
  geometry_geojson  TEXT,                         -- MultiPolygon
  match_quality     TEXT NOT NULL DEFAULT 'CERTAIN',
  source_id         INTEGER NOT NULL REFERENCES data_source(id),
  fetched_at        TEXT NOT NULL,
  UNIQUE (idu)
);

-- Jointure déterministe adresse <-> parcelle (BAN-PLUS / BDNB)
CREATE TABLE address_parcel (
  address_id        INTEGER NOT NULL REFERENCES address(id),
  parcel_id         INTEGER NOT NULL REFERENCES parcel(id),
  id_adr            TEXT,
  type_lien         TEXT,                          -- 'BAN' | 'GEO'
  nb_adr            INTEGER,
  nb_parc           INTEGER,
  match_quality     TEXT NOT NULL DEFAULT 'CERTAIN',
  source_id         INTEGER NOT NULL REFERENCES data_source(id),
  fetched_at        TEXT NOT NULL,
  PRIMARY KEY (address_id, parcel_id)
);

-- Transaction DVF (une ligne = une disposition/lot de mutation)
CREATE TABLE transaction (
  id                    INTEGER PRIMARY KEY,
  id_mutation           TEXT NOT NULL,             -- NON stable
  date_mutation         TEXT,
  numero_disposition    INTEGER,
  nature_mutation       TEXT,
  valeur_fonciere       REAL,
  adresse_numero        TEXT,
  adresse_suffixe       TEXT,
  adresse_nom_voie      TEXT,
  adresse_code_voie     TEXT,                      -- FANTOIR
  code_postal           TEXT,
  insee_code            TEXT,
  nom_commune           TEXT,
  id_parcelle           TEXT,                      -- lien parcelle
  ancien_id_parcelle    TEXT,
  nombre_lots           INTEGER,
  lot_numero            TEXT,                      -- lot concerné par cette ligne
  lot_surface_carrez    REAL,
  code_type_local       TEXT,
  type_local            TEXT,                      -- Appartement|Maison|...
  surface_reelle_bati   REAL,
  nombre_pieces         INTEGER,
  surface_terrain       REAL,
  lon                   REAL,
  lat                   REAL,
  -- Attribuabilité à un logement précis :
  is_dwelling_attributable INTEGER NOT NULL DEFAULT 0, -- 1 si parcelle unique & lot unique & type_local résidentiel
  match_quality         TEXT NOT NULL DEFAULT 'UNKNOWN', -- POSSIBLE|PROBABLE|UNKNOWN
  source_id             INTEGER NOT NULL REFERENCES data_source(id),
  fetched_at            TEXT NOT NULL,
  UNIQUE (id_mutation, numero_disposition, id_parcelle, lot_numero)
);

-- DPE
CREATE TABLE dpe (
  id                        INTEGER PRIMARY KEY,
  numero_dpe                TEXT NOT NULL UNIQUE,
  identifiant_ban           TEXT,                  -- lien adresse BAN
  adresse_ban               TEXT,
  insee_code_ban            TEXT,
  score_ban                 REAL,
  statut_geocodage          TEXT,
  complement_adresse_batiment TEXT,
  complement_adresse_logement TEXT,
  numero_etage_appartement  INTEGER,
  type_batiment             TEXT,
  surface_habitable_logement REAL,
  etiquette_dpe             TEXT,                  -- A..G
  etiquette_ges             TEXT,                  -- A..G
  date_etablissement_dpe    TEXT,
  date_fin_validite_dpe     TEXT,
  version_dpe               TEXT,
  lon                       REAL,
  lat                       REAL,
  match_quality             TEXT NOT NULL DEFAULT 'PROBABLE', -- CERTAIN pour numero_dpe; PROBABLE via identifiant_ban; UNKNOWN avant 2021
  source_id                 INTEGER NOT NULL REFERENCES data_source(id),
  fetched_at                TEXT NOT NULL
);

-- Risque (une ligne par type de risque, à un périmètre donné)
CREATE TABLE risk (
  id                        INTEGER PRIMARY KEY,
  scope                     TEXT NOT NULL,         -- 'address'|'parcel'|'commune'
  scope_ref                 TEXT NOT NULL,         -- ban_id | idu | insee_code
  risk_code                 TEXT NOT NULL,          -- 'inondation','remonteeNappe','icpe',...
  risk_family               TEXT NOT NULL,          -- 'naturel'|'technologique'|'catnat'
  present                   INTEGER,
  libelle                   TEXT,
  libelle_statut_commune    TEXT,
  libelle_statut_adresse    TEXT,
  specifique                TEXT,
  match_quality             TEXT NOT NULL DEFAULT 'POSSIBLE',
  source_id                 INTEGER NOT NULL REFERENCES data_source(id),
  fetched_at                TEXT NOT NULL,
  UNIQUE (scope, scope_ref, risk_code)
);

-- Zonage d'urbanisme GPU
CREATE TABLE urban_planning_zone (
  id                INTEGER PRIMARY KEY,
  gpu_doc_id        TEXT,
  partition         TEXT,                          -- 'DU_75056'
  du_type           TEXT,                          -- PLU|PLUi|POS|CC...
  idurba            TEXT,
  typezone          TEXT,                          -- U|AU|A|N
  libelle           TEXT,                          -- 'UG'
  libelong          TEXT,
  datappro          TEXT,
  datvalid          TEXT,
  nomfic            TEXT,                          -- règlement PDF
  urlfic            TEXT,
  insee_code        TEXT,
  match_quality     TEXT NOT NULL DEFAULT 'CERTAIN', -- point-in-polygon
  source_id         INTEGER NOT NULL REFERENCES data_source(id),
  fetched_at        TEXT NOT NULL
);

-- Lien générique entité <-> zone (au point) et index de recherche adresse
CREATE INDEX idx_address_ban ON address(ban_id);
CREATE INDEX idx_parcel_idu ON parcel(idu);
CREATE INDEX idx_tx_parcelle ON transaction(id_parcelle);
CREATE INDEX idx_tx_insee_date ON transaction(insee_code, date_mutation);
CREATE INDEX idx_dpe_identifiant_ban ON dpe(identifiant_ban);
CREATE INDEX idx_risk_scope ON risk(scope, scope_ref);
```

**`match_quality` (enum applicatif)** : `CERTAIN` > `PROBABLE` > `POSSIBLE` > `UNKNOWN`. Règle : ne jamais afficher une information « au logement » sur un match `POSSIBLE`/`UNKNOWN` sans le libeller explicitement (« correspondance par adresse, non certifiée »).

**Fraîcheur** : un job d'ingestion met à jour `fetched_at` ; un TTL par source (ex. adresse 7 j, parcelle 90 j, DVF 180 j, DPE 30 j, risques 90 j, PLU 30 j) décide du re-fetch.

---

## 4. Endpoints exacts (récapitulatif vérifié)

| Fonction | Méthode | URL | Statut |
|---|---|---|---|
| Géocodage | GET | `https://data.geopf.fr/geocodage/search?q=...&limit=1` | 200 |
| Géocodage inverse | GET | `https://data.geopf.fr/geocodage/reverse?lon=&lat=` | 200 |
| Parcelle au point | GET | `https://apicarto.ign.fr/api/cadastre/parcelle?geom={Point}` | 200 |
| Parcelles commune | GET | `https://cadastre.data.gouv.fr/bundler/cadastre-etalab/communes/{insee}/geojson/parcelles` | 200 |
| Adresse↔parcelle | GET | `https://data.geopf.fr/wfs/ows?...typeNames=BAN-PLUS:lien_adresse_parcelle` | 200 |
| DVF stats commune | GET | `https://dvf-api.data.gouv.fr/commune/{insee}` | 200 |
| DVF sections commune | GET | `https://dvf-api.data.gouv.fr/commune/{insee}/sections` | 200 |
| DVF mutations | GET | `https://dvf-api.data.gouv.fr/mutations/{insee}/{prefixe}{section}` (ex. `/mutations/75107/000AB`) | 200 |
| DVF DPE+copro parcelle | GET | `https://dvf-api.data.gouv.fr/dpe-copro/{id_parcelle}` | 200 |
| DVF fichiers | GET | `https://files.data.gouv.fr/geo-dvf/latest/csv/{YYYY}/departements/{DD}.csv.gz` | 200 (302→S3) |
| DPE (post-2021) | GET | `https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines?size=&q=` | 200 |
| DPE (pré-2021) | GET | `https://data.ademe.fr/data-fair/api/v1/datasets/dpe-france/lines` | 200 |
| Risques adresse | GET | `https://georisques.gouv.fr/api/v1/resultats_rapport_risque?latlon=lon,lat` | 200 (instable) |
| Risques commune | GET | `https://georisques.gouv.fr/api/v1/gaspar/risques?code_insee=` | 200 |
| Cat-Nat | GET | `https://georisques.gouv.fr/api/v1/gaspar/catnat?code_insee=` | 200 |
| Zonage PLU | GET | `https://apicarto.ign.fr/api/gpu/zone-urba?geom={Point}` | 200 |
| Prescriptions PLU | GET | `https://apicarto.ign.fr/api/gpu/prescription-surf|lin|pct?geom={Point}` | 200 |
| Infos PLU | GET | `https://apicarto.ign.fr/api/gpu/info-surf|lin|pct?geom={Point}` | 200 |
| Document PLU | GET | `https://apicarto.ign.fr/api/gpu/document?geom={Point}` | 200 |
| BDNB bâtiment | GET | `https://api.bdnb.io/v1/bdnb/donnees/batiment_groupe_complet?limit=10` | 200 |
| RNB bâtiment | GET | `https://rnb-api.beta.gouv.fr/api/alpha/buildings/closest/?point=lon,lat&radius=50` | 200 |

**Indisponibles / morts (statut exact vérifié le 2026-09-21)** :
- `api.dvf.etalab.gouv.fr` → **NXDOMAIN** (`Could not resolve host`).
- `apidf-preprod.cerema.fr/dvf_opendata/mutations/` et `/docs` → **HTTP 503** (Service Unavailable).
- `apidf.cerema.fr` → **NXDOMAIN**.
- `georisques.gouv.fr/api/v2/...` → **HTTP 404** ; `gaspar/pcs|sis|ppr|icpe` → **404** ; `argiles` → **404**, `rga` → **500**.
- `apiv2.apicra.anah.gouv.fr` / `apidf.anah.fr` → **NXDOMAIN**.
- `apicarto.ign.fr/api/gpu/servitude-*` → **HTTP 404** (servitudes non exposées par ces endpoints).
- `api.bdnb.io/...?code_departement=eq.75` → **HTTP 400** (colonne inexistante ; utiliser `code_departement_insee`).
- `files.data.gouv.fr/geo-dvf/latest/csv/2024/communes/75107.csv.gz` → **302 puis 404 NoSuchKey**.

---

## 5. Fiabilité : déterministe vs matché par adresse

**Rattachement DÉTERMINISTE (identifiants stables) :**
- Adresse → coordonnées : BAN (`ban_id`/`idban`).
- Coordonnées → parcelle : `idu` par point-in-polygon (apicarto cadastre).
- Adresse (`id_adr`) ↔ parcelle (`idu`) : BAN-PLUS `lien_adresse_parcelle`.
- Parcelle → DPE/copro : `dvf-api /dpe-copro/{id_parcelle}` + BDNB (`l_parcelle_id`, `identifiant_dpe`).
- Coordonnées → zonage PLU : point-in-polygon GPU.
- Coordonnées/commune → risques : Géorisques.

**Rattachement par ADRESSE uniquement (non certain) :**
- DVF → logement : `id_parcelle` est fiable, mais l'attribution à **un logement** ne l'est pas si multi-lots/multi-parcelles ou l'adresse est imprécise.
- DPE → logement : via `identifiant_ban` (bâtiment) ; l'appartement précis n'est pas garanti (`complement_adresse_logement` libre, `score_ban` < 1).
- Risques → bien : dépend du géocodage ; bascule silencieuse à l'échelle commune.
- DPE **pré-2021** : pas d'adresse BAN → non attribuable.

**Règle de restitution Loilà** : stocker et afficher la `match_quality`. Un match `POSSIBLE` ne doit jamais être présenté comme une preuve (ex. « vente au prix X pour ce logement ») mais comme un indice (« vente(s) à cette adresse/parcelle »).

---

## 6. Risques

1. **Licences** : BAN, cadastre, DVF, DPE, Géoplateforme = Licence Ouverte 2.0 (réutilisation OK avec mention). **GPU : fiches data.gouv `notspecified`** → à sécuriser juridiquement. Géorisques : licence non déclarée sur la fiche → open data de fait, à confirmer.
2. **RGPD / DVF** : la DGFiP qualifie le fichier de « données à caractère personnel » (ré-identification indirecte), mais **aucun nom** n'est présent (vérifié dans l'en-tête brut). Prévoir information sur la source, pas de profilage nominatif, prudence sur l'indexation publique des historiques de vente.
3. **Rate-limits / stabilité** : Géorisques instable (retries obligatoires) et plafonné (1–5 req/s, 1000/min/IP) ; Géoplateforme 30 req/s WFS et 50 req/s géocodage ; BDNB quota 10 000 et max 10 items/appel. **D'où le cache SQLite obligatoire** : ne jamais appeler en live au rendu.
4. **Qualité / couverture** : GPU non exhaustif (communes sans PLU numérisé) ; DVF semestriel avec retard d'enregistrement ; absence DVF en Alsace-Moselle (57/67/68) et Mayotte ; `idu` pouvant changer ; géocodage adresse imparfait.
5. **Dépendances fragiles** : `apidf-preprod.cerema.fr` en 503 aujourd'hui = ne pas en dépendre ; `dvf-api.data.gouv.fr` est une API data.gouv (pas de SLA contractuel affiché) ; l'écosystème bouge vite (api-adresse décommissionnée en janv. 2026).
6. **Qualité des données** : valeurs foncières globales non répartissables ; DPE géocodés au bâtiment ; risques potentiellement communaux.

---

## 7. Plan d'implémentation

### 7.1 Quick win (MVP, 1–2 semaines)

Chaînage minimal, tout en cache SQLite, aucune clé :
1. **Ingestion géocodage** : adresse → `address` (Géoplateforme `data.geopf.fr/geocodage`).
2. **Parcelle** : `address` → `parcel` via apicarto cadastre au point (ou BAN-PLUS en batch).
3. **DVF** : par `insee_code` + `id_parcelle` via `dvf-api.data.gouv.fr/mutations/{insee}/{prefixe}{section}` ; flag `is_dwelling_attributable` ; afficher « ventes à cette parcelle/adresse ».
4. **DPE** : ADEME `dpe03existant`, filtré sur `identifiant_ban`/`adresse_ban`.
5. **Risques** : Géorisques `resultats_rapport_risque` (lon,lat) avec retries.
6. **Urbanisme** : apicarto GPU `zone-urba` + `document` (+ prescriptions/info).
7. **UI** : 4 cartes (Parcelle, Ventes, DPE, Risques/PLU), chacune avec badge **source + date de fraîcheur + niveau de confiance** ; lien vers le droit Loilà (articles 101k) par thématique (copropriété, diagnostics, urbanisme, risques).
8. **Infra** : jobs d'ingestion hors requête, `data_source`/`fetched_at`/`match_quality`, TTL par source.

### 7.2 Version complète

- **Pivot BDNB** (ingestion batch national par département) pour lier **bâtiment ↔ adresse BAN ↔ parcelle ↔ DPE** de façon robuste (`batiment_groupe_id`, `l_parcelle_id`, `identifiant_dpe`, `fiabilite_cr_adr_niv_*`).
- **BAN-PLUS** (WFS) ingéré en batch pour le graphe adresse/parcelle/bâtiment déterministe.
- **DVF** : chargement complet (fichiers `geo-dvf` départementaux ou fichier unique 2021-2025) + historique DGFiP pour l'ancienneté ; calcul de comparables (prix médian au m² par rue/IRIS) — attention RGPD.
- **DPE pré-2021 (`dpe-france`)** : ingestion séparée, marquée `match_quality=UNKNOWN`, restituée « à la commune » uniquement.
- **Risques** : ingestion de toutes les couches Géorisques pertinentes (`azi`, `dicrim`, `tim`, `tri`, `catnat`) + `argiles` via une source alternative (BDNB `alea_argile`) tant que le endpoint Géorisques est cassé.
- **Urbanisme** : stocker zonage + prescriptions + info ; ajouter les **servitudes d'utilité publique** par une autre voie (non exposées par apicarto).
- **Autres** : zonage ABC (fichiers), RNB, OCSGE/artificialisation, SITADEL.
- **Qualité** : tableau de bord de fraîcheur, tests de non-régression des endpoints, repli automatique (fallback) si une source tombe (ex. Cerema 503), et journalisation des `match_quality` par réponse.

---

## Annexe — Commandes de vérification reproductibles

```bash
# BAN (successeur)
curl -sS -G --data-urlencode "q=20 avenue de Ségur" --data-urlencode "limit=1" "https://data.geopf.fr/geocodage/search"
# Dépréciation ancien hôte
curl -sS -D - -o /dev/null "https://api-adresse.data.gouv.fr/search/?q=test&limit=1"
# Cadastre
curl -sS "https://apicarto.ign.fr/api/cadastre/parcelle?geom=%7B%22type%22%3A%22Point%22%2C%22coordinates%22%3A%5B2.3039%2C48.8506%5D%7D"
# DVF (nouvelle API officielle)
curl -sS "https://dvf-api.data.gouv.fr/commune/75107/sections"
curl -sS "https://dvf-api.data.gouv.fr/mutations/75107/000AB"
# DVF fichiers bruts
curl -sSL -o /dev/null -w "%{http_code}\n" "https://files.data.gouv.fr/geo-dvf/latest/csv/2024/departements/75.csv.gz"
# DPE ADEME
curl -sS -G --data-urlencode "size=1" "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines"
# Géorisques (lon d'abord !) + retries
curl -sS --http1.1 -H "Accept: application/json" "https://georisques.gouv.fr/api/v1/resultats_rapport_risque?latlon=2.3039,48.8506"
# GPU
curl -sS "https://apicarto.ign.fr/api/gpu/zone-urba?geom=%7B%22type%22%3A%22Point%22%2C%22coordinates%22%3A%5B2.3039%2C48.8506%5D%7D"
# BDNB
curl -sS "https://api.bdnb.io/v1/bdnb/donnees/batiment_groupe_complet?limit=1"
```
