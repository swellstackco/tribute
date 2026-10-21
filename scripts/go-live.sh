#!/usr/bin/env bash
# Switch the deployed Tribute from mock Qloo to live Qloo. The key is read from stdin, never from argv or the repo.
#   Probe first (locally):  QLOO_API_KEY=... npm run probe
#   Then:                   printf '%s' "$QLOO_API_KEY" | bash scripts/go-live.sh
# What it does: backs up .env, sets QLOO_MODE=live and QLOO_API_KEY, pm2 reload, re-seeds the three examples
# with the free planner (live Qloo data, no model spend), checks /health.
set -euo pipefail
HOST="${DEPLOY_HOST:-root@2.24.203.5}"
DIR="${DEPLOY_DIR:-/var/www/tribute}"
NODE22="${NODE22_DIR:-/opt/node22}"
read -r KEY
[ -n "$KEY" ] || { echo "No key on stdin."; exit 1; }
printf '%s\n' "$KEY" | ssh "$HOST" "set -e; cd $DIR; read -r K; cp .env .env.bak-\$(date +%s); umask 077;
  grep -v -E '^(QLOO_MODE|QLOO_API_KEY)=' .env > .env.new; printf 'QLOO_MODE=live\nQLOO_API_KEY=%s\n' \"\$K\" >> .env.new; mv .env.new .env; chmod 600 .env;
  pm2 reload tribute --update-env >/dev/null;
  export PATH=$NODE22/bin:\$PATH; LLM_PROVIDER=mock npm run --silent seed:prod;
  sleep 2; curl -fsS http://127.0.0.1:5117/health; echo"
echo "Live. Roll back: ssh $HOST 'cd $DIR && cp \$(ls -t .env.bak-* | head -1) .env && pm2 reload tribute --update-env'"
