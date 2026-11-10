'use strict';
// 인물의 수첩: the voice comes from each character's Korean lines (Korean, bracketed Korean, or the saved translation of
// an English-only line); notes are cleaned (story people only, never the user's own, Korean, with evidence), folded
// with the user's edits, stars and deletions, and go into the reply for the people in the scene. (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-notebook-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const Nb = require('../memory-module/lib/notebook.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const T = require('../memory-module/lib/translate.cjs');
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

test('voice: the Korean in brackets for a line written with its translation, else the line as the story has it', () => {
  const messages = [
    { role: 'assistant', content: 'Viktor smiled.\nViktor | "Come here, you."\nSera | "Laisse-moi tranquille." (나 좀 내버려 둬.)', tr: '빅터 | "이리 와, 너."' },
    { role: 'assistant', content: '<speaker="Viktor">Viktor | "Sit down."</speaker>' },
    { role: 'assistant', content: 'Marco | "싫어."' },
    { role: 'user', content: 'Mina | "싫은데?"' },
  ];
  // Viktor speaks only English: his own English lines (the saved translation is not used). Sera's line carries its
  // Korean in brackets: the Korean. Marco speaks Korean: the line itself. The user's own character: none.
  assert.deepEqual(Nb.voiceSamples(messages, ['Viktor', 'Sera', 'Marco', 'Mina'], { personas: ['Mina'] }), { Viktor: ['Come here, you.', 'Sit down.'], Sera: ['나 좀 내버려 둬.'], Marco: ['싫어.'] });
  const block = Nb.voiceBlock({ Viktor: ['Sit down.'], Sera: ['나 좀 내버려 둬.'] }, { Viktor: ['She hates the dark.'] });
  assert.match(block, /\[수첩 언어\] Viktor: English · Sera: 한국어/);
  assert.doesNotMatch(block, /말투 참고|Sit down/, 'the lines decide the language only; the voice is not copied');
  assert.match(block, /\[이미 적은 수첩\][^]*Viktor: She hates the dark\./);
  assert.equal(Nb.voiceBlock({}), '');
  assert.match(Nb.PROMPT, /담담한 메모체[^]*흉내 내지 말고/);
  assert.doesNotMatch(Nb.PROMPT, /\[말투 참고\]/);
  assert.match(Nb.PROMPT, /인물마다 0~1개이고, 대부분의 장면은 0개/);
  assert.match(Nb.PROMPT, /적지 마: 외모·옷차림·몸 묘사/);
  assert.match(Nb.PROMPT, /수첩 주인 자신만은 이름으로 부르지 말고/);
  assert.equal(Nb.PER_PERSON_SCENE, 1);
  assert.match(Nb.PROMPT, /가리키기만 하는 말은 쓰지 마/);
  assert.ok(Nb.PROMPT.includes('언어: 아래 [수첩 언어]'));
});

test('a note: a story person (never the user\'s own), in the character\'s language, a known kind; about oneself is a feeling', () => {
  const opts = { cast: ['Viktor', 'Sera'], personas: ['Mina'], person: (n) => n };
  assert.deepEqual(Nb.cleanNote({ who: 'Viktor', kind: 'about', about: 'Sera', text: '세라는 단 걸 싫다면서 체리는 네 개째 먹었다.' }, opts), { who: 'Viktor', kind: 'about', about: 'Sera', text: '세라는 단 걸 싫다면서 체리는 네 개째 먹었다.' });
  assert.equal(Nb.cleanNote({ who: 'Mina', kind: 'heart', text: '나는 사실 무서웠다.' }, opts), null, 'the user\'s own character');
  assert.deepEqual(Nb.cleanNote({ who: 'Viktor', kind: 'heart', text: 'I must keep her safe.' }, opts), { who: 'Viktor', kind: 'heart', text: 'I must keep her safe.' }, 'an English speaker writes English');
  assert.equal(Nb.cleanNote({ who: 'Viktor', kind: 'heart', text: '…' }, opts), null, 'no words');
  assert.equal(Nb.cleanNote({ who: 'Stranger', kind: 'heart', text: '이상한 날이다.' }, opts), null, 'not a story person');
  assert.deepEqual(Nb.cleanNote({ who: 'Viktor', kind: 'about', about: 'Viktor', text: '내가 왜 그랬을까.' }, opts), { who: 'Viktor', kind: 'heart', text: '내가 왜 그랬을까.' });
});

test('the scene call asks for notes (with the voice lines) only when on, and keeps notes with evidence from the scene', () => {
  const slice = L.prepareMessages([{ id: 'a1', number: 1, role: 'assistant', speaker: 'Narrator', content: '빅터는 세라가 체리를 집는 걸 봤다.\n빅터 | "또 먹어?"' }]);
  const store = { ...S.emptyStore(), cast: ['빅터', '세라'] };
  const prompt = (on) => S.buildScenePrompt(store, slice, 1, null, { notebook: on })[0].content;
  assert.match(prompt(true), /인물의 수첩/);
  assert.match(prompt(true), /\[수첩 언어\] 빅터/);
  assert.doesNotMatch(prompt(true), /\[말투 참고\]/);
  assert.doesNotMatch(prompt(false), /인물의 수첩/);
  const notebook = [
    { who: '빅터', kind: 'about', about: '세라', when: '부엌에서 세라가 체리를 먹을 때', text: '세라는 단 걸 싫다면서 체리는 잘만 먹는다.', evidence: ['1.1'] },
    { who: '빅터', kind: 'heart', when: '부엌에서 세라가 체리를 먹을 때', text: '근거 없는 메모.', evidence: ['9.9'] },
    // No situation line: it would mean nothing read alone, so it is not kept.
    { who: '빅터', kind: 'heart', text: '세라는 또 체리를 먹었다.', evidence: ['1.1'] },
  ];
  const result = { scenes: [{ end: 1, time: '25-03-02', place: '부엌', title: '체리', summary: '요약', present: ['빅터', '세라'], events: [{ text: '봤다', quotes: [] }], recollections: [], facts: [], notebook }] };
  const apply = (opts) => S.applyScenes({ ...store }, result, slice, 1, undefined, opts).scenes[0];
  assert.equal(apply({}).charNotes, undefined);
  assert.deepEqual(apply({ notebook: true }).charNotes, [{ who: '빅터', kind: 'about', about: '세라', when: '부엌에서 세라가 체리를 먹을 때', text: '세라는 단 걸 싫다면서 체리는 잘만 먹는다.', evidence: [{ number: 1, sentence: 1 }] }]);
  assert.match(prompt(true), /when\(상황\)[^]*이름을 넣어/);
  assert.match(prompt(true), /"그 애", "이 애", "저 녀석"/);
});

test('checks in code (from the audit): the language set per character, no near-copies of the story, no repeats, evidence re-pointed', () => {
  // The room speaks "English line" (Korean): the notes must be Korean.
  const slice = L.prepareMessages([
    { id: 'a1', number: 1, role: 'assistant', speaker: 'Narrator', content: 'Deny her an itch, and she would tear the whole port down to scratch it.\n빅터 | "Sit down." (앉아.)\nThe sea went flat under the pier.' },
  ]);
  const store = { ...S.emptyStore(), cast: ['빅터', '세라'], scenes: [{ id: 'S1', start: 0, end: 0, title: 'x', summary: 'y', events: [], recollections: [], present: ['빅터'], charNotes: [{ who: '빅터', kind: 'heart', text: '바다가 내 말보다 그녀 기분을 먼저 따른다.', evidence: [] }] }] };
  const notebook = [
    { who: '빅터', kind: 'heart', when: '부두에서 빅터가 세라를 앉혔을 때', text: 'She would tear the port down for one itch.', evidence: ['1.1'] },
    { who: '빅터', kind: 'heart', when: '부두에서 빅터가 세라를 앉혔을 때', text: '바다가 내 말보다 그녀 기분을 먼저 따르는구나.', evidence: ['1.1'] },
    { who: '빅터', kind: 'about', about: '세라', when: '부두에서 빅터가 세라를 앉혔을 때', text: '세라는 가려운 걸 못 참으면 항구를 통째로 뒤엎을 애다.', evidence: ['1.3'] },
  ];
  const result = { scenes: [{ end: 1, time: '25-03-02', place: '부두', title: '부두', summary: '요약', present: ['빅터', '세라'], events: [{ text: '앉혔다', quotes: [] }], recollections: [], facts: [], notebook }] };
  const notes = S.applyScenes(store, result, slice, 1, undefined, { notebook: true }).scenes[0].charNotes;
  assert.equal(notes.length, 1, 'a near-copy of the story and a repeat of an earlier note: dropped');
  assert.equal(notes[0].text, '세라는 가려운 걸 못 참으면 항구를 통째로 뒤엎을 애다.');
  // An English speaker: English is right, Korean is not; a near-copy of a narration sentence is dropped.
  const en = L.prepareMessages([{ id: 'b1', number: 1, role: 'assistant', speaker: 'Narrator', content: 'Deny her an itch, and she would tear the whole port down to scratch it.\nViktor | "Sit down."' }]);
  const enResult = (items) => ({ scenes: [{ end: 1, time: '25-03-02', place: 'p', title: 't', summary: 's', present: ['Viktor'], events: [{ text: 'e', quotes: [] }], recollections: [], facts: [], notebook: items }] });
  const enStore = { ...S.emptyStore(), cast: ['Viktor', 'Sera'] };
  const stats = {};
  const kept = S.applyScenes(enStore, enResult([
    { who: 'Viktor', kind: 'heart', when: 'When Sera sulked on the pier', text: 'Deny her an itch and she will tear the whole port down to scratch it.', evidence: ['1.1'] },
    { who: 'Viktor', kind: 'heart', when: 'When Sera sulked on the pier', text: '저 여자는 못 말린다.', evidence: ['1.1'] },
    { who: 'Viktor', kind: 'about', about: 'Sera', when: '세라가 부두에서 토라졌을 때', text: 'Tell her no once and she takes it as a dare.', evidence: ['1.2'] },
  ]), en, 1, undefined, { notebook: true, notebookStats: stats }).scenes[0].charNotes;
  // The near-copy is dropped; the Korean note of an English speaker is kept, marked to be rewritten into English.
  // One note per person per scene: the next one for the same person is not kept.
  assert.deepEqual(kept.map((n) => [n.text, n.wantLang || null]), [['저 여자는 못 말린다.', 'en']]);
  assert.deepEqual(stats, { written: 3, copied: 1, keptWrongLanguage: 1, tooMany: 1 });
  // A situation line in the wrong language marks the note too.
  assert.equal(Nb.cleanNote({ who: 'Viktor', kind: 'heart', when: '세라가 부두에서 토라졌을 때', text: 'Tell her no once and she takes it as a dare.' }, { cast: ['Viktor', 'Sera'], person: (n) => n, langs: { Viktor: 'en' } }).wantLang, 'en');
  // What the model writes is kept short: a long note is cut at a sentence end, a long situation line is clipped.
  const long = Nb.cleanNote({ who: 'Viktor', kind: 'heart', when: '가'.repeat(90), text: `${'Sera never says sorry, she just brings coffee. '.repeat(2)}And then a third sentence that goes on.` }, { cast: ['Viktor'], person: (n) => n });
  assert.equal(long.text, 'Sera never says sorry, she just brings coffee. Sera never says sorry, she just brings coffee.');
  assert.equal(long.when.length, Nb.WHEN_LEN);
  // English needs more letters for the same line: a longer limit, so a line like this one is not cut.
  const enWhen = 'When Sera said at the harbour cafe that she could not read French at all, then hid'.padEnd(150, ' x');
  assert.equal(Nb.cleanNote({ who: 'Viktor', kind: 'heart', when: enWhen.slice(0, 100), text: 'Learned that.' }, { cast: ['Viktor'], person: (n) => n }).when, enWhen.slice(0, 100).trim());
  assert.equal(Nb.cleanNote({ who: 'Viktor', kind: 'heart', when: enWhen, text: 'Learned that.' }, { cast: ['Viktor'], person: (n) => n }).when.length, Nb.WHEN_LEN_LATIN);
  // A pointing word in a note that already names the person is clear enough.
  const people = { cast: ['빅터', '세라'], person: (n) => n };
  assert.equal(Nb.cleanNote({ who: '빅터', kind: 'about', about: '세라', when: '부두에서', text: '세라는 우산을 잊음. 그녀는 늘 그럼.' }, people).vague, undefined);
  assert.equal(Nb.cleanNote({ who: '빅터', kind: 'about', about: '세라', when: '부두에서', text: '그녀는 늘 우산을 잊음.' }, people).vague, true);
  // One language for everyone that is not Korean: said plainly, with an English example.
  assert.match(Nb.voiceBlock({}, {}, { langs: { 빅터: 'en', 세라: 'en' } }), /\[수첩 언어\] 모두 English[^]*한국어로 쓰지 마[^]*Learned that/);
  assert.match(Nb.PROMPT, /이름을 한 번 쓴 사람은 그다음엔 주어를 빼도 돼/);
  // Evidence pointed at an unrelated line is moved to the sentence that fits the note.
  const moved = S.applyScenes(enStore, enResult([{ who: 'Viktor', kind: 'about', about: 'Sera', when: 'When Sera sulked on the pier', text: 'Sera would wreck a whole port over one small itch.', evidence: ['1.2'] }]), en, 1, undefined, { notebook: true }).scenes[0].charNotes;
  assert.deepEqual(moved[0].evidence, [{ number: 1, sentence: 1 }]);
  // Repeats in English are caught by words.
  assert.ok(Nb.sameNote('The sea waits on her mood now, not mine.', 'My sea answers her mood before it answers me.'));
  assert.ok(!Nb.sameNote('The sea waits on her mood now, not mine.', 'She memorized a dockworker\'s name out of spite.'));
});

test('fold: the same thought written again replaces the older one; edits, stars and deletions stay', () => {
  const scene = (id, notes) => ({ id, end: 1, charNotes: notes.map(([who, kind, text]) => ({ who, kind, text, evidence: [{ number: 1, sentence: 1 }] })) });
  const store = { scenes: [
    scene('S1', [['빅터', 'about', '세라는 단 걸 싫다면서 체리는 잘만 먹는다.'], ['빅터', 'heart', '세라를 다시는 혼자 두지 않겠다.']]),
    scene('S2', [['빅터', 'about', '세라는 단 걸 싫다면서 체리는 잘만 먹는구나.']]),
  ] };
  let file = Nb.fold(store, Nb.emptyNotebook());
  assert.deepEqual(file.notes.map((n) => n.text), ['세라를 다시는 혼자 두지 않겠다.', '세라는 단 걸 싫다면서 체리는 잘만 먹는구나.']);
  const vow = file.notes[0].id;
  file = Nb.fold(store, Nb.starNote(Nb.editNote(file, vow, '세라를 다시는 혼자 두지 않는다. 절대.'), vow, true));
  assert.equal(file.notes[0].text, '세라를 다시는 혼자 두지 않는다. 절대.');
  assert.equal(file.notes[0].edited, true);
  assert.equal(file.notes[0].star, true);
  file = Nb.fold(store, Nb.deleteNote(file, file.notes[1].id));
  assert.equal(file.notes.length, 1, 'a deleted note is not written back');
});

test('reply: the people in the scene only; three core notes (★ first, then the newest) and up to three that fit the talk', () => {
  const notes = [
    ...Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, who: '빅터', kind: 'heart', text: `빅터 메모 ${i}.` })),
    { id: 'star', who: '빅터', kind: 'heart', text: '세라를 지킨다.', star: true },
    { id: 's1', who: '세라', kind: 'about', text: '빅터는 거짓말할 때 귀를 만진다.' },
    { id: 'm1', who: '마르코', kind: 'heart', text: '자리에 없음.' },
  ];
  // By meaning: the matches above this question's average go in, closest first; a weak one does not.
  const related = [{ id: 'n1', z: 2.1 }, { id: 'n0', z: 1.3 }, { id: 'n2', z: 0.2 }, { id: 'n5', z: 3 }];
  const line = Nb.injectionBlock({ ...Nb.emptyNotebook(), notes }, ['빅터', '세라'], { related });
  assert.match(line, /^\[수첩\] \(각 인물만 아는/);
  assert.match(line, /빅터: 세라를 지킨다\. \/ 빅터 메모 5\. \/ 빅터 메모 4\. \(지금 떠오르는 것: 빅터 메모 1\. \/ 빅터 메모 0\.\)/, 'core: ★ then newest; then the matches not already in');
  assert.doesNotMatch(line, /빅터 메모 2/);
  // Without meaning search: the notes that share words with the talk now.
  const byWords = Nb.injectionBlock({ ...Nb.emptyNotebook(), notes: [...notes, { id: 'w', who: '빅터', kind: 'about', text: '세라는 체리를 좋아한다.' }, { id: 'x', who: '빅터', kind: 'heart', text: '아무 상관 없는 메모.' }, { id: 'y', who: '빅터', kind: 'heart', text: '최근 메모 하나.' }, { id: 'z', who: '빅터', kind: 'heart', text: '최근 메모 둘.' }] }, ['빅터'], { query: '체리 좋아해?' });
  assert.match(byWords, /지금 떠오르는 것: 세라는 체리를 좋아한다\./);
  const line2 = Nb.injectionBlock({ ...Nb.emptyNotebook(), notes }, ['빅터', '세라']);
  assert.equal((line2.match(/빅터 메모/g) || []).length, 2, 'no matches: the three core notes only');
  assert.match(line, /세라: 빅터는 거짓말할 때 귀를 만진다\./);
  assert.doesNotMatch(line, /마르코/);
  assert.equal(Nb.injectionBlock({ ...Nb.emptyNotebook(), notes }, ['미나']), '');
  // The line is kept in Korean when the memory goes in another language.
  assert.equal(T.planLines(line, 'en')[0].kind, 'keep');
});

test('service: the route edits, stars and deletes; refused while the feature is off; backups carry the notebook', async () => {
  const room = 'nb1';
  X.saveScenes(room, { ...S.emptyStore(), cast: ['빅터'], scenes: [{ id: 'S1', start: 1, end: 1, title: 't', summary: 's', events: [], recollections: [], present: ['빅터'], charNotes: [{ who: '빅터', kind: 'heart', text: '이번엔 늦지 않는다.', evidence: [{ number: 1, sentence: 1 }] }] }] });
  assert.match((await call('POST /chats/:id/notebook', room, { action: 'star', id: 'x' })).error, /인물의 수첩|꺼져/);
  X.saveSettings({ ...X.settings(), chats: { [room]: { enabled: true, features: { notebook: 'on' } } } });
  X.refreshWorld(room, X.loadScenes(room));
  const id = X.loadNotebook(room).notes[0].id;
  const starred = await call('POST /chats/:id/notebook', room, { action: 'star', id });
  assert.ifError(starred.error);
  assert.equal(starred.result.notes['빅터'][0].star, true);
  assert.equal((await call('POST /chats/:id/notebook', room, { action: 'edit', id, text: '이번엔 절대 늦지 않는다.' })).result.notes['빅터'][0].text, '이번엔 절대 늦지 않는다.');
  assert.match((await call('POST /chats/:id/notebook', room, { action: 'fly', id })).error, /edit, star, unstar, delete/);
  assert.deepEqual((await call('POST /chats/:id/notebook', room, { action: 'delete', id })).result.notes, {});
  const doc = B.build({ chatId: room, chatName: 'x', moduleVersion: 'x', files: { notebook: X.loadNotebook(room) }, settingsEntry: null });
  assert.doesNotThrow(() => B.validate(doc));
});

test('meaning search: notes are pieces of their own, kept when scenes are pruned, matched only as they read now', () => {
  const V = require('../memory-module/lib/vectors.cjs');
  const index = V.emptyIndex('m');
  const notes = [{ id: 'a', who: '빅터', text: '세라는 어둠을 싫어한다.' }, { id: 'b', who: '빅터', text: '총은 늘 왼쪽 서랍에.' }];
  const docs = V.staleNotes(index, notes);
  assert.deepEqual(docs.map((d) => d.key), ['nb:a', 'nb:b']);
  V.putVectors(index, docs, [[1, 0], [0, 1]]);
  index.items.S1 = { h: 'x', v: V.pack([1, 1]) };
  V.prune(index, []);
  assert.ok(index.items['nb:a'] && !index.items.S1, 'scene pruning leaves the notes');
  assert.deepEqual(V.nearestNotes(index, [[1, 0.1]], notes).map((x) => x.id), ['a', 'b']);
  assert.deepEqual(V.nearestNotes(index, [[1, 0.1]], [{ ...notes[0], text: '고쳐진 메모.' }, notes[1]]).map((x) => x.id), ['b'], 'an edited note waits for its new vector');
  V.pruneNotes(index, [notes[1]]);
  assert.ok(!index.items['nb:a'] && index.items['nb:b']);
});

test('the library shows a note in another language with its Korean', () => {
  const texts = T.displayTexts({ scenes: [] }, { threads: [] }, { world: { notes: [{ text: 'She hates the dark.' }] } });
  assert.ok(texts.includes('She hates the dark.'));
  const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8');
  // The Korean is editable: a correction becomes the note's own language when the note is saved (as elsewhere).
  assert.ok(source.includes('aria-label="${esc(n.who)}의 메모">${esc(n.text)}</textarea>${trEdit(n.text)}'));
  assert.ok(source.includes("${n.when ? trEdit(n.when) : ''}"));
  assert.ok(source.includes('const fixes = koreanEditsIn(root.querySelector(`[data-note="${CSS.escape(id)}"]`));'));
  assert.ok(source.includes('const body = await applyKoreanEdits(fixes, { text, ...(when != null ? { when } : {}) });'));
});

test('both installers copy the new file to the server', () => {
  for (const f of ['install.sh', 'install.ps1']) assert.ok(fs.readFileSync(path.join(__dirname, '..', f), 'utf8').includes('memory-module/lib/notebook.cjs'), f);
});

test('the library: 수첩만 다시 받기 shows the job and its buttons', () => {
  const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const start = source.indexOf('  function notebookRebuildPaper(');
  const box = (job, armed = '') => vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { esc, icon: () => '', info: { notebookJob: job } })(armed);
  assert.match(box({ state: 'idle' }), /data-act="noteRebuild"[^]*data-act="noteRebuildAll">모든 장면 다시 받기/);
  assert.match(box({ state: 'idle' }, 'noteRebuildAll'), /한 번 더 누르면 모든 장면을 다시 받습니다/);
  const running = box({ state: 'running', stage: '1~8 / 20 장면' });
  assert.match(running, /1~8 \/ 20 장면[^]*채팅은 그대로 계속/);
  assert.match(running, /data-act="noteRebuildStop"/);
  assert.doesNotMatch(running, /data-act="noteRebuild"/);
  assert.match(box({ state: 'done', done: 12, total: 12, kept: 9, stats: { repeat: 2, noEvidence: 1 } }), /장면 12개를 읽고 메모 9개를 적었습니다 \(겹치거나 근거가 없는 3개는 뺐습니다\)/);
  assert.match(box({ state: 'error', error: 'rate limited', done: 8, total: 20 }), /rate limited[^]*8\/20개까지 저장/);
  assert.ok(source.includes("'noteDelete', 'noteRebuildAll',"), 'the second click is not lost');
  assert.ok(source.includes("info?.notebookJob?.state === 'running' ? 3000 : 10000"), 'checked often while it runs');
});

test('the library: a notebook section per person, and the buttons are wired', () => {
  const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const start = source.indexOf('  function notebookPaper(');
  const fn = vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { esc, openLists: new Set(), notebookRebuildPaper: () => 'REBUILD', notebookLanguagePaper: () => '', ...require('./ui-shared.cjs')(source, esc) });
  const html = fn({ notebook: true, notes: { 빅터: [{ id: 'n1', who: '빅터', kind: 'about', about: '세라', text: '체리를 좋아한다.', star: true, sceneId: 'S1' }] }, sceneTitles: { S1: '체리' } }, '');
  assert.match(html, /^REBUILD/, 'the 수첩만 다시 받기 box comes first');
  assert.match(html, /인물의 수첩 · 1명/);
  assert.match(html, /빅터의 수첩<\/b> · 1개 · ★ 1/);
  assert.match(html, /알게 된 것[^]*세라에 대해/);
  assert.match(html, /data-act="noteUnstar"/);
  assert.equal(fn({ notebook: false }, ''), '');
  assert.ok(source.includes("'keepDelete', 'noteDelete',"), 'the delete confirmation survives the second click');
  assert.ok(source.includes("actName === 'noteStar' ? 'star' : 'unstar'"));
});

test('the notebook has a tab of its own (with the 인물·장소 data), and an off notice there', () => {
  const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(source.includes("['notebook', '수첩', 'note']"));
  assert.ok(source.includes('notebook: viewNotebook'));
  assert.ok(source.includes("const needsWorld = () => tab === 'world' || tab === 'notebook';"));
  const world = source.slice(source.indexOf('  function viewWorld() {'), source.indexOf('\n  }\n', source.indexOf('  function viewWorld() {')));
  assert.ok(!world.includes('notebookPaper('), 'not on the 인물·장소 tab any more');
  const esc = (v) => String(v ?? '');
  const start = source.indexOf('  function viewNotebook(');
  const view = (w) => vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { esc, info: {}, world: w, worldRoom: 'r', room: 'r', worldError: '', armed: '', icon: () => '', emptyRoom: () => 'EMPTY', notebookPaper: () => 'PAPER' })();
  assert.match(view({ notebook: true, notes: { 빅터: [{}, {}] } }), /NOTEBOOK · 2 NOTES[^]*PAPER/);
  assert.match(view({ notebook: false }), /인물의 수첩<\/b>이 꺼져 있습니다/);
});

test('the situation line (상황): goes into the reply before the note, can be reworded, is searched and translated with it', () => {
  const store = { scenes: [{ id: 'S1', end: 3, charNotes: [{ who: '빅터', kind: 'heart', when: '세라가 우산을 두고 갔을 때', text: '다음엔 내가 챙겨야지.', evidence: [] }] }] };
  let file = Nb.fold(store, null);
  const id = file.notes[0].id;
  assert.equal(file.notes[0].when, '세라가 우산을 두고 갔을 때');
  assert.match(Nb.injectionBlock(file, ['빅터']), /빅터: \(세라가 우산을 두고 갔을 때\) 다음엔 내가 챙겨야지\./);
  file = Nb.fold(store, Nb.editNote(file, id, '', undefined, '비 오는 날 세라가 우산을 두고 갔을 때'));
  assert.equal(file.notes[0].when, '비 오는 날 세라가 우산을 두고 갔을 때', 'the user\'s wording of it stays');
  assert.equal(file.notes[0].text, '다음엔 내가 챙겨야지.');
  file = Nb.fold(store, Nb.editNote(file, id, '', undefined, ''));
  assert.equal(file.notes[0].when, '세라가 우산을 두고 갔을 때', 'empty puts it back');
  assert.match(require('../memory-module/lib/vectors.cjs').noteDocs(file.notes)[0].text, /^빅터: \(세라가 우산을 두고 갔을 때\) 다음엔/);
  const texts = T.displayTexts({ scenes: [] }, { threads: [] }, { world: { notes: [{ when: 'When Sera left her umbrella', text: 'Next time I bring it.' }] } });
  assert.ok(texts.includes('When Sera left her umbrella') && texts.includes('Next time I bring it.'));
  assert.equal(Nb.PER_PERSON_KEPT, 80);
});

test('a note in the wrong language is rewritten (a plain memo from the character\'s view), and kept as it is when that fails', async () => {
  const notes = [{ who: '빅터', when: 'When the lights went out', text: 'She hates the dark.', wantLang: 'ko' }, { who: '빅터', text: 'I will not be late again.', wantLang: 'ko' }];
  const [system, user] = Nb.buildNoteLanguagePrompt(notes, { names: [{ from: 'Sera', to: '세라' }] });
  assert.match(system.content, /point of view[^]*no imitation of their way of talking/);
  assert.deepEqual(JSON.parse(user.content), { notes: [{ who: '빅터', lang: 'ko', when: 'When the lights went out', text: 'She hates the dark.' }, { who: '빅터', lang: 'ko', text: 'I will not be late again.' }] });
  assert.deepEqual(Nb.readNoteLanguage({ lines: [{ when: '정전으로 불이 꺼졌을 때', text: '걔는 어둠을 질색하지.' }, 'Still English.'] }, notes), [{ when: '정전으로 불이 꺼졌을 때', text: '걔는 어둠을 질색하지.' }, null], 'a line still in the wrong language is not taken');
  assert.deepEqual(Nb.readNoteLanguage({ lines: ['걔는 어둠을 질색하지.', '다시는 안 늦어.'] }, notes), [{ text: '걔는 어둠을 질색하지.' }, { text: '다시는 안 늦어.' }], 'a plain string is the note alone');
  assert.equal(Nb.readNoteLanguage({ lines: ['하나만'] }, notes), null);
  const store = { scenes: [{ events: [{ quotes: [{ by: '빅터', text: '"Sit."', translation: '앉아.' }, { by: '세라', text: '"싫어."' }] }] }] };
  assert.deepEqual(Nb.voiceFromScenes(store, ['빅터', '세라']), { 빅터: ['앉아.'], 세라: ['싫어.'] });
  // The service: no connection set, so the rewrite fails; asked once more on the next run, then left as written.
  const room = 'nb-lang';
  const scenes = { ...S.emptyStore(), cast: ['빅터'], scenes: [{ id: 'S1', start: 1, end: 1, title: 't', summary: 's', events: [], recollections: [], present: ['빅터'], charNotes: [{ who: '빅터', kind: 'heart', text: 'She hates the dark.', wantLang: 'ko', evidence: [{ number: 1, sentence: 1 }] }] }] };
  X.saveSettings({ ...X.settings(), connection: null, translateConnection: null });
  const job = {};
  assert.equal(await X.fixNoteLanguages(room, scenes, job), 0, 'no model: no call made');
  assert.equal(scenes.scenes[0].charNotes[0].wantLang, 'ko', 'tried again next time');
  await X.fixNoteLanguages(room, scenes, job);
  assert.equal(scenes.scenes[0].charNotes[0].text, 'She hates the dark.');
  assert.equal('wantLang' in scenes.scenes[0].charNotes[0], false);
  assert.equal('langTries' in scenes.scenes[0].charNotes[0], false);
  assert.equal(await X.fixNoteLanguages(room, scenes, job), 0, 'nothing left to rewrite');
});

test('the library reloads the Korean when new lines were made in the background, and looks more often meanwhile', () => {
  const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8');
  assert.ok(source.includes('polledInfo.translationStamp !== trStamp'));
  assert.ok(source.includes("info?.displayTranslating || "));
});

test('the library: 수첩 언어 picker shows the choices and what the default follows now', () => {
  const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const start = source.indexOf('  function notebookLanguagePaper(');
  const fn = vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { esc });
  const html = fn({ notebookLanguage: 'en', notebookWriteLanguage: 'en' });
  assert.match(html, /id="setNoteLang"/);
  assert.match(html, /기억 정리 언어 따라감 \(지금: 영어\)/);
  assert.match(html, /<option value="en" selected>/);
  assert.match(html, /인물이 말하는 언어/);
  assert.ok(source.includes("e.target.id === 'setNoteLang'"));
});
