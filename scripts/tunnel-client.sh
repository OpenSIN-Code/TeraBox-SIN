#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TUNNEL_CLIENT=${TUNNEL_CLIENT:-$(command -v tunnel-client || true)}

if [ -z "$TUNNEL_CLIENT" ]; then
  printf '%s\n' 'tunnel-client is not installed. Install the official OpenAI tunnel-client binary first.' >&2
  exit 1
fi
if [ -z "${CONTROL_PLANE_TUNNEL_ID:-}" ]; then
  printf '%s\n' 'CONTROL_PLANE_TUNNEL_ID is required.' >&2
  exit 1
fi
if [ -z "${CONTROL_PLANE_API_KEY:-}" ]; then
  printf '%s\n' 'CONTROL_PLANE_API_KEY is required.' >&2
  exit 1
fi

exec "$TUNNEL_CLIENT" run \
  --control-plane.tunnel-id "$CONTROL_PLANE_TUNNEL_ID" \
  --mcp.command "node $ROOT/src/sin/stdio.js" \
  --health.listen-addr 127.0.0.1:0 \
  --health.url-file "$HOME/Library/Application Support/TeraBox-SIN/tunnel-health.url" \
  --log.level info \
  --log.format struct-text
