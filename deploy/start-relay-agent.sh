#!/usr/bin/env bash
# Run on the LAN server (192.168.100.67): outbound relay agent, auto-restart, survives reboot.
set -e
cd "$(dirname "$0")/.."
export RELAY_URL="${RELAY_URL:-https://hn-ai.site/api/public/relay}"
npx pm2 delete nawat-relay-agent >/dev/null 2>&1 || true
npx pm2 start bridge/cloud-agent.mjs --name nawat-relay-agent --update-env
npx pm2 save
npx pm2 startup || true
echo "✅ nawat-relay-agent يعمل ويرسل التحديثات تلقائيًا إلى $RELAY_URL"
