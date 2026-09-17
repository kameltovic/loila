# Revue des FAQ « métiers » : bailleur et employeur-tpe

Relecture de chaque nouvelle réponse (`faq`) contre les articles qu'elle cite : chiffres, délais, conditions, citation qui porte la règle, absence de verdict personnalisé. Modèle : `OPENROUTER_BATCH_MODEL` via `scripts/batch-faq.ts --topic`. Seules les questions absentes de la base ont été ajoutées ; les questions existantes sont réutilisées dans `seed/metiers/*.json`.

Verdicts : **OK** (publiable tel quel), **Corrigé** (régénéré avec d'autres hints ou une autre formulation, ou retouche éditoriale en base, détaillée ci-dessous). Aucune question abandonnée.

## Analyse des manques

**Bailleur (plusieurs logements)** : 25 slugs dans la page, dont 13 existants (diagnostics, mentions du bail, montant et restitution du dépôt, IRL, encadrement, régularisation des charges, préavis du bailleur, trêve hivernale, décence, passoire thermique, réparations, colocation). 12 nouvelles questions : choix vide ou meublé vu du bailleur, congé en meublé, motif légitime et sérieux, reprise par une SCI familiale, travaux d'amélioration, quittance, forfait ou provisions, abandon du logement, clause résolutoire, appel au garant, prescription des loyers, étapes après le jugement d'expulsion. Écarté : complément de loyer (art. 140 de la loi ELAN, non ingéré).

**Employeur de TPE** : 25 slugs, dont 11 existants (période d'essai, heures sup, congés payés, dates de congés, maintien de salaire en arrêt maladie, rupture conventionnelle, entretien préalable, préavis et indemnité de licenciement, préavis de démission, documents de fin de contrat). 16 nouvelles questions : DPAE, motifs et durée du CDD, écrit et délai de remise du CDD, délai de carence, temps partiel, heures complémentaires, durées maximales et repos, contingent, registre du personnel, document unique, affichages, convention collective applicable, seuils d'effectif, visite de reprise, sanction disciplinaire, mutuelle d'entreprise.

## Bailleur

| Question (slug) | Verdict | Règle clé (article) |
|---|---|---|
| choix-bail-vide-ou-meuble-bailleur | OK | Vide : 3 ans (personne physique ou SCI familiale), 6 ans (personne morale), dépôt 1 mois (art. 10, 22). Meublé : 1 an ou 9 mois pour un étudiant, dépôt 2 mois, congé du bailleur 3 mois (art. 25-6, 25-7, 25-8). |
| conge-bailleur-location-meublee | OK | Préavis de 3 mois avant l'échéance, motif obligatoire (reprise, vente, motif légitime et sérieux), forme et protection des plus de 65 ans (art. 25-8). |
| conge-motif-legitime-serieux | Corrigé | La 1re version présentait l'art. 6-1 (troubles de voisinage) comme un motif légitime et oubliait que le congé vaut pour la fin du bail. Régénérée avec une question et des hints sur le terme du bail, puis coquille corrigée (« acte d'commissaire »). Congé pour la fin du bail, préavis de 6 mois, motif indiqué à peine de nullité (art. 10, 15) ; impayés de l'auteur de violences (art. 8-2). |
| reprise-logement-sci-familiale | OK | Une SCI entre parents et alliés jusqu'au 4e degré peut donner congé pour reprise au profit d'un associé (art. 13, 15). La réponse signale l'incertitude sur la protection des locataires âgés quand le bailleur est une société. |
| travaux-amelioration-hausse-loyer | Corrigé | La 1re version citait des articles HLM sans les enregistrer et étendait l'interdiction F/G au meublé. `code-construction-habitation` retiré des codes du sujet, puis réponse régénérée et référence « art. 25-9 » retirée de la phrase sur F/G. Majoration seulement si une clause expresse la prévoit ; pas d'action en diminution ; interdite en classe F ou G (art. 17-1 II et III). |
| quittance-loyer-obligation-bailleur | OK | Quittance gratuite sur demande, loyer et charges distingués, reçu en cas de paiement partiel (art. 21) ; refus puni d'1 an et 20 000 € (art. 3-4). |
| charges-forfait-ou-provisions | Corrigé | Régénérée sans le CCH (articles HLM hors sujet). Retouche en base : en location vide, les charges sont exigibles sur justification, le plus souvent par provisions (« uniquement » et « obligatoire » retirés). Pas de forfait en vide ; choix provisions ou forfait en meublé (art. 25-10) et en colocation (art. 8-1) ; forfait obligatoire en bail mobilité (art. 25-18) ; régularisation annuelle, décompte un mois avant, justificatifs pendant 6 mois (art. 23). |
| abandon-logement-locataire | OK | Mise en demeure par commissaire de justice, constat après un mois, résiliation constatée par le juge (art. 14-1) ; le bail continue au profit des proches désignés (art. 14). |
| clause-resolutoire-impayes-bailleur | Corrigé | La 1re version conseillait le locataire. Régénérée avec la question tournée vers le bailleur. Paragraphe hors sujet sur la saisie immobilière supprimé en base. Effet 6 semaines après le commandement, mentions à peine de nullité, signification à la caution sous 15 jours, signalement CCAPEX, assignation notifiée au préfet au moins 6 semaines avant l'audience, délais jusqu'à 3 ans (art. 24). |
| actionner-garant-loyers-impayes | OK | Commandement signifié à la caution sous 15 jours, sinon pas de pénalités ni d'intérêts (art. 24) ; résiliation du cautionnement à durée indéterminée (art. 22-1) ; limites du cautionnement (C. civ. 2295, 2296) ; information annuelle due par le créancier professionnel (C. civ. 2302). |
| prescription-loyers-impayes | OK | Action prescrite par 3 ans à partir du jour où le bailleur a connu ou aurait dû connaître les faits (art. 7-1) ; délai non aménageable pour les loyers (C. civ. 2254). |
| expulsion-apres-jugement-etapes | Corrigé | Coquille corrigée en base (« mauvaise faille » devient « mauvaise foi »). Commandement de quitter les lieux (CPCE L411-1, R411-1), délai de 2 mois (L412-1), délais du juge (L412-3), saisine du préfet (L412-5), trêve du 1er novembre au 31 mars (L412-6). |

## Employeur de TPE

| Question (slug) | Verdict | Règle clé (article) |
|---|---|---|
| declaration-prealable-embauche-dpae | OK | Embauche possible seulement après la déclaration (L1221-10), au plus tôt 8 jours avant (R1221-4), par voie électronique ou lettre recommandée au plus tard le dernier jour ouvrable (R1221-5) ; pénalité (L1221-11) ; travail dissimulé si l'omission est intentionnelle (L8221-5). |
| cdd-motifs-duree-maximale | OK | Motifs limitatifs (L1242-2) ; pas d'emploi permanent (L1242-1) ; durée maximale de 18 mois, 9 mois ou 24 mois selon le cas, sauf accord de branche (L1242-8, L1242-8-1). |
| cdd-ecrit-delai-transmission | OK | Écrit avec motif, sinon réputé CDI ; mentions obligatoires (L1242-12) ; remise sous 2 jours ouvrables (L1242-13) ; un retard n'entraîne pas la requalification mais une indemnité d'au plus 1 mois de salaire (L1245-1). |
| delai-carence-entre-deux-cdd | OK | Un tiers de la durée si le contrat dure 14 jours ou plus, la moitié en dessous, en jours d'ouverture (L1244-3, L1244-3-1) ; exceptions (L1244-4-1). |
| temps-partiel-contrat-duree-minimale | Corrigé | Paragraphe hors sujet sur les dérogations de l'insertion par l'activité économique supprimé en base. Contrat écrit et mentions (L3123-6) ; 24 h par semaine à défaut d'accord, exceptions et dérogations (L3123-7, L3123-27) ; amende de 5e classe par salarié (R3124-5). |
| heures-complementaires-temps-partiel | Corrigé | La 1re version attribuait la limite du tiers à L3123-22 et citait l'ancien article abrogé L212-4-4. Régénérée avec le hint L3123-20. Limite d'un dixième (L3123-28), jusqu'au tiers par accord (L3123-20), jamais jusqu'à la durée légale (L3123-9), majoration de 10 % puis 25 % (L3123-29). |
| durees-maximales-travail-repos | OK | 10 h par jour (L3121-18), 12 h par accord (L3121-19), 48 h par semaine (L3121-20), 44 h en moyenne sur 12 semaines (L3121-22) ; repos de 11 h (L3131-1) et de 24 h plus 11 h (L3132-2). |
| contingent-heures-sup-contrepartie-repos | OK | 220 h à défaut d'accord (D3121-24) ; contrepartie en repos de 50 % jusqu'à 20 salariés, 100 % au-delà (L3121-38) ; repos ouvert à 7 h et pris sous 2 mois (D3121-18). |
| registre-unique-personnel | OK | Obligatoire dans tout établissement employant des salariés (L1221-13) ; mentions (D1221-23) ; conservation 5 ans (R1221-26). |
| document-unique-evaluation-risques | OK | Obligatoire dès le premier salarié (L4121-3, L4121-3-1) ; mise à jour annuelle à partir de 11 salariés (R4121-2) ; conservation 40 ans (R4121-4). |
| affichages-obligatoires-employeur | Corrigé | Sections hors sujet pour une TPE supprimées en base (documents électroniques et CNIL, groupe spécial de négociation européen), avec leurs `article_ids`. Horaires (L3171-1), textes pénaux sur la discrimination et le harcèlement (L1142-6, L1152-4, L1153-5), avis sur les conventions (R2262-3), coordonnées du médecin du travail, des secours et de l'inspection (D4711-1), documents d'information sur la relation de travail (L1221-5-1). |
| convention-collective-applicable-entreprise | Corrigé | La 1re version s'adressait au salarié. Régénérée avec une question côté employeur. Activité principale (L2261-2), information et avis aux salariés (R2262-1, R2262-3), mention sur le bulletin de paie (R3243-1). Réserve : la remarque sur le code APE non déterminant vient de la jurisprudence, pas du texte. |
| calcul-seuils-effectif | OK | Décompte du Code du travail (L1111-2) ; moyenne mensuelle de l'année précédente et franchissement après 5 années civiles consécutives (CSS L130-1). La réponse ajoute les seuils CSE de 300 salariés (L2312-34), exacts mais peu utiles en TPE. |
| visite-reprise-apres-arret | OK | Congé maternité, maladie professionnelle, accident du travail de 30 jours ou plus, maladie de 60 jours ou plus ; visite le jour de la reprise et au plus tard sous 8 jours ; dispense après une visite de préreprise (R4624-31). |
| procedure-sanction-disciplinaire | OK | Griefs par écrit (L1332-1) ; convocation sauf avertissement, sanction entre 2 jours ouvrables et 1 mois après l'entretien (L1332-2, R1332-1, R1332-2) ; prescription de 2 mois (L1332-4). |
| mutuelle-entreprise-obligatoire | OK | Couverture minimale et financement employeur d'au moins 50 % (CSS L911-7) ; dispenses et versement santé (L911-7-1). |

## Points à suivre (hors périmètre)

- La table `articles` contient `code-du-travail` **L212-4-4**, un article de l'ancienne numérotation abrogé en 2008, qui remonte encore dans la recherche. D'autres articles abrogés sont peut-être présents : filtre « en vigueur » à vérifier dans `scripts/ingest.ts`.
- Le prompt système de `batch-faq.ts` vise « salariés, locataires, propriétaires ». Les réponses destinées aux employeurs et aux bailleurs finissent donc parfois par un conseil adressé au salarié ou au locataire. Il faut formuler la question du point de vue de l'employeur ou du bailleur.
