#!/usr/bin/env bash
# NAWAT one-time install on Ubuntu/Debian server
set -e
APP_DIR="${APP_DIR:-/opt/nawat}"
REPO="${1:?usage: install.sh <git-repo-url>}"
sudo apt-get update && sudo apt-get install -y git curl unzip
command -v node >/dev/null || { curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -; sudo apt-get install -y nodejs; }
command -v bun >/dev/null || curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
command -v pm2 >/dev/null || sudo npm i -g pm2
[ -d "$APP_DIR/.git" ] || sudo git clone "$REPO" "$APP_DIR"
sudo chown -R "$USER" "$APP_DIR"; cd "$APP_DIR"
[ -f .env ] || { cp deploy/.env.example .env; echo ">> عدّل الملف $APP_DIR/.env ثم أعد التشغيل"; }
bun install && bun run build
pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup | tail -1
( crontab -l 2>/dev/null | grep -v nawat-update; echo "*/5 * * * * $APP_DIR/deploy/update.sh >> $APP_DIR/update.log 2>&1 # nawat-update" ) | crontab -
echo "تم التثبيت: الموقع :3000 — الجسر :8788 — التحديث التلقائي كل 5 دقائق"
