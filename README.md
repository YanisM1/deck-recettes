# DeckChef

PWA personnelle de recettes en français : React, TypeScript, Vite, Tailwind, Vitest et Supabase.

Les cartes et les pages suivent le doigt via des références DOM et requestAnimationFrame, puis se posent avec une transition CSS de 300 ms. Les éléments et images déjà affichés sont conservés lorsqu’ils changent de place. Aucun état React ni calcul de géométrie DOM n’est utilisé pendant le glissement. En Cartes, glisser vers la droite écarte la recette et vers la gauche ramène la précédente depuis la droite. En Livre, glisser vers la gauche tourne la feuille, vers la droite la rabat depuis la reliure.

Le doigt utilise des événements Touch natifs, avec un écouteur touchmove non passif et un seul identifiant de contact. Aucun transfert de capture Pointer n’est nécessaire. Les événements Pointer de compatibilité ne doublent pas le geste. Souris/stylet suivent un chemin distinct ; flèches, clavier et molette restent disponibles. Un swipe peut aussi commencer sur le bouton central de la carte/couverture finale, tout en conservant le toucher simple pour revenir au début.

Après la dernière recette, une vraie carte de fin ou une couverture intérieure cousue apparaît. Le bouton central revient au début ; le geste inverse ramène la dernière recette. Les trois boutons à gauche conservent le même emplacement dans les deux modes, avec rubans verticaux et icônes droites dans le Livre.

Le formulaire propose le moule d’origine 20, 26 ou 28 cm pour le sucré ; le salé peut aussi activer « C’est un gâteau / moule ». Un badge « Moule 26 cm » apparaît sur carte, page et lecteur. Ces informations sont conservées localement et synchronisées dans `is_cake` / `pan_size`. Une ancienne base sans ces colonnes reste lisible : les recettes ordinaires se synchronisent, les informations de moule restent dans la file locale jusqu’à la migration.

## Application

- Production : https://recipe.84.235.237.224.sslip.io/
- Dépôt : https://github.com/YanisM1/deck-recettes
- Supabase : https://supabase-recipe.84.235.237.224.sslip.io/rest/v1/

Dans Réglages, choisissez **Paquet de cartes** ou **Livre de recettes**, puis l’une des dix palettes. Le choix est conservé et diffusé entre onglets. Le livre possède une reliure, une tranche de pages, une photo encadrée et un tourne-page 3D. Les filtres Salé/Sucré sont indépendants et cumulatifs.

La lecture complète présente la photo, les ingrédients cochables, les étapes numérotées, puis Modifier/Supprimer au bas du défilement. Le formulaire en trois parties accepte la photothèque et l’appareil photo, avec compression JPEG à 1000 px maximum et qualité 0,75.

Le formulaire permet de saisir des calories facultatives pour toute recette, sucrée ou salée : **Par part**, **Pour 100 g** ou **Au total**. La valeur reste manuelle ; elle est enregistrée avec la recette et peut être modifiée ou effacée.

Un badge n’apparaît sur les cartes, les pages du Livre et la fiche plein écran que lorsqu’une valeur manuelle existe. Son libellé reprend exactement l’unité choisie : `kcal / part`, `kcal / 100 g` ou `kcal au total`.

Le lecteur propose les portions **1 à 8 personnes** ou les moules **20/26/28 cm**. Les quantités sont adaptées localement ; les calories ne sont jamais calculées à partir de ces variantes. Les œufs et pièces indivisibles restent entiers ; les demis usuels de légumes divisibles sont admis. Les moules suivent leur surface et les proportions sont rééquilibrées autour des œufs entiers.

L’adaptation des quantités fonctionne hors ligne sans clé ni appel réseau. Les anciennes données d’analyse calorique ne sont pas affichées comme des valeurs manuelles. L’enregistrement et la lecture fonctionnent aussi sans variables d’environnement.

**🔗 Lier une autre recette**, replié dans la première partie du formulaire, permet de sélectionner plusieurs préparations du même carnet. Le lecteur conserve leurs sections, enchaîne les étapes puis propose l’assemblage. Chaque préparation est incluse avec toutes ses quantités ; le sélecteur ajuste l’ensemble à partir de sa base. Les quantités sont adaptées localement, sans calcul de calories. Les cycles sont refusés.

Le partage d’une recette du livre global utilise son identifiant dans l’URL. Les variantes adaptées et les recettes locales peuvent être partagées sous forme de copie autonome avec les ingrédients et étapes. Les photos partagées peuvent reprendre une valeur calorique manuelle.

## Commandes

`npm install`, `npm run dev`, `npm test`, `npm run build`. `npm run sync` effectue `git pull origin main && npm install`.

Les tests et le build fonctionnent sans `.env.local` : le carnet utilise alors uniquement localStorage. Pour synchroniser avec Oracle, configurez les deux variables publiques de `.env.example`. Aucune clé de service n’est utilisée. `scripts/checkpoint.ps1 -Message "..."` lance tests, build, commit et push Git. Pour un changement applicatif, appliquer ensuite la procédure Docker Oracle de `AGENTS.md`. La connexion GitHub utilise la CLI `gh` ; les publications passent par `git`.

L’option `-WithoutSecrets` du checkpoint vérifie aussi l’absence de `.env.local` et `gemini-key.txt`, restaure ces fichiers dans un bloc `finally` et contrôle le bundle avant la publication. Un environnement vierge peut simplement lancer `npm test` puis `npm run build`.

Vite expose uniquement les variables `VITE_SUPABASE_`. Aucune clé Gemini ou de service n’est requise pour créer, adapter, enregistrer ou lire des recettes.

## Données et synchronisation

Le livre global est stocké dans `public.recipes_global` sur Supabase Recipe auto-hébergé sur Oracle. Toute personne peut lire, ajouter, modifier ou supprimer les recettes sans connexion. Le Reset Total, protégé par deux confirmations dans l’interface, vide le livre pour tous les visiteurs.

Les recettes et collections historiques restent dans leurs tables privées. La migration `20261127091000_deckchef_global_recipes.sql` crée le livre global et ses droits. `scripts/migrate-global-recipes.sql` copie le carnet sélectionné et contrôle l’intégrité du lot.

L’application charge le livre à l’ouverture, au retour au premier plan, sur `pageshow` et au retour du réseau. Les événements Postgres de Supabase Realtime déclenchent une relecture. Le cache local permet de consulter les dernières recettes lues hors ligne. Les modifications du livre global sont visibles après confirmation du serveur. Les exemples sont réservés au mode local sans configuration Supabase.

## iPhone, PWA et widget

Cadre de référence demandé : 393 × 852 CSS px ; zones sûres minimales de 59 px en haut et 34 px en bas. Le téléphone utilise le viewport dynamique entier ; le cadre est centré sur ordinateur. Les modales sont centrées et le lecteur défile verticalement.

Dans Safari : **Partager → Sur l’écran d’accueil**. Le service worker conserve les fichiers de l’application et les photos de démonstration pour le hors ligne ; il ne met en cache aucune API ni donnée Supabase.

Les réglages permettent de copier le script Scriptable du widget iPhone. Il lit le livre global via `/api/widget-status`, avec un accès direct à Supabase en secours. Pour mettre à jour un widget déjà installé, remplacez le contenu de `deckchef.js` par le script copié depuis les réglages sur Oracle.

## Vérifications et limites

Tests : préférences, modes, navigation, gestes, filtres cumulables dans les deux modes, création/édition, checklist, confirmations, synchronisation du livre global, cache et widget. Vérifier la production avec la REST `/rest/v1/recipes_global` et l’abonnement Realtime de l’application.

La navigation est vérifiée sur des paquets de 1 et 4 recettes jusqu’à l’index N, avec retour inverse et remise à zéro. Les tests Profiler confirment l’absence de rendu React pendant les mouvements. Les seuils de distance/vitesse, le mouvement réduit et les annulations sont couverts. requestAnimationFrame suit la cadence disponible : aucune mesure de 120 images/s sur un iPhone physique n’a été effectuée.

Vérification navigateur à 393 × 852 des vingt combinaisons thème/mode, du centrage et de l’absence de débordement. Une photo de test 2400 × 1600 a été compressée dans le navigateur en JPEG 1000 × 667, puis retrouvée dans Supabase après rechargement et modification. Aucun essai physique de l’appareil photo, de l’installation iOS ou de Scriptable sur un iPhone réel n’a été effectué.

Journal : `AGENT_CHAT.md`. Crédits des photos : `public/photos/CREDITS.md`.
