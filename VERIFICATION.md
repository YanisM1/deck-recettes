# Vérification DeckChef — 16 novembre 2026

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
