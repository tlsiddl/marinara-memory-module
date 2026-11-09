(() => {
  'use strict';
  // 기억 서재 (기억 모듈판): a window onto the server-side memory module (/api/memory-module).
  // All memory lives on the server; this only shows it and sends the user's changes back.
  const VERSION = '/*__VERSION__*/';
  const UI_CSS = /*__UI_CSS__*/ '';
  const THEME_CSS = /*__THEME_CSS__*/ '';
  const host = typeof marinara === 'object' ? marinara : globalThis.marinara || {};
  const BASE = '/api/memory-module';
  const NAV = [
    ['home', '한눈에', 'archive'],
    ['scenes', '장면', 'folder'],
    ['search', '검색', 'search'],
    ['facts', '알게 된 사실', 'person'],
    ['ledger', '아직 끝나지 않은 일', 'note'],
    ['life', '최근 생활', 'clock'],
    ['world', '인물·장소', 'folder'],
    ['names', '이름 정리', 'person'],
    ['inject', '주입 확인', 'search'],
    ['settings', '설정', 'settings'],
  ];
  const KIND = { emotion: '감정', state: '상태', promise: '약속', secret: '비밀', pending: '미해결' };
  // Promises first, as in the memory that goes into replies: they were easy to lose under many feelings.
  const KIND_ORDER = ['promise', 'emotion', 'state', 'secret', 'pending'];
  const REMEMBERS = { full: '온전히 기억', partial: '흐릿하게만 기억', none: '기억 못 함' };
  const IMPORTANCE = { critical: '★ 결정적', major: '중요', minor: '작음' };
  const STATE = { idle: '쉬는 중', running: '정리 중', done: '완료', error: '오류' };

  let root = null;
  let open = false;
  let tab = 'home';
  let room = '';
  let rooms = [];
  let info = null;
  let store = null;
  let storeRoom = '';
  let roomLoadSequence = 0;
  // Tabs that show scenes, facts or links into them (the open-items tab links each item to its scenes).
  const needsScenes = () => ['scenes', 'search', 'facts', 'ledger'].includes(tab);
  // The open items carry their evidence quotes (most of the room data): fetched with the scenes, only for the tabs that list them.
  const needsThreads = () => ['scenes', 'search', 'ledger'].includes(tab);
  let threadsData = null;
  let threadsRoom = '';
  let threadsKey = '';
  const threadsFresh = () => !needsThreads() || Array.isArray(info?.threads) || (threadsRoom === room && threadsKey === info?.threadsStamp);
  const threadList = () => (Array.isArray(info?.threads) ? info.threads : threadsRoom === room && threadsData ? threadsData : []);
  /** Counts for the overview and the side rail (an older server sends the whole list instead). */
  const threadStats = () => {
    if (info?.threadStats) return info.threadStats;
    const open = (info?.threads || []).filter((t) => t.status === 'open');
    return { open: open.length, emotion: open.filter((t) => t.kind === 'emotion').length, promise: open.filter((t) => t.kind === 'promise').length };
  };
  async function loadThreads(id) {
    if (Array.isArray(info?.threads) || (threadsRoom === id && threadsKey === info?.threadsStamp)) return;
    const key = info?.threadsStamp;
    const t = await api('GET', `/chats/${encodeURIComponent(id)}/threads`);
    if (room !== id || disposed) return;
    threadsData = t.threads || [];
    threadsRoom = id;
    threadsKey = key;
  }
  let scenesLoading = false;
  let selectedScene = '';
  /** Which shelf the scenes tab shows: a chapter id, or '' for the scenes not in a chapter yet. */
  let selectedGroup = null;
  let selectedArc = '';
  let searchDraft = '';
  // The quote id typed into the dialogue check record's filter ("#1.24", "1.2").
  let attributionFilter = '';
  // The room's name table, the names in use, duplicates and "같은 사람일 수 있음" (the 이름 정리 tab).
  let names = null;
  let namesRoom = '';
  // 인물·장소 tab: the cards and places of the room, and the two "add" boxes.
  let world = null;
  let worldRoom = '';
  let worldError = '';
  let worldForm = { person: '', place: '', keep: '', keepOwner: '' };
  // 날짜·주기 트래커: the form being filled (null = closed) and the small "이 장면부터" picker on a scene card.
  let trackerDraft = null;
  let scenePicker = null;
  // 알게 된 사실 tab: the conflicts between facts (null while not loaded; a failure only hides the banner).
  let conflicts = null;
  let conflictsRoom = '';
  let namesError = '';
  let nameForm = { source: '', target: '', display: '', text: true };
  // The 호칭 사전 form (id is set while an entry is being edited).
  let addressForm = { id: '', from: '', to: '', term: '', note: '' };
  /** What a rename or merge would change, shown before it is applied: { kind: 'rename' | 'merge', data, form }. */
  let namePreview = null;
  let searchQuery = '';
  /** Folded lists the person opened (kept open when the screen is drawn again). */
  const openLists = new Set();
  let connections = [];
  let serverEmbedding = null;
  let serverSettings = null;
  /** Memory left by rooms Marinara no longer has (null until the settings tab asks). */
  let orphans = null;
  // Korean for memory written in another language (and for quoted lines, when that setting is on).
  let trMap = {};
  let trPending = 0;
  let trError = '';
  let trWorking = false;
  let trAuto = true;
  let notice = '';
  let lastError = '';
  let busy = false;
  let pollTimer = null;
  let armed = '';
  /** A backup file the person picked, with the server's preview of it: { room, doc, data, cross }. */
  let restorePreview = null;
  let backupVectors = false;
  let disposed = false;
  let theme = 'light';
  /** 'marinara' follows the font set in Marinara; 'own' uses the library's Myeongjo/sans pair. */
  let font = 'marinara';
  /** A record to jump to after the next render: { kind: 'thread' | 'fact', id }. */
  let focus = null;
  /** A group story (two or more characters): who-knows-what fields are shown. */
  const group = () => (info?.cast || store?.cast || []).filter((n) => !(store?.personas || info?.personas || []).includes(n)).length >= 2;
  try {
    const saved = localStorage.getItem('memory-module-theme');
    theme = ['light', 'dark'].includes(saved) ? saved : window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    font = localStorage.getItem('memory-module-font') === 'own' ? 'own' : 'marinara';
  } catch {}

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const activeChatId = () => {
    try {
      return localStorage.getItem('marinara-active-chat-id') || '';
    } catch {
      return '';
    }
  };

  function icon(name) {
    const paths = {
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
      moon: '<path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      person: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
      library: '<path d="M6 3h12a2 2 0 0 1 2 2v16H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"/><path d="M6 3v15h14M10 3v8l3-2 3 2V3"/>',
      archive: '<path d="M3 7h18v14H3zM2 3h20v4H2zM9 11h6"/>',
      folder: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11H3z"/>',
      book: '<path d="M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v16h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4zM12 5v16"/>',
      note: '<path d="M5 3h10l4 4v14H5zM15 3v5h4M8 12h8M8 16h6"/>',
      search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
      settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
      close: '<path d="m6 6 12 12M6 18 18 6"/>',
      refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6"/>',
      spark: '<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z"/>',
    };
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.note}</svg>`;
  }

  /* ---------- server ---------- */

  async function api(method, path, body) {
    const init = { method, credentials: 'same-origin', cache: 'no-store', headers: { 'x-marinara-csrf': '1' } };
    if (method !== 'GET') {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body ?? {});
    }
    let response;
    try {
      response = await fetch(path.startsWith('/api/') ? path : BASE + path, init);
    } catch {
      throw Error('서버에 연결하지 못했습니다. 마리나라가 다시 켜지는 중이라면 잠시 뒤에 다시 시도해 주세요.');
    }
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: text.slice(0, 200) };
    }
    if (response.status === 404 && !data?.error) throw Error('서버에 기억 모듈이 없거나 꺼져 있습니다. 서버에 기억 모듈을 설치했는지 확인해 주세요.');
    // Marinara 2.5.2 signs browsers in for remote access; a session that ran out answers 401 to every request.
    if (response.status === 401) throw Error('마리나라 로그인이 끝났습니다. 페이지를 새로 고쳐 다시 로그인한 뒤 기억 서재를 열어 주세요.');
    if (!response.ok) throw Error(data?.error || `서버 오류 (${response.status})`);
    return data;
  }

  // 왜 이 기억이 들어갔나 is a full extra render on the server, so it is fetched only while the 주입 확인 tab is shown and kept until the room data reloads.
  let recallReportData = null;
  let recallReportRoom = '';
  let recallReportError = '';
  let recallReportLoading = false;
  async function ensureRecallReport() {
    if (tab !== 'inject' || !room || recallReportLoading || (recallReportRoom === room && (recallReportData || recallReportError))) return;
    const id = room;
    recallReportLoading = true;
    render();
    try {
      const report = await api('GET', `/chats/${encodeURIComponent(id)}/recall-report`);
      if (room === id && !disposed) { recallReportData = report; recallReportRoom = id; recallReportError = ''; }
    } catch (error) {
      if (room === id) { recallReportData = null; recallReportRoom = id; recallReportError = error?.message || String(error); }
    } finally {
      recallReportLoading = false;
      if (!disposed) render();
    }
    if (room !== id) void ensureRecallReport();
  }

  // The dialogue check record and the chosen memories are large too: fetched only while the overview shows them, and
  // fetched again when the room data says they changed (their stamp).
  const lazy = {};
  const lazyPart = (name) => (lazy[name] ||= { room: '', key: '', data: null, error: '', loading: false });
  const lazyData = (name) => { const p = lazyPart(name); return p.room === room ? p.data : null; };
  const lazyError = (name) => { const p = lazyPart(name); return p.room === room ? p.error : ''; };
  async function ensureLazy(name, route, key) {
    const p = lazyPart(name);
    const id = room;
    if (!id || p.loading || (p.room === id && p.key === key && (p.data || p.error))) return;
    p.loading = true;
    try {
      const data = await api('GET', `/chats/${encodeURIComponent(id)}/${route}`);
      if (room === id && !disposed) { p.data = data; p.room = id; p.key = key; p.error = ''; }
    } catch (error) {
      if (room === id) { p.data = null; p.room = id; p.key = key; p.error = error?.message || String(error); }
    } finally {
      p.loading = false;
      if (!disposed) render();
    }
  }
  function ensureLazyParts() {
    if (!info || tab !== 'home') return;
    if (info.selectedCount > 0) void ensureLazy('selected', 'selected-memories', info.selectedStamp);
    if (info.attributionRuns > 0 && (attributionFilter || openLists.has('attrlog'))) void ensureLazy('attribution', 'attribution-log', info.attributionStamp);
  }

  async function loadRoom(id) {
    const sequence = ++roomLoadSequence;
    if (!id) { info = null; store = null; storeRoom = ''; return; }
    const i = await api('GET', `/chats/${encodeURIComponent(id)}`);
    if (sequence !== roomLoadSequence || room !== id || disposed) return;
    info = i;
    recallReportData = null; recallReportRoom = ''; recallReportError = '';
    if (tab === 'inject') void ensureRecallReport();
    // The room's glossary from the 번역 프리셋·단어장 extension (when installed) goes to the module first, so names in
    // the Korean notes follow it.
    await syncGlossary(id);
    if (sequence !== roomLoadSequence || room !== id || disposed) return;
    // Korean notes for memory in English are shown on every tab (open items, daily life, home), not only scenes.
    await loadTranslations(id);
    if (sequence !== roomLoadSequence || room !== id || disposed) return;
    if (needsNames()) await loadNames(id);
    if (sequence !== roomLoadSequence || room !== id || disposed) return;
    if (needsWorld()) await loadWorld(id);
    if (sequence !== roomLoadSequence || room !== id || disposed) return;
    if (needsConflicts()) await loadConflicts(id);
    if (sequence !== roomLoadSequence || room !== id || disposed) return;
    if (needsThreads()) await loadThreads(id);
    if (sequence !== roomLoadSequence || room !== id || disposed) return;
    if (!needsScenes()) return;
    if (storeRoom !== id || !store) {
      const scenes = await api('GET', `/chats/${encodeURIComponent(id)}/scenes`);
      if (sequence !== roomLoadSequence || room !== id || disposed) return;
      store = scenes;
      storeRoom = id;
    }
    if (selectedScene && !store.scenes.some((x) => x.id === selectedScene)) selectedScene = '';
    if (!selectedScene && selectedGroup === null) selectedScene = store.scenes.at(-1)?.id || '';
  }

  const needsNames = () => ['names', 'life'].includes(tab);
  const needsWorld = () => tab === 'world';
  async function loadWorld(id) {
    try {
      const w = await api('GET', `/chats/${encodeURIComponent(id)}/world`);
      if (room !== id || disposed) return;
      world = w;
      worldRoom = id;
      worldError = '';
    } catch (error) {
      if (room !== id) return;
      world = null;
      worldError = error?.message || String(error);
    }
  }
  async function ensureWorld() {
    if (!needsWorld() || !room || (world && worldRoom === room)) return;
    await loadWorld(room);
    render();
  }
  const needsConflicts = () => tab === 'facts';
  async function loadConflicts(id) {
    try {
      const c = await api('GET', `/chats/${encodeURIComponent(id)}/conflicts`);
      if (room !== id || disposed) return;
      conflicts = c;
      conflictsRoom = id;
    } catch {
      // An older server has no such route: the facts are shown without the banner.
      if (room === id) { conflicts = null; conflictsRoom = id; }
    }
  }
  async function ensureConflicts() {
    if (!needsConflicts() || !room) return;
    await loadConflicts(room);
    render();
  }
  async function loadNames(id) {
    try {
      const n = await api('GET', `/chats/${encodeURIComponent(id)}/names`);
      if (room !== id || disposed) return;
      names = n;
      namesRoom = id;
      namesError = '';
    } catch (error) {
      if (room !== id) return;
      names = null;
      namesError = error?.message || String(error);
    }
  }
  async function ensureNames() {
    if (!needsNames() || !room || (names && namesRoom === room)) return;
    await loadNames(room);
    render();
  }

  async function loadTranslations(id) {
    try {
      const t = await api('GET', `/chats/${encodeURIComponent(id)}/translations`);
      if (room !== id || disposed) return;
      trMap = t.items || {};
      trPending = t.missing || 0;
      trError = t.error || '';
      trWorking = Boolean(t.working);
      trAuto = t.auto !== false;
    } catch (error) {
      if (room === id) trError = error?.message || String(error);
    }
  }

  /**
   * The glossary of the 번역 프리셋·단어장 extension for this room ("Daniel = 다니엘" lines; the room's own, else the
   * extension's default). Found by the extension's name, since its id differs on every install. Sent once per room and
   * glossary text; nothing happens when the extension is not installed or cannot be read.
   */
  const GLOSSARY_EXTENSION = '번역 프리셋·단어장';
  const glossarySent = new Map();
  let glossaryExtensionId;
  async function syncGlossary(id) {
    try {
      if (glossaryExtensionId === undefined) {
        const list = await api('GET', '/api/personal-extensions/runtime/client');
        // The original and the 기억 서재 호환 edition ("번역 프리셋·단어장 (기억 서재 호환)") both count.
        glossaryExtensionId = (Array.isArray(list) ? list : []).find((e) => typeof e?.name === 'string' && e.name.startsWith(GLOSSARY_EXTENSION))?.id || null;
      }
      if (!glossaryExtensionId) return;
      const stored = await api('GET', `/api/personal-extensions/${encodeURIComponent(glossaryExtensionId)}/storage`);
      const config = stored?.value?.config;
      const scope = config?.chats?.[id] || config?.defaults;
      const text = typeof scope?.glossary === 'string' ? scope.glossary : '';
      if (glossarySent.get(id) === text) return;
      await api('POST', `/chats/${encodeURIComponent(id)}/glossary`, { glossary: text, source: GLOSSARY_EXTENSION });
      glossarySent.set(id, text);
    } catch {}
  }

  /** The Korean for a memory text, when there is one and it differs. */
  function ko(text) {
    const t = trMap[String(text ?? '').trim()];
    return t && t !== text ? t : null;
  }
  /**
   * The Korean of a value in the optional records (인물 상태·장소·소중한 물건), shown under its box: one text, or a
   * list whose items are each looked up. Nothing when there is no translation (Korean already, or not made yet).
   */
  const trLine = (value) => {
    const list = Array.isArray(value) ? value : [value];
    const korean = list.map((x) => ko(x) || x);
    return korean.some((x, i) => x !== list[i]) ? `<small class="tr-inline">한국어: ${esc(korean.join(' · '))}</small>` : '';
  };
  /** A name or label with its Korean after it in brackets, when there is one. */
  const withKo = (text) => (ko(text) ? `${esc(text)} <small class="tr-inline">(${esc(ko(text))})</small>` : esc(text));
  /** A name field ("Daniel", "A·B") with each name written the Korean way the module gave. */
  const nameShown = (field) => String(field ?? '').split(/(\s*[·,、]\s*)/).map((part, i) => (i % 2 ? part : trMap[part] || part)).join('');
  const trNote = (text) => (ko(text) ? `<p class="tr-note full"><span>한국어</span>${esc(ko(text))}</p>` : '');
  const shown = (text) => ko(text) || text || '';
  /**
   * The Korean of an English memory note, editable: a correction here is turned into the English note when the form is
   * saved (only what the correction changes). Lines quoted from the story keep the read-only note (trNote).
   */
  const trEdit = (text) => {
    const k = ko(text);
    if (!k) return '';
    return `<label class="tr-edit full"><span>한국어 · 고치면 저장할 때 원래 언어(영어·중국어) 기억도 고쳐집니다</span><textarea class="event-field" data-tr-src="${esc(String(text).trim())}" data-tr-ko="${esc(k)}">${esc(k)}</textarea></label>`;
  };
  /** The English field a Korean box belongs to: the field right before it (or inside the label right before it). */
  const englishFieldOf = (box) => {
    const prev = box.closest('.tr-edit')?.previousElementSibling;
    if (!prev) return null;
    return prev.matches('input, textarea') ? prev : prev.querySelector('input, textarea');
  };
  /**
   * The Korean corrections in `scope`, read right away (before act() draws the screen again and the form is gone):
   * [{ en, ko }] for each Korean box that was changed while its own English field was not. A field whose English was
   * edited by hand keeps the hand edit (its Korean correction is left out).
   */
  function koreanEditsIn(scope) {
    const pending = [];
    for (const box of scope?.querySelectorAll('textarea[data-tr-src]') || []) {
      const after = box.value.trim();
      if (!after || after === box.dataset.trKo.trim()) continue;
      const field = englishFieldOf(box);
      if (!field || field.value.trim() !== box.dataset.trSrc) continue;
      pending.push({ en: box.dataset.trSrc, ko: after });
    }
    return pending;
  }
  /**
   * The corrections become the memory's own language in `body` (already read from the form): the translation model
   * changes each note only where the corrected Korean differs, and every field of the body that still holds that note
   * gets the result. Lines quoted from the story are never touched. Throws when the model cannot do it, so nothing is
   * saved half-way.
   */
  async function applyKoreanEdits(pending, body) {
    if (!pending.length) return body;
    const result = await api('POST', `/chats/${encodeURIComponent(room)}/translations/back`, { items: pending.map(({ en, ko }) => ({ en, ko })) });
    const next = new Map();
    (result?.items || []).forEach((x, i) => { if (pending[i] && x?.en) next.set(pending[i].en, x.en); });
    const swap = (v, key) => {
      if (key === 'quotes' || key === 'loose') return v;
      if (typeof v === 'string') return next.get(v.trim()) ?? v;
      if (Array.isArray(v)) return v.map((x) => swap(x));
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x, k)]));
      return v;
    };
    return swap(body);
  }

  /**
   * A tab that needs the scenes was opened before they were loaded: fetch them now, even while another action is
   * running (that action would otherwise swallow the request and leave the tab empty).
   */
  async function ensureScenes() {
    if (!needsScenes() || !room || ((store && storeRoom === room) && threadsFresh()) || scenesLoading) return;
    const id = room;
    scenesLoading = true;
    render();
    try {
      if (needsThreads()) await loadThreads(id);
      if (room !== id || disposed) return;
      if (!store || storeRoom !== id) {
        const scenes = await api('GET', `/chats/${encodeURIComponent(id)}/scenes`);
        if (room !== id || disposed) return;
        store = scenes;
        storeRoom = id;
      }
      if (selectedScene && !store.scenes.some((x) => x.id === selectedScene)) selectedScene = '';
      if (!selectedScene && selectedGroup === null) selectedScene = store.scenes.at(-1)?.id || '';
    } catch (error) {
      lastError = error?.message || String(error);
    } finally {
      scenesLoading = false;
      if (!disposed) render();
    }
  }

  async function refresh() {
    lastError = '';
    if (!rooms.length) rooms = (await api('GET', '/chats')) || [];
    store = null;
    storeRoom = '';
    if (!room) room = activeChatId() || rooms[0]?.id || '';
    await loadRoom(room);
    schedulePoll();
  }

  /** The scene a message number falls in. */
  function sceneOf(number) {
    return number == null ? null : (store?.scenes || []).find((x) => x.start <= number && number <= x.end) || null;
  }

  /** A small button that opens a scene in the scene tab. */
  function sceneLink(scene, label = '') {
    return scene ? `<span class="chip-wrap"><a href="#" class="record-link chip" data-goto-scene="${esc(scene.id)}"><span class="chip-id">${esc(scene.id)}</span><span class="chip-title">${esc(scene.title)}</span><span class="chip-arrow">›</span></a>${label ? `<small>${esc(label)}</small>` : ''}</span>` : '';
  }

  /**
   * The same link for a scene known only by its id (the people, places and items tabs, trackers): the title comes from
   * the given id-to-title map, else from the loaded scenes. Always inside .record-links, so the links stack on a phone.
   */
  function sceneRef(id, label = '', titles = {}) {
    if (!id) return '';
    return sceneLink({ id, title: titles?.[id] || (store?.scenes || []).find((x) => x.id === id)?.title || '' }, label);
  }
  const sceneRefs = (...refs) => { const html = refs.filter(Boolean).join(''); return html ? `<div class="record-links">${html}</div>` : ''; };

  /** Ledger items that started, changed or ended inside a scene. */
  function threadsIn(scene) {
    const inside = (n) => n != null && scene.start <= n && n <= scene.end;
    const out = [];
    for (const t of threadList()) {
      const how = inside(t.openedAt?.number)
        ? '시작'
        : (t.closed?.evidence || []).some((p) => inside(p.number))
          ? '끝남'
          : [...(t.evidence || []), ...(t.clues || [])].some((p) => inside(p.number)) || inside(t.latest?.number)
            ? '바뀜'
            : '';
      if (how) out.push({ t, how });
    }
    return out;
  }

  function running() {
    return info && (info.job?.state === 'running' || info.sceneJob?.state === 'running');
  }

  /**
   * While the library is open it keeps checking: every 3 seconds during a run, every 10 seconds otherwise, so a
   * run that starts on its own after a reply (or the scene run that follows the ledger run) shows up too.
   */
  function schedulePoll() {
    clearTimeout(pollTimer);
    if (!open || disposed || !room) return;
    const was = running();
    pollTimer = setTimeout(async () => {
      try {
        if (!busy) {
          // Idle: only the small status is asked for; the whole room is loaded while a run is on and when it ends.
          if (was) {
            store = null;
            storeRoom = '';
            await loadRoom(room);
          }
          else {
            const wasPreparing = info?.translationPrep?.working;
            const polledRoom = room;
            const polledInfo = await api('GET', `/chats/${encodeURIComponent(polledRoom)}`);
            if (polledRoom !== room || disposed) { schedulePoll(); return; }
            info = polledInfo;
            if ((wasPreparing || info?.translationPrep?.working) && tab === 'settings' && !editing()) render();
            if (trPending) {
              const before = `${trPending}:${trError}:${trWorking}`;
              await loadTranslations(room);
              if (`${trPending}:${trError}:${trWorking}` !== before && !editing()) render();
            }
          }
          if (was && !running()) notice = [info?.job?.state, info?.sceneJob?.state].includes('error') ? '정리가 멈췄습니다. 아래 오류를 확인해 주세요.' : '정리가 끝났습니다.';
          if (was || running()) (editing() ? renderStatus() : render());
        }
      } catch {}
      schedulePoll();
    }, was || info?.translationPrep?.working ? 3000 : 10000);
  }

  /** Someone is typing in the library: a background check must not redraw the form under them. */
  function editing() {
    const el = root?.activeElement;
    return Boolean(el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  }

  /** Only the running mark and the status line, leaving the rest of the page as it is. */
  function renderStatus() {
    if (!root) return;
    root.querySelector('#panel').classList.toggle('is-running', Boolean(busy || (info && running())));
    root.querySelector('#status').textContent = running() ? '정리 중입니다… 3초마다 새로 확인합니다.' : notice;
  }

  async function act(fn, done, options = {}) {
    if (busy) return;
    busy = true;
    lastError = '';
    notice = '';
    render();
    try {
      await fn();
      if (done) notice = done;
      if (options.reload !== false) {
        store = null;
        storeRoom = '';
        await loadRoom(room);
      }
    } catch (error) {
      lastError = error?.message || String(error);
    } finally {
      busy = false;
      render();
      schedulePoll();
    }
  }

  /* ---------- views ---------- */

  const roomName = () => rooms.find((r) => r.id === room)?.name || '채팅방을 선택해 주세요';
  const tokens = (text) => Math.round(String(text || '').length / 1.5).toLocaleString();
  const day = (iso) => (iso ? String(iso).slice(2, 10) : '');

  function quoteLine(q) {
    let text = String(q.text || '').replace(/<speaker="[^"]*">/g, '').replace(/<\/speaker>/g, '');
    const prefix = text.match(/^\s*([^|"“(]{1,20}?)\s*\|\s*/);
    const by = q.by || (prefix ? prefix[1].trim() : '');
    if (prefix) text = text.slice(prefix[0].length);
    // The original and its translation are saved apart and shown in one form: "original" (번역).
    if (typeof q.translation === 'string' && q.translation.trim()) text = `${text.trim()} (${q.translation.trim()})`;
    return { who: by ? `${by}${q.to ? ` → ${q.to}${q.toGuess ? '(추정)' : ''}` : ''}` : q.to ? `화자 미확정 → ${q.to}${q.toGuess ? '(추정)' : ''}` : (/^\s*["“'‘「『]/.test(text) ? '대사' : '서술'), text: text.trim() };
  }

  /** A warning when this Marinara is not the version the module was tested on, or a patch could not go in. */
  /** Where this room's memory stands in the language it goes in (the library's settings, under 기억 언어). */
  function prepNote() {
    const p = info?.translationPrep;
    if (!p || !p.total) return '';
    const name = p.target === 'en' ? '영어' : '한국어';
    if (p.working) return `<p class="hint"><b>이 방 기억을 ${name}로 옮기는 중입니다</b> — ${p.total - p.left} / ${p.total}줄. 창을 닫아도 서버에서 계속합니다.</p>`;
    if (p.error) return `<p class="hint"><b>번역하지 못했습니다.</b> 남은 ${p.left}줄은 원래 언어로 들어가고, 잠시 뒤 다시 시도합니다. (${esc(p.error)})</p>`;
    if (p.left) return `<p class="hint">이 방 기억 ${p.total}줄 중 ${p.left}줄이 아직 번역되지 않았습니다. 잠시 뒤 다시 시도합니다.</p>`;
    return `<p class="hint"><b>이 방 기억은 ${name}로 넣을 준비가 끝났습니다</b> (${p.total}줄).</p>`;
  }

  function healthNote() {
    const h = info?.health;
    if (!h) return '';
    const NAMES = { macro: '{{기억}} 자리 채우기', app: '답변 뒤 자동 정리와 이 화면', speakers: '말풍선 태그 되살리기', speakerNamesPrompt: '대사 이름 표시 지침', speakerPrompt: '화자 태그 생성 지침', speakerPreview: '화자 태그 미리보기 지침', speakerDryRun: '화자 태그 미리 생성 지침' };
    const notes = [];
    for (const b of h.broken || []) notes.push(b.reason === 'version'
      ? `기억 파일 ${b.file}은(는) 이 버전의 기억 모듈이 모르는 형식입니다(${b.error}). 더 새 버전에서 만든 파일일 수 있습니다. 덮어쓰지 않도록 이 파일의 저장과 정리를 멈췄습니다. 기억 모듈을 그 파일을 만든 버전 이상으로 업데이트해 주세요.${b.backup ? ` 원본 복사본: ${b.backup}` : ''}`
      : `기억 파일 ${b.file}이(가) 손상되어 읽지 못했습니다. 덮어쓰지 않도록 이 파일의 저장과 정리를 멈췄습니다.${b.backup ? ` 원본 복사본: ${b.backup}` : ''} 파일을 고치거나 지운 뒤 마리나라를 다시 켜 주세요.`);
    if (h.failed?.length) notes.push(`이 마리나라 버전에서는 ${h.failed.map((k) => NAMES[k] || k).join(', ')} 기능이 꺼져 있습니다. 마리나라는 그대로 정상 작동합니다. 기억 모듈 업데이트가 나오면 설치해 주세요.`);
    const tested = Array.isArray(h.testedList) && h.testedList.length ? h.testedList : h.tested ? [h.tested] : [];
    if (h.marinara && tested.length && !tested.includes(h.marinara)) notes.push(`마리나라 ${h.marinara} 버전입니다. 기억 모듈은 ${tested.join(', ')}에서 확인했습니다.${h.failed?.length ? '' : ' 지금은 모든 기능이 정상으로 붙었습니다.'}`);
    return notes.length ? `<div class="note">${notes.map(esc).join('<br>')}</div>` : '';
  }

  function selectedMemoriesHtml() {
    const loaded = Array.isArray(info?.selectedMemories) ? info.selectedMemories : lazyData('selected')?.items || null;
    const count = loaded ? loaded.length : info?.selectedCount || 0;
    if (!count) return '';
    const list = loaded || [];
    const wait = loaded ? '' : lazyError('selected') ? `<div class="note">${esc(lazyError('selected'))}</div>` : '<p class="hint">불러오는 중…</p>';
    return `<div class="paper"><h2>직접 선택한 기억 · ${count}개</h2><p class="hint">채팅에서 선택해 정리한 기억입니다. 관련된 내용이 나오면 원문과 함께 참고합니다.</p>${wait}${list.map(x => `<details><summary>${esc(x.title)}${x.stale ? ' · 원문 변경됨' : ''}</summary><p>${esc(x.summary)}</p>${x.parts.map(p => `<blockquote>${esc(p.text)}</blockquote>`).join('')}<button data-act="deleteSelectedMemory" data-selected-id="${esc(x.id)}">삭제</button></details>`).join('')}</div>`;
  }

  function viewHome() {
    if (!info) return emptyRoom();
    const openCount = threadStats().open;
    const job = info.job || {};
    const sj = info.sceneJob || {};
    const rc = info.recall || {};
    const lt = info.summary?.lastTidy;
    return `
      <div class="eyebrow">MEMORY MODULE · v${esc(info.version || '?')}</div>
      <h1>${esc(roomName())}</h1>
      <p class="intro">지나간 대화를 장면·사실·장부로 정리해, 답변할 때마다 필요한 기억을 넣어 주는 서버 기억 모듈입니다. 이 방에서 기억을 켜 두면 답변마다 자동으로 정리되며, 여기서 고친 내용은 다음 답변부터 반영됩니다.</p>
      ${healthNote()}
      ${selectedMemoriesHtml()}
      ${info.summary?.needsRebuild ? `<div class="note">예전 메시지가 수정·삭제되어 장부(아직 끝나지 않은 일·최근 생활)를 처음부터 다시 정리해야 합니다. ${info.summary.rebuildFrom ? `다시 정리하기 전까지는 ${esc(info.summary.rebuildFrom)}번 메시지 전에 정리된 내용만 기억 칸에 넣습니다.` : '다시 정리하기 전까지는 장부 내용을 기억 칸에 넣지 않습니다.'} 아래 '처음부터 다시 정리'를 눌러 주세요(장면 기억은 영향이 없습니다).</div>` : ''}
      <div class="metric-row">
        <div class="metric"><strong>${info.scenes?.count ?? 0}</strong><small>장면 · 메시지 ${info.scenes?.coveredThrough ?? '-'}번까지</small></div>
        ${info.scenes?.chapters ? `<div class="metric"><strong>${info.scenes.chapters}</strong><small>챕터</small></div>` : ''}
        <div class="metric"><strong>${info.scenes?.facts ?? 0}</strong><small>알게 된 사실</small></div>
        <div class="metric"><strong>${openCount}</strong><small>아직 끝나지 않은 일</small></div>
        <div class="metric"><strong>${tokens(info.rendered)}</strong><small>넣는 기억 (대략 토큰)</small></div>
      </div>
      <div class="paper">
        <div class="paper-toolbar"><h2>정리 작업</h2><span class="pill ${running() ? '' : 'neutral'}">${running() ? '진행 중' : '대기'}</span></div>
        <p class="hint">장부: ${esc(STATE[job.state] || job.state || '쉬는 중')}${job.stage ? ` · ${esc(job.stage)}` : ''}${job.total ? ` (${job.done}/${job.total})` : ''}<br>
        장면: ${esc(STATE[sj.state] || sj.state || '쉬는 중')}${sj.stage ? ` · ${esc(sj.stage)}` : ''}${lt ? `<br>마지막 장부 점검: 닫음 ${lt.closed}${lt.feelingsResolved != null ? ` (풀린 감정 ${lt.feelingsResolved})` : ''} · 합침 ${lt.merged}` : ''}</p>
        ${job.error ? `<div class="note">${esc(job.error)}</div>` : ''}${sj.error ? `<div class="note">${esc(sj.error)}</div>` : ''}
        ${attributionLogHtml(info, sj)}
        <div class="buttons">
          <button class="primary" data-act="start" ${running() ? 'disabled' : ''}>${icon('refresh')} 이어서 정리</button>
          <button data-act="tidy" ${running() ? 'disabled' : ''}>장부 점검</button>
          <button data-act="fresh" ${running() ? 'disabled' : ''}>${armed === 'fresh' ? '한 번 더 누르면 처음부터 다시 정리' : '처음부터 다시 정리'}</button>
          ${info.scenes?.chapters ? `<button data-act="rebuildChapters" ${running() ? 'disabled' : ''}>${armed === 'chapters' ? '한 번 더 누르면 챕터를 다시 묶습니다' : '챕터만 다시 묶기'}</button>` : ''}
          ${running() ? '<button data-act="stop">멈추기</button>' : ''}
        </div>
        ${armed === 'fresh' ? '<div class="note" role="status">처음부터 다시 정리하면 직접 고친 장면·사실도 사라집니다. <button data-act="backupDownload">먼저 백업 내려받기</button> 를 누르면 지금 상태가 파일로 저장되고, 이 확인 상태는 그대로 유지됩니다. 꼭 받으셔야 하는 것은 아닙니다.</div>' : ''}
        <small>‘이어서 정리’는 밀린 정리를 바로 처리합니다. ‘챕터만 다시 묶기’는 장면·사실·장부를 유지하고 챕터와 큰 흐름만 새로 만듭니다. 직접 고친 챕터·큰 흐름은 바뀌며, 정리 모델 사용량이 발생합니다. 처음부터 다시 정리하면 직접 고친 장면도 사라집니다.</small>
      </div>
      ${deadlinePaper()}
      <div class="paper">
        <h2>최근 회상</h2>
        ${rc.at
          ? `<p class="hint">${rc.used === 'model' ? '기억 모델이 골랐습니다' : '빠른 방식으로 골랐습니다'} · ${(rc.ms / 1000).toFixed(1)}초</p>
             ${rc.picks?.length ? rc.picks.map((p) => `<p><span class="pill">${esc(p.id)}</span> ${esc(p.title || '')}${p.why ? `<br><small>${esc(p.why)}</small>` : ''}</p>`).join('') : '<p class="hint">고른 장면이 없습니다.</p>'}
             ${rc.raw?.length ? `<small>원문에서 찾은 대목: ${rc.raw.map((x) => `${x.number}번`).join(', ')}</small>` : ''}
             ${rc.error ? `<div class="note">${esc(rc.error)}</div>` : ''}`
          : '<p class="hint">다음 답변부터 표시됩니다.</p>'}
      </div>`;
  }

  /** Things with a date to meet: nearest first, with how far off they are on the story's own calendar. */
  function deadlinePaper() {
    const list = info?.deadlines || [];
    if (!list.length) return '';
    const label = (d) =>
      d.state === 'shelved' ? `${-d.days}일 지남 · 보관 중` : d.state === 'overdue' ? `${-d.days}일 지남` : d.state === 'today' ? '오늘' : d.state === 'ahead' ? `D-${d.days}` : '작중 날짜 모름';
    return `<div class="paper">
        <div class="paper-toolbar"><h2>기한</h2>${info.storyDate ? `<span class="pill neutral">작중 오늘 ${esc(info.storyDate)}</span>` : ''}</div>
        ${list.map((d) => `<p class="deadline ${esc(d.state)}"><span class="pill ${d.state === 'ahead' || d.state === 'unknown' ? 'neutral' : ''}">${esc(label(d))}</span> <b title="${esc(d.title)}">${esc(shown(d.title))}</b><br><small>${esc(d.id)} · ${esc(d.date)}${d.time ? ` ${esc(d.time)}` : ''}${d.who ? ` · ${esc(d.who)}` : ''}</small></p>`).join('')}
        <small>기한이 가까운 것부터 답변마다 들어갑니다. 기한이 지나고 50개 메시지 동안 언급이 없으면 '보관 중'이 되어, 관련 이야기가 나올 때만 들어갑니다. 날짜는 장부 탭에서 고칠 수 있습니다.</small>
      </div>`;
  }

  function emptyRoom() {
    if (room && (scenesLoading || busy)) return `<div class="empty">${icon('refresh')}불러오는 중입니다…</div>`;
    return `<div class="empty">${icon('library')}채팅방을 선택해 주세요. 마리나라에서 채팅방을 열면 그 방이 먼저 표시됩니다.</div>`;
  }

  function viewScenes() {
    if (!store) return emptyRoom();
    if (!store.scenes.length) return `<h1>장면</h1><div class="empty">${icon('folder')}아직 장면이 없습니다. 컨텍스트 밖으로 밀려난 메시지가 생기면 정리됩니다.</div>`;
    const firstInside = info?.scenes?.firstInside;
    const chapters = store.chapters || [];
    const chapterOf = (id) => chapters.find((c) => c.scenes.includes(id)) || null;
    // The shelf follows the selected scene's chapter unless a chapter was picked on purpose.
    if (selectedGroup === null || (selectedGroup && !chapters.some((c) => c.id === selectedGroup))) selectedGroup = chapterOf(selectedScene)?.id || '';
    const chapter = chapters.find((c) => c.id === selectedGroup) || null;
    const inGroup = chapter ? store.scenes.filter((x) => chapter.scenes.includes(x.id)) : store.scenes.filter((x) => !chapterOf(x.id));
    const bar = chapters.length
      ? `<div class="chapter-bar">${chapters.map((c) => `<button class="chapter-chip ${c.id === selectedGroup ? 'is-selected' : ''}" data-group="${esc(c.id)}"><span class="chip-id">${esc(c.id)}</span>${esc(shown(c.title))}</button>`).join('')}<button class="chapter-chip ${selectedGroup === '' ? 'is-selected' : ''}" data-group=""><span class="chip-id">NOW</span>최근 장면</button></div>`
      : '';
    const shelf = inGroup
      .map((s) => {
        const i = store.scenes.indexOf(s);
        const outside = firstInside == null || s.start < firstInside;
        return `<button class="file-index ${s.id === selectedScene ? 'is-selected' : ''} ${outside ? '' : 'is-current'}" data-scene="${esc(s.id)}">
          <span class="file-code">${esc(s.id)}<span class="file-range">메시지 ${s.start}~${s.end}</span></span><span class="file-spine">SCENE ${String(i + 1).padStart(3, '0')}</span>
          <h3 title="${esc(s.title)}">${esc(shown(s.title))}</h3><span class="barcode"></span>
          <span class="file-foot"><span>${esc((s.time || '').split(/\s+/).slice(0, 2).join(' '))}</span><span>${s.edited ? '고침' : ''}</span></span></button>`;
      })
      .join('');
    const s = inGroup.find((x) => x.id === selectedScene);
    const arcs = store.arcs || [];
    const arc = arcs.find((a) => a.id === selectedArc) || null;
    const arcBar = arcs.length
      ? `<p class="hint">큰 흐름 — 오래된 챕터 여러 개를 한 번 더 묶은 것입니다. 기억 칸의 '지난 이야기 흐름' 맨 앞에 늘 들어갑니다.</p><div class="chapter-bar arc-bar">${arcs.map((a) => `<button class="chapter-chip ${a.id === selectedArc ? 'is-selected' : ''}" data-arc="${esc(a.id)}"><span class="chip-id">${esc(a.id)} · ${esc(a.chapters[0])}~${esc(a.chapters.at(-1))}</span>${esc(a.title)}</button>`).join('')}</div>${arc ? arcEditor(arc) : ''}`
      : '';
    return `<div class="eyebrow">SCENES · ${store.scenes.length}${chapters.length ? ` · CHAPTERS · ${chapters.length}` : ''}</div><h1>장면</h1>
      <p class="intro">ON AIR 도장이 찍힌 카드는 아직 모델이 원문으로 직접 보고 있는 장면입니다(기억 칸에는 들어가지 않습니다). 카드를 누르면 아래에서 고치실 수 있습니다.${chapters.length ? ' 오래된 장면은 챕터로 묶여, 기억 칸에는 챕터 요약으로 들어갑니다.' : ''}</p>
      ${arcBar}${bar}${chapters.length ? `<div class="buttons"><button data-act="rebuildChapters" ${running() ? 'disabled' : ''}>${armed === 'chapters' ? '한 번 더 누르면 챕터를 다시 묶습니다' : '챕터만 다시 묶기'}</button><small>장면·사실·장부는 그대로 두고 챕터와 큰 흐름만 새로 묶습니다. 챕터·큰 흐름을 직접 고친 내용은 사라집니다.</small></div>` : ''}${chapter ? chapterEditor(chapter) : ''}
      <div class="file-shelf" id="shelf">${shelf || '<p class="hint">이 묶음에는 장면이 없습니다.</p>'}</div>${s ? sceneEditor(s) : ''}`;
  }

  /** Search the room's loaded records literally; punctuation is not a pattern. */
  // Only what a person wrote or reads: titles, summaries, events, lines, names, places. Ids, message numbers,
  // fingerprints and internal marks ("critical", "m12") are not searched or shown.
  const SEARCH_TEXT = new Set(['title', 'summary', 'text', 'why', 'time', 'place', 'weather', 'what', 'kept', 'detail', 'cause', 'need', 'about', 'who', 'toward', 'by', 'to', 'how', 'turns', 'keep', 'present']);
  const SEARCH_NESTED = new Set(['events', 'quotes', 'loose', 'recollections', 'later', 'learned', 'latest', 'closed', 'evidence', 'clues']);
  function searchableText(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return value.map(searchableText).filter(Boolean).join(' ');
    if (typeof value !== 'object') return String(value);
    const parts = [];
    for (const [k, v] of Object.entries(value)) {
      if (v == null) continue;
      if (SEARCH_TEXT.has(k)) parts.push(Array.isArray(v) ? v.filter((x) => typeof x === 'string').join(' ') : typeof v === 'string' ? v : '');
      else if (SEARCH_NESTED.has(k)) parts.push(searchableText(v));
    }
    return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ');
  }

  function viewSearch() {
    if (!store) return emptyRoom();
    const query = searchQuery.toLocaleLowerCase();
    const groups = [
      ['장면', 'scene', store.scenes || []],
      ['챕터', 'chapter', store.chapters || []],
      ['큰 흐름', 'arc', store.arcs || []],
      ['사실', 'fact', store.facts || []],
      ['미해결·닫힌 기록', 'thread', threadList()],
    ];
    const results = [];
    if (query) for (const [label, kind, records] of groups) for (const record of records) {
      const text = searchableText(record);
      const at = text.toLocaleLowerCase().indexOf(query);
      if (at < 0) continue;
      const start = Math.max(0, at - 45);
      const excerpt = `${start ? '…' : ''}${text.slice(start, at + query.length + 110)}${text.length > at + query.length + 110 ? '…' : ''}`;
      results.push(`<a href="#" class="record-link record-row" data-goto-${kind}="${esc(record.id)}"><span class="pill neutral">${label}</span><span class="row-main"><b>${esc(record.title || record.about || record.id)}</b><small>${esc(excerpt)}</small></span><span class="chip-arrow">›</span></a>`);
    }
    return `<h1>기억 검색</h1><p class="intro">이 방의 장면·챕터·큰 흐름·사실·미해결 기록과 닫힌 기록에서 입력한 글자를 찾습니다. 결과를 누르면 해당 기록으로 이동합니다.</p>
      <form id="memorySearch" class="memory-search"><label for="memorySearchInput">검색어</label><div class="buttons"><input id="memorySearchInput" type="search" value="${esc(searchDraft)}" placeholder="이름, 대사, 장소 등" autocomplete="off"><button class="primary" type="submit">${icon('search')}검색</button><button type="button" data-act="clearSearch">초기화</button></div></form>
      <div role="status">${query ? `${results.length}개 검색 결과` : '검색어를 입력하고 검색 버튼이나 Enter를 눌러 주세요.'}</div>
      <div class="record-list">${results.join('') || (query ? '<p class="hint">일치하는 기억이 없습니다.</p>' : '')}</div>`;
  }

  function arcEditor(a) {
    return `<div class="paper chapter-paper" id="arcEditor" data-id="${esc(a.id)}">
      <div class="paper-toolbar"><h2>${esc(a.id)} · ${esc(a.chapters[0])}~${esc(a.chapters.at(-1))}${a.time ? ` · ${esc(a.time)}` : ''}</h2>${a.edited ? '<span class="pill">직접 고침</span>' : ''}</div>
      <div class="form-grid">
        <label class="full">큰 흐름 제목<input id="aTitle" value="${esc(a.title)}"></label>${trEdit(a.title)}
        <label class="full">요약<textarea id="aSummary" class="event-field" style="min-height:110px">${esc(a.summary)}</textarea></label>${trEdit(a.summary)}
        <label class="full">그 시기를 바꾼 일 (한 줄에 하나)<textarea id="aTurns" class="event-field">${esc((a.turns || []).join('\n'))}</textarea></label>
        <label class="full">지금까지 영향을 주는 세부 사항 (한 줄에 하나)<textarea id="aKeep" class="event-field">${esc((a.keep || []).join('\n'))}</textarea></label>
      </div>
      <div class="buttons editor-actions"><button class="primary" data-act="saveArc">이 큰 흐름 저장</button></div>
    </div>`;
  }

  function chapterEditor(c) {
    return `<div class="paper chapter-paper" id="chapterEditor" data-id="${esc(c.id)}">
      <div class="paper-toolbar"><h2>${esc(c.id)} · ${esc(c.scenes[0])}~${esc(c.scenes.at(-1))}${c.time ? ` · ${esc(c.time)}` : ''}</h2>${c.edited ? '<span class="pill">직접 고침</span>' : ''}${markButtons(c.id, info?.recallPrefs)}</div>
      <div class="form-grid">
        <label class="full">챕터 제목<input id="cTitle" value="${esc(c.title)}"></label>${trEdit(c.title)}
        <label class="full">챕터 요약 (기억 칸의 '지난 이야기 흐름'에 들어갑니다)<textarea id="cSummary" class="event-field" style="min-height:120px">${esc(c.summary)}</textarea></label>${trEdit(c.summary)}
        <label class="full">전환점 (한 줄에 하나)<textarea id="cTurns" class="event-field">${esc((c.turns || []).join('\n'))}</textarea></label>
        <label class="full">꼭 기억할 세부 사항 (날짜·기한·조건 등, 한 줄에 하나)<textarea id="cKeep" class="event-field">${esc((c.keep || []).join('\n'))}</textarea></label>
      </div>
      <div class="buttons editor-actions"><button class="primary" data-act="saveChapter">이 챕터 저장</button></div>
    </div>`;
  }

  function sceneEditor(s) {
    const personas = info?.personas || [];
    const events = s.events
      .map((e, i) => `<article data-event="${i}">
        <div class="form-grid">
          <label class="full">사건 (누가 누구에게 무엇을 어떻게)<textarea class="event-field" data-f="text">${esc(e.text)}</textarea></label>${trEdit(e.text)}
          <label>작중 시각<input data-f="time" value="${esc(e.time || '')}" placeholder="예: 02:22"></label>
          <label>중요도<select data-f="importance">${Object.entries(IMPORTANCE).map(([k, v]) => `<option value="${k}" ${(e.importance || 'major') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="full">계기 (원문에 있을 때만)<input data-f="why" value="${esc(e.why || '')}"></label>${trEdit(e.why)}
        </div>
        ${e.quotes.map((q, qi) => [q, qi]).sort(([a], [b]) => (a.number ?? 0) - (b.number ?? 0) || (a.sentence ?? 0) - (b.sentence ?? 0)).map(([q, qi]) => { const l = quoteLine(q); return `<div class="quote-card" data-quote="${qi}"><small>${esc(l.who)} · #${q.number}.${q.sentence}</small><blockquote>${esc(l.text)}</blockquote>${q.translation ? '' : trNote(q.text)}<label>말한 사람<input data-quote-by value="${esc(q.by || '')}" placeholder="모르면 비워 두기"></label><label>들은 사람${q.toGuess ? ' (추정 · 고치면 확정)' : ''}<input data-quote-to value="${esc(q.to || '')}" placeholder="모르면 비워 두기"></label></div>`; }).join('')}
      </article>`)
      .join('');
    const loose = [...(s.loose || [])].sort((a, b) => (a.number ?? 0) - (b.number ?? 0) || (a.sentence ?? 0) - (b.sentence ?? 0)).map((q) => { const l = quoteLine(q); return `<div class="quote-card loose"><small>${esc(l.who)} · #${q.number}.${q.sentence} · 연결 미확정</small><blockquote>${esc(l.text)}</blockquote>${q.translation ? '' : trNote(q.text)}</div>`; }).join('');
    const recs = s.recollections
      .map((r, i) => {
        const persona = personas.includes(r.who);
        return `<article data-rec="${i}">
          <div class="form-grid">
            <label>인물<input data-f="who" value="${esc(r.who)}"></label>
            <label>기억 정도<select data-f="remembers">${Object.entries(REMEMBERS).map(([k, v]) => `<option value="${k}" ${r.remembers === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
            <label class="full">이유 (잠, 열, 술 등)<input data-f="why" value="${esc(r.why || '')}"></label>
            ${persona ? '<p class="full hint">사용자 캐릭터는 속마음을 적지 않습니다. 한 말과 행동은 사건에 기록되어 있습니다.</p>' : `<label class="full">그때 (그 인물이 실제로 한 말·행동·느낌)<textarea class="event-field" data-f="text">${esc(r.text || '')}</textarea></label>${trEdit(r.text)}`}
            <label class="full">남은 기억 (흐릿하게만 기억할 때)<input data-f="kept" value="${esc(r.kept || '')}"></label>
          </div></article>`;
      })
      .join('');
    return `<div class="paper" id="sceneEditor" data-id="${esc(s.id)}">
      <div class="paper-toolbar"><h2>${esc(s.id)} · 메시지 ${s.start}~${s.end}번</h2>${s.edited ? '<span class="pill">직접 고침</span>' : ''}${markButtons(s.id, info?.recallPrefs)}${scenePickerBox(s)}</div>
      <div class="form-grid">
        <label class="full">제목<input id="sTitle" value="${esc(s.title)}"></label>${trEdit(s.title)}
        <label>작중 시간<input id="sTime" value="${esc(s.time || '')}"></label>
        <label>장소<input id="sPlace" value="${esc(s.place || '')}"></label>
        <label>날씨<input id="sWeather" value="${esc(s.weather || '')}" placeholder="예: 비, 첫눈 / 모르면 비워 두세요"></label>
        <label class="full">요약<textarea id="sSummary" style="min-height:110px">${esc(s.summary)}</textarea></label>${trEdit(s.summary)}
        ${group() ? `<label class="full">그 자리에 있던 사람 (쉼표로 구분 · 없던 인물은 이 장면 일을 모르는 것으로 기억합니다)<input id="sPresent" value="${esc((s.present || []).join(', '))}" placeholder="예: 서아, 도윤"></label>
        ${(s.heardLater || []).length ? `<p class="full hint">나중에 들은 사람: ${s.heardLater.map((h) => `${esc(h.who)}${h.from ? `(${esc(h.from)}에게)` : ''}`).join(', ')}</p>` : ''}` : ''}
        ${(s.extras || []).length ? `<p class="full hint">주변 인물: ${s.extras.map(esc).join(', ')}</p>` : ''}
      </div>
      ${(s.later || []).length ? `<h3>나중에 밝혀진 것</h3>${s.later.map((x) => `<p>${x.when ? `<small>${esc(x.when)}</small><br>` : ''}${esc(shown(x.what))}${x.by ? ` <small>(${esc(x.by)})</small>` : ''}</p>`).join('')}` : ''}
      ${(() => {
        const facts = store.facts.filter((f) => f.sceneId === s.id);
        const threads = threadsIn(s);
        if (!facts.length && !threads.length) return '';
        return `<h3>이 장면과 이어진 기록</h3>
          <div class="record-list">
          ${threads.map(({ t, how }) => `<a href="#" class="record-link record-row" data-goto-thread="${esc(t.id)}"><span class="pill ${t.status !== 'open' ? 'neutral' : ''}">${KIND[t.kind] || t.kind}</span><span class="row-main"><b>${esc(t.title)}</b><small>${esc(t.id)} · 이 장면에서 ${how}${how === '끝남' && t.closed?.how ? `: ${esc(t.closed.how)}` : how === '바뀜' && t.latest?.text && sceneOf(t.latest.number) === s ? `: ${esc(t.latest.text)}` : ''}${how !== '끝남' && t.status !== 'open' ? ' · 지금은 닫힘' : ''}</small></span><span class="chip-arrow">›</span></a>`).join('')}
          ${facts.map((f) => `<a href="#" class="record-link record-row" data-goto-fact="${esc(f.id)}"><span class="pill neutral">사실</span><span class="row-main"><b>${f.about ? `${esc(f.about)}: ` : ''}${esc(f.text)}</b><small>${esc(f.id)}</small></span><span class="chip-arrow">›</span></a>`).join('')}
          </div>`;
      })()}
      <h3>사건</h3><div id="eventEditor">${events || '<p class="hint">사건이 없습니다.</p>'}</div>${loose ? `<h3>연결 미확정 대사</h3><p class="hint">이 장면의 대사지만 어느 사건에 붙을지 확실하지 않아 따로 보관했습니다. 사건을 고쳐 저장하면 다시 맞춰 봅니다.</p>${loose}` : ''}
      <h3>회상</h3><div id="recEditor">${recs || '<p class="hint">회상이 없습니다.</p>'}</div>
      <div class="buttons editor-actions"><button class="primary" data-act="saveScene">이 장면 저장</button><small>저장하면 ‘직접 고침’으로 표시되고 다시 정리해도 유지됩니다. 단, 처음부터 다시 정리하거나 그 장면의 메시지가 바뀌면 사라집니다.</small></div>
    </div>`;
  }

  function readScene() {
    const ed = root.querySelector('#sceneEditor');
    const s = store.scenes.find((x) => x.id === ed.dataset.id);
    const val = (el, f) => el.querySelector(`[data-f="${f}"]`)?.value ?? null;
    const events = [...ed.querySelectorAll('[data-event]')].map((el) => {
      const old = s.events[Number(el.dataset.event)];
      const quotes = old.quotes.map((q, i) => {
        const input = el.querySelector(`[data-quote="${i}"] [data-quote-to]`);
        const speaker = el.querySelector(`[data-quote="${i}"] [data-quote-by]`);
        if (!input) return q;
        const by = speaker?.value.trim() || null, to = input.value.trim() || null;
        // A changed speaker or listener is the user's: automatic checks leave it alone from now on.
        if (to !== (q.to || null)) { const { toGuess, ...sure } = q; return { ...sure, by, to, manual: true }; }
        return by !== (q.by || null) ? { ...q, by, to, manual: true } : { ...q, by, to };
      });
      return { ...old, quotes, text: val(el, 'text'), time: val(el, 'time'), why: val(el, 'why'), importance: val(el, 'importance') };
    });
    const recollections = [...ed.querySelectorAll('[data-rec]')].map((el) => {
      const old = s.recollections[Number(el.dataset.rec)];
      const text = el.querySelector('[data-f="text"]') ? val(el, 'text') : old.text;
      return { who: val(el, 'who'), remembers: val(el, 'remembers'), why: val(el, 'why'), text, kept: val(el, 'kept') };
    });
    return {
      id: s.id,
      body: { title: root.querySelector('#sTitle').value, time: root.querySelector('#sTime').value, place: root.querySelector('#sPlace').value, weather: root.querySelector('#sWeather')?.value ?? '', summary: root.querySelector('#sSummary').value, events, recollections, ...(root.querySelector('#sPresent') ? { present: root.querySelector('#sPresent').value } : {}) },
    };
  }

  function viewFacts() {
    if (!store) return emptyRoom();
    const ids = new Set(store.facts.map((f) => f.id));
    const groups = new Map();
    for (const f of store.facts) {
      const key = f.about || '기타';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(f);
    }
    if (!groups.size) return `<h1>알게 된 사실</h1><div class="empty">${icon('person')}아직 없습니다.</div>`;
    // Facts the user decided against in a conflict ("앞의 것 유지" / "뒤의 것 유지") are left out of the memory text.
    const superseded = new Set();
    for (const c of conflicts?.conflicts || []) {
      if (c.status === 'keepA') superseded.add(c.b);
      else if (c.status === 'keepB') superseded.add(c.a);
    }
    return `<div class="eyebrow">FACTS · ${store.facts.length}</div><h1>알게 된 사실</h1>
      <p class="intro">인물마다 앞으로도 계속 유효한 설정·성격·과거·관계입니다. 인물마다 최신 것부터 고르게 기억 칸에 들어가고, 많이 쌓이면 같은 주제끼리 합쳐집니다.</p>
      ${conflictsPaper(conflicts, store)}
      ${[...groups].map(([who, list]) => `<div class="paper"><h2>${esc(who)}</h2>${list
        .map((f) => {
          const replaced = f.replacedBy && ids.has(f.replacedBy);
          return `<div class="fact-row" data-fact="${esc(f.id)}"><label>${esc(f.id)}${f.unaware?.length ? ` · 모름: ${esc(f.unaware.join('·'))}` : ''}${f.guess?.length ? ` · 짐작만: ${esc(f.guess.join('·'))}` : ''}${f.edited || f.knowSet?.length || f.knownLock ? ' · 직접 고침' : ''}${replaced ? ` · ${esc(f.replacedBy)}로 바뀜(기억 칸에서 제외)` : ''}${superseded.has(f.id) ? ' · 기록 충돌에서 뒤로 물림(기억 칸에서 제외)' : ''}</label>
            ${f.sceneId ? `<p class="record-links">${sceneLink(store.scenes.find((x) => x.id === f.sceneId), '에서 알게 됨')}</p>` : ''}
            ${knowChips(f)}
            <textarea class="event-field">${esc(f.text)}</textarea>${trEdit(f.text)}
            ${group() ? `<div class="form-grid"><label>아는 사람 (쉼표로 구분)<input data-f="knownBy" value="${esc((f.knownBy || []).join(', '))}" placeholder="비워 두면 따로 정하지 않음"></label><label>아직 모르는 인물 (쉼표로 구분)<input data-f="unaware" value="${esc((f.unaware || []).join(', '))}" placeholder="모두 알면 비워 두세요"></label><label>짐작만 하는 인물<input data-f="guess" value="${esc((f.guess || []).join(', '))}" placeholder="없으면 비워 두세요"></label></div>` : ''}
            <div class="buttons"><button data-act="saveFact" data-id="${esc(f.id)}">저장</button><button class="ghost" data-act="deleteFact" data-id="${esc(f.id)}">${armed === `fact:${f.id}` ? '한 번 더 누르면 삭제됩니다' : '삭제'}</button>${replaced ? '' : markButtons(f.id, info?.recallPrefs)}</div></div>`;
        })
        .join('')}</div>`).join('')}`;
  }

  /** 아는 사람 / 모르는 사람 chips of one fact (a fact that says neither shows nothing). */
  function knowChips(f) {
    const known = Array.isArray(f.knownBy) ? f.knownBy : [];
    const unknown = Array.isArray(f.unaware) ? f.unaware : [];
    if (!known.length && !unknown.length) return '';
    const chips = (list, cls) => list.map((n) => `<span class="kchip ${cls}">${esc(n)}</span>`).join('');
    return `<p class="know-chips">${known.length ? `<span class="know-label">아는 사람</span>${chips(known, 'is-known')}` : ''}${unknown.length ? `<span class="know-label">모르는 사람</span>${chips(unknown, 'is-unknown')}` : ''}</p>`;
  }

  /** 알게 된 사실 → 서로 다른 기록: both facts side by side and four answers; nothing is decided by itself. */
  function conflictsPaper(c, st) {
    if (!c || !Array.isArray(c.conflicts) || !c.conflicts.length) return '';
    const ANSWER = { keepA: '앞의 것을 남김', keepB: '뒤의 것을 남김', both: '둘 다 맞음', dismissed: '무시함' };
    const titles = Object.fromEntries((st?.scenes || []).map((x) => [x.id, x.title]));
    const side = (label, fid, text, sid) => `<div><small>${label} · ${esc(fid)}</small><p>${esc(text)}</p>${sceneRefs(sceneRef(sid, '', titles))}</div>`;
    const row = (x) => `<div class="conflict-row" data-cid="${esc(x.id)}"><p class="conflict-head">${esc(x.about)} · ${esc(x.reason)}</p>
      <div class="conflict-pair">${side('앞', x.a, x.aText, x.aScene)}${side('뒤', x.b, x.bText, x.bScene)}</div>
      ${x.status === 'open'
        ? `<div class="buttons"><button data-act="conflictAnswer" data-id="${esc(x.id)}" data-answer="keepA">앞의 것 유지</button><button data-act="conflictAnswer" data-id="${esc(x.id)}" data-answer="keepB">뒤의 것 유지</button><button data-act="conflictAnswer" data-id="${esc(x.id)}" data-answer="both">둘 다 맞음</button><button class="ghost" data-act="conflictAnswer" data-id="${esc(x.id)}" data-answer="dismiss">무시</button></div>`
        : `<p class="hint">내 답: ${esc(ANSWER[x.status] || x.status)} <button class="ghost" data-act="conflictAnswer" data-id="${esc(x.id)}" data-answer="reopen">다시 열기</button></p>`}</div>`;
    return `<div class="paper conflict-paper"><h2>${c.open ? `서로 다른 기록 ${esc(c.open)}건` : '서로 다른 기록 · 모두 답함'}</h2>
      <p class="hint">같은 인물·대상에 대한 기록 가운데 서로 어긋나 보이는 것입니다. 모델을 부르지 않고 글을 비교한 것이라 틀릴 수 있습니다. 저절로 지우거나 바꾸지 않습니다. ‘앞의 것 유지’·‘뒤의 것 유지’는 남기지 않은 쪽을 기억 칸에서만 빼고(지우지 않습니다), ‘둘 다 맞음’·‘무시’는 아무것도 바꾸지 않습니다. 답할 때까지는 둘 다 그대로 들어갑니다.</p>
      ${c.conflicts.map(row).join('')}</div>`;
  }

  function threadRow(t) {
    const who = [t.who, t.toward].filter(Boolean).map(nameShown).join(' → ');
    const when = t.due ? `약속한 때 ${[t.due.date, t.due.time].filter(Boolean).join(' ')}` : t.period ? `기간 ${day(t.period.from)}~${day(t.period.to)}` : '';
    const closed = t.status !== 'open';
    return `<details class="event-row" data-tid="${esc(t.id)}"><summary><span class="event-no">${esc(t.id)}</span><span class="event-main"><b title="${esc(t.title)}">${esc(shown(t.title))}</b><small>${esc(who)}${when ? ` · ${esc(when)}` : ''}${t.unaware?.length ? ` · 모름: ${esc(t.unaware.map(nameShown).join('·'))}` : ''}${t.guess?.length ? ` · 짐작만: ${esc(t.guess.map(nameShown).join('·'))}` : ''}${closed ? ` · 닫힘: ${esc(shown(t.closed?.how))}` : ''}</small></span><span class="pill ${closed ? 'neutral' : ''}">${KIND[t.kind] || t.kind}</span></summary>
      <div class="event-body">
        <div class="form-grid" data-thread="${esc(t.id)}">
          <label class="full">제목<input data-f="title" value="${esc(t.title)}"></label>${trEdit(t.title)}
          <label class="full">설명<textarea class="event-field" data-f="detail">${esc(t.detail || '')}</textarea></label>${trEdit(t.detail)}
          ${t.kind === 'emotion' ? `<label class="full">풀리려면<input data-f="need" value="${esc(t.need || '')}"></label>${trEdit(t.need)}` : ''}
          ${['promise', 'pending'].includes(t.kind) ? `<label>기한 날짜 (작중)<input data-f="dueDate" value="${esc(t.due?.date || '')}" placeholder="예: 24-10-20 / 비우면 기한 없음"></label><label>기한 시각<input data-f="dueTime" value="${esc(t.due?.time || '')}" placeholder="예: 17:00"></label>` : ''}
          ${group() ? `<label>아직 모르는 인물 (쉼표로 구분)<input data-f="unaware" value="${esc((t.unaware || []).join(', '))}" placeholder="모두 알면 비워 두세요"></label><label>짐작만 하는 인물<input data-f="guess" value="${esc((t.guess || []).join(', '))}" placeholder="없으면 비워 두세요"></label>` : ''}
        </div>
        ${(() => {
          const start = sceneOf(t.openedAt?.number);
          const latest = sceneOf(t.latest?.number);
          const end = sceneOf(t.closed?.evidence?.[0]?.number);
          const links = [start && sceneLink(start, '에서 시작'), latest && latest !== start && sceneLink(latest, '에서 바뀜'), end && sceneLink(end, '에서 끝남')].filter(Boolean);
          return links.length ? `<p class="record-links">${links.join('')}</p>` : '';
        })()}
        ${t.cause ? `<p><small>원인</small><br>${esc(shown(t.cause))}</p>` : ''}
        ${t.latest ? `<p><small>최근</small><br>${esc(shown(t.latest.text))}</p>` : ''}
        ${t.evidence?.[0] ? `<div class="quote-card"><small>처음 원문 · #${t.evidence[0].number}</small><blockquote>${esc(quoteLine(t.evidence[0]).text)}</blockquote></div>` : ''}
        <div class="buttons"><button data-act="editThread" data-id="${esc(t.id)}">고친 내용 저장</button>${closed ? `<button data-act="reopen" data-id="${esc(t.id)}">다시 열기</button>` : `<button data-act="closeThread" data-id="${esc(t.id)}">${armed === `close:${t.id}` ? '한 번 더 누르면 닫힙니다' : '끝난 일로 닫기'}</button>`}${closed ? '' : markButtons(t.id, info?.recallPrefs)}</div>
      </div></details>`;
  }

  function viewLedger() {
    if (!info) return emptyRoom();
    const threads = threadList();
    const open = threads.filter((t) => t.status === 'open');
    const closed = threads.filter((t) => t.status !== 'open');
    // Promises with a set day come first, the nearest day first; the rest keep their order.
    const dueOf = (t) => t.due?.date || t.period?.to || '';
    const byDue = (a, b) => (dueOf(a) ? 0 : 1) - (dueOf(b) ? 0 : 1) || dueOf(a).localeCompare(dueOf(b));
    const groups = KIND_ORDER.map((k) => [k, open.filter((t) => t.kind === k).sort(k === 'promise' ? byDue : () => 0)]).filter(([, l]) => l.length);
    return `<div class="eyebrow">LEDGER · ${open.length} OPEN</div><h1>아직 끝나지 않은 일</h1>
      <p class="intro">약속·감정·상태·비밀·미해결 일입니다. 항목을 누르면 제목과 설명을 고치실 수 있고, 잘못 닫힌 항목은 다시 열고 끝난 일은 닫으실 수 있습니다. 직접 고친 내용은 리롤해도 유지됩니다.</p>
      ${groups.length ? groups.map(([k, l]) => `<div class="paper"><h2>${KIND[k]} · ${l.length}</h2>${l.map(threadRow).join('')}</div>`).join('') : '<div class="empty">열린 항목이 없습니다.</div>'}
      ${closed.length ? `<details class="paper"><summary>닫힌 항목 ${closed.length}개</summary>${closed.map(threadRow).join('')}</details>` : ''}`;
  }

  function viewLife() {
    if (!info) return emptyRoom();
    return `<div class="eyebrow">DAILY LIFE</div><h1>최근 생활</h1>
      <p class="intro">인물마다 마지막 식사·씻기·꾸밈·잠·약을 보여 드립니다. 몇 끼째인지, 몇 시간 잤는지는 지문의 작중 시각으로 프로그램이 계산합니다.</p>
      ${routineNote()}
      ${namesNote()}
      ${info.routine ? `<pre>${esc(info.routine)}</pre>` : '<div class="empty">아직 기록이 없습니다.</div>'}
      ${routineEditor()}`;
  }

  /** Whether daily life is recorded in this room, and the messages read while it was off. */
  function routineNote() {
    const r = info?.routineSetting;
    if (r && !r.enabled) {
      const why = r.room === 'off' ? '이 방 설정에서 꺼 두었습니다' : '모든 방 기본값이 꺼짐이고, 이 방은 기본값을 따릅니다';
      return `<div class="note" role="status"><b>이 방에서는 최근 생활 기록이 꺼져 있습니다</b> (${why}). 새 메시지에서 생활을 읽지 않고 기억 칸에도 넣지 않습니다(기억 모델 호출 없음). 이미 있는 기록은 지우지 않고 그대로 둡니다.
        <div class="buttons"><button class="primary" data-act="routineOnHere">이 방에서 켜기</button><button data-tab="settings">설정에서 보기</button></div></div>`;
    }
    const gaps = info?.routineGaps || [];
    if (!gaps.length) return '';
    return `<p class="hint">메시지 ${gaps.map((g) => g.from === g.to ? `${esc(g.from)}번` : `${esc(g.from)}~${esc(g.to)}번`).join(', ')}은(는) 최근 생활 기록이 꺼져 있던 동안 정리해서 생활 기록이 없습니다. 다시 켠 뒤에는 새 메시지부터 기록합니다. 그 구간도 채우려면 한눈에 → <b>처음부터 다시 정리</b>를 눌러 주세요(전체를 다시 읽어 비용이 듭니다).</p>`;
  }

  const ROUTINE_LABEL = { meal: '식사', wash: '씻기', groom: '꾸밈', sleep: '잠듦', wake: '깸', medicine: '약' };

  function routineRow(r, key) {
    const opts = Object.entries(ROUTINE_LABEL).map(([k, v]) => `<option value="${k}" ${(r.displayWhat || r.what) === k ? 'selected' : ''}>${v}</option>`).join('');
    return `<div class="routine-row" data-rkey="${esc(key)}">
      <select data-f="what" aria-label="무엇">${opts}</select>
      <input data-f="at" type="datetime-local" value="${esc(r.at || '')}" aria-label="작중 시각">
      <input data-f="text" value="${esc(r.text || '')}" placeholder="무엇을 (예: 외출 준비)" aria-label="내용">
      ${key !== 'new' && info.storyNow && r.at && r.at > info.storyNow ? `<small class="warn">작중 지금(${esc(info.storyNow.replace('T', ' '))})보다 뒤 시각입니다</small>` : ''}
      <label class="mini"><input data-f="substitute" type="checkbox" ${r.substitute ? 'checked' : ''}>때움</label>
      <label class="mini"><input data-f="claimed" type="checkbox" ${r.claimed ? 'checked' : ''}>본인 주장</label>
      ${key === 'new' ? '<button class="primary" data-act="addRoutine">추가</button>' : `<button data-act="saveRoutine">저장</button><button class="ghost" data-act="deleteRoutine">${armed === `routine:${key}` ? '한 번 더 누르면 지웁니다' : '지우기'}</button>`}
    </div>`;
  }

  /** Every saved entry, newest first per person, each one editable; plus a row to add a missed one. */
  function routineEditor() {
    const items = info.routineItems || [];
    const people = [...new Set([...items.map((r) => r.who), ...(info.cast || []), ...(info.personas || [])])].filter(Boolean);
    const blocks = people
      .map((who) => {
        const list = items.filter((r) => r.who === who).slice().reverse();
        if (!list.length) return '';
        return `<details class="paper" data-list="life:${esc(who)}" ${openLists.has(`life:${who}`) ? 'open' : ''}><summary>${esc(who)} · 기록 ${list.length}개</summary>${list.map((r) => routineRow(r, r.key)).join('')}</details>`;
      })
      .join('');
    const lastAt = info.storyNow || items.map((r) => r.at).filter(Boolean).sort().at(-1) || '';
    return `<div class="paper"><h2>기록 고치기</h2>
      <p class="hint">빠진 기록은 추가하고, 틀린 기록은 고치거나 지우실 수 있습니다. 직접 고친 기록은 리롤해도 유지됩니다. 시각은 작중 시각입니다${info.storyNow ? ` (작중 지금: ${esc(info.storyNow.replace('T', ' '))})` : ''}.</p>
      <div class="routine-row routine-new" data-rkey="new">
        <input data-f="who" list="routinePeople" placeholder="누가" aria-label="누가">
        <datalist id="routinePeople">${people.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
      </div>
      ${routineRow({ what: 'wash', at: lastAt }, 'new')}
    </div>${blocks}`;
  }

  function readNameForm() {
    const v = (id) => root.querySelector(id);
    nameForm = { source: v('#nameSource')?.value.trim() || '', target: v('#nameTarget')?.value.trim() || '', display: v('#nameDisplay')?.value.trim() || '', text: v('#nameText')?.checked !== false };
  }

  function readRoutineRow(row) {
    const val = (f) => row.querySelector(`[data-f="${f}"]`);
    return { what: val('what').value, at: val('at').value, text: val('text').value, substitute: val('substitute').checked, claimed: val('claimed').checked };
  }

  /** On the daily-life tab: the same person may be saved under more than one name. */
  function namesNote() {
    const d = names?.duplicates?.length || 0, s = names?.suggestions?.length || 0;
    if (!d && !s) return '';
    return `<div class="note" role="status">같은 사람이 다른 이름 표기로 따로 저장되었을 수 있습니다${d ? ` · 이미 같은 사람으로 알려진 중복 ${d}명` : ''}${s ? ` · 같은 사람일 수 있음 ${s}건` : ''}. <button data-tab="names">이름 정리에서 확인</button></div>`;
  }

  const AREA_ORDER = ['quoteBy', 'quoteTo', 'events', 'facts', 'threads', 'routine', 'chapters'];
  function previewBox() {
    if (!namePreview || namePreview.room !== room) return '';
    const p = namePreview.data;
    const merge = namePreview.kind === 'merge';
    const alias = namePreview.kind === 'alias';
    const rows = AREA_ORDER.map((k) => `<tr><th>${esc(p.areas?.[k] || k)}</th><td>${p.counts?.[k] || 0}곳</td></tr>`).join('');
    const samples = (p.samples || []).map((x) => `<div class="quote-card"><small>${esc(x.areaName)} · ${esc(x.label)}</small><p><s>${esc(x.before)}</s></p><p>→ ${esc(x.after)}</p></div>`).join('');
    const what = alias
      ? `<p>글 속 <b>${esc(p.source)}</b> → <b>${esc(p.display)}</b> (요약·사건·사실·챕터·할 일·생활 기록의 글만)</p><p class="hint">이름 칸과 원문 대사(번역 포함), 직접 고친 항목은 바꾸지 않습니다. 이름 표는 그대로입니다.</p>`
      : merge
      ? `<p>${(p.items || []).map((i) => `<b>${esc(i.source)}</b> → <b>${esc(i.target)}</b>`).join(', ')}</p><p class="hint">이름 칸(말한 사람·들은 사람·인물·누구)만 합칩니다. 글 속 표현은 그대로 둡니다.</p>`
      : `<p><b>${esc(p.source)}</b> → <b>${esc(p.target)}</b>${p.text ? ` · 글 속에는 <b>${esc(p.display)}</b>(으)로 씁니다` : ' · 이름 칸만 바꿉니다'}</p>`;
    const armedKey = alias ? 'aliasApply' : merge ? 'mergeApply' : 'nameApply';
    return `<div class="paper"><h2>미리 보기 · 모두 ${p.total || 0}곳</h2>${what}
      <table class="counts">${rows}</table>
      ${samples ? `<h3>바뀌는 예</h3>${samples}` : ''}
      <p class="hint">바뀐 기록은 직접 고친 것으로 표시되어 자동 정리·대사 확인이 되돌리지 않습니다. 원문 대사의 글자는 바꾸지 않습니다. 적용한 뒤 '마지막 바꾸기 되돌리기'로 되돌릴 수 있습니다.</p>
      ${names?.busy ? '<p class="warn">지금 이 방을 정리하는 중이라 적용할 수 없습니다. 정리가 끝난 뒤 다시 미리 보기를 해 주세요.</p>' : ''}
      <div class="buttons">${p.total ? `<button class="primary" data-act="${armedKey}">${armed === armedKey ? '한 번 더 누르면 적용합니다' : merge ? '합치기' : '적용'}</button>` : '<span class="hint">바뀌는 곳이 없습니다.</span>'}<button class="ghost" data-act="nameCancel">닫기</button></div></div>`;
  }

  /** 인물·장소: the character state cards and the places of the room (both are optional features). */
  function viewWorld() {
    if (!info) return emptyRoom();
    if (!world || worldRoom !== room) return worldError ? `<div class="note" role="alert">인물·장소를 불러오지 못했습니다. ${esc(worldError)} 서버의 기억 모듈도 함께 업데이트했는지 확인해 주세요.</div>` : `<div class="empty">${icon('refresh')}불러오는 중입니다…</div>`;
    const off = !world.characterState && !world.places && !world.keepsakes && !world.trackers;
    return `<div class="eyebrow">STORY NOW</div><h1>인물·장소</h1>
      <p class="intro">장면을 정리할 때 같은 모델 호출에서 함께 읽어 둔 인물의 현재 상태, 장소의 모습, 소중한 물건입니다. 켠 뒤에 새로 정리하는 장면부터 채워지고, 원문에 보인 것만 적습니다. 고친 칸은 잠겨서 자동 기록이 덮어쓰지 않습니다.</p>
      ${off ? '<div class="note" role="status">이 방에서는 <b>인물 현재 상태</b>·<b>장소 기억</b>·<b>소중한 물건</b>·<b>날짜·주기 트래커</b>가 모두 꺼져 있습니다. <button data-tab="settings">설정 → 추가 기능에서 켜기</button></div>' : ''}
      ${statePaper(world, worldForm, armed)}
      ${placesPaper(world, worldForm, armed)}
      ${keepsakesPaper(world, worldForm, armed)}
      ${trackersPaper(world, armed)}`;
  }

  /** 인물 상태 cards: every field is an input (editing locks it), a locked field has a button that gives it back to the scenes. */
  function statePaper(w, form, armedNow) {
    if (!w || !w.characterState) return '';
    const cards = w.cards || [];
    const titles = w.sceneTitles || {};
    const fields = [['location', '있는 곳', 'text'], ['outfit', '옷차림', 'text'], ['injuries', '다친 곳', 'list'], ['carrying', '가진 것', 'list'], ['mood', '기분', 'text'], ['other', '그 밖', 'text']];
    const field = (c, [key, label, kind]) => {
      const raw = c[key];
      const value = kind === 'list' ? (raw || []).join(' · ') : raw || '';
      const locked = c.sources?.[key] === 'user';
      return `<div class="world-field"><span>${label}</span><input data-state-name="${esc(c.name)}" data-state-field="${key}" value="${esc(value)}" placeholder="${kind === 'list' ? '· 로 나눠 적기' : '없음'}" aria-label="${esc(c.name)} ${label}">${locked ? `<button class="ghost lock" data-act="stateUnlock" data-name="${esc(c.name)}" data-field="${key}">자동으로 되돌리기</button><small>직접 고침</small>` : ''}${trLine(kind === 'list' ? raw || [] : raw || '')}</div>`;
    };
    const card = (c) => {
      const marks = (c.evidence || []).map((e) => `#${esc(e.number)}.${esc(e.sentence)}`).join(' ');
      const scene = c.asOf?.scene;
      return `<div class="world-card" data-card="${esc(c.name)}"><h3>${esc(nameShown(c.name))}</h3>
        ${fields.map((f) => field(c, f)).join('')}
        ${sceneRefs(sceneRef(scene, '기준 장면', titles))}<p class="hint">${scene ? `${esc(c.asOf?.number ?? '')}번 메시지까지` : '자동 기록 없음(직접 적은 카드)'}${marks ? ` · 근거 ${marks}` : ''}</p>
        <div class="buttons"><button class="ghost" data-act="stateReset" data-name="${esc(c.name)}">${armedNow === `stateReset:${c.name}` ? '한 번 더 누르면 지웁니다' : '카드의 직접 고침 모두 지우기'}</button></div></div>`;
    };
    return `<div class="paper"><h2>인물 현재 상태 · ${cards.length}명</h2>
      <p class="hint">장면에서 상태가 바뀐 인물만 이어서 기록합니다(나은 곳·내려놓은 물건은 빠집니다). 답변에는 지금 장면에 있는 사람의 상태만 한 줄로 들어갑니다.</p>
      ${cards.length ? cards.map(card).join('') : '<p class="hint">아직 없습니다. 켠 뒤에 정리되는 장면부터 채워집니다.</p>'}
      <h3>인물 카드 직접 추가</h3>
      <div class="routine-row"><input id="stateNewName" value="${esc(form?.person || '')}" placeholder="인물 이름" aria-label="인물 이름"><button class="primary" data-act="stateAdd">추가</button></div></div>`;
  }

  /** 장소 memory: description, layout, features and other names of each place, editable; places can be merged. */
  function placesPaper(w, form, armedNow) {
    if (!w || !w.places) return '';
    const list = w.placeList || [];
    const titles = w.sceneTitles || {};
    const place = (p) => {
      const locked = (k) => p.sources?.[k] === 'user';
      const input = (key, label, value, hint, raw = value) => `<div class="world-field"><span>${label}</span><input data-place-id="${esc(p.id)}" data-place-field="${key}" value="${esc(value)}" placeholder="${hint}" aria-label="${esc(p.name)} ${label}">${key !== 'aliases' && locked(key) ? `<button class="ghost lock" data-act="placeUnlock" data-id="${esc(p.id)}" data-field="${key}">자동으로 되돌리기</button><small>직접 고침</small>` : ''}${key === 'aliases' ? '' : trLine(raw)}</div>`;
      const others = list.filter((x) => x.id !== p.id);
      return `<div class="world-card" data-place="${esc(p.id)}"><h3>${withKo(p.name)}</h3>
        ${input('description', '모습', p.description || '', '한 구절')}
        ${input('layout', '배치', p.layout || '', '한 구절')}
        ${input('features', '특징', (p.features || []).join(' · '), '· 로 나눠 적기 (자동으로는 최근 12개까지)', p.features || [])}
        ${input('aliases', '다른 이름', (p.aliases || []).join(' · '), '같은 곳의 다른 이름, · 로 나눠 적기')}
        <p class="hint">${(p.scenes || []).length ? `${esc(p.scenes.length)}개 장면` : '장면에 연결되지 않은 장소'}</p>${(p.scenes || []).length ? sceneRefs(sceneRef(p.firstSeen?.scene, '처음', titles), sceneRef(p.lastSeen?.scene, '마지막', titles)) : ''}
        <div class="routine-row">${others.length ? `<select data-place-merge="${esc(p.id)}" aria-label="합칠 장소"><option value="">다른 장소에 합치기…</option>${others.map((o) => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('')}</select>` : ''}<button class="ghost" data-act="placeDelete" data-id="${esc(p.id)}">${armedNow === `placeDelete:${p.id}` ? '한 번 더 누르면 지웁니다' : '이 장소 지우기'}</button></div></div>`;
    };
    return `<div class="paper"><h2>장소 · ${list.length}곳</h2>
      <p class="hint">'아델의 집무실'과 '집무실'처럼 같은 곳의 다른 이름은 자동으로 합치지 않습니다. 한 장소의 ‘다른 이름’에 적거나 ‘합치기’를 쓰세요. 답변에는 지금 장면의 장소만 한 줄로 들어갑니다.</p>
      ${list.length ? list.map(place).join('') : '<p class="hint">아직 없습니다. 켠 뒤에 정리되는 장면부터 채워집니다.</p>'}
      <h3>장소 직접 추가</h3>
      <div class="routine-row"><input id="placeNewName" value="${esc(form?.place || '')}" placeholder="장소 이름" aria-label="장소 이름"><button class="primary" data-act="placeAdd">추가</button></div></div>`;
  }

  /** 소중한 물건: owner, from, meaning and status of each item, editable (editing locks it); other names, merge and delete. */
  function keepsakesPaper(w, form, armedNow) {
    if (!w || !w.keepsakes) return '';
    const list = w.keepList || [];
    const titles = w.sceneTitles || {};
    const STATUS = [['kept', '간직함'], ['given', '남에게 줌'], ['lost', '잃어버림'], ['broken', '망가짐'], ['unknown', '모름']];
    const item = (it) => {
      const locked = (k) => it.sources?.[k] === 'user';
      const unlock = (k) => (locked(k) ? `<button class="ghost lock" data-act="keepUnlock" data-id="${esc(it.id)}" data-field="${k}">자동으로 되돌리기</button><small>직접 고침</small>` : '');
      const input = (key, label, value, hint) => `<div class="world-field"><span>${label}</span><input data-keep-id="${esc(it.id)}" data-keep-field="${key}" value="${esc(value)}" placeholder="${hint}" aria-label="${esc(it.name)} ${label}">${key === 'aliases' ? '' : unlock(key)}${key === 'aliases' ? '' : key === 'owner' ? (nameShown(value) !== value ? `<small class="tr-inline">한국어: ${esc(nameShown(value))}</small>` : '') : trLine(value)}</div>`;
      const others = list.filter((x) => x.id !== it.id);
      const history = (it.history || []).map((h) => `<li>${esc(shown(h.event))}${sceneRefs(sceneRef(h.scene, '', titles))}</li>`).join('');
      return `<div class="world-card" data-keep="${esc(it.id)}"><h3>${withKo(it.name)}</h3>
        ${input('owner', '가진 사람', it.owner || '', '지금 가진 사람')}
        ${input('from', '준 사람·유래', it.from || '', '준 사람이나 유래')}
        ${input('meaning', '담긴 뜻', it.meaning || '', '한 구절')}
        <div class="world-field"><span>상태</span><select data-keep-id="${esc(it.id)}" data-keep-field="status" aria-label="${esc(it.name)} 상태">${STATUS.map(([v, t]) => `<option value="${v}" ${(it.status || 'unknown') === v ? 'selected' : ''}>${t}</option>`).join('')}</select>${unlock('status')}</div>
        ${input('aliases', '다른 이름', (it.aliases || []).join(' · '), '같은 물건의 다른 이름, · 로 나눠 적기')}
        ${it.gotAt?.scene ? sceneRefs(sceneRef(it.gotAt.scene, '처음', titles)) : ''}<p class="hint">${it.gotAt?.scene ? (it.gotAt.date ? `처음 얻은 날 ${esc(it.gotAt.date)}` : '') : '장면에 연결되지 않은 물건'}</p>
        ${history ? `<ul class="hint">${history}</ul>` : ''}
        <div class="routine-row">${others.length ? `<select data-keep-merge="${esc(it.id)}" aria-label="합칠 물건"><option value="">다른 물건에 합치기…</option>${others.map((o) => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('')}</select>` : ''}<button class="ghost" data-act="keepDelete" data-id="${esc(it.id)}">${armedNow === `keepDelete:${it.id}` ? '한 번 더 누르면 지웁니다' : '이 물건 지우기'}</button></div></div>`;
    };
    return `<div class="paper"><h2>소중한 물건 · ${list.length}개</h2>
      <p class="hint">선물·기념품·유품처럼 이야기에서 뜻이 있는 물건입니다. 평범한 소품이나 지금 들고 있는 물건은 ‘인물 현재 상태’의 가진 것에 있습니다. 같은 물건의 다른 이름은 자동으로 합치지 않으니 ‘다른 이름’이나 ‘합치기’를 쓰세요. 답변에는 지금 장면에 있는 사람의 물건만 한 줄로 들어갑니다.</p>
      ${list.length ? list.map(item).join('') : '<p class="hint">아직 없습니다. 켠 뒤에 정리되는 장면부터 채워집니다.</p>'}
      <h3>물건 직접 추가</h3>
      <div class="routine-row"><input id="keepNewName" value="${esc(form?.keep || '')}" placeholder="물건 이름" aria-label="물건 이름"><input id="keepNewOwner" value="${esc(form?.keepOwner || '')}" placeholder="가진 사람(선택)" aria-label="가진 사람"><button class="primary" data-act="keepAdd">추가</button></div></div>`;
  }

  /* ---------- 날짜·주기 트래커 ---------- */
  const TK_TYPES = { count: '며칠째 (시작일부터 센다)', until: 'D-day (목표일까지 센다)', cycle: '주기 (반복되는 일)' };
  const TK_INJECT = { present: '관련된 사람이 지금 장면에 있을 때', always: '항상', never: '넣지 않음' };
  const TK_CLOCK = { story: '이야기 속 날짜', real: '실제 오늘 날짜' };
  const tkBlank = () => ({ id: '', type: 'count', label: '', scope: 'room', p1: '', p2: '', clock: 'story', inject: 'present', start: '', firstDay: '1', target: '', every: '28', unit: 'day', length: '5', predict: 'fixed', starts: '' });
  const tkFromItem = (it) => ({
    id: it.id, type: it.type, label: it.label, scope: it.scope, p1: it.people?.[0] || '', p2: it.people?.[1] || '', clock: it.clock, inject: it.inject,
    start: it.count?.start || '', firstDay: String(it.count?.firstDay ?? 1), target: it.until?.target || '',
    every: String(it.cycle?.every ?? 28), unit: it.cycle?.unit || 'day', length: String(it.cycle?.length ?? 5), predict: it.cycle?.predict || 'fixed', starts: (it.cycle?.starts || []).join(', '),
  });
  /** The request body for a form: the people follow the scope, the type decides which dates are sent. */
  function tkBody(d) {
    const people = [d.p1, d.p2].map((s) => String(s || '').trim()).filter(Boolean);
    const item = { type: d.type, label: d.label, scope: d.scope, people: d.scope === 'room' ? [] : d.scope === 'person' ? people.slice(0, 1) : people.slice(0, 2), clock: d.clock, inject: d.inject };
    if (d.type === 'count') item.count = { start: d.start, firstDay: Number(d.firstDay) === 0 ? 0 : 1 };
    else if (d.type === 'until') item.until = { target: d.target };
    else item.cycle = { every: Number(d.every), unit: d.unit, length: Number(d.length), predict: d.predict, starts: String(d.starts || '').split(/[,\s]+/).filter(Boolean) };
    return item;
  }
  function readTrackerForm() {
    if (!trackerDraft) return;
    for (const el of root.querySelectorAll('[data-tk]')) trackerDraft[el.dataset.tk] = el.value;
  }
  function readScenePicker() {
    if (!scenePicker) return;
    for (const el of root.querySelectorAll('[data-sp]')) scenePicker[el.dataset.sp] = el.value;
  }
  function trackerForm(t) {
    const d = trackerDraft;
    if (!d) return '<div class="buttons"><button class="primary" data-act="trackerNew">트래커 추가</button></div>';
    const sel = (key, options, label) => `<label class="world-field"><span>${label}</span><select data-tk="${key}" aria-label="${label}">${Object.entries(options).map(([v, text]) => `<option value="${esc(v)}" ${String(d[key]) === v ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
    const txt = (key, label, hint) => `<label class="world-field"><span>${label}</span><input data-tk="${key}" ${key === 'p1' || key === 'p2' ? 'list="trackerPeople" ' : ''}value="${esc(d[key])}" placeholder="${esc(hint || '')}" aria-label="${label}"></label>`;
    const people = d.scope === 'person' ? txt('p1', '사람', '이름') : d.scope === 'pair' ? txt('p1', '첫째 사람', '이름') + txt('p2', '둘째 사람', '이름') : '';
    const fields = d.type === 'count'
      ? txt('start', '시작일', '예: 24-07-16') + sel('firstDay', { 1: '시작한 날을 1일째로', 0: '시작한 날을 0일째로' }, '세는 법')
      : d.type === 'until'
      ? txt('target', '목표일', '예: 24-08-01')
      : txt('every', '주기', '예: 28') + sel('unit', { day: '일마다', month: '개월마다' }, '단위') + txt('length', '기간(일)', '예: 5') + sel('predict', { fixed: '늘 같은 주기로', average: '지난 간격의 평균으로' }, '다음 날짜') + txt('starts', '지난 시작일', '쉼표로 나눠 적기 (선택)');
    return `<h3>${d.id ? '트래커 고치기' : '트래커 추가'}</h3>
      ${d.id ? '' : sel('type', TK_TYPES, '종류')}
      ${txt('label', '이름', d.type === 'cycle' ? '예: 발정기' : d.type === 'until' ? '예: 시험' : '예: 만난 지')}
      ${sel('scope', { room: '방 전체', person: '한 사람', pair: '두 사람' }, '대상')}${people}
      ${fields}
      ${sel('clock', TK_CLOCK, '날짜 기준')}${sel('inject', TK_INJECT, '기억 칸에 넣기')}
      <div class="buttons"><button class="primary" data-act="trackerSave">${d.id ? '저장' : '추가'}</button><button class="ghost" data-act="trackerCancel">닫기</button></div>`;
  }
  function trackersPaper(w, armedNow) {
    const t = w?.trackers;
    if (!t) return '';
    const card = (it) => {
      const meta = [TK_TYPES[it.type], it.scope === 'room' ? '방 전체' : (it.people || []).join('·'), TK_CLOCK[it.clock], `기억 칸: ${TK_INJECT[it.inject]}`].join(' · ');
      const cycle = it.type === 'cycle'
        ? `<div class="world-field"><span>시작일</span>${(it.cycle.starts || []).length ? it.cycle.starts.map((s) => `<input data-tk-start="${esc(it.id)}" data-from="${esc(s)}" value="${esc(s)}" aria-label="${esc(it.label)} 시작일 ${esc(s)}"><button class="ghost" data-act="trackerDropStart" data-id="${esc(it.id)}" data-date="${esc(s)}">${armedNow === `trackerDropStart:${it.id}:${s}` ? '한 번 더 누르면 지웁니다' : '지우기'}</button>`).join('') : '<small>아직 기록이 없습니다</small>'}</div>
          <div class="routine-row"><input data-tk-new="${esc(it.id)}" placeholder="시작일 직접 추가 (예: 24-07-16)" aria-label="${esc(it.label)} 시작일 추가"><button data-act="trackerAddStart" data-id="${esc(it.id)}">시작일 추가</button><button class="primary" data-act="trackerStart" data-id="${esc(it.id)}">오늘 시작</button></div>`
        : '';
      return `<div class="world-card" data-tracker="${esc(it.id)}"><h3>${withKo(it.label)} <span class="pill ${it.status.ok ? '' : 'neutral'}">${esc(it.status.text)}</span></h3>
        <p class="hint">${esc(meta)}${it.status.today ? ` · 기준일 ${esc(it.status.today)}` : ''}</p>${cycle}
        <div class="buttons"><button class="ghost" data-act="trackerEdit" data-id="${esc(it.id)}">고치기</button><button class="ghost" data-act="trackerDelete" data-id="${esc(it.id)}">${armedNow === `trackerDelete:${it.id}` ? '한 번 더 누르면 지웁니다' : '지우기'}</button></div></div>`;
    };
    const suggestions = (t.suggestions || []).length
      ? `<div class="note" role="status"><b>이야기에서 찾은 시작일</b>${t.suggestions.map((s) => `<div>${esc(s.text)}${sceneRefs(sceneRef(s.sceneId, '에서 찾음', w.sceneTitles))} <button class="primary" data-act="trackerAnswer" data-sid="${esc(s.id)}" data-answer="accept">기록</button> <button class="ghost" data-act="trackerAnswer" data-sid="${esc(s.id)}" data-answer="ignore">무시</button></div>`).join('')}</div>`
      : '';
    const applied = (t.applied || []).length
      ? `<div class="note" role="status"><b>자동으로 적용함</b>${t.applied.map((x) => `<div>자동으로 적용함: ${esc(x.text)}${sceneRefs(sceneRef(x.sceneId, '에서 받음', w.sceneTitles))} <button class="ghost" data-act="trackerUndoApplied" data-aid="${esc(x.id)}">되돌리기</button></div>`).join('')}</div>`
      : '';
    return `<div class="paper"><h2>날짜·주기 트래커 · ${t.items.length}개</h2>
      <p class="hint">직접 만든 날짜 기록입니다(모델 호출 없음). 오늘은 ${t.storyDate ? `이야기 속 ${esc(t.storyDate)}` : '이야기 날짜를 아직 모름'} · 실제 ${esc(t.realDate)}. 답변에는 \`[기록] …\` 한 줄(200자 이내)만 들어가고, 주기의 시작이 이야기에 나오면 ‘제안 자동 적용’(설정 → 추가 기능)이 켜져 있을 때는 바로 기록하고 ‘자동으로 적용함’에서 되돌릴 수 있으며, 꺼져 있으면 제안만 합니다.</p>
      ${applied}${suggestions}
      ${t.items.length ? t.items.map(card).join('') : '<p class="hint">아직 없습니다.</p>'}
      <datalist id="trackerPeople">${(t.people || []).map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      ${trackerForm(t)}</div>`;
  }

  /** On a scene card: "이 장면부터" starts a tracker on the scene's story date (disabled when the scene has none). */
  function scenePickerBox(s) {
    const pick = info?.trackerPick;
    if (!pick) return '';
    const date = pick.sceneDates?.[s.id];
    if (!date) return '<button class="ghost" disabled title="이 장면에는 작중 날짜가 없어 시작일로 쓸 수 없습니다">이 장면부터</button>';
    const open = scenePicker?.scene === s.id;
    const button = `<button class="ghost" data-act="scenePickOpen" data-id="${esc(s.id)}" title="이 장면의 날짜(${esc(date)})를 시작일로 하는 트래커">${open ? '이 장면부터 닫기' : '이 장면부터'}</button>`;
    if (!open) return button;
    const p = scenePicker;
    const input = (key, label, hint) => `<label class="world-field"><span>${label}</span><input data-sp="${key}" list="scenePeople" value="${esc(p[key])}" placeholder="${hint}" aria-label="${label}"></label>`;
    return `${button}<div class="note"><b>${esc(date)}</b>부터 세기
      <label class="world-field"><span>트래커</span><select data-sp="trackerId" aria-label="트래커"><option value="">새 ‘며칠째’ 트래커 만들기</option>${pick.items.map((t) => `<option value="${esc(t.id)}" ${p.trackerId === t.id ? 'selected' : ''}>${esc((t.people || []).join('·') + ' ' + t.label)} (${t.type === 'cycle' ? '주기: 시작일로 기록' : '시작일 바꾸기'})</option>`).join('')}</select></label>
      ${p.trackerId ? '' : input('label', '이름', '예: 만난 지') + input('p1', '첫째 사람', '비우면 방 전체') + input('p2', '둘째 사람', '둘이면 함께 적기')}
      <datalist id="scenePeople">${(pick.people || []).map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="buttons"><button class="primary" data-act="scenePickApply" data-id="${esc(s.id)}">적용</button></div></div>`;
  }

  function viewNames() {
    if (!info) return emptyRoom();
    if (!names || namesRoom !== room) return namesError ? `<div class="note" role="alert">이름 정보를 불러오지 못했습니다. ${esc(namesError)} 서버의 기억 모듈도 함께 업데이트했는지 확인해 주세요.</div>` : `<div class="empty">${icon('refresh')}불러오는 중입니다…</div>`;
    const used = names.used || [];
    const known = names.known || [];
    const all = [...new Set([...known, ...used.map((u) => u.name)])];
    const formsOf = (t) => {
      const p = names.people?.[t];
      const parts = String(t || '').split(/\s+/).filter((x) => x.length >= 2);
      return [...new Set([t, ...(parts.length > 1 ? parts : []), ...(p?.aliases || [])].filter(Boolean))];
    };
    const f = nameForm;
    const form = `<div class="paper"><h2>이름 바꾸기·합치기</h2>
      <p class="hint">처음에 다른 이름(애칭·오타·영어 표기)으로 저장된 사람을 한 이름으로 바꿉니다. 이름 칸은 이름이 정확히 같을 때만, 글 속에서는 이름 단위로만 바꾸고 조사(이/가, 은/는 …)를 새 이름에 맞춥니다. 바꾼 이름은 별칭으로 남아 다음 정리부터 같은 사람으로 봅니다.</p>
      <label>지금 기억에 쓰인 이름<select id="nameSource"><option value="">고르기</option>${used.map((u) => `<option value="${esc(u.name)}" ${u.name === f.source ? 'selected' : ''}>${esc(u.name)} · ${u.count}곳</option>`).join('')}</select></label>
      <label>바꿀 이름(기준 이름)<input id="nameTarget" list="nameKnown" value="${esc(f.target)}" placeholder="예: 카드에 적힌 전체 이름"></label>
      <datalist id="nameKnown">${all.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <label>글 속에 쓸 이름<input id="nameDisplay" list="nameForms" value="${esc(f.display)}" placeholder="비워 두면 기준 이름"></label>
      <datalist id="nameForms">${formsOf(f.target).map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <p class="hint">전체 이름이 문장에서 어색하면 짧은 이름(이름만, 성만)을 고르세요. 이름 칸에는 기준 이름이 들어갑니다.</p>
      <label class="mini"><input id="nameText" type="checkbox" ${f.text ? 'checked' : ''}>글 속 이름도 바꾸기 (요약·사건·사실·할 일·생활 기록·챕터)</label>
      <div class="buttons"><button class="primary" data-act="namePreview">미리 보기</button></div></div>`;
    const sug = (names.suggestions || []).map((x) => `<div class="routine-row"><span><b>${esc(x.source)}</b> (${x.sourceCount}곳) → <b>${esc(x.target)}</b> (${x.targetCount}곳) · ${esc(x.label)}</span>
      <button data-act="nameSuggest" data-source="${esc(x.source)}" data-target="${esc(x.target)}">같은 사람 · 미리 보기</button><button class="ghost" data-act="nameDismiss" data-source="${esc(x.source)}" data-target="${esc(x.target)}">다른 사람</button></div>`).join('');
    const dup = (names.duplicates || []).map((g) => `<li><b>${esc(g.target)}</b> ← ${g.variants.map((v) => `${esc(v.name)} (${v.count}곳)`).join(', ')}</li>`).join('');
    let aliasN = 0;
    const shortOf = (name) => String(name).split(/\s+/).filter(Boolean)[0] || name;
    const aliasRow = (canon, a) => {
      const id = `aliasShow${aliasN++}`;
      return `<div class="routine-row alias-row"><span>${esc(a)}</span><input id="${id}" value="${esc(shortOf(canon))}" aria-label="${esc(a)} 대신 글에 쓸 표기">
        <button data-act="aliasPreview" data-alias="${esc(a)}" data-input="${id}">글 속 표기 바꾸기</button></div>`;
    };
    const table = Object.entries(names.people || {}).filter(([, v]) => v.aliases?.length || v.display).map(([k, v]) => `<li><b>${esc(k)}</b>${v.display ? ` · 글에는 ${esc(v.display)}` : ''}${v.aliases?.length ? ` · 별칭: ${v.aliases.map(esc).join(', ')}` : ''}${v.aliases?.length ? v.aliases.map((a) => aliasRow(k, a)).join('') : ''}</li>`).join('');
    const last = (names.history || []).at(-1);
    const history = (names.history || []).slice().reverse().map((h) => `<li>${esc(day(h.at))} · ${h.kind === 'merge' ? '중복 합치기' : h.kind === 'alias-text' ? '글 속 표기 바꾸기' : '이름 바꾸기'}: ${esc(h.source)} → ${esc(h.target)} (${h.changes}곳)</li>`).join('');
    return `<div class="eyebrow">NAMES</div><h1>이름 정리</h1>
      <p class="intro">같은 사람이 여러 이름(한국어·영어 표기, 애칭, 오타)으로 따로 저장된 것을 한 사람으로 모읍니다. 카드와 사용자 캐릭터 이름은 자동으로 기준 이름이 됩니다.</p>
      ${names.busy ? '<div class="note" role="status">지금 이 방의 기억을 정리하는 중입니다. 미리 보기는 되지만 적용은 정리가 끝난 뒤에 할 수 있습니다.</div>' : ''}
      ${previewBox()}
      ${addressPaper(names.address, addressForm, armed, names.known || [])}
      ${form}
      <div class="paper"><h2>같은 사람일 수 있음 · ${names.suggestions?.length || 0}건</h2><p class="hint">철자나 소리가 비슷할 뿐 확실하지 않아 자동으로 합치지 않습니다. 같은 사람이면 미리 보기 뒤 합치고, 다른 사람이면 '다른 사람'을 눌러 다시 묻지 않게 하세요.</p>${sug || '<p class="hint">없습니다.</p>'}</div>
      <div class="paper"><h2>이미 저장된 중복 · ${names.duplicates?.length || 0}명</h2><p class="hint">별칭이나 이름만 부른 형태(조사 포함)처럼 규칙으로 같은 사람인 이름이 따로 저장된 경우입니다. 합치면 기록은 하나도 버리지 않고 이야기 순서대로 모읍니다(같은 기록이 두 번 저장된 것만 하나로).</p>${dup ? `<ul>${dup}</ul><div class="buttons"><button data-act="mergePreview">중복 합치기 미리 보기</button></div>` : '<p class="hint">없습니다.</p>'}</div>
      <div class="paper"><h2>별칭 표</h2>${table ? `<ul>${table}</ul>` : '<p class="hint">아직 별칭이 없습니다.</p>'}</div>
      <div class="paper"><h2>최근 이름 바꾸기</h2>${history ? `<ul>${history}</ul>` : '<p class="hint">없습니다.</p>'}${last ? `<div class="buttons"><button class="ghost" data-act="nameUndo">${armed === 'nameUndo' ? '한 번 더 누르면 되돌립니다' : `마지막 바꾸기 되돌리기 (${esc(last.source)} → ${esc(last.target)})`}</button></div>` : ''}</div>`;
  }

  /** 이름 정리 → 호칭 사전 and the suggestions learned from the user's own corrections (null: both features are off). */
  function addressPaper(a, form, armedNow, known) {
    if (!a || (!a.addressBook && !a.learnFromEdits)) return '';
    const f = form || {};
    const all = a.entries || [];
    // A foreign term and its Korean translation are one row "원어(번역)"; the Korean half is not listed on its own.
    const half = (e) => all.find((x) => x.id === e.pairWith);
    const entries = all.filter((e) => !(e.pairOf && all.some((x) => x.id === e.pairOf)));
    const suggestions = a.suggestions || [];
    const row = (e) => { const t = half(e); const label = t ? `${e.term}(${t.term})` : e.term; const count = t ? (e.pairCount || e.count) : e.count; const on = e.useForCheck !== false || (t && t.useForCheck !== false);
      return `<div class="routine-row address-row" data-aid="${esc(e.id)}"><span><b>${esc(e.from)}</b> → <b>${esc(e.to)}</b>: <b>${esc(label)}</b> ×${esc(count)} <small>${e.source === 'user' ? '직접 추가' : e.source === 'auto-learned' ? '자동 적용' : '자동'}${e.note ? ` · ${esc(e.note)}` : ''}</small></span>
      <label class="mini"><input type="checkbox" data-address-use="${esc(e.id)}" ${on ? 'checked' : ''}>대사 확인에 쓰기</label>
      <button data-act="addressEdit" data-id="${esc(e.id)}">고치기</button>${t ? `<button class="ghost" data-act="addressSplit" data-id="${esc(e.id)}">따로 보기</button>` : ''}<button class="ghost" data-act="addressDelete" data-id="${esc(e.id)}">${armedNow === `addressDelete:${e.id}` ? '한 번 더 누르면 지웁니다' : t ? '둘 다 지우기' : '지우기'}</button></div>`; };
    const people = (known || []).map((n) => `<option value="${esc(n)}">`).join('');
    const book = a.addressBook ? `<div class="paper"><h2>호칭 사전 · ${entries.length}개</h2>
      <p class="hint">누가 누구를 어떻게 부르는지입니다. 저장된 대사에서 같은 부르는 말을 두 번 이상 쓴 것만 자동으로 올라오고(모델을 부르지 않습니다), 직접 추가한 것은 횟수와 상관없이 남습니다. ‘대사 확인에 쓰기’를 켜 둔 말은 대사의 화자·상대를 확인할 때 쓰입니다(그 말로 불린 사람은 상대이고 화자가 아님). 자동으로 올라온 항목은 다음 정리 때 대사에 맞게 다시 계산되고, 고치면 직접 추가한 것이 됩니다.</p>
      ${entries.length ? entries.map(row).join('') : '<p class="hint">아직 없습니다.</p>'}
      <h3>${f.id ? '호칭 고치기' : '호칭 직접 추가'}</h3>
      <div class="routine-row address-form"><input id="addrFrom" list="addrPeople" value="${esc(f.from)}" placeholder="부르는 사람" aria-label="부르는 사람"><input id="addrTo" list="addrPeople" value="${esc(f.to)}" placeholder="불리는 사람" aria-label="불리는 사람"><input id="addrTerm" value="${esc(f.term)}" placeholder="부르는 말 (예: 보스)" aria-label="부르는 말"><input id="addrNote" value="${esc(f.note)}" placeholder="메모(선택)" aria-label="메모">
        <datalist id="addrPeople">${people}</datalist>
        <button class="primary" data-act="addressSave">${f.id ? '저장' : '추가'}</button>${f.id ? '<button class="ghost" data-act="addressCancel">취소</button>' : ''}</div></div>` : '';
    const suggest = (x) => {
      const text = x.kind === 'alias'
        ? `제안: ‘${esc(x.source)}’은(는) ${esc(x.target)}의 다른 이름일까요? (${esc(x.count)}곳에서 쓰임)`
        : `제안: ‘${esc(x.term)}’은(는) ${esc(x.to)}을(를) 부르는 말일까요? (${esc(x.from)}이(가) 한 말)`;
      return `<div class="routine-row" data-sid="${esc(x.id)}"><span>${text}</span><button class="primary" data-act="suggestAccept" data-id="${esc(x.id)}">${x.kind === 'alias' ? '같은 사람으로 추가' : '추가'}</button><button class="ghost" data-act="suggestIgnore" data-id="${esc(x.id)}">무시</button></div>`;
    };
    const appliedRow = (x) => `<div class="routine-row" data-applied="${esc(x.id)}"><span>자동으로 적용함: ${esc(x.text)} <small>${x.kind === 'alias' ? '다른 이름' : '호칭'}</small></span><button class="ghost" data-act="suggestUndo" data-id="${esc(x.id)}">되돌리기</button></div>`;
    const learn = a.learnFromEdits ? `<div class="paper"><h2>직접 고친 것에서 배운 제안 · ${suggestions.length}건</h2>
      <p class="hint">장면 편집에서 대사의 말한 사람·들은 사람을 직접 고쳤을 때 만들어집니다. ‘제안 자동 적용’(설정 → 추가 기능)이 켜져 있으면 바로 적용하고 아래 ‘자동으로 적용함’에서 되돌릴 수 있으며, 꺼져 있으면 누르기 전까지 아무것도 바뀌지 않습니다. ‘무시’하거나 되돌린 제안은 다시 묻지 않습니다.</p>
      ${(a.applied || []).map(appliedRow).join('')}
      ${suggestions.length ? suggestions.map(suggest).join('') : '<p class="hint">제안이 없습니다.</p>'}</div>` : '';
    return book + learn;
  }

  function readAddressForm() {
    const v = (id) => root.querySelector(id)?.value.trim() || '';
    addressForm = { id: addressForm.id, from: v('#addrFrom'), to: v('#addrTo'), term: v('#addrTerm'), note: v('#addrNote') };
  }

  function viewInject() {
    if (!info) return emptyRoom();
    return `<div class="eyebrow">INJECTION · 약 ${tokens(info.rendered)} 토큰</div><h1>주입 확인</h1>
      <p class="intro">지금 프리셋의 {{기억}} 자리에 들어가는 내용 그대로입니다. 회상한 장면은 답변마다 바뀝니다.</p>
      ${recallCard()}${recallTestCard()}${recallReasonsPaper(recallReportRoom === room ? recallReportData : null, info.recallPrefs, recallReportRoom !== room || (!recallReportData && !recallReportError) ? 'loading' : recallReportError)}
      ${info.rendered ? `<pre>${esc(info.rendered)}</pre>` : `<div class="empty">${info.enabled ? '아직 들어가는 기억이 없습니다.' : '이 방에서 기억 사용이 꺼져 있어 {{기억}} 자리에 아무것도 들어가지 않습니다. 저장된 기억은 그대로 남아 있습니다.'}</div>`}`;
  }

  /** 중요 / 빼기 buttons of one scene, chapter, fact or open thread; the same button again takes the mark off. */
  function markButtons(id, prefs) {
    const pinned = (prefs?.pinned || []).includes(id);
    const left = (prefs?.excluded || []).includes(id);
    const button = (mark, on, onText, offText, hint) => `<button class="ghost mark-button ${on ? 'is-on' : ''}" data-act="recallMark" data-id="${esc(id)}" data-mark="${mark}" aria-pressed="${on ? 'true' : 'false'}" title="${esc(hint)}">${on ? onText : offText}</button>`;
    return `<span class="recall-marks">${button('pin', pinned, '중요 해제', '중요', '기억 칸에 먼저 넣습니다(정해진 크기 안에서). 한 번 더 누르면 풀립니다.')}${button('exclude', left, '다시 넣기', '빼기', '자동으로는 기억 칸에 넣지 않습니다. 기록은 그대로 남습니다. 한 번 더 누르면 되돌립니다.')}</span>`;
  }

  /** 주입 확인: why each memory in the reply was chosen, with its 중요 / 빼기 buttons; marked items that are not in the reply are listed to undo. */
  function recallReasonsPaper(report, prefs, status) {
    if (status === 'loading') return '<div class="paper"><h2>왜 이 기억이 들어갔나</h2><p class="hint">불러오는 중…</p></div>';
    if (status) return `<div class="paper"><h2>왜 이 기억이 들어갔나</h2><div class="note" role="alert">불러오지 못했습니다. ${esc(status)}</div></div>`;
    if (!report) return '';
    const TITLES = { chapters: '지난 이야기 흐름', overview: '지난 장면들 (한 줄 요약)', recalled: '지금 떠오르는 지난 장면', near: '뜻이 가까운 지난 사건', raw: '원문에서 떠오른 대목', facts: '알게 된 사실', threads: '아직 끝나지 않은 일', selected: '직접 선택한 기억' };
    const chips = (list) => (list || []).map((r) => `<span class="pill ${r.kind === 'pinned' ? 'green' : 'neutral'}" title="${esc(r.why || '')}">${esc(r.label)}</span>`).join('');
    const row = (it) => `<div class="reason-row"><span class="row-main"><b>${esc(it.title)}</b>${it.id ? `<small>${esc(it.id)}</small>` : ''}<span class="reason-chips">${chips(it.reasons)}</span></span>${it.id ? markButtons(it.id, prefs) : ''}</div>`;
    const sections = (report.sections || []).map((s) => `<h3>${esc(TITLES[s.section] || s.section)} · ${s.items.length}</h3><div class="reason-list">${s.items.map(row).join('')}</div>`).join('');
    const shown = (id) => (report.sections || []).some((s) => s.items.some((it) => it.id === id));
    const marks = (report.marks || []).filter((m) => m.state === 'excluded' || !shown(m.id));
    const left = marks.length ? `<h3>중요·뺀 항목 중 지금 들어가지 않는 것 · ${marks.length}</h3><div class="reason-list">${marks.map((m) => `<div class="reason-row"><span class="row-main"><b>${esc(m.title)}</b><small>${esc(m.id)}</small><span class="reason-chips"><span class="pill neutral">${m.state === 'pinned' ? '중요' : '뺌'}</span></span></span>${markButtons(m.id, prefs)}</div>`).join('')}</div>` : '';
    if (!sections && !left) return '';
    return `<div class="paper"><h2>왜 이 기억이 들어갔나</h2><p class="hint">아래 이유는 보여 주기만 하며, 기억 칸의 글에는 들어가지 않습니다. <b>중요</b>는 정해진 크기 안에서 먼저 넣고, <b>빼기</b>는 자동으로 넣지 않습니다(기록은 지워지지 않고 서재에 그대로 있습니다).</p>${sections}${left}</div>`;
  }

  /** Which scenes came up for the last reply, and why; plus what the meaning search found. */
  function recallCard() {
    const rc = info.recall || {};
    if (!rc.picks?.length && !rc.semantic?.length && !rc.semanticError) return '';
    const scene = (id) => store?.scenes.find((x) => x.id === id);
    const picks = (rc.picks || []).map((p) => `<a href="#" class="record-link record-row" data-goto-scene="${esc(p.id)}"><span class="pill">떠오름</span><span class="row-main"><b>${esc(p.title || scene(p.id)?.title || p.id)}</b><small>${esc(p.id)}${p.why ? ` · ${esc(p.why)}` : ''}</small></span><span class="chip-arrow">›</span></a>`).join('');
    const near = (rc.semantic || []).map((x) => sceneLink({ id: x.id, title: x.title || x.id }, `${x.score}${x.strong ? ' · 뚜렷함' : ''}`)).join('');
    return `<div class="paper"><h2>이번 답변에 떠오른 장면</h2>
      ${picks ? `<div class="record-list">${picks}</div>` : '<p class="hint">고른 장면이 없습니다.</p>'}
      ${near ? `<h3>뜻이 가까운 장면 (임베딩)</h3><p class="record-links">${near}</p><small>숫자는 비슷한 정도입니다. 다른 장면보다 눈에 띄게 가까운 장면(뚜렷함)은 모델이 놓쳐도 함께 떠올립니다.</small>` : ''}
      ${rc.semanticError ? `<div class="note">뜻 찾기 오류: ${esc(rc.semanticError)}</div>` : ''}</div>`;
  }

  let recallTest = null;
  let recallTestText = '';

  /** Try a message: which scenes would come up, from which search, without making a reply. */
  function recallTestCard() {
    const r = recallTest;
    const row = (id, title, tag, note) => `<a href="#" class="record-link record-row" data-goto-scene="${esc(id)}"><span class="pill">${tag}</span><span class="row-main"><b>${esc(title || id)}</b><small>${esc(id)}${note ? ` · ${esc(note)}` : ''}</small></span><span class="chip-arrow">›</span></a>`;
    const result = r
      ? `<h3>떠오를 장면 (장면 통째로 · 설정의 회상 양만큼 들어갑니다)</h3>${r.picks.length ? `<div class="record-list">${r.picks.map((p) => row(p.id, p.title, '떠오름', p.why)).join('')}</div>` : '<p class="hint">떠오를 장면이 없습니다.</p>'}
        <p class="hint">방식: ${r.used === 'model' ? '기억 모델이 고름' : '빠른 방식'} · ${(r.ms / 1000).toFixed(1)}초 · 회상 후보 ${r.candidates}개${r.alreadyShown ? ` · ${esc(r.alreadyShown)}는 원문이나 전체 장면으로 이미 들어가 있어 회상 대상이 아닙니다` : ''}</p>
        ${r.error ? `<div class="note">${esc(r.error)}</div>` : ''}
        <h3>뜻이 가까운 장면 (임베딩 · 위에 없는 것은 그 사건만 들어갑니다)</h3>${r.vectors ? (r.semantic.length ? `<div class="record-list">${r.semantic.map((x) => row(x.id, x.title, String(x.score), `${x.strong ? '뚜렷함 · ' : ''}${x.event ? `가까운 사건: ${x.event}` : '장면 개요'}`)).join('')}</div>` : `<p class="hint">찾지 못했습니다${r.semanticError ? `: ${esc(r.semanticError)}` : ''}.</p>`) : '<p class="hint">꺼져 있습니다. 설정에서 임베딩 모델을 정하면 켜집니다.</p>'}
        <h3>드문 낱말로 찾은 장면</h3>${r.direct ? `<div class="record-list">${row(r.direct.id, r.direct.title, '낱말', r.direct.hits.join(', '))}</div>` : '<p class="hint">없습니다.</p>'}
        <h3>원문에서 찾은 대목</h3>${r.raw.length ? r.raw.map((x) => `<div class="quote-card"><small>#${x.number}</small><blockquote>${esc(x.text)}</blockquote></div>`).join('') : '<p class="hint">없습니다.</p>'}`
      : '';
    return `<div class="paper"><h2>회상 시험</h2>
      <p class="hint">보낼 메시지를 적으면, 답변은 만들지 않고 어떤 지난 장면이 떠오를지만 보여 드립니다. 기억 모델을 한 번 부릅니다.</p>
      <textarea id="recallTestText" class="event-field" placeholder="예: 그때 바다에서 했던 약속 기억나?">${esc(recallTestText)}</textarea>
      <div class="buttons"><button class="primary" data-act="recallTest">시험하기</button></div>${result}</div>`;
  }

  /** 대사 확인 방식: the four modes with a short cost hint (the same words in the all-rooms default and the room's choice). */
  const ATTRIBUTION_MODES = [
    ['off', '끄기', '모델 호출 없음, 정리 모델이 적은 값 그대로'],
    ['rules', '규칙만', '모델 호출 없음, 이름 부름·앞 대사·호칭 규칙으로 고침'],
    ['default', '기본', '장면마다 1~2번, 애매한 대사만 물어봄, 추천'],
    ['thorough', '꼼꼼히', '장면마다 2~4번, 한 번 더 확인'],
  ];
  const attributionModeLabel = (mode) => (ATTRIBUTION_MODES.find((m) => m[0] === mode) || ATTRIBUTION_MODES[2])[1];
  const attributionModeOptions = (selected) => ATTRIBUTION_MODES.map(([value, label, hint]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${esc(label)} (${esc(hint)})</option>`).join('');
  const ATTRIBUTION_MODE_HINT = '대사를 누가 누구에게 말했는지 저장된 값을 확인하는 방식입니다. 바꿔도 이미 저장된 값은 지우지 않고, 나중에 더 꼼꼼한 방식으로 바꾸면 아직 모델이 확인하지 않은 대사만 새로 확인합니다.';

  /** 설정 → 언어: this room's own memory language, apart from the all-rooms setting. Saved as soon as it changes. */
  function roomWriteLanguagePicker() {
    if (!room || !info) return '';
    const LABEL = { chat: '채팅 언어로', ko: '한국어로 (중국어·영어 방도 한국어로만)', en: '영어로', zh: '중국어로 (간체)' };
    const all = ['ko', 'en', 'zh'].includes(serverSettings?.writeLanguage) ? LABEL[serverSettings.writeLanguage] : LABEL.chat;
    const own = info.roomWriteLanguage || 'follow';
    const options = [['follow', `모든 방 설정 따름 (지금: ${all})`], ['chat', LABEL.chat], ['ko', LABEL.ko], ['en', LABEL.en], ['zh', LABEL.zh]];
    return `<label>이 방의 기억 정리 언어<select id="setRoomWriteLang">${options.map(([v, t]) => `<option value="${v}" ${own === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <p class="hint">이 방만 따로 정합니다. 영어 방은 영어로, 중국어 방은 중국어로 두고 나머지는 채팅 언어로 두는 식입니다. 바꾸면 바로 저장되고, <b>새로 정리되는 기억부터</b> 그 언어로 저장합니다. 이미 정리된 기억은 그대로이고 넣을 때 번역합니다.</p>`;
  }

  /** 설정 → 추가 기능: one row per implemented feature, with the all-rooms default and this room's own choice. */
  function featuresPaper(list) {
    if (!Array.isArray(list) || !list.length) return '';
    const modes = [['default', '기본값 따름'], ['on', '켜기'], ['off', '끄기']];
    // Folded by default: the summary line says whether each one is on in this room; open one to change it.
    const onHere = (f) => (f.room === 'on' ? true : f.room === 'off' ? false : f.global);
    const onCount = list.filter(onHere).length;
    return `<details class="paper" data-list="features" ${openLists.has('features') ? 'open' : ''}><summary>추가 기능 · 이 방에서 ${onCount}/${list.length}개 켜짐</summary>
      <p class="hint">기능마다 모든 방 기본값을 정하고, 방마다 따로 켜고 끌 수 있습니다. 항목을 누르면 펼쳐집니다. 바꾸면 바로 저장됩니다.</p>
      ${list.map((f) => `<details class="feature-row" data-feature="${esc(f.key)}" data-list="feature:${esc(f.key)}" ${openLists.has(`feature:${f.key}`) ? 'open' : ''}>
        <summary><span class="feature-name">${esc(f.label)}</span> <span class="pill ${onHere(f) ? '' : 'neutral'}">${onHere(f) ? '켜짐' : '꺼짐'}</span>${f.room === 'default' ? ' <small>(기본값 따름)</small>' : ''}</summary>
        <label class="setting-switch"><span>${esc(f.label)} (모든 방 기본값)<small>${esc(f.description)}</small></span><input type="checkbox" data-feature-global="${esc(f.key)}" ${f.global ? 'checked' : ''}></label>
        <label>이 방의 ${esc(f.label)}<select data-feature-room="${esc(f.key)}">${modes.map(([value, text]) => `<option value="${value}" ${f.room === value ? 'selected' : ''}>${value === 'default' ? `${text} (지금 모든 방 기본값: ${f.global ? '켜기' : '끄기'})` : text}</option>`).join('')}</select></label>
      </details>`).join('')}
    </details>`;
  }

  /** 설정 → 백업: download this room's memory as one file, restore from one, undo the last restore. */
  function backupPaper(st) {
    const { armed: arm, preview, withVectors, running: busyJob, undo } = st;
    const date = (iso) => { try { return new Date(iso).toLocaleString('ko-KR'); } catch { return String(iso || ''); } };
    const LINES = [['scenes', '장면'], ['chapters', '챕터'], ['facts', '알게 된 사실'], ['threads', '아직 끝나지 않은 일'], ['routine', '최근 생활 기록'], ['people', '이름 표의 사람'], ['selected', '직접 고른 기억'], ['vectors', '검색 색인']];
    let previewHtml = '';
    if (preview) {
      const d = preview.data;
      const s = d.source;
      previewHtml = `<div class="note" role="status">
        <b>불러올 백업</b>: ${esc(s.chatName || '(이름 없음)')} · 방 ID ${esc(s.chatId)} · ${esc(date(s.createdAt))} · 모듈 ${esc(s.moduleVersion || '?')}
        <ul>${LINES.map(([k, label]) => `<li>${label}: 백업 ${esc(d.backup[k])} · 지금 ${esc(d.current[k])}</li>`).join('')}</ul>
        <p class="hint">불러오면 이 방의 기억 파일이 백업의 내용으로 <b>통째로 바뀝니다</b>(백업에 없는 파일은 지워집니다). 바꾸기 전에 지금 상태를 안전 사본으로 한 번 남기며, 아래 '불러오기 되돌리기'로 돌릴 수 있습니다. 이 방의 '기억 사용' 켜짐 여부는 지금 그대로 둡니다.${d.vectors.inBackup ? '' : ' 백업에 검색 색인이 없어 <b>지금의 검색 색인은 지우고</b> 다음 정리 때 다시 만듭니다.'}${s.jobRunning ? ' 이 백업은 정리 작업이 돌아가는 중에 받은 것이라 파일끼리 시점이 조금 다를 수 있습니다.' : ''}</p>
        ${d.crossRoomRequired ? `<div class="note"><label class="check-row"><input type="checkbox" id="restoreCross" ${preview.cross ? 'checked' : ''}><span><b>다른 방의 백업을 이 방에 적용</b><small>이 백업은 다른 방(${esc(s.chatId)})에서 받은 것입니다. 메시지 번호와 ID는 그대로 두므로 이 방의 메시지와 맞지 않을 수 있습니다. 확인하시면 체크해 주세요.</small></span></label></div>` : ''}
        <div class="buttons"><button class="primary" data-act="restoreApply" ${busyJob || (d.crossRoomRequired && !preview.cross) ? 'disabled' : ''}>${arm === 'restoreApply' ? '한 번 더 누르면 백업을 불러옵니다' : '이 백업 불러오기'}</button><button class="ghost" data-act="restoreCancel">취소</button></div>
      </div>`;
    }
    return `<div class="paper"><h2>백업</h2>
      <p class="hint">이 방의 장면·사실·장부·이름 표·번역 등 기억 서재가 가진 모든 기록(과 이 방의 설정)을 파일 하나로 내 컴퓨터에 내려받습니다. 마리나라의 채팅 메시지는 들어 있지 않습니다.</p>
      <label class="check-row"><input type="checkbox" id="setBackupVectors" ${withVectors ? 'checked' : ''}><span><b>검색 색인 포함 (크기 큼)</b><small>뜻으로 찾기용 색인입니다. 빼도 불러온 뒤 다시 만들 수 있습니다.</small></span></label>
      <div class="buttons"><button data-act="backupDownload">백업 내려받기</button></div>
      <p class="hint">백업에서 불러오기: 파일을 고르면 먼저 내용을 미리 보여 드리고, 확인하셔야 바뀝니다. 정리 작업 중에는 불러올 수 없습니다.</p>
      <label>백업 파일 고르기<input type="file" id="restoreFile" accept=".json,application/json" ${busyJob ? 'disabled' : ''}></label>
      ${previewHtml}
      ${undo ? `<div class="buttons"><button class="ghost" data-act="restoreUndo" ${busyJob ? 'disabled' : ''}>${arm === 'restoreUndo' ? '한 번 더 누르면 불러오기를 되돌립니다' : `불러오기 되돌리기 (${esc(date(undo.at))} 이전 상태)`}</button></div>` : ''}
    </div>`;
  }

  /** Saves a JSON document as a file on this computer. */
  function saveFile(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function viewSettings() {
    if (!info) return emptyRoom();
    const current = serverSettings?.connection || '';
    const recall = serverSettings?.recall || 'model';
    return `<div class="eyebrow">SETTINGS</div><h1>설정</h1>
      <div class="paper"><h2>화면</h2>
        <label>글꼴<select id="setFont">
          <option value="marinara" ${font === 'marinara' ? 'selected' : ''}>마리나라에서 쓰는 글꼴 따라가기</option>
          <option value="own" ${font === 'own' ? 'selected' : ''}>기억 서재 기본 글꼴 (제목 명조 · 본문 고딕)</option></select></label>
        <p class="hint">이 기기에서만 바뀝니다. 밝기는 오른쪽 위 해·달 버튼으로 바꿉니다.</p>
        <p class="hint">컴퓨터 화면에서는 위쪽 막대를 끌어 창을 옮기고, 오른쪽 아래 모서리·오른쪽·아래쪽 가장자리를 끌어 크기를 바꿀 수 있습니다. 위치와 크기는 이 기기에 기억됩니다.</p>
        <div class="buttons"><button data-act="resetPanel">창 위치 초기화</button></div>
      </div>
      <div class="paper"><h2>이 방</h2>
        <label class="setting-switch"><span>기억 사용<small>켜면 답변마다 장부와 장면을 자동으로 갱신합니다.</small></span><input type="checkbox" id="setEnabled" ${info.enabled ? 'checked' : ''}></label>
        <label class="setting-switch"><span>말풍선 태그 되살리기<small>화자 색상이 켜진 '합쳐서' 그룹 RP에서 모델이 원래의 숨은 화자 태그를 출력하도록 지침을 보강합니다. 보이는 이름표 없이 따옴표만 쓰는 대사에도 적용됩니다.</small></span><input type="checkbox" id="setTags" ${info.speakerTags ? 'checked' : ''}></label>
        <label class="setting-switch"><span>대사 앞에 이름 표시<small>캐릭터 대사에 '이름 | 대사'를 출력하도록 요청합니다. 말풍선 태그 기능과 독립적으로 설정할 수 있습니다.</small></span><input type="checkbox" id="setSpeakerNames" ${info.speakerNames ? 'checked' : ''}></label>
        <label>장면의 디테일<select id="setDetailLevel"><option value="standard" ${!info.organize?.detailLevel || info.organize.detailLevel === 'standard' ? 'selected' : ''}>보통</option><option value="detailed" ${info.organize?.detailLevel === 'detailed' ? 'selected' : ''}>자세히</option><option value="very_detailed" ${info.organize?.detailLevel === 'very_detailed' ? 'selected' : ''}>아주 자세히</option></select></label><p class="hint">자세할수록 행동과 반응, 사건의 앞뒤를 더 세밀하게 기록하도록 요청합니다. 정리와 회상에 쓰이는 토큰이 늘어날 수 있습니다.</p>
        <label>주변 인물 정리<select id="setNpcCoverage"><option value="standard" ${info.organize?.npcCoverage !== 'expanded' ? 'selected' : ''}>기본</option><option value="expanded" ${info.organize?.npcCoverage === 'expanded' ? 'selected' : ''}>NPC·모브 자세히</option></select></label>
        <p class="hint">기본은 기존 방식으로 정리합니다. NPC·모브 자세히를 선택하면 1:1 채팅에서도 주변 인물의 역할·행동·대화와 사건에 미친 영향을 더 자세히 정리하도록 요청합니다.</p>
        <label>원문 인용 방식<select id="setQuoteMode"><option value="dialogue" ${!info.organize?.quoteMode || info.organize.quoteMode === 'dialogue' ? 'selected' : ''}>대사 위주</option><option value="narration" ${info.organize?.quoteMode === 'narration' ? 'selected' : ''}>서술 위주</option><option value="both" ${info.organize?.quoteMode === 'both' ? 'selected' : ''}>대사 + 서술 둘 다 · 토큰량 높음</option></select></label><p class="hint">대사 위주는 중요한 대사를 중심으로, 서술 위주는 장면의 행동·상황을 보여 주는 서술을 중심으로 인용합니다. 서술 위주에서도 중요한 대사는 함께 보존하도록 요청합니다. 둘 다를 선택하면 대사와 서술을 더 넉넉히 인용하므로 정리와 회상에 쓰이는 토큰이 늘어날 수 있습니다.</p><p class="hint">이 방에만 적용됩니다. 저장 후 새로 정리하는 장면부터 적용되며, 이미 정리한 장면을 바꾸려면 원문부터 다시 정리해야 합니다. 실제 정리 결과는 사용하는 모델에 따라 달라질 수 있습니다.</p><div class="buttons"><button data-act="saveOrganizePreferences">이 방의 정리 방식 저장</button></div>
        <label>이 방의 대사 확인 방식<select id="setAttributionRoom" data-attribution-room="1"><option value="follow" ${(info.attributionCheck?.room || 'follow') === 'follow' ? 'selected' : ''}>기본값 따름 (지금 모든 방 기본값: ${esc(attributionModeLabel(info.attributionCheck?.global))})</option>${attributionModeOptions(info.attributionCheck?.room)}</select></label><p class="hint">${ATTRIBUTION_MODE_HINT} 바꾸면 바로 저장되고, 다음 정리부터 적용됩니다.</p>
      </div>
      ${featuresPaper(info.features)}
      ${backupPaper({ armed, preview: restorePreview && restorePreview.room === room ? restorePreview : null, withVectors: backupVectors, running: running(), undo: info.restoreUndo })}
      <div class="paper"><h2>모든 방 공통</h2>
        <label>기억 정리에 쓸 연결<select id="setConnection">${connections.map((c) => `<option value="${esc(c.id)}" ${c.id === current ? 'selected' : ''}>${esc(c.name)}${c.model ? ` · ${esc(c.model)}` : ''}</option>`).join('')}</select></label>
        <label>회상 방식<select id="setRecall">
          <option value="model" ${recall === 'model' ? 'selected' : ''}>기억 모델이 목차를 보고 고르기 (답변마다 호출 1번)</option>
          <option value="fast" ${recall === 'fast' ? 'selected' : ''}>빠른 방식 (낱말과 장부, 호출 없음)</option>
          <option value="off" ${recall === 'off' ? 'selected' : ''}>회상 안 함</option></select></label>
        <label>회상 양<select id="setRecallAmount">
          <option value="less" ${serverSettings?.recallAmount === 'less' ? 'selected' : ''}>적게 — 장면 2개, 원문 1곳 (기억을 늘어놓는 느낌이 들 때)</option>
          <option value="normal" ${!serverSettings?.recallAmount || serverSettings?.recallAmount === 'normal' ? 'selected' : ''}>보통 — 장면 4개, 가까운 사건 3개, 원문 2곳</option>
          <option value="more" ${serverSettings?.recallAmount === 'more' ? 'selected' : ''}>많이 — 장면 6개, 가까운 사건 6개, 원문 2곳</option></select></label>
        <label>지난 이야기 흐름 길이 (챕터와 '꼭 기억할 세부 사항')<select id="setChapterLength">
          <option value="short" ${serverSettings?.chapterLength === 'short' ? 'selected' : ''}>짧게 — 2,000자 (약 1,000토큰)</option>
          <option value="normal" ${!serverSettings?.chapterLength || serverSettings?.chapterLength === 'normal' ? 'selected' : ''}>보통 — 4,000자 (약 2,000토큰, 기본)</option>
          <option value="long" ${serverSettings?.chapterLength === 'long' ? 'selected' : ''}>길게 — 8,000자 (약 4,000토큰)</option>
          <option value="full" ${serverSettings?.chapterLength === 'full' ? 'selected' : ''}>아주 길게 — 16,000자 (약 8,000토큰)</option></select></label>
        <p class="hint">길수록 오래된 챕터의 요약과 세부 사항이 더 많이 들어가지만, 답변마다 그만큼 입력이 늘어납니다. 기억 전체 한도(40,000자) 안에서 나눠 씁니다.</p>
        <label>캐릭터가 지난 일을 먼저 꺼내는 정도<select id="setRecallStyle">
          <option value="quiet" ${serverSettings?.recallStyle === 'quiet' ? 'selected' : ''}>은은하게 — 꼭 필요할 때만 살짝 (기억을 받아 적는 느낌이 들 때)</option>
          <option value="natural" ${!serverSettings?.recallStyle || serverSettings?.recallStyle === 'natural' ? 'selected' : ''}>자연스럽게 — 상황에 맞으면 묻지 않아도 먼저 꺼냄</option>
          <option value="active" ${serverSettings?.recallStyle === 'active' ? 'selected' : ''}>적극적으로 — 지난 약속·했던 말을 자주 끌어옴</option></select></label>
        <p class="hint">어느 쪽이든 지난 일을 줄줄이 설명하지는 않게 합니다.</p>
        <label>대사 확인 방식 (모든 방 기본값)<select id="setAttributionCheck">${attributionModeOptions(serverSettings?.attributionCheck || 'default')}</select></label>
        <p class="hint">${ATTRIBUTION_MODE_HINT} 방마다 따로 정할 수도 있습니다(설정 → 이 방).</p>
        <div class="buttons"><button class="primary" data-act="saveSettings">저장</button></div>
      </div>
      <div class="paper"><h2>기억 언어</h2>
        <p class="hint">언어는 두 가지를 따로 고릅니다. <b>정리할 언어</b>는 기억 서재에 저장되는 언어이고, <b>넣을 언어</b>는 답변을 만들 때 프롬프트에 넣는 언어입니다. 넣을 언어만 바꾸면 저장된 기억은 그대로 두고 넣을 때만 번역하므로 <b>다시 정리할 필요가 없습니다</b>.</p>
        ${info?.chatLang ? `<p class="hint">이 방은 <b>${({ en: '영어', zh: '중국어' })[info.chatLang] || '한국어'}</b>로 진행되는 것으로 보입니다(최근 메시지 기준, 자동).</p>` : ''}
        ${prepNote()}
        <label>기억을 정리할 언어 (모든 방 기본값)<select id="setWriteLang">
          <option value="auto" ${!['ko', 'en', 'zh'].includes(serverSettings?.writeLanguage) ? 'selected' : ''}>채팅 언어로 (기본)</option>
          <option value="ko" ${serverSettings?.writeLanguage === 'ko' ? 'selected' : ''}>한국어로 (중국어·영어 방도 한국어로만 정리)</option>
          <option value="en" ${serverSettings?.writeLanguage === 'en' ? 'selected' : ''}>영어로 (한국어 방도 영어로 정리)</option>
          <option value="zh" ${serverSettings?.writeLanguage === 'zh' ? 'selected' : ''}>중국어로 (간체 · 한국어 방도 중국어로 정리)</option></select></label>
        <p class="hint">기억 서재에 <b>저장되는</b> 언어입니다. 영어나 중국어로 바꾸면 <b>새로 정리되는 기억부터</b> 그 언어로 저장하고, 이 화면에서는 한국어 번역이 함께 보입니다. 이미 정리된 기억은 그대로 두고 넣을 때 번역하므로 바로 써도 됩니다. 전부 그 언어로 저장하고 싶으시면 한눈에 → <b>처음부터 다시 정리</b>를 눌러 주세요. 대사 인용과 이름은 늘 원문 그대로입니다. 한국어 방에서 영어나 중국어로 정리해도 낱말로 찾기는 이 화면의 한국어 번역과 원래 낱말을 함께 봅니다(번역이 아직 없는 기억은 원래 낱말로만 찾습니다).</p>
        ${roomWriteLanguagePicker()}
        <label>기억을 넣을 언어<select id="setMemLang">
          <option value="auto" ${!serverSettings?.memoryLanguage || serverSettings?.memoryLanguage === 'auto' ? 'selected' : ''}>정리한 언어 그대로 (기본 · 번역 없음)</option>
          <option value="ko" ${serverSettings?.memoryLanguage === 'ko' ? 'selected' : ''}>한국어</option>
          <option value="en" ${serverSettings?.memoryLanguage === 'en' ? 'selected' : ''}>영어 (한국어 채팅이면 영어로 번역해서 넣음)</option>
          <option value="zh" ${serverSettings?.memoryLanguage === 'zh' ? 'selected' : ''}>중국어 (간체로 번역해서 넣음)</option></select></label>
        <label>번역에 쓸 연결<select id="setTrConn">
          <option value="" ${!serverSettings?.translateConnection ? 'selected' : ''}>기억 정리 연결 그대로</option>
          ${connections.map((c) => `<option value="${esc(c.id)}" ${c.id === serverSettings?.translateConnection ? 'selected' : ''}>${esc(c.name)}${c.model ? ` · ${esc(c.model)}` : ''}</option>`).join('')}</select></label>
        <label class="setting-switch"><span>영어·중국어 기억을 자동으로 한국어로 번역<small>영어로 정리된 기억을 이 화면에서 볼 때 한국어 번역을 알아서 만듭니다. 끄면 번역이 없는 항목은 영어로 보이고, 위에 뜨는 [지금 번역]을 누를 때만 번역합니다(번역 호출을 아낄 때). 답변에 넣는 기억의 번역(넣을 언어)은 이 설정과 상관없이 그대로입니다.</small></span><input type="checkbox" id="setAutoTr" ${serverSettings?.autoTranslate !== false ? 'checked' : ''}></label>
        <label class="setting-switch"><span>영어 대사도 한국어로 보기<small>이 화면에서 영어로 된 대사 아래에 한국어 번역을 함께 보여 줍니다. 번역 호출이 조금 더 듭니다. 기억 칸에 들어가는 대사는 늘 원문 그대로입니다.</small></span><input type="checkbox" id="setTrQuotes" ${serverSettings?.translateQuotes ? 'checked' : ''}></label>
        <p class="hint">넣을 언어를 바꾸면 이 방의 기억을 바로 뒤에서 번역해 둡니다. 번역이 끝나기 전에 답변을 만들면, 아직 번역되지 않은 줄만 원래 언어로 들어갑니다(기억이 빠지지는 않습니다). 새로 정리되는 기억도 정리가 끝날 때마다 이어서 번역합니다. 대사 인용과 이름은 늘 원문 그대로 넣습니다. 영어로 정리된 기억은 이 화면에서 한국어 번역이 함께 보입니다.</p>
        <div class="buttons"><button class="primary" data-act="saveLanguage">저장</button></div>
      </div>
      <div class="paper"><h2>뜻으로 찾기 (임베딩)</h2>
        <p class="hint">말을 바꿔 물어도 비슷한 내용의 지난 장면을 찾습니다. 한국어라면 Qwen3-Embedding이나 bge-m3 같은 다국어 임베딩 모델을 추천합니다.</p>
        <label>임베딩 모델을 어디서 가져올까요<select id="setEmbedMode">
          <option value="connection" ${embedMode() === 'connection' ? 'selected' : ''}>마리나라 연결의 임베딩 설정 그대로 쓰기 (추천)</option>
          <option value="manual" ${embedMode() === 'manual' ? 'selected' : ''}>여기서 직접 입력</option>
          <option value="off" ${embedMode() === 'off' ? 'selected' : ''}>끄기</option></select></label>
        <p class="hint">‘그대로 쓰기’는 위의 ‘기억 정리에 쓸 연결’에서 마리나라 연결 설정의 <b>시맨틱 검색(임베딩)</b> 모델·주소·임베딩 연결을 그대로 가져옵니다.</p>
        <label>직접 입력할 임베딩 모델<input id="setEmbedding" list="embeddingModels" value="${esc(serverSettings?.embedding?.model || '')}" placeholder="예: Qwen/Qwen3-Embedding-8B"></label>
        <datalist id="embeddingModels"><option value="Qwen/Qwen3-Embedding-8B"><option value="BAAI/bge-m3"><option value="Qwen/Qwen3-Embedding-0.6B"></datalist>
        <p class="hint">지금: ${serverEmbedding?.model ? `<b>${esc(serverEmbedding.model)}</b> · ${esc(serverEmbedding.label || '')}` : serverEmbedding?.error ? esc(serverEmbedding.error) : embedMode() === 'off' ? '꺼져 있습니다.' : '임베딩 모델을 찾지 못했습니다. 마리나라 연결 설정에 임베딩 모델을 넣거나 직접 입력해 주세요.'}</p>
        ${info.vectors ? `<p class="hint">이 방: 장면 ${info.vectors.total}개 중 ${info.vectors.indexed}개 색인됨${info.vectors.indexed < info.vectors.total ? ' (다음 정리 때 이어서 만듭니다)' : ''}</p>` : ''}
        <div class="buttons"><button data-act="saveEmbedding">임베딩 저장·연결 확인</button></div>
      </div>
      ${orphanSection()}
      <p class="hint">기억 모듈 업데이트는 설치할 때와 같은 명령을 다시 실행하시면 됩니다.</p>`;
  }

  /** Memory of rooms that were deleted before the module started removing it with the room. Never removed on its own. */
  function orphanSection() {
    if (orphans === null) return '';
    const size = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`);
    const rows = orphans.map((o) => `<div class="orphan-row"><p class="hint"><b>${esc(o.name || o.hint || o.id)}</b>${o.name || o.hint ? ` · ${esc(o.id)}` : ''}<br>${o.settingsOnly ? '방 설정만 남아 있음' : `장면 ${o.scenes}개 · 파일 ${o.files}개 · ${size(o.bytes)}`}${o.updatedAt ? ` · 마지막 변경 ${esc(day(o.updatedAt))}` : ''}</p>
        <div class="buttons"><button data-act="orphanDelete" data-orphan-id="${esc(o.id)}">삭제</button></div></div>`).join('');
    return `<div class="paper"><h2>삭제된 방의 기억</h2>
      <p class="hint">방을 지우면 그 방의 기억도 함께 영구 삭제됩니다. 이 기능이 생기기 전에 지운 방의 기억은 자동으로 지우지 않고 여기에 남겨 두었습니다. 삭제하면 되돌릴 수 없습니다.</p>
      ${orphans.length ? `${rows}<div class="buttons"><button data-act="orphanDeleteAll"><span class="warn">모두 삭제 (${orphans.length}개)</span></button></div>` : '<p class="hint">삭제된 방의 기억이 없습니다.</p>'}</div>`;
  }

  function inspector() {
    if (!info) return '';
    const stats = threadStats();
    return `<div class="rail-title">이 방의 기억</div>
      <div class="rail-stat"><b>${info.scenes?.count ?? 0}</b><small>장면<br>메시지 ${info.scenes?.coveredThrough ?? '-'}번까지</small></div>
      <div class="rail-stat"><b>${stats.emotion}</b><small>풀리지 않은 감정</small></div>
      <div class="rail-stat"><b>${stats.promise}</b><small>지켜야 할 약속</small></div>
      <div class="rail-divider"></div>
      <div class="rail-note">${icon('spark')}<h3>기억은 서버에 있습니다</h3><p>여기서 고친 내용은 서버의 기억 모듈에 바로 저장되고, 다음 답변부터 반영됩니다.</p></div>
      <div class="rail-footer">기억 서재 · 기억 모듈판 v${VERSION}</div>`;
  }

  // Who said a line and to whom, as the server checked it: kept on the server for the last few runs.
  const ATTRIBUTION_WORDS = {
    agree: '두 판단 일치', 'one-proven': '한 판단만 근거 확인', 'single-answer': '한 판단만 받음', disagree: '두 판단이 다름', reask: '다시 물어 확인',
    'no-proven-speaker': '근거 있는 화자 없음', vocative: '대사 안에서 불린 사람을 화자로 답함', kept: '기존 값 유지', 'kept-disagree': '판단이 달라 기존 값 유지',
    'cleared-vocative': '불린 사람이 화자로 저장되어 지움', 'cleared-narration': '옆 서술과 맞지 않아 지움', narration: '옆 서술이 가리킨 화자', sender: '메시지 작성자',
    manual: '직접 고친 대사라 건너뜀', 'changed-during-check': '확인 중 바뀌어 건너뜀', malformed: '응답 형식 오류', unanswered: '응답 없음',
    'message-missing': '원문 메시지 없음', 'message-changed': '원문 메시지가 바뀜', 'pointer-mismatch': '원문 위치가 맞지 않음',
    'vocative-speaker': '불린 사람이 화자', 'narration-speaker': '옆 서술과 다른 화자', 'narration-fill': '옆 서술로 화자 채움', 'relay-listener': '전해 달라는 제3자를 상대에서 뺌',
    'self-listener': '화자가 상대에 포함', 'vocative-listener': '불린 사람을 상대로', reply: '앞 대사에 대한 대답', 'narration-conflict': '옆 서술과 다른 화자',
    'role-name': '옆 서술의 역할을 장면에서 이름으로 확인', 'evidence-missing': '근거가 원문에 없음', 'evidence-in-quote': '근거가 대사 안에만 있음', 'evidence-unanchored': '근거에 화자 이름·역할이 없음', 'role-unresolved': '역할의 이름을 원문에서 못 찾음',
    'unknown-name': '모르는 이름', label: '화자 표기', evidence: '서술 근거', blank: '비움', applied: '저장', unchanged: '그대로', skipped: '건너뜀',
    'single-clean': '한 번 확인 (문제 없음)', 'swapped-reversed': '화자·상대가 뒤바뀌어 바로잡음', 'cleared-reversed': '두 판단 모두 저장된 화자를 상대로 봐서 지움',
    'cleared-label': '화자 표기가 서술과 맞지 않아 지움', 'label-contradicted': '화자 표기가 옆 서술과 맞지 않음', 'kept-listener': '두 판단이 같은 기존 상대 유지',
    'agreed-listener': '두 판단이 같은 상대 추가', 'reversed-listener': '저장됐던 화자를 상대로', 'title-listener': '호칭으로 불린 사람을 상대로', 'address-book': '호칭 사전의 부르는 말로 불린 사람을 상대로',
    settled: '규칙으로 확정', 'settled-label': '규칙으로 확정 · 화자 표기', 'settled-narration': '규칙으로 확정 · 옆 서술', 'settled-sender': '규칙으로 확정 · 메시지 작성자',
    'differs-from-stored': '저장 값과 다른 판단', 'listener-differs': '상대가 저장 값과 다름', 'listener-rejected': '상대 근거 부족', role: '역할로만 나온 화자',
    'listener-evidence': '상대 근거가 원문에 없음', 'listener-relay': '전해 달라는 제3자', 'listener-unknown-name': '모르는 상대 이름',
    'kept-agreed': '두 판단과 부른 상대가 맞아 기존 값 유지', 'empty-speaker': '저장된 화자가 없음', relocated: '원문 위치를 고침', 'pointer-updated': '같은 메시지에서 대사를 찾아 위치를 고침',
  };
  const attributionWord = (code) => String(code || '').split(',').filter(Boolean).map((c) => ATTRIBUTION_WORDS[c] || c).join(', ');
  function attributionEntryHtml(d) {
    const who = (a) => a ? `${esc(a.by || '미확정')} → ${esc(Array.isArray(a.to) ? a.to.join('·') || '미확정' : a.to || '미확정')}` : '응답 없음';
    const why = (a) => a?.byReason ? ` (${esc(attributionWord(a.byReason))})` : '';
    const lines = [`${sceneRef(d.scene, '', {})}<strong>#${esc(d.number)}.${esc(d.sentence)}</strong>${d.source === 'rule' ? ' · 규칙' : ''}${d.from ? ` · 전에는 #${esc(d.from.number)}.${esc(d.from.sentence)}` : ''}`];
    if (d.role) lines.push(`역할: ${esc(d.role)}${d.roleName ? ` → ${esc(d.roleName)}` : ' (장면에서 이름을 못 찾음)'}`);
    if (d.first !== undefined && d.source !== 'rule') lines.push(`첫 판단: ${who(d.first)}${why(d.first)}`, d.asked === 1 ? '두 번째 판단: 묻지 않음 (첫 판단에 문제 없음)' : `두 번째 판단: ${who(d.second)}${why(d.second)}`);
    if (d.reask) lines.push(`다시 물음: ${who(d.reask)}${why(d.reask)}`);
    if (d.violations?.length) lines.push(`검토 이유: ${esc(attributionWord(d.violations.join(',')))}`);
    if (d.asked === 2 && d.flags?.length) lines.push(`다시 물은 이유: ${esc(attributionWord(d.flags.join(',')))}`);
    if (d.fired?.length) lines.push(`적용한 규칙: ${esc(attributionWord(d.fired.join(',')))}`);
    if (d.rejected?.length) lines.push(`받아들이지 않은 이유: ${esc(attributionWord(d.rejected.join(',')))}`);
    if (d.before) lines.push(`저장 전: ${who(d.before)}`);
    if (d.after) lines.push(`저장 후: ${who(d.after)}`);
    lines.push(`결과: ${esc(attributionWord(d.decision))}${d.rule ? ` · ${esc(attributionWord(d.rule))}` : d.agreed?.reason ? ` · ${esc(attributionWord(d.agreed.reason))}` : ''}`);
    const at = `${d.number}.${d.sentence}`;
    return `<p data-at="${esc(at)}"${attributionHidden(at) ? ' hidden' : ''}>${lines.join('<br>')}</p>`;
  }
  /** Whether the filter hides the entry for this quote id: "1.2" shows #1.2 and #1.20–#1.29, "1" all of message 1. */
  const attributionHidden = (at) => {
    const f = attributionFilter.trim().replace(/^#/, '');
    return !!f && !(at === f || at.startsWith(f.includes('.') ? f : `${f}.`));
  };
  /** Per scene: how many lines a run listed, and how many it only counted (checked with nothing to report). */
  function attributionSummaryHtml(r) {
    const rows = (r.summary || []).filter((x) => x.unchanged || x.settled || x.skipped || x.changed || x.moved);
    if (!rows.length) return '';
    const part = (n, word) => (n ? `${word} ${n}` : '');
    return `<p class="hint">${rows.map((x) => `${esc(x.scene || '?')}: ${[part(x.changed, '바뀜'), part(x.listed, '목록'), part(x.unchanged, '그대로'), part(x.settled, '규칙 확정'), part(x.skipped, '변화 없어 건너뜀'), part(x.moved, '위치 고침')].filter(Boolean).join(' · ')}`).join('<br>')}</p>`;
  }
  function attributionLogHtml(info, sj) {
    const stored = Array.isArray(info.attributionLog) ? info.attributionLog : lazyData('attribution')?.runs || null;
    const runs = stored || [];
    const count = stored ? stored.length : info.attributionRuns || 0;
    const byPlace = (a, b) => a.number - b.number || a.sentence - b.sentence;
    const live = sj.state === 'running' && (sj.attributionDiagnostics || []).length ? [...sj.attributionDiagnostics].sort(byPlace) : null;
    const tally = (c) => c ? ` · 확인 ${c.reviewed ?? 0} · 두 번 물음 ${c.second ?? 0} · 건너뜀 ${(c.skipped ?? 0) + (c.settled ?? 0)} · 모델 호출 ${c.calls ?? 0}` : '';
    if (!count && !live) return '';
    const changed = (entries) => entries.filter((d) => d.decision === 'applied').length;
    const run = (r, i) => `<details${i === 0 && !live ? ' open' : ''}><summary>${esc((r.at || '').replace('T', ' ').slice(0, 16))} · ${esc(r.reason || '')}${r.mode ? ` · ${esc(attributionModeLabel(r.mode))}` : ''} · ${r.entries.length}줄 · 바뀜 ${changed(r.entries)}${esc(tally(r.counts))}${r.dropped ? ` · ${r.dropped}줄은 기록 한도로 생략` : ''}</summary>${(r.notes || []).map((n) => `<p class="hint">${esc(n)}</p>`).join('')}${attributionSummaryHtml(r)}${r.entries.map(attributionEntryHtml).join('')}</details>`;
    const wait = stored ? '' : lazyError('attribution') ? `<div class="note">${esc(lazyError('attribution'))}</div>` : '<p class="hint">불러오는 중…</p>';
    return `<details data-list="attrlog"${attributionFilter || openLists.has('attrlog') ? ' open' : ''}><summary>대사 확인 기록 (${count}회${live ? ' · 진행 중' : ''}) · 확인 방식: ${esc(attributionModeLabel(info.attributionCheck?.mode))}</summary><p class="hint">화자·상대 판단과 저장 결과입니다. 서버에 방마다 최근 5회까지 남고, 정리가 끝나거나 서버를 다시 켜도 유지됩니다. 바뀌었거나 다시 물었거나 받아들이지 않은 대사는 모두 남고, 문제없이 그대로인 대사는 장면별 개수로만 보입니다. 대사 원문과 근거 문구는 기록하지 않습니다.</p>${wait}<label>대사 번호로 찾기<input id="attributionFilter" value="${esc(attributionFilter)}" placeholder="예: #1.24" autocomplete="off"></label>${live ? `<details open><summary>진행 중 (${live.length}${esc(tally(sj.attributionProgress))})</summary>${live.map(attributionEntryHtml).join('')}</details>` : ''}${runs.map(run).join('')}</details>`;
  }

  const VIEWS = { home: viewHome, scenes: viewScenes, search: viewSearch, facts: viewFacts, ledger: viewLedger, life: viewLife, world: viewWorld, names: viewNames, inject: viewInject, settings: viewSettings };

  function render() {
    if (!root) return;
    launcher?.setAttribute('data-theme', theme);
    launcher?.setAttribute('aria-expanded', String(open));
    root.querySelector('#backdrop').hidden = !open;
    root.host.setAttribute('data-font', font);
    root.querySelector('#panel').classList.toggle('is-running', Boolean(busy || (info && running())));
    root.querySelector('#panel').hidden = !open;
    if (!open) return;
    for (const b of root.querySelectorAll('nav button')) b.classList.toggle('selected', b.dataset.tab === tab);
    root.querySelector('#roomSelect').innerHTML = rooms.length
      ? rooms.map((r) => `<option value="${esc(r.id)}" ${r.id === room ? 'selected' : ''}>${r.enabled ? '● ' : ''}${esc(r.name)}</option>`).join('')
      : '<option>채팅방 없음</option>';
    const toggle = root.querySelector('#roomEnabled');
    toggle.checked = Boolean(info?.enabled);
    root.querySelector('#enabledLabel').textContent = info?.enabled ? '이 방에서 기억 사용 중' : '이 방에서 사용 안 함';
    const progress = info?.job?.state === 'running' && info.job.total ? ` (${info.job.stage || '장부'} ${info.job.done}/${info.job.total})` : info?.sceneJob?.state === 'running' ? ' (장면 정리)' : '';
    root.querySelector('#status').textContent = busy ? '처리 중…' : running() ? `정리 중입니다${progress}… 3초마다 새로 확인합니다.` : notice;
    const err = root.querySelector('#error');
    err.hidden = !lastError;
    err.textContent = lastError;
    const content = root.querySelector('#content');
    const scroll = content.scrollTop;
    const jobError = info?.job?.error || info?.sceneJob?.error;
    const warning = jobError ? `<div class="note" role="alert">기억 정리를 마치지 못했습니다. ${esc(jobError)}</div>` : '';
    const translation = trPending || trError ? `<div class="note" role="status">${trError ? `한국어 번역을 마치지 못했습니다. ${esc(trError)}` : trWorking ? '한국어 번역 중입니다.' : trAuto ? '한국어 번역이 남아 있습니다.' : '자동 번역이 꺼져 있어 일부 항목이 영어로 보입니다.'} ${trPending ? `남은 항목: ${trPending}개.` : ''} <button data-act="retryTranslation">${trAuto || trError ? '남은 항목 다시 번역' : '지금 번역'}</button></div>` : '';
    content.innerHTML = warning + translation + VIEWS[tab]();
    content.scrollTop = scroll;
    root.querySelector('#inspector').innerHTML = inspector();
    const n = root.querySelector('#themeToggle');
    n.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
    root.host.setAttribute('data-theme', theme);
    launcher?.setAttribute('data-theme', theme);
    if (tab === 'scenes') {
      const sel = root.querySelector('.file-index.is-selected');
      sel?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
    }
    if (focus) {
      const target = focus.kind === 'thread' ? root.querySelector(`[data-tid="${CSS.escape(focus.id)}"]`) : root.querySelector(`[data-fact="${CSS.escape(focus.id)}"]`);
      focus = null;
      if (target) {
        // A closed item sits inside the folded "닫힌 항목" box: open that too.
        target.closest('details.paper')?.setAttribute('open', '');
        if (target.tagName === 'DETAILS') target.open = true;
        target.classList.add('is-focus');
        target.scrollIntoView?.({ block: 'center' });
      }
    }
    ensureLazyParts();
  }

  /* ---------- actions ---------- */

  async function handle(actName, el) {
    const id = el?.dataset?.id;
    const chat = encodeURIComponent(room);
    if (actName !== 'fresh' && !actName.startsWith('deleteFact') && actName !== 'closeThread' && actName !== 'rebuildChapters' && actName !== 'deleteRoutine' && !['nameApply', 'mergeApply', 'aliasApply', 'nameUndo', 'backupDownload', 'restoreApply', 'restoreUndo', 'addressDelete', 'stateReset', 'placeDelete', 'keepDelete', 'trackerDelete', 'trackerDropStart'].includes(actName)) armed = '';
    switch (actName) {
      case 'retryTranslation':
        return act(async () => {
          const result = await api('POST', `/chats/${chat}/translations/retry`);
          notice = result.alreadyWorking ? '이미 번역 중입니다.' : result.missing === 0 ? '남은 번역이 없습니다.' : '남은 항목을 번역하고 있습니다.';
        });
      case 'deleteSelectedMemory':
        if (!confirm('선택한 기억을 삭제하시겠습니까?')) return;
        return act(() => api('DELETE', `/chats/${chat}/selected-memory/${encodeURIComponent(el.dataset.selectedId)}`), '선택한 기억을 삭제했습니다.');
      case 'orphanDelete': {
        const id = el.dataset.orphanId;
        if (!id || !confirm('이 삭제된 방의 기억을 영구 삭제합니다. 되돌릴 수 없습니다. 계속할까요?')) return;
        return act(async () => {
          await api('DELETE', `/orphans/${encodeURIComponent(id)}`);
          orphans = (await api('GET', '/orphans')).orphans;
        }, '삭제된 방의 기억을 지웠습니다.');
      }
      case 'orphanDeleteAll':
        if (!orphans?.length || !confirm(`삭제된 방 ${orphans.length}개의 기억을 모두 영구 삭제합니다. 되돌릴 수 없습니다. 계속할까요?`)) return;
        return act(async () => {
          const r = await api('POST', '/orphans/delete-all');
          orphans = (await api('GET', '/orphans')).orphans;
          notice = `삭제된 방 ${r.deleted.length}개의 기억을 지웠습니다.`;
        });
      case 'resetPanel':
        resetPanelGeometry();
        notice = '창 위치와 크기를 처음대로 돌렸습니다.';
        return render();
      case 'refresh':
        rooms = [];
        return act(refresh, '새로 불러왔습니다.', { reload: false });
      case 'start':
        return act(() => api('POST', `/chats/${chat}/start`, { fresh: false }), '정리를 시작했습니다.');
      case 'fresh':
        if (armed !== 'fresh') {
          armed = 'fresh';
          return render();
        }
        armed = '';
        return act(() => api('POST', `/chats/${chat}/start`, { fresh: true }), '처음부터 다시 정리를 시작했습니다.');
      case 'backupDownload':
        return act(async () => {
          const r = await api('GET', `/chats/${chat}/backup${backupVectors ? '?vectors=1' : ''}`);
          saveFile(r.fileName, JSON.stringify(r.backup));
          notice = r.backup.header.jobRunning ? '백업을 내려받았습니다. 정리 작업이 돌아가는 중이어서 파일끼리 시점이 조금 다를 수 있습니다.' : '백업을 내려받았습니다.';
        }, '', { reload: false });
      case 'restoreCancel':
        restorePreview = null;
        return render();
      case 'restoreApply': {
        const p = restorePreview;
        if (!p || p.room !== room) return;
        if (p.data.crossRoomRequired && !p.cross) { lastError = '다른 방의 백업을 적용하려면 "다른 방의 백업을 이 방에 적용"을 체크해 주세요.'; armed = ''; return render(); }
        if (armed !== 'restoreApply') { armed = 'restoreApply'; return render(); }
        armed = '';
        return act(async () => {
          await api('POST', `/chats/${chat}/restore/apply`, { backup: p.doc, crossRoom: p.cross });
          restorePreview = null;
        }, '백업을 불러왔습니다. 문제가 있으면 설정의 ‘불러오기 되돌리기’로 돌릴 수 있습니다.');
      }
      case 'restoreUndo':
        if (armed !== 'restoreUndo') { armed = 'restoreUndo'; return render(); }
        armed = '';
        return act(() => api('POST', `/chats/${chat}/restore/undo`), '불러오기를 되돌렸습니다.');
      case 'tidy':
        return act(() => api('POST', `/chats/${chat}/tidy`), '장부 점검을 시작했습니다.');
      case 'stop':
        return act(() => api('POST', `/chats/${chat}/stop`), '멈추는 중입니다.');
      case 'rebuildChapters':
        if (armed !== 'chapters') {
          armed = 'chapters';
          return render();
        }
        armed = '';
        selectedGroup = '';
        return act(() => api('POST', `/chats/${chat}/chapters/rebuild`), '챕터를 다시 묶기 시작했습니다.');
      case 'namePreview': {
        readNameForm();
        if (!nameForm.source || !nameForm.target) { lastError = '바꿀 이름과 기준 이름을 모두 골라 주세요.'; return render(); }
        const form = { ...nameForm };
        return act(async () => {
          namePreview = { kind: 'rename', room, form, data: await api('POST', `/chats/${chat}/names/preview`, form) };
        }, '', { reload: false });
      }
      case 'nameSuggest': {
        nameForm = { source: el.dataset.source, target: el.dataset.target, display: '', text: false };
        const form = { ...nameForm };
        return act(async () => {
          namePreview = { kind: 'rename', room, form, data: await api('POST', `/chats/${chat}/names/preview`, form) };
        }, '', { reload: false });
      }
      case 'nameApply': {
        if (armed !== 'nameApply') { armed = 'nameApply'; return render(); }
        armed = '';
        const { form, data } = namePreview;
        return act(async () => {
          await api('POST', `/chats/${chat}/names/apply`, { ...form, token: data.token, confirm: true });
          namePreview = null;
          names = null;
        }, `${form.source} → ${form.target}: 이름을 바꿨습니다.`);
      }
      case 'mergePreview':
        return act(async () => {
          namePreview = { kind: 'merge', room, form: null, data: await api('POST', `/chats/${chat}/names/merge-preview`) };
        }, '', { reload: false });
      case 'mergeApply': {
        if (armed !== 'mergeApply') { armed = 'mergeApply'; return render(); }
        armed = '';
        const token = namePreview?.data?.token;
        return act(async () => {
          await api('POST', `/chats/${chat}/names/merge`, { token, confirm: true });
          namePreview = null;
          names = null;
        }, '중복 이름을 합쳤습니다.');
      }
      case 'aliasPreview': {
        const form = { alias: el.dataset.alias, display: (root.querySelector(`#${el.dataset.input}`)?.value || '').trim() };
        if (!form.display) { lastError = '글에 쓸 표기를 적어 주세요.'; return render(); }
        return act(async () => {
          namePreview = { kind: 'alias', room, form, data: await api('POST', `/chats/${chat}/names/alias-text-preview`, form) };
        }, '', { reload: false });
      }
      case 'aliasApply': {
        if (armed !== 'aliasApply') { armed = 'aliasApply'; return render(); }
        armed = '';
        const { form, data } = namePreview;
        return act(async () => {
          await api('POST', `/chats/${chat}/names/alias-text-apply`, { ...form, token: data.token, confirm: true });
          namePreview = null;
          names = null;
        }, `글 속 ${form.alias} → ${form.display}: 표기를 바꿨습니다.`);
      }
      case 'stateUnlock':
        return act(async () => {
          await api('POST', `/chats/${chat}/state`, { action: 'unlock', name: el.dataset.name, field: el.dataset.field });
          world = null;
        }, '이 항목을 자동 기록으로 되돌렸습니다.');
      case 'stateAdd': {
        const name = (root.querySelector('#stateNewName')?.value || '').trim();
        if (!name) return;
        return act(async () => {
          await api('POST', `/chats/${chat}/state`, { action: 'add', name });
          worldForm.person = '';
          world = null;
        }, '인물 카드를 추가했습니다.');
      }
      case 'stateReset': {
        const name = el.dataset.name;
        if (armed !== `stateReset:${name}`) { armed = `stateReset:${name}`; return render(); }
        armed = '';
        return act(async () => {
          await api('POST', `/chats/${chat}/state`, { action: 'reset', name });
          world = null;
        }, '카드의 직접 고침을 지웠습니다.');
      }
      case 'placeUnlock':
        return act(async () => {
          await api('POST', `/chats/${chat}/places`, { action: 'unlock', id, field: el.dataset.field });
          world = null;
        }, '이 항목을 자동 기록으로 되돌렸습니다.');
      case 'placeAdd': {
        const name = (root.querySelector('#placeNewName')?.value || '').trim();
        if (!name) return;
        return act(async () => {
          await api('POST', `/chats/${chat}/places`, { action: 'add', name });
          worldForm.place = '';
          world = null;
        }, '장소를 추가했습니다.');
      }
      case 'placeDelete':
        if (armed !== `placeDelete:${id}`) { armed = `placeDelete:${id}`; return render(); }
        armed = '';
        return act(async () => {
          await api('POST', `/chats/${chat}/places`, { action: 'delete', id });
          world = null;
        }, '장소를 지웠습니다.');
      case 'conflictAnswer': {
        const answer = el.dataset.answer;
        const text = { keepA: '앞의 것을 남기고 뒤의 것은 기억 칸에서 뺐습니다.', keepB: '뒤의 것을 남기고 앞의 것은 기억 칸에서 뺐습니다.', both: '둘 다 맞는 것으로 표시했습니다.', dismiss: '이 충돌을 무시했습니다.', reopen: '다시 열었습니다.' }[answer];
        if (!text) return;
        return act(async () => {
          await api('POST', `/chats/${chat}/conflicts/${encodeURIComponent(id)}`, { action: answer });
          conflicts = null;
        }, text);
      }
      case 'keepUnlock':
        return act(async () => {
          await api('POST', `/chats/${chat}/keepsakes`, { action: 'unlock', id, field: el.dataset.field });
          world = null;
        }, '이 항목을 자동 기록으로 되돌렸습니다.');
      case 'trackerNew':
        trackerDraft = trackerDraft ? null : tkBlank();
        return render();
      case 'trackerCancel':
        trackerDraft = null;
        return render();
      case 'trackerEdit': {
        const it = world?.trackers?.items?.find((x) => x.id === id);
        if (!it) return;
        trackerDraft = tkFromItem(it);
        return render();
      }
      case 'trackerSave': {
        readTrackerForm();
        const d = { ...trackerDraft };
        return act(async () => {
          await api('POST', `/chats/${chat}/trackers`, d.id ? { action: 'edit', id: d.id, item: tkBody(d) } : { action: 'add', item: tkBody(d) });
          trackerDraft = null;
          world = null;
        }, d.id ? '트래커를 고쳤습니다.' : '트래커를 추가했습니다.');
      }
      case 'trackerDelete':
        if (armed !== `trackerDelete:${id}`) { armed = `trackerDelete:${id}`; return render(); }
        armed = '';
        return act(async () => {
          await api('POST', `/chats/${chat}/trackers`, { action: 'delete', id });
          if (trackerDraft?.id === id) trackerDraft = null;
          world = null;
        }, '트래커를 지웠습니다.');
      case 'trackerStart':
        return act(async () => {
          await api('POST', `/chats/${chat}/trackers`, { action: 'start', id });
          if (trackerDraft?.id === id) trackerDraft = null;
          world = null;
        }, '오늘을 새 시작일로 기록했습니다.');
      case 'trackerAddStart': {
        const date = (root.querySelector(`[data-tk-new="${id}"]`)?.value || '').trim();
        if (!date) return;
        return act(async () => {
          await api('POST', `/chats/${chat}/trackers`, { action: 'addStart', id, date });
          if (trackerDraft?.id === id) trackerDraft = null;
          world = null;
        }, '시작일을 추가했습니다.');
      }
      case 'trackerDropStart': {
        const date = el.dataset.date;
        if (armed !== `trackerDropStart:${id}:${date}`) { armed = `trackerDropStart:${id}:${date}`; return render(); }
        armed = '';
        return act(async () => {
          await api('POST', `/chats/${chat}/trackers`, { action: 'removeStart', id, date });
          if (trackerDraft?.id === id) trackerDraft = null;
          world = null;
        }, '시작일을 지웠습니다.');
      }
      case 'trackerAnswer': {
        const answer = el.dataset.answer;
        return act(async () => {
          await api('POST', `/chats/${chat}/trackers`, { action: answer, sid: el.dataset.sid });
          world = null;
        }, answer === 'accept' ? '시작일로 기록했습니다.' : '제안을 무시했습니다. 다시 묻지 않습니다.');
      }
      case 'trackerUndoApplied':
        return act(async () => {
          await api('POST', `/chats/${chat}/trackers`, { action: 'undoApplied', aid: el.dataset.aid });
          world = null;
        }, '자동으로 적용한 시작일을 되돌렸습니다. 이 제안은 다시 적용하지 않습니다.');
      case 'scenePickOpen':
        scenePicker = scenePicker?.scene === id ? null : { scene: id, trackerId: '', label: '', p1: '', p2: '' };
        return render();
      case 'scenePickApply': {
        readScenePicker();
        const p = { ...scenePicker };
        const people = [p.p1, p.p2].map((x) => String(x || '').trim()).filter(Boolean);
        return act(async () => {
          await api('POST', `/chats/${chat}/trackers`, { action: 'fromScene', sceneId: id, id: p.trackerId, label: p.label, scope: people.length === 0 ? 'room' : people.length === 1 ? 'person' : 'pair', people });
          scenePicker = null;
          world = null;
        }, '이 장면의 날짜를 시작일로 기록했습니다.');
      }
      case 'keepAdd': {
        const name = (root.querySelector('#keepNewName')?.value || '').trim();
        const owner = (root.querySelector('#keepNewOwner')?.value || '').trim();
        if (!name) return;
        return act(async () => {
          await api('POST', `/chats/${chat}/keepsakes`, { action: 'add', name, owner });
          worldForm.keep = '';
          worldForm.keepOwner = '';
          world = null;
        }, '소중한 물건을 추가했습니다.');
      }
      case 'keepDelete':
        if (armed !== `keepDelete:${id}`) { armed = `keepDelete:${id}`; return render(); }
        armed = '';
        return act(async () => {
          await api('POST', `/chats/${chat}/keepsakes`, { action: 'delete', id });
          world = null;
        }, '소중한 물건을 지웠습니다.');
      case 'addressSave': {
        readAddressForm();
        const form = { ...addressForm };
        const body = form.id ? { action: 'edit', id: form.id, entry: form } : { action: 'add', entry: form };
        return act(async () => {
          await api('POST', `/chats/${chat}/address`, body);
          addressForm = { id: '', from: '', to: '', term: '', note: '' };
          names = null;
        }, form.id ? '호칭을 고쳤습니다.' : '호칭을 추가했습니다.');
      }
      case 'addressEdit': {
        const e = (names?.address?.entries || []).find((x) => x.id === id);
        if (!e) return;
        addressForm = { id: e.id, from: e.from, to: e.to, term: e.term, note: e.note || '' };
        return render();
      }
      case 'addressSplit':
        return act(async () => {
          await api('POST', `/chats/${chat}/address`, { action: 'split', id });
          names = null;
        }, '둘을 따로 보도록 했습니다.');
      case 'addressCancel':
        addressForm = { id: '', from: '', to: '', term: '', note: '' };
        return render();
      case 'addressDelete':
        if (armed !== `addressDelete:${id}`) { armed = `addressDelete:${id}`; return render(); }
        armed = '';
        return act(async () => {
          await api('POST', `/chats/${chat}/address`, { action: 'delete', id });
          if (addressForm.id === id) addressForm = { id: '', from: '', to: '', term: '', note: '' };
          names = null;
        }, '호칭을 지웠습니다.');
      case 'suggestAccept':
      case 'suggestIgnore': {
        const accept = actName === 'suggestAccept';
        return act(async () => {
          await api('POST', `/chats/${chat}/address/suggestion/${encodeURIComponent(id)}`, { action: accept ? 'accept' : 'ignore' });
          names = null;
        }, accept ? '제안을 받아들였습니다.' : '제안을 무시했습니다. 다시 묻지 않습니다.');
      }
      case 'suggestUndo':
        return act(async () => {
          await api('POST', `/chats/${chat}/address/applied/${encodeURIComponent(id)}/undo`);
          names = null;
        }, '자동으로 적용한 것을 되돌렸습니다. 이 제안은 다시 적용하지 않습니다.');
      case 'nameCancel':
        namePreview = null;
        armed = '';
        return render();
      case 'nameDismiss':
        return act(async () => {
          await api('POST', `/chats/${chat}/names/dismiss`, { source: el.dataset.source, target: el.dataset.target });
          names = null;
        }, '다른 사람으로 두었습니다. 다시 묻지 않습니다.');
      case 'nameUndo':
        if (armed !== 'nameUndo') { armed = 'nameUndo'; return render(); }
        armed = '';
        return act(async () => {
          const r = await api('POST', `/chats/${chat}/names/undo`);
          names = null;
          notice = `${r.source} → ${r.target} 바꾸기를 되돌렸습니다.${r.kept ? ` 그 뒤에 다시 고친 ${r.kept}곳은 그대로 두었습니다.` : ''}`;
        });
      case 'addRoutine': {
        const row = el.closest('.routine-row');
        const who = root.querySelector('.routine-new [data-f="who"]').value.trim();
        return act(() => api('POST', `/chats/${chat}/routine`, { action: 'add', item: { ...readRoutineRow(row), who } }), '생활 기록을 추가했습니다.');
      }
      case 'saveRoutine': {
        const row = el.closest('.routine-row');
        const old = (info.routineItems || []).find((r) => r.key === row.dataset.rkey);
        return act(() => api('POST', `/chats/${chat}/routine`, { action: 'edit', key: row.dataset.rkey, item: { ...readRoutineRow(row), who: old?.who } }), '생활 기록을 고쳤습니다.');
      }
      case 'deleteRoutine': {
        const key = el.closest('.routine-row').dataset.rkey;
        if (armed !== `routine:${key}`) {
          armed = `routine:${key}`;
          return render();
        }
        armed = '';
        return act(() => api('POST', `/chats/${chat}/routine`, { action: 'delete', key }), '생활 기록을 지웠습니다.');
      }
      case 'recallMark':
        return act(() => api('POST', `/chats/${chat}/recall-prefs`, { id, action: el.dataset.mark }), el.dataset.mark === 'pin' ? '중요 표시를 바꿨습니다.' : '빼기 표시를 바꿨습니다.');
      case 'recallTest': {
        recallTestText = root.querySelector('#recallTestText').value;
        return act(async () => {
          recallTest = await api('POST', `/chats/${chat}/recall-test`, { text: recallTestText });
        }, '회상 시험을 마쳤습니다.');
      }
      // Every save reads its form first: act() draws the screen again before it runs, and the form goes with it.
      case 'saveArc': {
        const ed = root.querySelector('#arcEditor');
        const fixes = koreanEditsIn(ed);
        const body = { title: ed.querySelector('#aTitle').value, summary: ed.querySelector('#aSummary').value, turns: ed.querySelector('#aTurns').value.split('\n'), keep: ed.querySelector('#aKeep').value.split('\n') };
        const aid = ed.dataset.id;
        return act(async () => api('PATCH', `/chats/${chat}/arcs/${encodeURIComponent(aid)}`, await applyKoreanEdits(fixes, body)), '큰 흐름을 저장했습니다.');
      }
      case 'saveChapter': {
        const ed = root.querySelector('#chapterEditor');
        const fixes = koreanEditsIn(ed);
        const body = { title: ed.querySelector('#cTitle').value, summary: ed.querySelector('#cSummary').value, turns: ed.querySelector('#cTurns').value.split('\n'), keep: ed.querySelector('#cKeep').value.split('\n') };
        const cid = ed.dataset.id;
        return act(async () => api('PATCH', `/chats/${chat}/chapters/${encodeURIComponent(cid)}`, await applyKoreanEdits(fixes, body)), '챕터를 저장했습니다.');
      }
      case 'saveScene': {
        const fixes = koreanEditsIn(root.querySelector('#sceneEditor'));
        const { id: sid, body } = readScene();
        return act(async () => api('PATCH', `/chats/${chat}/scenes/${encodeURIComponent(sid)}`, await applyKoreanEdits(fixes, body)), '장면을 저장했습니다.');
      }
      case 'saveFact': {
        const row = root.querySelector(`[data-fact="${CSS.escape(id)}"]`);
        const unaware = row.querySelector('[data-f="unaware"]');
        const guess = row.querySelector('[data-f="guess"]');
        const knownBy = row.querySelector('[data-f="knownBy"]');
        const fixes = koreanEditsIn(row);
        const body = { text: row.querySelector('textarea').value, ...(unaware ? { unaware: unaware.value, guess: guess.value } : {}), ...(knownBy ? { knownBy: knownBy.value } : {}) };
        return act(async () => api('PATCH', `/chats/${chat}/facts/${encodeURIComponent(id)}`, await applyKoreanEdits(fixes, body)), '사실을 저장했습니다.');
      }
      case 'deleteFact':
        if (armed !== `fact:${id}`) {
          armed = `fact:${id}`;
          return render();
        }
        armed = '';
        return act(() => api('DELETE', `/chats/${chat}/facts/${encodeURIComponent(id)}`), '사실을 삭제했습니다.');
      case 'editThread': {
        const box = root.querySelector(`[data-thread="${CSS.escape(id)}"]`);
        const fixes = koreanEditsIn(box);
        const body = {};
        for (const f of ['title', 'detail', 'need', 'unaware', 'guess', 'dueDate', 'dueTime']) {
          const el = box?.querySelector(`[data-f="${f}"]`);
          if (el) body[f] = el.value;
        }
        return act(async () => api('POST', `/chats/${chat}/threads/${encodeURIComponent(id)}/edit`, await applyKoreanEdits(fixes, body)), `${id} 항목을 저장했습니다.`);
      }
      case 'reopen':
        return act(() => api('POST', `/chats/${chat}/threads/${encodeURIComponent(id)}/reopen`), `${id} 항목을 다시 열었습니다.`);
      case 'closeThread':
        if (armed !== `close:${id}`) {
          armed = `close:${id}`;
          return render();
        }
        armed = '';
        return act(() => api('POST', `/chats/${chat}/threads/${encodeURIComponent(id)}/close`, { how: '직접 닫음' }), `${id} 항목을 닫았습니다.`);
      case 'saveEmbedding': {
        const model = root.querySelector('#setEmbedding')?.value.trim() || '';
        const mode = root.querySelector('#setEmbedMode')?.value || 'connection';
        return act(async () => {
          const r = await api('POST', '/settings/embedding', { mode, model });
          const st = await api('GET', '/status');
          serverSettings = st.settings;
          serverEmbedding = st.embedding || null;
          if (mode !== 'off' && info?.enabled) await api('POST', `/chats/${chat}/start`, {}).catch(() => {});
          notice = mode === 'off' ? '뜻으로 찾기를 껐습니다.' : `임베딩을 연결했습니다: ${r.model} (${r.dimensions}차원). 새로 만들 색인이 있으면 이어서 만듭니다.`;
        });
      }
      case 'saveLanguage': {
        const memoryLanguage = root.querySelector('#setMemLang')?.value || 'auto';
        const writeLanguage = root.querySelector('#setWriteLang')?.value || 'auto';
        const writeChanged = writeLanguage !== (['ko', 'en', 'zh'].includes(serverSettings?.writeLanguage) ? serverSettings.writeLanguage : 'auto');
        const translateConnection = root.querySelector('#setTrConn')?.value || '';
        const translateQuotes = Boolean(root.querySelector('#setTrQuotes')?.checked);
        const autoTranslate = Boolean(root.querySelector('#setAutoTr')?.checked);
        return act(async () => {
          await api('POST', '/settings/language', { memoryLanguage, writeLanguage, translateConnection, translateQuotes, autoTranslate });
          serverSettings = (await api('GET', '/status')).settings;
          if (room) info = await api('GET', `/chats/${encodeURIComponent(room)}`).catch(() => info);
        }, writeChanged && (writeLanguage === 'en' || writeLanguage === 'zh' || writeLanguage === 'ko')
          ? `기억 언어를 저장했습니다. 새 기억부터 ${({ zh: '중국어', en: '영어', ko: '한국어' })[writeLanguage]}로 정리합니다. 이미 정리된 기억은 넣을 때 번역합니다(전부 그 언어로 저장하려면 한눈에 → 처음부터 다시 정리).`
          : writeChanged
            ? '기억 언어를 저장했습니다. 새 기억부터 채팅 언어로 정리합니다.'
            : memoryLanguage === 'auto' ? '기억 언어를 저장했습니다.' : '기억 언어를 저장했습니다. 다시 정리할 필요 없이, 이 방의 기억을 바로 번역해 둡니다.');
      }
      case 'routineOnHere': {
        if (!room) throw Error('현재 채팅방을 먼저 선택해 주세요.');
        // With the default on, following it is enough; otherwise this room is turned on by itself.
        const mode = serverSettings?.routine === false ? 'on' : 'default';
        return act(() => api('POST', `/chats/${encodeURIComponent(room)}/routine-mode`, { mode }), '이 방에서 최근 생활 기록을 켰습니다. 새 메시지부터 이어서 기록합니다.');
      }
      case 'saveOrganizePreferences': {
        const npcCoverage = root.querySelector('#setNpcCoverage')?.value, quoteMode = root.querySelector('#setQuoteMode')?.value, detailLevel = root.querySelector('#setDetailLevel')?.value;
        if (!room) throw Error('현재 채팅방을 먼저 선택해 주세요.');
        return act(async () => { await api('POST', `/chats/${encodeURIComponent(room)}/organize-preferences`, { npcCoverage, quoteMode, detailLevel }); }, '정리 방식을 저장했습니다. 새로 정리할 내용부터 적용됩니다.');
      }
      case 'saveSettings': {
        // Read every choice before act() redraws the page (a redraw puts the saved values back in the form).
        const connection = root.querySelector('#setConnection')?.value;
        const recall = root.querySelector('#setRecall')?.value;
        const amount = root.querySelector('#setRecallAmount')?.value;
        const length = root.querySelector('#setChapterLength')?.value;
        const style = root.querySelector('#setRecallStyle')?.value;
        const attribution = root.querySelector('#setAttributionCheck')?.value;
        // Only send changed settings. These endpoints update shared server settings,
        // so keep writes sequential and refresh their authoritative values afterward.
        const changes = [];
        if (connection && connection !== (serverSettings?.connection || '')) changes.push(['/settings', { connection }]);
        if (recall && recall !== (serverSettings?.recall || 'model')) changes.push(['/settings/recall', { mode: recall }]);
        if (amount && amount !== (serverSettings?.recallAmount || 'normal')) changes.push(['/settings/recall-amount', { amount }]);
        if (length && length !== (serverSettings?.chapterLength || 'normal')) changes.push(['/settings/chapter-length', { length }]);
        if (style && style !== (serverSettings?.recallStyle || 'natural')) changes.push(['/settings/recall-style', { style }]);
        if (attribution && attribution !== (serverSettings?.attributionCheck || 'default')) changes.push(['/settings/attribution-check', { mode: attribution }]);
        if (!changes.length) {
          notice = '변경된 설정이 없습니다.';
          return render();
        }
        return act(async () => {
          for (const [path, body] of changes) await api('POST', path, body);
          serverSettings = (await api('GET', '/status')).settings;
        }, '설정을 저장했습니다.', { reload: false });
      }
      default:
    }
  }

  function embedMode() {
    const e = serverSettings?.embedding;
    if (e === null) return 'off';
    return e?.model ? 'manual' : 'connection';
  }

  async function openSettings() {
    try {
      const [status, list, gone] = await Promise.all([api('GET', '/status'), api('GET', '/api/connections').catch(() => []), api('GET', '/orphans').catch(() => null)]);
      orphans = gone?.orphans || null;
      serverSettings = status.settings;
      serverEmbedding = status.embedding || null;
      connections = (Array.isArray(list) ? list : list?.connections || []).map((c) => ({ id: c.id, name: c.name, model: c.model }));
    } catch (error) {
      lastError = error.message;
    }
    render();
  }

  // A paper ticket with stamp edges: the launcher icon. No ids inside, so drawer extensions can copy it as is.
  const LAUNCH_ICON = `<svg class="launch-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4 11L4.75 11A2.05 2.05 0 0 0 8.85 11L10.35 11A2.05 2.05 0 0 0 14.45 11L15.95 11A2.05 2.05 0 0 0 20.05 11L21.55 11A2.05 2.05 0 0 0 25.65 11L27.15 11A2.05 2.05 0 0 0 31.25 11L32.75 11A2.05 2.05 0 0 0 36.85 11L38.35 11A2.05 2.05 0 0 0 42.45 11L43.95 11A2.05 2.05 0 0 0 48.05 11L49.55 11A2.05 2.05 0 0 0 53.65 11L55.15 11A2.05 2.05 0 0 0 59.25 11L60 11L60 11.57A2.05 2.05 0 0 0 60 15.68L60 16.82A2.05 2.05 0 0 0 60 20.93L60 22.07A2.05 2.05 0 0 0 60 26.18L60 27.32A2.05 2.05 0 0 0 60 31.43L60 32.58A2.05 2.05 0 0 0 60 36.67L60 37.83A2.05 2.05 0 0 0 60 41.92L60 43.08A2.05 2.05 0 0 0 60 47.17L60 48.33A2.05 2.05 0 0 0 60 52.42L60 53L59.25 53A2.05 2.05 0 0 0 55.15 53L53.65 53A2.05 2.05 0 0 0 49.55 53L48.05 53A2.05 2.05 0 0 0 43.95 53L42.45 53A2.05 2.05 0 0 0 38.35 53L36.85 53A2.05 2.05 0 0 0 32.75 53L31.25 53A2.05 2.05 0 0 0 27.15 53L25.65 53A2.05 2.05 0 0 0 21.55 53L20.05 53A2.05 2.05 0 0 0 15.95 53L14.45 53A2.05 2.05 0 0 0 10.35 53L8.85 53A2.05 2.05 0 0 0 4.75 53L4 53L4 52.42A2.05 2.05 0 0 0 4 48.33L4 47.17A2.05 2.05 0 0 0 4 43.08L4 41.92A2.05 2.05 0 0 0 4 37.83L4 36.67A2.05 2.05 0 0 0 4 32.58L4 31.43A2.05 2.05 0 0 0 4 27.32L4 26.18A2.05 2.05 0 0 0 4 22.07L4 20.93A2.05 2.05 0 0 0 4 16.82L4 15.68A2.05 2.05 0 0 0 4 11.57Z" fill="#f1eee7" stroke="#0000002e" stroke-width=".5"/><rect x="9" y="15.5" width="46" height="33" fill="none" stroke="#141414" stroke-width=".9"/><line x1="43.5" y1="16.5" x2="43.5" y2="47.5" stroke="#141414" stroke-width=".9" stroke-dasharray="1.6 1.6"/><text x="26.2" y="30.3" font-family="Georgia,'Times New Roman',serif" font-weight="700" font-size="6" text-anchor="middle" fill="#141414" letter-spacing=".25">MEMORY</text><text x="26.2" y="38.6" font-family="ui-monospace,Menlo,monospace" font-size="3.4" text-anchor="middle" fill="#141414" letter-spacing=".2">ADMIT ONE</text><path d="M49.3 27.7C49.815999999999995 31.484 49.815999999999995 31.484 53.599999999999994 32C49.815999999999995 32.516 49.815999999999995 32.516 49.3 36.3C48.784 32.516 48.784 32.516 45 32C48.784 31.484 48.784 31.484 49.3 27.7Z" fill="#141414"/></svg>`;
  /*
   * The launcher's look. It sits in the page itself (not in the shadow root), so it carries its own small style
   * sheet, keyed to its id. Nothing here is !important: a drawer extension can restyle, hide or move it.
   */
  const LAUNCHER_CSS = `
#memory-module-launcher{position:fixed;right:18px;bottom:122px;z-index:2147483647;width:64px;height:64px;padding:0;margin:0;border:0;border-radius:0;
  background:transparent;box-shadow:none;color:inherit;line-height:0;display:grid;place-items:center;cursor:grab;touch-action:none;
  user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;
  filter:drop-shadow(0 3px 6px #00000038);transition:transform .15s,filter .15s}
#memory-module-launcher:hover{background:transparent;transform:translateY(-2px) rotate(-3deg);filter:drop-shadow(0 6px 9px #00000050)}
#memory-module-launcher:active{background:transparent;transform:scale(.95)}
#memory-module-launcher.dragging{cursor:grabbing;transform:rotate(-5deg) scale(1.06);filter:drop-shadow(0 10px 14px #00000060);transition:none}
#memory-module-launcher:focus-visible{outline:3px solid #aaa7e5;outline-offset:3px}
#memory-module-launcher[data-theme=dark]{filter:drop-shadow(0 3px 7px #000000a0)}
#memory-module-launcher .launch-icon{width:100%;height:100%;display:block;pointer-events:none}
@media(max-width:720px){#memory-module-launcher{width:58px;height:58px}}
`;
  const LAUNCH_POS_KEY = 'memory-module-launch-pos';

  /** The launcher can be dragged anywhere; its spot is kept as a share of the screen so it survives resizing. */
  function placeLaunch(launch, pos) {
    if (!pos || launch.dataset.exdHidden !== undefined) return; // hidden in another extension's drawer: leave it be
    const w = launch.offsetWidth || 50;
    const h = launch.offsetHeight || 50;
    const x = Math.min(Math.max(pos.x * innerWidth - w / 2, 6), innerWidth - w - 6);
    const y = Math.min(Math.max(pos.y * innerHeight - h / 2, 6), innerHeight - h - 6);
    launch.style.left = `${Math.round(x)}px`;
    launch.style.top = `${Math.round(y)}px`;
    launch.style.right = 'auto';
    launch.style.bottom = 'auto';
  }

  function makeDraggable(launch) {
    let pos = null;
    try {
      pos = JSON.parse(localStorage.getItem(LAUNCH_POS_KEY) || 'null');
    } catch {}
    if (pos && !(pos.x >= 0 && pos.x <= 1 && pos.y >= 0 && pos.y <= 1)) pos = null;
    placeLaunch(launch, pos);
    let drag = null;
    let moved = false;
    launch.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !e.isTrusted) return; // a click passed on by a drawer extension is just a click
      const r = launch.getBoundingClientRect();
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top };
      moved = false;
      try {
        launch.setPointerCapture(e.pointerId);
      } catch {}
    });
    launch.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
      if (!moved) {
        moved = true;
        launch.classList.add('dragging');
      }
      const w = launch.offsetWidth;
      const h = launch.offsetHeight;
      pos = { x: (e.clientX - drag.dx + w / 2) / innerWidth, y: (e.clientY - drag.dy + h / 2) / innerHeight };
      placeLaunch(launch, pos);
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      launch.classList.remove('dragging');
      if (moved) {
        try {
          localStorage.setItem(LAUNCH_POS_KEY, JSON.stringify(pos));
        } catch {}
      }
    };
    launch.addEventListener('pointerup', end);
    launch.addEventListener('pointercancel', end);
    // A drag must not also open the library.
    launch.addEventListener('click', (e) => {
      if (moved) {
        moved = false;
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, true);
    addEventListener('resize', () => placeLaunch(launch, pos));
    launch.addEventListener('dblclick', () => {
      pos = null;
      try {
        localStorage.removeItem(LAUNCH_POS_KEY);
      } catch {}
      for (const k of ['left', 'top', 'right', 'bottom']) launch.style.removeProperty(k);
    });
  }

  // ----- Moving and resizing the panel (desktop only; below 720px the panel is full screen) -----
  const PANEL_GEO_KEY = 'memory-module-panel-geometry';
  const PANEL_MIN_W = 520;
  const PANEL_MIN_H = 360;
  const PANEL_NARROW = 720;
  const PANEL_COMPACT_W = 900;

  /**
   * Keeps a saved {x,y,w,h} fully inside the viewport (min size, never bigger than the viewport).
   * Null (use the default full layout) when the geometry is unusable or the viewport is smaller than the minimum size.
   */
  function clampPanelGeometry(g, vw, vh) {
    if (!g || ![g.x, g.y, g.w, g.h].every(Number.isFinite) || !(g.w > 0) || !(g.h > 0)) return null;
    if (!Number.isFinite(vw) || !Number.isFinite(vh) || vw < PANEL_MIN_W || vh < PANEL_MIN_H) return null;
    const w = Math.round(Math.min(vw, Math.max(PANEL_MIN_W, g.w)));
    const h = Math.round(Math.min(vh, Math.max(PANEL_MIN_H, g.h)));
    return { x: Math.round(Math.min(Math.max(0, g.x), vw - w)), y: Math.round(Math.min(Math.max(0, g.y), vh - h)), w, h };
  }

  let panelGeo = null;
  function panelViewport() {
    return { vw: window.innerWidth || document.documentElement?.clientWidth || 0, vh: window.innerHeight || document.documentElement?.clientHeight || 0 };
  }
  function panelIsFree() {
    return panelViewport().vw > PANEL_NARROW; // full-screen layout on small screens: nothing to move or resize
  }
  function loadPanelGeometry() {
    try {
      const g = JSON.parse(localStorage.getItem(PANEL_GEO_KEY) || 'null');
      panelGeo = g && typeof g === 'object' ? { x: Number(g.x), y: Number(g.y), w: Number(g.w), h: Number(g.h) } : null;
    } catch {
      panelGeo = null;
    }
  }
  function savePanelGeometry() {
    try {
      localStorage.setItem(PANEL_GEO_KEY, JSON.stringify(panelGeo));
    } catch {}
  }
  /** Puts the saved position and size on the panel, or the default centered layout back. */
  function applyPanelGeometry() {
    const panel = root?.querySelector('#panel');
    if (!panel) return;
    const { vw, vh } = panelViewport();
    const g = panelIsFree() ? clampPanelGeometry(panelGeo, vw, vh) : null;
    if (g) {
      // CSS min()/clamp() keep the panel on screen even before the next resize event arrives (stale inline values never leave it off-screen).
      const w = `min(${g.w}px, 100vw)`;
      const h = `min(${g.h}px, 100vh)`;
      Object.assign(panel.style, { left: `clamp(0px, ${g.x}px, calc(100vw - ${w}))`, top: `clamp(0px, ${g.y}px, calc(100vh - ${h}))`, width: w, height: h, transform: 'none' });
    } else {
      for (const k of ['left', 'top', 'width', 'height', 'transform']) panel.style.removeProperty(k);
    }
    const width = g ? g.w : panel.getBoundingClientRect?.().width || vw;
    if (g) panel.setAttribute('data-compact', width < PANEL_COMPACT_W ? 'true' : 'false');
    else panel.removeAttribute?.('data-compact');
  }
  function resetPanelGeometry() {
    panelGeo = null;
    try {
      localStorage.removeItem(PANEL_GEO_KEY);
    } catch {}
    applyPanelGeometry();
  }

  function setupPanelMove() {
    const panel = root.querySelector('#panel');
    loadPanelGeometry();
    let op = null;
    const begin = (mode) => (e) => {
      if (e.button !== 0 || !panelIsFree()) return;
      if (mode === 'move' && e.target.closest?.('button,select,input,textarea,a,label,summary,.room-menu')) return;
      const r = panel.getBoundingClientRect();
      op = { mode, id: e.pointerId, sx: e.clientX, sy: e.clientY, g: { x: r.left, y: r.top, w: r.width, h: r.height }, el: e.currentTarget };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      if (mode === 'move') e.preventDefault();
    };
    const move = (e) => {
      if (!op || e.pointerId !== op.id) return;
      const dx = e.clientX - op.sx;
      const dy = e.clientY - op.sy;
      const g = { ...op.g };
      if (op.mode === 'move') {
        g.x += dx;
        g.y += dy;
      } else {
        if (op.mode !== 'resize-b') g.w += dx;
        if (op.mode !== 'resize-r') g.h += dy;
      }
      const { vw, vh } = panelViewport();
      // While resizing the top-left corner stays put, so the size may not push the panel past the viewport.
      if (op.mode !== 'move') {
        g.w = Math.min(g.w, vw - g.x);
        g.h = Math.min(g.h, vh - g.y);
      }
      panelGeo = clampPanelGeometry(g, vw, vh);
      applyPanelGeometry();
    };
    const end = (e) => {
      if (!op || e.pointerId !== op.id) return;
      try {
        op.el.releasePointerCapture?.(op.id);
      } catch {}
      op = null;
      if (panelGeo) savePanelGeometry();
    };
    const bind = (el, mode) => {
      if (!el) return;
      el.addEventListener('pointerdown', begin(mode));
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    };
    bind(root.querySelector('.topbar'), 'move');
    bind(root.querySelector('#resizeCorner'), 'resize');
    bind(root.querySelector('#resizeRight'), 'resize-r');
    bind(root.querySelector('#resizeBottom'), 'resize-b');
    const refit = () => {
      if (open) applyPanelGeometry();
    };
    addEventListener('resize', refit);
    addEventListener('orientationchange', refit);
    window.visualViewport?.addEventListener('resize', refit);
  }

  let launcher = null;
  let onPageKey = null;

  /** The launcher: a plain button right under <body> (outside the shadow root), marked for drawer extensions. */
  function makeLauncher() {
    document.getElementById('memory-module-launcher')?.remove();
    if (!document.getElementById('memory-module-launcher-style')) {
      const style = document.createElement('style');
      style.id = 'memory-module-launcher-style';
      style.textContent = LAUNCHER_CSS;
      (document.head || document.documentElement).append(style);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'memory-module-launcher';
    button.setAttribute('data-drawer-launcher', '');
    button.setAttribute('aria-label', '기억 서재 열기');
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    button.title = '기억 서재 (끌어서 옮길 수 있습니다 · 두 번 누르면 제자리)';
    button.innerHTML = LAUNCH_ICON;
    (document.body || document.documentElement).append(button);
    return button;
  }

  function openLibrary() {
    if (open || disposed) return;
    open = true;
    const current = activeChatId();
    if (current && current !== room) {
      room = current;
      store = null;
      storeRoom = '';
      trMap = {};
      trPending = 0;
      searchDraft = searchQuery = '';
      recallTest = null;
    }
    void act(refresh, null, { reload: false });
    if (tab === 'settings') void openSettings();
    render();
    applyPanelGeometry();
    launcher?.setAttribute('aria-expanded', 'true');
  }

  function closeLibrary() {
    if (!open) return;
    open = false;
    clearTimeout(pollTimer);
    render();
    launcher?.setAttribute('aria-expanded', 'false');
    // Back to the button that opened it, unless it sits hidden in a drawer.
    if (launcher && launcher.offsetParent !== null && root?.activeElement) launcher.focus({ preventScroll: true });
  }

  let selectedButton = null, selectionTimer = null, selectedPending = null;
  function selectionChanged() {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => {
      if (!selectedButton || disposed || open || busy) { if(selectedButton) selectedButton.hidden = true; return; }
      const sel = window.getSelection?.();
      if (!sel || sel.isCollapsed || sel.rangeCount !== 1 || !activeChatId()) { selectedButton.hidden = true; return; }
      const range = sel.getRangeAt(0), element = n => n?.nodeType === 1 ? n : n?.parentElement;
      const first = element(range.startContainer)?.closest?.('[data-message-id]'), last = element(range.endContainer)?.closest?.('[data-message-id]');
      if (!first || !last) { selectedButton.hidden = true; return; }
      const parts = [];
      for (const node of document.querySelectorAll('[data-message-id]')) {
        if (!node.dataset.messageId || !range.intersectsNode(node)) continue;
        const r = range.cloneRange(); r.selectNodeContents(node);
        if (node === first) r.setStart(range.startContainer, range.startOffset);
        if (node === last) r.setEnd(range.endContainer, range.endOffset);
        const text = r.toString().trim(); if (text) parts.push({sourceId:node.dataset.messageId,text});
      }
      const boxes = range.getClientRects(), rect = boxes[boxes.length - 1];
      if (!rect || !parts.length || parts.length > 30 || parts.reduce((n,p) => n+p.text.length,0) > 50000) { selectedButton.hidden = true; return; }
      selectedPending = {chatId:activeChatId(),parts};
      selectedButton.style.left = Math.max(8,Math.min(window.innerWidth-150,rect.right-140))+'px';
      selectedButton.style.top = Math.max(8,rect.top-46)+'px'; selectedButton.hidden = false;
    }, 120);
  }
  function hideSelectedButton() { if (selectedButton) selectedButton.hidden = true; }
  function installSelectionButton() {
    selectedButton = document.createElement('button'); selectedButton.type='button'; selectedButton.textContent='기억으로 정리'; selectedButton.hidden=true;
    selectedButton.setAttribute('style','position:fixed;z-index:2147483647;pointer-events:auto;padding:9px 13px;border:1px solid #d4c9bc;border-radius:12px;background:#fffaf3;color:#423b37;font:600 13px sans-serif;box-shadow:0 4px 16px #0003;touch-action:manipulation');
    root.append(selectedButton);
    selectedButton.addEventListener('mousedown',e=>e.preventDefault()); selectedButton.addEventListener('touchstart',e=>e.preventDefault(),{passive:false});
    const save = e => { e.preventDefault();e.stopPropagation();const selected=selectedPending;selectedPending=null;hideSelectedButton();if(!selected || busy)return;
      if(activeChatId()!==selected.chatId){alert('채팅방이 바뀌었습니다. 다시 선택해 주세요.');return;}
      room=selected.chatId;store=null;storeRoom='';tab='home';open=true;render();
      void act(() => api('POST', `/chats/${encodeURIComponent(selected.chatId)}/selected-memory`, {parts:selected.parts}), '선택한 글을 기억으로 정리했습니다.');
    };
    selectedButton.addEventListener('click',save);selectedButton.addEventListener('touchend',save,{passive:false});
    document.addEventListener('selectionchange',selectionChanged);window.addEventListener?.('scroll',hideSelectedButton,true);
  }

  function install() {
    const element = document.createElement('div');
    element.id = 'memory-module-library';
    root = element.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${UI_CSS}${EXTRA_CSS}${THEME_CSS}</style>
      <div id="backdrop" hidden></div>
      <section id="panel" role="dialog" aria-label="기억 서재" aria-modal="true" hidden>
        <aside class="sidebar"><div class="brand"><span class="logo" aria-hidden="true"><i class="disc"></i><i class="sleeve"></i></span><div>기억 서재<small>MEMORY MODULE</small></div></div>
          <div class="nav-label">YOUR MEMORIES</div>
          <nav>${NAV.map(([id, label, i]) => `<button data-tab="${id}">${icon(i)}<span>${label}</span></button>`).join('')}</nav>
          <div class="side-bottom"><label class="room-switch"><span id="enabledLabel">이 방에서 사용 안 함</span><input id="roomEnabled" type="checkbox" role="switch" aria-label="이 방에서 기억 사용"></label>
            <button data-act="refresh">${icon('refresh')}서버에서 새로고침</button><small>기억 서재 · 기억 모듈판 v${VERSION}</small></div>
        </aside>
        <div class="workspace">
          <header class="topbar"><div class="crumb"><select id="roomSelect" aria-label="채팅방"></select></div>
            <button id="themeToggle" class="theme-toggle" aria-label="화면 밝기 바꾸기"></button>
            <button id="close" class="close" aria-label="기억 서재 닫기" title="닫기">${icon('close')}</button></header>
          <div id="status" role="status"></div><div id="error" hidden></div>
          <main id="content"></main>
        </div>
        <aside class="inspector" id="inspector"></aside>
        <div class="resize-edge resize-r" id="resizeRight" aria-hidden="true"></div><div class="resize-edge resize-b" id="resizeBottom" aria-hidden="true"></div><div class="resize-grip" id="resizeCorner" title="끌어서 크기 바꾸기" aria-hidden="true"></div>
      </section>`;
    element.setAttribute('style', 'position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;');
    (document.body || document.documentElement).append(element);
    root.host.setAttribute('data-theme', theme);
    launcher?.setAttribute('data-theme', theme);
    installSelectionButton();
    setupPanelMove();

    // Shadow DOM retargets input events to our DIV at the page boundary. Keep
    // host shortcuts from treating typing (notably '?') as a page command.
    // Do not preventDefault: text, IME, clipboard and native controls keep working.
    for (const type of ['keydown', 'keypress', 'keyup']) root.addEventListener(type, (e) => e.stopPropagation());
    root.addEventListener('input', (e) => {
      if (e.target.id === 'memorySearchInput') searchDraft = e.target.value;
      if (['nameSource', 'nameTarget', 'nameDisplay'].includes(e.target.id)) readNameForm();
      if (['addrFrom', 'addrTo', 'addrTerm', 'addrNote'].includes(e.target.id)) readAddressForm();
      if (e.target.id === 'stateNewName') worldForm.person = e.target.value;
      if (e.target.id === 'placeNewName') worldForm.place = e.target.value;
      if (e.target.id === 'keepNewName') worldForm.keep = e.target.value;
      if (e.target.id === 'keepNewOwner') worldForm.keepOwner = e.target.value;
      if (e.target.dataset?.tk) readTrackerForm();
      if (e.target.dataset?.sp) readScenePicker();
      if (e.target.id === 'attributionFilter') {
        attributionFilter = e.target.value;
        // Shown and hidden in place, so typing keeps the focus and the open sections.
        for (const el of root.querySelectorAll('[data-at]')) el.hidden = attributionHidden(el.dataset.at);
      }
    });
    root.addEventListener('submit', (e) => {
      if (e.target.id !== 'memorySearch') return;
      e.preventDefault();
      searchDraft = root.querySelector('#memorySearchInput').value;
      searchQuery = searchDraft.trim();
      render();
    });
    // The launcher lives outside the shadow root, as a plain button right under <body>, so drawer extensions and
    // page scripts can find it, move it and click it (click opens and closes; Esc closes).
    launcher = makeLauncher();
    makeDraggable(launcher);
    launcher.addEventListener('click', () => (open ? closeLibrary() : openLibrary()));
    // Esc closes the library, also when the focus is inside it (keys there are kept from the page).
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open && !e.isComposing) {
        e.preventDefault();
        closeLibrary();
      }
    });
    onPageKey = (e) => {
      if (e.key === 'Escape' && open && !e.isComposing && !e.defaultPrevented) closeLibrary();
    };
    document.addEventListener('keydown', onPageKey);
    // For drawer extensions and other scripts: open, close and toggle without hunting for the button.
    window.memoryModuleLibrary = { open: openLibrary, close: closeLibrary, toggle: () => (open ? closeLibrary() : openLibrary()), isOpen: () => open, launcher };
    window.dispatchEvent(new CustomEvent('memory-module:ready', { detail: { launcher } }));
    root.querySelector('#close').onclick = () => closeLibrary();
    root.querySelector('#backdrop').onclick = () => closeLibrary();
    root.querySelector('#themeToggle').onclick = () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('memory-module-theme', theme);
      } catch {}
      render();
    };
    root.querySelector('#roomSelect').onchange = (e) => {
      room = e.target.value;
      store = null;
      storeRoom = '';
      searchDraft = searchQuery = '';
      recallTest = null;
      selectedScene = '';
      void act(() => loadRoom(room), null, { reload: false });
    };
    root.querySelector('#roomEnabled').onchange = (e) => {
      const on = e.target.checked;
      void act(() => api('POST', `/chats/${encodeURIComponent(room)}/${on ? 'enable' : 'disable'}`), on ? '이 방에서 기억을 켰습니다. 처음 켜셨다면 ‘이어서 정리’를 눌러 주세요.' : '이 방의 기억 갱신을 껐습니다.');
    };
    root.addEventListener('change', (e) => {
      if (e.target.id === 'setRoomWriteLang') {
        const lang = e.target.value;
        const chat = room;
        return act(async () => {
          await api('POST', `/chats/${encodeURIComponent(chat)}/write-language`, { lang });
        }, lang === 'follow' ? '이 방은 모든 방 설정을 따릅니다.' : '이 방의 기억 정리 언어를 저장했습니다. 새로 정리되는 기억부터 적용됩니다.');
      }
      // The short forms offered for running text follow the chosen name.
      if (['nameSource', 'nameTarget', 'nameText'].includes(e.target.id)) {
        readNameForm();
        return render();
      }
      if (e.target.id === 'setFont') {
        font = e.target.value === 'own' ? 'own' : 'marinara';
        try {
          localStorage.setItem('memory-module-font', font);
        } catch {}
        return render();
      }
      if (e.target.id === 'setSpeakerNames') {
        const on = e.target.checked;
        void act(() => api('POST', `/chats/${encodeURIComponent(room)}/speaker-names`, { on }), on ? '대사 앞에 이름 표시를 켰습니다.' : '대사 앞에 이름 표시를 껐습니다.');
      }
      // The form's fields follow the type and the scope; the scene picker follows the chosen tracker.
      if (e.target.dataset?.tk && ['type', 'scope', 'unit'].includes(e.target.dataset.tk)) {
        readTrackerForm();
        return render();
      }
      if (e.target.dataset?.sp === 'trackerId') {
        readScenePicker();
        return render();
      }
      if (e.target.dataset?.tkStart) {
        const id = e.target.dataset.tkStart;
        const body = { action: 'editStart', id, from: e.target.dataset.from, to: e.target.value };
        void act(async () => {
          await api('POST', `/chats/${encodeURIComponent(room)}/trackers`, body);
          if (trackerDraft?.id === id) trackerDraft = null;
          world = null;
        }, '시작일을 고쳤습니다.');
      }
      if (e.target.dataset?.featureGlobal) {
        const key = e.target.dataset.featureGlobal;
        const on = e.target.checked;
        const label = (info?.features || []).find((f) => f.key === key)?.label || key;
        void act(async () => {
          await api('POST', '/settings/features', { key, on });
          serverSettings = (await api('GET', '/status')).settings;
        }, `${label} 모든 방 기본값을 ${on ? '켰습니다. 기본값을 따르는 방에 바로 적용됩니다.' : '껐습니다. 기본값을 따르는 방에서는 쓰지 않습니다(이미 있는 기록은 남아 있습니다).'}`);
      }
      if (e.target.dataset?.attributionRoom) {
        const mode = e.target.value;
        void act(() => api('POST', `/chats/${encodeURIComponent(room)}/attribution-check`, { mode }), '이 방의 대사 확인 방식을 저장했습니다. 다음 정리부터 적용됩니다.');
      }
      if (e.target.dataset?.featureRoom) {
        const key = e.target.dataset.featureRoom;
        const mode = e.target.value;
        const label = (info?.features || []).find((f) => f.key === key)?.label || key;
        void act(() => api('POST', `/chats/${encodeURIComponent(room)}/feature-mode`, { key, mode }), `이 방의 ${label} 설정을 저장했습니다.`);
      }
      if (e.target.dataset?.stateField) {
        const body = { action: 'set', name: e.target.dataset.stateName, field: e.target.dataset.stateField, value: e.target.value };
        void act(async () => {
          await api('POST', `/chats/${encodeURIComponent(room)}/state`, body);
          world = null;
        }, '고친 항목을 저장했습니다. 이 항목은 자동 기록이 덮어쓰지 않습니다.');
      }
      if (e.target.dataset?.placeField) {
        const field = e.target.dataset.placeField;
        const body = field === 'aliases' ? { action: 'aliases', id: e.target.dataset.placeId, value: e.target.value } : { action: 'set', id: e.target.dataset.placeId, field, value: e.target.value };
        void act(async () => {
          await api('POST', `/chats/${encodeURIComponent(room)}/places`, body);
          world = null;
        }, field === 'aliases' ? '다른 이름을 저장했습니다.' : '고친 항목을 저장했습니다. 이 항목은 자동 기록이 덮어쓰지 않습니다.');
      }
      if (e.target.dataset?.placeMerge) {
        const from = e.target.dataset.placeMerge;
        const into = e.target.value;
        if (!into) return;
        void act(async () => {
          await api('POST', `/chats/${encodeURIComponent(room)}/places`, { action: 'merge', id: from, into });
          world = null;
        }, '두 장소를 하나로 합쳤습니다. 합친 쪽 이름은 다른 이름으로 남습니다.');
      }
      if (e.target.dataset?.keepField) {
        const field = e.target.dataset.keepField;
        const id = e.target.dataset.keepId;
        const body = field === 'aliases' ? { action: 'aliases', id, value: e.target.value } : { action: 'set', id, field, value: e.target.value };
        void act(async () => {
          await api('POST', `/chats/${encodeURIComponent(room)}/keepsakes`, body);
          world = null;
        }, field === 'aliases' ? '다른 이름을 저장했습니다.' : '고친 항목을 저장했습니다. 이 항목은 자동 기록이 덮어쓰지 않습니다.');
      }
      if (e.target.dataset?.keepMerge) {
        const from = e.target.dataset.keepMerge;
        const into = e.target.value;
        if (!into) return;
        void act(async () => {
          await api('POST', `/chats/${encodeURIComponent(room)}/keepsakes`, { action: 'merge', id: from, into });
          world = null;
        }, '두 물건을 하나로 합쳤습니다. 합친 쪽 이름은 다른 이름으로 남습니다.');
      }
      if (e.target.dataset?.addressUse) {
        const id = e.target.dataset.addressUse;
        const on = e.target.checked;
        void act(async () => {
          await api('POST', `/chats/${encodeURIComponent(room)}/address`, { action: 'toggle', id, on });
          names = null;
        }, on ? '이 호칭을 대사 확인에 쓰도록 했습니다.' : '이 호칭을 대사 확인에 쓰지 않도록 했습니다.');
      }
      if (e.target.id === 'setBackupVectors') {
        backupVectors = e.target.checked;
        return render();
      }
      if (e.target.id === 'restoreCross') {
        if (restorePreview) restorePreview.cross = e.target.checked;
        armed = '';
        return render();
      }
      if (e.target.id === 'restoreFile') {
        const file = e.target.files?.[0];
        const from = room;
        e.target.value = '';
        if (!file) return;
        armed = '';
        void act(async () => {
          restorePreview = null;
          if (file.size > 50 * 1024 * 1024) throw Error('백업 파일이 너무 큽니다(최대 50MB).');
          let doc;
          try {
            doc = JSON.parse(await file.text());
          } catch {
            throw Error('백업 파일을 읽지 못했습니다. 기억 서재에서 내려받은 .json 파일인지 확인해 주세요.');
          }
          const data = await api('POST', `/chats/${encodeURIComponent(from)}/restore/preview`, { backup: doc });
          restorePreview = { room: from, doc, data, cross: false };
        }, '백업을 확인했습니다. 아래 내용을 보시고 불러올지 정해 주세요.', { reload: false });
      }
      if (e.target.id === 'setTags') {
        const on = e.target.checked;
        void act(() => api('POST', `/chats/${encodeURIComponent(room)}/speaker-tags`, { on }), on ? '말풍선 태그 되살리기를 켰습니다.' : '말풍선 태그 되살리기를 껐습니다.');
      }
    });
    root.addEventListener('click', (e) => {
      const link = e.target.closest('a.record-link');
      if (link) {
        e.preventDefault();
        armed = '';
        if (link.dataset.gotoScene) {
          selectedScene = link.dataset.gotoScene;
          selectedGroup = null;
          tab = 'scenes';
          root.querySelector('#content').scrollTop = 0;
        } else if (link.dataset.gotoChapter) {
          selectedGroup = link.dataset.gotoChapter;
          selectedScene = selectedArc = '';
          tab = 'scenes';
          root.querySelector('#content').scrollTop = 0;
        } else if (link.dataset.gotoArc) {
          selectedArc = link.dataset.gotoArc;
          tab = 'scenes';
          root.querySelector('#content').scrollTop = 0;
        } else if (link.dataset.gotoThread) {
          tab = 'ledger';
          focus = { kind: 'thread', id: link.dataset.gotoThread };
        } else if (link.dataset.gotoFact) {
          tab = 'facts';
          focus = { kind: 'fact', id: link.dataset.gotoFact };
        }
        void ensureScenes();
        return render();
      }
      const n = e.target.closest('button');
      if (n?.dataset.act === 'clearSearch') {
        searchDraft = searchQuery = '';
        render();
        root.querySelector('#memorySearchInput')?.focus();
        return;
      }
      if (!n || busy) return;
      if (n.dataset.tab) {
        tab = n.dataset.tab;
        armed = '';
        if (tab === 'settings') void openSettings();
        void ensureScenes();
        void ensureNames();
        void ensureWorld();
        void ensureConflicts();
        void ensureRecallReport();
        return render();
      }
      if (n.dataset.group !== undefined) {
        selectedGroup = n.dataset.group;
        selectedScene = '';
        selectedArc = '';
        return render();
      }
      if (n.dataset.arc !== undefined) {
        selectedArc = selectedArc === n.dataset.arc ? '' : n.dataset.arc;
        return render();
      }
      if (n.dataset.scene) {
        selectedScene = n.dataset.scene;
        if (n.dataset.goto) tab = 'scenes';
        return render();
      }
      if (n.dataset.act) void handle(n.dataset.act, n);
    });
    root.addEventListener('toggle', (e) => {
      const key = e.target?.dataset?.list;
      if (key) e.target.open ? openLists.add(key) : openLists.delete(key);
      if (key === 'attrlog' && e.target.open) ensureLazyParts();
    }, true);
    // The settings switch for the room mirrors the sidebar one.
    root.addEventListener('change', (e) => {
      if (e.target.id === 'setEnabled') {
        const side = root.querySelector('#roomEnabled');
        side.checked = e.target.checked;
        side.onchange({ target: side });
      }
    });
  }

  const EXTRA_CSS = `
    .memory-search{margin-bottom:18px}.memory-search input{flex:1;min-width:120px}.memory-search .buttons{flex-wrap:wrap}
    #launch{position:fixed;right:18px;bottom:122px;width:64px;height:64px;padding:0;border:0;border-radius:0;place-items:center;color:inherit;
      background:transparent!important;box-shadow:none!important;filter:drop-shadow(0 3px 5px #00000040);transition:transform .18s,filter .18s}
    #launch:not(:disabled):hover{background:transparent;transform:translateY(-2px) rotate(-3deg);filter:drop-shadow(0 6px 9px #00000050)}
    #launch:not(:disabled):active{background:transparent;transform:scale(.95)}
    #launch.dragging{transform:rotate(-5deg) scale(1.06);filter:drop-shadow(0 10px 14px #00000060)}
    #launch .launch-icon{width:64px;height:64px;display:block}
    :host([data-theme=dark]) #launch,:host([data-theme=dark]) #launch:not(:disabled):hover{background:transparent;filter:drop-shadow(0 3px 7px #000000a0)}
    #roomSelect{max-width:min(360px,100%);font-size:12px;padding:7px 10px;border-radius:10px}
    .fact-row{border-top:1px solid var(--im-line);padding:10px 0}.fact-row:first-of-type{border-top:0}.fact-row label{margin:0 0 6px}
    .fact-row textarea{min-height:64px}
    #eventEditor article,#recEditor article{background:var(--im-field);padding:14px;border:1px solid var(--im-line);border-radius:12px;margin:12px 0}
    .metric-row{flex-wrap:wrap}.metric{min-width:120px}
    pre{max-height:none}
    @media(max-width:720px){.metric{min-width:calc(50% - 6px)}#launch{width:58px;height:58px}#launch .launch-icon{width:58px;height:58px}}
  `;

  function cleanup() {
    disposed = true;
    clearTimeout(selectionTimer);document.removeEventListener('selectionchange', selectionChanged);window.removeEventListener?.('scroll',hideSelectedButton,true);selectedButton?.remove();
    clearTimeout(pollTimer);
    root?.host?.remove();
    launcher?.remove();
    document.getElementById('memory-module-launcher-style')?.remove();
    if (onPageKey) document.removeEventListener('keydown', onPageKey);
    if (window.memoryModuleLibrary?.launcher === launcher) delete window.memoryModuleLibrary;
  }

  install();
  host.onCleanup?.(cleanup);
})();




