# Loilà — Open Data Roadmap (synthèse de la nuit du 21 septembre 2026)

> Synthèse des 5 audits (`docs/research/2026-09-*.md`). Chaque source listée a été vérifiée en direct
> (`curl`) le 21/09/2026. Objectif : brancher de l'open data officiel sur le graphe légal existant
> (101 981 articles, 57 957 décisions, 18 conventions), pas produire des pages isolées.

## 0. État des lieux du graphe (avant)

| Mesure | Valeur |
| --- | --- |
| Articles (LEGI/KALI) | 101 981 |
| Décisions (cass, jade, constit) | 57 957 |
| Liens décision → article | 179 803 |
| Citations détectées | 1 281 444 |
| Relations article ↔ article | 117 382 (58 691 paires) |
| Articles avec jurisprudence | 16 807 |
| Conventions (IDCC KALI) | 18 |
| Provenance | 159 938 |
| Entreprises / adresses / biens | 0 |

## 1. Classement de synthèse (score 100 = meilleur levier)

| SOURCE | FEATURE | USER VALUE | SEO VALUE | GRAPH VALUE | DIFFICULTY | RISK | PRIORITY |
| --- | --- | --- | --- | --- | --- | --- | --- |
| API Recherche d'entreprises (DINUM) | Fiche entreprise + IDCC | 5 | 4 | 5 | Low | Low (RGPD dirigeants) | **P0** |
| Liste juridictions compétentes (Min. Justice) | commune → TJ/CPH/CA | 5 | 5 | 5 | Low | Low | **P0** |
| BODACC (DILA) | Annonces + procédures collectives | 4 | 3 | 4 | Low | Low | **P0** |
| ADEME RGE | Certification RGE par SIRET | 3 | 3 | 4 | Low | Low (emails/tél.) | **P0** |
| DSN SIRET→IDCC (Min. Travail) | Convention déclarée CERTAIN | 5 | 4 | 5 | Low (CSV 99 Mo) | Low | **P0** |
| BAN / Géoplateforme | Pivot adresse (banId, INSEE, lat/lon) | 5 | 3 | 5 | Low | Low | **P1** |
| Cadastre apicarto | Parcelle (IDU) | 4 | 3 | 4 | Low | Low | **P1** |
| DVF (`dvf-api.data.gouv.fr`) | Transactions à la parcelle | 4 | 5 | 4 | Med | RGPD/logement | **P1** |
| DPE ADEME (`dpe03existant`) | Diagnostic par adresse BAN | 5 | 5 | 4 | Med | Low | **P1** |
| Géorisques | Risques par adresse | 4 | 4 | 4 | Low | Instabilité API | **P1** |
| APICarto GPU | Zonage PLU par adresse | 4 | 4 | 4 | Med | Licence `notspecified` | **P1** |
| Zonage ABC / zones tendues | commune → zone tendue | 4 | 5 | 3 | Low | Low | **P2** |
| IRL (INSEE BDM) | Révision de loyer | 5 | 5 | 4 | Low | clé INSEE possible | **P2** |
| Encadrement des loyers | loyer de référence adresse | 5 | 5 | 4 | Med | ODbL (Paris) | **P2** |
| ACCO (accords d'entreprise) | SIRET → accord → articles | 4 | 3 | 5 | High | XML lourd, RGPD | **P3** |
| RNIC copropriétés | adresse → copro → syndic | 4 | 4 | 4 | Med/High | import lourd | **P3** |
| Annuaire administration | adresse → service compétent | 3 | 4 | 4 | Med | qualité | **P3** |
| Jours fériés (calendrier.api.gouv.fr) | calcul de délais | 3 | 4 | 3 | Low | Low | **P3** |
| NATINF (infractions) | infraction → texte | 3 | 2 | 4 | Med | appariement indirect | **P3** |
| BDNB / RNB | pivot bâtiment | 3 | 2 | 4 | High | millésimes lourds | **P3** |

**Écartés volontairement** : BOSS (pas d'open data, WAF), API Entreprise/Particulier (habilitation),
BOAMP, statistiques justice, BPE/Filosofi, météo, taux d'intérêt légal (source non fiable),
fonds DILA déjà ingérés (sauf ACCO). Voir `2026-09-open-data-catalog.md` §5.

## 2. Décisions d'architecture

1. **Pas de base graphe séparée.** SQLite relationnel suffit ; le graphe est déjà relationnel
   (`citations`, `decision_articles`, `article_relations`, `provenance`). On ajoute des tables
   additives, jamais de réécriture.
2. **Une couche commune de résolution d'entités** (`entities`, `entity_ids`) avant chaque verticale.
   Une donnée d'API n'est pas recopiée dans plusieurs tables : elle vit dans sa table métier et
   pointe vers `entities` et `source_records`.
3. **`source_records`** = modèle commun de provenance runtime (provider, dataset, external_id,
   official_url, retrieved_at, published_at, updated_at, licence, checksum, expires_at). Chaque
   affirmation affichable remonte à sa source.
4. **Cache SQLite obligatoire.** Aucun appel API externe au rendu d'une page. Les entités
   « live » (entreprise, adresse) sont enrichies via `scripts/open-data-*.ts` et lues en base.
   Les pages affichent une carte « à rafraîchir » si le cache est absent/périmé, jamais un appel
   bloquant non cacheable.
5. **Match quality explicite** : `CERTAIN` / `PROBABLE` / `POSSIBLE` / `UNKNOWN`. Un match
   `POSSIBLE` (ex. DVF par adresse) n'est jamais présenté comme une preuve.
6. **RGPD** : on indexe la fiche entreprise, jamais l'annuaire de personnes. Dirigeants minimisés
   (pas d'adresse perso, pas de date de naissance complète), canal d'opposition prévu.
7. **SEO_ELIGIBLE** : une fonction unique décide indexabilité (métadonnées + sitemap). Une fiche
   vide ne devient jamais indexable.

## 3. Vagues d'implémentation

- **Vague 1 (cette nuit)** : couche entités/provenance + verticale entreprise (DINUM + BODACC +
  RGE + IDCC) + primitives immobilier (BAN → parcelle → DVF → DPE → risques → PLU) + SEO
  eligibility/sitemaps + observabilité + QA.
- **Vague 2** : juridictions, IRAL, zonage ABC, encadrement des loyers, ACCO, RNIC.
- **Vague 3** : BDNB, calculateurs versionnés, assistant contextuel (LLM en dernier).

## 4. Sources découvertes (récapitulatif licences)

| Source | Organisme | Donnée | Licence | Fréquence | Usage Loilà |
| --- | --- | --- | --- | --- | --- |
| recherche-entreprises.api.gouv.fr | DINUM | identité, NAF, IDCC, RGE, dirigeants | LOV2 (code MIT) | quotidien | colonne vertébrale entreprise |
| BODACC Opendatasoft | DILA | annonces civiles/commerciales | Licence Ouverte | quotidien | procédures collectives |
| ADEME data-fair | ADEME | entreprises RGE | LOV2 | quotidien | certification |
| DSN SIRET→IDCC | Min. Travail | convention collective par SIRET | LOV2 | ponctuel (retard mois) | IDCC CERTAIN |
| KALI | DILA | textes conventions | fr-lo | quotidien | déjà ingéré |
| BAN / Géoplateforme | IGN/DINUM | adresse, géocodage | LOV2 | continu | pivot adresse |
| apicarto cadastre | IGN | parcelles | LOV2 | continu | pivot parcelle |
| dvf-api.data.gouv.fr | DGFiP/Etalab | mutations | LOV2 | semestriel | prix |
| ADEME dpe03existant | ADEME | DPE | LOV2 | continu | diagnostic |
| Géorisques | BRGM/MTECT | risques | LOV2 (de fait) | continu | risques |
| apicarto GPU | IGN | zonage PLU | à sécuriser | continu | urbanisme |
| INSEE BDM | INSEE | IRL | LOV2 | trimestriel | révision loyer |
| Juridictions | Min. Justice | commune → juridiction | LOV2 | annuel | où agir |

## 5. Next 10 highest leverage actions

1. Couche `entities`/`entity_ids`/`source_records` + `match_quality` partout.
2. Entreprise → IDCC (API DINUM) → convention → articles : la boucle qui manque.
3. Juridictions : commune → TJ/CPH/CA → décisions.
4. Cache et page entreprise avec provenance affichée.
5. Adresse BAN → parcelle → DVF/DPE/risques/PLU, avec `match_quality`.
6. SEO_ELIGIBLE unifié (métadonnées = sitemap) + sitemaps découpés.
7. `decision_parties` (SIREN cités dans les décisions) → entreprise ↔ jurisprudence.
8. `agreement_rule` versionné (KALI) pour des calculateurs déterministes sourcés.
9. Observabilité (`legal-graph:stats`, `open-data:health`) + QA automatique.
10. IRL + révision de loyer (indice officiel → loi 89-462 → modèle de lettre).
