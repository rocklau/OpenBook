#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <traceId> [logFile]" >&2
  echo "Example: $0 web-mlki4qnp-pui8a3 /tmp/openbook.log" >&2
  exit 1
fi

TRACE_ID="$1"
LOG_FILE="${2:-/tmp/openbook.log}"

if [[ ! -f "$LOG_FILE" ]]; then
  echo "Log file not found: $LOG_FILE" >&2
  exit 2
fi

echo "[trace-grep] traceId=$TRACE_ID"
echo "[trace-grep] logFile=$LOG_FILE"
echo ""

rg -n --no-heading "$TRACE_ID|x-openbook-trace-id|x-openbook-action-id|request.start|request.end|API/articles|API/activity|API/debug|Sync|feed]" "$LOG_FILE" \
  | rg "$TRACE_ID|request.start|request.end|API/articles|API/activity|API/debug" || true
