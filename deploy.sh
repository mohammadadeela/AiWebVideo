#!/usr/bin/env bash
set -Eeuo pipefail
export CI=true

cd /var/www/aiwebvideo

ENV_BACKUP="$(mktemp /tmp/aiwebvideo-env.XXXXXX)"
cleanup() { rm -f "$ENV_BACKUP"; }
trap cleanup EXIT

test -f .env.local || { echo ".env.local is missing" >&2; exit 1; }
cp --preserve=mode .env.local "$ENV_BACKUP"

echo "===== SOURCE VERSION ====="
if [ "${DEPLOY_FROM_GIT:-0}" = "1" ]; then
  echo "DEPLOY_FROM_GIT=1 — syncing origin/main"
  git fetch origin
  git reset --hard origin/main
else
  echo "Building the project files currently in /var/www/aiwebvideo (no git reset)."
fi

echo "===== RESTORE PRIVATE ENV ====="
cp --preserve=mode "$ENV_BACKUP" .env.local

echo "===== CHECK ENV ====="
if ! grep -Eq '^SESSION_SECRET=.{32,}$' .env.local; then
  GENERATED_SESSION_SECRET="$(openssl rand -hex 32)"
  printf '\nSESSION_SECRET=%s\n' "$GENERATED_SESSION_SECRET" >> .env.local
  chmod 600 .env.local
  echo "Generated missing SESSION_SECRET"
fi
set -a
# shellcheck disable=SC1091
. ./.env.local
set +a

echo "===== CHECK RUNTIME ====="
command -v node >/dev/null
command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null
node -e 'const major=Number(process.versions.node.split(".")[0]); if (major < 20) { console.error("Node.js 20 or newer is required"); process.exit(1) }'

export NPM_CONFIG_CACHE=/var/cache/aiwebvideo/npm
export PNPM_HOME=/var/cache/aiwebvideo/pnpm-home
export PNPM_STORE_DIR=/var/cache/aiwebvideo/pnpm-store
export XDG_DATA_HOME=/var/cache/aiwebvideo/xdg-data
export XDG_CACHE_HOME=/var/cache/aiwebvideo/xdg-cache
install -d -m 0750 "$NPM_CONFIG_CACHE" "$PNPM_HOME" "$PNPM_STORE_DIR" "$XDG_DATA_HOME" "$XDG_CACHE_HOME"
PNPM=(npx --yes pnpm@10.28.2)

echo "===== INSTALL ====="
"${PNPM[@]}" install --frozen-lockfile
"${PNPM[@]}" --filter @workspace/api-server exec playwright install --with-deps chromium

echo "===== PREPARE STORAGE ====="
install -d -m 0750 "${ASSETS_DIR:-/var/lib/aiwebvideo/assets}"

echo "===== MIGRATE DB ====="
"${PNPM[@]}" run db:migrate

echo "===== BUILD ====="
"${PNPM[@]}" run build

echo "===== VERIFY BUILD ====="
test -f artifacts/aiwebvideo/dist/public/index.html
test -f artifacts/api-server/dist/index.mjs

echo "===== RESTART APP ====="
pm2 delete aiwebvideo-capture aiwebvideo-render >/dev/null 2>&1 || true
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo "===== HEALTH CHECK ====="
curl --fail --silent --show-error --retry 10 --retry-delay 2 \
  http://127.0.0.1:3001/api/health
echo

echo "===== LOGS ====="
pm2 logs aiwebvideo-web --lines 60 --nostream
