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

  /** Every quoted line of the room, as a record of its own (it opens its scene). */
  function quoteRecords() {
    const out = [];
    for (const sc of store?.scenes || []) for (const e of sc.events || []) for (const q of e.quotes || []) {
      const l = quoteLine(q);
      out.push({ id: sc.id, title: `${sc.id} · ${l.who}`, text: l.text, people: [q.by, q.to].filter(Boolean) });
    }
    return out;
  }
  /** Whether a record is about a person: named as who/toward/about/present/speaker, or in its text. */
  function mentions(record, who) {
    const fields = [record.who, record.toward, record.about, ...(record.present || []), ...(record.people || [])].filter(Boolean).map(String);
    return fields.some((f) => f.includes(who)) || searchableText(record).includes(who);
  }
  function viewSearch() {
    if (!store) return emptyRoom();
    const query = searchQuery.toLocaleLowerCase();
    const groups = [
      ['장면', 'scene', store.scenes || []],
      ['대사', 'quote', quoteRecords()],
      ['챕터', 'chapter', store.chapters || []],
      ['큰 흐름', 'arc', store.arcs || []],
      ['사실', 'fact', store.facts || []],
      ['미해결·닫힌 기록', 'thread', threadList()],
    ].filter(([, kind]) => searchKind === 'all' || kind === searchKind);
    const results = [];
    if (query) for (const [label, kind, records] of groups) for (const record of records) {
      if (searchWho !== 'all' && !mentions(record, searchWho)) continue;
      const text = kind === 'quote' ? record.text : searchableText(record);
      const at = text.toLocaleLowerCase().indexOf(query);
      if (at < 0) continue;
      const start = Math.max(0, at - 45);
      const excerpt = `${start ? '…' : ''}${text.slice(start, at + query.length + 110)}${text.length > at + query.length + 110 ? '…' : ''}`;
      results.push(`<a href="#" class="record-link record-row" data-goto-${kind === 'quote' ? 'scene' : kind}="${esc(record.id)}"><span class="pill neutral">${label}</span><span class="row-main"><b>${esc(record.title || record.about || record.id)}</b><small>${esc(excerpt)}</small></span><span class="chip-arrow">›</span></a>`);
    }
    return `<h1>기억 검색</h1><p class="intro">이 방의 장면·대사·챕터·큰 흐름·사실·미해결 기록과 닫힌 기록에서 입력한 글자를 찾습니다. 종류와 인물로 거를 수 있습니다. 결과를 누르면 해당 기록으로 이동합니다.</p>
      <form id="memorySearch" class="memory-search"><label for="memorySearchInput">검색어</label><div class="buttons"><input id="memorySearchInput" type="search" value="${esc(searchDraft)}" placeholder="이름, 대사, 장소 등" autocomplete="off"><button class="primary" type="submit">${icon('search')}검색</button><button type="button" data-act="clearSearch">초기화</button></div>
        <div class="buttons search-filters"><select id="searchKind" aria-label="종류로 거르기"><option value="all">모든 종류</option>${[['scene', '장면'], ['quote', '대사'], ['chapter', '챕터'], ['arc', '큰 흐름'], ['fact', '사실'], ['thread', '미해결·닫힌 기록']].map(([k, l]) => `<option value="${k}" ${searchKind === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select id="searchWho" aria-label="인물로 거르기"><option value="all">모든 인물</option>${personNames().map((n) => `<option value="${esc(n)}" ${searchWho === n ? 'selected' : ''}>${esc(nameShown(n))}</option>`).join('')}</select></div></form>
      <div role="status">${query ? `${results.length}개 검색 결과` : '검색어를 입력하고 검색 버튼이나 Enter를 눌러 주세요.'}</div>
      <div class="record-list">${results.join('') || (query ? '<p class="hint">일치하는 기억이 없습니다.</p>' : '')}</div>`;
  }

  // Search-only handlers share the enclosing runtime state; navigation stays with the common link handler.
  function searchInput(e) {
    if (e.target.id === 'memorySearchInput') searchDraft = e.target.value;
  }
  function searchSubmit(e) {
    if (e.target.id !== 'memorySearch') return;
    e.preventDefault();
    searchDraft = root.querySelector('#memorySearchInput').value;
    searchQuery = searchDraft.trim();
    render();
  }
  function searchFilterChange(e) {
    if (e.target.id !== 'searchKind' && e.target.id !== 'searchWho') return false;
    if (e.target.id === 'searchKind') searchKind = e.target.value;
    else searchWho = e.target.value;
    render();
    return true;
  }
  function searchClear(n) {
    if (n?.dataset.act !== 'clearSearch') return false;
    searchDraft = searchQuery = '';
    render();
    root.querySelector('#memorySearchInput')?.focus();
    return true;
  }

