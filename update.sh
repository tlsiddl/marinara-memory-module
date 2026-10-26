#!/bin/sh
# 예전 업데이트 명령과의 호환용입니다. 이제는 install.sh 하나로 설치와 업데이트를 합니다.
#   curl -fsSL https://raw.githubusercontent.com/tlsiddl/marinara-memory-module/main/install.sh | sh
set -e
BASE="${MEMORY_MODULE_BASE:-https://raw.githubusercontent.com/tlsiddl/marinara-memory-module/main}"
TMP="$(mktemp)"
if command -v curl >/dev/null 2>&1; then curl -fsSL -o "$TMP" "$BASE/install.sh"; else wget -q -O "$TMP" "$BASE/install.sh"; fi
sh "$TMP"
rm -f "$TMP"
