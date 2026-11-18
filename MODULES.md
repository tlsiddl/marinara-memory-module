# 기억 서재 모듈 지도 (분석 초안)

> 분석 기준: `tlsiddl/marinara-memory-module`의 `main` 브랜치, 커밋 `165d4880781ef06d24a1abdffd7785e4f607d0e8` (2026-11-18 확인). README와 런타임 로더는 v0.35.2를 가리킨다. 아래는 해당 기준의 분석에 1단계 변경을 덧붙인 지도다. 세부 의존성과 기능 경계는 각 모듈의 전체 호출 관계를 추적하며 검증할 것.

## 빠른 수정 위치 색인

| 증상 | 먼저 확인 | 필요할 때만 확인 및 테스트 |
|---|---|---|
| 장면 누락·잘림 | `service.cjs` `foldScenes` → `scenes.cjs` `nextSlice`, `buildScenePrompt`, `parseScenesReply`, `applyScenes`, `commitScenes` | 모델 요청·설정; `test-scenes.cjs`, `test-scene-coverage-retry.cjs` |
| 약속·감정·생활 | `service.cjs` `processChat`, `readBatch`, `tidyLedger` → `ledger.cjs` `applyResult`, `applyTidy`, `renderRoutine` | 설정 상속; `test-ledger.cjs`, `test-deadlines.cjs`, `test-routine-toggle.cjs` |
| 회상·주입 | `service.cjs` `recallBeforeReply`, `renderMemorySource` → `recall.cjs` `candidates`, `renderRecalled` | 벡터·충돌·제외 설정; `test-recall.cjs`, `test-recall-reasons.cjs`, `test-vectors.cjs` |
| 상태·장소·물건·수첩 | 해당 도메인 파일 → `service.cjs` `refreshWorld`, `renderMemorySource` | 장면 프롬프트와 설정; `test-world.cjs`, `test-keepsakes.cjs`, `test-notebook.cjs` |
| 날짜·주기 | `tracker-routes.cjs` 의 GET/POST, `trackers.cjs`; `service.cjs` `trackersView`, `refreshWorld`, `storyToday`, `trackerClock` | `ledger.cjs` 날짜 판독; `test-trackers.cjs`, `test-trackers-undo-route.cjs`, `test-compact-date.cjs` |
| 기능 스위치 | `features.cjs` `resolve`, `withGlobal`, `withRoomMode`; `service.cjs` `featureSetting`, `organizeFor` | `refreshWorld`, `renderMemorySource` 및 UI; `test-features.cjs`, `test-routine-toggle.cjs` |
| 기억 검색 화면 | `extension/search.js` `viewSearch`, `searchInput`, `searchSubmit`, `searchFilterChange`, `searchClear` | `runtime.js` 공통 상태·이동·방 전환; `test-library-input-search.mjs`, `test-room-switch-ui.cjs` |
| 화면·버튼 | `extension/runtime.js` `openLibrary`, `render`, 해당 이벤트와 API 경로 | service의 해당 route; `test-panel-layout.cjs`, `test-room-switch-ui.cjs`, 기능별 UI 테스트 |
| 백업·분기 | `backup.cjs` `build`, `validate`; service backup/restore route, `branchMemory`, `inheritBranch` | 저장 및 삭제 경로; `test-backup.cjs`, `test-branches.cjs`, `test-room-delete.cjs`, `test-safety.cjs` |
| 이름·호칭 | `names.cjs`, `aliases.cjs`, `address.cjs`와 service의 해당 route | 장면 화자·주입; `test-names-service.cjs`, `test-address-book.cjs`, `test-speakers.cjs` |

공통 Core 변경은 공유 저장 안전성, 방·인물 식별, 설정 해석, 작업 취소, 모델 실행 또는 최종 주입 계약 자체가 바뀌어야 할 때 검토한다. 테스트는 조사 출발점이며 해당 사례를 확인해 선택한다.
## 구조 한눈에 보기

- **엔진 통합 진입점:** `memory-module/marinara-memory-runtime.cjs`가 Marinara 배포 파일을 메모리에서 패치하고 `memory-module/lib/service.cjs`를 붙인다. 엔진 원본 파일을 수정하지 않는다. 지원 패치가 정확히 맞지 않으면 해당 패치가 fail-closed 된다.
- **서버 서비스 및 조정:** `memory-module/lib/service.cjs`는 5,713줄 / 331,578바이트이며 아래 20개 내부 모듈을 직접 가져온다. HTTP API, 설정·파일 I/O, 모델 작업 큐, 장면·장부 정리, 회상, 임베딩, 번역, 방 삭제·분기·백업 연결이 한 파일에 모여 있다.
- **핵심 도메인 파일:** `memory-module/lib/scenes.cjs` (4,067줄), `ledger.cjs` (2,897줄)는 독립 파일이지만 각자 크고 여러 개념을 함께 다룬다.
- **UI:** `extension/runtime.js`는 공통 상태·화면을 담당하며, 기억 검색의 렌더링과 전용 이벤트는 `extension/search.js`에 있다. `extension/build.py`가 검색 소스와 UI·테마 CSS를 JS에 삽입하고 `deliverable/extension.js` 및 zip을 만든다. 현재 화면 단위의 지연 로딩은 확인되지 않았다.
- **테스트:** `tests/`에 128개 파일이 있다. `package.json` 및 루트 `AGENTS.md`는 저장소에서 발견되지 않았다.

## 목표 기능 영역과 현재 소유권

아래는 **목표 책임을 현재 코드에 대응한 지도**다. 복수 영역에 같은 파일이나 저장 파일이 나오는 것은 현재 책임이 공유된다는 뜻이며, 데이터 이동·형식 변경이나 새 인터페이스가 이미 구현됐다는 뜻이 아니다. 경로에서 `lib/`는 `memory-module/lib/`, `tests/`는 저장소 루트 기준이다.

| 목표 영역 | UI: 현재 담당 | 서버 처리: 현재 담당 | 설정 및 저장 데이터: 현재 위치 | 관련 테스트 |
|---|---|---|---|---|
| Core | `extension/runtime.js`의 `viewSettings`, `viewInject`, 공통 `render`·이벤트; `extension/build.py` | `memory-module/marinara-memory-runtime.cjs`, `lib/service.cjs`의 저장·설정·모델·큐·API·`renderMemorySource`; `lib/backup.cjs` | `settings.json`, 방별 설정·공통 파일/캐시; 백업·복원 및 방 생명주기는 service가 여러 도메인 파일을 조정 | `tests/test-safety.cjs`, `test-backup.cjs`, `test-branches.cjs`, `test-marinara-252.cjs` |
| 이야기 기억 | `extension/runtime.js`의 `viewScenes`, `viewTimeline`, `viewInject`; 검색은 `extension/search.js` | `lib/scenes.cjs`, `recall.cjs`, `vectors.cjs`, `selected.cjs`, `reasons.cjs`; `service.cjs`의 `foldScenes`, `recallBeforeReply` | `settings.json`의 회상·임베딩 설정; `<room>.scenes.json`, `.vectors.json`, `.selected.json`, `.recall-prefs.json` | `tests/test-scenes.cjs`, `test-scene-coverage-retry.cjs`, `test-recall.cjs`, `test-vectors.cjs`, `test-library-input-search.mjs` |
| 인물 기억 | `extension/runtime.js`의 `viewFacts`, `viewNames`, `viewNotebook` | `lib/names.cjs`, `aliases.cjs`, `address.cjs`, `knowledge.cjs`, `notebook.cjs`; 사실은 현재 `scenes.cjs`와 service에도 있음 | 사실은 `<room>.scenes.json`에 장면과 함께 있음; `.names.json`, `.address.json`, `.notebook.json`; 수첩은 `features.notebook` 및 방별 override | `tests/test-names-service.cjs`, `test-address-book.cjs`, `test-knowledge.cjs`, `test-notebook.cjs`, `test-notebook-rebuild.cjs` |
| 사건·생활 | `extension/runtime.js`의 `viewLedger`, `viewLife` 및 약속 화면 | `lib/ledger.cjs`; 추출·정리·저장 연결은 `service.cjs` | `<room>.json` 장부에 약속·감정·생활 등 함께 저장; 최근 생활은 `settings.routine`, `chats[id].routine` 레거시 키 | `tests/test-ledger.cjs`, `test-deadlines.cjs`, `test-routine-toggle.cjs`, `test-ooc.cjs` |
| 세계 정보 | `extension/runtime.js`의 `viewWorld` | `lib/state.cjs`, `places.cjs`, `keepsakes.cjs`; `service.cjs` `organizeFor`, `refreshWorld` | `features.characterState`, `places`, `keepsakes` 및 방별 override; `<room>.state.json`, `.places.json`, `.keepsakes.json` | `tests/test-world.cjs`, `test-keepsakes.cjs` |
| 날짜·주기 등 선택 기능 | `extension/runtime.js`의 `trackersCard`와 관련 화면·이벤트 | `lib/tracker-routes.cjs`의 GET/POST 등록, `lib/trackers.cjs`, `service.cjs`의 공유 `trackersView`, `trackerClock`, `storyToday`, `refreshWorld` | `features.trackers`, 방별 override, `<room>.trackers.json`; `autoApply`는 인물 호칭 제안도 제어하는 별도 설정 | `tests/test-trackers.cjs`, `test-trackers-undo-route.cjs`, `test-compact-date.cjs`, `test-auto-apply.cjs` |

### 경계와 실제 결합

- **필수·기본:** Core, 이야기의 장면·회상, 인물 식별·사실·기본 호칭, 사건 장부는 현재 동작을 유지한다. `addressBook`, `knowledge` 등 `features.cjs`의 BUILTIN은 상시 기능이다. 회상용 임베딩 사용은 별도 설정이다.
- **선택:** `recentLife` 기본 on은 기존 `routine` 키를 사용한다. `notebook`, `characterState`, `places`, `keepsakes`, `trackers`는 각각 기본 off다. `autoApply`는 기본 on이며 여러 기능에 걸친다. 방별 override와 데이터 보존·재활성화 정책을 유지한다.
- **현재 직접 연결:** `service.cjs`는 장면 프롬프트에 선택 기능을 함께 포함하고 `refreshWorld`에서 장면을 읽어 각 도메인 데이터를 갱신한다. 사실은 이야기와 같은 scenes 파일에 있고, 사건·생활은 같은 ledger 파일에 있다. 이는 현행 결합이므로 목표 소유권만으로 파일을 나누거나 저장 형식을 바꾸지 않는다.
- **목표 호출:** UI → Core의 공통 API → 기능의 공개 처리; 기능 → Core의 식별·저장·설정·모델·작업 계약. 기능 간 조회는 소유자의 공개 읽기 경로나 Core가 전달한 맥락으로, 변경은 소유자의 변경 경로로 요청한다. Core가 기능 기여를 수집해 기존 순서와 예산으로 단일 주입한다. 현재는 service가 직접 조정하므로 각 경계는 향후 검증하며 도입한다.
- **생명주기:** 백업·복원·분기·삭제는 Core 조정 아래 각 데이터의 소유 규칙과 수동 편집 보호를 함께 지켜야 한다. 활성화 상태를 바꾸거나 모델 호출을 새로 분리하지 않는다.

## 기능별 지도

| 영역 | 책임 및 주요 소스 | 소유 데이터 / 공통 인터페이스 | 관련 검증 | 끌 때의 현재 동작 / 주의 |
|---|---|---|---|---|
| 엔진 연결·공통 런타임 | `memory-module/marinara-memory-runtime.cjs`; 연동 및 데이터/API 대부분은 `memory-module/lib/service.cjs` | Marinara 파일 패치, 서비스 `attach(app)`, `renderLedger`, `processChat`, `chatMessages`; `<data>/memory-module` | `tests/test-marinara-252.cjs`, `tests/test-install-detect.cjs`, `tests/check-speaker-upstream.cjs` | 엔진 파일 자체는 쓰지 않는다. 패치 anchor와 버전 호환성을 지킬 것. 외부 API 경로 `/api/memory-module` 호환 중요. |
| 이야기 기억: 장면·챕터·사실 | `memory-module/lib/scenes.cjs`, `memory-module/lib/service.cjs` | `<room>.scenes.json`; 장면 정리, 확장/요약 렌더링. 장면 생성과 모델 작업 연결은 service에 위치 | `tests/test-scenes.cjs`, `tests/test-scene-coverage-retry.cjs`, `tests/test-scene-mixed-regression.cjs`, `tests/test-room-parts.cjs`, `tests/test-fragment-repair.cjs` | 기본 기억 경로. 방의 기억 사용 스위치, 장면 작업/회상과 연결되어 있어 선택 기능처럼 꺼서는 안 됨. |
| 미해결 사건·최근 생활·작가 계획 | `memory-module/lib/ledger.cjs`, `memory-module/lib/service.cjs` | `<room>.json` (ledger); 약속·감정·비밀·미해결 일·생활·OOC 흐름, 주입 렌더링 | `tests/test-ledger.cjs`, `tests/test-deadlines.cjs`, `tests/test-routine-toggle.cjs`, `tests/test-safety.cjs`, `tests/test-ooc.cjs` | `recentLife`는 구 설정 `routine`을 계속 읽는 호환 레지스트리 항목이며 기본값 true. 꺼도 기존 기록은 보존하고 신규 추출·주입은 중지한다. 다른 ledger 기능의 활성화를 임의로 바꾸지 말 것. |
| 인물·별칭·화자·호칭 | `memory-module/lib/names.cjs`, `aliases.cjs`, `speakers.cjs`, `address.cjs`, `knowledge.cjs`; 조정은 service | `<room>.names.json`, `<room>.address.json`, 장면·장부 안 인물 참조 | `tests/test-names-service.cjs`, `tests/test-name-aliases.cjs`, `tests/test-speakers.cjs`, `tests/test-address-book.cjs`, `tests/test-knowledge.cjs` | 이름 판별 및 기본 인물 사실은 기반 기능. `addressBook`, `learnFromEdits`, `knowledge`는 BUILTIN으로 항상 켜져 있으며 선택 기능 토글 대상이 아님. |
| 인물 수첩 | `memory-module/lib/notebook.cjs`, `memory-module/lib/service.cjs` | `<room>.notebook.json`; 장면에서 갱신, 인물 관련 회상에 기여 | `tests/test-notebook.cjs`, `tests/test-notebook-rebuild.cjs`, `tests/test-notebook-stable-id.cjs` | `notebook` 선택 기능 기본 off. off 시 신규 기록·기여 중지, 파일은 보존. 재활성화 시 기존 데이터를 사용. |
| 현재 상태·장소·소중한 물건 | `state.cjs`, `places.cjs`, `keepsakes.cjs`, `service.cjs` | `<room>.state.json`, `.places.json`, `.keepsakes.json` | `tests/test-world.cjs`, `tests/test-keepsakes.cjs` | 각각 `characterState`, `places`, `keepsakes` 기본 off. 기존 데이터 보존. 장면을 다시 읽지 않는 이상 켜기 전 기간을 자동 소급하지 않는다. |
| 날짜·주기 트래커 | `tracker-routes.cjs`, `trackers.cjs`, `service.cjs` | `<room>.trackers.json`; 이야기 날짜 판독과 제안 적용은 service에서 연결 | `tests/test-trackers.cjs`, `tests/test-trackers-undo-route.cjs`, `tests/test-compact-date.cjs`, `tests/test-status-window-time.cjs` | `trackers` 기본 off. 기존 데이터 보존. `autoApply`는 별도 선택 키이며 기본 on. |
| 회상·기억 주입 | `recall.cjs`, `vectors.cjs`, `reasons.cjs`, `selected.cjs`, `service.cjs`, 런타임 매크로 패치 | `.vectors.json`, `.selected.json`, `.recall-prefs.json`, 핵심 장면·장부 데이터; 최종 렌더 경로는 service의 `renderLedger` 및 `{{기억}}` | `tests/test-recall.cjs`, `tests/test-recall-bilingual.cjs`, `tests/test-recall-reasons.cjs`, `tests/test-vectors.cjs`, `tests/test-selected.cjs` | 필수 경로. 임베딩은 기억 정리와 분리된 설정으로 유지. 모듈별 기억 기여를 붙일 경우 단일 주입 조정자와 토큰 예산을 유지할 것. |
| 백업·복원·충돌·편집 보호 | `backup.cjs`, `conflicts.cjs`, `service.cjs` | 백업이 여러 방 파일과 설정을 묶음; 복원 undo 데이터는 데이터 디렉터리 아래 | `tests/test-backup.cjs`, `tests/test-conflicts.cjs`, `tests/test-safety.cjs`, `tests/test-room-delete.cjs`, `tests/test-branches.cjs`, `tests/test-edit-during-read.cjs` | 데이터 무결성 핵심. UI 선택 기능으로 취급하지 말 것. 형식, 방 삭제·분기 복사, 작업 중 편집 보호를 변경할 때 복구 범위를 확인. |
| 번역·언어·대화 인식 보조 | `translate.cjs`, `service.cjs`; 화자 관련은 `speakers.cjs` | `.translations.json`, `.lang.json`, `.attribution-log.json`; 원문 메시지는 엔진 저장소에서 읽음 | `tests/test-translation-retry.cjs`, `tests/test-translation-split.cjs`, `tests/test-attribution-consensus.cjs`, `tests/test-attribution-review.cjs`, `tests/test-chat-language.cjs` | 원문·번역 병기와 직접 편집 보존을 유지할 것. 모델 호출 조건이 `service.cjs`에 있으므로 모듈 경계를 바꿀 때 비용 조건을 확인. |
| UI 및 서버 API | `extension/runtime.js`, `extension/ui.css`, `extension/theme.css`, `extension/build.py`; API 라우트는 `service.cjs`의 `attach` 내부 | `/api/memory-module/...`; manifest의 클라이언트 extension은 기본 disabled, 빌드 산출물은 `deliverable/` | `tests/test-attribution-ui.cjs`, `tests/test-panel-layout.cjs`, `tests/test-view-speed.cjs`, `tests/test-selected-ui.cjs`, `tests/test-library-retry-ui.cjs` | JS 하나와 ShadowRoot UI. 화면별 코드/이벤트 처리가 한 파일에 모임. 동적 로딩은 manifest 및 Marinara 확장 로더 제약을 추가 확인해야 함. API 경로·요청/응답 형식을 먼저 목록화할 것. |

## 현재 결합 관계

```text
Marinara 패치 로더
  └─ service.cjs (API·작업 조정·저장·모델·회상)
       ├─ scenes / ledger / recall / vectors
       ├─ names / aliases / address / knowledge / speakers
       ├─ notebook / trackers / state / places / keepsakes
       ├─ conflicts / backup / features / reasons / selected / translate
       └─ 엔진 채팅 저장소·모델 연결

개인 확장 runtime.js
  └─ /api/memory-module API ── service.cjs

build.py: runtime.js + search.js + ui.css + theme.css → deliverable 단일 JS/CSS/manifest/zip
```

이 지도는 import 방향과 핵심 진입 경로만 요약하며 모든 런타임 호출·데이터 의존성을 확정한 그래프는 아니다. 특히 `service.cjs` 내부에서 기능 간 함수를 호출하는 관계는 별도 추적이 필요하다.

## 우선 조사 순서와 분리 후보

1. **먼저 안정된 경계부터 기록:** 데이터 파일 소유자, API route 목록, 설정 판독, 모델 요청 지점을 함수별로 추출한다. `features.cjs`는 이미 글로벌 기본값·방별 override와 `recentLife` 레거시 키 호환을 관리하므로 설정 단일 진입 후보로 삼는다.
2. **service 내부 책임을 호출 경계로 분해:** 파일 크기만으로 자르지 않는다. 먼저 저장소/캐시·방 생명주기, 모델 작업/큐, 기능별 API route, 회상 조합의 실제 호출 관계를 표시한다. `service.cjs`가 모든 도메인 파일을 import하므로 무계획한 이동은 순환 의존성 및 동작 차이 위험이 높다.
3. **UI 기능 경계와 API 사용 매핑:** `runtime.js`를 화면/이벤트/API 단위로 분류한 뒤 번들 생성 및 `deliverable/` 동기화 방식을 정한다. 소스 분리는 가능하나 실제 lazy loading은 현재 증거만으로 지원 여부를 단정할 수 없다.
4. **대형 도메인 파일의 내부 단계 파악:** `scenes.cjs`, `ledger.cjs`는 각자 데이터 정규화·후보 추출·병합·렌더 등의 책임을 갖는다. 호출자와 테스트를 함께 추적한 후에만 순수 함수 단위의 이동을 고려한다.

### 확인이 필요한 위험

- 서비스가 파일 버전 지원, 손상/미래 데이터 보존, 원자적 파일 쓰기와 캐시 정리를 책임진다. 이 경계를 떼어내면서 잘못된 JSON을 기본값으로 덮지 않도록 해야 한다.
- 방 삭제·분기 상속·백업 복원은 여러 파일 및 설정을 함께 다룬다. 저장 책임 분할 전에 각 흐름의 전체 파일 목록과 롤백 동작을 확인할 것.
- 기존 `settings.json`의 `routine` 값은 `recentLife`의 레거시 키로 의미가 있다. 설정 마이그레이션 없이 이름을 바꾸거나 기본값을 새 키로 덮지 말 것.
- 일부 추가 기능은 다른 모듈의 장면 정리에서 같은 모델 요청에 프롬프트 지침을 추가한다. 비활성화 검증은 데이터 쓰기뿐 아니라 프롬프트 구성 및 호출 조건까지 다뤄야 한다.
- UI는 생성된 extension artifact와 별도 소스가 있다. 소스 수정 시 build 및 deliverable 갱신 관계를 확인할 것.
- 실제 성능 기준치는 이번 정적 분석에서 측정하지 않았다. 메모리 사용량·로딩 시간·모델 호출 수를 주장할 기준 데이터가 아직 없다.

## 검증 인덱스

저장소에는 128개 테스트 파일이 있지만 이번 1단계에서는 테스트를 실행하지 않았다. 위 표의 테스트는 파일명과 대상 기능에 따른 초기 연결이며 전체 보장 범위를 뜻하지 않는다. 변경 단계마다 관련 테스트, 전체 회귀 및 실제 Marinara 통합 검증 범위를 따로 정한다.

## 데이터 및 호환성 보호 규칙

- 기억은 엔진 설치 폴더가 아니라 Marinara 데이터의 `memory-module/` 아래에 저장된다.
- 공통 설정은 `settings.json`; 방별 기본 기억은 `<room>.json`, 장면은 `<room>.scenes.json`이다. 추가 도메인은 `.names.json`, `.address.json`, `.state.json`, `.places.json`, `.conflicts.json`, `.keepsakes.json`, `.notebook.json`, `.trackers.json`, `.recall-prefs.json`, `.selected.json`, `.vectors.json` 등 별도 파일을 사용한다.
- 서비스는 지원하지 않는 미래 파일 버전을 빈 데이터로 취급해 덮어쓰지 않도록 하는 보호 코드를 포함한다. 저장 형식 변경은 별도 승인 대상으로 유지한다.
- API·엔진 패치·확장 UI는 한 제품의 통합 계약이다. 데이터 형식/API 변경 전에 호출자 및 백업/복원/분기 경로를 확인한다.
- 기능 off는 데이터 삭제와 같은 뜻이 아니다. 기존 기능 플래그 설명 및 테스트가 보장하는 보존·재활성화 조건을 유지한다.

## 1.5단계: 주요 실행 흐름과 의존성

| 함수 | 호출자와 호출 대상 | 데이터 및 영향 |
|---|---|---|
| `service.processChat` | 답변 후 hook 및 시작 route → `readBatch`, `tidyLedger`, `foldScenes`, `refreshWorld` | 메시지, 장부, 장면과 작업 상태 조정. 취소·재개 및 편집 중 변경에 영향. `test-edit-during-read.cjs` |
| `service.foldScenes` | `processChat` → `S.nextSlice`, `S.buildScenePrompt` → `askModel` → `S.parseScenesReply`, `S.applyScenes`, `S.commitScenes`, `saveScenes` | 원문과 설정을 읽고 장면 저장. 누락 시 재시도·분할한다. `test-scene-coverage-retry.cjs` |
| `scenes.buildScenePrompt`, `applyScenes` | 장면 정리 및 시험 경로에서 호출 | 선택 기능 결과가 같은 모델 응답에 담긴다. 검증 및 수동 편집 보호에 영향. `test-scenes.cjs`, `test-world.cjs` |
| `service.readBatch`, `tidyLedger`; `ledger.applyResult`, `applyTidy` | 정리·시험 경로 → 모델과 장부 결과 적용 | 장부·원문 묶음을 처리한다. `readBatch`는 분할 재귀가 있어 호출 수가 고정이 아니다. `routine` 옵션은 생활 기록에 영향. `test-ledger.cjs`, `test-routine-toggle.cjs` |
| `service.refreshWorld` | 장면 정리 및 수정 경로 → 선택 기능별 갱신·저장, `Tk.suggest` | 장면을 읽고 활성화된 상태·장소·물건·수첩·트래커 데이터를 변경. `autoApply`에도 의존. `test-world.cjs`, `test-notebook.cjs`, `test-trackers.cjs` |
| `service.recallBeforeReply`, `renderMemorySource` | 답변 전 동기화와 렌더 경로 → `L.renderCompact`, `L.renderRoutine`, `S.renderScenes`, `R.renderRecalled` 및 기능별 `injectionBlock` | 저장 데이터·현재 대화·설정·회상 결과를 읽어 기억을 조합. `test-recall.cjs`, `test-recall-reasons.cjs`, `test-memory-text.cjs` |
| `service.inheritBranch`, `branchMemory` | 분기 감지 → 원본·대상 메시지와 장부·장면 비교 및 상속 | 여러 방 파일과 설정을 다룬다. `test-branches.cjs`, `test-backup.cjs` |
| UI `openLibrary`, `render` 및 이벤트 | launcher/키보드/API 결과 → 화면 생성과 API 요청 | 현재 방과 화면 상태 공유. 편집 중 재렌더 및 방 전환에 영향. `test-panel-layout.cjs`, `test-room-switch-ui.cjs` |

공유 기능은 방 ID 검증, 이름 해석, 설정 상속, 안전한 저장, 작중 시간, 모델 요청, 작업 취소 및 최종 주입 예산이다. 회상은 다른 기능의 데이터를 읽고, `refreshWorld`는 장면을 읽어 선택 기능의 데이터를 변경한다. 분기·복원·삭제는 여러 파일을 함께 변경한다.

상태·장소·물건·수첩·날짜 힌트는 장면 정리의 같은 모델 요청에 포함된다. 최근 생활은 장부 처리 옵션으로 연결된다. 별도 모델 호출로 나누면 비용과 결과가 달라질 수 있다. `renderMemorySource`는 미해결·계획·생활의 예산을 먼저 배정하지만 실제 출력은 이야기 개요, 계획, 미해결, 대사, 트래커, 호칭, 현재 상태, 회상, 생활 순서다. 두 순서를 각각 보존해야 한다.

표시만 담당하는 UI 함수와 기능별 route 등록은 의존성을 명시하면 분리 후보가 된다. 장면 프롬프트·응답 검증·재시도, 장부 결과 적용, 최종 주입 예산은 각각 밀접한 흐름이므로 강제로 나누면 탐색과 조정이 복잡해질 수 있다.

### 단계별 분리 계획

아래 난도와 위험도는 예비 평가다. 각 단계는 별도 커밋으로 수행하고 실패 시 해당 커밋을 되돌린다. 변경 전후 가상 입력과 고정 모델 응답으로 저장 파일, API 응답, 호출 수와 주입 문자열을 비교한다.

1. **표시 위주의 UI 한 화면** — 난도 중, 위험 낮음~중간. `runtime.js`의 표시 함수를 추출하고 단일 빌드를 유지한다. 해당 UI 테스트, `test-panel-layout.cjs`, `test-room-switch-ui.cjs`로 화면·방 전환·편집 상태를 비교한다. 빌드 산출물을 포함한 커밋을 되돌려 롤백한다. 탐색 파일만 늘어나면 중단한다.
2. **기능별 route 한 묶음** — 난도 중, 위험 중간. 예를 들어 tracker route 등록을 추출하되 기존 함수와 API를 유지한다. `test-trackers.cjs`, `test-trackers-undo-route.cjs`, `test-features.cjs`로 응답·설정·undo·저장 결과를 비교하고 커밋을 되돌릴 수 있게 한다.
3. **장면 후처리 연결** — 난도 중~높음, 위험 높음. `refreshWorld`의 기능 호출 경계를 명시하고 순서·저장 시점을 유지한다. `test-world.cjs`, `test-notebook-rebuild.cjs`, `test-trackers.cjs`, `test-branches.cjs` 및 off/on 데이터 비교 후 문제 시 커밋을 되돌린다.
4. **주입 조합** — 난도 높음, 위험 높음. 입력과 기여 경계를 정리하면서 예산과 출력 순서를 유지한다. `test-recall.cjs`, `test-recall-reasons.cjs`, `test-memory-text.cjs`, `test-vectors.cjs`와 고정 입력의 전체 문자열·순서 비교를 수행하고 커밋으로 롤백한다.
5. **저장·방 생명주기와 장면·장부 내부** — 난도 매우 높음, 위험 매우 높음. 파일 보호와 분기·복원·동시 작업 경로를 먼저 더 추적한 뒤 최소 단위로 분리한다. `test-safety.cjs`, `test-backup.cjs`, `test-branches.cjs`, `test-room-delete.cjs`, `test-edit-during-read.cjs`, 전체 회귀 및 실제 엔진 통합을 확인한다. 데이터 형식을 유지하고 코드 커밋 단위로 되돌린다.

이번 분석은 주요 경로의 정적 추적이며 모든 간접 호출과 UI 이벤트를 열거하지 않았다. 테스트와 성능 측정, 실제 Marinara 통합은 실행하지 않았다. 구현 전 각 후보의 전체 호출자와 안전 조건을 추가 확인해야 한다.

## UI 시범 분리: 기억 검색

검색 화면의 검색어 추출·결과 렌더링과 입력·제출·필터·초기화 이벤트는 `extension/search.js`에서 찾는다. 빌드가 이 파일을 `runtime.js`의 단일 마커에 삽입하여 동일한 클로저와 단일 배포 JS를 만든다. 검색 상태 `searchDraft`, `searchQuery`, `searchKind`, `searchWho`, 방 데이터 및 `esc`, `threadList`, `personNames` 등 공통 함수는 런타임에서 공유한다. 결과 링크의 화면 이동, 방 전환 시 초기화, 공통 이벤트 등록은 `runtime.js`에 남아 있으므로 관련 문제일 때만 함께 조사한다. 검색은 이미 로드한 데이터를 읽으며 별도 서버 API 호출을 추가하지 않는다. `tests/test-library-input-search.mjs`는 기존/새 번들에서 검색·필터·입력 유지·이동을 확인하고, `tests/test-room-switch-ui.cjs`는 공통 방 전환 보호를 확인한다. 공식 엔진 통합은 아직 미검증이다.

## 트래커 API 경계 (2단계 시범)

`memory-module/lib/tracker-routes.cjs`가 GET/POST `/chats/:id/trackers` 등록과 action 처리를 소유한다. `service.cjs`는 기존 `routes()`에서 `guard`, `safeChatId`, `needFeature`, 공유 `trackersView`, 별칭 컨텍스트, 도메인·저장·날짜·장면 조회를 명시적으로 전달한다. `trackersView`와 `trackerPick`은 service에 남아 world 응답과 장면 카드에서 같은 함수를 쓴다. `trackers.cjs`는 날짜 계산과 도메인 변경 규칙을 유지한다. 동기식 읽기·변경·저장 구간과 등록 위치·공통 guard를 유지한다. 설치 파일 목록은 `install.sh`와 `install.ps1`에 새 모듈을 포함한다.

API 오류는 먼저 `tracker-routes.cjs`의 입력·action 분기와 `trackers.cjs`를 확인하고, 데이터·날짜·이름·world 연동이 원인일 때 service의 주입 의존성과 `trackersView`를 확인한다. 전에는 큰 `service.cjs`에서 라우트와 관련 분기를 찾아야 했다. 라우트는 54줄로 집중됐지만 12개 공유 의존성이 있어 service 확인이 항상 없어지는 것은 아니다. 실제 AI 탐색량은 측정하지 않았다. 테스트: `test-trackers-undo-route.cjs`, `test-trackers.cjs`, `test-tracker-recommend.cjs`, `test-features.cjs`, `test-world.cjs`.
