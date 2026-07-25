#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_NAME="$(basename "$0")"
MODE="dry-run"
STATUS_PASS=0
STATUS_WARN=0
STATUS_BLOCKER=0

usage() {
  cat <<USAGE
Usage: $SCRIPT_NAME [--dry-run|--apply]

Defaults to --dry-run. --apply is required before any host modification.
USAGE
}

parse_mode() {
  MODE="dry-run"
  while (($#)); do
    case "$1" in
      --dry-run)
        MODE="dry-run"
        ;;
      --apply)
        MODE="apply"
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        blocker "unknown argument: $1"
        usage
        exit 2
        ;;
    esac
    shift
  done
}

log() {
  printf '%s\n' "$*"
}

pass() {
  STATUS_PASS=$((STATUS_PASS + 1))
  printf 'PASS %s\n' "$*"
}

warn() {
  STATUS_WARN=$((STATUS_WARN + 1))
  printf 'WARN %s\n' "$*"
}

blocker() {
  STATUS_BLOCKER=$((STATUS_BLOCKER + 1))
  printf 'BLOCKER %s\n' "$*" >&2
}

require_dry_run_default() {
  if [[ "$MODE" == "apply" ]]; then
    warn "apply mode requested; script must complete preflight before modifying anything"
  else
    pass "dry-run mode active"
  fi
}

require_ubuntu() {
  if [[ -r /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    if [[ "${ID:-}" == "ubuntu" ]]; then
      pass "Ubuntu detected: ${VERSION_ID:-unknown}"
    else
      blocker "unsupported OS: ${ID:-unknown}"
    fi
  else
    blocker "/etc/os-release is missing"
  fi
}

require_command() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    pass "command available: $cmd"
  else
    warn "command missing: $cmd"
  fi
}

require_mountpoint() {
  local path="$1"
  if findmnt -T "$path" >/dev/null 2>&1; then
    pass "mount target resolvable: $path"
  else
    blocker "mount target not resolvable: $path"
  fi
}

detect_mutable_image() {
  local image="$1"
  if [[ "$image" == *":latest"* && "$image" != *@sha256:* ]]; then
    warn "mutable image tag without digest: $image"
  elif [[ "$image" == *"@"sha256:* ]]; then
    pass "image pinned by digest: $image"
  else
    warn "image lacks digest: $image"
  fi
}

assert_no_forbidden_args() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      *prune* | *'chmod 777'*)
        blocker "forbidden operation token detected: $arg"
        ;;
    esac
  done
}

run_or_show() {
  assert_no_forbidden_args "$@"
  if [[ "$MODE" == "apply" ]]; then
    log "+ $*"
    "$@"
  else
    log "DRY-RUN $*"
  fi
}

check_subid_range() {
  local user="$1"
  if grep -q "^${user}:" /etc/subuid 2>/dev/null && grep -q "^${user}:" /etc/subgid 2>/dev/null; then
    pass "subuid/subgid present for $user"
  else
    warn "subuid/subgid missing for $user"
  fi
}

check_user_collision() {
  local user="$1"
  local uid="$2"
  if getent passwd "$user" >/dev/null 2>&1; then
    warn "user already exists: $user"
  fi
  if getent passwd "$uid" >/dev/null 2>&1; then
    warn "uid already allocated: $uid"
  else
    pass "uid appears available: $uid"
  fi
}

check_group_collision() {
  local group="$1"
  local gid="$2"
  if getent group "$group" >/dev/null 2>&1; then
    warn "group already exists: $group"
  fi
  if getent group "$gid" >/dev/null 2>&1; then
    warn "gid already allocated: $gid"
  else
    pass "gid appears available: $gid"
  fi
}

summary() {
  if ((STATUS_BLOCKER > 0)); then
    printf 'SUMMARY PASS=%d WARN=%d BLOCKER=%d RESULT=BLOCKER\n' "$STATUS_PASS" "$STATUS_WARN" "$STATUS_BLOCKER"
    exit 1
  fi
  if ((STATUS_WARN > 0)); then
    printf 'SUMMARY PASS=%d WARN=%d BLOCKER=%d RESULT=WARN\n' "$STATUS_PASS" "$STATUS_WARN" "$STATUS_BLOCKER"
    return 0
  fi
  printf 'SUMMARY PASS=%d WARN=%d BLOCKER=%d RESULT=PASS\n' "$STATUS_PASS" "$STATUS_WARN" "$STATUS_BLOCKER"
}

