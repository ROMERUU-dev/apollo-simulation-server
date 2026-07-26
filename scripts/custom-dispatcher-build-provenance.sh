#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PYTHON="${PYTHON:-python3}"
if [[ -n "$(git status --porcelain=v1)" ]]; then
  echo "refusing to build provenance from a dirty worktree" >&2
  exit 1
fi

commit_sha="$(git rev-parse HEAD)"
short_sha="${commit_sha:0:12}"
source_archive="custom_runner/dist/cimasim-custom-dispatcher-source-${short_sha}.tar"
manifest="custom_runner/dist/cimasim-custom-dispatcher-${short_sha}.manifest"
unit="deploy/custom-dispatcher/cimasim-custom-dispatcher.service"

rm -rf custom_runner/build custom_runner/dist
mkdir -p custom_runner/dist

git archive --format=tar --prefix="apollo-simulation-server-${commit_sha}/" \
  HEAD custom_runner deploy/custom-dispatcher > "$source_archive"

"$PYTHON" -m build --wheel custom_runner

wheel="$(find custom_runner/dist -maxdepth 1 -type f -name 'cimasim_custom_runner-*.whl' | sort | tail -n 1)"
if [[ -z "$wheel" ]]; then
  echo "dispatcher wheel was not produced" >&2
  exit 1
fi

{
  printf 'commit_sha=%s\n' "$commit_sha"
  printf 'source_archive=%s\n' "$source_archive"
  printf 'source_sha256=%s\n' "$(sha256sum "$source_archive" | awk '{print $1}')"
  printf 'wheel=%s\n' "$wheel"
  printf 'wheel_sha256=%s\n' "$(sha256sum "$wheel" | awk '{print $1}')"
  printf 'systemd_unit=%s\n' "$unit"
  printf 'systemd_unit_sha256=%s\n' "$(sha256sum "$unit" | awk '{print $1}')"
} > "$manifest"

cat "$manifest"
