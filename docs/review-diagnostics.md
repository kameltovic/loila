# Relecture juridique : FAQ diagnostics immobiliers et DPE

39 questions, 6 sujets (catégorie `diagnostics`, thème `diagnostics`). Chaque réponse a été relue contre le texte des articles cités (base locale, textes en vigueur au 17/09/2026).

Méthode : génération unique avec `batch-faq.ts --topic <slug>` (modèle `OPENROUTER_BATCH_MODEL`), hints avec références qualifiées `code:num` toutes vérifiées en base avant génération. Pas de régénération : les défauts ont été corrigés par retouches directes dans `faq` (script local non versionné, chaque remplacement vérifié sur le texte existant). Verdict « fixed » = corrigé après la génération ; « OK » = conservé tel quel.

Thème : `batch-faq.ts` attribue aux questions de sujet le premier thème (hors conventions) qui possède un des `codes` du sujet. `code-construction-habitation` appartient d'abord à `logement` ; chaque sujet diagnostics liste donc `code-sante-publique` en premier (code possédé seulement par `diagnostics`). Aucun changement de script. Le dry-run a vérifié que ce périmètre plus large ne dégrade pas la recherche.

## Tableau

| Question | Verdict | Règle clé + article |
| --- | --- | --- |
| **DPE et location : passoires thermiques** | | |
| Logements classés G, F puis E : quel calendrier pour l'interdiction de louer ? | fixed | Décence A–F au 01/01/2025, A–E au 01/01/2028, A–D au 01/01/2034 ; outre-mer 2028/2031 : loi 89-462 art. 6, décret 2002-120 art. 3 bis ; entrée en vigueur : loi 2021-1104 art. 160. Le `short` annonçait F en 2025, E en 2028 et D en 2034 (décalé d'une classe) |
| Logement classé F ou G : le bailleur peut-il augmenter le loyer ? | fixed | Pas de révision ni de majoration (17-1 III), pas de réévaluation au renouvellement (17-2 II), relocation plafonnée au dernier loyer (17 II) ; contrats conclus, renouvelés ou reconduits depuis le 24/08/2022 : loi 2021-1104 art. 159 IV ; meublés : 25-9 |
| Mon logement loué est classé G : que puis-je demander au propriétaire ? | fixed | Mise en conformité, CDC après 2 mois, juge (travaux, réduction/suspension du loyer) : art. 20-1 ; allocation : L843-3, R843-3. Retrait de « décret non fourni » (décret 2002-120 désormais en base) |
| Le logement G que je loue déjà : le bail est-il annulé ou dois-je partir ? | OK | Validité du contrat en cours préservée, mesures du juge : art. 20-1 ; calendrier : art. 6 |
| Bailleur en copropriété ou en secteur protégé : que se passe-t-il si les travaux énergétiques sont impossibles ? | fixed | Juge ne peut ordonner les travaux (copropriété diligente, contraintes patrimoniales) mais garde les autres mesures : 20-1 ; cas patrimoniaux : décret 2002-120 art. 3 ter (limité au seul cas patrimonial) |
| Le DPE doit-il être remis au locataire et montré dès les visites ? | fixed | Joint au bail sauf bail rural et saisonnier : L126-29 ; à disposition des candidats : 3-3. Citation erronée de L126-28 (vente) retirée |
| Les règles sur les passoires thermiques s'appliquent-elles aux meublés et locations saisonnières ? | fixed | Réécrite. Meublé résidence principale : art. 6 applicable via 25-3, révision gelée via 25-9 ; saisonnier hors loi 1989 (art. 2), pas de DPE annexé (L126-29) ; travailleurs saisonniers : art. 2 3° ; L173-2 = obligation générale 2028, pas une interdiction de louer. La 1re version ignorait 25-3 et présentait L173-2 comme « l'interdiction de louer » |
| **DPE et vente : validité, audit, annonces** | | |
| Combien de temps un DPE est-il valable ? | OK | 10 ans ; DPE 2013–2017 jusqu'au 31/12/2022, 2018–30/06/2021 jusqu'au 31/12/2024 : D126-19 ; remplacement avant l'acte : L271-5 ; DPE collectif : L126-31 |
| Audit énergétique à la vente : depuis quand pour les classes F, G, E et D ? | fixed | Maisons et immeubles hors copropriété : L126-28-1 ; F/G (texte consolidé : 01/01/2022), E 01/01/2025, D 01/01/2034, outre-mer 2024/2028 : loi 2021-1104 art. 158 VII–VIII ; remise à la 1re visite : L271-4. Ajout : un D n'est pas encore soumis à l'audit ; copropriété exclue |
| Quelles mentions du DPE doivent figurer dans une annonce de vente ou de location ? | OK | Classes énergie et climat, dépenses annuelles : L126-33, R126-21 à R126-23 ; amendes 3 000 € / 15 000 € : L126-33 ; copropriété : L721-1, R721-1 |
| « Logement à consommation énergétique excessive » : quand cette mention est-elle obligatoire ? | fixed | Classe E exigée en 2028 et mentions 2022/2028 : L173-2 ; libellé : R126-24. Le `short` fixait la mention à 2028 alors que R126-24 vise les logements qui n'atteignent pas la classe E ; renvoi à l'arrêté (non ingéré) pour la date et le libellé |
| Après l'achat, la classe du DPE se révèle fausse : quels recours pour l'acquéreur ? | fixed | Réécrite. Seules les recommandations sont indicatives (L271-4 II) ; DPE hors liste de l'exonération des vices cachés ; diagnostiqueur assuré (L271-6, R271-2) ; devoir d'information (1112-1). La 1re version affirmait que le DPE entier n'a qu'une valeur indicative (règle abrogée) |
| Copropriété : le DPE collectif de l'immeuble est-il obligatoire ? | OK | Immeubles collectifs à permis déposé avant 2013, renouvelé tous les 10 ans sauf A–C : L126-31 ; inscription à l'AG : R126-20 |
| **Amiante : vente, travaux, copropriété** | | |
| Diagnostic amiante à la vente : quels logements sont concernés ? | fixed | Permis avant le 01/07/1997 : R1334-14 ; listes A et B : R1334-15, R1334-16 ; composition de l'état : R1334-29-7 ; DDT : L1334-13, L271-4. Formulation « construits après 1997 » et « responsabilité » corrigées |
| Copropriété : qu'est-ce que le dossier technique amiante (DTA) et qui doit le tenir ? | OK | Parties communes, syndicat : R1334-17, R1334-14 3° ; contenu, communication, fiche en 1 mois : R1334-29-5 ; vente : R1334-29-7 |
| Travaux dans un logement ancien : faut-il un repérage amiante avant de commencer ? | fixed | Repérage avant travaux : L4412-2, R4412-97 (immeubles antérieurs au décret du 24/12/1996), opérateur indépendant : R4412-97-1 ; amende 9 000 € : L4754-1. « 1997 » et « certifié » corrigés |
| Démolition d'un bâtiment : quel repérage amiante réaliser ? | fixed | Liste C : R1334-19, R1334-22 ; communication : R1334-29-6 ; repérage avant travaux : L4412-2, R4412-97. Retrait de « décret non fourni » |
| Amiante dégradé détecté : que doit faire le propriétaire et dans quels délais ? | fixed | 3 mois (mesure), 5 f/l, 3 ans, 36 mois, préfet 2 et 12 mois : R1334-27 à R1334-29, R1334-29-3. Ajout : champ limité aux immeubles collectifs et autres immeubles (R1334-26), pas la maison individuelle |
| Le bailleur doit-il informer le locataire de la présence d'amiante ? | fixed | Réécrite. 3-3 3° renvoie à un décret en Conseil d'État non ingéré ; obligations effectives : repérage liste A (R1334-16), dossier amiante parties privatives à disposition des occupants (R1334-29-4), DTA (R1334-29-5). La 1re version présentait l'annexe au bail comme acquise |
| **Plomb, électricité, gaz, termites, risques** | | |
| Constat de risque d'exposition au plomb (CREP) : quand est-il obligatoire et combien de temps vaut-il ? | OK | Avant 1949 ; vente < 1 an : L1334-6, D271-5 ; location < 6 ans, illimité si absence : L1334-7, R1334-11 ; charge du bailleur : L1334-7 |
| Plomb dégradé relevé par le constat : quelles obligations pour le propriétaire bailleur ? | fixed | Information et travaux avant location, responsabilité pénale : L1334-9, R1334-12 ; R1334-5 recadré sur les travaux prescrits par l'administration |
| Diagnostics électricité et gaz : quels logements et quelle durée de validité ? | fixed | Installation > 15 ans : L134-7, L134-9 ; vente < 3 ans : D271-5 ; certificat gaz < 3 ans : R126-41. Durée en location renvoyée au décret non ingéré (retrait du « je ») |
| Diagnostic termites : quand le vendeur doit-il le fournir ? | OK | Zone délimitée par arrêté préfectoral : L126-24, R131-4 ; < 6 mois : D271-5 ; vices cachés : L271-4 II |
| État des risques (ERP) : qui doit le fournir, quand, et que risque-t-on sans lui ? | fixed | 1re visite, DDT ou bail, rétractation différée, résolution ou diminution du prix : L125-5 ; < 6 mois : R125-25 ; contenu : R125-24 ; bail : 3-3. « Annulation » remplacée par « résolution », PLU retiré |
| Vente d'une maison avec fosse septique : contrôle de l'assainissement et travaux sous un an | fixed | Contrôle < 3 ans à la charge du vendeur : L1331-11-1 ; travaux sous 1 an : L271-4 ; 4 ans hors vente : L1331-1-1 (la 1re version rattachait les 4 ans à « l'entretien courant ») |
| Surface habitable du bail surévaluée (loi Boutin) : le locataire peut-il obtenir une baisse de loyer ? | OK | Écart > 1/20e, 2 mois, juge sous 4 mois, effet à la signature ou à la demande après 6 mois : art. 3-1 ; mention au bail : art. 3 |
| **Diagnostic manquant, périmé ou erroné** | | |
| Vendre sans diagnostic : quelles conséquences pour le vendeur ? | fixed | Pas d'exonération des vices cachés (1°–4°, 7°, 8°), résolution ou diminution du prix (5°, 12°) : L271-4 II ; 1641 à 1645. La 1re version parlait de perte de « la garantie des vices cachés » et d'« annulation » |
| Un diagnostic expire entre le compromis et l'acte de vente : que faire ? | fixed | Remplacement à l'acte, plomb sans plomb conservé, ERP mis à jour : L271-5 ; durées : D271-5, D126-19. Vocabulaire (résolution, exonération) corrigé |
| Bail signé sans les diagnostics obligatoires : quels risques pour le bailleur ? | fixed | ERP absent : résolution ou diminution (3-3, L125-5) ; plomb : responsabilité pénale (L1334-7, L1334-9) ; pas de sanction spécifique en base pour DPE, amiante, électricité, gaz (signalé) |
| La clause « vendu sans garantie des vices cachés » protège-t-elle le vendeur en cas de diagnostic ? | fixed | Clause valable sauf vendeur de mauvaise foi : 1643, 1645 ; inopposable si diagnostic 1°–4°, 7°, 8° absent ou périmé : L271-4 II ; délai 2 ans : 1648 |
| Diagnostic erroné : le diagnostiqueur est-il responsable et doit-il être assuré ? | OK | Compétence, indépendance, assurance : L271-6 ; 300 000 € / 500 000 € : R271-2 ; structurel 1 M€ / 1,5 M€ : R126-43-6 ; déchets : D126-12 ; responsabilité : 1231-1, 1240 |
| Amiante ou termites découverts après l'achat alors que le diagnostic n'en mentionnait pas : que faire ? | fixed | Réécrite. Absent ou périmé : pas d'exonération (L271-4 II, y compris termites 3°) ; fourni mais erroné : clause possible sauf mauvaise foi (1643, 1645), recours contre le diagnostiqueur (L271-6, R271-2), mission limitée aux matériaux accessibles (R1334-20, R1334-21) ; 2 ans : 1648. La 1re version doutait que les termites soient visés et ne traitait pas le cas du diagnostic erroné |
| **Le métier de diagnostiqueur immobilier** | | |
| Comment devenir diagnostiqueur immobilier : quelle certification est exigée ? | fixed | Certification par organisme accrédité : R271-1 ; L271-6 ; amiante : R1334-23. Portée de R271-4 b et c corrigée (« sciemment » inventé, certificateur qui établit un diagnostic) |
| Quelle assurance un diagnostiqueur immobilier doit-il souscrire ? | OK | 300 000 € par sinistre, 500 000 € par an : R271-2 ; structurel : R126-43-6 ; déchets : D126-12 ; attestation : R271-3 |
| Un diagnostiqueur peut-il verser une commission à l'agent immobilier ou travailler avec une entreprise de travaux ? | fixed | Indépendance : L271-6 ; aucun avantage à l'agent immobilier ni reçu d'une entreprise de travaux : R271-3 ; sanction : R271-4, code pénal 131-13. Retrait des passages non sourcés (DGCCRF, « nullité du diagnostic », règles « similaires ») |
| Diagnostiqueur non certifié ou non assuré : quelles sanctions, aussi pour celui qui le missionne ? | fixed | Contravention de 5e classe pour les cas a, b, c : R271-4 ; 1 500 €, 3 000 € en récidive : code pénal 131-13. « En connaissance de cause » inventé retiré ; L271-6 cité au lieu de « non fourni » |
| Le diagnostiqueur doit-il transmettre le DPE et l'audit énergétique à l'ADEME ? | OK | L126-32 ; R126-26, R126-27 (DPE), R126-30, R126-31 (audit), copie au propriétaire |
| Qui peut réaliser l'audit énergétique obligatoire à la vente ? | fixed | Professionnel qualifié par décret et indépendant : L126-28-1 ; L271-6 (6° du DDT) ; R271-4 ; remise à la 1re visite : L271-4. Précision : décret sur l'auditeur et arrêté sur le contenu non ingérés |
| Repérage amiante avant travaux : quelles exigences pour l'opérateur de repérage ? | fixed | Qualifications et indépendance : R4412-97-1 ; donneur d'ordre : R4412-97-2 ; repérage au fil de l'opération : R4412-97-4 ; date du décret de 1996 corrigée |

Aucune question supprimée. Doublons évités : `audit-energetique-vente-maison`, `dpe-valeur-juridique`, `dpe-passoire-thermique`, `surface-carrez-erreur`, `diagnostics-obligatoires-vente` et `-location` sont réutilisés via `relatedFaqs`, la page métier et `seed/generated/diagnostics-hub.json`.

## FAQ existantes à reprendre (hors périmètre, non modifiées)

- `dpe-passoire-thermique` : le `short` présente les cas de 20-1 (copropriété, contraintes patrimoniales) comme des exceptions à la non-décence ; ce sont seulement des limites au pouvoir du juge d'ordonner les travaux.
- `audit-energetique-vente-maison` : cite les classes D à G sans le calendrier de l'art. 158 de la loi 2021-1104 (D seulement au 01/01/2034). Le texte est désormais en base : une régénération avec le hint `loi-2021-1104:158` suffit.

## Textes ajoutés

| Slug | Id | Articles en vigueur | Remarque |
| --- | --- | --- | --- |
| `code-sante-publique` | LEGITEXT000006072665 | 13 661 | ingestion complète 4 min 30 s, +32 Mo de base, 107 Mo de cache XML |
| `decret-2002-120` | JORFTEXT000000217471 | 12 | décence, art. 3 bis (calendrier énergétique), 3 ter (impossibilité de travaux) |
| `loi-2021-1104` | JORFTEXT000043956924 | 126 | Climat et résilience : dates d'entrée en vigueur (art. 158 audit, 159 gel des loyers, 160 décence) |

## Dépendances non couvertes (signalées dans les réponses)

Arrêtés non disponibles dans le miroir LEGI (codes et textes non codifiés en vigueur uniquement) : seuils des classes DPE (arrêté visé à L173-1-1), méthode et contenu du DPE et de l'audit (R126-29, L126-28-1), libellé de la mention « consommation énergétique excessive » (R126-24), listes et critères de repérage amiante (annexe 13-9 et arrêtés de R1334-20 à R1334-22, R4412-97), seuils du plomb (L1334-2), référentiels de certification (R271-1). Décrets non codifiés non ingérés : qualification de l'auditeur énergétique, durée de validité de l'audit, durée de validité des états électricité et gaz en location, décret d'application de 3-3 3° (amiante en location), exonérations de L173-2. Jurisprudence : opposabilité et indemnisation d'un DPE erroné, étendue de la responsabilité du diagnostiqueur, prescription. Le texte consolidé de l'art. 158 VII indique le 01/01/2022 pour l'audit des classes F et G : les réponses disent « déjà obligatoire » sans insister sur cette date.
