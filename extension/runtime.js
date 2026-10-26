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
    ['facts', '알게 된 사실', 'person'],
    ['ledger', '아직 끝나지 않은 일', 'note'],
    ['life', '최근 생활', 'clock'],
    ['inject', '주입 확인', 'search'],
    ['settings', '설정', 'settings'],
  ];
  const KIND = { emotion: '감정', state: '상태', promise: '약속', secret: '비밀', pending: '미해결' };
  const KIND_ORDER = ['emotion', 'state', 'promise', 'secret', 'pending'];
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
  let selectedScene = '';
  /** Which shelf the scenes tab shows: a chapter id, or '' for the scenes not in a chapter yet. */
  let selectedGroup = null;
  /** Folded lists the person opened (kept open when the screen is drawn again). */
  const openLists = new Set();
  let connections = [];
  let serverEmbedding = null;
  let serverSettings = null;
  let notice = '';
  let lastError = '';
  let busy = false;
  let pollTimer = null;
  let armed = '';
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
    if (!response.ok) throw Error(data?.error || `서버 오류 (${response.status})`);
    return data;
  }

  async function loadRoom(id) {
    if (!id) {
      info = null;
      store = null;
      return;
    }
    const [i, s] = await Promise.all([api('GET', `/chats/${encodeURIComponent(id)}`), api('GET', `/chats/${encodeURIComponent(id)}/scenes`)]);
    info = i;
    store = s;
    if (selectedScene && !store.scenes.some((x) => x.id === selectedScene)) selectedScene = '';
    if (!selectedScene && selectedGroup === null) selectedScene = store.scenes.at(-1)?.id || '';
  }

  async function refresh() {
    lastError = '';
    if (!rooms.length) rooms = (await api('GET', '/chats')) || [];
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
    return scene ? `<span class="chip-wrap"><a href="#" class="record-link chip" data-goto-scene="${esc(scene.id)}"><span class="chip-id">${esc(scene.id)}</span>${esc(scene.title)}<span class="chip-arrow">›</span></a>${label ? `<small>${esc(label)}</small>` : ''}</span>` : '';
  }

  /** Ledger items that started, changed or ended inside a scene. */
  function threadsIn(scene) {
    const inside = (n) => n != null && scene.start <= n && n <= scene.end;
    const out = [];
    for (const t of info?.threads || []) {
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

  function schedulePoll() {
    clearTimeout(pollTimer);
    if (!open || disposed || !running()) return;
    pollTimer = setTimeout(async () => {
      try {
        await loadRoom(room);
        if (!running()) notice = [info?.job?.state, info?.sceneJob?.state].includes('error') ? '정리가 멈췄습니다. 아래 오류를 확인해 주세요.' : '정리가 끝났습니다.';
        render();
      } catch {}
      schedulePoll();
    }, 3000);
  }

  async function act(fn, done) {
    if (busy) return;
    busy = true;
    lastError = '';
    notice = '';
    render();
    try {
      await fn();
      if (done) notice = done;
      await loadRoom(room);
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
    return { who: by ? `${by}${q.to ? ` → ${q.to}` : ''}` : '서술', text: text.trim() };
  }

  /** A warning when this Marinara is not the version the module was tested on, or a patch could not go in. */
  function healthNote() {
    const h = info?.health;
    if (!h) return '';
    const NAMES = { macro: '{{기억}} 자리 채우기', app: '답변 뒤 자동 정리와 이 화면', speakers: '말풍선 태그 되살리기' };
    const notes = [];
    for (const b of h.broken || []) notes.push(b.reason === 'version'
      ? `기억 파일 ${b.file}은(는) 이 버전의 기억 모듈이 모르는 형식입니다(${b.error}). 더 새 버전에서 만든 파일일 수 있습니다. 덮어쓰지 않도록 이 파일의 저장과 정리를 멈췄습니다. 기억 모듈을 그 파일을 만든 버전 이상으로 업데이트해 주세요.${b.backup ? ` 원본 복사본: ${b.backup}` : ''}`
      : `기억 파일 ${b.file}이(가) 손상되어 읽지 못했습니다. 덮어쓰지 않도록 이 파일의 저장과 정리를 멈췄습니다.${b.backup ? ` 원본 복사본: ${b.backup}` : ''} 파일을 고치거나 지운 뒤 마리나라를 다시 켜 주세요.`);
    if (h.failed?.length) notes.push(`이 마리나라 버전에서는 ${h.failed.map((k) => NAMES[k] || k).join(', ')} 기능이 꺼져 있습니다. 마리나라는 그대로 정상 작동합니다. 기억 모듈 업데이트가 나오면 설치해 주세요.`);
    if (h.marinara && h.tested && h.marinara !== h.tested) notes.push(`마리나라 ${h.marinara} 버전입니다. 기억 모듈은 ${h.tested}에서 확인했습니다.${h.failed?.length ? '' : ' 지금은 모든 기능이 정상으로 붙었습니다.'}`);
    return notes.length ? `<div class="note">${notes.map(esc).join('<br>')}</div>` : '';
  }

  function viewHome() {
    if (!info) return emptyRoom();
    const openCount = (info.threads || []).filter((t) => t.status === 'open').length;
    const job = info.job || {};
    const sj = info.sceneJob || {};
    const rc = info.recall || {};
    const lt = info.summary?.lastTidy;
    return `
      <div class="eyebrow">MEMORY MODULE · v${esc(info.version || '?')}</div>
      <h1>${esc(roomName())}</h1>
      <p class="intro">지나간 대화를 장면·사실·장부로 정리해, 답변할 때마다 필요한 기억을 넣어 주는 서버 기억 모듈입니다. 이 방에서 기억을 켜 두면 답변마다 자동으로 정리되며, 여기서 고친 내용은 다음 답변부터 반영됩니다.</p>
      ${healthNote()}
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
        <div class="buttons">
          <button class="primary" data-act="start" ${running() ? 'disabled' : ''}>${icon('refresh')} 이어서 정리</button>
          <button data-act="tidy" ${running() ? 'disabled' : ''}>장부 점검</button>
          <button data-act="fresh" ${running() ? 'disabled' : ''}>${armed === 'fresh' ? '한 번 더 누르면 처음부터 다시 정리' : '처음부터 다시 정리'}</button>
          ${running() ? '<button data-act="stop">멈추기</button>' : ''}
        </div>
        <small>평소에는 누르지 않으셔도 됩니다. ‘이어서 정리’는 기억을 처음 켰을 때나 밀린 정리를 바로 하고 싶을 때 사용해 주세요. 처음부터 다시 정리하면 장면을 직접 고친 내용은 사라집니다.</small>
      </div>
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

  function emptyRoom() {
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
      ? `<div class="chapter-bar">${chapters.map((c) => `<button class="chapter-chip ${c.id === selectedGroup ? 'is-selected' : ''}" data-group="${esc(c.id)}"><span class="chip-id">${esc(c.id)}</span>${esc(c.title)}</button>`).join('')}<button class="chapter-chip ${selectedGroup === '' ? 'is-selected' : ''}" data-group=""><span class="chip-id">NOW</span>최근 장면</button></div>`
      : '';
    const shelf = inGroup
      .map((s) => {
        const i = store.scenes.indexOf(s);
        const outside = firstInside == null || s.start < firstInside;
        return `<button class="file-index ${s.id === selectedScene ? 'is-selected' : ''} ${outside ? '' : 'is-current'}" data-scene="${esc(s.id)}">
          <span class="file-code">${esc(s.id)}<span class="file-range">메시지 ${s.start}~${s.end}</span></span><span class="file-spine">SCENE ${String(i + 1).padStart(3, '0')}</span>
          <h3>${esc(s.title)}</h3><span class="barcode"></span>
          <span class="file-foot"><span>${esc((s.time || '').split(/\s+/).slice(0, 2).join(' '))}</span><span>${s.edited ? '고침' : ''}</span></span></button>`;
      })
      .join('');
    const s = inGroup.find((x) => x.id === selectedScene);
    return `<div class="eyebrow">SCENES · ${store.scenes.length}${chapters.length ? ` · CHAPTERS · ${chapters.length}` : ''}</div><h1>장면</h1>
      <p class="intro">ON AIR 도장이 찍힌 카드는 아직 모델이 원문으로 직접 보고 있는 장면입니다(기억 칸에는 들어가지 않습니다). 카드를 누르면 아래에서 고치실 수 있습니다.${chapters.length ? ' 오래된 장면은 챕터로 묶여, 기억 칸에는 챕터 요약으로 들어갑니다.' : ''}</p>
      ${bar}${chapters.length ? `<div class="buttons"><button data-act="rebuildChapters" ${running() ? 'disabled' : ''}>${armed === 'chapters' ? '한 번 더 누르면 챕터를 다시 묶습니다' : '챕터만 다시 묶기'}</button><small>장면·사실·장부는 그대로 두고 챕터만 새로 묶습니다. 챕터를 직접 고친 내용은 사라집니다.</small></div>` : ''}${chapter ? chapterEditor(chapter) : ''}
      <div class="file-shelf" id="shelf">${shelf || '<p class="hint">이 묶음에는 장면이 없습니다.</p>'}</div>${s ? sceneEditor(s) : ''}`;
  }

  function chapterEditor(c) {
    return `<div class="paper chapter-paper" id="chapterEditor" data-id="${esc(c.id)}">
      <div class="paper-toolbar"><h2>${esc(c.id)} · ${esc(c.scenes[0])}~${esc(c.scenes.at(-1))}${c.time ? ` · ${esc(c.time)}` : ''}</h2>${c.edited ? '<span class="pill">직접 고침</span>' : ''}</div>
      <div class="form-grid">
        <label class="full">챕터 제목<input id="cTitle" value="${esc(c.title)}"></label>
        <label class="full">챕터 요약 (기억 칸의 '지난 이야기 흐름'에 들어갑니다)<textarea id="cSummary" class="event-field" style="min-height:120px">${esc(c.summary)}</textarea></label>
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
          <label class="full">사건 (누가 누구에게 무엇을 어떻게)<textarea class="event-field" data-f="text">${esc(e.text)}</textarea></label>
          <label>작중 시각<input data-f="time" value="${esc(e.time || '')}" placeholder="예: 02:22"></label>
          <label>중요도<select data-f="importance">${Object.entries(IMPORTANCE).map(([k, v]) => `<option value="${k}" ${(e.importance || 'major') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="full">계기 (원문에 있을 때만)<input data-f="why" value="${esc(e.why || '')}"></label>
        </div>
        ${e.quotes.map((q) => { const l = quoteLine(q); return `<div class="quote-card"><small>${esc(l.who)} · #${q.number}.${q.sentence}</small><blockquote>${esc(l.text)}</blockquote></div>`; }).join('')}
      </article>`)
      .join('');
    const loose = (s.loose || []).map((q) => { const l = quoteLine(q); return `<div class="quote-card loose"><small>${esc(l.who)} · #${q.number}.${q.sentence} · 연결 미확정</small><blockquote>${esc(l.text)}</blockquote></div>`; }).join('');
    const recs = s.recollections
      .map((r, i) => {
        const persona = personas.includes(r.who);
        return `<article data-rec="${i}">
          <div class="form-grid">
            <label>인물<input data-f="who" value="${esc(r.who)}"></label>
            <label>기억 정도<select data-f="remembers">${Object.entries(REMEMBERS).map(([k, v]) => `<option value="${k}" ${r.remembers === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
            <label class="full">이유 (잠, 열, 술 등)<input data-f="why" value="${esc(r.why || '')}"></label>
            ${persona ? '<p class="full hint">사용자 캐릭터는 속마음을 적지 않습니다. 한 말과 행동은 사건에 기록되어 있습니다.</p>' : `<label class="full">그때 (그 인물이 실제로 한 말·행동·느낌)<textarea class="event-field" data-f="text">${esc(r.text || '')}</textarea></label>`}
            <label class="full">남은 기억 (흐릿하게만 기억할 때)<input data-f="kept" value="${esc(r.kept || '')}"></label>
          </div></article>`;
      })
      .join('');
    return `<div class="paper" id="sceneEditor" data-id="${esc(s.id)}">
      <div class="paper-toolbar"><h2>${esc(s.id)} · 메시지 ${s.start}~${s.end}번</h2>${s.edited ? '<span class="pill">직접 고침</span>' : ''}</div>
      <div class="form-grid">
        <label class="full">제목<input id="sTitle" value="${esc(s.title)}"></label>
        <label>작중 시간<input id="sTime" value="${esc(s.time || '')}"></label>
        <label>장소<input id="sPlace" value="${esc(s.place || '')}"></label>
        <label class="full">요약<textarea id="sSummary" style="min-height:110px">${esc(s.summary)}</textarea></label>
        ${group() ? `<label class="full">그 자리에 있던 사람 (쉼표로 구분 · 없던 인물은 이 장면 일을 모르는 것으로 기억합니다)<input id="sPresent" value="${esc((s.present || []).join(', '))}" placeholder="예: 서아, 도윤"></label>
        ${(s.heardLater || []).length ? `<p class="full hint">나중에 들은 사람: ${s.heardLater.map((h) => `${esc(h.who)}${h.from ? `(${esc(h.from)}에게)` : ''}`).join(', ')}</p>` : ''}` : ''}
      </div>
      ${(s.later || []).length ? `<h3>나중에 밝혀진 것</h3>${s.later.map((x) => `<p>${x.when ? `<small>${esc(x.when)}</small><br>` : ''}${esc(x.what)}${x.by ? ` <small>(${esc(x.by)})</small>` : ''}</p>`).join('')}` : ''}
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
      return { ...old, text: val(el, 'text'), time: val(el, 'time'), why: val(el, 'why'), importance: val(el, 'importance') };
    });
    const recollections = [...ed.querySelectorAll('[data-rec]')].map((el) => {
      const old = s.recollections[Number(el.dataset.rec)];
      const text = el.querySelector('[data-f="text"]') ? val(el, 'text') : old.text;
      return { who: val(el, 'who'), remembers: val(el, 'remembers'), why: val(el, 'why'), text, kept: val(el, 'kept') };
    });
    return {
      id: s.id,
      body: { title: root.querySelector('#sTitle').value, time: root.querySelector('#sTime').value, place: root.querySelector('#sPlace').value, summary: root.querySelector('#sSummary').value, events, recollections, ...(root.querySelector('#sPresent') ? { present: root.querySelector('#sPresent').value } : {}) },
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
    return `<div class="eyebrow">FACTS · ${store.facts.length}</div><h1>알게 된 사실</h1>
      <p class="intro">인물마다 앞으로도 계속 유효한 설정·성격·과거·관계입니다. 인물마다 최신 것부터 고르게 기억 칸에 들어가고, 많이 쌓이면 같은 주제끼리 합쳐집니다.</p>
      ${[...groups].map(([who, list]) => `<div class="paper"><h2>${esc(who)}</h2>${list
        .map((f) => {
          const replaced = f.replacedBy && ids.has(f.replacedBy);
          return `<div class="fact-row" data-fact="${esc(f.id)}"><label>${esc(f.id)}${f.unaware?.length ? ` · 모름: ${esc(f.unaware.join('·'))}` : ''}${f.guess?.length ? ` · 짐작만: ${esc(f.guess.join('·'))}` : ''}${f.edited || f.knowSet?.length ? ' · 직접 고침' : ''}${replaced ? ` · ${esc(f.replacedBy)}로 바뀜(기억 칸에서 제외)` : ''}</label>
            ${f.sceneId ? `<p class="record-links">${sceneLink(store.scenes.find((x) => x.id === f.sceneId), '에서 알게 됨')}</p>` : ''}
            <textarea class="event-field">${esc(f.text)}</textarea>
            ${group() ? `<div class="form-grid"><label>아직 모르는 인물 (쉼표로 구분)<input data-f="unaware" value="${esc((f.unaware || []).join(', '))}" placeholder="모두 알면 비워 두세요"></label><label>짐작만 하는 인물<input data-f="guess" value="${esc((f.guess || []).join(', '))}" placeholder="없으면 비워 두세요"></label></div>` : ''}
            <div class="buttons"><button data-act="saveFact" data-id="${esc(f.id)}">저장</button><button class="ghost" data-act="deleteFact" data-id="${esc(f.id)}">${armed === `fact:${f.id}` ? '한 번 더 누르면 삭제됩니다' : '삭제'}</button></div></div>`;
        })
        .join('')}</div>`).join('')}`;
  }

  function threadRow(t) {
    const who = [t.who, t.toward].filter(Boolean).join(' → ');
    const when = t.due ? `약속한 때 ${[t.due.date, t.due.time].filter(Boolean).join(' ')}` : t.period ? `기간 ${day(t.period.from)}~${day(t.period.to)}` : '';
    const closed = t.status !== 'open';
    return `<details class="event-row" data-tid="${esc(t.id)}"><summary><span class="event-no">${esc(t.id)}</span><span class="event-main"><b>${esc(t.title)}</b><small>${esc(who)}${when ? ` · ${esc(when)}` : ''}${t.unaware?.length ? ` · 모름: ${esc(t.unaware.join('·'))}` : ''}${t.guess?.length ? ` · 짐작만: ${esc(t.guess.join('·'))}` : ''}${closed ? ` · 닫힘: ${esc(t.closed?.how || '')}` : ''}</small></span><span class="pill ${closed ? 'neutral' : ''}">${KIND[t.kind] || t.kind}</span></summary>
      <div class="event-body">
        <div class="form-grid" data-thread="${esc(t.id)}">
          <label class="full">제목<input data-f="title" value="${esc(t.title)}"></label>
          <label class="full">설명<textarea class="event-field" data-f="detail">${esc(t.detail || '')}</textarea></label>
          ${t.kind === 'emotion' ? `<label class="full">풀리려면<input data-f="need" value="${esc(t.need || '')}"></label>` : ''}
          ${group() ? `<label>아직 모르는 인물 (쉼표로 구분)<input data-f="unaware" value="${esc((t.unaware || []).join(', '))}" placeholder="모두 알면 비워 두세요"></label><label>짐작만 하는 인물<input data-f="guess" value="${esc((t.guess || []).join(', '))}" placeholder="없으면 비워 두세요"></label>` : ''}
        </div>
        ${(() => {
          const start = sceneOf(t.openedAt?.number);
          const latest = sceneOf(t.latest?.number);
          const end = sceneOf(t.closed?.evidence?.[0]?.number);
          const links = [start && sceneLink(start, '에서 시작'), latest && latest !== start && sceneLink(latest, '에서 바뀜'), end && sceneLink(end, '에서 끝남')].filter(Boolean);
          return links.length ? `<p class="record-links">${links.join('')}</p>` : '';
        })()}
        ${t.cause ? `<p><small>원인</small><br>${esc(t.cause)}</p>` : ''}
        ${t.latest ? `<p><small>최근</small><br>${esc(t.latest.text)}</p>` : ''}
        ${t.evidence?.[0] ? `<div class="quote-card"><small>처음 원문 · #${t.evidence[0].number}</small><blockquote>${esc(quoteLine(t.evidence[0]).text)}</blockquote></div>` : ''}
        <div class="buttons"><button data-act="editThread" data-id="${esc(t.id)}">고친 내용 저장</button>${closed ? `<button data-act="reopen" data-id="${esc(t.id)}">다시 열기</button>` : `<button data-act="closeThread" data-id="${esc(t.id)}">${armed === `close:${t.id}` ? '한 번 더 누르면 닫힙니다' : '끝난 일로 닫기'}</button>`}</div>
      </div></details>`;
  }

  function viewLedger() {
    if (!info) return emptyRoom();
    const threads = info.threads || [];
    const open = threads.filter((t) => t.status === 'open');
    const closed = threads.filter((t) => t.status !== 'open');
    const groups = KIND_ORDER.map((k) => [k, open.filter((t) => t.kind === k)]).filter(([, l]) => l.length);
    return `<div class="eyebrow">LEDGER · ${open.length} OPEN</div><h1>아직 끝나지 않은 일</h1>
      <p class="intro">약속·감정·상태·비밀·미해결 일입니다. 항목을 누르면 제목과 설명을 고치실 수 있고, 잘못 닫힌 항목은 다시 열고 끝난 일은 닫으실 수 있습니다. 직접 고친 내용은 리롤해도 유지됩니다.</p>
      ${groups.length ? groups.map(([k, l]) => `<div class="paper"><h2>${KIND[k]} · ${l.length}</h2>${l.map(threadRow).join('')}</div>`).join('') : '<div class="empty">열린 항목이 없습니다.</div>'}
      ${closed.length ? `<details class="paper"><summary>닫힌 항목 ${closed.length}개</summary>${closed.map(threadRow).join('')}</details>` : ''}`;
  }

  function viewLife() {
    if (!info) return emptyRoom();
    return `<div class="eyebrow">DAILY LIFE</div><h1>최근 생활</h1>
      <p class="intro">인물마다 마지막 식사·씻기·잠·약을 보여 드립니다. 몇 끼째인지, 몇 시간 잤는지는 지문의 작중 시각으로 프로그램이 계산합니다.</p>
      ${info.routine ? `<pre>${esc(info.routine)}</pre>` : '<div class="empty">아직 기록이 없습니다.</div>'}
      ${routineEditor()}`;
  }

  const ROUTINE_LABEL = { meal: '식사', wash: '씻기', sleep: '잠듦', wake: '깸', medicine: '약' };

  function routineRow(r, key) {
    const opts = Object.entries(ROUTINE_LABEL).map(([k, v]) => `<option value="${k}" ${r.what === k ? 'selected' : ''}>${v}</option>`).join('');
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

  function readRoutineRow(row) {
    const val = (f) => row.querySelector(`[data-f="${f}"]`);
    return { what: val('what').value, at: val('at').value, text: val('text').value, substitute: val('substitute').checked, claimed: val('claimed').checked };
  }

  function viewInject() {
    if (!info) return emptyRoom();
    return `<div class="eyebrow">INJECTION · 약 ${tokens(info.rendered)} 토큰</div><h1>주입 확인</h1>
      <p class="intro">지금 프리셋의 {{기억}} 자리에 들어가는 내용 그대로입니다. 회상한 장면은 답변마다 바뀝니다.</p>
      ${recallCard()}${recallTestCard()}
      ${info.rendered ? `<pre>${esc(info.rendered)}</pre>` : `<div class="empty">${info.enabled ? '아직 들어가는 기억이 없습니다.' : '이 방에서 기억 사용이 꺼져 있어 {{기억}} 자리에 아무것도 들어가지 않습니다. 저장된 기억은 그대로 남아 있습니다.'}</div>`}`;
  }

  /** Which scenes came up for the last reply, and why; plus what the meaning search found. */
  function recallCard() {
    const rc = info.recall || {};
    if (!rc.picks?.length && !rc.semantic?.length && !rc.semanticError) return '';
    const scene = (id) => store?.scenes.find((x) => x.id === id);
    const picks = (rc.picks || []).map((p) => `<a href="#" class="record-link record-row" data-goto-scene="${esc(p.id)}"><span class="pill">떠오름</span><span class="row-main"><b>${esc(p.title || scene(p.id)?.title || p.id)}</b><small>${esc(p.id)}${p.why ? ` · ${esc(p.why)}` : ''}</small></span><span class="chip-arrow">›</span></a>`).join('');
    const near = (rc.semantic || []).map((x) => `<span class="chip-wrap"><a href="#" class="record-link chip" data-goto-scene="${esc(x.id)}"><span class="chip-id">${esc(x.id)}</span>${esc(x.title || x.id)}<span class="chip-arrow">›</span></a><small>${x.score}${x.strong ? ' · 뚜렷함' : ''}</small></span>`).join('');
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
      </div>
      <div class="paper"><h2>이 방</h2>
        <label class="setting-switch"><span>기억 사용<small>켜면 답변마다 장부와 장면을 자동으로 갱신합니다.</small></span><input type="checkbox" id="setEnabled" ${info.enabled ? 'checked' : ''}></label>
        <label class="setting-switch"><span>말풍선 태그 되살리기<small>화자 색상이 켜진 '합쳐서' 그룹 채팅에서, 빠진 &lt;speaker&gt; 태그를 다시 붙입니다.</small></span><input type="checkbox" id="setTags" ${info.speakerTags ? 'checked' : ''}></label>
      </div>
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
        <label>캐릭터가 지난 일을 먼저 꺼내는 정도<select id="setRecallStyle">
          <option value="quiet" ${serverSettings?.recallStyle === 'quiet' ? 'selected' : ''}>은은하게 — 꼭 필요할 때만 살짝 (기억을 받아 적는 느낌이 들 때)</option>
          <option value="natural" ${!serverSettings?.recallStyle || serverSettings?.recallStyle === 'natural' ? 'selected' : ''}>자연스럽게 — 상황에 맞으면 묻지 않아도 먼저 꺼냄</option>
          <option value="active" ${serverSettings?.recallStyle === 'active' ? 'selected' : ''}>적극적으로 — 지난 약속·했던 말을 자주 끌어옴</option></select></label>
        <p class="hint">어느 쪽이든 지난 일을 줄줄이 설명하지는 않게 합니다.</p>
        <div class="buttons"><button class="primary" data-act="saveSettings">저장</button></div>
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
      <p class="hint">기억 모듈 업데이트는 설치할 때와 같은 명령을 다시 실행하시면 됩니다.</p>`;
  }

  function inspector() {
    if (!info) return '';
    const open = (info.threads || []).filter((t) => t.status === 'open');
    return `<div class="rail-title">이 방의 기억</div>
      <div class="rail-stat"><b>${info.scenes?.count ?? 0}</b><small>장면<br>메시지 ${info.scenes?.coveredThrough ?? '-'}번까지</small></div>
      <div class="rail-stat"><b>${open.filter((t) => t.kind === 'emotion').length}</b><small>풀리지 않은 감정</small></div>
      <div class="rail-stat"><b>${open.filter((t) => t.kind === 'promise').length}</b><small>지켜야 할 약속</small></div>
      <div class="rail-divider"></div>
      <div class="rail-note">${icon('spark')}<h3>기억은 서버에 있습니다</h3><p>여기서 고친 내용은 서버의 기억 모듈에 바로 저장되고, 다음 답변부터 반영됩니다.</p></div>
      <div class="rail-footer">기억 서재 · 기억 모듈판 v${VERSION}</div>`;
  }

  const VIEWS = { home: viewHome, scenes: viewScenes, facts: viewFacts, ledger: viewLedger, life: viewLife, inject: viewInject, settings: viewSettings };

  function render() {
    if (!root) return;
    root.querySelector('#backdrop').hidden = !open;
    root.host.setAttribute('data-font', font);
    root.querySelector('#panel').classList.toggle('is-running', Boolean(info && running()));
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
    content.innerHTML = VIEWS[tab]();
    content.scrollTop = scroll;
    root.querySelector('#inspector').innerHTML = inspector();
    const n = root.querySelector('#themeToggle');
    n.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
    root.host.setAttribute('data-theme', theme);
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
  }

  /* ---------- actions ---------- */

  async function handle(actName, el) {
    const id = el?.dataset?.id;
    const chat = encodeURIComponent(room);
    if (actName !== 'fresh' && !actName.startsWith('deleteFact') && actName !== 'closeThread' && actName !== 'rebuildChapters' && actName !== 'deleteRoutine') armed = '';
    switch (actName) {
      case 'refresh':
        rooms = [];
        return act(refresh, '새로 불러왔습니다.');
      case 'start':
        return act(() => api('POST', `/chats/${chat}/start`, { fresh: false }), '정리를 시작했습니다.');
      case 'fresh':
        if (armed !== 'fresh') {
          armed = 'fresh';
          return render();
        }
        armed = '';
        return act(() => api('POST', `/chats/${chat}/start`, { fresh: true }), '처음부터 다시 정리를 시작했습니다.');
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
      case 'recallTest': {
        recallTestText = root.querySelector('#recallTestText').value;
        return act(async () => {
          recallTest = await api('POST', `/chats/${chat}/recall-test`, { text: recallTestText });
        }, '회상 시험을 마쳤습니다.');
      }
      case 'saveChapter': {
        const ed = root.querySelector('#chapterEditor');
        const body = { title: ed.querySelector('#cTitle').value, summary: ed.querySelector('#cSummary').value, turns: ed.querySelector('#cTurns').value.split('\n'), keep: ed.querySelector('#cKeep').value.split('\n') };
        return act(() => api('PATCH', `/chats/${chat}/chapters/${encodeURIComponent(ed.dataset.id)}`, body), '챕터를 저장했습니다.');
      }
      case 'saveScene': {
        const { id: sid, body } = readScene();
        return act(() => api('PATCH', `/chats/${chat}/scenes/${encodeURIComponent(sid)}`, body), '장면을 저장했습니다.');
      }
      case 'saveFact': {
        const row = root.querySelector(`[data-fact="${CSS.escape(id)}"]`);
        const unaware = row.querySelector('[data-f="unaware"]');
        const guess = row.querySelector('[data-f="guess"]');
        return act(() => api('PATCH', `/chats/${chat}/facts/${encodeURIComponent(id)}`, { text: row.querySelector('textarea').value, ...(unaware ? { unaware: unaware.value, guess: guess.value } : {}) }), '사실을 저장했습니다.');
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
        const body = {};
        for (const f of ['title', 'detail', 'need', 'unaware', 'guess']) {
          const el = box?.querySelector(`[data-f="${f}"]`);
          if (el) body[f] = el.value;
        }
        return act(() => api('POST', `/chats/${chat}/threads/${encodeURIComponent(id)}/edit`, body), `${id} 항목을 저장했습니다.`);
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
      case 'saveSettings': {
        const connection = root.querySelector('#setConnection')?.value;
        const recall = root.querySelector('#setRecall')?.value;
        return act(async () => {
          if (connection) await api('POST', '/settings', { connection });
          if (recall) await api('POST', '/settings/recall', { mode: recall });
          const amount = root.querySelector('#setRecallAmount')?.value;
          if (amount) await api('POST', '/settings/recall-amount', { amount });
          const style = root.querySelector('#setRecallStyle')?.value;
          if (style) await api('POST', '/settings/recall-style', { style });
          serverSettings = (await api('GET', '/status')).settings;
        }, '설정을 저장했습니다.');
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
      const [status, list] = await Promise.all([api('GET', '/status'), api('GET', '/api/connections').catch(() => [])]);
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

  function install() {
    const element = document.createElement('div');
    element.id = 'memory-module-library';
    root = element.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${UI_CSS}${EXTRA_CSS}${THEME_CSS}</style>
      <button id="launch" aria-label="기억 서재 열기" title="기억 서재 (끌어서 옮길 수 있습니다)">${LAUNCH_ICON}</button>
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
            <button id="close" class="close" aria-label="닫기">${icon('close')}</button></header>
          <div id="status" role="status"></div><div id="error" hidden></div>
          <main id="content"></main>
        </div>
        <aside class="inspector" id="inspector"></aside>
      </section>`;
    element.setAttribute('style', 'position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;');
    (document.body || document.documentElement).append(element);
    root.host.setAttribute('data-theme', theme);

    makeDraggable(root.querySelector('#launch'));
    root.querySelector('#launch').onclick = () => {
      open = !open;
      if (open) {
        const current = activeChatId();
        if (current && current !== room) {
          room = current;
          recallTest = null;
        }
        void act(refresh);
        if (tab === 'settings') void openSettings();
      }
      render();
    };
    root.querySelector('#close').onclick = () => {
      open = false;
      render();
    };
    root.querySelector('#backdrop').onclick = () => {
      open = false;
      render();
    };
    root.querySelector('#themeToggle').onclick = () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('memory-module-theme', theme);
      } catch {}
      render();
    };
    root.querySelector('#roomSelect').onchange = (e) => {
      room = e.target.value;
      recallTest = null;
      selectedScene = '';
      void act(() => loadRoom(room));
    };
    root.querySelector('#roomEnabled').onchange = (e) => {
      const on = e.target.checked;
      void act(() => api('POST', `/chats/${encodeURIComponent(room)}/${on ? 'enable' : 'disable'}`), on ? '이 방에서 기억을 켰습니다. 처음 켜셨다면 ‘이어서 정리’를 눌러 주세요.' : '이 방의 기억 갱신을 껐습니다.');
    };
    root.addEventListener('change', (e) => {
      if (e.target.id === 'setFont') {
        font = e.target.value === 'own' ? 'own' : 'marinara';
        try {
          localStorage.setItem('memory-module-font', font);
        } catch {}
        return render();
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
        } else if (link.dataset.gotoThread) {
          tab = 'ledger';
          focus = { kind: 'thread', id: link.dataset.gotoThread };
        } else if (link.dataset.gotoFact) {
          tab = 'facts';
          focus = { kind: 'fact', id: link.dataset.gotoFact };
        }
        return render();
      }
      const n = e.target.closest('button');
      if (!n || busy) return;
      if (n.dataset.tab) {
        tab = n.dataset.tab;
        armed = '';
        if (tab === 'settings') void openSettings();
        return render();
      }
      if (n.dataset.group !== undefined) {
        selectedGroup = n.dataset.group;
        selectedScene = '';
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
    clearTimeout(pollTimer);
    root?.host?.remove();
  }

  install();
  host.onCleanup?.(cleanup);
})();
