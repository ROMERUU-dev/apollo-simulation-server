#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://127.0.0.1:8088"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

request() {
  local method="$1"
  local path="$2"
  local body_file="$tmp_dir/body"
  local headers_file="$tmp_dir/headers"

  curl -sS \
    -X "$method" \
    -o "$body_file" \
    -D "$headers_file" \
    -w '%{http_code}' \
    "${BASE_URL}${path}"
}

expect_status() {
  local method="$1"
  local path="$2"
  local expected="$3"
  local actual

  actual="$(request "$method" "$path")"
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

expect_status GET /api/unknown 404
expect_status GET /healthz 404
expect_status GET /readyz 404
expect_status GET /docs 404
expect_status GET /redoc 404
expect_status GET /openapi.json 404
expect_status POST /api/health 405

printf 'API proxy smoke test PASS\n'
