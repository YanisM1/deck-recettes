# Journal DeckChef (antichronologique)

## 2026-11-16 — Étape 2 : PWA, calibration et dix thèmes

- Étape 1 déployée : https://deck-recettes.vercel.app (dpl_7MsuyCHJMSbWXfCQ6aMBNu6AsHm7, READY).
- Cadre desktop 393 × 852 (réduit en hauteur uniquement pour les petites fenêtres), iPhone 100vw × 100dvh ; minima de safe areas 59/34 px et viewport-fit=cover.
- Réglages natifs dialog centrés, dix palettes exactes et couleurs de texte calculées selon la luminance des accents.
- Manifest, icônes PNG Apple/Android et service worker à cache versionné généré lors du build ; aucune réponse API ou Supabase mise en cache.
- Tests de sélection de palette et fermeture de la modale ajoutés. Procédure reproductible scripts/checkpoint.ps1 : tests, build, commit, push Git, déploiement CLI Vercel.

## 2026-11-16 — Étape 1 : infrastructure connectée

- Préférence utilisateur : aucun plugin GitHub. Connexion gh auth login validée pour YanisM1 ; dépôt public créé selon la commande --public explicitement demandée. Push Git initial effectué et npm run sync exécuté avec succès.
- GitHub : https://github.com/YanisM1/deck-recettes
- Supabase refuse un troisième projet gratuit (limite de deux). Réutilisation additive de miltqwovqupvnaibjdgc, conformément à la demande de conserver les deux projets et leurs données.
- Le contrôle automatique a refusé les écritures publiques non restreintes dans le projet partagé. Alternative appliquée : nouvelle table recipes isolée par un code privé de carnet (64 caractères), RLS par en-tête x-deckchef-key, photos compressées dans la ligne. Aucune modification des tables ni politiques des autres applications.
- Contrôle des volumes avant/après : health_sync 18, daily_health_sync 19, app_sync 1, weekly_boss_assignments 3. Données préservées.
- Migration deckchef_private_recipes appliquée ; schéma suivi dans supabase/schema.sql. Audit de sécurité : aucune alerte DeckChef (une information préexistante sur kal_health_private.daily, hors périmètre).
- Vercel CLI reconnectée ; cible inspectée nygma/deck-recettes. Variables publiques Supabase configurées dans les trois environnements, .env.local ignoré par Git.
- Tests et build du squelette : 9 tests, succès ; premier écran React d’initialisation ajouté pour le déploiement de l’étape.

## 2026-11-16 — Squelette vérifié, prérequis d’infrastructure en attente

- `npm test` : 9/9 tests réussis (préférences, bascule cards/book, persistance, synchronisation entre onglets, dix thèmes et filtres cumulables).
- `npm run build` : succès sans `.env.local`. `npm audit` : zéro vulnérabilité après installation propre de Vite 8.3.8 et Vitest 5.1.0.
- Git configuré localement pour YanisM1. CLI GitHub officielle téléchargée dans `.tools/gh` (ignorée par Git) : `gh auth status` confirme l’absence de session.
- CLI Vercel 65.16.0 disponible via `npm exec --package=vercel -- vercel` ; `whoami` confirme la session yanismengouchi1-8205. Lien local `.vercel/project.json` vers `nygma/deck-recettes` enregistré.
- Supabase : `YanisM1's Org` (zbvcnmlayxmrvgulbasi) possède deux projets utilisés ; décision demandée entre projet dédié et réutilisation de YanisM1's Project. Aucune migration ni donnée distante modifiée.
- Schéma SQL, types, données de départ, moteur des dix palettes et store des préférences préparés. Photos pas encore ajoutées.
- Aucune étape applicative déclarée terminée : aucun composant UI écrit, pour respecter l’infrastructure obligatoire avant UI. Le point d’entrée technique est volontairement vide. Aucun déploiement d’application réalisé.
- Reprise : confirmer le projet/organisation Supabase et connecter GitHub, créer/lier le dépôt distant, appliquer le schéma sur le projet choisi, configurer les variables Vercel, puis réaliser les six étapes de base et les trois étapes Livre avec tests/commit/push/déploiement à chaque étape.

## 2026-11-16 — Initialisation et vérification des accès

- Dossier initial vide : aucun AGENTS.md, AGENT_CHAT.md, package.json ou dépôt à synchroniser.
- Les deux demandes sont cumulées : application DeckChef complète puis mode Livre en trois étapes.
- Supabase connecté via le plugin ; projets existants inspectés, aucune table modifiée. Choix de l’organisation/projet demandé avant provisionnement.
- Vercel : équipe Nygma, projet deck-recettes créé (prj_tMhw90UIqDds3teULAAFqFpLXkZY).
- CLI gh, supabase, vercel absentes ; plugin GitHub proposé. Dépôt Git local initialisé sur main.
- Priorité infrastructure respectée avant tout composant UI. Déploiements et push nécessitent encore les accès correspondants.
