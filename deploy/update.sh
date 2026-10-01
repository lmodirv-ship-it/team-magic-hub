#!/usr/bin/env bash
# Pulls latest changes from Lovable (via GitHub) and restarts only if changed
set -e
cd "$(dirname "$0")/.."; export PATH="$HOME/.bun/bin:$PATH"
BR="${GIT_BRANCH:-main}"; git fetch -q origin "$BR"
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/$BR)" ] && exit 0
git reset -q --hard "origin/$BR"
bun install && bun run build && pm2 reload deploy/ecosystem.config.cjs
echo "$(date) updated to $(git rev-parse --short HEAD)"
