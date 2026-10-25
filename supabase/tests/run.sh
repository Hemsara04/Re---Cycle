#!/usr/bin/env bash
# Runs every migration + the scenario tests against a throwaway PostGIS container.
# Needs Docker. Usage: ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=recycle-dbtest
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --platform linux/amd64 --name "$NAME" -e POSTGRES_PASSWORD=test \
  -v "$PWD/tests:/work:ro" -v "$PWD/migrations:/migrations:ro" postgis/postgis:17-3.5 >/dev/null
trap 'docker rm -f "$NAME" >/dev/null' EXIT
until docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
sleep 3
# fresh database without the image's pre-installed PostGIS (Supabase keeps it in `extensions`)
docker exec "$NAME" psql -U postgres -q -c "create database app template template0"
psql() { docker exec "$NAME" psql -U postgres -d app -v ON_ERROR_STOP=1 -q "$@"; }
psql -f /work/00_supabase_standins.sql
for f in migrations/*.sql; do echo "→ $f"; psql -f "/migrations/$(basename "$f")"; done
for f in tests/[1-9]*.sql; do psql -f "/work/$(basename "$f")" 2>&1 | sed -n 's/.*NOTICE:  //p; /PASSED/p; /ERROR/p'; done
