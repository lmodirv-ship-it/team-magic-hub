#!/usr/bin/env bash
# NAWAT Studio — build des trois formats de distribution (Linux / macOS).
set -euo pipefail

VERSION="1.0.0"
ROOT="$(cd "$(dirname "$0")" && pwd)"
DESKTOP="$ROOT/distributions/nawat-studio-desktop"
OUT="$ROOT/distributions"

echo "==> 1/4 Installation des dépendances"
npm install

echo "==> 2/4 Build de l'interface web (PWA incluse)"
npm run build
BUILD_DIR="$ROOT/dist"
[ -d "$BUILD_DIR" ] || BUILD_DIR="$ROOT/.output/public"

echo "==> 3/4 Build de l'application desktop"
mkdir -p "$DESKTOP/renderer"
rm -rf "${DESKTOP:?}/renderer/"*
cp -r "$BUILD_DIR/." "$DESKTOP/renderer/"
( cd "$DESKTOP" && npm install && npm run build )

echo "==> 4/4 Archive ZIP"
mkdir -p "$OUT"
rm -f "$OUT/nawat-studio-v$VERSION.zip"
( cd "$ROOT" && zip -r "$OUT/nawat-studio-v$VERSION.zip" . \
    -x '*/node_modules/*' 'node_modules/*' '*/.git/*' '.git/*' \
       'dist/*' '.output/*' 'distributions/*' )

echo "==> Sommes de contrôle"
( cd "$OUT" && find . -maxdepth 3 -type f \( -name '*.zip' -o -name '*.exe' -o -name '*.dmg' -o -name '*.AppImage' -o -name '*.deb' \) -exec sha256sum {} \; > checksums.txt )

echo "Terminé. Fichiers dans: $OUT"
