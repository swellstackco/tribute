#!/usr/bin/env bash
# Deploy Tribute to the VPS. Safe on a shared box: checks memory, never touches nginx or other apps.
# Usage: bash scripts/deploy.sh            (env: DEPLOY_HOST, DEPLOY_DIR, APP_PORT)
set -euo pipefail
HOST="${DEPLOY_HOST:-root@2.24.203.5}"
DIR="${DEPLOY_DIR:-/var/www/tribute}"
PORT="${APP_PORT:-5117}"
# better-sqlite3 13 needs Node 22+. The box default is Node 20, so Tribute uses its own copy in /opt/node22 (no global change).
NODE22="${NODE22_DIR:-/opt/node22}"

echo "== memory check"
AVAIL=$(ssh "$HOST" "free -m | awk '/^Mem:/ {print \$7}'")
echo "available MB: $AVAIL"
if [ "$AVAIL" -lt 700 ]; then echo "Not enough free memory for a build. Stop."; exit 1; fi

echo "== rsync"
rsync -az --delete \
  --exclude node_modules --exclude .env --exclude 'data/' --exclude .git --exclude dist \
  --exclude 'docs/assets' --exclude 'docs/screens' --exclude '*.log' \
  ./ "$HOST:$DIR/"

echo "== install and build on the server"
ssh "$HOST" "export PATH=$NODE22/bin:\$PATH && cd $DIR && mkdir -p data && rm -rf node_modules && npm ci --no-audit --no-fund && npm run build && npm prune --omit=dev --no-audit --no-fund"

echo "== pm2"
ssh "$HOST" "cd $DIR && test -f .env || { echo '.env missing on the server'; exit 1; }; chmod 600 .env; \
  if pm2 describe tribute >/dev/null 2>&1; then pm2 reload tribute --update-env; \
  else PORT=$PORT pm2 start dist/server/server/index.js --name tribute --interpreter $NODE22/bin/node --time; fi; pm2 save"

echo "== health"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if ssh "$HOST" "curl -fsS http://127.0.0.1:$PORT/health"; then echo; break; fi
  sleep 2
done
ssh "$HOST" "pm2 jlist" | node -e "const l=JSON.parse(require('fs').readFileSync(0,'utf8')).find(a=>a.name==='tribute');console.log('status',l.pm2_env.status,'restarts',l.pm2_env.restart_time)"
echo "Done. Watch restart count for a minute: ssh $HOST 'pm2 describe tribute'"
# Cloudflare cache purge (optional): set CF_ZONE and CF_TOKEN in your shell to enable.
if [ -n "${CF_ZONE:-}" ] && [ -n "${CF_TOKEN:-}" ]; then
  curl -fsS -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/purge_cache" -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" --data '{"purge_everything":true}' >/dev/null && echo "cache purged"
fi
