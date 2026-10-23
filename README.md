# 마리나라 기억 모듈 · Marinara Memory Module

사람처럼 기억하는 장기 RP용 기억 모듈이야. 마리나라(Marinara Engine) 서버가 켜질 때 끼워 넣는 런타임 패치로 동작하고, 원본 파일은 건드리지 않아.

지금 버전: **v0.2.1 (2단계: 열린 실타래 장부)** · 대상: **Marinara Engine 2.5.1**

## 하는 일

- **장부**: 이야기 속에서 아직 끝나지 않은 일을 네 가지로 관리해.
  - 약속, 풀리지 않은 감정(원인 포함), 비밀과 단서, 미해결 일
  - 감정은 잠이나 장면 전환으로는 안 닫히고, 사과·화해처럼 실제로 풀린 장면이 있어야 닫혀.
  - 비밀은 단서가 나올 때마다 같은 항목에 원문 그대로 쌓여.
- **원문은 베끼지 않고 가리키기**: 기억 모델은 문장 번호만 답하고, 원문은 프로그램이 실제 메시지에서 꺼내 와. 그래서 인용이 틀리지 않아. 근거 없는 항목은 버려.
- **답변마다 갱신**: 답변이 끝나면 방금 주고받은 메시지만 읽어서 장부를 고쳐.
- **스와이프·재생성 되돌리기**: 답변을 다시 뽑으면 그 답변으로 생긴 장부 변화를 되돌리고 새 답변을 다시 읽어.
- **장부 점검**: 처음 정리가 끝날 때와 답변 15번마다, 열린 항목을 한 번에 보고 끝난 일은 닫고 겹치는 항목은 합쳐.
- **`{{기억}}` 매크로**: 프리셋에 `{{기억}}`을 적은 자리에 열린 항목이 들어가. 감정이 맨 위, 종류별 개수 제한(감정 8, 약속 10, 비밀 6, 미해결 6), 원문은 그 일이 시작된 대사야. 닫힌 항목은 안 들어가.
- 마리나라 버전이 맞지 않으면 기억 모듈만 스스로 꺼지고 마리나라는 원래대로 돌아가.

기억 모델은 마리나라에 저장된 연결을 빌려 써. API 키는 마리나라에만 있어.
장부는 `/app/data/memory-module/`(마리나라 데이터 저장 공간)에 방마다 파일로 저장돼.

## 설치·업데이트 (Docker 서버)

```sh
curl -fsSL https://raw.githubusercontent.com/tlsiddl/marinara-memory-module/main/update.sh | sh
cd /root/Marinara-Engine
docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.gf-customizer.yml -f docker-compose.251.yml -f docker-compose.memory.yml up -d
docker logs marinara-engine-marinara-1 2>&1 | grep memory-module
```

로그에 `{{기억}} macro ready`와 `reply hook and admin API ready`가 보이면 성공이야.

`docker-compose.memory.yml`은 **항상 마지막**에 붙여야 해. `NODE_OPTIONS`는 마지막 파일 것으로 통째로 바뀌기 때문에, 이 파일에 기존 패치 목록 전체와 기억 모듈이 같이 적혀 있어.

## 명령

서버에서 아래 형식으로 실행해.

```sh
docker exec -e NODE_OPTIONS= marinara-engine-marinara-1 node /app/memory-module/memory-cli.cjs <명령>
```

| 명령 | 하는 일 |
| --- | --- |
| `list` | 채팅방 목록과 ID |
| `connection "연결 이름"` | 기억 정리에 쓸 연결 정하기 |
| `estimate <ID>` | 처음 정리에 드는 모델 호출 수 미리 보기 |
| `start <ID>` | 정리 시작. 멈췄던 곳이 있으면 이어서, `--fresh`를 붙이면 처음부터 |
| `status <ID>` | 진행 상황 |
| `tidy <ID>` | 장부 점검: 끝난 일은 닫고 겹치는 항목은 합치기 |
| `stop <ID>` | 정리 멈추기 |
| `show <ID>` | 프롬프트에 들어갈 장부 보기. `--all`을 붙이면 닫힌 항목까지 |
| `on <ID>` / `off <ID>` | 답변마다 갱신 켜기 / 끄기 |

`start`를 한 방만 답변마다 갱신돼. 다른 방은 비용이 들지 않아.

## 끄기

마지막 `docker compose` 줄에서 `-f docker-compose.memory.yml`만 빼고 다시 실행해. 만든 장부는 데이터 저장 공간에 그대로 남아.

## 검증 기록

- v0.2.1: 실제 딥시크 첫 결과에서 나온 문제(끝난 약속이 열려 있음, 중복, 엉뚱한 근거, 감정이 잘림)를 고침. 정리 규칙 강화, 장부 점검 추가, 감정 우선 표시. 같은 330개 기록으로 전체 흐름 다시 통과.

- v0.2.0: 마리나라 2.5.1을 직접 빌드해 Node 24에서 실행. 실제 330개 메시지 RP 기록을 넣고 가짜 모델로 확인: 처음 정리(32번 호출), 근거 문장이 실제 메시지 원문과 일치, `{{기억}}` 자리에 열린 항목 주입, 답변 1번에 기억 호출 1번, 재생성 시 되돌리기, 끄면 갱신 멈춤. me-speedup과 함께 동작.
- v0.1.0: `{{기억}}` 자리에 메모가 정확히 한 번 들어가는 것 확인.
- 실제 딥시크가 무엇을 장부에 올리는지(품질)는 서버에서 처음 정리를 돌려 본 뒤 확인해야 해.

테스트: `tests/test-ledger.cjs`, `tests/test-macro.mjs`, `tests/e2e-ledger.mjs`(+ `tests/fake-llm.mjs`), `tests/e2e-prompt-preview.mjs`.
