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
      ? `<div class="note" role="status"><b>자동으로 적용함</b>${t.applied.map((x) => `<div>자동으로 적용함: ${esc(x.text)}${sceneRefs(sceneRef(x.sceneId, '에서 받음', w.sceneTitles))} <button class="ghost" data-act="trackerUndoApplied" data-aid="${esc(x.id)}">${armedNow === `trackerUndoApplied:${x.id}` ? '한 번 더 누르면 되돌립니다. 그 뒤로 고치거나 더한 시작일도 함께 사라집니다' : '되돌리기'}</button></div>`).join('')}</div>`
      : '';
    return `<div class="paper"><h2>날짜·주기 트래커 · ${t.items.length}개</h2>
      <p class="hint">직접 만든 날짜 기록입니다(모델 호출 없음). 오늘은 ${t.storyDate ? `이야기 속 ${esc(t.storyDate)}` : '이야기 날짜를 아직 모름'} · 실제 ${esc(t.realDate)}. 답변에는 \`[기록] …\` 한 줄(200자 이내)만 들어가고, 주기의 시작이 이야기에 나오면 ‘제안 자동 적용’(설정 → 추가 기능)이 켜져 있을 때는 바로 기록하고 ‘자동으로 적용함’에서 되돌릴 수 있으며, 꺼져 있으면 제안만 합니다.</p>
      ${applied}${suggestions}
      ${t.items.length ? t.items.map(card).join('') : '<p class="hint">아직 없습니다.</p>'}
      <datalist id="trackerPeople">${(t.people || []).map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      ${trackerForm(t)}</div>`;
  }

  function trackersCard() {
    const items = world?.trackers?.items || [];
    if (!items.length) return '';
    return `<div class="paper"><div class="paper-toolbar"><h2>세고 있는 것</h2><button class="ghost" data-tab="world">고치기 · 추가</button></div>
      <div class="tracker-tiles">${items.map((it) => `<div class="tracker-tile"><small>${withKo(it.label)}</small><b>${esc(it.status?.text || '')}</b>${it.inject && it.inject !== 'off' ? '<small>답변에 넣음</small>' : ''}</div>`).join('')}</div></div>`;
  }
