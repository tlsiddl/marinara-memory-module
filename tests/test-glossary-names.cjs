'use strict';
// English little words do not find scenes; Korean notes and memory written in Korean keep the glossary's names.
// (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-glossary-names-'));
const service = require('../memory-module/lib/service.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const R = require('../memory-module/lib/recall.cjs');
const Tr = require('../memory-module/lib/translate.cjs');
const A = require('../memory-module/lib/aliases.cjs');
const T = service._test;
const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
T.setEngine({ chats: { async listMessages() { return []; }, async getById(id) { return { id, metadata: {} }; } }, connections: { async list() { return []; } } });
service.attach(app);
const call = async (key, id, body) => handlers[key]({ params: { id }, body }, { status() { return { send(x) { return x; } }; } });

test('English: prepositions, contractions and talk words are not words to find a scene by', () => {
  const w = [...L.englishWords('She walked toward the lighthouse despite it. “Don’t,” she said. I’m going against the others upon the hill with Rowan’s knife.')];
  assert.deepEqual(w.sort(), ['hill', 'knife', 'lighthouse', 'rowan', 'walk']);
  const scenes = [
    { id: 'S1', title: 'Harbor', summary: 'They walked toward the docks.', events: [{ text: 'Rowan sat upon a crate.', quotes: [] }] },
    { id: 'S2', title: 'Kitchen', summary: 'Soup for dinner.', events: [{ text: 'Mira cooked.', quotes: [] }] },
    { id: 'S3', title: 'Lighthouse', summary: 'The lamp went dark.', events: [{ text: 'Mira climbed the stairs.', quotes: [] }] },
  ];
  assert.equal(R.directHit(scenes, 'Come toward me and sit upon this, don’t you?'), null);
});

test('a Korean note that writes a glossary name another way is translated again, once', async () => {
  const room = 'n1';
  T.saveSettings({ ...T.settings(), writeLanguage: 'en' });
  await call('POST /chats/:id/glossary', room, { glossary: 'Rowan = 로완\nMira = 미라' });
  const src = 'Rowan hid the key from Mira.';
  const data = structuredClone(T.loadTranslations(room));
  data.items[Tr.key('ko', src)] = '로원이 미라에게서 열쇠를 숨김';
  data.items[Tr.key('ko', 'Mira cooked.')] = '미라가 요리함';
  T.saveTranslations(room, data);
  const stale = T.staleNames(room);
  assert.equal(stale(src), true, 'Rowan is not 로원');
  assert.equal(stale('Mira cooked.'), false);
  // Translated again with today's names: not again, even if the model kept its own form.
  const again = structuredClone(T.loadTranslations(room));
  (again.namesChecked ||= {})[Tr.key('ko', src)] = Tr.namesSig(src, Tr.koreanNames(T.loadTranslations(room).glossary.pairs, T.loadNames(room)));
  T.saveTranslations(room, again);
  assert.equal(T.staleNames(room)(src), false);
  // A changed glossary looks at it once more.
  await call('POST /chats/:id/glossary', room, { glossary: 'Rowan = 로원\nMira = 미라' });
  assert.equal(T.staleNames(room)(src), false, '로원 is now the glossary form');
});

test('a name field keeps the full name, with the glossary\'s form of the first name', async () => {
  const room = 'n2';
  const table = T.loadNames(room);
  A.addPerson(table, '로원 하트', ['Rowan Hart', 'Rowan'], { seeded: true });
  T.saveNames(room, table);
  const ledger = L.emptyLedger();
  ledger.threads.push({ id: 'T1', kind: 'emotion', status: 'open', title: 'Rowan is upset', who: 'Rowan', toward: null, unaware: [], guess: [], evidence: [], clues: [] });
  T.saveLedger(room, ledger);
  await call('POST /chats/:id/glossary', room, { glossary: 'Rowan = 로완' });
  const tr = await call('GET /chats/:id/translations', room);
  assert.equal(tr.items.Rowan, '로완 하트');
  assert.deepEqual(Tr.koreanNames([{ from: 'Rowan', to: '로완' }], T.loadNames(room)).find((n) => n.from === 'Rowan Hart').to, '로완 하트');
});

test('memory written in Korean: the memory model is told the glossary forms of names in its input', async () => {
  const room = 'n3';
  await call('POST /chats/:id/glossary', room, { glossary: 'Thornfield = 손필드\nWill = 윌' });
  T.saveSettings({ ...T.settings(), writeLanguage: 'ko' });
  const msgs = [{ role: 'system', content: 'x' }, { role: 'user', content: '[3] Ada: We reached Thornfield. I will stay.' }];
  const user = T.withSetup('', msgs, room)[1].content;
  assert.match(user, /## 이름 표기/);
  assert.match(user, /Thornfield = 손필드/);
  assert.doesNotMatch(user, /Will = 윌/, '"will" is not the name Will');
  T.saveSettings({ ...T.settings(), writeLanguage: 'en' });
  assert.equal(T.withSetup('', msgs, room)[1].content, msgs[1].content, 'English memory keeps the names as written');
});

test('기억 검색: an English memory is found by its Korean translation', () => {
  const vm = require('node:vm');
  const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
  const esc = (v) => String(v ?? '');
  const trMap = { 'Rowan hid the key from Mira.': '로완이 미라에게서 열쇠를 숨김', Rowan: '로완' };
  const shared = require('./ui-shared.cjs')(source, esc, trMap);
  const start = source.indexOf('  const SEARCH_TEXT = ');
  const end = source.indexOf('\n  }\n', source.indexOf('  function searchableText(')) + 4;
  const searchableText = vm.runInNewContext(`(() => { ${source.slice(start, end)}; return searchableText; })()`, { ...shared });
  const text = searchableText({ id: 'S1', title: 'The key', events: [{ text: 'Rowan hid the key from Mira.', quotes: [] }], present: ['Rowan'] });
  assert.match(text, /열쇠를 숨김/);
  assert.match(text, /Rowan hid the key/);
  assert.match(text, /로완/);
});
