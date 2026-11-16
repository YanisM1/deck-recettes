# DeckChef

PWA personnelle de recettes en français : React, TypeScript, Vite, Tailwind, Vitest et Supabase.

Les cartes et les pages suivent le doigt via des références DOM et requestAnimationFrame, puis se posent avec une transition CSS de 300 ms. Les éléments et images déjà affichés sont conservés lorsqu’ils changent de place. Aucun état React ni calcul de géométrie DOM n’est utilisé pendant le glissement. En Cartes, glisser vers la droite écarte la recette et vers la gauche ramène la précédente depuis la droite. En Livre, glisser vers la gauche tourne la feuille, vers la droite la rabat depuis la reliure.

Après la dernière recette, une vraie carte de fin ou une couverture intérieure cousue apparaît. Le bouton central revient au début ; le geste inverse ramène la dernière recette. Les trois boutons à gauche conservent le même emplacement dans les deux modes, avec rubans verticaux et icônes droites dans le Livre.

Le formulaire propose « C’est un gâteau / moule » dans les deux catégories, puis 20, 26 ou 28 cm. Un badge « Moule 26 cm » apparaît sur carte, page et lecteur. Ces informations sont conservées localement et synchronisées dans `is_cake` / `pan_size`. Une ancienne base sans ces colonnes reste lisible : les recettes ordinaires se synchronisent, les informations de moule restent dans la file locale jusqu’à la migration.

## Application

- Production : https://deck-recettes.vercel.app
- Dépôt : https://github.com/YanisM1/deck-recettes
- Supabase : https://supabase.com/dashboard/project/miltqwovqupvnaibjdgc

Dans Réglages, choisissez **Paquet de cartes** ou **Livre de recettes**, puis l’une des dix palettes. Le choix est conservé et diffusé entre onglets. Le livre possède une reliure, une tranche de pages, une photo encadrée et un tourne-page 3D. Les filtres Salé/Sucré sont indépendants et cumulatifs.

La lecture complète présente la photo, les ingrédients cochables, les étapes numérotées, puis Modifier/Supprimer au bas du défilement. Le formulaire en trois parties accepte la photothèque et l’appareil photo, avec compression JPEG à 1000 px maximum et qualité 0,75.

## Commandes

`npm install`, `npm run dev`, `npm test`, `npm run build`. `npm run sync` effectue `git pull origin main && npm install`.

Les tests et le build fonctionnent sans `.env.local` : le carnet utilise alors uniquement localStorage. Pour le cloud, configurez les deux variables publiques de `.env.example`. Aucune clé de service n’est utilisée. `scripts/checkpoint.ps1 -Message "..."` lance tests, build, commit, push Git et déploiement Vercel. La connexion GitHub utilise la CLI `gh` ; les publications passent par `git`.

## Données et synchronisation

La limite de deux projets Supabase gratuits empêchait d’en créer un troisième. DeckChef ajoute uniquement `recipes` et `recipe_collections` au projet existant. Les tables, politiques et données des autres applications sont conservées.

Chaque carnet reçoit un code privé aléatoire de 64 caractères. Les règles RLS n’autorisent que les lignes dont le code correspond à l’en-tête `x-deckchef-key`. Copiez ce code dans Réglages, puis ouvrez le même carnet sur l’autre appareil. Toute personne possédant ce code peut accéder à ce carnet : conservez-le pour vous.

Le store sauvegarde d’abord localement et conserve une file d’opérations en attente. Il reprend après rechargement, retour réseau, focus et visibilité. Realtime Broadcast transmet uniquement des invalidations sur un canal dérivé par SHA-256 ; les données sont relues avec les règles privées. Les JPEG compressés sont stockés avec leur recette et protégés de la même façon. Un quota local plein provoque une erreur explicite avant la sauvegarde.

Quatre exemples apparaissent à la première ouverture. Le Reset Total nécessite deux confirmations et vide uniquement le carnet courant. Un carnet vidé reste vide, même sur un nouvel appareil.

## iPhone, PWA et widget

Cadre de référence demandé : 393 × 852 CSS px ; zones sûres minimales de 59 px en haut et 34 px en bas. Le téléphone utilise le viewport dynamique entier ; le cadre est centré sur ordinateur. Les modales sont centrées et le lecteur défile verticalement.

Dans Safari : **Partager → Sur l’écran d’accueil**. Le service worker conserve les fichiers de l’application et les photos de démonstration pour le hors ligne ; il ne met en cache aucune API ni donnée Supabase.

Les réglages permettent de copier un script Scriptable personnel pour le widget iPhone. Il appelle `/api/widget-status` avec le code privé en en-tête et dispose d’un accès Supabase direct de secours si Vercel demande une connexion. La protection Vercel existante reste active ; une connexion Vercel peut être demandée à l’ouverture du site.

## Vérifications et limites

Tests : préférences, modes, navigation, gestes, filtres cumulables dans les deux modes, création/édition, checklist, confirmations, file hors ligne, quota et widget. Les scripts `verify-supabase.mjs` et `verify-realtime.mjs` réalisent les contrôles distants explicites avec `.env.local`.

La navigation est vérifiée sur des paquets de 1 et 4 recettes jusqu’à l’index N, avec retour inverse et remise à zéro. Les tests Profiler confirment l’absence de rendu React pendant les mouvements. Les seuils de distance/vitesse, le mouvement réduit et les annulations sont couverts. requestAnimationFrame suit la cadence disponible : aucune mesure de 120 images/s sur un iPhone physique n’a été effectuée.

Vérification navigateur à 393 × 852 des vingt combinaisons thème/mode, du centrage et de l’absence de débordement. Une photo de test 2400 × 1600 a été compressée dans le navigateur en JPEG 1000 × 667, puis retrouvée dans Supabase après rechargement et modification. Aucun essai physique de l’appareil photo, de l’installation iOS ou de Scriptable sur un iPhone réel n’a été effectué.

Journal : `AGENT_CHAT.md`. Crédits des photos : `public/photos/CREDITS.md`.
