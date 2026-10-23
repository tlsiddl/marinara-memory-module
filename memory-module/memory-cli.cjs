#!/usr/bin/env node
'use strict';
// Memory module commands. Run inside the Marinara container, for example:
//   docker exec -e NODE_OPTIONS= marinara-engine-marinara-1 node /app/memory-module/memory-cli.cjs list
// (-e NODE_OPTIONS= keeps the server patches out of this small command.)

const PORT = process.env.MEMORY_MODULE_PORT || 7860;
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
    throw Error(`마리나라 서버(${BASE})에 연결하지 못했어 (${error.cause?.code || error.message}). 서버가 막 다시 켜지는 중이면 잠깐 뒤에 다시 해 줘.`);
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

const KIND = { promise: '약속', emotion: '감정', secret: '비밀', pending: '미해결' };
const STATE = { idle: '쉬는 중', running: '정리 중', done: '완료', error: '오류' };

function openLine(open) {
  return Object.entries(open).map(([k, v]) => `${KIND[k]} ${v}`).join(' · ');
}

const commands = {
  async list() {
    const chats = await api('GET', '/chats');
    if (!chats.length) return console.log('채팅방이 없어.');
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
    console.log(`메시지 ${r.messages}개, 약 ${r.chars >= 10000 ? `${Math.round(r.chars / 10000)}만` : `${Math.round(r.chars / 1000)}천`} 자 → 처음 정리에 모델 호출 약 ${r.calls}번`);
  },
  async start(chatId, flag) {
    need(chatId);
    const r = await api('POST', `/chats/${chatId}/start`, { fresh: flag === '--fresh' });
    console.log(r.fresh ? '처음부터 정리를 시작했어. 진행 상황은 status로 볼 수 있어.' : '멈췄던 곳부터 이어서 정리해. 진행 상황은 status로 볼 수 있어.');
  },
  async tidy(chatId) {
    need(chatId);
    await api('POST', `/chats/${chatId}/tidy`);
    console.log('장부 점검을 시작했어. 끝난 일은 닫고, 겹치는 항목은 합칠게. 결과는 status로 볼 수 있어.');
  },
  async trial(chatId, from, to) {
    need(chatId);
    const r = await api('POST', `/chats/${chatId}/trial`, { from: Number(from), to: Number(to) });
    console.log(`${from}~${to}번 메시지 ${r.messages}개를 빈 장부로 시험할게. 저장은 하지 않아. 모델 호출 ${r.total}번이야.`);
    console.log('창을 닫아도 서버에서 계속 돌아가. 그럴 땐 나중에 trial-result로 결과를 볼 수 있어.');
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
    if (t.state === 'none') return console.log('이 방의 구간 시험 기록이 없어. (서버를 다시 켜면 사라져)');
    if (t.state === 'running') return console.log(`아직 시험 중이야: ${t.done}/${t.total}`);
    printTrial(t);
  },
  async stop(chatId) {
    need(chatId);
    const r = await api('POST', `/chats/${chatId}/stop`);
    console.log(r.stopping ? '지금 하던 묶음까지만 하고 멈출게.' : '정리 중이 아니야.');
  },
  async status(chatId) {
    need(chatId);
    const r = await api('GET', `/chats/${chatId}`);
    const j = r.job;
    console.log(`기억 모듈: ${r.enabled ? '켜짐' : '꺼짐'} · 서버가 쓰는 버전 v${r.version || '?'}`);
    console.log(`작업: ${STATE[j.state] || j.state}${j.stage ? ` · ${j.stage}` : ''}${j.total ? ` (${j.done}/${j.total})` : ''}${j.error ? `\n오류: ${j.error}` : ''}`);
    if (j.result) console.log(`점검 결과: 열린 항목 ${j.result.before}개 → ${j.result.after}개 (닫음 ${j.result.closed}, 합침 ${j.result.merged})`);
    console.log(`장부: ${openLine(r.summary.open)} · 닫힌 항목 ${r.summary.closed} · 정리된 메시지 ${r.summary.processed}개`);
    if (r.summary.needsRebuild) console.log('주의: 예전 메시지가 바뀌어서 start --fresh로 다시 정리해야 해.');
  },
  async show(chatId, flag) {
    need(chatId);
    const r = await api('GET', `/chats/${chatId}`);
    if (flag === '--all') {
      for (const t of r.threads) {
        console.log(`${t.status === 'open' ? '열림' : '닫힘'} ${t.id} [${KIND[t.kind]}] ${t.title}${t.who ? ` (${[t.who, t.toward].filter(Boolean).join(' → ')})` : ''}`);
        if (t.detail) console.log(`   ${t.detail}`);
        if (t.latest) console.log(`   최근: ${t.latest.text}${t.latest.at ? ` (${t.latest.at})` : ''}`);
        if (t.closed) console.log(`   닫힘: ${t.closed.how || ''} (#${t.closed.at?.number}${t.closed.at?.time ? `, ${t.closed.at.time}` : ''})`);
      }
      return;
    }
    console.log(r.rendered || '(아직 열린 항목이 없어)');
  },
  async on(chatId) {
    need(chatId);
    await api('POST', `/chats/${chatId}/enable`);
    console.log('이 방은 이제 답변마다 장부를 갱신해.');
  },
  async off(chatId) {
    need(chatId);
    await api('POST', `/chats/${chatId}/disable`);
    console.log('이 방의 장부 갱신을 껐어. 이미 만든 장부는 남아 있어.');
  },
};

function printTrial(t) {
  console.log(`\n${t.from}~${t.to}번 시험 ${t.state === 'done' ? '완료' : '중단'}: 메시지 ${t.messages}개, 모델 호출 ${t.done}/${t.total}번, 버린 항목 ${t.result?.dropped ?? 0}개`);
  if (t.error) console.log(`오류: ${t.error}`);
  if (t.result?.tidy) console.log(`장부 점검: 열린 항목 ${t.result.tidy.before}개 → ${t.result.tidy.after}개 (닫음 ${t.result.tidy.closed}, 합침 ${t.result.tidy.merged})`);
  console.log('\n===== 프롬프트에 들어갈 모습 =====');
  console.log(t.result?.rendered || '(열린 항목 없음)');
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
  if (!threads.length) console.log('(찾은 항목 없음)');
}

function need(chatId) {
  if (!chatId) throw Error('채팅방 ID가 필요해. list로 확인할 수 있어.');
}

const [command, ...args] = process.argv.slice(2);
if (!commands[command]) {
  console.log(`명령:
  list                       채팅방 목록과 ID
  connection "연결 이름"     기억 정리에 쓸 연결 정하기
  estimate <ID>              처음 정리에 드는 모델 호출 수 미리 보기
  start <ID> [--fresh]       정리 시작(멈춘 곳부터 이어서, --fresh는 처음부터)
  status <ID>                진행 상황
  tidy <ID>                  장부 점검(끝난 일 닫기, 겹치는 항목 합치기)
  trial <ID> <시작> <끝>     그 구간만 시험 정리(저장 안 함, 최대 40개)
  trial-result <ID>          마지막 구간 시험 결과 다시 보기
  stop <ID>                  정리 멈추기
  show <ID> [--all]          프롬프트에 들어갈 장부 보기(--all은 닫힌 항목까지)
  on <ID> / off <ID>         답변마다 갱신 켜기/끄기`);
  process.exit(command ? 1 : 0);
}
commands[command](...args).catch((error) => {
  console.error(`실패: ${error.message}`);
  process.exit(1);
});
