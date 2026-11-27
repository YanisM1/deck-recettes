# DeckChef — consignes du dépôt

Lire `AGENTS.md` et `AGENT_CHAT.md` avant tout travail. Sur un clone existant, démarrer par `npm run sync` (pull de main puis installation). Préserver les changements locaux. Ne jamais utiliser `git reset --hard`.

## Produit

- PWA française React, TypeScript et Vite. Cible iPhone 16 Pro à 393 × 852 CSS px et interface responsive. Utiliser le viewport dynamique avec `viewport-fit=cover`. Respecter la Dynamic Island et le Home Indicator avec des zones sûres minimales de 59 px en haut et 34 px en bas. Centrer les dialogues avec `margin: auto`.
- Cartes par défaut et mode Livre dans tous les thèmes. Filtres Salé et Sucré indépendants et cumulatifs, préférences persistées et synchronisées entre onglets. Aucun menu de navigation à l’écran principal.
- CRUD complet, sauvegarde locale et file de synchronisation. Deux confirmations pour le Reset Total du seul carnet courant. L’application fonctionne en `localStorage` sans configuration du serveur.

## Production Oracle

- Application HTTPS : https://recipe.84.235.237.224.sslip.io/
- Portail global : https://portail.84.235.237.224.sslip.io/
- Supabase Recipe auto-hébergé : https://supabase-recipe.84.235.237.224.sslip.io/ (REST sous `/rest/v1/`).
- SSH : `ubuntu@84.235.237.224`. Clé privée locale `_migration_oracle/ssh-key-2026-11-25.key`. Kit partagé `_migration_oracle/deploy/`, actuellement dans le dossier parent du clone. Vérifier la clé d’hôte avec `deploy/known_hosts`.
- VM Oracle Cloud Always Free Ampere A1, Ubuntu 26.04, ARM64 (`aarch64`), 2 OCPU et 12 Go de RAM. Docker Compose avec `restart: unless-stopped`. Caddy fournit HTTPS avec sslip.io et Let's Encrypt. Supabase utilise une stack ARM64 allégée.
- DeckChef utilise uniquement `public.recipes`, `public.recipe_collections` et ses fonctions dédiées. Préserver les codes privés de 64 caractères et l’en-tête `x-deckchef-key`, RLS et l’isolation des carnets. Realtime transporte des invalidations sans données. Interdiction de toucher aux tables, conteneurs ou configurations KAL.
- `deckchef.js` utilise uniquement l’application Oracle et Supabase Recipe Oracle pour les API et données du carnet.
- `GEMINI_API_KEY` et les secrets Supabase restent dans les fichiers `.env` de déploiement Oracle. Seuls l’URL et la clé publique anon/publishable peuvent être compilés côté client. Exclure les secrets, `_migration_oracle/`, `*.key`, `*.pem`, `.env*` privés et `gemini-key.txt` de Git.
- Le dump quotidien tourne à 02h13 UTC dans `/var/backups/oracle-apps/`. Préserver le cron et le dossier.

## Livraison par étape

1. Exécuter `npm test && npm run build`. Les deux commandes doivent réussir sans `.env.local` ni accès SSH pour Google Jules.
2. Ajouter un point antichronologique à `AGENT_CHAT.md` avec les résultats et l’état du déploiement Oracle.
3. Vérifier les fichiers indexés, puis `git add . && git commit -m "..."` et `git push origin main`. Utiliser Git, sans plugin GitHub. Identité locale `YanisM1 <YanisM1@users.noreply.github.com>`. GitHub sert au versioning et ne déclenche aucun déploiement.
4. Si le jalon modifie le code exécuté, le SQL ou les variables de production, le déployer uniquement sur Oracle. Appliquer le SQL DeckChef examiné sur la base Recipe, et préparer les seules variables Recipe si nécessaire. Pour l’application, transférer une archive du commit suivi par Git dans `/opt/oracle-apps/source/recipe.tar`, puis exécuter `cd /opt/oracle-apps && bash ./build-apps.sh recipe`. Vérifier l’image `linux/arm64`, le conteneur `Up` et HTTPS sur l’application. Ne jamais lancer le script sans le filtre `recipe`.
5. Si le poste n’a pas le kit et la clé SSH, garder le push Git et signaler, sous `## 💬 Questions / Blocages / Messages entre agents`, que le déploiement Docker Oracle doit être fait depuis Codex local.

Toute commande de déploiement de l’ancien hébergeur et tout accès à l’ancienne base managée sont interdits.
