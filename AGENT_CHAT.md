# Journal DeckChef (antichronologique)

## 2026-11-19 — Nouvelle recette par fusion, étape 2/3 : sélection et édition indépendante

- Dans le formulaire « + », ajout de deux choix en haut : Nouvelle recette et Lier des recettes. L’écran de sélection exige au moins deux sources et garde son bouton désactivé avant ce seuil.
- La sélection préremplit un nouveau brouillon sans identifiant, avec nom éditable, photo vierge et invitation claire à prendre/choisir une photo. L’import et la caméra utilisent le même compresseur canvas JPEG déjà utilisé par les recettes classiques.
- Les ingrédients et étapes sont copiés avec des séparateurs par source ; une étape d’assemblage finale est ajoutée et reste modifiable. Catégorie, gâteau/moule et portions viennent de la recette principale. Les métadonnées IA/calories et les liens privés des sources ne sont pas copiés.
- À l’enregistrement, le nouveau brouillon passe par le stockage ordinaire avec linkedRecipeIds vide. L’App le sauvegarde avant de lancer l’analyse globale existante. Les recettes source restent lues uniquement.
- L’ancien sélecteur de liens a été retiré de la création/édition courante. Les liens des recettes historiques sont conservés lors de l’édition si leurs sources existent encore ; la création par fusion ne crée pas de liaison en arrière-plan.
- Outil pur de fusion testé pour les sections, l’assemblage, le choix de catégorie/moule/portions, l’indépendance et l’absence de mutation des sources. Parcours de sélection/formulaire testé, dont seuil de deux et nouvelle entrée indépendante. Checkpoint de l’étape : 294 tests/43 fichiers réussis, build secretless, commit 063c61f poussé sur main et déploiement dpl_Dc7FVLS4F1SgHEonPueYnYgvnyqu READY. La revue visuelle à 393×852 et le test de l’analyse après enregistrement sont au dernier jalon.

## 2026-11-19 — Validation finale, étape 3/3 : flux complet et responsive

- Test App de bout en bout en mémoire : choix de deux recettes, nouvel intitulé, photo injectée au résultat compressé JPEG, copie sauvegardée/rechargée dans le store local, sources strictement identiques avant/après et demande d’analyse automatique avec tout le contenu assemblé. L’identifiant de la nouvelle recette est distinct et linkedRecipeIds est vide.
- Contrôles d’affichage des calories IA et locale, cause explicite de limite Google vs limite par carnet, quantité par 1/8 ou 100 g, plus contrat CSS de cadre fixed `100vw/100dvh`, safe areas minimales 59/34 px et modales de largeur bornée/marge automatique avec hauteur réservée aux safe areas.
- L’essai de revue visuelle navigateur sur 393×852 n’a pas pu démarrer : `cua.getState()` signale « Local browser access is unavailable for this chat » ; Chrome est absent de l’inventaire du helper. Une tentative de lancement n’a retourné aucun état de fenêtre. Aucune capture ni observation visuelle n’est revendiquée. Le contrat CSS et les parcours jsdom sont couverts par tests.
- Vérification production calories réalisée à l’étape 1 : gâteau Gemini 280 kcal/part sauvegardé/relu ; plat salé repli local 152 kcal/100 g sauvegardé/relu après HTTP504 Google. QA supprimée par identifiant dédié ; les recettes utilisateur n’ont pas été modifiées.
- En attente du checkpoint final automatisé : suite complète `npm test`, `npm run build` sans `.env.local` ni `gemini-key.txt`, analyse de bundle, commit/push et déploiement Vercel.

## 2026-11-19 — Calories et création par fusion, étape 1/3 : diagnostic et réparation

- npm run sync : origin/main déjà à jour ; npm install terminé, aucune vulnérabilité.
- Diagnostic local : api/recipe-ai.ts est bien une fonction Vercel ; aucun vercel.json ni rewrite SPA catch-all ne l’intercepte. Le GET de production renvoie 405 (route atteinte, méthode non gérée), ce n’est pas une réponse HTML du fallback SPA.
- Diagnostic Vercel : GEMINI_API_KEY est présent comme Secret en Production et Preview. gemini-key.txt et .env.local existent et sont ignorés par Git. La clé locale a été validée directement auprès de Google sans afficher sa valeur ; le modèle gemini-3.5-flash-lite figure dans la liste active.
- Diagnostic Supabase distant : la requête PostgREST select=calories_value,calories_unit,calories_note,ai_scaling_data&limit=0 répond HTTP 200. Les quatre colonnes existent ; aucune migration ou modification RLS n’était nécessaire.
- Cause fonctionnelle : recipeAiService masquait tous les HTTP/API/JSON invalides puis produisait le fallback local local-v1, qui ne calculait aucune calorie. RecipeReader indiquait donc « à calculer » sans donner la cause. En plus, l’action de recalcul sautait les composants Gemini déjà frais.
- Correction : estimation locale prudente par ingrédients et unités françaises connus, repérage explicite de la source (IA/locale), explication d’erreur sans transmettre de détails sensibles, et refus d’une valeur locale si un ingrédient calorique est inconnu. Recalcul forcé depuis la vue de recette ; libellés précisant 1/8 ou 100 g cuits. Ajout d’un fallback de modèles Gemini en cas de modèle absent et d’un parseur JSON tolérant les fences Markdown.
- Couverture ajoutée pour portions nutritionnelles locales, JSON/404 modèles, raisons d’erreur visibles et recalcul forcé. Checkpoint correctif : commit efa0fdc, déploiement production dpl_Hin1BxrLQ1QTykE1puQanVMxgKSA READY ; 292 tests et build réussis sans .env.local ni gemini-key.txt.
- Premier appel réel après dpl_5bUvjjYgm5Lk2yqnauk6JZdeTyf5 : curl POST sur /api/recipe-ai atteint bien la fonction (journal CDN Vercel : route=/api/recipe-ai, méthode POST, HTTP 502), mais le corps est {code: UNAVAILABLE}. Le journal runtime n’a pas de détail car le handler supprimait les exceptions. Aucun upsert recette QA n’a été fait avant l’échec ; aucune recette utilisateur touchée. Ajout en cours de journaux réduits et sans secret pour séparer précisément autorisation Supabase, refus Gemini et erreur fournisseur.
- Après déploiement dpl_Hff2bdA3kdWcGPx4AFat63QBu7C9, le nouvel curl a reçu PROVIDER_ERROR (Google 5xx). Initialisation et lecture du marqueur QA privé Supabase ont réussi avant l’appel ; aucun upsert n’a eu lieu. Les logs d’exécution Vercel sont absents malgré la trace CDN. L’outil de revue automatique a bloqué la récupération de la valeur cachée GEMINI_API_KEY dans un fichier local ; valeur non exposée ni remplacée. Le service réessaie désormais les deux modèles de secours en cas de 5xx et exposera le statut final sans autre détail.
- Après dpl_Hq2xvyATqu7h1M5dVt3JXFfDfqqL, le curl a reçu MODEL_UNAVAILABLE après les trois noms de modèles codés en dur. Aucun upsert recette. Cause affinée : la disponibilité n’est pas identique pour chaque clé et les trois choix n’étaient pas suffisants. Étape suivante : faire découvrir au serveur les modèles generateContent accessibles avec son secret Vercel (sans en extraire la valeur), choisir un Flash actif, et distinguer un refus de clé.
- Après dpl_E9VNAS2r8iguKbYRCX7vNQGs7U1Z, le curl a reçu HTTP429 RATE_LIMITED. L’ancien code confondait la limite DeckChef par carnet avec le quota Google. Aucun enregistrement n’a été tenté. La clé Vercel est présente ; sa valeur n’a pas été extraite (refus de revue automatique). Le correctif distingue désormais limite DeckChef et quota Google.
- Test production après dpl_Hin1BxrLQ1QTykE1puQanVMxgKSA : le curl du gâteau a répondu HTTP200 avec Gemini gemini-3.5-flash-lite, 280 kcal/part (1/8) et trois moules. La ligne QA a été enregistrée puis relue par PostgREST avec calories_value et ai_scaling_data identiques, puis supprimée. Pour le plat salé, le curl a répondu HTTP504 TIMEOUT ; Vercel a journalisé TimeoutError sur la route POST. Le client a appliqué exactement createLocalRecipeAi : 152 kcal/100 g et huit variantes ; enregistrement/lecture PostgREST réussis, ligne QA ensuite supprimée. Aucune recette utilisateur touchée ; deux marqueurs de carnet QA vides restent. Limite : l’analyse Gemini d’un plat salé n’a pas répondu avant le délai, mais affichage et sauvegarde via le calcul local sont confirmés.

## 2026-11-19 — Calories visibles et variantes instantanées, étape 4/4 : fluidité et validation finale

- Étape 3 publiée : 1e3c025, dpl_712iGvkvsc4WGxCZv5D4bgoYNBSc, READY ; 237 tests et build sans .env.local ni gemini-key.txt. Bloc sous le titre, anciennes recettes et contrôles instantanés disponibles en production.
- App conserve la liste filtrée et le callback d’ouverture entre les états de l’analyse. Cartes, Livre, contenu de page et images mémoïsés ; décodage des images asynchrone. Aucun réseau ajouté aux gestes ou aux sélections ; moteur refs/RAF, transforms/opacité et cadre plein écran inchangés. Régressions de rendu : parent sans changement ne redessine pas les images, mais une vraie modification est affichée.
- Repli culinaire affiné : fractions mixtes, pièces avec adjectifs, œufs/steaks/oignons entiers, doses à la cuillère par quarts. Légumes divisibles et agrumes acceptent les demis usuels ; valeurs arbitraires telles que 2,46 citrons refusées. Les fractions pesées et plages explicitement ambiguës sont préservées sans interprétation hasardeuse. Variante de base Gemini réutilise les ingrédients et calories exacts de la base ; aucune quantité adaptée n’est corrigée après son calcul nutritionnel.
- Réponse Gemini réelle de salade vérifiée intégralement après cette distinction culinaire : HTTP200 avec huit variantes, valeurs et ingrédients inchangés. Quelques appels QA ont rencontré l’indisponibilité temporaire du fournisseur ; repli local et absence de calories inventées vérifiés. Le service de production avait déjà été validé par POST réel ; contrôle de la dernière version après déploiement.
- Copies partagées et photos des variantes incluent les conseils de cuisson, sans modifier les étapes originales ni conserver de liens privés. Régression du moule d’une ancienne recette salée sans isCake explicite corrigée. Test App complet : recette sauvegardée avant résolution IA, portions/navigation actives, enrichissement conservé après fermeture du lecteur et rechargement.
- 279 tests/40 fichiers avant checkpoint final. Validation complète sans les deux fichiers secrets, contrôle du bundle, restauration locale, journal, commit/push main et quatrième déploiement Vercel CLI. README et VERIFICATION actualisés. Configuration : GEMINI_API_KEY serveur en local et secrets Vercel Production/Preview, modèle gemini-3.5-flash-lite ; aucune clé committée.
- Limites honnêtes : fermeture du transport navigateur avant le parcours visuel complémentaire et la sauvegarde de capture ; sélecteurs de moules et partage couverts par tests automatisés et appels réels. Pas de mesure matérielle 120 Hz ni essai iPhone physique. Supabase : aucun nouvel avis, données et politiques des autres applications préservées.

## 2026-11-19 — Calories visibles et variantes instantanées, étape 3/4 : interface

- Étape 2 publiée : 06e0ae5, dpl_8pmd9vmd9yjENfQwpgcPEoBqAxxU, READY ; 230 tests et build sans les deux fichiers secrets.
- Bloc calorique dédié immédiatement sous le titre : valeur et précision par huitième ou pour 100 g cuits, état manquant explicite et bouton Calculer calories & portions (IA) pour les recettes du carnet. Les cartes et pages anciennes affichent Calories à calculer au lieu de cacher entièrement cette fonction.
- Sélecteur salé 1..8 et sélecteur de moule 20/26/28 pour le sucré/gâteau. Toutes les variantes d’affichage sont préparées une fois ; un clic lit le cache, sans appel réseau. Le formulaire conserve le moule d’origine et propose l’analyse combinée. Sauvegarder immédiatement sans attendre l’IA reste possible.
- Assemblages conservés en sections ; chaque composant utilise sa variante seulement si son facteur correspond à celui de l’ensemble. Un facteur sans correspondance utilise le calcul local explicite et retire les calories non justifiables. Liens privés absents des copies partagées, lecteur externe sans action d’analyse privée.
- Navigateur 393×852 isolé du cloud : ancienne salade ouverte depuis le Livre, bloc et bouton visibles, changement vers 8 personnes possible pendant l’appel. Retour réel Gemini avec cache enregistré puis bascule immédiate à 3 personnes et ~81 kcal/100g. La vérification visuelle complémentaire a été interrompue par la fermeture du transport navigateur ; aucun résultat de ce parcours interrompu n’est revendiqué.
- 237 tests/36 fichiers et build réussis avant checkpoint ; sélecteurs, valeurs, état local/périmé, nouvelles recettes, partage et sections liés couverts. Validation complète sans secrets, journal, commit/push et déploiement CLI. L’audit final affine les fractions mixtes et pièces entières du repli local.

## 2026-11-19 — Calories visibles et variantes instantanées, étape 2/4 : cache persistant

- Étape 1 publiée : 930db21, dpl_4CLYmqTar45GGGtqpxR52XVbBmPi, READY ; 215 tests/33 fichiers sans .env.local ni gemini-key.txt. Nouvelle route de production vérifiée par un véritable POST privé : HTTP200, modèle configuré, huit variantes complètes.
- Ajout de caloriesValue/caloriesUnit/caloriesNote/aiScalingData au modèle et des quatre colonnes SQL correspondantes. Métadonnées dérivées des analyses fraîches, normalisées à la lecture du cache et de la base. Ancien schéma compatible : les champs historiques restent utilisables et les nouveaux restent en attente sans perte.
- Enregistrement local immédiat puis enrichissement asynchrone dans App. Déduplication par carnet/recette/contenu, annulation de l’ancien travail lors d’une nouvelle version, refus des réponses après suppression/modification/changement de carnet. Une indisponibilité IA conserve les variantes Gemini déjà connues ; erreur de quota explicite sans perdre la recette originale.
- Migration créée avec la CLI puis appliquée de façon ciblée via Supabase CLI 3.2 db query --remote=miltqwovqupvnaibjdgc --file : quatre colonnes nullables, contraintes bornées et adaptation de deckchef_initialize en SECURITY INVOKER. Un refus automatique initial a été réexaminé avec les quatre ajouts explicitement autorisés par la nouvelle demande, puis accepté. Aucun push global de l’historique partagé, aucune donnée existante ou règle RLS modifiée.
- Contrôle réel dans deux carnets QA neufs avec le même UUID : initialisation, sauvegarde/relecture du cache des huit variantes et des scalaires, contraintes, lecture croisée/sans en-tête à zéro. Deux recettes QA nettoyées ; seuls les marqueurs de carnets vides restent. Résultats .tools/ai-persistence-v3/live-result.json.
- Audit Supabase : aucun nouvel avertissement ; avis préexistants des schémas privés Kal et lecture partagée HMAC inchangés. Tests de persistance et de courses asynchrones ajoutés, validation complète sans les deux fichiers secrets, commit/push et déploiement CLI de cette étape.

## 2026-11-19 — Calories visibles et variantes instantanées, étape 1/4 : pont IA

- AGENTS et journal relus, npm run sync : main à jour et dépendances installées, audit npm sans vulnérabilité. Audit : l’analyse existait dans la troisième partie du formulaire, mais aucune action dans les fiches anciennes ; portions encore linéaires et absence de variantes persistées.
- Nouvelle route /api/recipe-ai : un appel Gemini structuré pour la base et les huit variantes salées ou les trois moules 20/26/28. Conservation de l’ancienne route. Contrôles d’origine, carnet privé/RLS, volume, délai et fréquence réutilisés ; secret uniquement serveur, fichier de secours limité au développement.
- Données versionnées et liées au contenu, ingrédients conservés dans leur ordre ; valeurs calorifiques dérivées de l’énergie et de la masse cuite. Toute recette sucrée utilise désormais une base de moule et huit parts. Validation des sorties, pièces indivisibles et réponses périmées ; le client possède un repli local déterministe sans inventer les calories inconnues.
- GEMINI_API_KEY déjà présent en production. Clé locale validée auprès de Google (HTTP200, modèle gemini-3.5-flash-lite disponible), ajoutée dans .env.local ignoré et dans un secret Vercel Preview. Un premier refus automatique de Preview a été réexaminé avec l’autorisation explicite « production / preview » de la demande puis accepté. Aucun secret affiché ou committé.
- Checkpoint étendu avec -WithoutSecrets : tests puis build sans .env.local ni gemini-key.txt, restauration des deux fichiers même en cas d’échec, contrôle du bundle avant publication. Persistance des variantes et nouvelle interface restent prévues aux étapes 2 et 3.
- Appels réels du nouveau service validés : plat salé HTTP200, huit variantes 1..8 et ~172 kcal/100g ; gâteau HTTP200, variantes 20/26/28 et base ~279 kcal par huitième. Traces synthétiques sans secret dans .tools/recipe-ai-live-*.json.
- Validation complète, commit/push main et déploiement production CLI de cette étape. Aucun changement de données ou de règles Supabase à cette étape.

## 2026-11-19 — Gemini et assemblages, étape 3/3 : interface et validation finale

- Étape 2 publiée : a23d409, dpl_A6yc1SVLyxdW1VSCzF3awgkXos9U, READY. L’API Gemini de production fonctionne après correction ESM : appel réel HTTP 200, modèle gemini-3.5-flash-lite, sans divulgation de clé.
- Autorisation explicite utilisateur reçue pour les ajouts sur recipes et l’adaptation de deckchef_initialize. Les deux migrations additives ont ensuite été appliquées avec succès : servings/calories_info, puis linked_recipe_ids et validation. Aucune suppression de données existantes, règle RLS ou table d’une autre application modifiée.
- Sélecteur discret repliable dans le formulaire, multi-sélection du carnet courant, auto-liens/cycles refusés et liens manquants retirables. Le lecteur affiche les sections des préparations, toutes les étapes numérotées et l’assemblage final ; portions globales 2/4/6/8 et saisie bornée. Les analyses propres restent distinctes des totaux dérivés.
- Badges combinés dans les trois vues, calculés à partir du carnet complet même avec filtres. Un composant manquant ou une analyse périmée retire le total. Partage composite et portions adaptées via copie autonome aplatie, sans liens privés ; photo préremplie avec portions et calories. Régression de calories à la réouverture des copies composites corrigée et testée pour gâteau/plat.
- Test Supabase réel dans deux carnets QA neufs : initialisation, sauvegarde/relecture, analyses et liens, pondération 500 puis 550 kcal/part, contraintes et isolation avec UUID identiques. Accès croisé et sans en-tête : zéro ligne. Suppression d’un enfant QA sans faux total ; quatre recettes QA nettoyées, marqueurs de carnets vides conservés.
- Parcours navigateur 393×852 isolé du cloud : deux analyses Gemini réelles, ganache liée au gâteau, sections/assemblage, quantités doublées de 2 à 4 personnes, calories combinées et export photo concordants. Badges Cartes/Livre, absence de débordement horizontal et console sans erreur vérifiés. Captures .tools/composite-*-393.jpg. Aucun essai iPhone physique revendiqué.
- 199 tests dans 30 fichiers réussis. Checkpoint final : tests puis build sans .env.local, restauration de la configuration, contrôle de l’absence de clé dans le bundle, journal, commit/push main et déploiement Vercel CLI. README et VERIFICATION actualisés. Les liens synchronisés ordinaires gardent leur ancien contrat de métadonnées ; copies autonomes et photos conservent les ajouts.

## 2026-11-18 — Gemini et assemblages, étape 2/3 : modèle et fusion

- Étape 1 publiée : 1955be2, dpl_8NKALSyzXmqqyp9oATEa2R4jbStG, READY. Le contrôle GET de l’API a révélé une erreur ESM de production, absente des tests locaux : imports serveur sans extension. Imports corrigés en .js résolus par TypeScript ; vérification HTTP après ce déploiement.
- linkedRecipeIds dans le modèle, mapping linked_recipe_ids et cache/file locale. Validation avant sauvegarde : UUID, carnet courant, maximum 20 liens directs, auto-liaison et cycles refusés.
- composeRecipes construit des sections conservant les préparations originales, puis ingrédients/étapes cumulés et consigne d’assemblage. Chaque recette commune est comptée une seule fois ; composants manquants/cycles historiques signalés sans faux total calorique.
- Calories dérivées calculées séparément : somme des énergies et masses cuites des analyses propres/fraîches, total/8 si gâteau ou pondération par 100 g sinon. Une estimation composite n’est jamais réutilisée comme analyse de base, ni sauvegardée à sa place.
- Nouvelle migration CLI additive pour linked_recipe_ids et contrôle de forme. Les deux migrations de production restent en attente de l’autorisation explicite demandée après refus de revue automatique. Aucun contournement ; champs et liens conservés localement/en attente tant que la base n’est pas migrée.
- Tests de fusion et de persistance : sections, portions, diamants sans double comptage, cycles, suppressions, calories périmées et reprise après migration simulée. Les copies de validation ignorées .tools sont désormais exclues de la collecte Vitest.
- Validation complète sans .env.local, journal, commit/push et déploiement CLI de cette étape. Les données et politiques des autres applications sont préservées.

## 2026-11-18 — Gemini et assemblages, étape 1/3 : analyse calorique

- AGENTS et journal lus, npm run sync exécuté. Analyse serveur POST /api/analyze-recipe, clé lue depuis GEMINI_API_KEY ou fichier local ignoré ; secret configuré sur Vercel sans publication dans le bundle. Vite n’expose que VITE_SUPABASE_ au client.
- Recette complète envoyée : proportions, ingrédients, toutes les étapes, cuisson, évaporation, absorption et mélanges. Schéma JSON strict et valeurs bornées ; conversion déterministe total/8 pour pâtisserie ou total/poids cuit×100 pour les autres plats. Affichage estimatif ~, jamais une prétendue mesure exacte.
- Analyse facultative dans la troisième partie du formulaire, indicateur, annulation et réponses périmées protégées. L’enregistrement sans IA reste possible. Portions de base et métadonnées conservées localement ; badges dans les trois vues uniquement si le contenu n’a pas changé.
- Authentification du carnet par RLS avant l’appel, limites de taille/fréquence, timeout et erreurs sans secret. Aucun service_role utilisé. Modèle 3.8 surchargé pendant le test ; défaut retenu gemini-3.5-flash-lite après appel réel HTTP200 : recette synthétique 1545,5 kcal, 480 g cuits, ~193 kcal/part pour 8 parts.
- Migration additive préparée par supabase migration new : servings/calories_info et initialisation DeckChef. Deux refus de revue automatique sur le DDL de production, interprétant AGENTS comme une interdiction de modifier aussi recipes. Une autorisation explicite est demandée ; aucune voie détournée utilisée, SQL non appliqué à ce stade.
- Client compatible ancien schéma : écrit les champs historiques mais garde la mutation et les nouvelles métadonnées en attente jusqu’à migration, y compris après rechargement. Aucune donnée des autres applications modifiée.
- 168 tests réussis avant checkpoint final, dont analyse serveur/client, formulaires, badges et persistance/ancienne base. Validation complète sans .env.local avant commit/push/déploiement de cette étape ; clé locale et traces .tools restent ignorées.

## 2026-11-17 — Partage de recettes, étape 3/3 · Modale et validation

- L’étape 2 est en production, déploiement `dpl_5hFHHerUMHwYE3a2HZXjpVZotHog`, READY.
- Les boutons Partager du haut et du bas du lecteur ouvrent la même modale centrée. Deux options proposent le lien direct ou la photo du thème, avec aperçu, partage natif du fichier et téléchargement.
- La fermeture de la modale de partage conserve le lecteur ouvert. Les liens pointent vers l’adresse publique de production et les liens reçus ouvrent une recette en lecture seule. Le retour nettoie les paramètres de partage.
- Les portions et calories facultatives se renseignent dans l’aperçu. Les quantités composées sont ajustées et les concentrations conservées. Un lien portable hors synchronisation signale quand la photo intégrée est disponible par l’export PNG.
- Vérification Chrome tactile à 393 × 852 et DPR 2, avec services distants simulés. Modale de 361 × 250 centrée en (196,5 ; 426), PNG Carte 786 × 1982 et Livre OLED 786 × 2060, couleurs, téléchargement, copie et activation du partage contrôlés. Ouverture depuis une copie portable, lecture distante hors cache et jeton d’un autre carnet avec identifiant commun vérifiés.
- Audit Supabase effectué. Deux avertissements signalent l’exécution intentionnelle de la fonction de lecture partagée par les rôles anon/authenticated. Son accès est limité par le jeton HMAC et les contrôles de refus ont réussi. Références [anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) et [authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- 138 tests dans 19 fichiers et build réussis sans `.env.local`, puis configuration locale restaurée. La feuille de partage native a été simulée dans Chrome. Safari sur iPhone physique reste à vérifier.

## 2026-11-17 — Partage de recettes, étape 2/3 · Photo

- Le lien direct de l’étape 1 est en production (déploiement `dpl_2bxUZ3we4sg43mBAkrHjH5Wyyisq`, READY, HTTP 200 sans connexion). Supabase a confirmé que la bonne combinaison donne une seule recette, que le jeton altéré ou réutilisé sur un autre identifiant ne donne aucun résultat et que la table reste inaccessible sans code de carnet.
- Export PNG côté navigateur à 2× pour les recettes de taille courante, avec styles Carte et Livre, couleurs du thème actif, photo, titre, badges applicables, liste intégrale des ingrédients, étapes numérotées et pied DeckChef.
- Le carnet ne stocke pas les portions ni l’énergie. L’aperçu accepte les portions d’origine, le nombre de personnes et les calories facultatives, puis ajuste les quantités reconnues dans les ingrédients. Neuf formats de quantité ont été contrôlés.
- Le PNG est prévisualisé avant le partage natif et peut être téléchargé directement. Une photo distante qui refuse le chargement CORS reçoit un visuel de remplacement dans le PNG.
- Sans `.env.local`, 122 tests dans 16 fichiers et build de production réussis.

## 2026-11-17 — Partage de recettes, étape 1/3 · Lien direct

- `npm run sync` a confirmé que `main` était à jour et que les dépendances étaient installées.
- Le lecteur ouvre directement `?recipe=` depuis le carnet local ou Supabase. Un lien partagé est en lecture seule et le retour retire ses paramètres de l’URL.
- Les liens synchronisés portent dans le fragment un jeton HMAC propre à la recette. Une fonction Supabase dédiée renvoie uniquement cette recette. Son SQL a été exécuté de façon ciblée sur le projet lié pour préserver l’historique de migrations partagé et les politiques RLS.
- Sans synchronisation, le partage inclut une copie compressée de la recette. Les photos intégrées volumineuses restent disponibles via le partage PNG prévu à l’étape suivante.
- Le bouton de lien demande la copie et le partage natif dans le même geste, avec un champ de copie manuelle en secours.
- Sans `.env.local`, 122 tests dans 16 fichiers et build de production réussis.

## 2026-11-17 — Synchronisation du nouveau poste

- Dépôt `YanisM1/deck-recettes` cloné sur `main`. GitHub CLI authentifiée sous `YanisM1` et identité Git configurée globalement et dans le dépôt.
- Dépendances installées avec `npm install`. L’audit npm signale six vulnérabilités de gravité élevée.
- Vercel lié à `nygma/deck-recettes` et Supabase au projet `miltqwovqupvnaibjdgc`. Les variables de développement `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` ont été récupérées dans `.env.local`. Le contrôle REST de Supabase en lecture seule a renvoyé HTTP 200.
- `gemini-key.txt` et `VITE_GEMINI_API_KEY` sont absents de la configuration locale. Aucune variable Gemini n’est configurée sur le projet Vercel. La vérification Gemini reste en attente d’une clé.
- `npm test` a validé les 108 tests répartis sur 15 fichiers. `npm run build` a réussi avec la configuration restaurée.

## 2026-11-16 — Urgence : reconstruction native du swipe tactile

- AGENTS.md et journal relus, npm run sync exécuté : main à jour, dépendances installées. Le chantier Gemini demandé juste avant reste séparé et n’est pas inclus dans ce correctif urgent.
- Blocage reproduit avant modification par deux tests : la séquence tactile avec perte de capture du bouton annulait le geste alors que le doigt continuait (index 0). Les glissements souris seuls ne couvraient pas cette situation.
- Logique d’entrée réécrite : TouchEvents natifs, touchmove passive:false sur la scène, suivi d’un seul identifier, verrouillage de l’intention horizontale et preventDefault immédiat. Aucun transfert de capture Pointer. Les événements Pointer tactiles de compatibilité n’interfèrent plus avec le contact actif.
- Souris/stylet suivent des listeners fenêtre sans capture, avec annulation réelle par pointercancel/blur. Toutes les données de glissement restent en refs, rendu DOM regroupé par RAF, index modifié une seule fois à la fin. Sens Cartes/Livre, limites, fins, reset et mouvement réduit conservés.
- Retour depuis l’état final possible même si le geste commence sur le bouton central ; le toucher simple conserve le reset. touch-action pan-y explicite sur les boutons de lecture, sélection/appui long désactivés sur la scène.
- 108 tests dans 15 fichiers, dont 14 régressions Touch : contacts multiples, capture enfant, flux Pointer doublés, annulations, prévention du scroll, tap, dernier mouvement avant frame, fins et retours inverses. Les deux tests qui échouaient sur l’ancien moteur passent.
- Banc navigateur local ignoré : véritables objets Touch/TouchEvent dispatchés dans l’application, capture perdue et Pointer intercalés ; parcours 0→1→0→1→2→3→4→3→4→0 réussi dans les deux modes. preventDefault effectif, transforms intermédiaires et reset contrôlés. Traces .tools/touch-cards-result.txt et .tools/touch-book-result.txt.
- Vérification distincte souris/flèche, application 393×852 et console sans erreur ; capture .tools/touch-book-393.jpg. Vérification synthétique en navigateur de bureau : aucun iPhone physique ni mesure 120 Hz disponible.
- README et VERIFICATION actualisés. Checkpoint tests/build sans .env.local puis commit/push avec le message utilisateur et déploiement Vercel CLI. Aucune modification Supabase ni lecture/publication de la clé Gemini.

## 2026-11-16 — Stabilisation des Cartes, du Livre et du cadre mobile

- AGENTS.md et journal lus, npm run sync exécuté : origin/main déjà à jour, dépendances installées. Aucun reset Git ni changement de données Supabase.
- Causes identifiées : clés par emplacement recréant les cartes/images au changement d’index ; composants et clés différents selon le rôle des pages ; double perspective, opacité sur preserve-3d et hauteur -webkit-fill-available concurrente de 100dvh.
- Cadre fixed/inset:0, 100vw×100dvh, flex column, overflow hidden et padding des zones sûres. Introduction et scène en flux flex avec min-height:0 ; suppression des anciennes coordonnées top/bottom de scène. Colonne latérale isolée au-dessus du contenu, mêmes formes, dimensions et coordonnées dans les deux modes.
- Cartes et feuilles désormais indexées avec clés stables par recette. La couche suivante et son image sont promues directement, sans remplacement du DOM. Livre : même composant à tous les rôles, perspective unique et aucune opacité sur le conteneur 3D.
- Transition CSS 300 ms ease-out, deux RAF pour présenter la pose initiale, finalisation unique par transitionend de la couche principale et délai de secours. Aucun getBoundingClientRect, offsetWidth/Height ni ResizeObserver dans la navigation. Gestes transitoires en refs et un seul changement d’index validé.
- Défaut reproduit dans le build de production : le clic suivant un swipe du Livre pouvait rester bloqué. Un nouveau pointerdown volontaire lève maintenant la protection du clic de compatibilité ; sa régression est testée dans les deux modes.
- Index N conservé comme vraie carte/couverture finale, avec gestes inverses, limites et boutons de retour à zéro. Sélection de texte désactivée sur le Livre pendant le geste ; couverture compacte ajustée pour l’écran court.
- Build de production local sans .env : swipes natifs avant/arrière, fins, retours inverses, resets et enchaînement swipe/retour/clic immédiat vérifiés. À 393×852, cadre exact 0,0,393,852, paddings 59/34 et boutons x18,y294,5/376,5/487,5 en 49×70. À 393×680, aucun débordement ni chevauchement introduction/couverture/navigation. Thèmes Chef Crème/OLED inspectés ; console de production sans erreur.
- 94 tests dans 14 fichiers : identité DOM/images conservée, absence de mesures de layout, événements de transition enfants/prématurés/doubles ignorés, délai de secours et clic physique après swipe. Tests et build validés sans .env.local avant commit/push/déploiement CLI Vercel.
- Audit PWA en lecture seule : cache versionné cohérent, aucune modification du service worker nécessaire. Un fichier local gemini-key.txt apparu pendant l’intervention a été exclu de Git et Vercel sans lecture ni modification de son contenu.
- README et VERIFICATION mis à jour. Captures QA ignorées : .tools/cards-stable-393.jpg et .tools/book-stable-393.jpg. Contrôles sur navigateur de bureau, aucun essai Safari/iPhone physique revendiqué.

## 2026-11-16 — Gestes directs, étape 3/3 : Régressions et validation finale

- Étape 2 publiée : commit 2d094e0, déploiement dpl_GPaCAZjgfwkrHFgmotwG642PzG4v, READY. Production contrôlée par vercel curl : HTTP 200, titre DeckChef, protection conservée.
- Nouvelle suite paramétrée sur Cartes et Livre : index N après 1 et 4 recettes, état final sous la dernière recette, avance bloquée à N, retour inverse depuis la fin, puis remise à zéro.
- React Profiler : zéro commit pendant plusieurs frames de glissement, index inchangé avant la fin du ressort puis un seul commit. Vérification des transforms exactes et du clic de compatibilité supprimé.
- Régressions : petit geste lent, flick rapide, pause avant relâchement, seuil strict 65 px, annulation/capture perdue sans coordonnées, pointeur secondaire, intention verticale, doubles commandes, clavier/molette, mouvement réduit et nettoyage des RAF/temporisateurs au démontage.
- Pointeur quittant la scène avant la reconnaissance libéré ; pointerId filtré aussi sur pointerleave pour préserver le geste primaire en multitouch.
- Ancien useDeckNavigation et ses tests retirés après migration des deux vues. README et VERIFICATION actualisés. Relecture indépendante finale des couches, limites, captures, CSS GPU et marque-pages.
- 84 tests dans 14 fichiers et build réussis ; validation finale sans .env.local via checkpoint, puis commit/push origin/main et troisième déploiement CLI Vercel. Aucune donnée Supabase modifiée.
- Captures locales : .tools/cards-end-direct.jpg, .tools/book-end-direct.jpg, .tools/book-end-oled-direct.jpg. Vérification à 393×852 en navigateur de bureau ; 120 Hz et Safari sur iPhone physique restent à tester sur appareil.

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
