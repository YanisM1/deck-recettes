# Vérification DeckChef — 19 novembre 2026

## Analyse Gemini et recettes composites

- Suite finale : 199 tests dans 30 fichiers. Analyse serveur/client, réponses incohérentes, délai, autorisation, annulation, invalidation des anciens résultats, persistance et compatibilité avec l’ancien schéma sont couverts. Le checkpoint final exécute les tests et le build sans `.env.local`, puis restaure le fichier.
- Appels Gemini réels réussis depuis le serveur local et l’API de production, avec `gemini-3.5-flash-lite`. La production a renvoyé HTTP 200 pour une recette synthétique : 1565 kcal, 430 g cuits et ~196 kcal par huitième. Le résultat est estimatif ; il ne constitue pas une mesure nutritionnelle exacte.
- Migrations additives appliquées après l’autorisation explicite de modifier les seuls champs DeckChef demandés. Contrôle réseau réel dans deux carnets QA neufs, avec les mêmes UUID : initialisation et sauvegarde/relecture des portions, du moule, des analyses et des liens ; total combiné 500 puis 550 kcal/part après modification ; aucun accès croisé ni lecture sans en-tête. Auto-liaison, doublon et UUID invalide rejetés par la contrainte SQL.
- La suppression d’un composant QA masque le faux total sans affecter l’autre carnet. Les quatre recettes créées pour ce contrôle ont été nettoyées ; seuls les marqueurs de carnets QA vides restent. Aucune politique d’accès ni table d’une autre application modifiée.
- Fusion : sections, étapes et assemblage, cycles, composants absents, analyses périmées et graphes avec préparation commune testés. Une estimation composite n’est pas réadditionnée comme analyse de base. Les copies autonomes conservent leurs calories à la réouverture, pour gâteau et plat, sans réactiver ce double comptage.
- Parcours réel à 393 × 852, isolé du cloud : création d’une ganache et d’un gâteau, deux analyses Gemini réussies, liaison dans le formulaire, badge combiné ~283 kcal/part. À 4 personnes au lieu de 2, 200 g de farine deviennent 400 g et les 100 g de chocolat/crème deviennent chacun 200 g ; le total passe à ~565 kcal/part. L’export photo reprend 4 personnes et 565 kcal/part.
- Badges vérifiés sur les Cartes et les pages du Livre. Aucun débordement horizontal ni avertissement/erreur de console pendant le parcours. Captures ignorées : `.tools/composite-reader-393.jpg`, `.tools/composite-cards-393.jpg`, `.tools/composite-book-393.jpg` ; résultats distants sans secret dans `.tools/composite-live/result.json` et `.tools/gemini-prod-qa-summary.json`.
- Clé Gemini conservée côté serveur et exclue de Git/Vercel pour le fichier local ; contrôle du bundle final avant publication. Le partage composite est autonome et ne donne aucun accès aux recettes privées. Les liens synchronisés ordinaires conservent le contrat historique de leur RPC ; les copies autonomes et photos incluent les nouvelles métadonnées.
- Limite matérielle inchangée : navigateur de bureau au viewport demandé, sans essai Safari sur iPhone physique ni mesure de 120 Hz.

## Reconstruction du swipe au doigt

- 108 tests dans 15 fichiers. Avant correction, la séquence Pointer tactile + Touch + perte de capture enfant reproduisait l’échec dans les deux modes (index restait à 0). La même séquence passe après reconstruction.
- Événements touchstart/touchmove/touchend/touchcancel natifs, touchmove explicitement passive:false. Le contact est suivi par identifier ; aucun setPointerCapture, aucun transfert ni annulation provoquée par lostpointercapture. Les événements Pointer tactiles de compatibilité sont ignorés par ce chemin.
- Référence du diagnostic : [capture implicite tactile, W3C](https://www.w3.org/TR/pointerevents3/#implicit-pointer-capture). Les tests distinguent maintenant annulation réelle et simple changement de capture.
- Les 14 régressions tactiles couvrent le suivi sans rendu React, la prévention du scroll horizontal, l’intention verticale, le tap simple, plusieurs doigts, l’annulation, les dernières coordonnées sans frame intermédiaire, la fin et son retour inverse depuis le bouton central, ainsi que le démontage.
- Navigateur Chromium : un banc local ignoré dispatchant des TouchEvent et Touch réels, avec Pointer de compatibilité et pertes de capture intercalées, a parcouru 0→1→0→1→2→3→4→3→4→0 dans chaque mode. preventDefault=true pendant chaque déplacement horizontal ; transformations intermédiaires capturées, clic généré bloqué et boutons de reset fonctionnels. Ce contrôle synthétique ne remplace pas un essai matériel Safari/iPhone.
- Contrôle séparé souris/flèche dans l’application, console sans erreur et cadre 393×852 inchangé. Traces ignorées : .tools/touch-cards-result.txt et .tools/touch-book-result.txt ; capture .tools/touch-book-393.jpg.
- requestAnimationFrame suit la fréquence disponible et écrit uniquement les transforms/opacity des couches, sans état React par frame. Aucune mesure ni garantie matérielle de 120 images/s n’est revendiquée.

## Navigation directe et vrais états de fin

- 94 tests réussis dans 14 fichiers ; build TypeScript/Vite réussi, avec validation sans .env.local.

- Les deux vues utilisent useDirectNavigation : geste en refs et écritures regroupées par requestAnimationFrame. Transition CSS ease-out de 300 ms, finalisation unique sur transitionend de la couche principale, délai de secours si cet événement manque. Les tests Profiler mesurent zéro commit pendant le déplacement et un seul à la validation.
- Clés stables par recette et couche Livre identique quel que soit son rôle : les tests conservent l’identité des nœuds et des images au passage suivant/précédent. Deux frames séparent la pose initiale du démarrage CSS, sans mesure forcée du DOM ni ResizeObserver.
- Cartes : suivi direct de dx, sortie à 150 % de la largeur ; la suivante grandit et la précédente revient depuis la droite. Livre : une seule perspective 1800 px et rotateY autour de la reliure ; aucune opacité sur le conteneur preserve-3d.
- Cadre fixed/inset:0, 100vw×100dvh, flex column et padding des zones sûres. La scène occupe l’espace restant avec min-height:0. À 393×852 : cadre 0,0,393,852, paddings 59/34 px, boutons inchangés. À 393×680 : aucun débordement ni chevauchement de la couverture avec l’introduction ; remise à zéro au-dessus des coins de navigation.
- Défaut reproduit puis corrigé : un clic réel immédiatement après swipe pouvait être bloqué par la protection du clic généré. Un nouveau pointerdown intentionnel lève cette protection ; régression couverte dans les deux modes. Sélection de texte désactivée sur le Livre pendant le geste.
- Fins réelles à l’index N, placées sous la dernière recette : carte thémée ou couverture cousue sans feuille/tranche papier. Avance interdite à N, retour inverse vers N−1 et bouton de remise à zéro. Tests avec 1 et 4 recettes dans les deux modes.
- Seuils stricts >65 px ou >0,35 px/ms, petit geste lent annulé, flick rapide accepté, vitesse ancienne abandonnée après pause. Annulation sans coordonnées, capture perdue, pointeur secondaire, intention verticale, doubles commandes, molette/clavier, mouvement réduit et démontage couverts.
- Build de production local sans environnement cloud : gestes natifs avant/arrière dans les deux modes ; fins, retours inverses et remises à zéro confirmés. Séquence swipe/retour/clic immédiat rejouée avec succès. Couverture en Chef Crème et OLED Black & Gold inspectée ; aucun débordement horizontal ni erreur console. Rectangles des boutons identiques aux coordonnées ci-dessous.
- Validation complète sans .env.local à chacune des trois publications. Limite : navigateur de bureau au viewport demandé ; ni mesure 120 Hz ni essai Safari sur iPhone physique. Aucun changement de données Supabase pendant ce chantier.

## Marque-pages verticaux alignés aux Cartes

- À 393×852, les deux modes partagent les trois rectangles (x=18, y=294,5/376,5/487,5, largeur=49, hauteur=70). Aucun déplacement à la bascule.
- Colonne à top:50%, gap:12px et translateY(-50%) communs, séparateur compris. Les centres des SVG sont exactement identiques ; aucune rotation appliquée aux icônes.
- Rubans verticaux avec encoche en V en bas ; le bouton conserve sa zone tactile rectangulaire entière (contrôle elementFromPoint au niveau de l’encoche).
- Filtre désactivé : fond et remplissage SVG transparents, contour conservé et icône atténuée. Les trois actions et les filtres cumulatifs restent couverts par la suite Vitest.

## Corrections plein écran, icônes et moules

- Après mise à jour : 53 tests réussis, avec contrôle final sans `.env.local`, dont ouverture/fermeture d’un carnet à une seule recette sans collision de clés React.
- Plein écran vérifié aux dimensions 393×852, 402×874, 430×932 et 393×680 : cadre (0,0,largeur,hauteur), aucune largeur débordante. Fonds html/body/#root/conteneur noirs en OLED et accordés au thème clair.
- Livre : swipe et molette vers la gauche avancent, vers la droite reviennent. La rotation sortante ou entrante et son ombre suivent la page correspondante ; sens des Cartes préservé.
- Filtres SVG sans texte visuel, noms accessibles conservés. Trois mini-cartes verticales à double bordure ou trois rubans à encoche en V. Fond inactif réellement transparent après la transition.
- Sélecteur Gâteau accessible en Salé comme en Sucré ; tailles 20/26/28 testées, désactivation sans taille résiduelle, badge sur les trois vues.
- Test Supabase réel : initialisation RPC avec gâteau, enregistrement/relecture des trois diamètres, contrainte rejetant 22 cm. Modification navigateur de 28 à 20 cm retrouvée en base, puis nettoyage de la seule recette temporaire de test.
- Compatibilité testée : anciens caches, lecture d’un schéma sans les colonnes, écritures ordinaires compatibles, conservation du moule dans la file après rechargement et envoi après migration.
- Migration additive limitée à recipes et deckchef_initialize ; règles d’accès et données des autres applications préservées. Fichier créé avec la CLI ; application via la connexion Supabase existante car la CLI n’était pas authentifiée.
- Limite : vérification dans le navigateur, pas sur un iPhone physique.

## Résultats

- 35 tests unitaires et d’intégration UI réussis.
- Cadre et viewport navigateur 393 × 852, aucune largeur débordante.
- Réglages centrés à x = 196,5 et y = 426 ; largeur 361 px, hauteur bornée aux zones sûres.
- Vingt captures inspectées : les dix thèmes en modes Cartes et Livre. Le contenu de chaque page tient dans le cadre.
- Contraste calculé à partir des styles réellement rendus : boutons de filtre actifs ≥ 4,60:1 ; texte/papier du livre ≥ 8,39:1.
- Filtres indépendants dans les deux modes : 4 → 2 → 0 → 2 → 4 recettes ; fond désactivé exactement rgba(0,0,0,0).
- Tourne-page : perspective calculée 1400 px, origine x = 0, recto/verso et ombre mobile. Tests des coins, swipe, molette horizontale, clavier et mouvement réduit.
- Création réelle depuis le navigateur avec photo JPEG : 2400 × 1600 → 1000 × 667 par canvas. Recette et photo retrouvées après rechargement, puis après modification dans Supabase.
- Confirmation de suppression et double confirmation du Reset vérifiées sans effacer le carnet initial.
- Lecture, insertion, modification et suppression autorisées au propriétaire ; accès croisé entre deux carnets bloqué par RLS.
- Invalidation Supabase Realtime reçue par un deuxième client réseau indépendant.
- Endpoint widget testé en production : code absent rejeté, code de carnet QA accepté (5 recettes), aucun cache partagé.
- Les cinq recettes du carnet navigateur QA ont été nettoyées après contrôle. Les marqueurs d’initialisation QA vides sont sans données personnelles.
- Tables des applications précédentes inchangées par toutes les migrations et opérations DeckChef.

## Portée

Les contrôles ont été réalisés avec un navigateur de bureau au viewport demandé et avec le projet Supabase réel. L’appareil photo physique, l’installation sur l’écran d’accueil iOS et l’exécution de Scriptable n’ont pas été testés sur un iPhone réel. La protection Vercel de connexion est conservée ; le widget a un accès direct Supabase de secours.
