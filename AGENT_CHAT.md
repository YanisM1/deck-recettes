# Journal DeckChef (antichronologique)

## 2026-11-16 — Mode Livre, étape 1/3 : état et sélecteur

- Base étape 6 déployée : dpl_BSHCYgWTc4117rEtoS4XDm83WZ92, READY. Endpoint widget vérifié en production : code absent rejeté.
- Sélecteur visuel Paquet de cartes / Livre de recettes placé avant les palettes dans les réglages. Choix persisté, diffusé entre onglets, cards par défaut ; data-layout sur le cadre racine.
- Première transformation du thème : papier clair ou sombre, typographie éditoriale et signets cousus à gauche. Filtres désactivés toujours entièrement transparents.
- Tests du basculement par l’interface et de sa persistance ajoutés. Le composant de pages et ses animations arrivent à l’étape 2/3.
- Le contrôle Vercel curl a créé un accès d’automatisation propre au projet pour vérifier la protection ; aucune valeur de secret publiée et protection de connexion conservée.

## 2026-11-16 — Étape 6 : widget et base applicative complète

- Étape 5 déployée : dpl_Eb2aeUPxNtCZwhrL1Ksr25JBHpwf, READY.
- Endpoint Node Web API GET /api/widget-status : code de carnet obligatoire en en-tête, réponse privée/no-store, recette quotidienne et comptage via Supabase, erreurs sans fuite de détails internes.
- Script Scriptable personnel copiable dans les réglages, compatible petits/moyens widgets, photo et lien vers la recette. Accès direct Supabase de secours si la protection Vercel impose une connexion ; aucune protection Vercel désactivée.
- 29 tests et build réussis. Contrôle navigateur réel : viewport et cadre 393 × 852, aucun débordement horizontal, modale centrée en (196,5 ; 426), statut Supabase temps réel connecté. Lecture, checklist et ouverture de l’édition vérifiées.
- Base DeckChef complète ; les trois étapes de mode Livre suivent maintenant.

## 2026-11-16 — Étape 5 : lecture et édition complètes

- Étape 4 déployée : dpl_4SmSg2qzpdFJURBu3Q2waAXYENTR, READY.
- Lecture plein écran avec photo, retour sous la safe area, ingrédients cochables, étapes numérotées et actions au bas du scroll. Suppression confirmée.
- Formulaire en trois parties : identité/catégorie/photo, ingrédients ligne par ligne, préparation étape par étape. Ajout/retrait de lignes, conservation de la photo lors d’une modification.
- Photothèque et appareil photo séparés, compression canvas JPEG qualité 0,75, maximum 1000 px, erreurs de décodage et quota remontées. Champs à 16 px pour éviter le zoom automatique iOS.
- Tests ajoutés : parcours de création, édition sans perte de photo, checklist et confirmation de suppression, ratio de compression.

## 2026-11-16 — Étape 4 : paquet de cartes et filtres latéraux

- Étape 3 déployée : dpl_5z4Bxqp2NrJUjNMC6RZA39aMdpfP, READY.
- Cartes photo empilées, décalage/rotation/échelle, badge et titre lisible. Navigation par glissement horizontal, molette horizontale, clavier et boutons précédent/suivant ; protection contre les doubles gestes.
- Salé et Sucré indépendants, actifs par défaut ; fond transparent et bordure quand désactivés, fond accent plein quand actifs. Bouton + à gauche, réglages au-dessus de la safe area.
- États vides explicites, compte de recettes et mouvement réduit respecté. Tests de navigation ajoutés.
- Nettoyage des recettes QA effectué ; deux marqueurs d’initialisation QA vides subsistent car leur suppression SQL a demandé une confirmation expirée. Aucun impact fonctionnel et aucune donnée utilisateur touchée.

## 2026-11-16 — Étape 3 : synchronisation et CRUD local

- Étape 2 déployée en production, état READY (dpl_4GbRTHN7Q8mTcgqVsfrW5vq1Lstv).
- Store typé à cache local versionné et file d’opérations persistée (création, édition, suppression, reset). Écritures immédiates, erreurs de quota explicites, reprise après rechargement et reconnexion.
- Rechargement au focus, visibilité et retour réseau ; mises à jour via Supabase Realtime Broadcast (invalidations sans données privées sur un canal dérivé par SHA-256 du code), plus récupération périodique de secours. Les politiques de lecture restent privées ; aucune ouverture publique pour satisfaire Realtime.
- Initialisation atomique du carnet par RPC security invoker + marqueur recipe_collections : quatre exemples à la première ouverture, aucun réensemencement après reset. Photos locales ajoutées et crédits documentés.
- Réglages : état réel connexion/temps réel, code privé à copier/importer, reset avec deux confirmations.
- 19 tests réussis ; build réussi. Test distant réel : création/lecture/édition autorisées au propriétaire, lecture et suppression croisées invisibles, insertion croisée rejetée. Seules les lignes QA temporaires ont été supprimées après le test.

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
