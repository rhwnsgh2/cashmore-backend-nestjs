#!/usr/bin/env bash
#
# WARNING: TEST DATABASE ONLY.
# Disables fsync and other durability features. Never run against the dev/prod
# Supabase instance. Targets the supabase_db_* container of supabase-test only.

set -euo pipefail

CONTAINER=$(docker ps --filter "name=supabase_db_" --format "{{.Names}}" | head -n1)
if [[ -z "$CONTAINER" ]]; then
  echo "[tune-postgres] no running supabase_db_* container found" >&2
  exit 1
fi

# Hard guard: this container must be the test instance.
# The test compose project is `cashmore-test` (see supabase-test/supabase/config.toml).
case "$CONTAINER" in
  *cashmore-test*) ;;
  *)
    echo "[tune-postgres] refusing to tune non-test container: $CONTAINER" >&2
    exit 1
    ;;
esac

echo "[tune-postgres] target container: $CONTAINER"

PSQL=(docker exec -i "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U supabase_admin -d postgres)

echo "[tune-postgres] applying ALTER SYSTEM settings"
"${PSQL[@]}" <<'SQL'
ALTER SYSTEM SET fsync = 'off';
ALTER SYSTEM SET synchronous_commit = 'off';
ALTER SYSTEM SET full_page_writes = 'off';
ALTER SYSTEM SET shared_buffers = '512MB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '256MB';
ALTER SYSTEM SET checkpoint_timeout = '30min';
ALTER SYSTEM SET max_wal_size = '4GB';
ALTER SYSTEM SET autovacuum = 'off';
ALTER SYSTEM SET bgwriter_delay = '10s';
SELECT pg_reload_conf();
SQL

echo "[tune-postgres] restarting $CONTAINER for restart-only params"
docker restart "$CONTAINER" >/dev/null

echo -n "[tune-postgres] waiting for postgres "
READY=0
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    READY=1
    echo "ready"
    break
  fi
  echo -n "."
  sleep 1
done

if [[ "$READY" -ne 1 ]]; then
  echo
  echo "[tune-postgres] postgres did not become ready" >&2
  exit 1
fi

echo "[tune-postgres] verifying applied settings:"
"${PSQL[@]}" -c "SHOW fsync;"
"${PSQL[@]}" -c "SHOW synchronous_commit;"
"${PSQL[@]}" -c "SHOW full_page_writes;"
"${PSQL[@]}" -c "SHOW shared_buffers;"
"${PSQL[@]}" -c "SHOW autovacuum;"

echo "[tune-postgres] done"
