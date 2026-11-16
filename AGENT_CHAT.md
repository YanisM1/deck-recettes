# Journal DeckChef (antichronologique)

## 2026-11-16 — Gestes directs, étape 2/3 : Livre et couverture finale

- Étape 1 publiée : commit 22cdd04, déploiement dpl_GABNYS2HFT7yCGC6VR7RoM8aEhPF, READY.
- Livre réécrit autour du moteur direct partagé : rotation perspective(1800px) rotateY de la feuille courante (0→−180°) à gauche, retour de la précédente (−180→0°) à droite. Largeur mesurée hors pointermove et conservée par ResizeObserver ; ombre animée uniquement en transform/opacity.
- Feuilles adjacentes distinctes déjà montées. Recto et verso à backface-visibility:hidden, enveloppe preserve-3d pour conserver le verso visible après 90°. Suppression des anciens keyframes de tourne-page.
- Index N = couverture intérieure cousue aux couleurs du thème, sans tranche papier à la fin ni papier sous la dernière feuille. Bouton Revenir au début du livre et retour inverse de la dernière recette.
- Correction partagée : annulation/capture perdue conserve les dernières coordonnées connues ; capture après intention horizontale et libération d’un geste non horizontal quittant la scène.
- Contrôle réel navigateur 393×852 : gestes natifs dans les deux modes, fins N, retours inverses depuis les fins, remises à zéro. Couverture Chef Crème et OLED inspectées, aucun débordement ni erreur console.
- Boutons latéraux inchangés et rectangles identiques : x=18, y=294,5/376,5/487,5, dimensions 49×70. Les captures QA sont ignorées dans .tools.
- Tests Livre réécrits pour les transforms directes et le ressort 380 ms ; suite de 55 tests et build réussis. Checkpoint complet sans .env.local avant commit/push/déploiement.
## 2026-11-16 — Gestes directs, étape 1/3 : Paquet de Cartes

- AGENTS.md et journal lus ; npm run sync exécuté (origin/main à jour, dépendances installées).
- Nouveau moteur partagé : position, vitesse, intention et RAF dans des refs ; aucun setState dans pointermove. Une seule mise à jour de l’index après le ressort de 380 ms. Nettoyage des temporisateurs/RAF et verrouillage des gestes pendant le ressort.
- Cartes voisines distinctes déjà montées : la courante suit dx vers la droite, la suivante grandit ; le retour ramène la précédente depuis +420 px. Seuls transform 3D et opacity sont animés, avec will-change et backface-visibility.
- Index N réel : carte de fin thémée sous la dernière recette, bouton Revenir au début, retour inverse possible et avance bloquée à la fin. Filtres et marque-pages inchangés.
- Tests ciblés : déplacement exact, couche suivante, zéro commit React pendant le doigt, changement d’index après 380 ms, fin sous la dernière et retour depuis la droite. Vérification complète sans .env.local par le checkpoint avant commit/push/déploiement.
- Les moteurs utilisent requestAnimationFrame à la cadence de l’écran ; aucune mesure 120 Hz sur iPhone physique n’est revendiquée.
## 2026-11-16 — Marque-pages verticaux et placement commun aux Cartes

- AGENTS.md et journal lus ; npm run sync exécuté, dépôt déjà à jour et dépendances installées.
- Périmètre retenu : demande écrite sur les trois marque-pages ; le fichier joint décrivant un moteur d’animation est un chantier distinct, signalé dans la conversation.
- Ruban redessiné verticalement en SVG 49×70, encoche en V en bas et couture en haut. Icônes centrées sans rotation ni marge latérale.
- Suppression des dimensions, marges et coordonnées propres au Livre. Placement commun : left 18 px, top 50 %, translateY(-50 %), gap 12 px ; boutons 49×70 px dans les deux modes.
- Le contour et le remplissage appartiennent au décor SVG, non à un clip-path sur le bouton : toute la zone tactile rectangulaire reste disponible.
- Comparaison navigateur à 393×852 : rectangles exactement identiques, x=18 ; y=294,5 / 376,5 / 487,5 ; mêmes centres d’icônes, transform none. Point dans l’encoche toujours cliquable. Vérification inactive : fond et remplissage rgba(0,0,0,0), icône à 0,5 ; actions des filtres conservées.
- Relecture indépendante en lecture seule des règles CSS et des zones de clic. Tests unitaires existants des boutons et des filtres conservés ; validation complète sans .env.local avant commit/push et déploiement CLI Vercel.

## 2026-11-16 — Contrôle final : carnet à une seule recette

- Étape 3 déployée : dpl_2cNUvDjocT1cWHrAqPQtinBSVvNQ, READY.
- Le journal de l’aperçu a révélé une collision de clés React entre la carte/page et le lecteur lorsque le carnet ne contient qu’une recette. Les clés sont maintenant distinctes par vue.
- Deux tests ciblés vérifient ouverture/fermeture dans les deux modes sans avertissement de clé dupliquée. Suite totale : 53 tests. Nouvelle validation complète sans .env.local, commit/push Git et déploiement final.

## 2026-11-16 — Corrections, étape 3/3 : Gâteau et taille du moule

- Étape 2 publiée : dpl_8xC5b337yyqaGBgruXEdcJfqnAqG, READY.
- Modèle client optionnel isCake/panSize (20|26|28), mapping SQL is_cake/pan_size, conservation dans le cache et la file hors ligne. Désactiver Gâteau retire la taille.
- Formulaire : toggle disponible dans les deux catégories, trois tailles avec 26 cm sélectionné initialement. Badge Moule XX cm sur cartes, pages et lecteur.
- Migration créée par supabase migration new ; CLI whoami sans jeton de connexion, application par la connexion Supabase existante. Ajout de deux colonnes et mise à jour de l’initialisation RPC, sans suppression ni modification des politiques RLS.
- Compatibilité avec ancien schéma : relecture sans les nouvelles colonnes, écriture des champs historiques ; une mutation Gâteau reste locale et en attente jusqu’à migration, y compris après rechargement. Aucune information de moule acquittée puis perdue.
- 51 tests réussis. Contrôle distant réel des tailles 20/26/28 et refus de 22 ; contrôle navigateur de l’édition 28→20, puis relecture Supabase et nettoyage de la seule recette QA. Carnet initial et données des autres applications préservés.
- Audit sécurité sans nouvelle alerte DeckChef ; information préexistante sur kal_health_private.daily hors périmètre (https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- README et VERIFICATION mis à jour ; validation finale et déploiement de cette étape sans .env.local, configuration locale restaurée avant publication. Livraison : https://deck-recettes.vercel.app.

## 2026-11-16 — Corrections, étape 2/3 : boutons à icônes

- Étape 1 publiée : dpl_D3EMZeEhBCj9jHrHiA9o7NQ6pWs4, READY.
- Salé et Sucré remplacés visuellement par des SVG pizza et part de gâteau. Noms accessibles et infobulles conservés, sans texte dans les boutons.
- Les trois boutons ont la même forme : mini-cartes verticales à double bordure en mode Cartes ; rubans à encoche en V, contour SVG et couture en mode Livre.
- Fond actif primaire/secondaire, fond inactif transparent et icône atténuée. Vérification navigateur : rgba(0,0,0,0) après désactivation, forme et filtres opérationnels. Test des icônes et des actions ajouté.

## 2026-11-16 — Corrections, étape 1/3 : plein écran et sens du Livre

- npm run sync exécuté : origin/main à jour, dépendances installées, aucun changement local antérieur.
- Meta viewport conforme à la demande ; html/body/#root à pleine hauteur avec fond --bg-main synchronisé au thème avant peinture. Le conteneur mobile est fixé aux quatre bords, sans limite de 852 px. Le cadre limité reste uniquement dans la preview desktop.
- Contrôle navigateur à 393×852, 402×874, 430×932 et 393×680 : cadre exactement égal au viewport, aucun débordement. En OLED, les quatre fonds sont noirs (#000000), y compris les éléments racines.
- Livre : glisser ou défiler vers la gauche avance ; vers la droite revient. La page correspondante utilise la rotation sortante 0→−180° ou sa rotation de retour, avec l’ombre associée. Boutons et clavier gardent leur sens sémantique. Sens des Cartes conservé.
- Tests des deux sens du swipe et de la molette mis à jour, ainsi que propagation du fond de thème. Validation et déploiement via checkpoint sans .env.local.

## 2026-11-16 — Mode Livre, étape 3/3 : validation finale

- Étape 2/3 déployée : dpl_ctDHyHqKjt7JYQ5PTU9kAMAC8C6T, READY.
- Les vingt combinaisons thème/mode ont été capturées et inspectées à 393 × 852. Aucune largeur débordante ; contenu des pages entièrement visible. Contraste des filtres actifs ≥ 4,60:1, texte/papier ≥ 8,39:1.
- Filtres contrôlés dans les deux modes (4→2→0→2→4), désactivés exactement rgba(0,0,0,0). Persistance de l’expérience et retour arrière vérifiés. Mouvement réduit sans délai de navigation.
- Parcours navigateur réel dans un carnet QA séparé : création, import photo 2400 × 1600, compression JPEG 1000 × 667, rechargement, édition et conservation de la photo. Recette et photo vérifiées dans Supabase ; cinq recettes du carnet QA nettoyées, carnet initial intact.
- Supabase Realtime vérifié entre deux clients réseau indépendants. Endpoint widget testé en production avec code absent puis code QA : réponse correcte pour cinq recettes, no-store. Scriptable et caméra physique non exécutés sur iPhone réel.
- 35 tests couvrent préférences, filtres, CRUD, offline, gestes, tourne-page, formulaires et widget. Contrôle final sans .env.local inclus dans la publication de cette étape ; fichier local restauré automatiquement avant le push et le build distant.
- Sources formatées pour la reprise ; README.md et VERIFICATION.md décrivent usage, preuves et limites. .vercelignore exclut explicitement fichiers de connexion, clés, outils et captures QA.
- Livrables : https://deck-recettes.vercel.app ; https://github.com/YanisM1/deck-recettes ; Supabase https://supabase.com/dashboard/project/miltqwovqupvnaibjdgc.
- Les tables et données des deux applications existantes sont conservées. Authentification GitHub par gh puis commits/push via git, sans plugin GitHub ni reset --hard.

## 2026-11-16 — Mode Livre, étape 2/3 : livre et tourne-page

- Composant RecipeBook dédié : reliure avec couture, couverture, tranche de pages à droite et en bas, photo encadrée, titre Serif, aperçu des ingrédients, ornement et pagination.
- Tourne-page 3D avec perspective 1400 px, origine left center et rotation 0 à -180 degrés. Recto/verso et ombre mobile sur la page du dessous ; mouvement inverse pour revenir. Glissement, défilement horizontal, clavier et coins de page accessibles.
- Lecture plein écran adaptée au livre : papier texturé clair/sombre, reliure, photo encadrée et typographie de manuel de cuisine. Checklist et actions finales conservées.
- Test d’animation avant/arrière, pagination et ouverture de la recette active ajouté. Harmonisation finale et vérification des vingt combinaisons thème/mode à l’étape 3/3.

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
