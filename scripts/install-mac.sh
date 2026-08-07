#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
WOW_ROOT=${WOW_MY_ZSH_ROOT:-$HOME/dev/wow-my-zsh}

cd "$ROOT"
npm install
npm run check
node scripts/install-wow-my-zsh.js "$WOW_ROOT"

mkdir -p "$HOME/.local/bin"
ln -sfn "$ROOT/bin/terabox-sin" "$HOME/.local/bin/terabox-sin"
ln -sfn "$ROOT/bin/terabox-sin-mcp" "$HOME/.local/bin/terabox-sin-mcp"

python3 "$WOW_ROOT/scripts/validate-mcp-registry.py"
python3 "$WOW_ROOT/scripts/gen-mcp.py" claude --profile full >/dev/null
python3 "$WOW_ROOT/scripts/gen-mcp.py" opencode --profile full >/dev/null
python3 "$WOW_ROOT/scripts/gen-mcp.py" codex --profile full >/dev/null
python3 "$WOW_ROOT/scripts/gen-mcp.py" cline --profile full >/dev/null
python3 "$WOW_ROOT/scripts/gen-mcp.py" jcode --profile full >/dev/null
python3 "$WOW_ROOT/scripts/gen-mcp.py" mimo --profile full >/dev/null

printf '%s\n' 'TeraBox-SIN installation and wow-my-zsh registry validation complete.'
