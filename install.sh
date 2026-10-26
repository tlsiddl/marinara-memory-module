#!/bin/sh
# 기억 서재 (마리나라 엔진용 기억 모듈) — 설치·업데이트
#   서버(도커):          curl -fsSL https://raw.githubusercontent.com/tlsiddl/marinara-memory-module/main/install.sh | sh
#   그냥 실행·Termux:    마리나라 폴더에서 같은 명령
# 다시 실행하면 업데이트입니다. 기억 데이터는 마리나라 데이터 폴더에 있어서 지워지지 않습니다.
set -e

BASE="${MEMORY_MODULE_BASE:-https://raw.githubusercontent.com/tlsiddl/marinara-memory-module/main}"
FILES="memory-module/marinara-memory-runtime.cjs memory-module/memory-cli.cjs memory-module/lib/ledger.cjs memory-module/lib/service.cjs memory-module/lib/scenes.cjs memory-module/lib/recall.cjs memory-module/lib/speakers.cjs memory-module/lib/vectors.cjs"
RUNTIME_IN_DOCKER="/app/memory-module/marinara-memory-runtime.cjs"

say() { printf '%s\n' "$*"; }
fail() { printf '\n[설치 실패] %s\n' "$*" >&2; exit 1; }

fetch() { # fetch <url> <file>
  if command -v curl >/dev/null 2>&1; then curl -fsSL -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then wget -q -O "$2" "$1"
  else fail "curl이나 wget이 필요합니다."
  fi
}

download_module() { # download_module <marinara folder>
  mkdir -p "$1/memory-module/lib"
  for f in $FILES; do
    fetch "$BASE/$f" "$1/$f.download" || fail "$f 를 받지 못했습니다. 인터넷 연결을 확인해 주세요."
    mv "$1/$f.download" "$1/$f"
  done
  say "[1/3] 기억 모듈 파일을 받았습니다: $1/memory-module"
}

docker_ok() { command -v docker >/dev/null 2>&1 && docker ps >/dev/null 2>&1; }

find_container() {
  if [ -n "$MARINARA_CONTAINER" ]; then printf '%s' "$MARINARA_CONTAINER"; return; fi
  docker ps --format '{{.Names}}	{{.Image}}' 2>/dev/null | awk -F '	' 'tolower($1) ~ /marinara/ || tolower($2) ~ /marinara/ { print $1; exit }'
}

label() { docker inspect -f "{{index .Config.Labels \"$2\"}}" "$1" 2>/dev/null; }

container_env() { docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$1" 2>/dev/null | sed -n "s/^$2=//p" | head -n 1; }

install_mm() { # install_mm <folder> <container>
  fetch "$BASE/memory-module/mm" "$1/memory-module/mm"
  sed -i.bak "s/marinara-engine-marinara-1/$2/" "$1/memory-module/mm" 2>/dev/null && rm -f "$1/memory-module/mm.bak"
  chmod +x "$1/memory-module/mm"
  if install -m 755 "$1/memory-module/mm" /usr/local/bin/mm 2>/dev/null; then say "      짧은 명령어 mm 도 설치했습니다 (예: mm status)."; fi
}

# ---------------------------------------------------------------- 도커
install_docker() {
  C="$1"
  DIR="$(label "$C" com.docker.compose.project.working_dir)"
  SERVICE="$(label "$C" com.docker.compose.service)"
  CONFIGS="$(label "$C" com.docker.compose.project.config_files)"
  [ -n "$DIR" ] && [ -d "$DIR" ] || fail "컨테이너 $C 는 docker compose로 켜지지 않았거나 compose 폴더를 찾지 못했습니다. README의 '직접 설치'를 봐 주세요."
  say "마리나라 컨테이너를 찾았습니다: $C (compose 폴더: $DIR)"
  download_module "$DIR"
  install_mm "$DIR" "$C"

  OPTS="$(container_env "$C" NODE_OPTIONS)"
  case "$OPTS" in
    *marinara-memory-runtime*)
      say "[2/3] 이미 기억 모듈이 연결되어 있습니다."
      docker restart "$C" >/dev/null
      say "[3/3] 마리나라를 다시 켰습니다. 20초쯤 뒤에 접속해 주세요."
      return ;;
  esac

  OVERRIDE="$DIR/docker-compose.override.yml"
  if [ -f "$OVERRIDE" ]; then
    say ""
    say "[2/3] $OVERRIDE 파일이 이미 있어서 건드리지 않았습니다. 그 파일의 $SERVICE 서비스에 아래 두 가지를 직접 넣어 주세요:"
    say "      volumes:      - ./memory-module:/app/memory-module:ro"
    say "      environment:  NODE_OPTIONS: \"${OPTS:+$OPTS }--require=$RUNTIME_IN_DOCKER\""
    say "      그다음 compose 폴더에서: docker compose up -d"
    exit 0
  fi
  # Whatever NODE_OPTIONS the container already had stays; the memory module is added at the end.
  cat > "$OVERRIDE" <<EOF
# 기억 서재 (기억 모듈) — install.sh가 만든 파일. 지우면 기억 모듈이 꺼집니다.
services:
  $SERVICE:
    volumes:
      - ./memory-module:/app/memory-module:ro
    environment:
      NODE_OPTIONS: "${OPTS:+$OPTS }--require=$RUNTIME_IN_DOCKER"
EOF
  say "[2/3] $OVERRIDE 를 만들었습니다."

  # Started with -f files: the override is added to the same list so this start uses it.
  ARGS=""
  CUSTOM=0
  OLDIFS="$IFS"; IFS=','
  for f in $CONFIGS; do
    [ -n "$f" ] || continue
    ARGS="$ARGS -f $f"
    case "$(basename "$f")" in docker-compose.yml|docker-compose.yaml|compose.yml|compose.yaml) ;; *) CUSTOM=1 ;; esac
  done
  IFS="$OLDIFS"
  if [ -n "$ARGS" ]; then ARGS="$ARGS -f $OVERRIDE"; fi
  (cd "$DIR" && docker compose $ARGS up -d) || fail "docker compose up -d 에 실패했습니다. 위 오류를 확인해 주세요."
  say "[3/3] 마리나라를 다시 켰습니다. 20초쯤 뒤에 접속해 주세요."
  if [ "$CUSTOM" = 1 ]; then
    say ""
    say "참고: compose를 -f 로 직접 켜고 계셨습니다. 앞으로 켤 때도 마지막에 -f docker-compose.override.yml 을 넣어 주세요."
  fi
}

# ---------------------------------------------------------------- 그냥 실행 / Termux
find_folder() {
  for d in "$MARINARA_DIR" "$(pwd)" "$HOME/Marinara-Engine" "$HOME/marinara-engine" /root/Marinara-Engine "$HOME/Marinara"; do
    [ -n "$d" ] && [ -d "$d/packages/server" ] && { printf '%s' "$d"; return; }
  done
}

install_local() {
  DIR="$(find_folder)"
  [ -n "$DIR" ] || fail "마리나라 폴더를 찾지 못했습니다. 마리나라 폴더 안에서 실행하시거나, MARINARA_DIR=/마리나라/폴더 를 앞에 붙여 실행해 주세요."
  say "마리나라 폴더를 찾았습니다: $DIR"
  download_module "$DIR"
  START="$DIR/start-memory.sh"
  cat > "$START" <<'EOF'
#!/usr/bin/env bash
# 기억 서재 (기억 모듈)을 켠 채로 마리나라를 실행합니다. 평소 start.sh 대신 이 파일로 실행해 주세요.
cd "$(dirname "$0")"
export NODE_OPTIONS="--require=\"$(pwd)/memory-module/marinara-memory-runtime.cjs\" ${NODE_OPTIONS:-}"
if [ -n "$TERMUX_VERSION" ] && [ -f start-termux.sh ]; then exec bash start-termux.sh "$@"; fi
exec bash start.sh "$@"
EOF
  chmod +x "$START"
  say "[2/3] 실행 파일을 만들었습니다: $START"
  say "[3/3] 이제부터 마리나라를 이렇게 켜 주세요:  bash $START"
  say "      (이미 켜져 있다면 끄고 위 명령으로 다시 켜 주세요. start.sh로 켜면 기억 모듈 없이 켜집니다.)"
}

say ""
say "== 기억 서재 설치·업데이트 =="
if [ "$MEMORY_MODULE_MODE" != local ] && docker_ok; then
  C="$(find_container)"
  if [ -n "$C" ]; then install_docker "$C"; exit 0; fi
  say "도커는 있지만 켜져 있는 마리나라 컨테이너를 찾지 못했습니다. 마리나라를 먼저 켜고 다시 실행해 주세요."
  say "(도커 없이 실행 중이라면 무시하고 이어서 진행합니다.)"
fi
install_local
