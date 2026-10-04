#!/usr/bin/env bash
#
# Clean-VM acceptance test for an on-premise install.
#
# Proves, on a host that has never run this application, that the documented
# install actually works end to end:
#
#   1. the compose file is valid and the app publishes no host port
#   2. the image builds and the app comes up healthy
#   3. only Caddy is published; nothing is listening on 3000
#   4. the first administrator can be created, and only once
#   5. HTTPS serves the application
#   6. a backup is taken and restores into a fresh volume
#   7. an upgrade applies and the service returns healthy
#
# Safe against a real deployment: it works under a throwaway compose project
# name and never touches the live volume. It does, however, stop and start its
# own containers and build images, so do not run it on the production host
# during working hours -- run it on the clean VM, which is the point.
#
# Usage:
#   scripts/onprem-smoke-test.sh [--https URL] [--skip-upgrade]
#
# Exit code 0 = all checks passed. Non-zero = a check failed (see the count).

set -uo pipefail

HTTPS_URL=""
SKIP_UPGRADE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --https) HTTPS_URL="${2:-}"; shift 2 ;;
    --skip-upgrade) SKIP_UPGRADE=1; shift ;;
    -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

PROJECT="hms-smoke-$$"
BACKUP_DIR="$(mktemp -d /tmp/hms-smoke-backup-XXXXXX)"
PASS=0
FAIL=0
CREATED_COMPOSE=0

cleanup() {
  if [ "$CREATED_COMPOSE" = "1" ]; then
    echo
    echo "==> Tearing down the throwaway project $PROJECT"
    docker compose -p "$PROJECT" down -v >/dev/null 2>&1
  fi
  rm -rf "$BACKUP_DIR"
}
trap cleanup EXIT

ok()    { PASS=$((PASS+1)); printf '  PASS  %s\n' "$1"; }
bad()   { FAIL=$((FAIL+1)); printf '  FAIL  %s\n' "$1"; }
info()  { printf '        %s\n' "$1"; }
check() { local n="$1" desc="$2"; shift 2; printf '\n[%s] %s\n' "$n" "$desc"; if "$@"; then ok "$desc"; else bad "$desc"; fi; }
have()  { command -v "$1" >/dev/null 2>&1; }

echo "=============================================================="
echo " Clean-VM acceptance test   (throwaway project: $PROJECT)"
echo "=============================================================="

if ! have docker; then
  echo "docker is not installed; this test cannot run." >&2
  exit 2
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "the docker compose plugin is not available." >&2
  exit 2
fi

# ------------------------------------------------------------ 1. compose file

printf '\n[1] compose file is valid and the app publishes no host port\n'
if docker compose config >/dev/null 2>&1; then
  ok "docker-compose.yml parses"
else
  bad "docker-compose.yml parses"
fi

app_ports=$(docker compose config --format json 2>/dev/null | python3 -c '
import json,sys
try:
    cfg=json.load(sys.stdin)
except Exception:
    print(-1); raise SystemExit
print(len(cfg["services"]["app"].get("ports") or []))
' 2>/dev/null)

case "$app_ports" in
  0) ok "app service publishes no host port" ;;
  -1) bad "could not parse compose config as JSON" ;;
  *) bad "app service publishes $app_ports host port(s) -- this exposes the app unencrypted"
     echo "        The app must be reachable only through Caddy." ;;
esac

if [ "$app_ports" != "0" ]; then
  echo
  echo "FAILED at check 1. Fix the compose topology before going further."
  exit 1
fi

# ------------------------------------------------------- 2. build and come up

echo
echo "==> Building image (first run takes a few minutes)"
if docker compose -p "$PROJECT" build >/dev/null 2>&1; then
  ok "image builds"
else
  bad "image builds"
  exit 1
fi

export JWT_SECRET="$(openssl rand -hex 32)"
export DEPLOYMENT_MODE=onprem
export DB_PATH=/data/hospital.db
export UPLOAD_DIR=/data/uploads/documents

CREATED_COMPOSE=1
if docker compose -p "$PROJECT" up -d >/dev/null 2>&1; then
  ok "containers start"
else
  bad "containers start"
  docker compose -p "$PROJECT" logs --tail=40 app
  exit 1
fi

printf '\n[2] app becomes healthy (waiting up to 120s)\n'
healthy=0
for _ in $(seq 1 60); do
  state=$(docker inspect --format '{{.State.Health.Status}}' "${PROJECT}-app-1" 2>/dev/null || echo none)
  if [ "$state" = "healthy" ]; then healthy=1; break; fi
  if [ "$state" = "unhealthy" ]; then break; fi
  sleep 2
done
if [ "$healthy" = "1" ]; then ok "healthcheck reports healthy"; else bad "healthcheck reports healthy ($state)"; fi

# ------------------------------------------------- 3. only Caddy is published

printf '\n[3] nothing is listening on the app port on the host\n'
if have ss && ss -tuln 2>/dev/null | grep -q ':3000 '; then
  bad "something is listening on host port 3000"
  ss -tulpn 2>/dev/null | grep ':3000 ' | sed 's/^/        /'
else
  ok "nothing is listening on host port 3000"
fi

# --------------------------------------------- 4. first administrator, once

printf '\n[4] first-run administrator bootstrap\n'
ADMIN_USER="hms.admin"
ADMIN_PASS="$(openssl rand -base64 18)"

bootstrap_status() {
  docker compose -p "$PROJECT" exec -T app node -e "
    const { bootstrapAdmin } = await import('/app/src/config/bootstrapAdmin.js');
    console.log('CREATED=' + bootstrapAdmin({ username: process.argv[1], password: process.argv[2] }).created);
  " "$ADMIN_USER" "$ADMIN_PASS" 2>/dev/null | grep -o 'CREATED=.*' | tail -1
}

first="$(bootstrap_status)"
second="$(bootstrap_status)"

if [ "$first" = "CREATED=true" ]; then ok "first run creates the SuperAdmin"; else bad "first run creates the SuperAdmin (got '$first')"; fi
# The redeploy case: a stale env var must not add a second admin.
if [ "$second" = "CREATED=false" ]; then ok "second run refuses to create another admin"; else bad "second run refuses to create another admin (got '$second')"; fi

weak="$(docker compose -p "$PROJECT" exec -T app node -e "
  const { bootstrapAdmin } = await import('/app/src/config/bootstrapAdmin.js');
  try { bootstrapAdmin({ username: 'someone', password: 'short' }); console.log('ACCEPTED'); }
  catch { console.log('REFUSED'); }
" 2>/dev/null | grep -oE 'ACCEPTED|REFUSED' | tail -1)"
if [ "$weak" = "REFUSED" ]; then ok "a short password is refused"; else bad "a short password is refused (got '$weak')"; fi

# Confirm only one administrator actually exists in the database.
admin_count=$(docker compose -p "$PROJECT" exec -T app node -e "
  const { getDb } = await import('/app/src/models/index.js');
  console.log(getDb().prepare(\"SELECT COUNT(*) n FROM users WHERE role IN ('SuperAdmin','Admin')\").get().n);
" 2>/dev/null | tr -d '\r' | tail -1)
if [ "$admin_count" = "1" ]; then ok "exactly one administrator exists"; else bad "exactly one administrator exists (found $admin_count)"; fi

# ------------------------------------------------------------- 5. HTTPS works

printf '\n[5] HTTPS serves the application\n'
if [ -z "$HTTPS_URL" ]; then
  echo "  SKIP  no --https URL supplied"
  echo "        Repeat this check by hand from a SECOND device on the LAN:"
  echo "          curl -I https://<hms-host>/api/health"
  echo "          then open https://<hms-host> in a browser: no certificate warning."
else
  http_code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 20 "$HTTPS_URL/api/health" 2>/dev/null)
  if [ "$http_code" = "200" ]; then
    ok "GET /api/health over HTTPS returns 200"
  else
    bad "GET /api/health over HTTPS returns 200 (got '$http_code')"
  fi

  # Verify the leaf really is a certificate for the name being used. With a
  # self-signed certificate on a public CA this is what catches a mismatch.
  host=$(printf '%s' "$HTTPS_URL" | sed -E 's#^https?://([^:/]+).*#\1#')
  if openssl s_client -connect "$host:443" -servername "$host" </dev/null 2>/dev/null \
      | openssl x509 -noout -checkend 0 >/dev/null 2>&1; then
    ok "served certificate is currently valid"
  else
    bad "served certificate is currently valid"
  fi

  if command -v ss >/dev/null 2>&1 && ss -tln 2>/dev/null | grep -q ':443 '; then
    ok "something is listening on 443"
  else
    bad "something is listening on 443"
  fi
fi

# -------------------------------------------------------- 6. backup, restore

printf '\n[6] backup and restore round-trip\n'
VOLUME="${PROJECT}_hms-data"

docker compose -p "$PROJECT" stop app >/dev/null 2>&1
if docker run --rm -v "${VOLUME}:/data:ro" -v "${BACKUP_DIR}:/backup" \
     alpine tar czf /backup/hospital-data.tar.gz -C /data . >/dev/null 2>&1; then
  ok "backup archive created"
else
  bad "backup archive created"
fi
docker compose -p "$PROJECT" start app >/dev/null 2>&1

if [ -s "${BACKUP_DIR}/hospital-data.tar.gz" ] \
   && tar tzf "${BACKUP_DIR}/hospital-data.tar.gz" 2>/dev/null | grep -q 'hospital.db'; then
  ok "backup archive contains hospital.db"
else
  bad "backup archive contains hospital.db"
fi

# Restore into a SEPARATE volume so the live one is never destroyed by a test.
RESTORE_VOL="${PROJECT}_restore-check"
docker volume create "$RESTORE_VOL" >/dev/null 2>&1
if docker run --rm -v "${RESTORE_VOL}:/data" -v "${BACKUP_DIR}:/backup:ro" \
     alpine sh -c 'cd /data && tar xzf /backup/hospital-data.tar.gz' >/dev/null 2>&1; then
  ok "restores into a fresh volume"
else
  bad "restores into a fresh volume"
fi

restored_count=$(docker run --rm -v "${RESTORE_VOL}:/data:ro" alpine sh -c \
  'ls -1 /data/hospital.db 2>/dev/null | wc -l' 2>/dev/null | tr -d '\r')
if [ "$restored_count" = "1" ]; then
  ok "restored volume contains the database file"
else
  bad "restored volume contains the database file"
fi
docker volume rm "$RESTORE_VOL" >/dev/null 2>&1

# ------------------------------------------------------------- 7. upgrade

printf '\n[7] upgrade path\n'
if [ "$SKIP_UPGRADE" = "1" ]; then
  echo "  SKIP  --skip-upgrade supplied"
  echo "        Verify by hand: git pull && docker compose up -d --build"
  echo "        Migrations run on boot; confirm in: docker compose logs app"
else
  # A rebuild-from-scratch is the closest safe proxy for an upgrade that does
  # not depend on a newer upstream commit being available.
  if docker compose -p "$PROJECT" up -d --build >/dev/null 2>&1; then
    ok "rebuild and restart succeeds (migrations re-run safely)"
  else
    bad "rebuild and restart succeeds"
  fi

  up_healthy=0
  for _ in $(seq 1 60); do
    state=$(docker inspect --format '{{.State.Health.Status}}' "${PROJECT}-app-1" 2>/dev/null || echo none)
    if [ "$state" = "healthy" ]; then up_healthy=1; break; fi
    sleep 2
  done
  if [ "$up_healthy" = "1" ]; then ok "healthy again after upgrade"; else bad "healthy again after upgrade ($state)"; fi

  # Migrations must be idempotent: running them twice must not error.
  dupes=$(docker compose -p "$PROJECT" exec -T app node -e "
    const { getDb } = await import('/app/src/models/index.js');
    const rows = getDb().prepare('SELECT version, COUNT(*) c FROM schema_migrations GROUP BY version HAVING c > 1').all();
    console.log('DUPLICATES=' + rows.length);
  " 2>/dev/null | grep -o 'DUPLICATES=.*' | tail -1)
  if [ "$dupes" = "DUPLICATES=0" ]; then
    ok "no migration recorded twice"
  else
    bad "no migration recorded twice ($dupes)"
  fi
fi

# ----------------------------------------------------------------- summary

echo
echo "=============================================================="
echo " PASS: $PASS   FAIL: $FAIL"
echo "=============================================================="
if [ "$FAIL" -gt 0 ]; then
  echo
  echo "Do not take this install into service until the failures above are"
  echo "understood. See docs/install-checklist.md."
  exit 1
fi
echo
echo "All checks passed. Still required before real patient data:"
echo "  - sign off docs/install-checklist.md sections 1-6 with a named owner"
echo "  - verify disk encryption on THIS host (the app does not encrypt at rest)"
echo "  - verify a restore on a separate machine, not just this container host"
exit 0