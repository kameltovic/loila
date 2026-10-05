# Relecture juridique : FAQ données personnelles (RGPD, fuites de données)

16 questions, 3 sujets (catégorie et thème `donnees-personnelles`). Chaque réponse a été relue contre le texte des articles cités (base locale, textes en vigueur au 05/10/2026).

Méthode : génération unique avec `batch-faq.ts --topic <slug>` (modèle `OPENROUTER_BATCH_MODEL`), hints `code:num` vérifiés en base avant génération, puis corrections directes en base (script local non versionné, chaque remplacement vérifié sur le texte existant). Les réponses générées contenaient des marqueurs `[PERSON_NAME]` (filtre de données personnelles côté fournisseur) : tous remplacés, absence vérifiée. Les citations d'un numéro présent dans deux textes sont qualifiées (« art. 83 RGPD » / « art. 83, loi 78-17 ») : `linkCitations` choisit le texte nommé après le numéro.

Textes ajoutés : RGPD (99 articles, Office des publications de l'UE), loi n° 78-17 (133 articles en vigueur), loi n° 2025-391 (11 articles autonomes, dont l'art. 16 : régime unifié de l'action de groupe ; l'art. 37 de la loi 78-17 est abrogé depuis le 03/05/2025). Jurisprudence de la CJUE citée en texte, sans lien (hors corpus).

## Tableau

| Question | Verdict | Règle clé + article |
| --- | --- | --- |
| **Fuite de données : vos droits** | | |
| Fuite de données : puis-je demander un dédommagement à l'entreprise ? | fixed | Réécrite. Droit à réparation du dommage matériel ou moral : RGPD 82 ; pas d'indemnisation sans dommage prouvé, pas de seuil (CJUE C-300/21), crainte d'usage abusif (C-340/21), fonction réparatrice (C-182/22) ; exonération seulement si le fait n'est en rien imputable : 82 §3 ; CNIL n'indemnise pas ; action de groupe : loi 2025-391 art. 16 ; prescription 5 ans : C. civ. 2224. La 1re version ignorait la preuve du préjudice |
| Une entreprise victime d'une fuite doit-elle me prévenir ? | OK | Notification CNIL 72 h : 33 ; information des personnes si risque élevé, 3 exceptions : 34 ; loi 78-17 art. 58 ; opérateurs télécoms : loi 78-17 art. 83 ; amende 10 M€ / 2 % : RGPD 83 §4 |
| Mes données ont fuité : que faire concrètement ? | fixed | 4, 33, 34, 15, 77, 57, 79. Ajout des réflexes (hameçonnage, banque) et du droit à réparation (82) ; retrait d'une remarque à la 1re personne |
| Fuite de données : porter plainte à la CNIL ou au pénal ? | fixed | Réclamation : 77 ; art. 78 = recours contre la CNIL elle-même si elle ne traite pas la réclamation sous 3 mois (la 1re version en faisait un recours contre l'entreprise) ; 226-17 C. pén. (défaut de sécurité), 323-1 à 323-6 ; la CNIL n'indemnise pas |
| Après une fuite, quelqu'un utilise mon identité : quels recours ? | fixed | 226-4-1 (texte : « honneur ou considération »), 313-1, 313-3, RGPD 82 |
| Action de groupe après une fuite de données | fixed | Loi 2025-391 art. 16 : associations agréées, syndicats représentatifs « en matière de protection des données personnelles », entités qualifiées, ministère public (cessation) ; délai d'adhésion 2 mois à 5 ans ; suspension de la prescription ; vise aussi les personnes publiques (ajout) ; mandat : loi 78-17 art. 38, RGPD 80 |
| Quelles sanctions risque une entreprise qui a laissé fuiter des données ? | fixed | 83 §4/§5, loi 78-17 art. 20 ; procédure simplifiée plafonnée à 20 000 € : art. 22-1 (la 1re version ajoutait un plafond de 100 000 € absent du texte) ; 226-17 C. pén. |
| Fuite dans un service public ou un hôpital : mêmes droits ? | fixed | 34, 82, 37 ; seul l'État échappe à l'amende (loi 78-17 art. 20 IV 7°) : hôpitaux et collectivités peuvent être sanctionnés (la 1re version laissait la question ouverte) ; juge administratif ; action de groupe contre une personne publique : loi 2025-391 art. 16. `article_ids` corrigés (RGPD 20 = portabilité, cité à tort) |
| **Vos droits sur vos données** | | |
| Comment savoir quelles données une entreprise détient sur moi ? | OK | 15, 12, 13, 14, 4, 7 |
| Dans quel délai une entreprise doit-elle répondre ? | OK | 1 mois + 2 mois motivés, gratuité, refus motivé : 12 |
| Puis-je exiger qu'une entreprise supprime mes données ? | fixed | 17, 19, 16, 18 ; loi 78-17 art. 51 (mineurs ; saisine CNIL qui statue en 3 semaines) et 54, citations qualifiées |
| Comment arrêter de recevoir de la prospection ? | fixed | 21 §2-4 ; cookies : loi 78-17 art. 82 ; ajout : démarchage téléphonique soumis au consentement préalable depuis le 11/08/2026, contrat nul sinon : C. consom. L223-1 |
| Un site peut-il m'imposer des cookies ? | fixed | loi 78-17 art. 82, 45 ; RGPD 7 ; amende cookies : loi 78-17 art. 20 (et non RGPD 83) |
| L'entreprise ne répond pas à ma demande RGPD | fixed | 12, 77, 79, 57 ; art. 78 relu (recours contre la CNIL) |
| **Données personnelles au travail** | | |
| Mon employeur peut-il me filmer au travail ? | OK | L1121-1, L1222-4, L2312-38, L2312-59, RGPD 13 |
| Un salarié peut-il demander toutes ses données à son employeur ? | fixed | 15, 12 ; ajout de la limite « droits et libertés d'autrui » (15 §4) ; retrait d'une remarque hors sujet sur L3243-2 |

## Hors corpus, à surveiller

Code de procédure civile (tentative de conciliation préalable sous 5 000 €), code de justice administrative, lignes directrices CNIL sur les cookies et la vidéosurveillance, jurisprudence nationale sur les montants d'indemnisation. Les réponses renvoient à la CNIL ou à un avocat sur ces points.
