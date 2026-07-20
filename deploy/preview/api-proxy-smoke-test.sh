#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8088}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

request() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local body_file="$tmp_dir/body"
  local headers_file="$tmp_dir/headers"
  local -a request_args=(
    -sS
    --path-as-is
    -o "$body_file"
    -D "$headers_file"
    -w '%{http_code}'
  )

  if [[ "$method" == "HEAD" ]]; then
    request_args+=(--head)
  else
    request_args+=(-X "$method")
  fi
  if [[ -n "$data" ]]; then
    request_args+=(-H "Content-Type: application/json" --data "$data")
  fi
  curl "${request_args[@]}" "${BASE_URL}${path}"
}

expect_status() {
  local method="$1"
  local path="$2"
  local expected="$3"
  local data="${4:-}"
  local actual

  actual="$(request "$method" "$path" "$data")"
  if [[ "$actual" != "$expected" ]]; then
    printf 'FAIL %s %s expected %s got %s\n' "$method" "$path" "$expected" "$actual" >&2
    exit 1
  fi
  printf 'PASS %s %s -> %s\n' "$method" "$path" "$expected"
}

expect_body_contains() {
  local expected="$1"
  if ! grep -Fq "$expected" "$tmp_dir/body"; then
    printf 'FAIL response body did not contain expected fragment\n' >&2
    exit 1
  fi
}

expect_cache_no_store() {
  if ! awk 'BEGIN{IGNORECASE=1} /^cache-control:[[:space:]]*no-store[[:space:]]*$/ {found=1} END{exit found ? 0 : 1}' "$tmp_dir/headers"; then
    printf 'FAIL expected Cache-Control: no-store\n' >&2
    exit 1
  fi
}

expect_status GET /health 200
expect_body_contains "ok"

expect_status GET / 200

expect_status GET /api/health 401
expect_body_contains '"error"'
expect_cache_no_store

expect_status GET /api/me 401
expect_body_contains '"error"'
expect_cache_no_store

expect_status GET /api/admin/monitoring/summary 401
expect_status GET '/api/admin/monitoring/history?range=1h' 401
expect_status POST /api/admin/monitoring/summary 405
expect_status GET /api/admin/monitoring/prometheus 404

valid_job_id="job_00000000000000000000000000000000"
valid_body='{"name":"Proxy smoke","template_id":"rc_lowpass_fixed_v1"}'
expect_status GET /api/jobs 401
expect_status HEAD /api/jobs 401
expect_status POST /api/jobs 401 "$valid_body"
expect_status POST /api/jobs/preflight 401 '{"name":"x","template_id":"custom_xyce_netlist_v1","netlist":"* x\\nR1 a 0 1k\\n.TRAN 1u 1m\\n.END\\n","requested_outputs":["V(a)"]}'
expect_status GET "/api/jobs/${valid_job_id}" 401
expect_status HEAD "/api/jobs/${valid_job_id}" 401
expect_status GET "/api/jobs/${valid_job_id}/artifacts" 401
expect_status HEAD "/api/jobs/${valid_job_id}/artifacts" 401
expect_status GET "/api/jobs/${valid_job_id}/artifacts/waveform.csv" 401
expect_status HEAD "/api/jobs/${valid_job_id}/artifacts/waveform.csv" 401
expect_status GET "/api/jobs/${valid_job_id}/artifacts/results.csv" 401
expect_status HEAD "/api/jobs/${valid_job_id}/artifacts/results.csv" 401
expect_status GET /api/jobs/foo 404
expect_status GET /api/jobs/job_../artifacts 404
expect_status GET /api/jobs/job_000000000000000000000000000000000 404
expect_status DELETE /api/jobs 405
expect_status PUT "/api/jobs/${valid_job_id}" 405
expect_status PATCH "/api/jobs/${valid_job_id}/artifacts" 405

expect_status GET /api/unknown 404
expect_status GET /healthz 404
expect_status GET /readyz 404
expect_status GET /docs 404
expect_status GET /redoc 404
expect_status GET /openapi.json 404
expect_status GET /metrics 404
expect_status POST /api/health 405

printf 'API proxy smoke test PASS\n'
