'use strict';
// Memory written in Chinese: the language is told apart from Korean and English, names in the glossary and the name
// table are written in Korean, fixed headings have Chinese forms, feelings and scenes are compared by character pairs,
// and the library shows Chinese notes in Korean. (Invented names and story.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-zh-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const Tr = require('../memory-module/lib/translate.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const R = require('../memory-module/lib/recall.cjs');
const A = require('../memory-module/lib/aliases.cjs');
const B = require('../memory-module/lib/backup.cjs');
const X = service._test;
const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
X.setEngine({ chats: { async listMessages() { return []; }, async getById(id) { return { id, metadata: {} }; } }, connections: { async list() { return []; } } });
service.attach(app);
const call = async (key, id, body) => {
  let error = null;
  const reply = { status() { return { send(x) { error = x.error; return x; } }; } };
  const result = await handlers[key]({ params: { id }, body }, reply);
  return { result, error };
};

test('language: Chinese text is zh, English en, Korean ko; a Chinese chat with Korean dialogue counts as Korean', () => {
  assert.equal(Tr.textLanguage('林墨把信收进了抽屉。'), 'zh');
  assert.equal(Tr.textLanguage('Lin Mo kept the letter.'), 'en');
  assert.equal(Tr.textLanguage('린모가 편지를 간직함.'), 'ko');
  assert.equal(Tr.chatLanguage([{ content: '林墨把信收进了抽屉。窗外下着雨。' }]), 'zh');
  assert.equal(Tr.chatLanguage([{ content: '林墨把信收进了抽屉。\n林墨 | "走吧。" (가자, 이제 그만 가자. 비가 와.)' }]), 'ko');
  assert.ok(Tr.LANGS.includes('zh'));
});

test('names: Chinese glossary pairs and Chinese aliases are written in Korean with the particle fitted', () => {
  assert.deepEqual(Tr.parseGlossary('林墨 = 린모\n苏晚 = 쑤완\n上海 = 상하이'), [{ from: '林墨', to: '린모' }, { from: '苏晚', to: '쑤완' }, { from: '上海', to: '상하이' }]);
  const table = A.emptyTable();
  A.addPerson(table, '쑤완', ['苏晚']);
  const names = Tr.koreanNames([{ from: '林墨', to: '린모' }], table);
  assert.equal(Tr.koreanizeNames('林墨가 苏晚을 불렀음', names, A.replaceName), '린모가 쑤완을 불렀음');
});

test('headings: the fixed headings have Chinese forms, and quoted story lines keep their Chinese labels', () => {
  const { text } = Tr.translateText('[지난 이야기 흐름]\n  (서술) 雨下了一夜。', 'zh', () => null);
  assert.equal(text, '[前情提要]\n  (叙述) 雨下了一夜。');
  assert.equal(Tr.STATIC.ko['[前情提要]'], '[지난 이야기 흐름]');
});

test('feelings in Chinese are compared by character pairs: the same feeling merges, a different one stays', () => {
  const rows = [{ id: 'm1', number: 1, speaker: '林墨', content: '她走了。' }, { id: 'm2', number: 2, speaker: '苏晚', content: '他不认得她。' }];
  const open = (items) => { const l = L.emptyLedger(); L.applyResult(l, { open: items }, L.prepareMessages(rows)); return l; };
  const same = open([
    { kind: 'emotion', who: '林墨', toward: '苏晚', title: '被抛下的委屈', cause: '苏晚在庙会结束后不告而别', need: '苏晚解释她为什么离开', evidence: ['1.1'] },
    { kind: 'emotion', who: '林墨', toward: '苏晚', title: '被丢下', cause: '庙会结束后苏晚不告而别地离开', need: '苏晚解释离开的原因', evidence: ['2.1'] },
  ]);
  assert.equal(same.threads[1].mergedInto, 'T1');
  const different = open([
    { kind: 'emotion', who: '林墨', toward: '苏晚', title: '被骗的愤怒', cause: '苏晚卖给他一本伪造的账簿', need: '让苏晚为伪造付出代价', evidence: ['1.1'] },
    { kind: 'emotion', who: '林墨', toward: '苏晚', title: '被遗忘的屈辱', cause: '苏晚当面问他是谁', need: '苏晚承认记得那一夜', evidence: ['2.1'] },
  ]);
  assert.deepEqual(different.threads.map((t) => t.status), ['open', 'open']);
});

test('recall: a Chinese (translated) message finds a Chinese scene, a Korean one finds it through the translation', () => {
  const scene = (id, title, summary) => ({ id, start: 1, end: 1, title, summary, events: [{ text: summary, quotes: [] }], recollections: [], later: [] });
  const list = [scene('S1', '伪造的账簿', '苏晚在港口卖给林墨一本伪造的账簿。'), scene('S2', '客栈晚饭', '他们吃了炖菜，聊了天气。'), scene('S3', '银罗盘', '林墨把银罗盘藏在地板下面。'), scene('S4', '雨中赶路', '马车在雨里走得很慢。')];
  assert.equal(R.directHit(list, '你把罗盘藏在哪里了？')?.id, 'S3');
  const tr = (t) => ({ 银罗盘: '은 나침반', '林墨把银罗盘藏在地板下面。': '린모가 은 나침반을 마룻바닥 아래에 숨김.' })[t] || null;
  assert.equal(R.directHit(list, '그 나침반 어디 숨겼어?', { tr })?.id, 'S3');
  const messages = L.prepareMessages([
    { id: 'a1', number: 1, role: 'assistant', speaker: 'Narrator', content: '林墨跪下来撬开木板，把罗盘塞进了地板下面。' },
    ...Array.from({ length: 8 }, (_, i) => ({ id: `x${i}`, number: i + 2, role: 'assistant', speaker: 'Narrator', content: `第${i}天，客栈里很安静。` })),
  ]);
  assert.equal(R.rawHits(messages, '罗盘在地板下面吗')[0]?.number, 1);
});

test('service: memory can be set to be written in Chinese, and Chinese notes are shown in Korean in the library', async () => {
  const saved = await call('POST /settings/language', null, { writeLanguage: 'zh', memoryLanguage: 'auto' });
  assert.ifError(saved.error);
  assert.equal(saved.result.writeLanguage, 'zh');
  assert.equal(X.writeLanguage('z1'), 'zh');
  assert.match((await call('POST /settings/language', null, { writeLanguage: 'ja' })).error, /auto, ko, en, zh/);
  const ledger = L.emptyLedger();
  ledger.threads.push({ id: 'T1', kind: 'emotion', status: 'open', title: '被遗忘的屈辱', who: '林墨', toward: '苏晚', detail: '苏晚当面问他是谁。', unaware: [], guess: [], evidence: [], clues: [] });
  X.saveLedger('z1', ledger);
  const texts = X.displayTranslationTexts('z1');
  assert.ok(texts.includes('被遗忘的屈辱') && texts.includes('苏晚当面问他是谁。'));
  await call('POST /chats/:id/glossary', 'z1', { glossary: '林墨 = 린모\n苏晚 = 쑤완' });
  const tr = (await call('GET /chats/:id/translations', 'z1')).result;
  assert.equal(tr.items['林墨'], '린모');
  assert.equal(tr.items['苏晚'], '쑤완');
  await call('POST /settings/language', null, { writeLanguage: 'auto' });
});

test('backup accepts a room language record in Chinese and still refuses an unknown language', () => {
  const doc = (lang) => B.build({ chatId: 'z1', chatName: '시험', moduleVersion: 'x', files: { lang: { version: 1, lang } }, settingsEntry: null });
  assert.doesNotThrow(() => B.validate(doc('zh')));
  assert.throws(() => B.validate(doc('ja')), /lang 파일 형식/);
});
