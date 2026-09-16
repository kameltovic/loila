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

`npm run check` lance la vérification des types et le self-check de la cascade.

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
