#!/bin/sh
# Downloads (or updates) the memory module next to Marinara's compose files.
# Usage on the server: curl -fsSL https://raw.githubusercontent.com/tlsiddl/marinara-memory-module/main/update.sh | sh
set -e
DIR="${MARINARA_DIR:-/root/Marinara-Engine}"
BASE="https://raw.githubusercontent.com/tlsiddl/marinara-memory-module/main"
cd "$DIR"
mkdir -p memory-module/lib memory-module/notes
for f in \
  memory-module/marinara-memory-runtime.cjs \
  memory-module/memory-cli.cjs \
  memory-module/lib/ledger.cjs \
  memory-module/lib/service.cjs \
  docker-compose.memory.yml
do
  curl -fsSL -o "$f.download" "$BASE/$f"
  mv "$f.download" "$f"
done
# The step-1 test sentence is no longer needed once the ledger fills {{기억}}.
rm -f memory-module/notes/_default.txt
echo "memory module files updated in $DIR/memory-module"
# A running server keeps the old code until it restarts.
if docker ps --format '{{.Names}}' | grep -qx marinara-engine-marinara-1; then
  docker restart marinara-engine-marinara-1 >/dev/null
  echo "restarted marinara-engine-marinara-1; give it about 20 seconds to come back"
fi
