#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 custom_runner/dist/cimasim-custom-dispatcher-<sha>.manifest" >&2
  exit 2
fi

manifest="$1"
declare commit_sha="" source_archive="" source_sha256="" wheel="" wheel_sha256="" systemd_unit="" systemd_unit_sha256=""

while IFS='=' read -r key value; do
  case "$key" in
    commit_sha) commit_sha="$value" ;;
    source_archive) source_archive="$value" ;;
    source_sha256) source_sha256="$value" ;;
    wheel) wheel="$value" ;;
    wheel_sha256) wheel_sha256="$value" ;;
    systemd_unit) systemd_unit="$value" ;;
    systemd_unit_sha256) systemd_unit_sha256="$value" ;;
  esac
done < "$manifest"

require_hash() {
  local path="$1"
  local expected="$2"
  if [[ ! "$expected" =~ ^[0-9a-f]{64}$ || ! -f "$path" ]]; then
    echo "missing artifact or invalid hash for $path" >&2
    exit 1
  fi
  local actual
  actual="$(sha256sum "$path" | awk '{print $1}')"
  if [[ "$actual" != "$expected" ]]; then
    echo "hash mismatch for $path" >&2
    echo "expected $expected" >&2
    echo "actual   $actual" >&2
    exit 1
  fi
}

if [[ ! "$commit_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "invalid commit_sha in manifest" >&2
  exit 1
fi

require_hash "$source_archive" "$source_sha256"
require_hash "$wheel" "$wheel_sha256"
require_hash "$systemd_unit" "$systemd_unit_sha256"

install -d -o root -g root -m 0755 /opt/cimasim
python3 -m venv /opt/cimasim/custom-dispatcher
/opt/cimasim/custom-dispatcher/bin/python -m pip install --no-deps --force-reinstall "$wheel"
install -o root -g root -m 0644 "$systemd_unit" /etc/systemd/system/cimasim-custom-dispatcher.service
systemd-analyze verify /etc/systemd/system/cimasim-custom-dispatcher.service
/opt/cimasim/custom-dispatcher/bin/cimasim-custom-dispatcher --version
