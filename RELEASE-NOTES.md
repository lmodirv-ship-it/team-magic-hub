# RELEASE NOTES — NAWAT Studio

## Version 1.0.0 — 23/09/2026

Première version distribuable de NAWAT Studio (Groupe-HN).

### Nouveautés

- Espace de travail multi-racines : `my-app/`, `bibliotheque/`, `vision_output/`,
  `agents/`, `models/`, `logs/`.
- Atelier multi-modèles : un prompt, plusieurs modèles en parallèle, grille
  adaptative et chronomètre par modèle.
- Page Résultats : filtres, aperçu, comparaison côte à côte, export ZIP.
- Aperçu intelligent : HTML, Markdown, JSON, code, images, vidéo, PDF, logs, ZIP.
- NAWAT Chat : conversations persistées, pièce jointe du fichier ouvert,
  envoi vocal (micro) et lecture vocale des réponses.
- Statistiques temps réel dans l'en-tête : sparklines, historique 24 h, tendances,
  son optionnel, voyant de connexion WebSocket.
- Recherche globale `Ctrl+K`, centre de notifications, raccourcis clavier.
- Galerie de styles : NAWAT officiel, Edge, System Night, Graphite, Aurora, Light.
- Tableau de gestion du programme dans les Réglages (ID `A111111`, rôle, mission,
  activation/désactivation, extensible).

### Distribution

- PWA installable (manifeste, icônes 192/512/maskable, raccourcis, page hors ligne).
- Projet Electron prêt pour `.exe` (NSIS + portable), `.dmg`, AppImage et `.deb`.
- Archive ZIP du code source complet avec guides.
- Scripts `BUILD-ALL.sh` et `BUILD-ALL.bat`.
- Documentation : INSTALLATION, BUILD, MOBILE, USAGE, API, FAQ.

### Corrections

- Double instance de React en aperçu (écran blanc) corrigée.
- Contexte de l'espace de travail partagé en singleton (plus d'erreur au rechargement).
- Widget de statistiques affiché une seule fois sur mobile.

### Limites connues

- Le serveur compagnon `ws://localhost:5001` n'est pas fourni : les statistiques
  temps réel sont calculées localement tant qu'il est absent.
- Le terminal intégré reste simulé en mode navigateur (shell réel en version desktop).
- Le service worker hors ligne complet s'active manuellement (voir `docs/BUILD.md`).
