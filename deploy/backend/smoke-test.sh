#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://127.0.0.1:8089"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

request() {
  local path="$1"
  local body_file="$tmp_dir/body"
  local headers_file="$tmp_dir/headers"
  local status

  status="$(
    curl -sS \
      -o "$body_file" \
      -D "$headers_file" \
      -w '%{http_code}' \
      "${BASE_URL}${path}"
  )"

  printf '%s\n' "$status"
}

expect_status() {
  local path="$1"
  local expected="$2"
  local actual

  actual="$(request "$path")"
  if [[ "$actual" != "$expected" ]]; then
    printf 'FAIL %s expected %s got %s\n' "$path" "$expected" "$actual" >&2
    exit 1
  fi
  printf 'PASS %s -> %s\n' "$path" "$expected"
}

expect_body_contains() {
  local expected="$1"
  if ! grep -Fq "$expected" "$tmp_dir/body"; then
    printf 'FAIL response body did not contain expected JSON fragment\n' >&2
    exit 1
  fi
}

expect_cache_no_store() {
  if ! awk 'BEGIN{IGNORECASE=1} /^cache-control:[[:space:]]*no-store[[:space:]]*$/ {found=1} END{exit found ? 0 : 1}' "$tmp_dir/headers"; then
    printf 'FAIL expected Cache-Control: no-store\n' >&2
    exit 1
  fi
}

expect_status "/healthz" "200"
expect_body_contains '"status":"ok"'
expect_body_contains '"service":"cimasim-api"'

expect_status "/readyz" "200"
expect_body_contains '"status":"ready"'
expect_body_contains '"auth_configuration":"ok"'
expect_body_contains '"job_spool":"ok"'

expect_status "/api/health" "401"
expect_cache_no_store

expect_status "/api/me" "401"
expect_cache_no_store

expect_status "/api/jobs" "401"
expect_cache_no_store

expect_status "/docs" "404"
expect_status "/redoc" "404"
expect_status "/openapi.json" "404"

printf 'Smoke test PASS\n'
