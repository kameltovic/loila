# Relecture juridique : FAQ entreprises du BTP

35 questions, 6 sujets (catégorie `construction`, thème `construction`). Chaque réponse a été relue contre le texte des articles cités (base locale, textes en vigueur au 17/09/2026).

Méthode : une première génération avec `batch-faq.ts` était exacte sur le fond, mais écrite pour le client et non pour l'entreprise, avec plusieurs erreurs (voir « Défauts corrigés »). Tout a été régénéré avec le même modèle et le même flux de recherche, plus une consigne « lecteur = entreprise du BTP » et des points de vigilance par question (script local, non versionné). Des retouches ciblées ont ensuite été faites directement dans `faq` (listées ci-dessous). Verdict « fixed » = corrigé par rapport à la première génération.

## Tableau

| Question | Verdict | Règle clé + article |
| --- | --- | --- |
| **Assurances des entreprises du BTP** | | |
| Quelles entreprises du bâtiment doivent avoir une assurance décennale ? | fixed | Obligation d'assurance pour tout constructeur (1792-1), justifiée à l'ouverture du chantier : L241-1. Qualification des travaux renvoyée à la jurisprudence |
| Tous les travaux sont-ils soumis à l'obligation d'assurance décennale ? | fixed | Liste des ouvrages exclus, ouvrages existants : L243-1-1. « Ouvrages publics » (inventé) retiré |
| L'attestation d'assurance décennale doit-elle être jointe aux devis et factures ? | fixed | Attestation jointe aux devis et factures : L243-2. Mentions et chantiers ouverts pendant la validité : A243-3 |
| Que risque une entreprise qui travaille sans assurance décennale ? | fixed | 6 mois d'emprisonnement et 75 000 € d'amende : L243-3 |
| Qui doit souscrire l'assurance dommages-ouvrage : l'entreprise ou le client ? | fixed | DO par le propriétaire, le vendeur ou le mandataire avant l'ouverture du chantier : L242-1. Décennale de l'entreprise : L241-1 |
| **Réception des travaux et garanties** | | |
| Le client refuse la réception des travaux : que peut faire l'entreprise ? | fixed | Réception à la demande de la partie la plus diligente, amiable ou judiciaire : 1792-6. Réception tacite = jurisprudence (signalé) |
| Réserves à la réception : dans quel délai l'entreprise doit-elle les lever ? | fixed | Délai fixé d'un commun accord, sinon exécution aux frais de l'entreprise après mise en demeure : 1792-6 |
| Après la réception, pendant combien de temps l'entreprise reste-t-elle responsable ? | fixed | 1 an (1792-6), 2 ans (1792-3), 10 ans (1792-4-1, 1792-4-3), sous-traitants (1792-4-2) |
| Une entreprise peut-elle limiter ses garanties dans le contrat de travaux ? | fixed | Clauses réputées non écrites : 1792-5 |
| **Se faire payer ses travaux** | | |
| Le client peut-il retenir 5 % du montant des travaux ? | fixed | 5 % maximum des acomptes, consignation ou caution : loi 71-584 art. 1 ; clauses contraires nulles : art. 3 |
| Quand la retenue de garantie doit-elle être rendue à l'entreprise ? | OK | 1 an après la réception, sauf opposition motivée par LRAR : loi 71-584 art. 2 |
| Peut-on remplacer la retenue de garantie par une caution bancaire ? | OK | Caution personnelle et solidaire d'un établissement sur liste réglementaire : loi 71-584 art. 1 |
| Quel délai de paiement maximum pour une facture de travaux entre professionnels ? | fixed | 30 jours par défaut, 60 jours après facture ou 45 jours fin de mois : L441-10 ; amendes : L441-16 |
| Facture impayée à l'échéance : quelles pénalités de retard et indemnité de 40 € ? | OK | Pénalités sans rappel, taux ≥ 3 fois le taux légal : L441-10 ; 40 € : D441-5 ; mentions sur facture : L441-9 |
| Travaux supplémentaires sans accord écrit du client : peut-on les facturer ? | fixed | Forfait : autorisation écrite et prix convenu : 1793. Hors forfait et acceptation après coup = contrat et jurisprudence (signalé) |
| Le maître d'ouvrage doit-il garantir le paiement de l'entreprise ? | fixed | Garantie au-delà d'un seuil (décret non ingéré), suspension après 15 jours, exclusion du particulier : 1799-1 |
| Le client arrête le chantier en cours : l'entreprise peut-elle être indemnisée ? | OK | Résiliation du forfait contre dédommagement (dépenses, travaux, gain manqué) : 1794 |
| **Sous-traitance dans le BTP** | | |
| L'entreprise doit-elle faire accepter son sous-traitant par le client ? | fixed | Acceptation et agrément des conditions de paiement : loi 75-1334 art. 3. Champ du titre II (art. 5, 6) précisé |
| Sous-traitant non déclaré au maître d'ouvrage : quelles conséquences ? | fixed | Contrat inopposable au sous-traitant : art. 3 ; mise en demeure du maître d'ouvrage : art. 14-1. Action directe d'un non-accepté = jurisprudence (signalé) |
| Sous-traitant impayé : peut-il se faire payer par le maître d'ouvrage ? | fixed | Action directe 1 mois après mise en demeure, dans la limite de ce qui reste dû : art. 12 et 13. Condition d'acceptation (jurisprudence) signalée |
| L'entreprise principale doit-elle fournir une caution à son sous-traitant ? | fixed | Caution ou délégation, à peine de nullité : art. 14 ; contrôle par le maître d'ouvrage : art. 14-1 ; champ : art. 11 |
| Un sous-traitant peut-il lui-même sous-traiter une partie des travaux ? | fixed | Le sous-traitant est entrepreneur principal envers ses propres sous-traitants : art. 2, 3, 14 |
| **Devis et contrat avec un particulier** | | |
| Quelles informations donner à un particulier avant qu'il signe un devis de travaux ? | fixed | Information précontractuelle : L111-1, L111-2, L221-5. Arrêté sur le devis non ingéré (signalé) |
| Un devis signé au domicile du client peut-il être annulé sous 14 jours ? | fixed | Hors établissement : L221-1 ; 14 jours dès la conclusion : L221-18 ; prolongation de 12 mois : L221-20 ; remboursement : L221-24 |
| Peut-on commencer les travaux avant la fin du délai de rétractation ? | fixed | Demande expresse sur support durable et paiement au prorata : L221-25 ; information 9° : L221-5 ; exceptions : L221-28. Citation « annexe » erronée retirée |
| Peut-on encaisser un acompte sur un devis signé chez le client ? | fixed | Aucun paiement avant 7 jours : L221-10 ; 2 ans et 150 000 € : L242-7 |
| Acompte ou arrhes sur un devis de travaux : quelle différence pour l'artisan ? | fixed | Sommes versées d'avance = arrhes sauf stipulation contraire : L214-1 ; commandes spéciales sur devis exclues : L214-3. Acompte non défini (signalé) |
| L'artisan n'a pas informé le client de son droit de rétractation : quelles conséquences ? | fixed | Délai prolongé de 12 mois : L221-20 ; amende de 150 000 € pour le formulaire : L242-6 ; rien n'est dû : L221-25 |
| Dépannage en urgence chez un particulier : droit de rétractation et paiement immédiat ? | fixed | Exceptions urgence : L221-28 8° et L221-10 4° |
| **Salariés du BTP** | | |
| Quelle est la durée de la période d'essai d'un ouvrier du bâtiment ? | fixed | CCN ouvriers (1990) : 3 semaines maximum (IDCC 1596 art. 2-4, 1597 art. 2.4), mais durées légales impératives sauf durée plus courte conclue après 2008 ou fixée au contrat : L1221-19, L1221-22 |
| Quelle période d'essai pour un ETAM ou un cadre du bâtiment ? | fixed | ETAM 2 ou 3 mois renouvelables (IDCC 2609 art. 2.3) ; cadres 3 mois dans la CCN de 2004 contre 4 mois dans la loi (IDCC 2420 art. 2.3, L1221-19, L1221-21, L1221-22) |
| Quelle période d'essai dans les travaux publics ? | fixed | Accord national de 2011 (IDCC 1702) : 2/2/3/3 mois, plafonds 4/6/6 mois, délais de prévenance |
| Quel préavis pour un ouvrier du bâtiment en cas de licenciement ou de démission ? | fixed | 2 jours à 2 mois (licenciement), 2 jours ou 2 semaines (démission) : art. 10.1 ; heures de recherche d'emploi : art. 10.2 |
| Quand un ouvrier du bâtiment est-il en grand déplacement et que doit-on lui payer ? | OK | Définition : art. 8.21 ; indemnité journalière : 8.22 à 8.23 ; voyage : 8.24 (IDCC 1596/1597) |
| Qui décide l'arrêt d'un chantier pour intempéries ? | fixed | Entrepreneur après consultation du CSE, opposition possible du maître d'ouvrage public : L5424-9 ; définition : L5424-8, D5424-7-1 |

Question supprimée : « Pendant combien de temps un sous-traitant du bâtiment est-il responsable ? » (doublon de la question sur la durée de responsabilité, qui cite 1792-4-2).

## Défauts corrigés (première génération)

- Point de vue : réponses rédigées pour le client ou le consommateur (conseils ADIL, associations de consommateurs, « vous, maître d'ouvrage »).
- 1792-5 : articles mélangés (« parfait achèvement (1792-3) », « biennale (1792-2) »), hors-sujet sur la responsabilité du fait des produits défectueux (1245-14).
- Réserves : « à défaut d'accord, l'entrepreneur a un an », contraire à 1792-6.
- Réception refusée : le `short` disait que les articles ne traitaient pas la question.
- 1799-1 : l'alinéa sur le crédit spécifique était déformé (« sauf ordre écrit »).
- Loi 75-1334 : paiement direct (art. 6) et déclaration à la soumission (art. 5, titre II) présentés comme applicables aux marchés privés ; action directe d'un sous-traitant non accepté affirmée.
- Période d'essai : la limite conventionnelle de 3 semaines (ouvriers) présentée sans l'art. L1221-22 ; ETAM et cadres cités sous un seul article (même numéro 2.3 dans deux CCN, les `article_ids` ne gardaient que l'un des deux).
- Citation « (art. Annexe à l'article R221-3) » et L221-13 mal attribué ; « ouvrages publics » inventé ; « chantiers de montagne » inventé.

## Retouches manuelles dans `faq` après régénération

Maintien de garantie formulé comme dans L241-1 (« réputé comporter une clause »), « dès l'ouverture du chantier » au lieu de « avant » ; suppression d'une glose non sourcée de « contradictoirement » et de « délai raisonnable » ; champ du titre II de la loi 75-1334 (art. 4) précisé dans 3 réponses ; « sur un salon » retiré (les foires et salons ne sont pas des contrats hors établissement) ; heures de recherche d'emploi chiffrées avec art. 10.2 ; ajout des `article_ids` manquants (IDCC 2609 et 2420 art. 2.3, IDCC 1596/1597 art. 10.2, loi 75-1334 art. 14).

## Dépendances non couvertes (signalées dans les réponses)

Jurisprudence (réception tacite, qualification des désordres, action directe d'un sous-traitant non accepté, travaux supplémentaires acceptés après coup, portée de L1221-22 pour les CCN antérieures à 2008), décret sur le seuil de 1799-1, décret sur la liste des établissements de caution, arrêté sur les mentions du devis, code de la commande publique. Non traités faute de texte ingéré : TVA à taux réduit (CGI), RC professionnelle (pas d'obligation générale dans les textes).
