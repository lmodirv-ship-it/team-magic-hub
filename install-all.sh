#!/usr/bin/env bash
# NAWAT INSTALL ALL (Linux / macOS): installe tout et construit la version complete.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"; cd "$ROOT"
command -v node >/dev/null || { echo "Installez Node.js 20+ (https://nodejs.org)"; exit 1; }
command -v ffmpeg >/dev/null || { command -v apt-get >/dev/null && sudo apt-get install -y ffmpeg || brew install ffmpeg || true; }
command -v ollama >/dev/null || curl -fsSL https://ollama.com/install.sh | sh || true
command -v python3 >/dev/null && python3 -m pip install --user fastapi uvicorn flask requests numpy pandas ollama ffmpeg-python || true
npm install
npm install --no-save fluent-ffmpeg ffmpeg-static ffprobe-static express cors multer ws axios ollama
bash "$ROOT/BUILD-ALL.sh"
echo "Termine ! Fichiers dans: $ROOT/distributions"
