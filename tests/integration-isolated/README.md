# 격리된 공식 엔진 통합 시험

2026-11-18 Windows에서 수행한 절차다. 작업 브랜치의 기억 모듈을 사용하며, 실제 설치본·운영 데이터·운영 서버·운영 키는 사용하지 않는다. 아래 명령은 저장소 루트의 PowerShell에서 실행한다. `work`는 이 저장소의 **부모 작업 폴더**이며 실제 설치 경로가 아닌지 먼저 확인한다. 운영 서비스가 있는 포트에는 절대 연결하지 않는다.

## 준비물과 출처

- Node.js 24~26 (검증 당시 26.13.0), GitHub CLI, Python 3 및 pnpm. 공식 소스는 [Pasta-Devs/Marinara-Engine 릴리스](https://github.com/Pasta-Devs/Marinara-Engine/releases)의 `v2.5.1`, `v2.5.2` ZIP이다. ZIP은 소스이므로 의존성과 shared/server 빌드가 필요하다.
- 원본 ZIP SHA-256: 2.5.1 `91bc385890056d0461e4498a9d67a86ba3143437b48146d7b02c99f7421d5a8e`, 2.5.2 `a1e0a7a2cc1371c4ed0e56c8de44ffba6f6d4c4499a42402bdf66d89db654650`. 반드시 GitHub 릴리스 자산의 digest와 다시 비교한다.
- 2.5.1 설치는 공식 pin `pnpm@10.34.5`; 2.5.2 이번 실행은 pnpm 11.25.0으로 lockfile 설치. npm 레지스트리 의존성은 테스트 폴더에 설치한다. 설치 시 `--ignore-scripts`로 의존성 설치 스크립트를 실행하지 않았다. 특정 환경에서는 네이티브 의존성이 추가로 필요할 수 있다.
- `network-guard.cjs`는 Node의 TCP 연결을 loopback으로 제한한다. 이것만으로 OS 전체 또는 자식 프로세스의 네트워크 격리가 보장되는 것은 아니다. 강한 격리가 필요한 경우 OS 수준 네트워크 격리와 전용 테스트 계정을 추가한다. 서버는 `127.0.0.1`에만 바인딩한다.

## 격리 준비

1. 빈 `../integration-downloads`, `../integration-engines`, `../engine-test` 폴더를 사용한다. 기존 파일을 덮거나 삭제하기 전에 경로를 확인한다. `tests/integration-isolated/`의 다섯 스크립트를 `../engine-test/`에 복사한다. 이 스크립트들은 그 상대 경로를 전제로 한다.
2. `gh release download v2.5.1 --repo Pasta-Devs/Marinara-Engine --pattern Marinara-Engine-2.5.1.zip --dir ../integration-downloads` 및 2.5.2의 같은 명령을 실행한다. `Get-FileHash`로 위 digest를 확인하고 각 ZIP을 `../integration-engines`에 푼다. ZIP의 경로가 대상 디렉터리 밖으로 벗어나지 않는지도 확인한다.
3. 두 엔진 디렉터리 각각에서 서버와 shared 의존성을 `pnpm --filter '@marinara-engine/server...' install --frozen-lockfile --ignore-scripts --store-dir <작업 폴더의 전용 store>`로 설치한다. 다음으로 `pnpm --filter '@marinara-engine/shared' build`, `pnpm --filter '@marinara-engine/server' build`를 실행한다. 2.5.1은 정확한 pnpm 10.34.5를 사용한다. npm cache/store도 작업 폴더에 지정한다.
4. `../engine-test/notes`에 `_default.txt` = `DEFAULT NOTE`, `chat-own.txt` = `OWN NOTE`, `chat-sneaky.txt` = `{{user}}`를 만든다. `DATA_DIR`, `MEMORY_MODULE_NOTES_DIR`, `TEMP`, `TMP`를 별도 빈 테스트 경로로 지정한다.
5. 각 버전에서 `MEMORY_MODULE_ANY_PROCESS=1`과 위 테스트 경로를 설정하고 `node --require=./memory-module/marinara-memory-runtime.cjs tests/test-macro.mjs <해당 엔진의 packages/shared/dist/utils/macro-engine.js>`를 실행한다. 명령별 환경은 해당 프로세스에만 적용한다.

## 서버 및 시험

1. 각 포트가 사용 중이 아닌지 확인한다. 저장소 루트에서 별도 터미널로 `node ../engine-test/launch.cjs 2.5.1 49151`, `node ../engine-test/launch.cjs 2.5.2 49152`, `node tests/fake-llm.mjs 49153 ../engine-test/reply.txt`를 실행한다. launcher는 최소 환경 변수, 별도 `sandbox-<version>/data`·`files` 및 127.0.0.1을 사용하고 현재 작업 복제본의 런타임을 preload한다. 엔진의 자동 외부 접속은 Node TCP guard가 거부하며 로그에 실패가 나타날 수 있다.
2. 각 서버의 `/api/memory-module/status`의 `dataDir`가 해당 sandbox 아래인지 확인한 후에만 시험한다. 서버와 fake LLM의 소유 프로세스 및 포트를 확인한다. 다른 서버가 응답하면 즉시 중단한다.
3. `_default.txt`를 `기억 모듈 연결 확인`으로 바꾸고 `node tests/e2e-prompt-preview.mjs http://127.0.0.1:49151 ../engine-test/notes`를 실행한다. 49152에도 반복한다. 이 테스트는 가상 연결·인물·채팅과 프롬프트를 만든다.
4. `node ../engine-test/tracker-http.cjs 49151`, `node ../engine-test/tracker-http.cjs 49152`를 실행한다. 가상 채팅 파일은 `tests/fixtures/edit-during-read.jsonl`, fake LLM은 `127.0.0.1:49153`을 사용한다. 방별 기능 설정과 파일 보존, world 및 트래커 응답·에러·악성 Origin을 검사한다. 이것은 실제 브라우저의 방 전환 시험이 아니다.
5. `node tests/e2e-edit-during-read.mjs http://127.0.0.1:49151 http://127.0.0.1:49153 tests/fixtures/edit-during-read.jsonl ../engine-test/reply.txt`를 실행하고 끝난 뒤 49152에 반복한다. 현재 원본은 방 요약과 별도 `/threads`를 조회한다. 기존 `e2e-edit-adapted.mjs`는 과거 시험 사본이며 현재 원본의 통과와 구분한다. 같은 fake LLM의 지연 설정과 답변 파일을 공유하므로 병렬 실행하지 않는다.
6. `node tests/fixtures/generate-e2e-fixtures.cjs`로 가상 fixture를 재생성할 수 있다. 66개 메시지는 `node tests/e2e-scenes.mjs http://127.0.0.1:49151 http://127.0.0.1:49153 tests/fixtures/synthetic-66.jsonl ../engine-test/reply.txt`, 330개 메시지는 `node tests/e2e-ledger.mjs http://127.0.0.1:49151 http://127.0.0.1:49153 tests/fixtures/synthetic-330.jsonl ../engine-test/reply.txt`로 실행하고 49152에서 반복한다. 서버의 `DATA_DIR`를 sandbox로 검증한 후, 서로 순차 실행한다. 장면 E2E의 호출 횟수 기대와 현재 동작의 기존 불일치는 `REFACTOR-STATUS.md`를 참조한다.
7. 인증 테스트는 별도 포트 및 별도 디렉터리로 `node ../engine-test/launch-auth.cjs 2.5.1 49154`, `node ../engine-test/launch-auth.cjs 2.5.2 49155`를 실행한다. 테스트 전용 `sandbox-user`/`sandbox-password-2026`만 설정된다. `/api/memory-module/chats/fake/trackers`에 `X-Forwarded-For: 198.51.100.10`으로 무인증·잘못된 인증·정상 인증을 요청해 401·401·라우트 도달(기능 off 400)을 확인한다. localhost 직접 접속은 엔진이 신뢰한다. 악성 Origin 요청은 두 버전에서 403이었고 Origin 없는 로컬 요청은 허용됐다.
8. 테스트 프로세스만 종료하고 포트가 해제됐는지 확인한다. 엔진 데이터·키·로그는 가상 자료이지만 임시 폴더의 유지·삭제는 경로를 확인한 뒤 처리한다. 외부 서버, 실제 엔진 데이터 또는 운영 파일에는 연결하지 않는다.

## 범위와 제한

서버 빌드만 사용하므로 공식 클라이언트의 실제 브라우저 화면·방 전환은 확인하지 않는다. 인증은 테스트 전용 Basic Auth와 전달 헤더 사례에 한정하며 관리자·사용자별 권한, 실제 프록시/기기·네트워크, 모든 CSRF 조합은 검증하지 않는다. 각 실행의 성공·실패와 미검증 항목은 `REFACTOR-STATUS.md`에서 확인한다. 자동 회귀 테스트 결과는 엔진 통합 결과와 별도로 기록한다.
