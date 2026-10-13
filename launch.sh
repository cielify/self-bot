#!/usr/bin/env bash
RED='\033[0;91m'; GRY='\033[0;90m'; SLV='\033[0;37m'; RST='\033[0m'
_ok()  { printf "  ${RED}✔${RST}  ${SLV}%s${RST}\n" "$*"; }
_err() { printf "  ${RED}✘${RST}  ${SLV}%s${RST}\n" "$*" >&2; }
_inf() { printf "  ${GRY}◆${RST}  ${SLV}%s${RST}\n" "$*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

_inf "Extracting Discord token..."

TOKEN="$(node "$SCRIPT_DIR/extract-token.js" 2>/tmp/ozeu-extract-err)"

if [ -z "$TOKEN" ]; then
  _err "Auto-extract failed:"
  cat /tmp/ozeu-extract-err >&2
  echo ""
  echo "  Try ONE of these:"
  echo "  1. Open Discord first, then run ./launch.sh again"
  echo "  2. Paste your token manually:"
  printf "  Token: "
  read -rs TOKEN
  echo ""
  if [ -z "$TOKEN" ]; then
    _err "No token provided. Exiting."
    exit 1
  fi
fi

_ok "Token: ${TOKEN:0:20}..."
echo ""
cd "$SCRIPT_DIR" || exit 1
DISCORD_TOKEN="$TOKEN" node discord-bot.js
