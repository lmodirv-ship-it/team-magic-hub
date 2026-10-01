# MOBILE — NAWAT Studio sur téléphone et tablette

## Option 1 — PWA (recommandée)

1. Hébergez le build sur une URL **HTTPS** (Lovable publie déjà sur
   `https://groupe-hn-ai.lovable.app`).
2. Ouvrez l'URL sur le téléphone.

### Android (Chrome / Edge)

- Menu ⋮ → **Installer l'application** / **Ajouter à l'écran d'accueil**.
- L'icône NAWAT apparaît, l'app s'ouvre sans barre de navigateur.
- Appui long sur l'icône : raccourcis Chat · Atelier · Résultats.

### iOS (Safari)

- Bouton **Partager** → **Sur l'écran d'accueil** → Ajouter.
- iOS ne propose pas d'invite automatique : ce chemin est le seul disponible.

### Desktop (Chrome / Edge)

- Icône d'installation dans la barre d'adresse, ou menu ⋮ → **Installer NAWAT Studio**.

### Mode hors ligne

- L'interface, les thèmes, l'espace de travail virtuel et les fichiers déjà générés
  sont stockés dans le navigateur (localStorage) et restent accessibles sans réseau.
- Les modèles Ollama et le serveur compagnon exigent le réseau local : hors ligne,
  l'application affiche l'état « غير متصل » et la page `offline.html` si nécessaire.
- Le cache complet des fichiers statiques s'active avec le service worker
  (voir `docs/BUILD.md`, section PWA).

## Option 2 — Capacitor (APK / IPA natifs)

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "NAWAT Studio" org.groupe-hn.nawat-studio --web-dir=dist
npm run build
npx cap add android
npx cap add ios
npx cap sync
npx cap open android      # Android Studio -> Build > Build APK
npx cap open ios          # Xcode -> Product > Archive
```

Points d'attention :

- Android 9+ bloque le HTTP en clair : autorisez `127.0.0.1` / le réseau local
  via `android:usesCleartextTraffic="true"` pour joindre Ollama.
- Le téléphone doit atteindre la machine qui héberge Ollama (même Wi-Fi,
  hôte `http://192.168.x.x:11434` dans les réglages NAWAT).

## Option 3 — React Native (avancé)

Réécriture de l'interface avec partage de la logique (`src/lib/nawat/*` est du
TypeScript pur : bridge, registre, thèmes, zip, workspace). À envisager seulement
si des APIs natives non couvertes par Capacitor sont nécessaires.
