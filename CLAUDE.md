# DeckChef — contexte de travail

Appliquer `AGENTS.md`, lire `AGENT_CHAT.md`, puis commencer par `npm run sync`. Préserver les changements locaux. Ne jamais utiliser `git reset --hard`.

- PWA React/TypeScript/Vite, iPhone 16 Pro 393 × 852 CSS px, interface responsive, Dynamic Island et Home Indicator (59/34 px au minimum), dialogues centrés avec `margin: auto`. Modes Cartes et Livre, CRUD et Reset Total à deux confirmations pour le carnet courant, fallback `localStorage`.
- Application : https://recipe.84.235.237.224.sslip.io/. Portail : https://portail.84.235.237.224.sslip.io/. Supabase Recipe : https://supabase-recipe.84.235.237.224.sslip.io/ et `/rest/v1/`.
- Oracle Cloud Always Free, Ampere A1 ARM64 (`aarch64`), Ubuntu 26.04, 2 OCPU, 12 Go RAM. Docker Compose (`restart: unless-stopped`), Caddy et HTTPS sslip.io/Let's Encrypt, Supabase ARM64 allégé.
- SSH `ubuntu@84.235.237.224`, clé locale `_migration_oracle/ssh-key-2026-11-25.key`, kit `_migration_oracle/deploy/` dans le dossier parent du clone sur ce poste. Répertoire serveur `/opt/oracle-apps`.
- Seules `recipes`, `recipe_collections` et les fonctions DeckChef sont dans le périmètre. Préserver les codes privés, `x-deckchef-key`, RLS et Realtime sans données. Ne jamais modifier les tables, conteneurs ou configurations KAL. Sauvegardes automatiques à 02h13 UTC dans `/var/backups/oracle-apps/`.
- Le widget Scriptable `deckchef.js` s’adresse uniquement à Oracle pour l’application et ses données. `GEMINI_API_KEY` et les secrets Supabase restent dans les `.env` Oracle. Ignorer `_migration_oracle/`, `*.key`, `*.pem`, les `.env*` privés et `gemini-key.txt`. Aucune configuration d’un ancien hébergeur ni ancienne base managée.
- À chaque étape : `npm test && npm run build` sans `.env.local` ni SSH, journal antichronologique, `git add .`, commit et push sur `main` sous `YanisM1 <YanisM1@users.noreply.github.com>`. Le push ne déploie rien.
- Pour chaque modification de code exécuté, de SQL ou d’environnement, appliquer les changements Recipe sur Oracle selon `AGENTS.md`. Déployer avec `bash ./build-apps.sh recipe` dans `/opt/oracle-apps` après transfert de l’archive du commit. Vérifier ARM64, état `Up` et HTTPS. Sans kit ou SSH, consigner le relais Docker sous `## 💬 Questions / Blocages / Messages entre agents` dans le journal.
