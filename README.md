# 마리나라 기억 모듈 · Marinara Memory Module

사람처럼 기억하는 장기 RP용 기억 모듈이야. 마리나라(Marinara Engine) 서버가 켜질 때 끼워 넣는 런타임 패치로 동작하고, 원본 파일은 건드리지 않아.

지금은 **1단계(v0.1.0): 넣는 자리 만들기**야.

## 1단계에서 하는 일

- 프리셋의 원하는 자리에 `{{기억}}`(또는 `{{memory}}`)을 적으면, 그 자리에 기억 메모가 들어가.
- 메모는 서버의 `memory-module/notes` 폴더에서 읽어.
  - `_default.txt`: 모든 방에 들어가는 메모
  - `<채팅방ID>.txt`: 그 방에만 들어가는 메모 (있으면 `_default.txt` 대신 사용)
- 메모 안에 `{{user}}` 같은 매크로가 있어도 실행되지 않아.
- 마리나라 버전이 맞지 않으면 기억 모듈만 스스로 꺼지고, 마리나라는 원래대로 돌아가.

대상 버전: **Marinara Engine 2.5.1** (Docker 이미지 `ghcr.io/pasta-devs/marinara-engine:2.5.1`)

## 설치 (Docker 서버)

```sh
cd /root/Marinara-Engine
mkdir -p memory-module/notes
curl -fsSL -o memory-module/marinara-memory-runtime.cjs https://raw.githubusercontent.com/tlsiddl/marinara-memory-module/main/marinara-memory-runtime.cjs
curl -fsSL -o memory-module/notes/_default.txt https://raw.githubusercontent.com/tlsiddl/marinara-memory-module/main/notes/_default.txt
curl -fsSL -o docker-compose.memory.yml https://raw.githubusercontent.com/tlsiddl/marinara-memory-module/main/docker-compose.memory.yml
docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.gf-customizer.yml -f docker-compose.251.yml -f docker-compose.memory.yml up -d
```

`docker-compose.memory.yml`은 **항상 마지막**에 붙여야 해. `NODE_OPTIONS`는 마지막 파일 것으로 통째로 바뀌기 때문에, 이 파일에 기존 패치 목록 전체와 기억 모듈이 같이 적혀 있어. 다른 패치를 추가하거나 빼면 이 파일의 목록도 같이 고쳐야 해.

## 확인

```sh
docker logs marinara-engine-marinara-1 2>&1 | grep memory-module
```

`applied: {{기억}} macro ready`가 보이면 성공이야. `fail closed`가 보이면 마리나라 버전이 달라서 기억 모듈이 꺼진 거야.

## 끄기

`docker-compose.memory.yml`을 빼고 다시 켜면 돼.

```sh
docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.gf-customizer.yml -f docker-compose.251.yml up -d
```

## 검증 기록 (v0.1.0)

- Marinara 2.5.1 소스를 직접 빌드해 Node 24에서 실행했어.
- 실제 서버의 프롬프트 미리보기(dry run, 모델 호출 없음)에서 확인: 공용 메모가 `{{기억}}` 자리에 들어감, 방 전용 메모가 공용 메모를 대신함, 정확히 한 번 그 섹션 안에만 들어감.
- me-speedup과 함께 켜도 정상 동작.
- 버전이 맞지 않는 원본이면 패치하지 않음(fail closed).

테스트: `tests/test-macro.mjs`(매크로 단위), `tests/e2e-prompt-preview.mjs`(테스트용 서버 전체 흐름).
