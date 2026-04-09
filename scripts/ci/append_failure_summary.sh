#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -lt 4 ] || [ "$#" -gt 5 ]; then
  echo "usage: $0 <mode> <title> <log-file> <status> [summary-file]" >&2
  exit 1
fi

mode="$1"
title="$2"
log_file="$3"
status="$4"
summary_file="${5:-${GITHUB_STEP_SUMMARY:-}}"

if [ -z "${summary_file}" ]; then
  echo "summary file path is required" >&2
  exit 1
fi

append_line() {
  printf '%s\n' "$1" >> "$summary_file"
}

append_blank_line() {
  printf '\n' >> "$summary_file"
}

clean_log="$(mktemp)"
trap 'rm -f "$clean_log"' EXIT
sed -E 's/\x1B\[[0-9;]*[A-Za-z]//g' "$log_file" > "$clean_log"

append_line "### $title"

if [ "$status" = "success" ]; then
  append_line "- Status: passed"
  append_blank_line
  exit 0
fi

append_line "- Status: failed"
append_line "- Failure summary:"

case "$mode" in
  predeploy)
    if ! grep -E '^[[:space:]]*✗ ' "$clean_log" | sed 's/^[[:space:]]*/  - /' >> "$summary_file"; then
      append_line "  - No explicit failing pre-deploy check was extracted from the log."
    fi
    ;;
  test)
    matches="$(mktemp)"
    trap 'rm -f "$clean_log" "$matches"' EXIT
    grep -E '(^--- FAIL: |^FAIL[[:space:]]+|^[[:space:]]*× )' "$clean_log" | awk '!seen[$0]++' > "$matches" || true

    if [ -s "$matches" ]; then
      while IFS= read -r line; do
        append_line "  - $line"
      done < "$matches"
    else
      append_line "  - No specific failing test names were extracted from the log."
    fi
    ;;
  *)
    echo "unsupported mode: $mode" >&2
    exit 1
    ;;
esac

append_blank_line
