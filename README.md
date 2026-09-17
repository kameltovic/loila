# Loilà

**Le droit du quotidien, expliqué simplement.** Loilà répond en français clair aux questions que se posent salariés, locataires et propriétaires, en citant toujours les articles de loi officiels.

Trois thèmes pour commencer :

- 💼 **Travail** : contrat, congés, licenciement, rupture conventionnelle (Code du travail)
- 🏡 **Construire & aménager** : permis de construire, déclaration préalable, PLU (Code de l'urbanisme)
- 🔑 **Louer un logement** : bail, dépôt de garantie, préavis, loyers (loi du 6 juillet 1989, Code de la construction et de l'habitation)

> Loilà vulgarise, il ne remplace pas un avocat, l'ADIL ou l'inspection du travail.

## Architecture

Next.js 16 (App Router, `output: "standalone"`) + SQLite (`better-sqlite3`), un seul fichier `data/loila.db`.

Pour chaque question, on descend une cascade et on s'arrête au premier niveau qui répond :

1. **FAQ** (`faq`) : ~75 questions fréquentes pré-générées hors ligne par `batch:faq`, servies instantanément et gratuitement.
2. **Cache** (`qa_cache`) : une question déjà posée (hash de la question normalisée) ne rappelle pas le LLM.
3. **Recherche + LLM** : recherche plein texte SQLite FTS5 (`articles_fts`) dans les codes du thème, puis appel [OpenRouter](https://openrouter.ai) avec uniquement les articles trouvés. Le modèle doit citer `(art. X)` et ne rien inventer. La réponse est ensuite mise en cache.

```
seed/questions.json ─┐
                     ├─ scripts/batch-faq.ts ──► faq
Légifrance (DILA) ───┴─ scripts/ingest.ts ────► articles + articles_fts

question ──► faq ? ──► qa_cache ? ──► FTS5 ──► OpenRouter ──► qa_cache
```

Fichiers clés : `src/lib/db.ts` (schéma), `src/lib/themes.ts`, `src/lib/search.ts`, `src/lib/openrouter.ts`, `scripts/`.

## Sources des données

Les textes viennent des **données ouvertes LEGI de la DILA** (Direction de l'information légale et administrative), la base qui alimente [Légifrance](https://www.legifrance.gouv.fr). Seuls les articles en vigueur des codes utilisés sont importés, et chaque article renvoie vers sa page Légifrance.

Licence : la DILA diffuse ces données librement et gratuitement en open data (voir [Légifrance, open data et API](https://www.legifrance.gouv.fr/contenu/pied-de-page/open-data-et-api) et [data.gouv.fr](https://www.data.gouv.fr)). Les textes de loi eux-mêmes ne sont pas protégés par le droit d'auteur. Les réponses de Loilà sont des explications : seul le texte officiel fait foi.

## Installation locale

Prérequis : Node.js 24.

```bash
npm i
cp .env.example .env        # renseigner OPENROUTER_API_KEY
npm run ingest              # télécharge et indexe les articles dans data/loila.db
npm run batch:faq           # génère les réponses de la FAQ (appelle OpenRouter)
npm run dev                 # http://localhost:3000
```

Variables (`.env`) :

| Variable | Rôle |
| --- | --- |
| `OPENROUTER_API_KEY` | clé OpenRouter |
| `OPENROUTER_CHAT_MODEL` | modèle économique pour les questions en direct |
| `OPENROUTER_BATCH_MODEL` | modèle plus fort pour la FAQ (lancée une fois) |
| `DATABASE_PATH` | chemin du fichier SQLite (défaut `./data/loila.db`) |

### Générer la FAQ

```bash
npm run batch:faq -- --dry-run --theme logement   # vérifie la recherche, sans appel LLM
npm run batch:faq -- --limit 5                    # 5 questions, pour tester
npm run batch:faq -- --force                      # régénère aussi les questions déjà en base
```

Les questions sont dans `seed/questions.json` (`theme`, `slug`, `emoji`, `question`, `hints`). Les `hints` aident la recherche : mots-clés, et numéros d'articles (`L1237-11`, `22`…) récupérés directement. Seuls les articles réellement cités par le modèle et présents en base sont enregistrés.

`npm run check` lance la vérification des types, le self-check de la cascade et celui de la facturation (`scripts/check-billing.ts`).

## Paiements

Seules les réponses **générées par le LLM** sont payantes : FAQ et cache restent gratuits et illimités. Poser une question nécessite un compte ; chaque compte a 3 questions gratuites à vie. Offres (`src/lib/plans.ts`) :

- **Dossier** : 4,90 € TTC, paiement unique, 10 questions **valables 30 jours après l'achat** (date de la session Stripe, pas de l'arrivée du webhook). Chaque achat crée un lot distinct dans `credit_batches`, avec sa propre expiration ; un nouvel achat ne prolonge pas les précédents. Les questions non utilisées expirent sans remboursement.
- **Pro** : 49 € HT/mois, 500 questions/mois (usage raisonnable). **Pas encore en vente** (`available: false`) : la carte ouvre une liste d'attente (`pro_waitlist`), `/api/checkout` refuse l'offre et aucun prix Stripe n'est créé. Pour l'ouvrir : construire les fonctionnalités annoncées, régler la question de la TVA, passer `available` à `true`, lancer `stripe-setup`.

Ordre de débit : quota d'abonnement → lot de crédits non expiré dont l'expiration est la plus proche → questions gratuites. Les lots expirés sont ignorés mais jamais supprimés, et chaque question payée par un lot garde son `batch_id` dans `usage` (historique en cas de litige). Un crédit n'est débité qu'après une réponse LLM réussie ; au-delà, `/api/ask` répond `402 { code: "paywall", me }`. `Me` expose `credits` (lots valides) et `creditsExpireAt` (lot valide qui expire en premier), affichés dans `/compte` et le paywall.

Rétractation : le Dossier est un contenu numérique fourni immédiatement. Avant la redirection vers Stripe, l'acheteur coche une case de renonciation au délai de 14 jours ; `/api/checkout` refuse la commande sans `waiver: true` et enregistre `withdrawal_waiver_at` dans les métadonnées de la session Stripe (preuve).

Anciennes offres (`loila_single_v1`, `loila_essentiel_monthly_v1`, `loila_illimite_monthly_v1`) : retirées sans aucun achat en production, prix désactivés par `stripe-setup`. La table `credit_ledger` (crédits sans expiration) n'est plus lue.

Connexion sans mot de passe par lien magique (15 min, usage unique), session de 90 jours (cookie `loila_session`). Paiement via Stripe Checkout ; les montants viennent toujours des prix Stripe (`lookup_key`).

| Route | Rôle |
| --- | --- |
| `GET /api/me` | état du visiteur (`Me`) |
| `POST /api/auth/request` `{email, next?}` | envoie le lien magique |
| `GET /api/auth/verify?token=` | ouvre la session, redirige vers `/compte` ou `next` |
| `POST /api/auth/logout` | ferme la session |
| `POST /api/checkout` `{offer, waiver}` | crée la session Checkout → `{url}` (offres `available` seulement ; `waiver: true` requis pour le Dossier) |
| `POST /api/pro-waitlist` `{email, metier?}` | inscription à la liste d'attente Pro |
| `GET /api/checkout/return?session_id=` | retour de Stripe : crédite (idempotent), connecte, redirige vers `/merci?ok=1` |
| `POST /api/portal` | portail de facturation Stripe → `{url}` |
| `POST /api/stripe/webhook` | webhooks Stripe (signature vérifiée, idempotent) |

Variables :

| Variable | Rôle |
| --- | --- |
| `AUTH_SECRET` | secret HMAC des cookies (obligatoire en production, `openssl rand -base64 32`) |
| `STRIPE_SECRET_KEY` | clé secrète Stripe (`sk_live_…` en production) |
| `STRIPE_WEBHOOK_SECRET` | secret de signature du webhook (`whsec_…`) |
| `SWEEGO_API_KEY` | clé API [Sweego](https://www.sweego.io) pour les e-mails ; absente en dev, le lien est affiché dans la console du serveur |
| `EMAIL_FROM` | expéditeur (défaut `Loilà <connexion@loila.fr>`) |
| `SITE_URL` | URL publique (défaut `https://loila.fr`), utilisée pour les liens et redirections en production |

Mise en production :

1. `STRIPE_SECRET_KEY=sk_live_… npx tsx scripts/stripe-setup.ts --live` crée le produit « Loilà » et les prix des offres disponibles, et désactive les anciens prix (idempotent).
2. Dans le dashboard Stripe, ajouter l'endpoint `https://loila.fr/api/stripe/webhook` avec les événements `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, puis copier son secret dans `STRIPE_WEBHOOK_SECRET`.
3. Activer le portail client (Paramètres → Billing → Customer portal) : annulation et moyens de paiement.
4. Dans Sweego, vérifier le domaine d'envoi `loila.fr` (enregistrements DNS SPF et DKIM à ajouter sur la zone de loila.fr), puis créer la clé API.

En local (mode test) :

```bash
npm run stripe:setup                                                  # produit + prix de test
stripe listen --forward-to localhost:3000/api/stripe/webhook          # copier le whsec_ dans .env
stripe trigger checkout.session.completed --override checkout_session:metadata.offer=dossier
```

Carte de test : `4242 4242 4242 4242`, date future, CVC quelconque.

## Docker

Le `Dockerfile` a deux cibles :

- **`runner`** (par défaut) : image minimale avec la sortie standalone de Next.js, utilisateur non-root, base SQLite dans le volume `/data`, port 3000, healthcheck.
- **`tools`** : image avec toutes les dépendances, `tsx`, `scripts/` et `seed/`, pour lancer `ingest` et `batch:faq`. Le dossier `data/` du conteneur pointe vers `/data`, donc la base et le cache XML vont dans le volume.

```bash
docker compose up -d --build                        # le site sur http://localhost:3000
docker compose run --rm tools npm run ingest        # importer les articles
docker compose run --rm tools npm run batch:faq     # générer la FAQ
```

Les deux services montent `./data:/data` et lisent `.env`. Sous Linux, `./data` doit être accessible en écriture à l'uid 1000 (`node`) : `sudo chown -R 1000 data`.

## Déploiement AWS (plus tard)

SQLite suffit tant qu'une **seule instance** écrit dans la base.

- **Calcul** : ECS Fargate avec 1 tâche et un volume **EFS** monté sur `/data`. App Runner est plus simple mais sans volume persistant : possible seulement si la base est restaurée depuis S3 au démarrage (Litestream).
- **Sauvegardes** : [Litestream](https://litestream.io) en sidecar, réplication continue de `loila.db` vers **S3**.
- **Secrets** : `OPENROUTER_API_KEY` dans SSM Parameter Store ou Secrets Manager, injectée en variable d'environnement.
- **Mise à jour des textes** : tâche planifiée **EventBridge Scheduler → ECS RunTask** chaque nuit avec l'image `tools` (`npm run ingest`), sur le même volume.
- **Image** : cible `runner` poussée sur ECR.
- **Postgres** (RDS, + `pgvector` pour la recherche sémantique) seulement quand il faudra plusieurs instances. Pas avant.
