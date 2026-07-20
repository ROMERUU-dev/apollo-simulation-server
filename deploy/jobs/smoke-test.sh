#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="http://127.0.0.1:8089"
VOLUME="cimasim-job-spool"
WORKER="cimasim-xyce-worker"

expect_status() {
  local path="$1"
  local expected="$2"
  local actual
  actual="$(curl -sS -o /dev/null -w '%{http_code}' "${BACKEND_URL}${path}")"
  if [[ "$actual" != "$expected" ]]; then
    printf 'FAIL %s expected %s got %s\n' "$path" "$expected" "$actual" >&2
    exit 1
  fi
}

docker volume inspect "$VOLUME" >/dev/null
docker run --rm --network none --read-only -v "$VOLUME:/spool:ro" busybox:1.36 sh -eu -c '
  for path in /spool /spool/queued /spool/claimed /spool/jobs /spool/failed; do
    [ -d "$path" ] && [ ! -L "$path" ]
    [ "$(stat -c %g "$path")" = 10003 ]
    [ "$(stat -c %a "$path")" = 2770 ]
  done
'

worker_state="$(docker inspect -f '{{.State.Status}}' "$WORKER")"
worker_health="$(docker inspect -f '{{.State.Health.Status}}' "$WORKER")"
[[ "$worker_state" == "running" && "$worker_health" == "healthy" ]]
[[ "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$WORKER")" == "none" ]]
[[ "$(docker inspect -f '{{.HostConfig.ReadonlyRootfs}}' "$WORKER")" == "true" ]]
[[ "$(docker inspect -f '{{len .HostConfig.PortBindings}}' "$WORKER")" == "0" ]]
[[ "$(docker inspect -f '{{.HostConfig.PidsLimit}}' "$WORKER")" == "128" ]]
[[ "$(docker inspect -f '{{.HostConfig.Memory}}' "$WORKER")" == "2147483648" ]]
[[ "$(docker inspect -f '{{.HostConfig.NanoCpus}}' "$WORKER")" == "2000000000" ]]
[[ "$(docker inspect -f '{{join .HostConfig.CapDrop ","}}' "$WORKER")" == "ALL" ]]
worker_security="$(docker inspect -f '{{join .HostConfig.SecurityOpt ","}}' "$WORKER")"
[[ "$worker_security" == *"no-new-privileges"* ]]
[[ "$(docker inspect -f '{{range .Mounts}}{{.Name}}:{{.Destination}} {{end}}' "$WORKER")" == "${VOLUME}:/spool " ]]
[[ "$(docker exec "$WORKER" id -u)" == "10002" ]]
[[ "$(docker exec "$WORKER" id -g)" == "10002" ]]
worker_groups="$(docker exec "$WORKER" id -G)"
[[ " $worker_groups " == *" 10003 "* ]]

expect_status /healthz 200
expect_status /readyz 200
expect_status /api/health 401
expect_status /api/jobs 401

deploy/preview/api-proxy-smoke-test.sh
printf 'Production fixed-job smoke test PASS\n'
