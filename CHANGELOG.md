# CHANGELOG

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [1.0.0] — 2026-09-23

### Ajouté

- Distribution en trois formats : PWA, Electron (.exe/.dmg/AppImage/.deb), ZIP.
- Scripts `BUILD-ALL.sh` / `BUILD-ALL.bat` et sommes de contrôle SHA256.
- Documentation complète : INSTALLATION, BUILD, MOBILE, USAGE, API, FAQ.
- Page hors ligne `public/offline.html`, icône maskable, raccourcis du manifeste.
- Envoi vocal et lecture vocale dans NAWAT Chat.
- Galerie de styles et tableau de gestion du programme dans les Réglages.

### Modifié

- Statistiques déplacées dans l'en-tête, en barre compacte avec infobulles.
- Explorateur réorganisé en racines repliables.

### Corrigé

- Écran blanc lié au cache d'aperçu (double instance de React).
- Contexte de l'espace de travail perdu au rechargement.

## [0.9.0] — 2026-09-22

### Ajouté

- Atelier multi-modèles, page Résultats, aperçu intelligent multi-format,
  notifications de fichiers créés, recherche globale et centre de notifications.
