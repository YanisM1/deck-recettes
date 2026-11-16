# Vérification DeckChef — 16 novembre 2026

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
