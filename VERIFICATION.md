# Vérification DeckChef — 16 novembre 2026

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
