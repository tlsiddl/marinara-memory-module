#!/usr/bin/env node
'use strict';
// Memory module commands. Run inside the Marinara container, for example:
//   docker exec -e NODE_OPTIONS= marinara-engine-marinara-1 node /app/memory-module/memory-cli.cjs list
// (-e NODE_OPTIONS= keeps the server patches out of this small command.)

const fs = require('node:fs');
const path = require('node:path');
const PORT = process.env.MEMORY_MODULE_PORT || 7860;
let quoteLine = (q) => q.text;
try {
  ({ quoteLine } = require('./lib/scenes.cjs'));
} catch {}
const CLI_FILE = path.join(process.env.DATA_DIR || '/app/data', 'memory-module', 'cli.json');
const BASE = `http://127.0.0.1:${PORT}/api/memory-module`;

async function api(method, path, body) {
  let response;
  try {
    response = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-marinara-csrf': '1' },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    });
  } catch (error) {
    throw Error(`마리나라 서버(${BASE})에 연결하지 못했습니다 (${error.cause?.code || error.message}). 서버가 막 다시 켜지는 중이라면 잠시 뒤에 다시 시도해 주세요.`);
  }
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text.slice(0, 300) };
  }
  if (!response.ok) throw Error(data?.error || `HTTP ${response.status}`);
  return data;
}

const KIND = { promise: '약속', emotion: '감정', secret: '비밀', pending: '미해결', state: '상태' };
const RECALL_NAME = { model: 'model (기억 모델이 목차를 보고 고릅니다, 답변마다 호출 1번)', fast: 'fast (낱말과 장부로 고릅니다, 호출 없음)', off: 'off (회상 안 함)' };
const STATE = { idle: '쉬는 중', running: '정리 중', done: '완료', error: '오류' };

function openLine(open) {
  return Object.entries(open).map(([k, v]) => `${KIND[k]} ${v}`).join(' · ');
}

function memorySize(text) {
  const chars = (text || '').length;
  return `약 ${chars.toLocaleString()}자 (대략 ${Math.round(chars / 1.5).toLocaleString()} 토큰)`;
}

const commands = {
  async use(chatId) {
    need(chatId);
    const chats = await api('GET', '/chats');
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) throw Error('해당 ID의 채팅방이 없습니다. mm list로 확인해 주세요.');
    fs.mkdirSync(path.dirname(CLI_FILE), { recursive: true });
    fs.writeFileSync(CLI_FILE, JSON.stringify({ chat: chatId }));
    console.log(`이제 ID를 적지 않으면 "${chat.name}" 방으로 실행합니다.`);
  },
  async report(chatId) {
    console.log('===== 상태 =====');
    await commands.status(chatId);
    console.log('\n===== 지금 프롬프트에 들어가는 기억 =====');
    await commands.show(chatId);
    console.log('\n===== 장면 전체 =====');
    await commands.scenes(chatId, '--all');
    console.log('\n===== 장부 전체 (닫힌 항목까지) =====');
    await commands.show(chatId, '--all');
  },
  async recall(mode) {
    if (!mode) {
      const r = await api('GET', '/status');
      return console.log(`지금 회상 방식: ${RECALL_NAME[r.settings.recall || 'model']}\n바꾸기: recall model | fast | off`);
    }
    const r = await api('POST', '/settings/recall', { mode });
    console.log(`회상 방식: ${RECALL_NAME[r.recall]}`);
  },
  async 'scene-error'(chatId) {
    const r = await api('GET', `/chats/${chatId}/scene-error`);
    console.log(r.text || '저장된 장면 정리 실패 기록이 없습니다.');
  },
  async reopen(chatId, tid) {
    if (!tid) throw Error('사용법: reopen T3');
    await api('POST', `/chats/${chatId}/threads/${tid}/reopen`);
    console.log(`${tid} 항목을 다시 열었습니다.`);
  },
  async close(chatId, tid, ...how) {
    if (!tid) throw Error('사용법: close T3 [이유]');
    await api('POST', `/chats/${chatId}/threads/${tid}/close`, { how: how.join(' ') || undefined });
    console.log(`${tid} 항목을 닫았습니다.`);
  },
  async tags(chatId, value) {
    if (!['on', 'off'].includes(value)) throw Error('사용법: tags on 또는 tags off');
    await api('POST', `/chats/${chatId}/speaker-tags`, { on: value === 'on' });
    console.log(value === 'on'
      ? '이 방은 이제 빠진 말풍선 태그(<speaker>)를 되살립니다. 마리나라의 화자 색상이 켜진 ‘합쳐서’ 그룹 채팅에서만 동작합니다.'
      : '이 방의 말풍선 태그 되살리기를 껐습니다.');
  },
  async list() {
    const chats = await api('GET', '/chats');
    if (!chats.length) return console.log('채팅방이 없습니다.');
    for (const c of chats.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))) {
      const mark = c.enabled ? '●' : '○';
      console.log(`${mark} ${c.name}\n   ID: ${c.id}${c.ledger.processed ? `\n   장부: ${openLine(c.ledger.open)} (메시지 ${c.ledger.processed}개 정리됨)` : ''}`);
    }
    console.log('\n● = 기억 모듈 켜짐, ○ = 꺼짐');
  },
  async connection(name) {
    if (!name) throw Error('사용법: connection "연결 이름"');
    const r = await api('POST', '/settings', { connection: name });
    console.log(`기억용 연결: ${r.connection.name} (모델: ${r.connection.model || '연결 기본값'})`);
  },
  async estimate(chatId) {
    need(chatId);
    const r = await api('POST', `/chats/${chatId}/estimate`);
    console.log(`메시지 ${r.messages}개, 약 ${r.chars >= 10000 ? `${Math.round(r.chars / 10000)}만` : `${Math.round(r.chars / 1000)}천`} 자 → 처음 정리에 모델 호출 약 ${r.calls + r.sceneCalls}번 (장부 ${r.calls}번 + 장면 ${r.sceneCalls}번)`);
    console.log(`이 방은 최근 메시지 ${r.window}개를 모델이 직접 봅니다. 그보다 오래된 메시지는 장면 기억으로 정리됩니다.`);
  },
  async start(chatId, flag) {
    need(chatId);
    const r = await api('POST', `/chats/${chatId}/start`, { fresh: flag === '--fresh' });
    console.log(r.fresh ? '처음부터 정리를 시작했습니다. 진행 상황은 mm status로 보실 수 있습니다.' : '멈췄던 곳부터 이어서 정리합니다. 진행 상황은 mm status로 보실 수 있습니다.');
  },
  async tidy(chatId) {
    need(chatId);
    await api('POST', `/chats/${chatId}/tidy`);
    console.log('장부 점검을 시작했습니다. 끝난 일은 닫고, 겹치는 항목은 합칩니다. 결과는 mm status로 보실 수 있습니다.');
  },
  async trial(chatId, from, to) {
    need(chatId);
    const r = await api('POST', `/chats/${chatId}/trial`, { from: Number(from), to: Number(to) });
    console.log(`${from}~${to}번 메시지 ${r.messages}개를 빈 장부로 시험합니다. 저장은 하지 않습니다. 모델 호출은 ${r.total}번입니다.`);
    console.log('창을 닫아도 서버에서 계속 돌아갑니다. 그럴 때는 나중에 mm trial-result로 결과를 보실 수 있습니다.');
    let last = -1;
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const t = await api('GET', `/chats/${chatId}/trial`);
      if (t.done !== last && t.state === 'running') {
        console.log(`진행: ${t.done}/${t.total}${t.stage ? ` · ${t.stage}` : ''}`);
        last = t.done;
      }
      if (t.state !== 'running') return printTrial(t);
    }
  },
  async 'trial-result'(chatId) {
    need(chatId);
    const t = await api('GET', `/chats/${chatId}/trial`);
    if (t.state === 'none') return console.log('이 방의 구간 시험 기록이 없습니다. (서버를 다시 켜면 사라집니다)');
    if (t.state === 'running') return console.log(`아직 시험 중입니다: ${t.done}/${t.total}`);
    printTrial(t);
  },
  async stop(chatId) {
    need(chatId);
    const r = await api('POST', `/chats/${chatId}/stop`);
    console.log(r.stopping ? '지금 하던 묶음까지만 하고 멈춥니다.' : '정리 중이 아닙니다.');
  },
  async status(chatId) {
    need(chatId);
    const r = await api('GET', `/chats/${chatId}`);
    const j = r.job;
    console.log(`기억 모듈: ${r.enabled ? '켜짐' : '꺼짐'} · 서버가 쓰는 버전 v${r.version || '?'}`);
    console.log(`작업: ${STATE[j.state] || j.state}${j.stage ? ` · ${j.stage}` : ''}${j.total ? ` (${j.done}/${j.total})` : ''}${j.error ? `\n오류: ${j.error}` : ''}`);
    const lt = r.summary.lastTidy;
    if (lt && !j.result) console.log(`마지막 장부 점검: 닫음 ${lt.closed}${lt.feelingsResolved != null ? `(그중 풀린 감정 ${lt.feelingsResolved})` : ''} · 합침 ${lt.merged}${lt.feelingsMoved ? ` · 감정→약속/할 일로 옮김 ${lt.feelingsMoved}` : ''}`);
    if (j.result) console.log(`점검 결과: 열린 항목 ${j.result.before}개 → ${j.result.after}개 (닫음 ${j.result.closed}${j.result.feelingsResolved ? `, 그중 풀린 감정 ${j.result.feelingsResolved}` : ''}, 합침 ${j.result.merged})`);
    console.log(`장부: ${openLine(r.summary.open)} · 닫힌 항목 ${r.summary.closed} · 정리된 메시지 ${r.summary.processed}개`);
    const sj = r.sceneJob || {};
    if (sj.error) sj.error += ' (자세히: mm scene-error)';
    console.log(`장면: ${r.scenes.count}개 (메시지 ${r.scenes.coveredThrough ?? '-'}번까지) · 알게 된 사실 ${r.scenes.facts}개 · 장면 작업: ${STATE[sj.state] || sj.state}${sj.stage ? ` · ${sj.stage}` : ''}${sj.error ? `\n장면 오류: ${sj.error}` : ''}`);
    const rc = r.recall || {};
    if (rc.at) console.log(`최근 회상 (${rc.used === 'model' ? '기억 모델' : '빠른 방식'}, ${(rc.ms / 1000).toFixed(1)}초): ${rc.picks.length ? rc.picks.map((p) => `${p.id} ${p.title || ''}${p.why ? ` — ${p.why}` : ''}`).join(' / ') : '고른 장면 없음'}${rc.error ? `\n회상 경고: ${rc.error}` : ''}`);
    if (rc.raw?.length) console.log(`원문에서 찾은 대목: ${rc.raw.map((x) => `${x.number}번`).join(', ')}`);
    else if (rc.at) console.log('원문에서 찾은 대목: 없음');
    if (!rc.at) console.log(`최근 회상: 아직 없음 (다음 답변부터, 방식: ${rc.mode || 'model'})`);
    console.log(`프롬프트에 들어가는 기억: ${memorySize(r.rendered)}`);
    console.log(`말풍선 태그 되살리기: ${r.speakerTags ? '켜짐' : '꺼짐 (켜려면: mm tags on)'}`);
    if (r.summary.needsRebuild) console.log('주의: 예전 메시지가 바뀌어서 mm start --fresh로 다시 정리해야 합니다.');
  },
  async show(chatId, flag) {
    need(chatId);
    const r = await api('GET', `/chats/${chatId}`);
    if (flag === '--all') {
      for (const t of r.threads) {
        console.log(`${t.status === 'open' ? '열림' : '닫힘'} ${t.id} [${KIND[t.kind]}] ${t.title}${t.who ? ` (${[t.who, t.toward].filter(Boolean).join(' → ')})` : ''}`);
        if (t.detail) console.log(`   ${t.detail}`);
        if (t.period) console.log(`   기간: ${t.period.from} ~ ${t.period.to}`);
        if (t.due) console.log(`   약속한 때: ${[t.due.date, t.due.time].filter(Boolean).join(' ')}`);
        if (t.latest) console.log(`   최근: ${t.latest.text}${t.latest.at ? ` (${t.latest.at})` : ''}`);
        if (t.closed) console.log(`   닫힘: ${t.closed.how || ''} (#${t.closed.at?.number}${t.closed.at?.time ? `, ${t.closed.at.time}` : ''})`);
      }
      return;
    }
    console.log(r.rendered || '(아직 열린 항목이 없습니다)');
  },
  async scenes(chatId, flag) {
    need(chatId);
    const store = await api('GET', `/chats/${chatId}/scenes`);
    if (!store.scenes.length) return console.log('아직 장면이 없습니다. 컨텍스트 밖으로 밀려난 메시지가 생기면 정리됩니다.');
    for (const sc of store.scenes) {
      console.log(`\n${sc.id} [${sc.start}~${sc.end}번] ${[sc.time, sc.place].filter(Boolean).join(' · ')} — ${sc.title}${sc.edited ? ' (직접 고침)' : ''}`);
      console.log(`  ${sc.summary}`);
      if (flag !== '--all') continue;
      for (const e of sc.events) {
        console.log(`  - ${e.importance === 'critical' ? '★ ' : e.importance === 'minor' ? '(작음) ' : ''}${e.text}`);
        for (const q of e.quotes) console.log(`      #${q.number}.${q.sentence} ${quoteLine(q)}`);
      }
      for (const rc of sc.recollections) console.log(`  · ${rc.who} [${rc.remembers}${rc.why ? `: ${rc.why}` : ''}] ${rc.text || '(사용자 캐릭터: 속마음은 적지 않음)'}${rc.kept ? ` / 남은 기억: ${rc.kept}` : ''}`);
    }
    if (store.facts.length) {
      console.log('\n알게 된 사실:');
      const ids = new Set(store.facts.map((f) => f.id));
      for (const f of store.facts) console.log(`  ${f.id} ${f.about ? `${f.about}: ` : ''}${f.text}${f.replaces ? ` (${f.replaces}를 고침)` : ''}${f.replacedBy && ids.has(f.replacedBy) ? ` (→ ${f.replacedBy}로 바뀜, 프롬프트에서 빠짐)` : ''}`);
    }
  },
  async on(chatId) {
    need(chatId);
    await api('POST', `/chats/${chatId}/enable`);
    console.log('이 방은 이제 답변마다 장부와 장면을 갱신합니다.');
  },
  async off(chatId) {
    need(chatId);
    await api('POST', `/chats/${chatId}/disable`);
    console.log('이 방의 기억 갱신을 껐습니다. 이미 만든 기억은 남아 있습니다.');
  },
};

function printTrial(t) {
  console.log(`\n${t.from}~${t.to}번 시험 ${t.state === 'done' ? '완료' : '중단'}: 메시지 ${t.messages}개, 모델 호출 ${t.done}/${t.total}번, 버린 항목 ${t.result?.dropped ?? 0}개`);
  if (t.error) console.log(`오류: ${t.error}`);
  if (t.result?.tidy) console.log(`장부 점검: 열린 항목 ${t.result.tidy.before}개 → ${t.result.tidy.after}개 (닫음 ${t.result.tidy.closed}, 합침 ${t.result.tidy.merged})`);
  if (t.sceneError) console.log(`장면 정리 경고: ${t.sceneError}`);
  console.log('\n===== 프롬프트에 들어갈 모습 (이 구간 전체가 컨텍스트 밖이라고 치고, 모든 장면을 펼쳐서) =====');
  console.log(t.result?.memory || t.result?.rendered || '(없음)');
  console.log('\n===== 전체 항목 =====');
  const threads = t.result?.threads || [];
  for (const th of threads) {
    console.log(`\n${th.status === 'open' ? '열림' : '닫힘'} ${th.id} [${KIND[th.kind]}] ${th.title}${th.who ? ` (${[th.who, th.toward].filter(Boolean).join(' → ')})` : ''}${th.since ? ` · ${th.since}` : ''}`);
    if (th.detail) console.log(`   ${th.detail}`);
    if (th.cause) console.log(`   원인: ${th.cause}`);
    for (const p of [...th.evidence, ...th.clues].slice(0, 3)) console.log(`   #${p.number}.${p.sentence} "${p.text.slice(0, 120)}"`);
    if (th.latest) console.log(`   최근: ${th.latest.text}`);
    if (th.closed) console.log(`   닫힘: ${th.closed.how || ''}`);
  }
  if (!threads.length) console.log('(찾은 항목이 없습니다)');
}

function need(chatId) {
  if (!chatId) throw Error('채팅방 ID가 필요합니다. mm list로 확인하실 수 있습니다.');
}

const NO_CHAT = new Set(['list', 'connection', 'use', 'recall']);
const looksLikeId = (x) => typeof x === 'string' && /^[A-Za-z0-9_-]{12,}$/.test(x);

/** Fill in the chat when it is left out: the one picked with `use`, else the chat updated last with memory on. */
async function withChat(command, args) {
  if (NO_CHAT.has(command) || looksLikeId(args[0])) return args;
  let chat = null;
  try {
    chat = JSON.parse(fs.readFileSync(CLI_FILE, 'utf8')).chat;
  } catch {}
  if (!chat) {
    const chats = (await api('GET', '/chats')).filter((c) => c.enabled);
    chat = chats.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0]?.id;
  }
  if (!chat) throw Error('채팅방 ID가 필요합니다. mm list로 확인하고 mm use <ID>로 정해 두실 수 있습니다.');
  return [chat, ...args];
}

const [command, ...args] = process.argv.slice(2);
if (!commands[command]) {
  console.log(`명령 (ID를 안 적으면 use로 정한 방, 없으면 기억이 켜진 최근 방):
  report                     상태 + 프롬프트에 들어가는 기억 + 장면 전체 + 장부 전체, 한 번에
  use <ID>                   앞으로 쓸 방 정하기
  tags on|off                빠진 말풍선 태그(<speaker>) 되살리기 켜기/끄기 (기본 꺼짐, 방마다)
  reopen <T번호>              잘못 닫힌 장부 항목 다시 열기
  close <T번호> [이유]        장부 항목 손으로 닫기
  recall [model|fast|off]    회상 방식 보기/바꾸기 (답변 전에 관련된 옛 장면을 골라 자세히 넣기)
  list                       채팅방 목록과 ID
  connection "연결 이름"     기억 정리에 쓸 연결 정하기
  estimate <ID>              처음 정리에 드는 모델 호출 수 미리 보기
  start <ID> [--fresh]       정리 시작(멈춘 곳부터 이어서, --fresh는 처음부터)
  status <ID>                진행 상황
  tidy <ID>                  장부 점검(끝난 일 닫기, 겹치는 항목 합치기)
  trial <ID> <시작> <끝>     그 구간만 시험 정리(저장 안 함, 최대 40개)
  trial-result <ID>          마지막 구간 시험 결과 다시 보기
  stop <ID>                  정리 멈추기
  show <ID> [--all]          프롬프트에 들어갈 기억 보기(--all은 장부의 닫힌 항목까지)
  scenes <ID> [--all]        장면 목록(--all은 사건·대사·회상까지)
  on <ID> / off <ID>         답변마다 갱신 켜기/끄기`);
  process.exit(command ? 1 : 0);
}
withChat(command, args).then((full) => commands[command](...full)).catch((error) => {
  console.error(`실패: ${error.message}`);
  process.exit(1);
});
