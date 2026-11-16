# DeckChef

Application PWA de recettes en cours d’initialisation (React, TypeScript, Vite, Tailwind, Vitest).

## État réel

L’application visuelle n’est pas encore implémentée. Le cahier des charges impose de connecter GitHub, Supabase et Vercel avant tout composant UI. Le projet Vercel `nygma/deck-recettes` est créé et lié ; GitHub reste à authentifier et le choix du projet Supabase est en attente.

Sont préparés : types des recettes, quatre recettes de départ, dix palettes, préférences `cards | book` persistées entre onglets, schéma SQL public avec Realtime et stockage des photos.

## Commandes

`npm install`, `npm test`, `npm run build`. Après création du dépôt distant : `npm run sync`.

## Supabase

Le schéma préparé dans `supabase/schema.sql` suit l’accès public demandé : toute personne disposant de l’URL et de la clé publique peut lire et modifier la collection. Ne pas l’utiliser pour des données privées sans ajouter d’authentification et des règles de propriété. Aucune clé de service ne doit être exposée au navigateur.

Le script SQL n’a pas encore été appliqué. Les chemins des quatre photos sont réservés ; les fichiers seront ajoutés à l’étape UI.
