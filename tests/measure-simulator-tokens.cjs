'use strict';
// 한 번 정리(장면 + 장부)의 지시문 크기: 캐릭터 RP vs 세계 시뮬레이터 (지어낸 방: 아는 인물 70명, 이번 묶음 12메시지에 8명).
// 실행: node tests/measure-simulator-tokens.cjs  (모델 호출 없음, 지시문만 만들어 잰다)
process.env.MEMORY_MODULE_RECALL = 'off';
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const Sim = require('../memory-module/lib/simulator.cjs');

const NARRATOR = '학원 시뮬레이터', USER = '이리나';
const FAMILY = ['한', '서', '윤', '강', '도', '백', '류', '진', '문', '하'];
const GIVEN = ['서준', '하린', '도윤', '지아', '시우', '예린', '민재'];
const people = [];
for (const f of FAMILY) for (const g of GIVEN) people.push(f + g);
const here = people.slice(0, 8);
const rows = Array.from({ length: 12 }, (_, i) => i % 2
  ? { id: `u${i}`, number: i + 1, role: 'user', speaker: USER, content: `나는 ${here[i % 8]}에게 다가가 물었다. "오늘 수업은 어땠어?"` }
  : { id: `a${i}`, number: i + 1, role: 'assistant', speaker: NARRATOR, content: `${here[i % 8]}가 창가 자리에서 고개를 든다. "${here[(i + 1) % 8]}가 또 늦었어." 복도 끝에서 ${here[(i + 2) % 8]}가 손을 흔든다. 오후의 햇빛이 교실 바닥에 길게 눕는다. 종이 울리자 학생들이 하나둘 짐을 챙긴다.` });
const slice = L.prepareMessages(rows);

const size = (msgs) => msgs.reduce((n, m) => n + m.content.length, 0);
// 토큰 추정: 한글 1.3자 = 1토큰, 그 밖 글자 4자 = 1토큰 (모델마다 다름 — 비교용)
const tokens = (msgs) => Math.round(msgs.reduce((n, m) => {
  const ko = (m.content.match(/[가-힣]/g) || []).length;
  return n + ko / 1.3 + (m.content.length - ko) / 4;
}, 0));

const character = { store: { ...S.emptyStore(), cast: [NARRATOR], personas: [USER] }, ledger: { ...L.emptyLedger(), cast: [NARRATOR], personas: [USER] } };
const sim = (cast) => ({ store: { ...S.emptyStore(), mode: 'simulator', narrators: [NARRATOR], castAliases: {}, cast, personas: [USER] }, ledger: { ...L.emptyLedger(), mode: 'simulator', narrators: [NARRATOR], castAliases: {}, cast, personas: [USER] } });

function measure(label, c, { everyone = false } = {}) {
  // everyone: what the prompt would be if every known person were listed (no batch filter) — the filter's effect
  const batch = Sim.batchCast;
  if (everyone) Sim.batchCast = (cast) => cast;
  try {
    const scene = S.buildScenePrompt(c.store, slice, 12, null, {});
    const ledger = L.buildPrompt(c.ledger, slice, []);
    const all = [...scene, ...ledger];
    return { label, sceneChars: size(scene), ledgerChars: size(ledger), chars: size(all), tokens: tokens(all) };
  } finally {
    Sim.batchCast = batch;
  }
}

const out = [
  measure('캐릭터 RP (지금)', character),
  measure('세계 시뮬레이터 (묶음에 나온 8명만)', sim(people)),
  measure('참고: 시뮬레이터인데 70명을 다 넣으면', sim(people), { everyone: true }),
];
const base = out[0];
for (const r of out) console.log(`${r.label}: 장면 ${r.sceneChars}자 + 장부 ${r.ledgerChars}자 = ${r.chars}자 · 약 ${r.tokens}토큰 (${r === base ? '기준' : `${r.tokens - base.tokens >= 0 ? '+' : ''}${r.tokens - base.tokens}토큰, ${((r.tokens / base.tokens - 1) * 100).toFixed(1)}%`})`);
