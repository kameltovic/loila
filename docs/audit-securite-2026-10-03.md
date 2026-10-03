# Audit de sécurité de loila.fr — 3 octobre 2026

## Résumé

- Le code de Loilà était déjà solide : aucun secret publié, connexion et paiements bien protégés, `/admin` invisible pour les autres.
- Il manquait la « ceinture de sécurité » du navigateur : aucun en-tête de sécurité HTTP. C'est corrigé et en ligne depuis le commit `a3ccc05`.
- Il reste 3 réglages à faire dans des tableaux de bord (Coolify ou le serveur, Mapbox, Cloudflare) : voir la checklist.

**Score : 6/10 avant → 8,5/10 après.**
Avant, l'application elle-même était bien construite (8/10), mais le navigateur ne recevait aucune consigne de protection, ce qui la laissait exposée à l'affichage piégé dans un cadre et sans filet en cas de faille. Après, toutes les consignes sont en place, avec une CSP stricte. Les 1,5 point restants : le serveur est peut-être joignable sans passer par Cloudflare (non vérifié), la clé Mapbox n'est pas limitée au domaine, et les styles restent autorisés en ligne (`'unsafe-inline'`, risque faible).

## Les problèmes, avant et après

| Problème | En clair | Risque | Avant | Après |
|---|---|---|---|---|
| Aucune CSP | Il n'y avait pas de liste des sources autorisées à charger quelque chose sur les pages | 🟠 | Un script injecté par une faille aurait pu tourner librement | CSP stricte avec nonce : seuls les scripts de Loilà, Umami, Mapbox et le cadastre passent |
| Pas de HSTS | Le navigateur ne retenait pas qu'il faut toujours utiliser HTTPS | 🟠 | Premier passage possible en http (302) | `Strict-Transport-Security` d'un an |
| Affichage dans un cadre possible | Un site piégé pouvait afficher Loilà en transparence pour faire cliquer à ton insu | 🟠 | Aucune protection | `X-Frame-Options: DENY` et `frame-ancestors 'none'` |
| Pas de `nosniff`, `Referrer-Policy` ni `Permissions-Policy` | Protections classiques du navigateur absentes | 🟢 | Absentes | Présentes ; caméra, micro et position désactivés |
| `X-Powered-By: Next.js` | Le site annonçait l'outil qu'il utilise | 🟢 | Visible | Masqué |
| Serveur peut-être joignable sans Cloudflare | Si l'adresse IP du serveur répond directement, on peut contourner Cloudflare et la limite de questions à l'IA | 🟠 | Non vérifié | **À faire toi-même** (checklist) |
| Clé Mapbox utilisable ailleurs | La clé est publique par nature ; n'importe quel site peut la copier | 🟢 | Non limitée | **À faire toi-même** (checklist) |
| `eslint-config-next` : 5 alertes « élevées » | Outil de vérification utilisé seulement sur ton ordinateur, jamais envoyé sur le site | 🟢 | Présentes | Inchangé : à mettre à jour quand une version corrigée sortira |
| `npm install` au lieu de `npm ci` dans le Dockerfile | Le serveur peut installer des versions de bibliothèques légèrement différentes de celles testées | 🟢 | Déjà noté dans le Dockerfile | Inchangé : à faire après avoir régénéré le lockfile sous Linux |

**Déjà bien en place (rien à changer) :**

- aucun secret dans Git, historique compris ;
- cookies `Secure` + `HttpOnly` + `SameSite` ;
- formulaires protégés contre les envois venant d'un autre site (vérification de l'origine) ;
- limites de demandes par visiteur, et plafond quotidien de dépense pour l'IA ;
- signature des webhooks Stripe vérifiée ;
- dossiers accessibles à leur seul propriétaire ;
- `/admin` répond 404 à tous sauf aux adresses de `ADMIN_EMAILS` ;
- CORS fermé ;
- pages privées en `noindex`.

## Ce que tu dois encore faire toi-même

- [ ] **Coolify / serveur : n'accepter que Cloudflare.** Le but est que l'adresse IP du serveur ne réponde pas directement.
  1. Dans Coolify, ouvre l'application loila, puis l'onglet **Configuration → Network**. Vérifie qu'aucun port n'est « publié » vers l'extérieur (le `3000:3000` du `docker-compose.yml` ne doit pas être utilisé en production).
  2. Chez l'hébergeur du serveur (pare-feu Hetzner, OVH…), n'autorise les ports 80 et 443 que pour les adresses de Cloudflare (liste officielle : cloudflare.com/ips). N'oublie pas de garder ton propre accès SSH.
  3. Test : `http://<IP du serveur>` dans un navigateur ne doit plus répondre.
- [ ] **Mapbox : limiter la clé.** Sur account.mapbox.com, va dans **Tokens**, ouvre la clé publique utilisée par le site, et dans **URL restrictions** ajoute `https://loila.fr`. Ajoute aussi `http://localhost:3100` si tu veux garder les cartes en local.
- [ ] **Cloudflare : redirection permanente vers HTTPS.** Dans **SSL/TLS → Edge Certificates**, active **Always Use HTTPS**. La redirection http → https devient alors permanente (301) au lieu de temporaire (302).
- [ ] Plus tard : mettre à jour `eslint-config-next` quand une version corrigée sortira, et repasser le Dockerfile à `npm ci`.
- [ ] Plus tard, si aucun sous-domaine de loila.fr ne sert de pages en http : passer HSTS à `max-age=63072000; includeSubDomains` dans `next.config.ts`.

## Ce qui n'a pas pu être vérifié

- **L'accès direct au serveur sans Cloudflare.** L'adresse IP du serveur est cachée derrière Cloudflare et ne figure pas dans le dépôt.
- **Les réglages internes de Coolify** (ports publiés, accès au tableau de bord Coolify lui-même). Je n'ai pas d'accès à Coolify.
- **Un vrai paiement et un vrai e-mail de connexion.** Je ne les ai pas déclenchés pour ne pas créer de paiement ni envoyer d'e-mail réel. Le passage vers Stripe est une simple redirection, que la CSP ne bloque pas, et les formulaires envoient leurs données au site lui-même.
- **Le comportement dans Safari et Firefox.** Les tests ont été faits dans Chrome.

## Ce qui a changé dans le code

- `src/proxy.ts` : crée un nonce par page et envoie la CSP. Les redirections des anciennes adresses `/article/…` sont conservées.
- `next.config.ts` : ajoute les en-têtes de sécurité et masque `X-Powered-By`.
- `src/app/layout.tsx` : donne le nonce aux scripts Umami.

Pour ajouter un nouveau service externe (vidéo, chat, autre outil de statistiques), il faudra ajouter son adresse dans la fonction `csp()` de `src/proxy.ts`. Sinon, le navigateur le bloquera.

## Petit glossaire

- **En-tête HTTP** : une consigne invisible que le site envoie au navigateur avec chaque page.
- **CSP (Content-Security-Policy)** : la liste des invités autorisés à charger quelque chose sur tes pages. Le reste est refusé à l'entrée.
- **Nonce** : un mot de passe à usage unique, différent à chaque page affichée. Seuls les scripts qui le portent ont le droit de s'exécuter.
- **Script inline** : un bout de code écrit directement dans la page, au lieu d'être chargé depuis un fichier.
- **HSTS** : demande au navigateur de toujours revenir en HTTPS, même si on tape http://.
- **X-Frame-Options / frame-ancestors** : interdit d'afficher le site à l'intérieur d'un autre site, ce qui bloque les clics piégés.
- **CORS** : la règle qui dit quels autres sites ont le droit d'interroger ton API.
- **Cookie Secure / HttpOnly / SameSite** : le cookie de session ne circule qu'en HTTPS, aucun script ne peut le lire, et les autres sites ne peuvent pas s'en servir.
- **Rotation d'une clé** : remplacer une clé secrète par une nouvelle chez le fournisseur, puis désactiver l'ancienne.
- **Cloudflare** : le portier placé devant ton serveur ; tous les visiteurs passent par lui.
- **Coolify** : l'interface qui construit et lance ton site sur le serveur à chaque mise à jour sur GitHub.
- **Lockfile (`package-lock.json`)** : la liste exacte des versions de bibliothèques installées, pour que le serveur installe les mêmes que toi.
