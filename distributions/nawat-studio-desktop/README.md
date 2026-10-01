# NAWAT Studio Desktop (Electron)

Projet prêt à builder pour produire un `.exe` Windows (installeur NSIS + portable),
un `.dmg` macOS et des paquets Linux (AppImage / deb).

## Structure

```
nawat-studio-desktop/
├── package.json          scripts et dépendances Electron
├── electron-builder.yml  configuration de build (win / mac / linux)
├── main.cjs              processus principal (fenêtre, menu, IPC)
├── preload.cjs           pont sécurisé window.nawat
├── assets/               icon.ico / icon.icns / icon.png
└── renderer/             interface buildée (copiée depuis le projet web)
```

## Étapes

```bash
# 1) Builder l'interface web (à la racine du projet NAWAT Studio)
npm install
npm run build          # avec base: './' dans vite.config.ts

# 2) Copier le build dans renderer/
#    Windows : xcopy /E /I /Y dist distributions\nawat-studio-desktop\renderer
#    Linux/mac : cp -r dist/* distributions/nawat-studio-desktop/renderer/

# 3) Builder l'application desktop
cd distributions/nawat-studio-desktop
npm install
npm run build:win      # dist/NAWAT Studio Setup 1.0.0.exe + version portable
```

Mode développement (interface servie par Vite) :

```bash
NAWAT_DEV_URL=http://localhost:8080 npm start
```

Voir `docs/BUILD.md` pour les icônes, la signature et la distribution.
