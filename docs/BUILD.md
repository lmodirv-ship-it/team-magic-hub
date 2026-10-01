# BUILD — NAWAT Studio

Trois formats de distribution : **PWA**, **EXE (Electron)**, **ZIP**.

## 0. Prérequis de build

```bash
node -v   # ≥ 20
npm -v    # ≥ 10
npm install
```

Structure utile :

```
nawat-studio/
├── src/                        interface (TanStack Start + React + Tailwind)
├── public/                     manifest, icônes, page hors-ligne
├── electron/                   couche desktop de développement
├── distributions/
│   └── nawat-studio-desktop/   projet electron-builder (exe/dmg/AppImage)
├── docs/                       guides
├── BUILD-ALL.bat / BUILD-ALL.sh
```

## 1. Build de la PWA

```bash
npm run build           # sortie web dans dist/ (ou .output/ selon la cible)
```

Contenu PWA déjà en place :

- `public/manifest.webmanifest` — nom, couleurs, `display: standalone`, RTL/arabe,
  icônes 192 / 512 / maskable, raccourcis Chat · Atelier · Résultats.
- `public/pwa-192.png`, `public/pwa-512.png`, `public/pwa-maskable-512.png`,
  `public/apple-touch-icon.png`, `public/favicon.png`.
- `public/offline.html` — page de repli élégante quand la connexion est absente.
- Balises `manifest`, `theme-color`, `apple-touch-icon` injectées dans le `head`.

Résultat : l'application est **installable** sur mobile et desktop et se lance en
fenêtre autonome avec son icône.

### Activer le cache hors-ligne complet (optionnel, à faire localement)

Le service worker n'est pas activé par défaut : dans l'aperçu Lovable il masquerait
les mises à jour. Pour l'activer sur votre hébergement :

```bash
npm install -D vite-plugin-pwa
```

```ts
// vite.config.ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        devOptions: { enabled: false },
        filename: "sw.js",
        manifest: false, // on garde public/manifest.webmanifest
        workbox: {
          navigateFallback: "/offline.html",
          navigateFallbackDenylist: [/^\/api/, /^\/~oauth/],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: { cacheName: "nawat-html" },
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith("/assets/"),
              handler: "CacheFirst",
              options: { cacheName: "nawat-assets" },
            },
          ],
        },
      }),
    ],
  },
});
```

Enregistrement (uniquement en production, jamais en aperçu) :

```ts
if (import.meta.env.PROD && window.top === window && !location.search.includes("sw=off")) {
  navigator.serviceWorker?.register("/sw.js");
}
```

Stratégies : `NetworkFirst` pour le HTML et les API, `CacheFirst` pour les assets
hachés, `skipWaiting` + `clients.claim` gérés par `registerType: "autoUpdate"`.

## 2. Build de l'EXE (Electron)

1. Ajoutez `base: './'` dans `vite.config.ts` (chargement via `file://`).
2. `npm run build`
3. Copiez le build dans le projet desktop :

```bash
mkdir -p distributions/nawat-studio-desktop/renderer
cp -r dist/* distributions/nawat-studio-desktop/renderer/
# Windows : xcopy /E /I /Y dist distributions\nawat-studio-desktop\renderer
```

4. Buildez :

```bash
cd distributions/nawat-studio-desktop
npm install
npm run build:win     # dist/NAWAT Studio Setup 1.0.0.exe + NAWAT Studio 1.0.0.exe (portable)
npm run build:mac     # dist/NAWAT Studio-1.0.0.dmg
npm run build:linux   # dist/NAWAT Studio-1.0.0.AppImage + .deb
```

### Icônes

| Plateforme | Fichier              | Taille        |
| ---------- | -------------------- | ------------- |
| Windows    | `assets/icon.ico`    | 256×256 (multi) |
| macOS      | `assets/icon.icns`   | 1024×1024      |
| Linux      | `assets/icon.png`    | 512×512        |

```bash
# PNG -> ICO / ICNS
npx png-to-ico public/pwa-512.png > distributions/nawat-studio-desktop/assets/icon.ico
npx png2icns distributions/nawat-studio-desktop/assets/icon.icns public/pwa-512.png
```

### Signature du code

- **Windows** : certificat Authenticode (`.pfx`)
  `set CSC_LINK=cert.pfx` + `set CSC_KEY_PASSWORD=...` puis `npm run build:win`.
- **macOS** : `CSC_NAME="Developer ID Application: ..."` puis notarisation
  `xcrun notarytool submit dist/*.dmg --apple-id ... --team-id ... --wait`.
- Sans signature, Windows SmartScreen et macOS Gatekeeper afficheront un avertissement.

### Installeur personnalisé

Modifiez la section `nsis:` de `electron-builder.yml` (bannière, licence, langue,
`oneClick: false` pour laisser le choix du dossier, `perMachine: true` pour une
installation à l'échelle de la machine).

## 3. Build du ZIP

```bash
# Linux / macOS
zip -r nawat-studio-v1.0.0.zip nawat-studio/ -x '*/node_modules/*' '*/dist/*' '*/.git/*'

# Windows PowerShell
Compress-Archive -Path "nawat-studio\*" -DestinationPath "nawat-studio-v1.0.0.zip"
```

Sommes de contrôle :

```bash
sha256sum nawat-studio-v1.0.0.zip > checksums.txt
```

## 4. Build mobile

Voir `docs/MOBILE.md` (PWA recommandée, Capacitor pour APK/IPA).

## 5. Tout builder d'un coup

```bash
./BUILD-ALL.sh        # Linux / macOS
BUILD-ALL.bat         # Windows
```
