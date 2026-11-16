# DeckChef — consignes du dépôt

Lire AGENT_CHAT.md avant toute modification. Ne jamais utiliser git reset --hard.

React + TypeScript + Vite, PWA française, modes cards et book. Viewport de référence demandé : 393 × 852 CSS px ; conserver une interface responsive sur les autres écrans. Respecter les safe areas (minimum 59 px en haut, 34 px en bas). Aucun menu de navigation sur l’écran principal.

Les filtres Salé/Sucré sont indépendants et cumulatifs. Le mode par défaut est cards ; préférences persistées et synchronisées entre onglets. Tous les thèmes doivent supporter les deux modes. Les données fonctionnent sans variables d’environnement ; ne jamais committer de secrets.

À chaque étape : npm test puis npm run build, journal antichronologique, commit, push main et déploiement Vercel si les accès sont disponibles. Documenter honnêtement tout blocage d’accès. Git local : YanisM1 <YanisM1@users.noreply.github.com>.
