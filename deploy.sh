#!/usr/bin/env bash
set -Eeuo pipefail
export CI=true

PROJECT_DIR="/var/www/aiwebvideo"
PM2_APP="aiwebvideo-web"
EXPECTED_DB="aiwebvideo"
GITHUB_REMOTE="git@github.com:mohammadadeela/AiWebVideo.git"

cd "$PROJECT_DIR"

if [ "$(pwd -P)" != "$PROJECT_DIR" ]; then
  echo "ERROR: refusing to deploy outside $PROJECT_DIR" >&2
  exit 1
fi

if [ ! -d .git ]; then
  echo "ERROR: .git is missing in $PROJECT_DIR" >&2
  exit 1
fi

if [ ! -f .env.local ]; then
  echo "ERROR: $PROJECT_DIR/.env.local is missing" >&2
  exit 1
fi

if [ ! -f package.json ]; then
  echo "ERROR: package.json is missing" >&2
  exit 1
fi

ENV_BACKUP="$(mktemp /tmp/aiwebvideo-env.XXXXXX)"
cleanup() {
  rm -f "$ENV_BACKUP"
}
trap cleanup EXIT

cp -p .env.local "$ENV_BACKUP"
chmod 600 "$ENV_BACKUP"

echo ""
echo "========================================"
echo "       AIWEBVIDEO SAFE DEPLOY"
echo "========================================"
echo ""

echo "===== 1. VERIFY GITHUB REMOTE ====="
git remote set-url origin "$GITHUB_REMOTE"
git remote -v

echo ""
echo "===== 2. VERIFY GITHUB SSH ====="
GIT_SSH_COMMAND="ssh -i /root/.ssh/aiwebvideo_github -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes" \
  git ls-remote origin HEAD >/dev/null

echo "GitHub SSH access OK"

echo ""
echo "===== 3. FETCH LATEST MAIN ====="
GIT_SSH_COMMAND="ssh -i /root/.ssh/aiwebvideo_github -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes" \
  git fetch --prune origin main

echo "Latest remote commit:"
git log origin/main -1 --oneline

echo ""
echo "===== 4. RESET AIWEBVIDEO CODE ONLY ====="
git reset --hard origin/main

# .env.local is private server configuration. Restore it immediately after the
# Git reset even though it should already be ignored by Git.
cp -p "$ENV_BACKUP" .env.local
chmod 600 .env.local

echo "Current deployed commit:"
git log -1 --oneline

echo ""
echo "===== 5. VERIFY AIWEBVIDEO ENV + DATABASE TARGET ====="
node --env-file="$PROJECT_DIR/.env.local" - <<'NODE'
const required = ['DATABASE_URL', 'SESSION_SECRET'];
let failed = false;

for (const key of required) {
  if (!process.env[key]?.trim()) {
    console.error(`ERROR: ${key} is missing from AIWebVideo .env.local`);
    failed = true;
  }
}

if (failed) process.exit(1);

const url = new URL(process.env.DATABASE_URL);
const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));

console.log(`Database host: ${url.hostname}`);
console.log(`Database port: ${url.port || '5432'}`);
console.log(`Database name: ${databaseName}`);
console.log(`Database user: ${decodeURIComponent(url.username)}`);

if (databaseName !== 'aiwebvideo') {
  console.error(
    `SAFETY STOP: AIWebVideo must use database "aiwebvideo", but DATABASE_URL points to "${databaseName}".`,
  );
  process.exit(1);
}

console.log('AIWebVideo database target verified.');
NODE

echo ""
echo "===== 6. CHECK RUNTIME ====="
command -v node >/dev/null
command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null
command -v pm2 >/dev/null

node -e 'const major=Number(process.versions.node.split(".")[0]); if (major < 20) { console.error("Node.js 20 or newer is required"); process.exit(1) }'
node --version

export NPM_CONFIG_CACHE=/var/cache/aiwebvideo/npm
export PNPM_HOME=/var/cache/aiwebvideo/pnpm-home
export PNPM_STORE_DIR=/var/cache/aiwebvideo/pnpm-store
export XDG_DATA_HOME=/var/cache/aiwebvideo/xdg-data
export XDG_CACHE_HOME=/var/cache/aiwebvideo/xdg-cache

install -d -m 0750 \
  "$NPM_CONFIG_CACHE" \
  "$PNPM_HOME" \
  "$PNPM_STORE_DIR" \
  "$XDG_DATA_HOME" \
  "$XDG_CACHE_HOME"

PNPM=(npx --yes pnpm@10.28.2)

echo ""
echo "===== 7. INSTALL AIWEBVIDEO DEPENDENCIES ====="
"${PNPM[@]}" install --frozen-lockfile

echo ""
echo "===== 8. ENSURE PLAYWRIGHT CHROMIUM ====="
# Chromium's Linux dependencies are already installed on this VPS. Do not run
# --with-deps on every deployment because that invokes apt on the shared server.
"${PNPM[@]}" --filter @workspace/api-server exec playwright install chromium

echo ""
echo "===== 9. PREPARE AIWEBVIDEO STORAGE ====="
install -d -m 0750 /var/lib/aiwebvideo/assets

echo ""
echo "===== 10. MIGRATE AIWEBVIDEO DATABASE ONLY ====="
node \
  --env-file="$PROJECT_DIR/.env.local" \
  "$PROJECT_DIR/artifacts/api-server/db/migrate.mjs"

echo ""
echo "===== 11. BUILD AIWEBVIDEO ====="
"${PNPM[@]}" run build

echo ""
echo "===== 12. VERIFY AIWEBVIDEO BUILD ====="
test -f "$PROJECT_DIR/artifacts/aiwebvideo/dist/public/index.html" || {
  echo "ERROR: frontend build is missing" >&2
  exit 1
}

test -f "$PROJECT_DIR/artifacts/api-server/dist/index.mjs" || {
  echo "ERROR: backend build is missing" >&2
  exit 1
}

echo "Frontend build OK"
echo "Backend build OK"

echo ""
echo "===== 13. RELOAD ONLY aiwebvideo-web ====="
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 reload "$PM2_APP" --update-env
else
  pm2 start "$PROJECT_DIR/ecosystem.config.cjs" --only "$PM2_APP"
fi

echo "Only PM2 app '$PM2_APP' was targeted."

echo ""
echo "===== 14. WAIT FOR AIWEBVIDEO ====="
sleep 6

echo ""
echo "===== 15. LOCAL AIWEBVIDEO HEALTH CHECK ====="
if ! curl --fail --silent --show-error --retry 5 --retry-delay 2 --max-time 10 \
  http://127.0.0.1:3001/api/health; then
  echo ""
  echo "ERROR: AIWebVideo local health check failed" >&2
  pm2 logs "$PM2_APP" --lines 100 --nostream || true
  exit 1
fi

echo ""
echo "AIWebVideo local API is healthy."

echo ""
echo "===== 16. PUBLIC AIWEBVIDEO HEALTH CHECK ====="
if curl --fail --silent --show-error --max-time 15 \
  https://aiwebvideo.com/api/health; then
  echo ""
  echo "AIWebVideo public API is healthy."
else
  echo ""
  echo "WARNING: public health check failed; local API is healthy."
fi

echo ""
echo "===== 17. AIWEBVIDEO PM2 INFO ====="
pm2 describe "$PM2_APP"

echo ""
echo "===== 18. AIWEBVIDEO LOGS ONLY ====="
pm2 logs "$PM2_APP" --lines 100 --nostream

echo ""
echo "========================================"
echo "     AIWEBVIDEO DEPLOY COMPLETE"
echo "========================================"
echo ""
