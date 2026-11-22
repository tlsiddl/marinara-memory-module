/* Copied from tlsiddl/marinara-world-archive main 5ec6481 (extension/extension.js, v0.8.4-beta · 정리 모델 고르기 찾기 쉽게 · 계약 수준 2). Do not edit here: change it in World Archive and copy again. */
/* 세계관 설정집 · Marinara World Archive — personal extension UI.
 * Talks only to /api/world-archive on the same server. Visual language follows its sister module 기억 서재
 * (paper grain, ticket notches, ink shadows); the motif here is a star chart instead of a record. */
(() => {
  'use strict';
  // 연동 v2: also built into 기억 서재's screen as its 「세계관」 tab — 기억 서재's build.py wraps this file with
  // __WORLD_ARCHIVE_EMBEDDED__ = true; then nothing starts here and the tab calls __memoryWorldPanel.start(box).
  const EMBEDDED = typeof __WORLD_ARCHIVE_EMBEDDED__ !== 'undefined' && __WORLD_ARCHIVE_EMBEDDED__ === true;
  if (!EMBEDDED && document.getElementById('marinara-world-archive-root')) return;
  const VERSION = '0.8.4-beta';
  /** The contract level this screen is made for (the server's status.contract). Another level: read only. */
  const PANEL_CONTRACT = 2;
  const UPDATE_MSG = '세계관 칸을 쓰려면 기억 서재(또는 설정집)를 업데이트해 주세요. 지금은 보기만 할 수 있습니다.';
  const BASE = '/api/world-archive';
  // Paper grain from 기억 서재 (tlsiddl/marinara-memory-module 165d488, extension/theme.css --wa-grain)
  const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
  // Stamp-edge ticket outline from 기억 서재's launcher (same commit, extension/runtime.js LAUNCH_ICON)
  const STAMP = "M4 11L4.75 11A2.05 2.05 0 0 0 8.85 11L10.35 11A2.05 2.05 0 0 0 14.45 11L15.95 11A2.05 2.05 0 0 0 20.05 11L21.55 11A2.05 2.05 0 0 0 25.65 11L27.15 11A2.05 2.05 0 0 0 31.25 11L32.75 11A2.05 2.05 0 0 0 36.85 11L38.35 11A2.05 2.05 0 0 0 42.45 11L43.95 11A2.05 2.05 0 0 0 48.05 11L49.55 11A2.05 2.05 0 0 0 53.65 11L55.15 11A2.05 2.05 0 0 0 59.25 11L60 11L60 11.57A2.05 2.05 0 0 0 60 15.68L60 16.82A2.05 2.05 0 0 0 60 20.93L60 22.07A2.05 2.05 0 0 0 60 26.18L60 27.32A2.05 2.05 0 0 0 60 31.43L60 32.58A2.05 2.05 0 0 0 60 36.67L60 37.83A2.05 2.05 0 0 0 60 41.92L60 43.08A2.05 2.05 0 0 0 60 47.17L60 48.33A2.05 2.05 0 0 0 60 52.42L60 53L59.25 53A2.05 2.05 0 0 0 55.15 53L53.65 53A2.05 2.05 0 0 0 49.55 53L48.05 53A2.05 2.05 0 0 0 43.95 53L42.45 53A2.05 2.05 0 0 0 38.35 53L36.85 53A2.05 2.05 0 0 0 32.75 53L31.25 53A2.05 2.05 0 0 0 27.15 53L25.65 53A2.05 2.05 0 0 0 21.55 53L20.05 53A2.05 2.05 0 0 0 15.95 53L14.45 53A2.05 2.05 0 0 0 10.35 53L8.85 53A2.05 2.05 0 0 0 4.75 53L4 53L4 52.42A2.05 2.05 0 0 0 4 48.33L4 47.17A2.05 2.05 0 0 0 4 43.08L4 41.92A2.05 2.05 0 0 0 4 37.83L4 36.67A2.05 2.05 0 0 0 4 32.58L4 31.43A2.05 2.05 0 0 0 4 27.32L4 26.18A2.05 2.05 0 0 0 4 22.07L4 20.93A2.05 2.05 0 0 0 4 16.82L4 15.68A2.05 2.05 0 0 0 4 11.57Z";

  const KINDS = [
    { type: 'person', label: '인물', en: 'PEOPLE', icon: 'person', hint: '이 세계에 사는 사람들. 외형·성격 같은 기본 정보와, 사건으로 바뀐 「지금 상태」를 따로 적어 둡니다.' },
    { type: 'place', label: '장소', en: 'PLACES', icon: 'place', hint: '건물, 방, 숲, 도시. 고정된 구조와 출입구·연결을 적어 둡니다. 누가 잠깐 들른 일은 여기가 아니라 기억 쪽에 남습니다.' },
    { type: 'group', label: '집단', en: 'GROUPS', icon: 'group', hint: '가문, 학교, 기숙사, 동아리, 조직. 구성원과 위계를 적어 둡니다.' },
    { type: 'rule', label: '규칙', en: 'RULES', icon: 'rule', hint: '법, 제도, 관례, 금기, 학교 규칙처럼 지켜야 하는 것. 내용은 메모 칸에 적어 주세요.' },
    { type: 'system', label: '시스템', en: 'SYSTEMS', icon: 'gear', hint: '마법, 능력, 경제, 점수처럼 이 세계가 돌아가는 원리. 작동 방식과 제약·대가를 적어 둡니다.' },
    { type: 'schedule', label: '일정', en: 'SCHEDULE', icon: 'calendar', hint: '수업 시간표, 반복 행사, 정기 활동. 언제·어디서·누가를 적어 둡니다.' },
    { type: 'history', label: '역사', en: 'HISTORY', icon: 'book', hint: '이야기가 시작되기 전의 일과 세계관 연혁. 시기·장소·관련 인물과 결과를 적어 둡니다. 이야기 안에서 지금 일어나는 일은 기억 쪽에 남습니다.' },
    { type: 'custom', label: '기타', en: 'MISC', icon: 'star', hint: '어디에도 안 맞는 이 세계만의 설정. 필요한 칸은 「칸 추가」로 만들 수 있습니다.' },
  ];
  const KIND = Object.fromEntries(KINDS.map((k) => [k.type, k]));

  // ------------------------------------------------------------------ icons (line, currentColor)
  const ICONS = {
    overview: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17" stroke-dasharray="1.6 2"/><path d="M12 8.6l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9z"/>',
    person: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.8 3.6-5.6 7-5.6s6.2 1.8 7 5.6"/>',
    place: '<path d="M4 20h16M6 20V9l6-4.5L18 9v11"/><path d="M10 20v-5h4v5"/>',
    group: '<circle cx="9" cy="9" r="3"/><circle cx="16.5" cy="10" r="2.4"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6M14.6 14.6c2.5-.3 4.6 1 5.4 3.9"/>',
    rule: '<path d="M7 3.5h10v17H7z"/><path d="M10 8h4M10 11.5h4M10 15h2.5"/>',
    gear: '<path d="M17.7 9.9L20 10.1v3.8l-2.3.2-.1.4 1.4 1.8-2.7 2.7-1.8-1.4-.4.1-.2 2.3h-3.8l-.2-2.3-.4-.1-1.8 1.4L5 16.3l1.4-1.8-.1-.4L4 13.9v-3.8l2.3-.2.1-.4L5 7.7 7.7 5l1.8 1.4.4-.1.2-2.3h3.8l.2 2.3.4.1L16.3 5 19 7.7l-1.4 1.8z"/><circle cx="12" cy="12" r="2.6"/>',
    book: '<path d="M12 6.8C10 5.3 7.2 4.9 4 5.3v13c3.2-.4 6 0 8 1.5 2-1.5 4.8-1.9 8-1.5v-13c-3.2-.4-6 0-8 1.5zM12 6.8v13"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="1"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    star: '<path d="M12 4l1.8 6.2L20 12l-6.2 1.8L12 20l-1.8-6.2L4 12l6.2-1.8z"/>',
    world: '<circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="3.6" ry="8.5"/><path d="M3.8 9h16.4M3.8 15h16.4"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
    moon: '<path d="M20 14.2A8 8 0 0 1 9.8 4 8 8 0 1 0 20 14.2z"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
    back: '<path d="M14.5 6 8.5 12l6 6"/>',
    score: '<path d="M5 20V11M12 20V5M19 20v-6"/><path d="M3.5 20h17" opacity=".5"/>',
    log: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/><path d="M3.5 12h2M18.5 12h2" opacity=".5"/>',
  };
  const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  // A paper ticket with stamp edges, sister of 기억 서재's launcher.
  const LAUNCH_ICON = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="${STAMP}" fill="#f1eee7" stroke="#0000002e" stroke-width=".5"/><rect x="9" y="15.5" width="46" height="33" fill="none" stroke="#141414" stroke-width=".9"/><line x1="43.5" y1="16.5" x2="43.5" y2="47.5" stroke="#141414" stroke-width=".9" stroke-dasharray="1.6 1.6"/><text x="26.2" y="29.6" font-family="Georgia,'Times New Roman',serif" font-weight="700" font-size="6.4" text-anchor="middle" fill="#141414" letter-spacing=".3">WORLD</text><text x="26.2" y="37.8" font-family="ui-monospace,Menlo,monospace" font-size="3.4" text-anchor="middle" fill="#141414" letter-spacing=".25">ARCHIVE</text><circle cx="49.3" cy="32" r="3.9" fill="none" stroke="#141414" stroke-width=".55" stroke-dasharray=".9 .9"/><path d="M49.3 28.9l.55 2.55 2.55.55-2.55.55-.55 2.55-.55-2.55-2.55-.55 2.55-.55z" fill="#141414"/></svg>`;

  // Brand mark: a small star chart (dotted orbit, axes, four-point star).
  const BRAND = `<svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="24" cy="24" r="14.5" fill="none" stroke="currentColor" stroke-width=".8" stroke-dasharray="1.4 2.2"/><path d="M24 2v44M2 24h44" stroke="currentColor" stroke-width=".5" opacity=".55"/><path d="M24 14.5l2 7.5 7.5 2-7.5 2-2 7.5-2-7.5-7.5-2 7.5-2z" fill="currentColor"/><circle cx="37" cy="12" r="1.1" fill="currentColor"/><circle cx="11" cy="35" r=".8" fill="currentColor"/><circle cx="35.5" cy="36.5" r=".6" fill="currentColor"/></svg>`;

  // ------------------------------------------------------------------ styles
  const CSS = `
:host{all:initial;--wa-ink:#151515;--wa-paper:#f4f1ea;--wa-paper2:#ebe7dd;--wa-muted:#6d685f;--wa-line:#15151526;--wa-field:#faf8f3;--wa-field-line:#1515153a;--wa-soft:#e4dfd3;--wa-side:#151515;--wa-side-ink:#ece8df;
  --wa-serif:var(--font-y2k,"Gowun Batang","Nanum Myeongjo","Noto Serif KR",Georgia,serif);--wa-mono:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;
  --wa-sans:var(--font-y2k,"Pretendard","Noto Sans KR",-apple-system,system-ui,sans-serif);--wa-grain:${GRAIN};
  font:14px/1.65 var(--wa-sans);color:var(--wa-ink)}
:host([data-theme=dark]){--wa-ink:#ece8df;--wa-paper:#1b1a18;--wa-paper2:#131312;--wa-muted:#a39d92;--wa-line:#ece8df2b;--wa-field:#222120;--wa-field-line:#ece8df40;--wa-soft:#2a2826;--wa-side:#0c0c0b}
*{box-sizing:border-box}[hidden]{display:none!important}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer;border:1.5px solid var(--wa-ink);background:transparent;border-radius:3px;padding:8px 14px;transition:background .15s,transform .15s}
button:hover{background:var(--wa-soft)}button:disabled{opacity:.45;cursor:default}
button.primary{background:var(--wa-ink);color:var(--wa-paper);font-weight:700}
button.primary:hover{background:#000}:host([data-theme=dark]) button.primary:hover{background:#fff}
button.quiet{border-color:transparent;color:var(--wa-muted);padding:6px 8px}button.quiet:hover{color:var(--wa-ink);background:transparent;text-decoration:underline}
button.danger{color:#a3321f;border-color:#a3321f}:host([data-theme=dark]) button.danger{color:#f0a18f;border-color:#f0a18f}
:focus-visible{outline:3px solid #8fa3c9;outline-offset:2px}
.icon{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
input,select,textarea{width:100%;border-radius:3px;background:var(--wa-field);border:1px solid var(--wa-field-line);padding:9px 11px;line-height:1.55;font-size:15px}
textarea{min-height:84px;resize:vertical}
label.f{display:block;font:700 14px/1.45 var(--wa-serif);letter-spacing:0;color:var(--wa-ink);margin:16px 0 6px}
label.f em{display:block;font:12.5px/1.5 var(--wa-sans);letter-spacing:0;font-style:normal;color:var(--wa-muted);margin:2px 0 0}
.c-line{margin:6px 0 0;font:600 13.5px/1.5 var(--wa-serif);color:var(--wa-ink)}
.c-two{margin:6px 0 0;font-size:13px;line-height:1.55;color:var(--wa-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.c-hid{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}
.hid-cap{display:inline-block;margin-left:8px;font:12px/1.5 var(--wa-sans);color:var(--wa-muted);border:1px dashed var(--wa-muted);border-radius:999px;padding:0 9px;vertical-align:middle}.c-hid .hid-cap{margin-left:0}
.list-bar{margin:4px 0 16px}.bar-gap{flex:0 0 14px}
h3.grp{font:700 16px/1.4 var(--wa-serif);margin:22px 0 10px;display:flex;align-items:baseline;gap:8px}h3.grp small{font:12px var(--wa-sans);color:var(--wa-muted)}
.fact-caps{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 10px}
.fact-cap{display:inline-flex;align-items:baseline;gap:7px;border:1.2px solid var(--wa-ink);border-radius:999px;padding:4px 13px;font:600 14px/1.45 var(--wa-serif);background:transparent;color:var(--wa-ink)}.fact-cap small{font:12px var(--wa-sans);color:var(--wa-muted);font-weight:400}button.fact-cap{cursor:pointer}
.rel-caps{display:flex;flex-wrap:wrap;gap:8px}.rel-cap{border:1px solid var(--wa-line);border-radius:999px;padding:4px 12px;background:transparent;color:var(--wa-ink);font:13.5px/1.45 var(--wa-sans);cursor:pointer;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}.rel-cap b{font-family:var(--wa-serif)}.rel-cap small{color:var(--wa-muted);font-size:12px}.rel-cap .note-dot{font-style:normal;color:var(--wa-muted);margin-left:4px}
small.was,.past.was{color:#2f5fa8}
.hid-toggle{display:inline-flex;align-items:center;gap:6px;margin:6px 0 0;font:12.5px var(--wa-sans);color:var(--wa-muted);border:1px dashed var(--wa-line);border-radius:999px;padding:2px 10px}.hid-toggle input{width:auto;margin:0}
.rel-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 0;border-bottom:1px dashed var(--wa-line)}.rel-row span{flex:1;min-width:180px}.rel-row select{width:auto;max-width:220px;padding:5px 8px}.rel-row.add{border-bottom:0}
.cal-form input{max-width:200px}
.caps{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 8px}.caps button{border:1px solid var(--wa-line);border-radius:999px;padding:5px 13px;background:transparent;font:14px/1.4 var(--wa-serif);color:var(--wa-ink);cursor:pointer}.caps button.on{background:var(--wa-ink);color:var(--wa-paper);border-color:var(--wa-ink)}
.budget-now{margin:4px 0 0;font-size:13px}.budget-now b{color:#a33a2a;font-weight:600}
.ko{font-family:var(--wa-serif)!important;letter-spacing:0!important;text-transform:none!important}
.ko.lab{font-weight:700!important;font-size:14px!important;line-height:1.45!important;color:var(--wa-ink)!important;opacity:1!important}
.ko.sm{font-size:12.5px!important;line-height:1.5!important}

#launch{position:fixed;right:18px;bottom:196px;z-index:2147483600;width:64px;height:64px;padding:0;border:0;background:transparent;filter:drop-shadow(0 3px 6px #0005);transition:transform .2s}
#launch:hover{background:transparent;transform:translateY(-2px) rotate(3deg)}
#launch svg{width:100%;height:100%;display:block}
@media(max-width:720px){#launch{width:58px;height:58px;bottom:186px}}
#backdrop{position:fixed;inset:0;z-index:2147483601;background:#0a0a0a8c;backdrop-filter:grayscale(1)}
#panel{position:fixed;z-index:2147483602;left:50%;top:50%;transform:translate(-50%,-50%);width:min(1280px,96vw);height:min(880px,92vh);
  display:grid;grid-template-columns:200px minmax(0,1fr) 248px;background:var(--wa-grain),var(--wa-paper);color:var(--wa-ink);border:1.5px solid var(--wa-ink);border-radius:6px;box-shadow:0 30px 90px #0007;overflow:hidden}

.side{position:relative;display:flex;flex-direction:column;padding:28px 16px 18px;background:var(--wa-grain),var(--wa-side);color:var(--wa-side-ink);min-width:0}
.side:after{content:"";position:absolute;top:10px;bottom:10px;right:-1px;border-right:2px dashed #ece8df55;pointer-events:none}
.brand{display:flex;align-items:center;gap:10px;padding:0 6px 26px}
.brand-mark{width:44px;height:44px;flex:none;color:var(--wa-side-ink)}
.brand b{display:block;font:700 18px/1.2 var(--wa-serif);letter-spacing:-.5px}
.brand small{display:block;font:7.5px/1.8 var(--wa-mono);letter-spacing:2.4px;color:#ece8df99;white-space:nowrap}
.nav-label{font:9px var(--wa-mono);letter-spacing:3px;color:#ece8df80;padding:6px 12px 10px}
nav{display:flex;flex-direction:column;gap:4px}
nav button{display:flex;align-items:center;gap:11px;width:100%;text-align:left;border:1px solid transparent;color:#ece8dfcc;padding:10px 12px;font-size:13px}
nav button:hover{background:#ece8df14;color:#fff}
nav button .n{margin-left:auto;font:10px var(--wa-mono);opacity:.6}
nav button.on{background:#ece8df;color:#151515;font-weight:700;
  -webkit-mask:radial-gradient(circle at 0 50%,#0000 6px,#000 6.5px) left/51% 100% no-repeat,radial-gradient(circle at 100% 50%,#0000 6px,#000 6.5px) right/51% 100% no-repeat;
  mask:radial-gradient(circle at 0 50%,#0000 6px,#000 6.5px) left/51% 100% no-repeat,radial-gradient(circle at 100% 50%,#0000 6px,#000 6.5px) right/51% 100% no-repeat}
.side-bottom{margin-top:auto;padding-top:20px;display:grid;gap:8px}
.side-bottom button{display:flex;align-items:center;gap:8px;border:1px solid #ece8df55;color:var(--wa-side-ink);font-size:12px}
.side-bottom button:hover{background:#ece8df14}
.side-bottom small{font:9.5px var(--wa-mono);color:#ece8df80;letter-spacing:.5px;padding:0 4px}

.work{display:flex;flex-direction:column;min-width:0;min-height:0}
.top{display:flex;align-items:center;gap:12px;padding:18px 28px;border-bottom:1.5px solid var(--wa-ink)}
.top select{max-width:340px}
.top .grow{flex:1}
.round{width:42px;height:42px;padding:0;border-radius:50%!important;display:grid;place-items:center;border:1px solid var(--wa-ink)}
main{flex:1;overflow:auto;padding:30px 30px 60px}
.eyebrow{display:flex;align-items:center;gap:10px;font:10.5px var(--wa-mono);letter-spacing:3px;opacity:.75;margin:0 0 8px}
.eyebrow:after{content:"";flex:1;max-width:220px;border-top:1px dashed currentColor;opacity:.6}
h1{font:800 28px/1.3 var(--wa-serif);letter-spacing:-.5px;margin:0 0 10px;overflow-wrap:anywhere}
h2{font:700 17px/1.4 var(--wa-serif);margin:0 0 10px}
.intro{color:var(--wa-muted);margin:0 0 22px;max-width:760px;text-align:justify;white-space:pre-wrap}
.msg{font-size:13px;margin:0 0 16px;padding:9px 13px;border:1.5px dashed currentColor;border-radius:3px;white-space:pre-wrap}
.msg.bad{color:#a3321f}:host([data-theme=dark]) .msg.bad{color:#f0a18f}
.paper{background:var(--wa-grain),var(--wa-paper);border:1.5px solid var(--wa-ink);border-radius:4px;box-shadow:4px 4px 0 var(--wa-ink);padding:20px 22px;margin:0 4px 22px 0}
.paper .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.sub{color:var(--wa-muted);font-size:12.5px}
.pill{display:inline-block;font:10px/1.6 var(--wa-mono);letter-spacing:1.5px;text-transform:uppercase;border:1px solid var(--wa-ink);border-radius:2px;padding:1px 7px;transform:rotate(-2deg);white-space:nowrap}
pre{white-space:pre-wrap;word-break:break-word;font:12.5px/1.65 var(--wa-mono);margin:12px 0 0;max-height:340px;overflow:auto;background:var(--wa-field);border:1px dashed var(--wa-field-line);border-radius:3px;padding:14px}

/* admission stubs */
.stubs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 24px}
.stub{position:relative;text-align:left;background:var(--wa-grain),var(--wa-paper);border:0;border-radius:0;padding:16px 16px 26px;outline:1.5px solid var(--wa-ink);outline-offset:-6px;filter:drop-shadow(0 2px 3px #0002);
  -webkit-mask:radial-gradient(circle at 0 50%,#0000 7px,#000 7.5px) left/51% 100% no-repeat,radial-gradient(circle at 100% 50%,#0000 7px,#000 7.5px) right/51% 100% no-repeat;
  mask:radial-gradient(circle at 0 50%,#0000 7px,#000 7.5px) left/51% 100% no-repeat,radial-gradient(circle at 100% 50%,#0000 7px,#000 7.5px) right/51% 100% no-repeat}
.stub:hover{background:var(--wa-grain),var(--wa-soft)}
.stub:after{content:"";position:absolute;left:14px;right:14px;bottom:10px;height:7px;opacity:.35;background:repeating-linear-gradient(90deg,currentColor 0 1px,#0000 1px 3px,currentColor 3px 5px,#0000 5px 7px)}
.stub strong{display:block;font:800 26px/1.2 var(--wa-serif)}
.stub small{font-size:11.5px;color:var(--wa-muted)}

/* entity cards */
.toolbar{display:flex;gap:10px;align-items:center;margin:0 0 18px}
.search{position:relative;flex:1;max-width:360px}
.search input{padding-left:36px}
.search .icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--wa-muted)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px;padding:0 4px 4px 0}
.card{position:relative;display:flex;flex-direction:column;justify-content:flex-start;align-items:stretch;width:100%;text-align:left;padding:16px 18px 14px;background:var(--wa-grain),var(--wa-paper);border:1.5px solid var(--wa-ink);border-radius:4px;box-shadow:3px 3px 0 var(--wa-ink)}
.card:hover{background:var(--wa-grain),var(--wa-paper);transform:translate(-1px,-1px);box-shadow:4px 4px 0 var(--wa-ink)}
.card .nm{font:700 17px/1.35 var(--wa-serif);padding-right:48px;overflow-wrap:anywhere}
.card .al{font:10.5px/1.5 var(--wa-mono);color:var(--wa-muted);letter-spacing:.3px;margin-top:2px;overflow-wrap:anywhere}
.card .pin{position:absolute;right:12px;top:14px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0}
.chip{font-size:11.5px;line-height:1.5;padding:2px 10px;border:1px solid var(--wa-ink);border-radius:999px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chip:nth-child(even){border-radius:2px}
.fact .past,.sec .past,.state .past{display:block;margin-top:3px;font-size:11.5px;color:var(--wa-muted)}.pending{display:block;margin-top:4px;font-size:12px}
.card .hit{margin:8px 0 0;font-size:12.5px;color:var(--wa-muted)}.card .hit mark{background:var(--accent-soft,#f3e2a8);color:inherit;padding:0 1px;border-radius:2px}
.card .snip{margin:10px 0 12px;font-size:12.5px;color:var(--wa-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-align:justify}
.card .foot{margin-top:auto;margin-bottom:0;padding-top:8px;padding-top:8px;border-top:1px dashed var(--wa-line);font:9.5px var(--wa-mono);letter-spacing:1.5px;color:var(--wa-muted);display:flex;justify-content:space-between}
.empty{padding:40px 20px;text-align:center;border:1.5px dashed var(--wa-line);border-radius:4px;color:var(--wa-muted)}
.empty h2{color:var(--wa-ink)}

/* detail sheet */
.sheet-head{display:flex;gap:18px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
.sheet-head .al{font:11px var(--wa-mono);color:var(--wa-muted);letter-spacing:.5px;margin:-4px 0 0}
.facts{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 6px}
.fact{min-width:120px;max-width:100%;padding:10px 18px 12px;background:var(--wa-grain),var(--wa-paper);outline:1.2px solid var(--wa-ink);outline-offset:-4px;
  -webkit-mask:radial-gradient(circle at 0 50%,#0000 5px,#000 5.5px) left/51% 100% no-repeat,radial-gradient(circle at 100% 50%,#0000 5px,#000 5.5px) right/51% 100% no-repeat;
  mask:radial-gradient(circle at 0 50%,#0000 5px,#000 5.5px) left/51% 100% no-repeat,radial-gradient(circle at 100% 50%,#0000 5px,#000 5.5px) right/51% 100% no-repeat}
.fact small{display:block;font:9.5px var(--wa-mono);letter-spacing:1.5px;color:var(--wa-muted)}
.fact b{font:700 15px var(--wa-serif);overflow-wrap:anywhere}
.sec{padding:16px 0 4px;border-top:1px dashed var(--wa-line);margin-top:14px}
.sec small,.state small{display:block;font:10px var(--wa-mono);letter-spacing:2px;color:var(--wa-muted);margin-bottom:6px}
.sec p,.state p{margin:0;white-space:pre-wrap;text-align:justify;overflow-wrap:anywhere}
.tt-wrap{overflow-x:auto;margin:4px 0 8px}.tt{border-collapse:collapse;font-size:13px;min-width:100%}.tt th,.tt td{border:1px solid var(--wa-line);padding:6px 8px;vertical-align:top;text-align:left}.tt thead th{font:10px var(--wa-mono);letter-spacing:1px;color:var(--wa-muted)}.tt td small{display:block}.tt td.wide{opacity:.5;font-style:italic}.tt-clash{border:1.5px dashed var(--wa-ink);border-radius:3px;padding:8px 10px;margin:4px 0 8px}.tt-clash p{margin:4px 0}.tt-form{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}.tt-form input{min-width:0;flex:1 1 120px}
.roster-add{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px}.roster-add select{max-width:100%}
.state{margin-top:18px;padding:14px 16px;border:1.5px dashed var(--wa-ink);border-radius:3px}
.meta{margin-top:20px;font:10px var(--wa-mono);letter-spacing:1px;color:var(--wa-muted)}
.actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:20px}
.actions .grow{flex:1}

/* forms */
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 14px}
.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px}
.extra-row{display:grid;grid-template-columns:minmax(0,180px) minmax(0,1fr) auto;gap:8px;align-items:start;margin-top:8px}
.check{display:flex;gap:8px;align-items:center;margin-top:16px;font-size:13px}.check input{width:auto}
.ask{display:inline-flex;flex-wrap:wrap;gap:8px;align-items:center;padding:6px 10px;border:1.5px dashed #a3321f;border-radius:3px;color:#a3321f;font-size:13px}
:host([data-theme=dark]) .ask{border-color:#f0a18f;color:#f0a18f}
.back{display:inline-flex;align-items:center;gap:4px;border:0;padding:4px 0;margin:0 0 14px;color:var(--wa-muted);font-size:13px}
.back:hover{background:transparent;color:var(--wa-ink)}

/* rail */
.rail{border-left:1.5px solid var(--wa-ink);padding:26px 20px;overflow:auto;display:flex;flex-direction:column;gap:14px}
.rail-title{font:10.5px var(--wa-mono);letter-spacing:2px;text-transform:uppercase}
.rail .room{font:700 16px/1.4 var(--wa-serif);overflow-wrap:anywhere}
.chart{position:relative;width:150px;height:150px;margin:6px auto 0}
.chart svg{width:100%;height:100%}
.chart .num{position:absolute;inset:0;display:grid;place-content:center;text-align:center}
.chart .num b{font:800 22px/1 var(--wa-serif)}
.chart .num small{font:9px var(--wa-mono);letter-spacing:1.5px;color:var(--wa-muted);margin-top:4px}
.rail hr{border:0;border-top:1.5px dashed var(--wa-line);margin:4px 0;width:100%}
.rail p{margin:0;font-size:12px;color:var(--wa-muted);text-align:justify}
.rail .row{display:flex;flex-wrap:wrap;gap:6px}

/* automatic updates */
.auto-line{display:flex;gap:8px;align-items:flex-start}.auto-line .dot{margin-top:6px}
/* v0.8.4: 정리할 모델 band — the one coloured strip on the page */
.model-band{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;margin:0 0 18px;padding:10px 14px;background:#f5e3b5;color:#3d2a05;border:1.5px solid #a8741a;border-left-width:6px;border-radius:3px;font:600 13.5px/1.5 var(--wa-serif)}
.model-band button{flex:none;background:#a8741a;color:#fff8e6;border:1.5px solid #a8741a;font-weight:700}
.model-band button:hover{background:#8a5e12;border-color:#8a5e12}
.model-band.small{margin:0;padding:8px 10px;font-size:12px}
:host([data-theme=dark]) .model-band{background:#3b2d12;color:#f6e2b0;border-color:#d9a640}
:host([data-theme=dark]) .model-band button{background:#d9a640;color:#241a05;border-color:#d9a640}
.pick-flash{outline:3px solid #d9a640;outline-offset:2px}
.dot{display:inline-block;flex:none;width:8px;height:8px;border-radius:50%;border:1.5px solid var(--wa-ink)}
.dot.on{background:var(--wa-ink)}
.dot.run{background:var(--wa-ink);animation:blink 1s infinite}
@keyframes blink{50%{opacity:.25}}
.err{color:#a3321f;font-size:12.5px}:host([data-theme=dark]) .err{color:#f0a18f}
.toggle{display:flex;gap:10px;align-items:center;font-size:14px;cursor:pointer}
.toggle input{appearance:none;-webkit-appearance:none;width:44px;height:24px;border-radius:999px;border:1.5px solid var(--wa-ink);background:var(--wa-field);position:relative;padding:0;flex:none;cursor:pointer}
.toggle input:before{content:"";position:absolute;top:3px;left:3px;width:15px;height:15px;border-radius:50%;background:var(--wa-ink);transition:transform .15s}
.toggle input:checked{background:var(--wa-ink)}.toggle input:checked:before{background:var(--wa-paper);transform:translateX(20px)}
.auto-tag{font:9.5px var(--wa-mono);letter-spacing:1px;margin-left:6px;opacity:.7}
.hist{list-style:none;margin:0;padding:0}
.hist li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;padding:12px 0;border-top:1px dashed var(--wa-line)}
.hist li:first-child{border-top:0}
.hist .what{overflow-wrap:anywhere}.hist .what b{font-family:var(--wa-serif)}
.hist .ev{grid-column:1;font-size:12.5px;color:var(--wa-muted);text-align:justify}
.hist .when{font:10px var(--wa-mono);letter-spacing:1px;color:var(--wa-muted)}
.hist li.undone .what{text-decoration:line-through;opacity:.55}
.hist .side-act{grid-row:1/span 3;grid-column:2;align-self:center}
@media(max-width:1080px){#panel{grid-template-columns:190px minmax(0,1fr)}.rail{display:none}}
@media(max-width:720px){
  #panel{inset:0;left:0;top:0;transform:none;width:100vw;height:100dvh;border:0;border-radius:0;grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}
  .side{padding:12px 12px 8px}
  .side:after{top:auto;left:8px;right:8px;bottom:-1px;border-right:0;border-bottom:2px dashed #ece8df55}
  .brand{padding:0 52px 10px 2px}.brand-mark{width:32px;height:32px}.brand b{font-size:16px}
  .nav-label,.side-bottom{display:none}
  nav{flex-direction:row;overflow-x:auto;gap:4px;scrollbar-width:none}
  nav button{width:auto;flex:none;padding:7px 11px;font-size:12.5px;gap:6px}nav button .n{margin-left:2px}
  nav button .icon{width:15px;height:15px}
  .top{padding:10px 14px}.top select{max-width:none}
  #themeToggle{width:36px;height:36px}
  #close{position:fixed;right:12px;top:12px;z-index:5;background:#f3efe7;color:#151515;border:1.5px solid #151515;width:38px;height:38px}
  :host([data-theme=dark]) #close{background:#262522;color:#f3efe7;border-color:#f3efe7}
  main{padding:20px 16px 50px}
  h1{font-size:23px}
  .stubs{grid-template-columns:repeat(2,minmax(0,1fr))}
  .cards{grid-template-columns:1fr}
  .toolbar{flex-wrap:wrap}.search{max-width:none;flex:1 1 100%}.toolbar>span{display:none}.toolbar>.primary{flex:1}
  .grid3,.grid2{grid-template-columns:1fr}
  .extra-row{grid-template-columns:1fr auto}.extra-row textarea{grid-column:1/-1}
  .paper{padding:16px}
  .mobile-only{display:block!important}
}
.mobile-only{display:none}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
/* 기억 서재의 「세계관」 칸 안: no button, no backdrop, the window fills the tab */
:host([data-embedded]){display:block;height:100%}
:host([data-embedded]) #launch,:host([data-embedded]) #backdrop,:host([data-embedded]) #close{display:none!important}
:host([data-embedded]) #panel{position:relative;left:auto;top:auto;transform:none;width:100%;height:100%;min-height:560px;z-index:auto;box-shadow:none;border-radius:0}
/* ===== v0.6.0 세계관 칸 (시안 C · E · F · G, 사용자 확정 2026-11-21) — 기억 서재 클래스 이름(subtabs · world-card · rail-stat …)을 그대로 씀 ===== */
:host{--wt-cream:#f3efe2;--wt-cream-line:#ddd5bf;--wt-c1:#e3e8f2;--wt-c1-line:#c9d2e3;--wt-c3:#ecebe8;--wt-c3-line:#d6d4cf;--wt-c4:#dfe6e9;--wt-c4-line:#c5d0d5;--wt-c6:#eef0f6;--wt-c6-line:#d3d8e6;--wt-c7:#e6ece4;--wt-c7-line:#cad6c6;--wt-c8:#ece6ee;--wt-c8-line:#d6cbdb;
  --wt-white:#fff;--wt-night:#1b1c22;--wt-night-ink:#eeebe3;--wt-night-sub:#a9adbd;--wt-blue:#4c5d8f;--wt-gothic:"Gowun Batang","Nanum Myeongjo","Noto Serif KR",Georgia,serif}
:host([data-theme=dark]){--wt-cream:#2a2721;--wt-cream-line:#4a4437;--wt-c1:#252a33;--wt-c1-line:#3a4252;--wt-c3:#292826;--wt-c3-line:#413f3b;--wt-c4:#242a2c;--wt-c4-line:#3a4649;--wt-c6:#272930;--wt-c6-line:#3e4250;--wt-c7:#252a24;--wt-c7-line:#3c4639;--wt-c8:#2a262c;--wt-c8-line:#453c49;
  --wt-white:#1f1e1c;--wt-night:#0d0d0c;--wt-night-ink:#ece8df;--wt-night-sub:#a39d92;--wt-blue:#a9b6d8}
.subtabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 16px}
.subtab{border:1px solid var(--wa-line);background:var(--wa-paper);color:var(--wa-ink);border-radius:999px;padding:5px 12px;font-size:11px;line-height:1.6}
.subtab:hover{background:var(--wa-soft)}.subtab.selected{background:var(--wa-ink);color:var(--wa-paper);border-color:var(--wa-ink)}
.wt-years{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 6px;align-items:center}.wt-years>span{font-size:11px;color:var(--wa-muted);margin-right:4px}
.wt-year{padding:5px 14px;border:1px solid var(--wa-ink);border-radius:999px;font:600 13px var(--wt-gothic);line-height:1.4}
.wt-year.past{opacity:.55}.wt-year.now{background:var(--wa-ink);color:var(--wa-paper)}.wt-year.next{border-style:dashed;opacity:.75}
.wt-year.none{border:1px dashed var(--wa-line);font:12px var(--wa-sans);color:var(--wa-muted)}.wt-year.on{outline:2px solid var(--wa-ink);outline-offset:2px}.wt-year.now.on{outline:0}
.wt-eyebrow{font:10px var(--wa-mono);letter-spacing:2px;color:var(--wa-muted);margin:18px 0 2px;display:flex;align-items:center;gap:10px}.wt-eyebrow:after{content:"";flex:1;max-width:220px;border-top:1px dashed currentColor;opacity:.6}
.wt-h1{margin:0 0 4px}.wt-h1 span{font-size:18px;color:var(--wa-muted);font-weight:700}.wt-lead{margin:0 0 6px;color:var(--wa-muted)}
.wt-find{width:100%;margin:10px 0 0;padding:9px 14px;border:1px solid var(--wa-line);border-radius:999px;background:transparent}
.wt-sec{margin:22px 0 8px;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700}.wt-sec:after{content:"";flex:1;border-top:1px dashed var(--wa-line)}
.wt-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.cap{display:inline-block;padding:3px 11px;border:1px solid var(--wa-ink);border-radius:999px;font-size:11px;line-height:1.6;white-space:nowrap;background:transparent;max-width:100%;overflow:hidden;text-overflow:ellipsis}
button.cap:hover{background:var(--wa-soft)}.cap.ghost{border-style:dashed;color:var(--wa-muted)}
.world-card{border-top:1px solid var(--wa-line);padding:12px 0}.world-card h3{margin:0 0 6px;display:flex;align-items:center;gap:8px;font:700 15px var(--wa-serif)}.world-card h3 button{border:0;padding:0;font:inherit}
.world-field{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:4px 0}.world-field>span{flex:0 0 64px;font-size:11px}
.wt-grp{font-size:11px;color:var(--wa-muted);margin:6px 0 3px}
.wt-rule{display:flex;align-items:flex-start;gap:12px;padding:11px 0;border-bottom:1px solid var(--wa-line)}
.wt-rule .tcap{flex:none;width:74px;box-sizing:border-box;text-align:center;border:1px solid var(--wa-line);border-radius:999px;padding:2px 6px;margin-top:2px;font:12px/1.5 var(--wa-sans);letter-spacing:0;color:var(--wa-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wt-rule .tcap.none{border-style:dashed;color:var(--wa-muted)}
.wt-rule .rb{min-width:0;flex:1}.wt-rule .rt{display:inline;border:0;padding:0;background:transparent;text-align:left;color:var(--wa-ink);font:700 15px/1.45 var(--wa-serif);letter-spacing:0;cursor:pointer}
.wt-rule .rt:hover{text-decoration:underline}.wt-rule .kind{margin-left:6px;font-size:12px;color:var(--wa-muted)}
.wt-rule .rd{margin:3px 0 0;color:var(--wa-ink);opacity:.86;font-size:13.5px;line-height:1.6;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.emb-view{display:flex;justify-content:flex-end;margin:-6px 0 10px}.emb-view .view-lang{margin-right:0}
.view-lang{display:inline-flex;flex:none;white-space:nowrap;align-items:center;gap:2px;border:1px solid var(--wa-line);border-radius:999px;padding:2px;margin-right:8px}.view-lang small{font-size:12px;color:var(--wa-muted);padding:0 6px 0 8px}
.view-lang button{border:0;border-radius:999px;padding:3px 11px;background:transparent;color:var(--wa-ink);font:12.5px/1.5 var(--wa-sans);letter-spacing:0;cursor:pointer}.view-lang button.on{background:var(--wa-ink);color:var(--wa-paper)}
.back-check{margin:14px 0 0;padding:12px 14px;border:1px solid var(--wa-ink);border-radius:10px}.back-check h4{margin:0 0 8px;font:700 14px/1.45 var(--wa-serif)}.back-check dl{margin:0}.back-check dt{font-size:12.5px;color:var(--wa-muted);margin-top:8px}.back-check dd{margin:2px 0 0}.back-check dd.to{font-family:var(--wa-serif)}
.wt-rgrp{margin:16px 0 2px;font:700 14px/1.45 var(--wa-serif);letter-spacing:0;color:var(--wa-ink)}.wt-rgrp small{font:12.5px var(--wa-sans);color:var(--wa-muted);margin-left:6px}
.caps button .rec{font-size:10.5px;margin-left:6px;padding:0 6px;border:1px dashed currentColor;border-radius:9px;opacity:.85;font-weight:600}.budget-rec{margin:6px 0 0}.law-out{margin:6px 0 0}
.topic-bar{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}.topic-bar .cap{font-size:12.5px;padding:3px 12px;border-color:var(--wa-line);color:var(--wa-ink);cursor:pointer}
.topic-bar .cap.on{background:var(--wa-ink);border-color:var(--wa-ink);color:var(--wa-paper)}.topic-bar .cap small{opacity:.7;margin-left:3px}.topic-bar .cap.opt{border-style:dashed}
.wt-empty{color:var(--wa-muted);font-size:12.5px;margin:6px 0}
/* 시간표 (시안 E) */
.wt-tt{width:100%;border-collapse:separate;border-spacing:6px 0;table-layout:fixed;margin:0 -6px}
.wt-tt th{font:600 15px/1.2 var(--wt-gothic);padding:8px 0 10px;border-bottom:1.5px solid var(--wa-ink);text-align:center}
.wt-tt th small{display:block;font:9px var(--wa-mono);letter-spacing:2px;color:var(--wa-muted);margin-top:3px}
.wt-tt th.today{background:var(--wt-cream);border-radius:10px 10px 0 0}.wt-tt th.blank{width:64px;border:0}
.wt-tt td{vertical-align:top;padding:3px 0}.wt-tt td.t{width:64px;text-align:right;padding:10px 6px 0 0;font-size:11px;color:var(--wa-muted)}.wt-tt td.t b{display:block;color:var(--wa-ink);font:600 12px var(--wt-gothic)}
.wt-tt td.todaycol{background:var(--wt-cream);padding:3px 4px}.wt-tt td.todaycol.end{border-radius:0 0 10px 10px;padding-bottom:7px}.wt-tt th.today{padding-left:4px;padding-right:4px}
.wt-c{border-radius:12px;padding:10px 10px 9px;height:100%;min-height:58px;border:1px solid transparent;text-align:left;width:100%;display:block}
.wt-c b{display:block;font:600 14px/1.25 var(--wt-gothic);overflow-wrap:anywhere}.wt-c small{display:block;font-size:10px;color:var(--wa-muted);margin-top:3px}
.wt-c.s1{background:var(--wt-c1);border-color:var(--wt-c1-line)}.wt-c.s2{background:var(--wt-cream);border-color:var(--wt-cream-line)}.wt-c.s3{background:var(--wt-c3);border-color:var(--wt-c3-line)}
.wt-c.s4{background:var(--wt-c4);border-color:var(--wt-c4-line)}.wt-c.s5{background:var(--wt-c6);border-color:var(--wt-c6-line)}.wt-c.s6{background:var(--wt-c7);border-color:var(--wt-c7-line)}.wt-c.s7{background:var(--wt-c8);border-color:var(--wt-c8-line)}
.wt-c.changed{background:var(--wt-white);border-color:var(--wa-ink)}.wt-c.wide{opacity:.55}
.wt-was{font-size:10px;color:var(--wt-blue);margin-top:4px}
.wt-free{border:1px dashed var(--wa-line);border-radius:12px;min-height:58px}
.wt-lunch td{padding:0}.wt-lunch td.l{text-align:center;font-size:11px;color:var(--wa-muted);letter-spacing:6px;padding:4px 0;border-top:1px dashed var(--wa-line);border-bottom:1px dashed var(--wa-line)}
.wt-night{background:var(--wt-night);color:var(--wt-night-ink);border-radius:12px;padding:10px;position:relative;overflow:hidden;min-height:58px;border:1px solid var(--wt-night);text-align:left;width:100%;display:block}
:host([data-theme=dark]) .wt-night{border-color:var(--wa-field-line)}
.wt-night b{display:block;color:var(--wt-night-ink);font:600 14px/1.25 var(--wt-gothic)}.wt-night small{display:block;color:var(--wt-night-sub);font-size:10px;margin-top:3px}
.wt-night i{position:absolute;width:2px;height:2px;border-radius:50%;background:var(--wt-night-ink);opacity:.75}
.wt-clash{font-size:12px;margin:6px 0;color:var(--wa-muted)}
.wt-dtab{display:none;gap:6px;margin:6px 0 14px}.wt-dtab button{flex:1;text-align:center;padding:8px 0;border:1px solid var(--wa-ink);border-radius:999px;font:600 14px var(--wt-gothic)}
.wt-dtab button.td{background:var(--wt-cream)}.wt-dtab button.on{background:var(--wa-ink);color:var(--wa-paper)}
.wt-day{display:none}.wt-drow{display:grid;grid-template-columns:58px minmax(0,1fr);gap:10px;margin-bottom:8px;align-items:stretch}
.wt-drow .t{text-align:right;font-size:11px;color:var(--wa-muted);padding-top:10px}.wt-drow .t b{display:block;color:var(--wa-ink);font:600 12px var(--wt-gothic)}
.wt-dlunch{text-align:center;font-size:11px;letter-spacing:6px;color:var(--wa-muted);border-top:1px dashed var(--wa-line);border-bottom:1px dashed var(--wa-line);padding:4px 0;margin:4px 0 10px 68px}
/* 학사일정 (시안 F) */
.wt-mon{display:flex;align-items:baseline;gap:10px;margin:22px 0 8px}.wt-mon b{font:600 20px var(--wt-gothic)}.wt-mon small{font:9px var(--wa-mono);letter-spacing:2px;color:var(--wa-muted)}
.wt-mon:after{content:"";flex:1;border-top:1.5px solid var(--wa-ink);transform:translateY(-5px)}
.wt-newyear{display:flex;align-items:center;gap:12px;margin:28px 0 4px}.wt-newyear b{font:600 26px var(--wt-gothic)}.wt-newyear:after{content:"";flex:1;border-top:3px double var(--wa-ink)}
.wt-ev{display:grid;grid-template-columns:62px minmax(0,1fr) auto;gap:12px;align-items:center;padding:9px 12px;border-radius:12px;margin:6px 0;background:var(--wa-paper);border:1px solid var(--wa-line);width:100%;text-align:left;font-weight:400}
.wt-ev:hover{background:var(--wa-paper);filter:brightness(.98)}
.wt-ev .d{text-align:center;font:600 20px/1 var(--wt-gothic)}.wt-ev .d small{display:block;font:10px var(--wa-mono);color:var(--wa-muted);margin-top:4px;letter-spacing:1px}
.wt-ev .n b{display:block;font:600 15px var(--wt-gothic);overflow-wrap:anywhere}.wt-ev .n small{color:var(--wa-muted);font-size:11px}
.wt-ev .k{font-size:11px;padding:3px 10px;border-radius:999px;border:1px solid var(--wa-ink);white-space:nowrap}
.wt-ev.past{opacity:.45}.wt-ev.c1{background:var(--wt-c1);border-color:var(--wt-c1-line)}.wt-ev.c2{background:var(--wt-cream);border-color:var(--wt-cream-line)}.wt-ev.c3{background:var(--wt-c3);border-color:var(--wt-c3-line)}
.wt-ev.next{background:var(--wt-night);color:var(--wt-night-ink);border-color:var(--wt-night)}:host([data-theme=dark]) .wt-ev.next{background:#2b2924;border-color:#e8dfc4}
.wt-ev.next .n small,.wt-ev.next .d small{color:var(--wt-night-sub)}.wt-ev.next .k{border-color:var(--wt-night-ink)}
.wt-ev.cancel .n b{text-decoration:line-through}.wt-ev.cancel .k{border-style:dashed;color:var(--wa-muted)}.wt-ev.noyear{border-style:dashed}
.wt-today{display:flex;align-items:center;gap:8px;margin:12px 0;color:var(--wt-blue);font-size:11px;font-weight:700}
.wt-today:before{content:"";width:9px;height:9px;border-radius:50%;background:var(--wt-blue)}.wt-today:after{content:"";flex:1;border-top:1.5px solid var(--wt-blue)}
.wt-ev .was{color:var(--wt-blue);font-size:10px;margin-left:6px}
/* 오른쪽 칸 (기억 서재 inspector와 같은 모양) */
.rail-stat{display:flex;align-items:center;gap:14px;padding:8px 0}.rail-stat b{flex:none;width:64px;height:64px;border-radius:50%;display:grid;place-items:center;font:700 15px var(--wa-serif);color:#151515;
  background:radial-gradient(circle,#151515 0 1.6px,#f4f1ea 2.2px 14px,#151515 14.5px 15.5px,#0000 16px),repeating-radial-gradient(circle,#151515 0 1.1px,#2a2a2a 1.5px 2.4px);box-shadow:0 3px 8px #0004;transition:transform .6s}
.rail-stat:hover b{transform:rotate(200deg)}
.rail-stat span{font-size:13px;line-height:1.5}.rail-stat small{display:block;font-size:11px;color:var(--wa-muted)}
.rail-divider{border-top:1.5px dashed var(--wa-line);margin:18px 0}.rail-note h3{font:700 13px var(--wa-serif);margin:0 0 6px}.rail-note p{font-size:11px;color:var(--wa-muted);margin:0;line-height:1.8}
/* 기억 서재의 「세계관」 칸 안: 옆 메뉴 · 위 · 오른쪽 칸 없이 내용만(기억 서재가 그 셋을 가짐) */
:host([data-embedded]) #panel{grid-template-columns:minmax(0,1fr);border:0;background:transparent}
:host([data-embedded]) .side,:host([data-embedded]) .top,:host([data-embedded]) .rail{display:none!important}
:host([data-embedded]) main{padding:24px 30px 40px}
@media(max-width:720px){
  .wt-tt{display:none}.wt-dtab{display:flex}.wt-day.on{display:block}
  .wt-rule{gap:10px}.wt-rule .tcap{width:64px;font-size:11.5px}
  .view-lang{margin-right:4px}.view-lang small{display:none}.view-lang button{padding:3px 8px}
  .wt-ev{grid-template-columns:46px minmax(0,1fr) auto;gap:8px;padding:8px 10px}.wt-ev .k{font-size:10px;padding:2px 7px}
  :host([data-embedded]) main{padding:16px 14px 40px}
}
`;

  // ------------------------------------------------------------------ mount
  // One screen per call: on its own (target null: the floating button and window, as before) or inside a box that
  // 기억 서재 gives (embedded). Everything below belongs to that one screen.
  function boot(target, opts = {}) {
  const host = document.createElement('div');
  host.id = target ? 'marinara-world-archive-tab' : 'marinara-world-archive-root';
  if (target) host.setAttribute('data-embedded', '');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style>
    <button id="launch" type="button" aria-label="세계관 설정집 열기" aria-expanded="false">${LAUNCH_ICON}</button>
    <div id="backdrop" hidden></div>
    <section id="panel" role="dialog" aria-modal="true" aria-label="세계관 설정집" hidden>
      <aside class="side"></aside>
      <div class="work"><div class="top"></div><main></main></div>
      <aside class="rail"></aside>
    </section>`;
  (target || document.body || document.documentElement).append(host);
  const $ = (s) => root.querySelector(s);
  const el = { launch: $('#launch'), backdrop: $('#backdrop'), panel: $('#panel'), side: $('.side'), top: $('.top'), main: $('main'), rail: $('.rail') };

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const store = {
    get(k, d = '') { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const st = {
    viewKo: store.get('world-archive-view') === 'ko',
    theme: opts.theme || store.get('world-archive-theme') || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    readOnly: false, // the server's contract level is not the one this screen was made for
    fields: {},
    worlds: [],
    worldId: store.get('world-archive-world') || null,
    entities: [],
    room: null,
    roomName: '',
    preview: null,
    view: 'tabs', // tabs (v0.6.0 세계관 칸) | overview | <type> | world | new-world
    tab: null, // 세계관 칸: 'world' | 'unknown' | a big place's id
    year: null, // 학년도 shown (null: the story's now)
    tabQuery: '',
    ttDay: null, // 시간표 on a phone: the day shown
    rosterOpen: new Set(),
    fromTabs: false, // a card opened from the 세계관 칸: 「돌아가기」 goes back there
    detail: null, // entityId shown in full
    editing: null, // entityId | 'new'
    draft: null, // form values kept while switching kind in the form
    ask: null, // which delete is waiting for a second press
    query: '',
    msg: '',
    bad: false,
    busy: false,
    loaded: false,
    auto: null, // this room's automatic-update status
    history: [],
    connections: null,
    pairs: [], // 같은 사람일 수 있음: [{ a, b, why }]
    dupes: false, // the person list shows those pairs instead
  };

  const activeChatId = () => store.get('marinara-active-chat-id', '');
  const world = () => st.worlds.find((w) => w.worldId === st.worldId) || null;

  async function api(method, path, body) {
    if (st.readOnly && method !== 'GET') throw Error(UPDATE_MSG);
    const init = { method, credentials: 'same-origin', cache: 'no-store', headers: { 'x-marinara-csrf': '1' } };
    if (method !== 'GET') {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body ?? {});
    }
    let res;
    try {
      res = await fetch(path.startsWith('/api/') ? path : BASE + path, init);
    } catch {
      throw Error('서버에 연결하지 못했습니다. 마리나라가 다시 켜지는 중이라면 잠시 뒤에 다시 시도해 주세요.');
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { error: text.slice(0, 200) }; }
    if (res.status === 404 && path === '/status') throw Error('서버에 World Archive 모듈이 없거나 꺼져 있습니다. 서버 쪽 설치를 먼저 확인해 주세요.');
    if (res.status === 401) throw Error('마리나라 로그인이 끝났습니다. 페이지를 새로 고쳐 다시 로그인해 주세요.');
    if (!res.ok) throw Error(data?.error || `서버 오류 (${res.status})`);
    return data;
  }

  async function run(fn, ok) {
    if (st.busy) return;
    st.busy = true;
    st.msg = '';
    try {
      await fn();
      if (ok) { st.msg = ok; st.bad = false; }
    } catch (e) {
      st.msg = e?.message || String(e);
      st.bad = true;
    } finally {
      st.busy = false;
      render();
    }
  }

  // ------------------------------------------------------------------ loading
  async function loadWorlds() {
    st.worlds = (await api('GET', '/worlds')).worlds || [];
    if (!world()) {
      const linked = st.room?.worldId && st.worlds.some((w) => w.worldId === st.room.worldId) ? st.room.worldId : null;
      st.worldId = linked || st.worlds[0]?.worldId || null;
    }
    if (st.worldId) store.set('world-archive-world', st.worldId);
  }
  async function loadEntities() {
    st.entities = st.worldId ? (await api('GET', `/worlds/${st.worldId}/entities`)).entities || [] : [];
    st.relations = st.worldId ? (await api('GET', `/worlds/${st.worldId}/relations`).catch(() => ({ relations: [] }))).relations || [] : [];
    st.rosters = {};
    try { const d = st.worldId ? await api('GET', `/worlds/${st.worldId}/duplicates`) : {}; st.pairs = d.pairs || []; st.differ = d.differ || []; } catch { st.pairs = []; st.differ = []; }
    try { st.groupSuggest = st.worldId ? (await api('GET', `/worlds/${st.worldId}/group-suggestions`)).suggestions || [] : []; } catch { st.groupSuggest = []; }
    if (st.detail && !st.entities.some((e) => e.entityId === st.detail)) st.detail = null;
  }
  async function loadRoom() {
    const id = activeChatId();
    st.room = null; st.preview = null; st.roomName = '';
    if (!id) return;
    st.room = await api('GET', `/rooms/${encodeURIComponent(id)}`);
    if (st.room.worldId) st.preview = await api('GET', `/rooms/${encodeURIComponent(id)}/preview`);
    try { st.roomName = (await api('GET', `/api/chats/${encodeURIComponent(id)}`))?.name || ''; } catch {}
    st.auto = null;
    if (st.room.worldId) { try { st.auto = await api('GET', `/rooms/${encodeURIComponent(id)}/auto`); } catch {} }
    pollAuto();
  }
  async function loadHistory() {
    st.history = st.worldId ? (await api('GET', `/worlds/${st.worldId}/history`)).changes || [] : [];
  }
  /** 할 일 11: this room's board (only when the room reads the world on screen and the world has a board). */
  async function loadScores() {
    const id = activeChatId();
    st.scores = id && st.room?.worldId === st.worldId && world()?.scoreboard?.name ? await api('GET', `/rooms/${encodeURIComponent(id)}/scores`) : null;
  }
  async function loadConnections() {
    try { st.connections = (await api('GET', '/connections')).connections || []; } catch { st.connections = []; }
  }
  // While this room is being read, ask again every 1.5 s; when it ends, refresh the settings it wrote.
  let pollTimer = null;
  function pollAuto() {
    clearTimeout(pollTimer);
    if (st.auto?.job?.state !== 'running' || el.panel.hidden) return;
    pollTimer = setTimeout(async () => {
      try {
        const id = activeChatId();
        st.auto = await api('GET', `/rooms/${encodeURIComponent(id)}/auto`);
        if (st.auto.job?.state !== 'running') {
          await loadEntities();
          st.preview = await api('GET', `/rooms/${encodeURIComponent(id)}/preview`);
          if (st.view === 'log') await loadHistory();
          if (st.view === 'scores') await loadScores();
        }
      } catch {}
      if (!st.busy) render();
      pollAuto();
    }, 1500);
  }
  async function loadAll(followRoom) {
    const status = await api('GET', '/status');
    st.fields = status.fields || {};
    st.topics = status.topics || []; // v0.7.0 5
    st.serverVersion = status.version || null; // 할 일 8: the screen and the server module should be the same version
    st.readOnly = Number(status.contract || 1) !== PANEL_CONTRACT; // 연동 v2: another contract level — look, do not change
    await loadRoom();
    if (followRoom && st.room?.worldId) st.worldId = st.room.worldId;
    await loadWorlds();
    await loadEntities();
    st.loaded = true;
  }

  // ------------------------------------------------------------------ pieces
  // v0.7.6: an optional field (기숙사 · 학년) only in a world that turns it on
  // v0.7.8 C: an animal (its 종 names one) has 털 · 깃털 where a person has 머리색 — the same key, another label
  const ANIMAL_RE = /\b(?:cats?|kittens?|dogs?|pupp(?:y|ies)|hounds?|wol(?:f|ves)|fox(?:es)?|owls?|ravens?|crows?|snakes?|serpents?|rats?|mice|mouse|toads?|phoenix(?:es)?|dragons?|stags?|deer|bears?|rabbits?|hares?|horses?|ponies|pony|kneazles?|half-kneazle|leopards?|panthers?|birds?|ferrets?)\b|고양이|강아지|늑대|여우|부엉이|올빼미|까마귀|뱀|쥐|두꺼비|불사조|드래곤|사슴|곰|토끼|니즐|표범|새$|개$|말$|용$/i;
  const isAnimal = (e) => ANIMAL_RE.test(String(e?.fields?.species || '').trim());
  const defs = (type, e) => (st.fields[type] || []).filter((x) => !x.optional || (world()?.personFields || []).includes(x.key)).map((x) => (x.key === 'hair' && isAnimal(e) ? { ...x, label: '털 · 깃털' } : x));
  const count = (type) => st.entities.filter((e) => e.type === type).length;
  const fmtDate = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; };
  const shortId = (id) => String(id || '').slice(0, 4).toUpperCase();
  const roomTitle = () => esc(st.roomName || (activeChatId() ? '지금 채팅방' : '열린 채팅방 없음'));

  function sideHtml() {
    const items = [['tabs', '세계관', 'world', null], ['overview', '한눈에', 'overview', null], ...KINDS.map((k) => [k.type, k.label, k.icon, count(k.type)]), ...(world()?.scoreboard?.name ? [['scores', '점수판', 'score', null]] : []), ['log', '기록', 'log', null]];
    return `
      <div class="brand">${BRAND}<div><b>세계관 설정집</b><small>WORLD ARCHIVE</small></div></div>
      <div class="nav-label">YOUR WORLD</div>
      <nav>${items.map(([v, label, ic, n]) => `<button type="button" data-act="go" data-view="${v}" class="${st.view === v ? 'on' : ''}" ${!st.worldId && v !== 'overview' ? 'disabled' : ''}>${icon(ic)}<span>${label}</span>${n == null || !st.worldId ? '' : `<span class="n">${n}</span>`}</button>`).join('')}</nav>
      <div class="side-bottom">
        ${st.worldId ? `<button type="button" data-act="go" data-view="world">${icon('world')}세계관 정보 고치기</button>` : ''}
        <button type="button" data-act="go" data-view="new-world">${icon('star')}새 세계관 만들기</button>
        <small>세계관 설정집 v${VERSION}</small>
      </div>`;
  }

  /** v0.7.0 3: 「보기: 원문 · 한국어」 — in the top bar, and (기억 서재 칸, no top bar) at the top of the page. */
  function viewLangHtml() {
    return st.worldId ? `<span class="view-lang" role="group" aria-label="보기"><small>보기</small><button type="button" data-act="view-lang" data-lang="orig" aria-pressed="${!st.viewKo}" class="${st.viewKo ? '' : 'on'}">원문</button><button type="button" data-act="view-lang" data-lang="ko" aria-pressed="${!!st.viewKo}" class="${st.viewKo ? 'on' : ''}">한국어${st.koBusy ? ' …' : ''}</button></span>` : '';
  }
  const refreshViewLang = () => root.querySelectorAll('.view-lang').forEach((x) => { x.outerHTML = viewLangHtml(); });
  function topHtml() {
    const opts = st.worlds.map((w) => `<option value="${esc(w.worldId)}" ${w.worldId === st.worldId ? 'selected' : ''}>${esc(w.name)}${w.worldId === st.room?.worldId ? '  · 이 방' : ''}</option>`).join('');
    return `${st.worlds.length ? `<select id="worldSelect" aria-label="세계관 고르기">${opts}</select>` : '<span class="sub">아직 세계관이 없습니다</span>'}
      <span class="grow"></span>
      ${viewLangHtml()}
      <button id="themeToggle" class="round" type="button" data-act="theme" aria-label="${st.theme === 'dark' ? '밝게' : '어둡게'}">${icon(st.theme === 'dark' ? 'sun' : 'moon')}</button>
      <button id="close" class="round" type="button" data-act="close" aria-label="닫기">${icon('close')}</button>`;
  }

  function chartSvg(ratio) {
    const r = 62, c = 2 * Math.PI * r, fill = Math.max(0, Math.min(1, ratio));
    return `<svg viewBox="0 0 150 150" aria-hidden="true">
      <circle cx="75" cy="75" r="72" fill="none" stroke="currentColor" stroke-width=".8"/>
      <circle cx="75" cy="75" r="${r}" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="1.5 3" opacity=".55"/>
      <circle cx="75" cy="75" r="${r}" fill="none" stroke="currentColor" stroke-width="3.2" stroke-dasharray="${(c * fill).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 75 75)"/>
      <circle cx="75" cy="75" r="46" fill="none" stroke="currentColor" stroke-width=".6" opacity=".5"/>
      <path d="M75 0v18M75 132v18M0 75h18M132 75h18" stroke="currentColor" stroke-width=".7"/>
      <circle cx="122" cy="30" r="1.4" fill="currentColor"/><circle cx="28" cy="118" r="1" fill="currentColor"/><circle cx="125" cy="117" r=".8" fill="currentColor"/></svg>`;
  }

  function roomState() {
    if (!activeChatId()) return { kind: 'none' };
    const linked = st.room?.worldId;
    if (!linked) return { kind: 'unlinked' };
    if (linked === st.worldId) return { kind: 'this' };
    return { kind: 'other', name: st.worlds.find((w) => w.worldId === linked)?.name || '다른 세계관' };
  }
  function roomButtons() {
    const s = roomState();
    if (s.kind === 'none' || !st.worldId) return '';
    if (s.kind === 'this') return `<button type="button" data-act="unlink">연결 끊기</button>`;
    return `<button class="primary" type="button" data-act="link">이 세계관을 읽게 하기</button>`;
  }
  function roomLine() {
    const s = roomState();
    if (s.kind === 'none') return '채팅방을 하나 열면 여기서 연결할 수 있습니다.';
    if (s.kind === 'unlinked') return '아직 어떤 세계관도 읽지 않습니다.';
    if (s.kind === 'this') return '지금 이 세계관을 읽고 있습니다.';
    return `지금은 「${esc(s.name)}」을(를) 읽고 있습니다.`;
  }

  /**
   * v0.8.4: the model that organizes this world is its own (world.auto.connectionId), not 기억 서재's — a coloured band
   * while none is picked or automatic updates are off; [고르기] goes to 세계관 정보 · 자동 반영 with the picker focused.
   */
  function modelBandHtml(small) {
    const w = world();
    if (!w || st.readOnly || (w.auto?.enabled && w.auto?.connectionId)) return '';
    const has = !!w.auto?.connectionId;
    const text = has ? '자동 반영이 꺼져 있어요 — 정리할 모델은 기억 서재와 따로예요' : '정리할 모델을 아직 안 골랐어요 — 기억 서재와 따로 골라요';
    return `<div class="model-band${small ? ' small' : ''}" role="status"><span>${text}</span><button type="button" data-act="pick-model">${has ? '켜기' : '고르기'}</button></div>`;
  }

  function autoHtml(compact) {
    const s = roomState();
    if (s.kind !== 'this') return '';
    const w = world();
    const a = st.auto;
    const job = a?.job;
    if (!w.auto?.enabled || !w.auto.connectionId) return modelBandHtml(compact);
    const running = job?.state === 'running';
    const status = running
      ? `${esc(job.stage || '읽는 중')}`
      : `메시지 ${w.auto.every}개마다 읽습니다${a?.pending != null ? ` · 아직 안 읽은 메시지 ${a.pending}개` : ''}`;
    const last = job && !running && job.state === 'done' ? `<div class="sub">지난번: 새 설정 ${job.added}개 · 바뀐 칸 ${job.changed}개${job.dropped ? ` · 근거가 없어 뺀 것 ${job.dropped}개` : ''}${job.fieldsDropped ? ` · 근거와 안 맞아 뺀 칸 ${job.fieldsDropped}개` : ''}</div>` : '';
    const err = job?.state === 'error' ? `<div class="err">${esc(job.error)}</div>` : '';
    // v0.4.2: the past (before the room was linked, or before 「여기까지 읽음」) is read only with this button.
    const cost = a?.past?.messages ? ` · 메시지 ${a.past.messages}개 · 약 ${Math.max(1, Math.round(a.past.tokens / 1000)).toLocaleString()}천 토큰` : '';
    const again = st.ask === 'restart'
      ? `<span class="ask">지난 대화를 처음부터 읽을까요${cost ? `(${cost.slice(3)})` : ''}? 토큰이 많이 듭니다. 설정은 지우지 않고, 읽은 위치만 처음으로 돌아갑니다. <button type="button" data-act="read-restart">다시 읽기</button><button class="quiet" type="button" data-act="ask" data-key="">취소</button></span>`
      : `<button class="quiet" type="button" data-act="ask" data-key="restart">지난 대화도 읽기(토큰 많이 듦)${cost}</button>`;
    return `<div class="auto-line"><span class="dot ${running ? 'run' : 'on'}"></span><span class="sub">자동 반영 · ${status}</span></div>${last}${err}
      ${running ? '' : `<div class="row" style="margin-top:8px"><button type="button" data-act="read-now" ${a?.pending === 0 ? 'disabled' : ''}>지금 읽기</button>${compact ? '' : again}</div>`}`;
  }

  function railHtml() {
    const p = st.preview;
    const s = roomState();
    return `${st.view === 'tabs' && world() ? `${worldRailHtml()}<hr>` : ''}
      <div class="rail-title">이 방</div>
      <div class="room">${roomTitle()}</div>
      <p>${roomLine()}</p>
      <div class="row">${roomButtons()}</div>
      ${autoHtml(true)}
      ${(s.kind === 'this' || s.kind === 'other') && p ? `
        <div class="chart">${chartSvg(p.chars / Math.max(1, p.budget))}<div class="num"><b>${p.chars.toLocaleString()}</b><small>/ ${p.budget.toLocaleString()}자</small></div></div>
        <p>이번 답변에 설정 <b>${p.included.length}개</b>가 들어갑니다.${p.omitted.length ? ` 글자 수 한도 때문에 <b>${p.omitted.length}개</b>가 빠졌습니다. 「늘 먼저 넣기」한 설정이 먼저 들어갑니다.` : ''}</p>` : ''}
      <hr>
      <p>프리셋에 <b>{{세계}}</b>를 넣은 자리에 연결한 세계관 설정이 들어갑니다. 설정은 서버에 저장되어 다른 기기에서도 똑같이 보입니다.</p>`;
  }

  // ------------------------------------------------------------------ views
  function overviewHtml() {
    const w = world();
    // One tile per kind, in the order they go into the prompt: two rows of four (two columns on a phone).
    const stubs = KINDS.map((k) => [k.type, k.label]);
    const p = st.preview;
    return `
      <div class="eyebrow">WORLD ARCHIVE · V${VERSION}</div>
      <h1>${esc(w.name)}</h1>
      <p class="intro">${w.description ? esc(w.description) : '시대·배경 설명이 아직 없습니다. 「세계관 정보 고치기」에서 적어 두면 설정 맨 앞에 함께 들어갑니다.'}</p>
      <div class="stubs">${stubs.map(([t, label]) => `<button class="stub" type="button" data-act="go" data-view="${t}"><strong>${count(t)}</strong><small>${label}</small></button>`).join('')}</div>
      <div class="paper">
        <h2>이 방 · ${roomTitle()}</h2>
        <p class="sub" style="margin:0 0 12px">${roomLine()}</p>
        <div class="row">${roomButtons()}</div>
        ${roomState().kind === 'this' ? `<div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--wa-line)">${autoHtml(false)}</div>` : ''}
      </div>
      ${roomState().kind === 'this' && p ? `
      <div class="paper">
        <div class="row" style="justify-content:space-between"><h2 style="margin:0">이번 답변에 들어갈 내용</h2><span class="pill">${p.chars.toLocaleString()} / ${p.budget.toLocaleString()}자</span></div>
        <p class="sub" style="margin:8px 0 0">설정 ${p.included.length}개${p.omitted.length ? ` · 글자 수 한도 때문에 ${p.omitted.length}개 빠짐` : ''}${p.skipped > 0 ? ` · 장면 밖이라 뺀 것 ${p.skipped}개` : ''}. 프리셋의 {{세계}} 자리에 이대로 들어갑니다.</p>${lawOutHtml(p)}
        <pre>${esc(p.text) || '(비어 있음)'}</pre>
      </div>
      <div class="paper">
        <h2 style="margin:0">삽화용 외형 · {{세계외형}}</h2>
        <p class="sub" style="margin:8px 0 0">삽화 에이전트 프롬프트에 <b>{{세계외형}}</b>(또는 {{world_looks}})을 넣으면, 장면에 나온 인물 가운데 외형 칸이 있는 사람만 들어갑니다. 최근 메시지에 나온 사람이 먼저입니다.${p.looks?.omitted?.length ? ` 길이 때문에 ${p.looks.omitted.length}명 빠짐.` : ''}</p>
        <pre>${esc(p.looks?.text || '') || (p.looks?.sceneKnown ? '(장면에 외형이 적힌 인물이 없음)' : '(다음 답변부터 장면을 압니다)')}</pre>
      </div>` : ''}
      <div class="paper mobile-only"><p class="sub" style="margin:0">프리셋에 <b>{{세계}}</b>를 넣은 자리에 연결한 세계관 설정이 들어갑니다.</p></div>`;
  }

  /**
   * v0.7.0 6: a card says who it is in four lines — the name; 「나이 · 성별 · 지내는 곳」 (other kinds: their short
   * fields); 외형 · 성격 in two lines (other kinds: their first texts or 메모); 숨은 설정 as dashed capsules. No 「자동」
   * stamp, number or date here (they are small at the bottom of the page).
   */
  const nameOfId = (id) => st.entities.find((x) => x.entityId === id)?.name || '';
  function cardLine(e) {
    const f = e.fields || {};
    if (e.type === 'person') {
      const where = e.room ? `지내는 곳 ${nameOfId(e.room)}` : e.work ? `일하는 곳 ${nameOfId(e.work)}` : '';
      // v0.7.6: 기숙사 · 학년 in the line (a world that has them)
      const on = world()?.personFields || [];
      const year = on.includes('year') && f.year ? (/^\d+$/.test(String(f.year).trim()) ? `${String(f.year).trim()}학년` : f.year) : '';
      return [f.age, f.gender, on.includes('house') ? f.house : '', year, where].filter(Boolean).join(' · ');
    }
    return defs(e.type).filter((x) => x.kind === 'line' && f[x.key]).slice(0, 3).map((x) => f[x.key]).join(' · ');
  }
  function cardTwo(e) {
    const f = e.fields || {};
    if (e.type === 'person') return [f.appearance, f.personality].filter(Boolean);
    const texts = defs(e.type).filter((x) => x.kind === 'text' && x.key !== 'state' && f[x.key]).map((x) => f[x.key]);
    return [...texts, e.description].filter(Boolean).slice(0, 2);
  }
  function cardHtml(e) {
    const line = cardLine(e);
    const two = cardTwo(e);
    const hid = Object.keys(e.hidden || {}).map((k) => defs(e.type).find((x) => x.key === k)?.label || k);
    return `<button class="card" type="button" data-act="open" data-id="${esc(e.entityId)}" data-search="${esc([e.name, ...e.aliases].join(' ').toLowerCase())}">
      ${e.pinned ? '<span class="pill pin">고정</span>' : ''}
      <div class="nm">${esc(e.name)}</div>
      ${line ? `<p class="c-line">${esc(line)}</p>` : ''}
      ${two.map((t) => `<p class="c-two">${esc(t)}</p>`).join('')}
      ${hid.length ? `<div class="c-hid">${hid.map((h) => `<span class="hid-cap">${esc(h)} · 숨은 설정</span>`).join('')}</div>` : ''}
    </button>`;
  }

  /**
   * v0.7.0 6: how a list is laid out — 집단으로 묶기 · 장소로 묶기 · 가나다, and 숨은 설정 있음 · 반복 등장만. In a group,
   * 「맡은 사람 · 선생님」 and 「함께 사는 동물」 apart from the members.
   */
  const LIST_MODES = { person: [['group', '집단으로 묶기'], ['place', '장소로 묶기'], ['abc', '가나다']], other: [['place', '장소로 묶기'], ['abc', '가나다']] };
  function listGroups(type, list) {
    const mode = st.listMode?.[type] || (type === 'person' ? 'group' : 'abc');
    if (mode === 'abc') return [[null, list]];
    const out = new Map();
    const put = (k, e) => { if (!out.has(k)) out.set(k, []); out.get(k).push(e); };
    if (mode === 'group' && type === 'person') {
      // the same as each group's 명단 (server roster.cjs): 구성원 / 맡은 사람 · 선생님 / 지난 구성원 / 함께 사는 동물
      const groups = st.entities.filter((x) => x.type === 'group');
      for (const g of groups) if (!st.rosters?.[g.entityId]) void loadRoster(g.entityId);
      const where = new Map(); // personId → [group name, kind] — the first group (by name) that lists them
      for (const g of [...groups].sort((a, b) => a.name.localeCompare(b.name, 'ko'))) {
        for (const m of st.rosters?.[g.entityId]?.members || []) if (!where.has(m.entityId)) where.set(m.entityId, [g.name, m.kind]);
      }
      const KIND_WORD = { member: '', staff: ' · 맡은 사람 · 선생님', past: ' · 지난 구성원', animal: ' · 함께 사는 동물' };
      for (const e of list) {
        const at = where.get(e.entityId);
        put(at ? `${at[0]}${KIND_WORD[at[1]] ?? ''}` : '소속 없음', e);
      }
    } else {
      const m = worldMap();
      for (const e of list) {
        const at = e.type === 'person' ? e.room || e.work : e.type === 'place' ? m.top(e.entityId) : e.appliesTo && e.appliesTo !== 'world' ? e.appliesTo : e.base || null;
        put(at ? nameOfId(at) || '어디인지 모름' : e.appliesTo === 'world' ? '세계 전체' : '어디인지 모름', e);
      }
    }
    const last = (k) => /^(소속 없음|어디인지 모름)/.test(k);
    return [...out].sort(([a], [b]) => Number(last(a)) - Number(last(b)) || a.localeCompare(b, 'ko'));
  }
  function listBar(type) {
    const mode = st.listMode?.[type] || (type === 'person' ? 'group' : 'abc');
    const fl = st.listFilter || {};
    const cap = (act, key, label, on) => `<button type="button" class="${on ? 'on' : ''}" data-act="${act}" data-type="${type}" data-key="${key}" aria-pressed="${on}">${label}</button>`;
    return `<div class="caps list-bar">${(LIST_MODES[type] || LIST_MODES.other).map(([k, l]) => cap('list-mode', k, l, mode === k)).join('')}<span class="bar-gap"></span>${cap('list-filter', 'hidden', '숨은 설정 있음', fl.hidden)}${type === 'person' ? cap('list-filter', 'recur', '반복 등장만', fl.recur) : ''}</div>`;
  }

  function listHtml(type) {
    const k = KIND[type];
    const fl = st.listFilter || {};
    const list = st.entities.filter((e) => e.type === type && (!fl.hidden || Object.keys(e.hidden || {}).length) && (!fl.recur || type !== 'person' || e.pinned || (e.seen?.n || 0) >= 2)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name, 'ko'));
    return `
      <div class="eyebrow">${k.en} · ${list.length}</div>
      <h1>${k.label}</h1>
      <p class="intro">${k.hint}</p>
      <div class="toolbar">
        ${list.length ? `<label class="search">${icon('search')}<input id="q" type="search" placeholder="이름 · 다른 이름 · 내용으로 찾기" value="${esc(st.query)}" aria-label="찾기"></label>` : ''}
        <span style="flex:1"></span>
        <button class="primary" type="button" data-act="new" data-type="${type}">새 ${k.label}</button>
      </div>
      ${type === 'group' && st.groupSuggest?.length ? `<p class="sub" style="margin:-6px 0 14px">소속 칸에만 있는 이름 · ${st.groupSuggest.map((g) => `<button class="quiet" type="button" data-act="group-make" data-name="${esc(g.name)}" title="${esc(g.people.join(', '))}의 소속 칸${g.owner ? ` · 지금은 「${esc(g.owner)}」의 다른 이름` : ''}">${esc(g.name)} · 집단으로 만들기</button>`).join(' ')}</p>` : ''}
      ${type === 'schedule' && !st.readOnly ? `<p class="sub" style="margin:-6px 0 14px"><button class="quiet" type="button" data-act="cal-gather" title="날짜가 정해진 한 번뿐인 행사 일정을 그 집단·장소의 학사일정으로 옮깁니다(코드로)">학사일정으로 모으기</button> <button class="quiet" type="button" data-act="tt-gather" title="요일·시간이 정해진 수업·일과 일정을 그 집단·사람의 시간표 칸으로 옮깁니다. 코드로 먼저 하고, 안 되는 것만 작은 호출 한 번">시간표로 모으기</button></p>` : ''}
      ${pairsOf(type).length || ((type === 'rule' || type === 'system') && (st.differ || []).length) ? `<p style="margin:-6px 0 14px"><button class="quiet" type="button" data-act="dupes">${type === 'person' ? '같은 사람일 수 있음' : '같은 것일 수 있음'} ${pairsOf(type).length}쌍${(type === 'rule' || type === 'system') && (st.differ || []).length ? ` · 서로 다른 말 ${st.differ.length}묶음` : ''}</button></p>` : ''}
      ${listBar(type)}
      ${list.length ? `${listGroups(type, list).map(([g, items]) => `${g ? `<h3 class="grp">${esc(g)} <small>${items.length}</small></h3>` : ''}<div class="cards">${items.map(cardHtml).join('')}</div>`).join('')}<p class="sub" id="noHit" hidden>찾는 이름이 없습니다.</p>`
        : `<div class="empty"><h2>아직 ${k.label} 설정이 없습니다</h2><p>「새 ${k.label}」으로 첫 항목을 만들어 주세요.</p></div>`}`;
  }

  /** 「…예요」 after a word without a final consonant, 「…이에요」 after one. */
  function copula(word) {
    const c = String(word).trim().slice(-1).charCodeAt(0);
    return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? '이에요' : '예요';
  }

  /**
   * 구성원 명단 (v0.5.0) — from the server (world-archive/lib/roster.cjs), so the screen and {{세계}} agree. Three parts:
   * 구성원 · 맡은 사람 · 지난 구성원; a name that is a description gets 「(이름 모름)」.
   */
  async function loadRoster(id) {
    st.rosters = st.rosters || {};
    if (st.rosters[id]) return;
    st.rosters[id] = { loading: true };
    try { st.rosters[id] = await api('GET', `/worlds/${st.worldId}/entities/${id}/members`); } catch { st.rosters[id] = { members: [], failed: true }; }
    if (st.detail === id || st.view === 'tabs' || (st.view === 'person' && !st.detail)) render();
  }
  /** v0.7.0 7: the pickers (지내는 곳 · 적용되는 곳 · 본거지 · 시간표 칸 · 명단 더하기 …) show only in 「고치기」. */
  let EDIT_ON = false;
  const editOn = () => EDIT_ON && !st.readOnly;
  const REL_TYPES_C = ['가족', '소속', '친구', '적대', '연인', '스승·제자', '위치', '기타'];
  /** v0.7.0 7: 관계 — add, take off, turn around, another kind (each saved at once, in 기록). */
  function relEditHtml(e) {
    const rels = (st.relations || []).filter((x) => x.from === e.entityId || x.to === e.entityId);
    const nameOf = (id) => st.entities.find((x) => x.entityId === id)?.name || '?';
    const row = (x) => `<div class="rel-row"><span><b>${esc(nameOf(x.from))}</b> → <b>${esc(nameOf(x.to))}</b></span><select data-rel-type="${esc(x.relationId)}" aria-label="관계 종류">${REL_TYPES_C.map((t) => `<option ${t === x.type ? 'selected' : ''}>${t}</option>`).join('')}</select><button class="quiet" type="button" data-act="rel-type" data-id="${esc(x.relationId)}">종류 바꾸기</button><button class="quiet" type="button" data-act="rel-flip" data-id="${esc(x.relationId)}">방향 바꾸기</button><button class="quiet" type="button" data-act="rel-del" data-id="${esc(x.relationId)}">빼기</button></div>`;
    const others = st.entities.filter((x) => x.entityId !== e.entityId).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return `<div class="sec rel-edit"><small>관계</small>${rels.map(row).join('') || '<p class="sub">아직 이어진 관계가 없습니다.</p>'}
      <div class="rel-row add"><select id="relTo" aria-label="이을 설정">${others.map((x) => `<option value="${esc(x.entityId)}">${esc(x.name)} · ${esc(KIND[x.type]?.label || '')}</option>`).join('')}</select><select id="relType" aria-label="관계 종류">${REL_TYPES_C.map((t) => `<option>${t}</option>`).join('')}</select><button type="button" data-act="rel-add" data-id="${esc(e.entityId)}">관계 더하기</button></div></div>`;
  }
  /** v0.7.0 7: 학사일정 — a new day by hand (the reader's stay as they are). */
  function calAddHtml(e) {
    return `<div class="tt-form cal-form"><input id="calDate" maxlength="10" placeholder="날짜(1891-09-01)" aria-label="날짜"><input id="calName" maxlength="60" placeholder="행사 이름" aria-label="행사 이름"><input id="calPlace" maxlength="60" placeholder="장소(비워도 돼요)" aria-label="장소"><button type="button" data-act="cal-add" data-id="${esc(e.entityId)}">일정 더하기</button></div>`;
  }

  function rosterHtml(g) {
    const r = st.rosters?.[g.entityId];
    if (!r || r.loading) { if (!r) void loadRoster(g.entityId); return '<div class="sec"><small>구성원 명단</small><p class="sub">불러오는 중…</p></div>'; }
    const list = r.members || [];
    const inList = new Set(list.map((m) => m.entityId));
    const chip = (m) => `<button class="quiet" type="button" data-act="open" data-id="${esc(m.entityId)}">${esc(m.name)}${m.unnamed ? ' <small>(이름 모름)</small>' : ''}${m.via ? ` <small>· ${esc(m.via)}</small>` : ''}</button>${editOn() ? `<button class="quiet" type="button" data-act="member-off" data-group="${esc(m.viaId || g.entityId)}" data-id="${esc(m.entityId)}" title="${esc(m.via || g.name)}의 명단에서 빼기 — 그 인물의 소속 칸에서 이 이름을 지웁니다" aria-label="${esc(m.name)} 빼기">×</button>` : ''}`;
    const part = (kind, label) => {
      const rows = list.filter((m) => m.kind === kind);
      return rows.length ? `<p><small>${label} ${rows.length}</small><br>${rows.map(chip).join('')}</p>` : '';
    };
    const named = list.filter((m) => !m.unnamed).length;
    const others = st.entities.filter((x) => x.type === 'person' && !inList.has(x.entityId)).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    const add = editOn() && others.length ? `<span class="roster-add"><select id="rosterPick" aria-label="명단에 더할 인물">${others.map((x) => `<option value="${esc(x.entityId)}">${esc(x.name)}</option>`).join('')}</select><button class="quiet" type="button" data-act="member-add" data-group="${esc(g.entityId)}">명단에 더하기</button></span>` : '';
    const body = list.length ? part('member', '구성원') + part('staff', '맡은 사람') + part('past', '지난 구성원') + part('animal', '함께 사는 동물') : '<p class="sub">아직 이 집단에 소속된 인물이 없습니다.</p>';
    // v0.5.1 J: with a 전체 인원 — 「이름 아는 사람 M명 / 전체 N명」
    const head = r.counts?.total ? `이름 아는 사람 ${r.counts.known}명 / 전체 ${r.counts.total}명` : `${list.length}명${named !== list.length ? ` (이름 아는 사람 ${named}명)` : ''}`;
    return `<div class="sec"><small>구성원 명단 · ${head} · 인물마다 적힌 소속으로 모음</small>${body}${add}</div>`;
  }

  /**
   * 시간표 (v0.5.0 B): weekday × time, one cell per lesson or round. The same order as world-archive/lib/timetable.cjs
   * (월…일, 평일, 매일; 교시 by number, times by clock, words by the day). A cell from the story has 「· 자동」; one the person
   * wrote is theirs, and a value the story gives for it waits with [적용] [무시].
   */
  const TT_DAYS = ['월', '화', '수', '목', '금', '토', '일', '평일', '매일'];
  function ttSlotRank(s) {
    const t = String(s);
    let m = t.match(/^(\d+)\s*교시/);
    if (m) return Number(m[1]) * 100;
    m = t.match(/^(\d{1,2}):(\d{2})/);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    m = t.match(/^(\d{1,2})\s*시/);
    if (m) return Number(m[1]) * 60;
    const w = ['새벽', '아침', '오전', '점심', '오후', '저녁', '밤', '자정'].findIndex((x) => t.startsWith(x));
    return w >= 0 ? [300, 420, 540, 720, 840, 1080, 1260, 1440][w] : 2000;
  }
  function timetableHtml(e) {
    const cells = Object.entries(e.timetable?.cells || {});
    const days = TT_DAYS.filter((d) => cells.some(([, c]) => c.day === d));
    const slots = [...new Set(cells.map(([, c]) => c.slot))].sort((a, b) => ttSlotRank(a) - ttSlotRank(b) || a.localeCompare(b, 'ko'));
    const cellHtml = (day, slot) => {
      const key = `${day}|${slot}`;
      const c = e.timetable.cells[key];
      if (!c) return '<td></td>';
      const past = c.past?.[0] ? `<small class="past">이전: ${esc(c.past[0].value)}</small>` : '';
      const wait = c.pending ? `<small class="pending">대화에서는 「${esc(c.pending.value)}」${copula(c.pending.value)} <button class="quiet" type="button" data-act="cell-pending" data-id="${esc(e.entityId)}" data-key="${esc(key)}">적용</button><button class="quiet" type="button" data-act="cell-pending" data-id="${esc(e.entityId)}" data-key="${esc(key)}" data-discard="1">무시</button></small>` : '';
      return `<td class="${(e.timetable.wide || []).includes(key) ? 'wide' : ''}" title="${esc(c.evidence || '')}${(e.timetable.wide || []).includes(key) ? ' — 이 시간 안에 더 자세한 칸이 있어 바탕으로만 보여 줍니다' : ''}">${esc(c.value)}${c.source === 'auto' ? '<span class="auto-tag">· 자동</span>' : ''}${past}${wait}</td>`;
    };
    const table = cells.length
      ? `<div class="tt-wrap"><table class="tt"><thead><tr><th></th>${days.map((d) => `<th>${esc(d)}</th>`).join('')}</tr></thead><tbody>${slots.map((sl) => `<tr><th>${esc(sl)}</th>${days.map((d) => cellHtml(d, sl)).join('')}</tr>`).join('')}</tbody></table></div>`
      : '<p class="sub">아직 칸이 없습니다.</p>';
    // 「시간이 겹쳐요」: two cells of one day whose times cross — the person chooses (nothing is merged or taken away by code)
    const label = (k) => { const c = e.timetable.cells[k]; return c ? `${c.day} ${c.slot} ${c.value}` : k; };
    const clash = (e.timetable.overlaps || []).filter(([a, b]) => e.timetable.cells[a] && e.timetable.cells[b]);
    const clashHtml = clash.length ? `<div class="tt-clash" role="status"><b>시간이 겹쳐요 ${clash.length}</b>${clash.map(([a, b]) => `<p>${[a, b].map((k) => `${esc(label(k))}${st.readOnly ? '' : ` <button class="quiet" type="button" data-act="cell-clear" data-id="${esc(e.entityId)}" data-key="${esc(k)}">이 칸 지우기</button>`}`).join(' ↔ ')}</p>`).join('')}</div>` : '';
    const owner = st.entities.find((x) => x.entityId === e.timetable.ownerId);
    const form = !editOn() ? '' : `<div class="tt-form"><select id="ttDay" aria-label="요일">${TT_DAYS.map((d) => `<option>${d}</option>`).join('')}</select><input id="ttSlot" maxlength="24" placeholder="때(1교시 · 오전 · 09:00–10:30)" aria-label="때"><input id="ttValue" maxlength="80" placeholder="내용(비우면 그 칸을 지움)" aria-label="내용"><button class="quiet" type="button" data-act="cell-save" data-id="${esc(e.entityId)}">칸 저장</button></div>`;
    return `<div class="sec"><small>시간표${owner ? ` · ${esc(owner.name)}` : ''} · 칸 ${cells.length}</small>${clashHtml}${table}${form}</div>`;
  }

  /** 적용되는 곳 (v0.5.0 C): a rule or system holds in one place or group, or in the whole world. */
  function appliesHtml(e) {
    const where = st.entities.find((x) => x.entityId === e.appliesTo);
    const tag = e.sources?.appliesTo === 'auto' ? '<span class="auto-tag">· 자동</span>' : '';
    const opts = st.entities.filter((x) => x.type === 'place' || x.type === 'group').sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'ko') : a.type === 'group' ? -1 : 1));
    const pick = !editOn() ? '' : `<span class="roster-add"><select id="appliesPick" aria-label="적용되는 곳"><option value="" ${e.appliesTo ? '' : 'selected'}>모름</option><option value="world" ${e.appliesTo === 'world' ? 'selected' : ''}>세계 전체</option>${opts.map((x) => `<option value="${esc(x.entityId)}" ${x.entityId === e.appliesTo ? 'selected' : ''}>${esc(x.name)} · ${x.type === 'group' ? '집단' : '장소'}</option>`).join('')}</select><button class="quiet" type="button" data-act="applies-set" data-id="${esc(e.entityId)}">바꾸기</button></span>`;
    const shown = where ? `<button class="quiet" type="button" data-act="open" data-id="${esc(where.entityId)}">${esc(where.name)}</button>` : e.appliesTo === 'world' ? '세계 전체' : '모름 <small>(장면 방식에서 맨 뒤에 넣음)</small>';
    return `<div class="sec"><small>적용되는 곳${tag}</small><p>${shown}</p>${pick}</div>`;
  }

  /** 본거지 (v0.5.0 E): the place a group is at. */
  function baseHtml(g) {
    const at = st.entities.find((x) => x.entityId === g.base);
    const tag = g.sources?.base === 'auto' ? '<span class="auto-tag">· 자동</span>' : '';
    const places = st.entities.filter((x) => x.type === 'place').sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    const pick = !editOn() ? '' : `<span class="roster-add"><select id="basePick" aria-label="본거지"><option value="">없음</option>${places.map((x) => `<option value="${esc(x.entityId)}" ${x.entityId === g.base ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><button class="quiet" type="button" data-act="base-set" data-id="${esc(g.entityId)}">바꾸기</button></span>`;
    return `<div class="sec"><small>본거지${tag}</small><p>${at ? `<button class="quiet" type="button" data-act="open" data-id="${esc(at.entityId)}">${esc(at.name)}</button>` : '<span class="sub">없음</span>'}</p>${pick}</div>`;
  }

  /** 지내는 곳 (v0.5.1 I): a person's room — only the current one; the ones before as 「이전」. */
  function roomHtml(p) {
    const at = st.entities.find((x) => x.entityId === p.room);
    const tag = p.sources?.room === 'auto' ? '<span class="auto-tag">· 자동</span>' : '';
    const places = st.entities.filter((x) => x.type === 'place').sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    const past = (p.roomPast || []).map((x) => st.entities.find((y) => y.entityId === x.placeId)?.name).filter(Boolean);
    if (!at && !past.length && !editOn()) return '';
    const pick = !editOn() ? '' : `<span class="roster-add"><select id="roomPick" aria-label="지내는 곳"><option value="">없음</option>${places.map((x) => `<option value="${esc(x.entityId)}" ${x.entityId === p.room ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><button class="quiet" type="button" data-act="room-set" data-id="${esc(p.entityId)}">바꾸기</button></span>`;
    return `<div class="sec"><small>지내는 곳${tag}</small><p>${at ? `<button class="quiet" type="button" data-act="open" data-id="${esc(at.entityId)}">${esc(at.name)}</button>` : '<span class="sub">없음</span>'}${past.length ? ` <small class="past">이전: ${esc(past.join(', '))}</small>` : ''}</p>${pick}</div>`;
  }
  /** 지내는 사람 (v0.5.1 I) · v0.6.2 ⑥ 여기서 일하는 사람: the people whose 지내는 곳 / 일하는 곳 is this place. */
  function stayingHtml(pl) {
    const row = (key, label) => {
      const who = st.entities.filter((x) => x.type === 'person' && x[key] === pl.entityId).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      return who.length ? `<div class="sec"><small>${label} · ${who.length}</small><p>${who.map((x) => `<button class="quiet" type="button" data-act="open" data-id="${esc(x.entityId)}">${esc(x.name)}</button>`).join(' ')}</p></div>` : '';
    };
    return row('room', '지내는 사람') + row('work', '여기서 일하는 사람');
  }
  /** v0.6.2 ⑥: 일하는 곳 (from the 소속 칸, by code). */
  function workHtml(p) {
    const at = p.work && st.entities.find((x) => x.entityId === p.work);
    return at ? `<div class="sec"><small>일하는 곳${p.sources?.work === 'auto' ? '<span class="auto-tag">· 자동</span>' : ''}</small><p><button class="quiet" type="button" data-act="open" data-id="${esc(at.entityId)}">${esc(at.name)}</button></p></div>` : '';
  }

  /** 학사일정 (v0.5.0 K) — a plain list for now: by date, 「이전」, cancelled struck through, [적용] [무시]. */
  function calendarHtml(e) {
    const list = Object.values(e.calendar?.events || {}).sort((a, b) => String(a.date || '9999').replace(/^--/, '0000-').localeCompare(String(b.date || '9999').replace(/^--/, '0000-')));
    const rows = list.map((x) => `<li class="${x.cancelled ? 'undone' : ''}"><b>${esc(x.date ? x.date.replace(/^--/, '연도 모름 ') : x.when || '')}${x.end ? ` ~ ${esc(x.end)}` : ''}</b> ${esc(x.name)}${x.place ? ` · ${esc(x.place)}` : ''}${x.who ? ` · ${esc(x.who)}` : ''}${x.cancelled ? ' · 취소' : ''}${x.source === 'auto' ? '<span class="auto-tag">· 자동</span>' : ''}${x.past?.[0] ? ` <small class="past">이전: ${esc(x.past[0].date)}</small>` : ''}${x.pending ? ` <small class="pending">대화에서는 ${esc(x.pending.date || '')}${x.pending.cancelled ? ' 취소' : ''} <button class="quiet" type="button" data-act="event-pending" data-id="${esc(e.entityId)}" data-event="${esc(x.id)}">적용</button><button class="quiet" type="button" data-act="event-pending" data-id="${esc(e.entityId)}" data-event="${esc(x.id)}" data-discard="1">무시</button></small>` : ''}</li>`).join('');
    return `<div class="sec"><small>학사일정 · ${list.length}</small>${rows ? `<ul class="hist">${rows}</ul>` : '<p class="sub">아직 일정이 없습니다.</p>'}</div>`;
  }

  /** 「잡다한 설정 정리」 candidates (v0.5.0 P · Q): the person picks — 휴지통 (undoable) · 칸 비우기 · 남기기. */
  function tidyHtml() {
    const t = st.tidy;
    const once = t?.once || [];
    if (!t || (!t.items.length && !t.fields.length && !once.length)) return '';
    const items = t.items.map((x) => `<li><b>${esc(x.name)}</b> <small>${esc(x.why || '')}</small> <button class="quiet" type="button" data-act="tidy-trash" data-id="${esc(x.entityId)}">휴지통으로</button><button class="quiet" type="button" data-act="tidy-keep" data-id="${esc(x.entityId)}">남기기</button></li>`).join('');
    const fields = t.fields.map((x) => `<li><b>${esc(x.name)}</b> · ${x.key === 'description' ? '메모' : x.key === 'appearance' ? '외형' : '성격'}: ${esc(x.value)} <small>${esc(x.why || '')}</small> <button class="quiet" type="button" data-act="tidy-clear" data-id="${esc(x.entityId)}" data-key="${esc(x.key)}">칸 비우기</button><button class="quiet" type="button" data-act="tidy-keep" data-id="${esc(x.entityId)}" data-key="${esc(x.key)}">남기기</button></li>`).join('');
    // v0.7.2 E: two rows — ① what the model found passing ② spoken of once (by code), 「남길까요」
    const onceRows = once.map((x) => `<li><b>${esc(x.name)}</b> <small>${esc(KIND[x.type]?.label || '')}${x.topic ? ` · ${esc(x.topic)}` : ''}</small> <button class="quiet" type="button" data-act="tidy-keep" data-id="${esc(x.entityId)}">남기기</button><button class="quiet" type="button" data-act="tidy-trash" data-id="${esc(x.entityId)}">휴지통으로</button></li>`).join('');
    return `<div class="paper"><h2>잡다한 설정 정리 · 후보 ${t.items.length + t.fields.length + once.length}</h2><p class="hint">지우지 않았습니다. 고른 것만 휴지통으로 가고 기록에서 되돌릴 수 있습니다.</p>${items || fields ? `<h3 class="grp">① 오래가지 않는 것 같아요 <small>모델 판정</small></h3>` : ''}${items ? `<ul class="hist">${items}</ul>` : ''}${fields ? `<ul class="hist">${fields}</ul>` : ''}${onceRows ? `<h3 class="grp">② 한 번만 나왔어요 — 남길까요 <small>${once.length}개</small></h3><ul class="hist">${onceRows}</ul>` : ''}</div>`;
  }

  function detailHtml(e) {
    const k = KIND[e.type];
    const d = defs(e.type, e);
    const f = e.fields || {};
    const src = e.sources || {};
    // v0.7.0 6: no 「자동」 stamp by each field (the bottom says where it came from); 숨은 설정 as a dashed capsule
    const tag = (k) => (e.hidden?.[k] ? '<span class="hid-cap" title="프로필 블록에만 있고 이야기에는 아직 나오지 않았습니다">아직 드러나지 않음</span>' : '');
    // 할 일 10: the earlier value small under the field; a newer value from the story for a field the person wrote.
    const was = (k) => (e.past?.[k]?.[0] ? `<small class="past was">이전: ${esc(e.past[k][0].value)} <button class="quiet" type="button" data-act="past-prompt" data-id="${esc(e.entityId)}" data-key="${esc(k)}" title="켜면 {{세계}}에 「(과거: …)」가 붙습니다">${e.pastInPrompt?.[k] ? '프롬프트에 넣는 중 · 끄기' : '프롬프트에도 넣기'}</button></small>` : '');
    const wait = (k) => (e.pending?.[k] ? `<small class="pending">대화에서는 「${esc(e.pending[k].value)}」${copula(e.pending[k].value)} <button class="quiet" type="button" data-act="pending" data-id="${esc(e.entityId)}" data-key="${esc(k)}">적용</button><button class="quiet" type="button" data-act="pending-drop" data-id="${esc(e.entityId)}" data-key="${esc(k)}">무시</button></small>` : '');
    // v0.7.0 6: the short fields as capsules under the name (나이 · 성별 · 소속 · 지내는 곳 / 일하는 곳), then 외형 → 성격 →
    // 배경 → … → 지금, empty ones left out
    const roomP = e.type === 'person' && e.room ? st.entities.find((x) => x.entityId === e.room) : null;
    const workP = e.type === 'person' && e.work ? st.entities.find((x) => x.entityId === e.work) : null;
    const facts = [
      ...d.filter((x) => x.kind === 'line' && f[x.key]).map((x) => `<span class="fact-cap"><small>${esc(x.label)}</small>${esc(f[x.key])}${tag(x.key)}</span>${was(x.key)}${wait(x.key)}`),
      roomP ? `<button class="fact-cap" type="button" data-act="open" data-id="${esc(roomP.entityId)}"><small>지내는 곳</small>${esc(roomP.name)}</button>` : '',
      workP ? `<button class="fact-cap" type="button" data-act="open" data-id="${esc(workP.entityId)}"><small>일하는 곳</small>${esc(workP.name)}</button>` : '',
    ].join('');
    const ORDER = ['appearance', 'personality', 'background', 'family'];
    const textDefs = d.filter((x) => x.kind === 'text' && x.key !== 'state' && f[x.key]).sort((a, b) => (ORDER.indexOf(a.key) + 1 || 99) - (ORDER.indexOf(b.key) + 1 || 99));
    const secs = textDefs.map((x) => `<div class="sec"><small>${esc(x.label)}${tag(x.key)}</small><p>${esc(f[x.key])}</p>${was(x.key)}${wait(x.key)}</div>`).join('');
    const extra = (e.extra || []).filter((x) => x.value).map((x) => `<div class="sec"><small>${esc(x.label)}</small><p>${esc(x.value)}</p></div>`).join('');
    const memo = e.description ? `<div class="sec"><small>${d.length ? '메모' : '내용'}${tag('description')}</small><p>${esc(e.description)}</p></div>` : '';
    // v0.5.0 L: 「확인 안 됨 · ○○의 말」
    // v0.6.2 ⑨: a profile that says another 나이 · 성별 · 종 — never written over, shown beside it
    // v0.6.2 ②: a rule or system one batch spoke of — kept, not in {{세계}}
    const once = isOnce(e)
      ? '<div class="sec"><small>한 번 나옴</small><p>대화의 한 묶음에서만 나왔어요. 설정집에는 두고 {{세계}}에는 넣지 않아요. 다시 나오거나 고정하면 들어가요.</p></div>' : '';
    // v0.7.8 B: a 위치 relation read both ways — it stays as it is until the person chooses
    const nameOfRel = (id) => st.entities.find((x) => x.entityId === id)?.name || '?';
    const relDiffers = (st.relations || []).filter((r) => r.differs && (r.from === e.entityId || r.to === e.entityId)).map((r) => `<div class="sec"><small>${esc(r.type)} · 서로 다른 말을 해요</small><p>지금: <b>${esc(nameOfRel(r.from))}</b> → <b>${esc(nameOfRel(r.to))}</b> 안 ↔ 다른 말: <b>${esc(nameOfRel(r.differs.from))}</b> → <b>${esc(nameOfRel(r.differs.to))}</b> 안</p>${r.differs.evidence ? `<p class="ev">${quoted(r.differs.evidence)}</p>` : ''}${st.readOnly ? '' : `<div class="row"><button class="quiet" type="button" data-act="rel-keep" data-id="${esc(r.relationId)}">지금대로 두기</button><button class="quiet" type="button" data-act="rel-flip" data-id="${esc(r.relationId)}">방향 바꾸기</button></div>`}</div>`).join('');
    const differs = Object.entries(e.differs || {}).map(([k, x]) => `<div class="sec"><small>${esc(d.find((y) => y.key === k)?.label || k)} · 서로 다른 말을 해요</small><p>${esc(e.fields?.[k] || '')} ↔ ${esc(x.value)}</p>${x.evidence ? `<p class="ev">${quoted(x.evidence)}</p>` : ''}</div>`).join('');
    const rumors = Object.entries(e.rumors || {}).map(([k, r]) => `<div class="sec"><small>${esc(d.find((x) => x.key === k)?.label || k)} · 확인 안 됨 · ${esc(r.by || '소문')}의 말</small><p>${esc(r.value)}</p></div>`).join('');
    // 관계: both directions; a chip opens the other setting.
    const rels = (st.relations || []).filter((r) => r.from === e.entityId || r.to === e.entityId).map((r) => {
      const other = st.entities.find((x) => x.entityId === (r.from === e.entityId ? r.to : r.from));
      if (!other) return '';
      // v0.7.0 6: 「친구 테오 마렌」 — the kind and the other one, a capsule that opens them
      // one line: the kind small and pale, then the name; the note (「기숙사 사감」) on hover or press, not in the capsule
      return `<button class="rel-cap" type="button" data-act="open" data-id="${esc(other.entityId)}"${r.note ? ` title="${esc(r.note)}"` : ''}><small>${esc(r.type)}</small> <b>${esc(other.name)}</b>${r.note ? '<i class="note-dot" aria-hidden="true">·</i>' : ''}</button>`;
    }).join('');
    const relSec = rels ? `<div class="sec"><small>관계</small><div class="rel-caps">${rels}</div></div>` : '';
    const empty = !facts && !secs && !extra && !memo && !f.state && !rels;
    const askKey = `entity:${e.entityId}`;
    return `
      ${st.fromTabs ? `<button class="back" type="button" data-act="go" data-view="tabs">${icon('back')}세계관 칸으로</button>` : `<button class="back" type="button" data-act="go" data-view="${e.type}">${icon('back')}${k.label} 목록</button>`}
      <div class="paper">
        <div class="sheet-head">
          <div>
            <div class="eyebrow">${k.label}</div>
            <h1 style="margin-bottom:6px">${esc(e.name)}</h1>
            ${e.aliases.length ? `<p class="al">다른 이름 · ${esc(e.aliases.join(', '))}</p>` : ''}
            ${e.nameSuggest && e.nameSuggest !== e.name && !st.readOnly ? `<p class="sub" style="margin:6px 0 0">대화에서는 「${esc(e.nameSuggest)}」${copula(e.nameSuggest)} 더 많이 불려요. 대표 이름을 바꿀까요? <button class="quiet" type="button" data-act="name-suggest" data-id="${esc(e.entityId)}">바꾸기</button></p>` : ''}
            ${e.glossaryName && e.glossaryName !== e.name ? `<p class="sub" style="margin:6px 0 0">번역 단어장에는 「${esc(e.glossaryName)}」${copula(e.glossaryName)} <button class="quiet" type="button" data-act="glossary-name" data-id="${esc(e.entityId)}">적용</button></p>` : ''}
          </div>
          ${e.pinned ? '<span class="pill">늘 먼저 넣기</span>' : ''}${e.nameCheck ? `<span class="pill" title="근거 문장에는 「${esc(e.nameCheck.said)}」이(가) 나옵니다. 이름을 확인해 주세요(고치면 사라집니다).">이름 확인 필요</span>` : ''}
        </div>
        ${facts ? `<div class="fact-caps">${facts}</div>` : ''}
        ${once}${differs}${relDiffers}${rumors}${e.type === 'rule' || e.type === 'system' ? appliesHtml(e) : ''}${e.type === 'group' ? baseHtml(e) : ''}${e.type === 'place' ? stayingHtml(e) : ''}${e.timetable ? timetableHtml(e) : ''}${e.calendar ? calendarHtml(e) : ''}${secs}${extra}${memo}${e.type === 'group' ? rosterHtml(e) : ''}
        ${f.state ? `<div class="state"><small>지금${tag('state')}</small><p>${esc(f.state)}</p>${was('state')}${wait('state')}</div>` : ''}
        ${relSec}
        ${empty ? '<p class="sub" style="margin-top:16px">아직 적힌 칸이 없습니다. 「고치기」에서 채워 주세요.</p>' : ''}
        <div class="meta">${k.en} · ${shortId(e.entityId)} · 만든 날 ${fmtDate(e.createdAt)} · 고친 날 ${fmtDate(e.updatedAt)} · ${e.provenance?.source === 'auto' ? '대화에서 자동으로 추가' : '직접 입력'}${Object.values(src).includes('auto') ? ` · 자동으로 채운 칸: ${esc(Object.entries(src).filter(([, v]) => v === 'auto').map(([key]) => d.find((x) => x.key === key)?.label || (key === 'description' ? '메모' : key)).join(', '))}` : ''}${e.provenance?.evidence ? `<br>근거 “${esc(e.provenance.evidence)}”` : ''}</div>
        <div class="actions">
          <button class="primary" type="button" data-act="edit" data-id="${esc(e.entityId)}">고치기</button>
          <button type="button" data-act="pin" data-id="${esc(e.entityId)}">${e.pinned ? '고정 풀기' : '늘 먼저 넣기'}</button>
          <span class="grow"></span>
          ${st.ask === askKey
            ? `<span class="ask">정말 지울까요? <button class="danger" type="button" data-act="delete" data-id="${esc(e.entityId)}">지우기</button><button class="quiet" type="button" data-act="ask" data-key="">취소</button></span>`
            : `<button class="quiet" type="button" data-act="ask" data-key="${askKey}">지우기</button>`}
        </div>
      </div>`;
  }

  // ------------------------------------------------------------------ 같은 사람일 수 있음
  const clip = (v, n) => { const x = String(v || ''); return x.length > n ? `${x.slice(0, n)}…` : x; };
  function personSide(e) {
    const f = e.fields || {};
    const rows = defs(e.type).filter((x) => f[x.key]).map((x) => `<div class="sec"><small>${esc(x.label)}${e.sources?.[x.key] === 'auto' ? '<span class="auto-tag">· 자동</span>' : ''}</small><p>${esc(clip(f[x.key], 160))}</p></div>`).join('');
    const memo = e.description ? `<div class="sec"><small>메모</small><p>${esc(clip(e.description, 160))}</p></div>` : '';
    return `<div>
      <h2 style="margin:0 0 2px">${esc(e.name)}</h2>
      ${e.aliases.length ? `<p class="sub" style="margin:0">다른 이름 · ${esc(e.aliases.join(', '))}</p>` : ''}
      ${rows}${memo}${!rows && !memo ? '<p class="sub" style="margin-top:10px">아직 적힌 칸이 없습니다.</p>' : ''}
    </div>`;
  }

  /** v0.5.0 F: 「같은 것일 수 있음」 for places, groups, rules … too (pairs carry their kind; old ones are people). */
  const pairsOf = (type) => (st.pairs || []).filter((p) => (p.type || 'person') === type);
  function dupesHtml() {
    const byId = (id) => st.entities.find((e) => e.entityId === id);
    const type = KIND[st.view] ? st.view : 'person';
    const person = type === 'person';
    const pairs = pairsOf(type).map((p) => ({ ...p, ea: byId(p.a), eb: byId(p.b) })).filter((p) => p.ea && p.eb);
    return `
      <button class="back" type="button" data-act="go" data-view="${type}">${icon('back')}${KIND[type].label} 목록</button>
      <div class="eyebrow">${person ? 'PEOPLE · SAME PERSON?' : 'SAME ONE?'} · ${pairs.length}</div>
      <h1>${person ? '같은 사람일 수 있음' : '같은 것일 수 있음'}</h1>
      <p class="intro">이름이나 다른 이름이 겹치거나, 자동 반영이 같은 것인지 헷갈려 한 ${person ? '인물' : '설정'}입니다. 같은 ${person ? '사람' : '것'}이면 「합치기」로 하나로 모을 수 있습니다. 자동으로 합치지는 않습니다. 합친 뒤에도 「기록」에서 되돌릴 수 있습니다.</p>
      ${pairs.length ? pairs.map(({ a, b, why, ea, eb }) => {
        const key = `merge:${a}:${b}`;
        return `<div class="paper">
          <p class="sub" style="margin:0 0 10px">${esc(why)}</p>
          <div class="grid2">${personSide(ea)}${personSide(eb)}</div>
          <div class="actions">
            ${st.ask === key
              ? `<span class="ask">어느 이름을 남길까요? 다른 쪽 이름은 다른 이름으로 들어가고, 빈 칸은 다른 쪽 내용으로 채웁니다. 직접 쓴 칸은 그대로 둡니다.
                  <button class="danger" type="button" data-act="merge" data-keep="${esc(a)}" data-drop="${esc(b)}">「${esc(ea.name)}」 남기기</button>
                  <button class="danger" type="button" data-act="merge" data-keep="${esc(b)}" data-drop="${esc(a)}">「${esc(eb.name)}」 남기기</button>
                  <button class="quiet" type="button" data-act="ask" data-key="">취소</button></span>`
              : `<button class="primary" type="button" data-act="ask" data-key="${key}">합치기</button>
                 <button type="button" data-act="dismiss" data-a="${esc(a)}" data-b="${esc(b)}">${person ? '다른 사람이에요' : '다른 것이에요'}</button>`}
          </div>
        </div>`;
      }).join('') : `<div class="empty"><h2>${person ? '같은 사람일 수 있는 인물이' : '같은 것일 수 있는 설정이'} 없습니다</h2><p>이름이나 다른 이름이 겹치는 설정이 생기면 여기에 보입니다.</p></div>`}
      ${differHtml(type)}`;
  }
  /** v0.6.2 ②: rules · systems about the same thing (two words in a row of their names) — 「서로 다른 말을 해요」. */
  function differHtml(type) {
    if (type !== 'rule' && type !== 'system') return '';
    const byId = (id) => st.entities.find((e) => e.entityId === id);
    const groups = (st.differ || []).map((g) => ({ ...g, list: g.ids.map(byId).filter(Boolean) })).filter((g) => g.list.length >= 2 && g.list.some((e) => e.type === type));
    if (!groups.length) return '';
    return `<div class="eyebrow" style="margin-top:22px">SAYS DIFFERENT THINGS? · ${groups.length}</div>
      <h2>서로 다른 말을 해요</h2>
      <p class="intro">같은 대상(이름의 두 낱말)을 다루는 규칙 · 시스템이에요. 서로 부딪치면 하나만 남기거나 합쳐 주세요. 자동으로 바꾸지는 않아요.</p>
      ${groups.map((g) => `<div class="paper"><p class="sub" style="margin:0 0 8px">「${esc(g.topic)}」</p><ul>${g.list.map((e) => `<li><b>${esc(e.name)}</b> <small>${esc(KIND[e.type]?.label || e.type)}${e.description ? ` · ${esc(e.description.slice(0, 80))}` : ''}</small></li>`).join('')}</ul></div>`).join('')}`;
  }

  function fieldInput(x, value, hideLabel, hidden, orig) {
    const hint = x.hint ? `<em>${esc(x.hint)}</em>` : '';
    const tr = orig != null ? ` data-orig="${esc(orig)}" data-ko="${esc(value)}" data-label="${esc(x.label)}"` : '';
    const label = `<label class="f" for="fd-${x.key}" ${hideLabel ? 'hidden' : ''}>${esc(x.label)}${hint}</label>`;
    // v0.7.0 7: 「아직 드러나지 않음」 by hand (a field with a value, on a setting that is there)
    const hid = hidden === undefined ? '' : `<label class="hid-toggle"><input type="checkbox" data-hidden="${x.key}" ${hidden ? 'checked' : ''}> 아직 드러나지 않음</label>`;
    return x.kind === 'line'
      ? `<div>${label}<input id="fd-${x.key}" data-field="${x.key}" maxlength="200" value="${esc(value)}"${tr}>${hid}</div>`
      : `<div>${label}<textarea id="fd-${x.key}" data-field="${x.key}" maxlength="2000"${tr}>${esc(value)}</textarea>${hid}</div>`;
  }

  function extraRow(x = { label: '', value: '' }) {
    return `<div class="extra-row" data-extra><input data-x="label" maxlength="40" placeholder="칸 이름 (예: 좋아하는 것)" value="${esc(x.label)}"><textarea data-x="value" maxlength="2000" rows="1" style="min-height:42px">${esc(x.value)}</textarea><button class="quiet" type="button" data-act="drop-extra">빼기</button></div>`;
  }

  /**
   * v0.7.0 7: the rest of the screen in 「고치기」 — 지내는 곳 · 일하는 곳, 적용되는 곳 · 주제, 본거지 · 명단, 시간표 칸,
   * 학사일정, 관계. The pickers act at once (each in 기록); 일하는 곳 · 주제 · 숨김 are saved with 「저장」.
   */
  function moreEdit(e, type) {
    EDIT_ON = true;
    try {
      const places = st.entities.filter((x) => x.type === 'place').sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      const work = type === 'person' ? `<label class="f" for="fd-work">일하는 곳<em>가게 · 장소. 소속 칸에서 자동으로 잇기도 해요</em></label><select id="fd-work" style="max-width:360px"><option value="">없음</option>${places.map((x) => `<option value="${esc(x.entityId)}" ${x.entityId === e.work ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : '';
      const topic = type === 'rule' || type === 'system' ? `<label class="f" for="fd-topic">주제<em>규칙 · 시스템 화면에서 주제로 거를 때 써요</em></label><select id="fd-topic" style="max-width:240px"><option value="">고르지 않음</option>${(st.topics || []).map((t) => `<option ${t === e.topic ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>` : '';
      return [
        type === 'person' ? roomHtml(e) + work : '',
        type === 'rule' || type === 'system' ? appliesHtml(e) + topic : '',
        type === 'group' ? baseHtml(e) + rosterHtml(e) : '',
        e.timetable ? timetableHtml(e) : '',
        e.calendar ? calendarHtml(e) + calAddHtml(e) : '',
        relEditHtml(e),
      ].join('');
    } finally {
      EDIT_ON = false;
    }
  }

  /** v0.7.0 3: what the person wrote in the Korean view and what will be saved (the settings' language). */
  const backCheckHtml = (plan) => `<div class="back-check" id="backCheck" data-no-tr><h4>원문 언어로 이렇게 저장해요</h4><dl>${plan.changed.map((c) => `<dt>${esc(c.label)} · 고친 글</dt><dd>${esc(c.ko)}</dd><dt>저장될 원문</dt><dd class="to">${esc(c.to)}</dd>`).join('')}</dl><div class="actions"><button class="primary" type="button" data-act="back-save">이대로 저장</button><button class="quiet" type="button" data-act="back-cancel">다시 고치기</button></div></div>`;

  /** e: the saved setting, or null for a new one. st.draft (if any) wins over e for what is shown. */
  function formHtml(e, type) {
    const isNew = st.editing === 'new';
    const v = st.draft || e || {};
    const k = KIND[type];
    const d = defs(type, v);
    const f = v.fields || {};
    const lines = d.filter((x) => x.kind === 'line');
    const texts = d.filter((x) => x.kind === 'text' && x.key !== 'state');
    const state = d.find((x) => x.key === 'state');
    const hidOf = (key) => (isNew || !e || !(e.fields || {})[key] ? undefined : Boolean(e.hidden?.[key]));
    // v0.7.0 3: in the Korean view a saved value shows its Korean (the original kept in the input, put back if unchanged)
    const koOf = (orig) => (st.viewKo && !isNew && e && !st.draft && koCache.get(String(orig || '').trim())) || null;
    const fi = (x, hideLabel) => { const ko = koOf(f[x.key]); return fieldInput(x, ko || f[x.key] || '', hideLabel, hidOf(x.key), ko ? (e.fields || {})[x.key] : undefined); };
    const descKo = koOf(v.description);
    return `
      <button class="back" type="button" data-act="cancel">${icon('back')}${isNew ? `${k.label} 목록` : '돌아가기'}</button>
      <div class="eyebrow">${k.en} · ${isNew ? '새로 만들기' : '고치기'}</div>
      <h1>${isNew ? `새 ${k.label}` : esc(e?.name || '')}</h1>
      <p class="intro">직접 고친 칸은 그 뒤로 자동 반영이 덮어쓰지 않습니다.</p>
      <form class="paper" id="entityForm" onsubmit="return false">
        <div class="grid2">
          <div><label class="f" for="fd-name">이름</label><input id="fd-name" maxlength="120" value="${esc(v.name || '')}"></div>
          <div><label class="f" for="fd-type">종류</label><select id="fd-type">${KINDS.map((x) => `<option value="${x.type}" ${x.type === type ? 'selected' : ''}>${x.label}</option>`).join('')}</select></div>
        </div>
        <label class="f" for="fd-aliases">다른 이름<em>애칭·영어 표기·직함. 쉼표로 나눠 주세요</em></label>
        <input id="fd-aliases" value="${esc((v.aliases || []).join(', '))}">
        ${st.viewKo && !isNew ? '<p class="sub" data-no-tr>한국어 보기로 고치는 중이에요. 바꾼 칸만 저장할 때 원문 언어로 되돌려 두 글을 같이 보여 드려요.</p>' : ''}
        ${lines.length ? `<div class="grid3">${lines.map((x) => fi(x, false)).join('')}</div>` : ''}
        ${texts.map((x) => fi(x, false)).join('')}
        ${state ? `<div class="state"><small>지금 상태 · 사건으로 바뀐 것</small><p class="sub" style="margin:0 0 8px">${esc(state.hint || '')}</p>${fi(state, true)}</div>` : ''}
        ${!isNew && e ? moreEdit(e, type) : ''}
        <label class="f">추가 칸<em>이 항목에만 필요한 칸</em></label>
        <div id="extras">${(v.extra || []).map(extraRow).join('')}</div>
        <button type="button" data-act="add-extra" style="margin-top:8px">칸 추가</button>
        <label class="f" for="fd-desc">${d.length ? '메모' : '내용'}</label>
        <textarea id="fd-desc" maxlength="4000"${descKo ? ` data-orig="${esc(e.description)}" data-ko="${esc(descKo)}" data-label="메모"` : ''}>${esc(descKo || v.description || '')}</textarea>
        <label class="check"><input type="checkbox" id="fd-pinned" ${v.pinned ? 'checked' : ''}> 늘 먼저 넣기 (글자 수가 모자랄 때 이 설정부터 넣습니다)</label>
        <div class="actions"><button class="primary" type="button" data-act="save">저장</button><button class="quiet" type="button" data-act="cancel">취소</button></div>
      </form>`;
  }

  /** v0.8.4: one model picker for 새 세계관 · 세계관 정보 (only one connection → it is picked already in 새 세계관). */
  function connSelectHtml(id, chosen, single) {
    const list = st.connections || [];
    const pick = chosen || (single && list.length === 1 ? list[0].id : '');
    return `<select id="${id}"><option value="">${st.connections == null ? '불러오는 중…' : list.length ? '(골라 주세요)' : '(마리나라에 연결이 없어요)'}</option>${list.map((c) => `<option value="${esc(c.id)}" ${c.id === pick ? 'selected' : ''}>${esc(c.name)}${c.model ? ` · ${esc(c.model)}` : ''}</option>`).join('')}</select>`;
  }

  function newWorldHtml(first) {
    // the first world has no 「새 세계관 만들기」 press to load the connections: load them here, then swap only the picker
    if (st.connections == null && !st.connLoading) {
      st.connLoading = true;
      loadConnections().finally(() => {
        st.connLoading = false;
        const old = root.getElementById('nw-conn');
        if (old && !old.value) old.outerHTML = connSelectHtml('nw-conn', '', true);
      });
    }
    return `
      <div class="eyebrow">WORLD ARCHIVE · NEW</div>
      <h1>${first ? '첫 세계관 만들기' : '새 세계관'}</h1>
      <p class="intro">세계관 하나에 인물·장소·규칙 같은 설정을 모아 두고, 채팅방마다 어떤 세계관을 읽을지 고릅니다. 여러 방이 같은 세계관을 함께 써도 됩니다.</p>
      <form class="paper" onsubmit="return false">
        <label class="f" for="nw-name">세계관 이름</label><input id="nw-name" maxlength="120" placeholder="예: 별빛 학원">
        <label class="f" for="nw-desc">시대·배경<em>설정 맨 앞에 들어갑니다</em></label><textarea id="nw-desc" maxlength="4000" placeholder="예: 1988년, 산 위의 기숙학교."></textarea>
        <label class="f" for="nw-conn">정리할 모델(마리나라 연결)<em>대화를 읽고 설정을 정리할 모델이에요. 기억 서재가 쓰는 모델과 따로입니다. 같은 걸 골라도 돼요. 나중에 「세계관 정보」에서 골라도 돼요</em></label>
        <div style="max-width:420px">${connSelectHtml('nw-conn', '', true)}</div>
        <label class="toggle" style="margin-top:14px"><input type="checkbox" id="nw-auto" checked> 자동 반영 켜기</label>
        <div class="actions"><button class="primary" type="button" data-act="create-world">만들기</button>${first ? '' : '<button class="quiet" type="button" data-act="go" data-view="overview">취소</button>'}</div>
      </form>`;
  }

  /** v0.7.0 2: {{세계}} 글자 수 — the person picks; what goes in now and what did not fit, from this room's preview. */
  // v0.8.2: 6,000 added; one step marked 「추천」 for the language the world is organized in (measured on six test worlds)
  const BUDGETS = [3000, 5000, 6000, 8000, 12000, 20000, 30000];
  const BUDGET_REC = { ko: 3000, en: 6000 };
  /** v0.8.2: 「규칙 · 시스템 N개가 글자 수 때문에 빠졌어요 — 추천 ○○자」 (the server works out the smallest step). */
  const lawOutHtml = (p) => (p?.lawOmitted ? `<p class="sub law-out"><b>규칙 · 시스템 ${p.lawOmitted}개가 글자 수 때문에 빠졌어요</b> — ${p.suggest === 'pin' ? '30,000자로도 다 안 들어가요. 꼭 필요한 규칙은 카드에서 「늘 먼저 넣기」를 켜 주세요' : `추천 ${Number(p.suggest).toLocaleString()}자`}</p>` : '');
  function budgetHtml(w) {
    const cur = w.injectChars;
    const custom = st.budgetCustom || !BUDGETS.includes(cur);
    const p = st.preview && st.preview.worldId === w.worldId ? st.preview : null;
    const lang = w.summaryLang === 'en' || w.summaryLang === 'ko' ? w.summaryLang : p?.lang || 'ko';
    const rec = BUDGET_REC[lang];
    const now = p ? `<p class="sub budget-now">지금 들어가는 글: ${Number(p.chars || 0).toLocaleString()}자 / ${Number(p.budget || cur).toLocaleString()}자${p.omitted?.length ? ` · <b>글자가 모자라 설정 ${p.omitted.length}개가 빠졌어요</b>` : ''}</p>${lawOutHtml(p)}` : '';
    return `<label class="f" for="w-budget">{{세계}}에 넣을 글자 수<em>넘치면 고정하지 않은 설정부터 빠집니다. 늘리면 모델에 보내는 글도 그만큼 길어져요</em></label>
        <div class="caps" role="radiogroup" aria-label="{{세계}}에 넣을 글자 수">${BUDGETS.map((n) => `<button type="button" role="radio" aria-checked="${!custom && cur === n}" class="${!custom && cur === n ? 'on' : ''}" data-act="budget" data-n="${n}">${n.toLocaleString()}자${n === rec ? '<small class="rec">추천</small>' : ''}</button>`).join('')}<button type="button" role="radio" aria-checked="${custom}" class="${custom ? 'on' : ''}" data-act="budget" data-n="custom">직접 입력</button></div>
        <p class="sub budget-rec">추천: ${lang === 'en' ? '영어로 정리하는 세계관은 6,000자(설정이 많으면 8,000자)' : '한국어로 정리하는 세계관은 3,000자(설정이 많으면 5,000자)'}. 영어는 같은 내용이 글자로 약 2배 길어요 — 영어 6,000자 ≈ 1,600토큰, 한국어 3,000자 ≈ 1,200토큰.</p>
        <input id="w-budget" type="number" min="300" max="40000" step="100" value="${cur}" style="max-width:200px" ${custom ? '' : 'hidden'} aria-label="직접 입력(300~40000자)">${now}`;
  }

  function worldHtml() {
    const w = world();
    return `
      <div class="eyebrow">WORLD · SETTINGS</div>
      <h1>세계관 정보</h1>
      <form class="paper" onsubmit="return false">
        <label class="f" for="w-name">이름</label><input id="w-name" maxlength="120" value="${esc(w.name)}">
        <label class="f" for="w-desc">시대·배경<em>설정 맨 앞에 들어갑니다</em></label><textarea id="w-desc" maxlength="4000" style="min-height:120px">${esc(w.description)}</textarea>
        ${budgetHtml(w)}
        <label class="f" for="w-mode">넣는 방식<em>어느 쪽이든 고정 → 장면 인물(짧게라도) → 규칙 · 시스템(짧게라도) → 자세히 → 남는 자리에 나머지 순서예요. 장면 방식은 최근 메시지 12개에 이름이 나온 것과 그곳의 규칙을 먼저 넣고, 다른 곳의 규칙은 넣지 않아요</em></label><select id="w-mode" style="max-width:360px"><option value="all" ${w.injectMode === 'scene' ? '' : 'selected'}>전부 넣기</option><option value="scene" ${w.injectMode === 'scene' ? 'selected' : ''}>장면에 나온 것 먼저(남는 자리에 나머지)</option></select>
        <label class="f" for="w-year">학년도 시작 달<em>시간표와 학사일정을 학년도로 나눕니다(이야기 속 날짜를 알 때)</em></label><select id="w-year" style="max-width:200px">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${(w.yearStart || 9) === i + 1 ? 'selected' : ''}>${i + 1}월</option>`).join('')}</select>
        <label class="f">{{세계}} 맨 끝 두 줄<em>글자 수 안에서 고정 설정 다음으로 먼저 자리를 잡습니다</em></label>
        <label class="check"><input type="checkbox" id="w-tail-cast" ${w.tail?.cast !== false ? 'checked' : ''}> [이미 있는 인물] — 이름 목록(600자까지, 최근 순 · 넘으면 「외 N명」)</label>
        <label class="check"><input type="checkbox" id="w-tail-bal" ${w.tail?.balance !== false ? 'checked' : ''}> [균형] — 반복 등장 인물(두 번 이상 나왔거나 고정) 수를 칸별로</label>
        <label class="f" for="w-balance">균형 볼 칸<em>쉼표로 나눔 · 4개까지 · 기본 성별. 인물 칸 이름(성별 · 종 · 소속 …)이 아니면 인물의 추가 칸으로 생기고, 자동 반영은 근거가 있을 때만 채웁니다</em></label><input id="w-balance" maxlength="100" value="${esc((w.balance?.length ? w.balance : ['성별']).join(', '))}">
        <label class="f" for="w-lang">정리 언어<em>자동: 이 방 기억 서재의 기억 언어(없으면 한국어). 영어로 정리하면 이름은 원문 그대로 두고 번역 단어장의 한국어 이름은 다른 이름에 넣어요</em></label><select id="w-lang" style="max-width:360px">${[['auto', '자동'], ['ko', '한국어'], ['en', '영어']].map(([v, l]) => `<option value="${v}" ${(w.summaryLang || 'auto') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <label class="f">인물 추가 칸<em>학교 세계에서 켜요. 소속 · 명단으로 알 수 있으면 코드가 채우고, 사람이 쓴 칸은 덮지 않아요</em></label><div class="row">${[['house', '기숙사'], ['year', '학년']].map(([k, l]) => `<label class="check"><input type="checkbox" data-pf="${k}" ${(w.personFields || []).includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div>
        <label class="f" for="w-names">{{세계}} 이름 표기<em>자동: 영어로 진행하는 방에서는 「원래 표기(한국어)」</em></label><select id="w-names" style="max-width:360px">${[['auto', '자동'], ['ko', '한국어만'], ['original', '원래 표기(한국어)']].map(([v, l]) => `<option value="${v}" ${(w.nameStyle || 'auto') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <div class="grid2">
          <div><label class="f" for="w-board">점수판 이름<em>비우면 점수를 찾지 않습니다 (예: 기숙사 점수)</em></label><input id="w-board" maxlength="40" value="${esc(w.scoreboard?.name || '')}"></div>
          <div><label class="f" for="w-unit">단위<em>예: 점</em></label><input id="w-unit" maxlength="10" value="${esc(w.scoreboard?.unit || '')}" style="max-width:140px"></div>
        </div>
        <div class="actions"><button class="primary" type="button" data-act="save-world">저장</button></div>
      </form>
      <form class="paper" onsubmit="return false">
        <h2>자동 반영</h2>
        <p class="sub" style="margin:0 0 4px">이 세계관을 읽는 방에서 답변이 오면, 아직 안 읽은 대화를 읽고 새 인물·장소·규칙과 새로 밝혀진 사실을 바로 설정에 넣습니다. 원문에 근거가 있는 것만 넣고, 직접 쓴 칸은 덮어쓰지 않습니다. 바뀐 내용은 「기록」에서 하나씩 되돌릴 수 있습니다. 가장 최근 메시지 두 개는 리롤될 수 있어 다음 차례에 읽습니다.</p>
        <p class="sub" style="margin:0 0 4px"><b>기억 서재가 쓰는 모델과 따로입니다. 같은 걸 골라도 돼요.</b></p>
        <label class="toggle" style="margin-top:14px"><input type="checkbox" id="a-on" ${w.auto?.enabled ? 'checked' : ''}> 자동 반영 켜기</label>
        <div class="grid2">
          <div><label class="f" for="a-conn">정리할 모델(마리나라 연결)<em>저렴하고 긴 글을 잘 읽는 모델</em></label>
            ${connSelectHtml('a-conn', w.auto?.connectionId || '', false)}</div>
          <div><label class="f" for="a-every">몇 메시지마다 읽을까요<em>2~50</em></label><input id="a-every" type="number" min="2" max="50" value="${w.auto?.every ?? 6}" style="max-width:140px"></div>
        </div>
        <div class="actions"><button class="primary" type="button" data-act="save-auto">저장</button></div>
      </form>
      <div class="paper">
        <h2>인물 종 채우기 <small>추가 기능</small></h2>
        <p class="sub" style="margin:0 0 12px">「종」 칸이 생기기 전에 읽은 인물은 종이 비어 있습니다. 누를 때만, 종이 빈 인물의 이름 · 다른 이름 · 외형 · 메모를 모아 100명씩 작은 호출로 묻고, 사람이 아닌 존재(반려동물 · 마법 생물 같은)에만 종을 적습니다. 직접 고친 칸은 건드리지 않고, 기록에서 하나씩 되돌릴 수 있습니다. 자동 반영 연결을 씁니다.</p>
        ${tidyHtml()}
        <div class="row"><button type="button" data-act="tidy" title="한 번 스친 물건·주문 같은 규칙·시스템·일정과, 성격·메모에 섞인 사건을 후보로만 고릅니다(작은 호출). 지우지는 않습니다.">잡다한 설정 정리</button><button type="button" data-act="species-fill">인물 종 채우기</button><button type="button" data-act="hair-fill" title="머리색 · 눈색이 빈 인물을 외형 글에서만 뽑습니다(작은 호출, 지어내지 않음).">머리색 · 눈색 채우기</button><button type="button" data-act="applies-fill" title="적용되는 곳이 빈 규칙·시스템을 이름·분류·내용만으로 한 번에 묻습니다(작은 호출). 근거가 없으면 모름으로 둡니다.">규칙 적용되는 곳 채우기</button><button type="button" data-act="topic-fill" title="주제가 빈 규칙·시스템을 이름·분류·내용만으로 한 번에 묻습니다(작은 호출).">규칙 주제 채우기</button><button type="button" data-act="topic-redo" title="자동으로 붙은 주제도 다시 매깁니다(사람이 고친 것은 그대로, 기록에서 되돌릴 수 있음).">주제 다시 매기기</button><button type="button" data-act="location-fill" title="아직 어느 장소 안에도 없는 장소를 위치 칸으로 먼저 잇고, 남은 것만 작은 호출로 묻습니다.">장소 위치 채우기</button></div>
      </div>
      <div class="paper">
        <h2>백업 · 복원</h2>
        <p class="sub" style="margin:0 0 12px">이 세계관의 설정 · 관계 · 기록을 파일 하나로 내려받습니다. 복원하면 「(복원)」이 붙은 새 세계관이 생기고, 지금 세계관은 그대로입니다. 방 연결은 복원되지 않습니다.</p>
        <div class="row"><button type="button" data-act="backup">백업 내려받기</button><label class="quiet" style="cursor:pointer;padding:6px 8px">백업에서 복원<input id="restore-file" type="file" accept="application/json,.json" hidden></label></div>
      </div>
      <div class="paper">
        <h2>세계관 지우기</h2>
        <p class="sub" style="margin:0 0 12px">설정 ${st.entities.length}개도 함께 지워지고, 이 세계관을 읽던 방들은 연결이 끊깁니다. 서버의 world-archive/trash 폴더에 사본이 남습니다.</p>
        ${st.ask === 'world' ? `<span class="ask">정말 「${esc(w.name)}」을(를) 지울까요? <button class="danger" type="button" data-act="delete-world">지우기</button><button class="quiet" type="button" data-act="ask" data-key="">취소</button></span>`
          : '<button class="danger" type="button" data-act="ask" data-key="world">세계관 지우기</button>'}
      </div>`;
  }

  const ACTION_TEXT = {
    create: (c) => `새 ${KIND[c.type]?.label || '설정'} <b>${esc(c.name)}</b>${c.by === 'person' ? ' · 직접 만듦' : ''}`,
    edit: (c) => {
      const label = { name: '이름', description: '메모', aliases: '다른 이름', pinned: '고정', extra: '추가 칸', type: '종류' };
      const keys = (c.keys || []).map((k) => label[k] || (st.fields[c.type] || []).find((f) => f.key === k)?.label || k);
      return `<b>${esc(c.name)}</b> · 직접 고침${keys.length ? `: ${esc(keys.join(', '))}` : ''}`;
    },
    field: (c) => `<b>${esc(c.name)}</b> · ${esc((st.fields[c.type] || []).find((f) => f.key === c.key)?.label || c.key)}: ${c.before ? `${esc(c.before)} → ` : ''}${esc(c.after)}${c.correction ? ' · 정정됨' : ''}${c.why ? ` · ${esc(c.why)}` : ''}`,
    rumor: (c) => `<b>${esc(c.name)}</b> · ${esc((st.fields[c.type] || []).find((f) => f.key === c.key)?.label || c.key)}: 확인 안 됨 「${esc(c.after)}」 · ${esc(c.by2 || '소문')}의 말`,
    alias: (c) => `<b>${esc(c.name)}</b> · 다른 이름 「${esc(c.after)}」`,
    memo: (c) => `<b>${esc(c.name)}</b> · 메모: ${esc(c.after)}${c.why ? ` · ${esc(c.why)}` : ''}`,
    merge: (c) => `<b>${esc(c.name)}</b> · 「${esc(c.dropName)}」와(과) 합침`,
    rename: (c) => `<b>${esc(c.before)}</b> → <b>${esc(c.after)}</b> · 번역 단어장의 이름으로`,
    'relation-add': (c) => `관계 <b>${esc(c.name)}</b> · ${esc(c.relation?.type || '')}${c.relation?.note ? ` (${esc(c.relation.note)})` : ''}`,
    'relation-note': (c) => `관계 <b>${esc(c.name)}</b> · ${c.before ? `${esc(c.before)} → ` : ''}${esc(c.after)}`,
    'relation-differs': (c) => `관계 <b>${esc(c.name)}</b> · ${esc(c.relation?.type || '')} 서로 다른 말 — 그대로 둠`,
    'relation-flip': (c) => `관계 <b>${esc(c.name)}</b> · ${esc(c.relation?.type || '')} 방향 바뀜`,
    'relation-remove': (c) => `관계 <b>${esc(c.name)}</b> · ${esc(c.relation?.type || '')} 끝남`,
    cell: (c) => `<b>${esc(c.name)}</b> · ${esc(String(c.key || '').replace('|', ' '))}: ${c.before ? `${esc(c.before)} → ` : ''}${c.after ? esc(c.after) : '지움'}${c.moved ? ` · 시간표로 옮김(${esc((st.fields[c.moved.type] || []).find((f) => f.key === c.moved.key)?.label || c.moved.key)} 칸에서)` : ''}`,
    event: (c) => `<b>${esc(c.name)}</b> · ${esc(c.after?.name || c.before?.name || '')}: ${c.before?.date && c.after?.date && c.before.date !== c.after.date ? `${esc(c.before.date)} → ` : ''}${esc(c.after?.date || c.after?.when || '')}${c.after?.cancelled && !c.before?.cancelled ? ' · 취소' : ''}${c.after ? '' : ' 지움'}`,
    'cell-pending': (c) => `<b>${esc(c.name)}</b> · ${esc(String(c.key || '').replace('|', ' '))}: 대화에서는 「${esc(c.after)}」`,
    base: (c) => `<b>${esc(c.name)}</b> · 본거지: ${esc(c.beforeName || '없음')} → ${esc(c.afterName || '없음')}`,
    extra: (c) => `<b>${esc(c.name)}</b> · ${esc(c.key)}: ${c.before ? `${esc(c.before)} → ` : ''}${esc(c.after)}`,
    room: (c) => `<b>${esc(c.name)}</b> · 지내는 곳: ${esc(c.beforeName || '없음')} → ${esc(c.afterName || '없음')}`,
    work: (c) => `<b>${esc(c.name)}</b> · 일하는 곳: ${esc(c.beforeName || '없음')} → ${esc(c.afterName || '없음')}`,
    reveal: (c) => `<b>${esc(c.name)}</b> · ${esc((st.fields[c.type] || []).find((f) => f.key === c.key)?.label || c.key)}: 이야기에 드러남`,
    hide: (c) => `<b>${esc(c.name)}</b> · ${esc((st.fields[c.type] || []).find((f) => f.key === c.key)?.label || c.key)}: 아직 드러나지 않음(프로필에만 있음)`,
    applies: (c) => `<b>${esc(c.name)}</b> · 적용되는 곳: ${esc(c.beforeName || '세계 전체')} → ${esc(c.afterName || '세계 전체')}`,
    'alias-remove': (c) => `<b>${esc(c.name)}</b> · 이름이 아닌 다른 이름 「${esc(c.alias)}」 뗌`,
    'alias-move': (c) => `<b>${esc(c.name)}</b> · 다른 이름 「${esc(c.alias)}」을(를) 새 집단 「${esc(c.to)}」(으)로 옮김`,
    delete: (c) => `<b>${esc(c.name)}</b> 지움${c.relations?.length ? ` · 관계 ${c.relations.length}개도 함께` : ''}`,
  };
  /** An evidence sentence in “ ”, without the quote marks it may already carry (the reader often keeps the line's own). */
  const quoted = (t) => `“${esc(String(t).trim().replace(/^["“”'「『]+|["“”'」』]+$/g, ''))}”`;
  const fmtTime = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${fmtDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

  function historyHtml() {
    const list = st.history;
    return `
      <div class="eyebrow">HISTORY · ${list.length}</div>
      <h1>기록</h1>
      <p class="intro">자동 반영이 바꾼 내용과 직접 합친 인물입니다. 잘못 들어간 건 「되돌리기」로 하나씩 되돌릴 수 있습니다. 그 뒤에 다시 바뀌었거나 직접 고친 설정은 되돌리지 않습니다.</p>
      ${list.length ? `<div class="paper"><ul class="hist">${list.map((c) => `
        <li class="${c.undoneAt ? 'undone' : ''}">
          <div class="what">${(ACTION_TEXT[c.action] || (() => esc(c.action)))(c)}</div>
          ${c.evidence ? `<div class="ev">${quoted(c.evidence)}</div>` : ''}
          <div class="when">${fmtTime(c.at)}${c.undoneAt ? ' · 되돌림' : ''}</div>
          <div class="side-act">${c.undoneAt ? '' : `<button class="quiet" type="button" data-act="undo" data-id="${esc(c.id)}">되돌리기</button>`}</div>
        </li>`).join('')}</ul></div>`
        : '<div class="empty"><h2>아직 기록이 없습니다</h2><p>자동 반영을 켜면 대화에서 찾은 설정이 여기에 남습니다.</p></div>'}`;
  }

  /** 할 일 11: totals added up by code, every record with its evidence, 손으로 더하기 · 빼기, 되돌리기. */
  function scoresHtml() {
    const w = world();
    const b = w.scoreboard || {};
    const unit = esc(b.unit || '');
    const sc = st.scores;
    const head = `
      <div class="eyebrow">SCOREBOARD · ${roomTitle()}</div>
      <h1>${esc(b.name || '점수판')}</h1>
      <p class="intro">이 방의 점수입니다. 자동 반영이 대화에서 「누가 몇 점을, 왜」를 근거 문장과 함께 찾고, 합계는 코드가 더합니다. 리롤·수정·삭제로 사라진 메시지의 점수는 합계에서 빠집니다. 합계는 {{세계}}에 「[점수]」 줄로 들어갑니다.</p>`;
    if (!sc) return head + '<div class="empty"><h2>이 방이 이 세계관을 읽지 않습니다</h2><p>점수판은 방마다 따로입니다. 이 세계관에 연결한 방에서 열어 주세요.</p></div>';
    const totals = sc.totals.length ? `<div class="stubs">${sc.totals.map((t) => `<div class="stub"><strong>${t.total.toLocaleString()}${unit}</strong><small>${esc(t.target)}</small></div>`).join('')}</div>` : '<p class="sub">아직 점수가 없습니다.</p>';
    const add = `
      <form class="paper" onsubmit="return false">
        <h2>손으로 더하기 · 빼기</h2>
        <div class="grid2">
          <div><label class="f" for="sc-target">대상</label><input id="sc-target" maxlength="60" list="sc-targets"><datalist id="sc-targets">${sc.totals.map((t) => `<option value="${esc(t.target)}">`).join('')}</datalist></div>
          <div><label class="f" for="sc-delta">점수<em>빼려면 -10처럼</em></label><input id="sc-delta" type="number" step="1" style="max-width:140px"></div>
        </div>
        <label class="f" for="sc-reason">이유</label><input id="sc-reason" maxlength="200">
        <div class="actions"><button class="primary" type="button" data-act="score-add">기록하기</button></div>
      </form>`;
    const list = sc.events.length ? `<div class="paper"><h2>기록 ${sc.events.length}</h2><ul class="hist">${sc.events.map((e) => `
        <li class="${e.undoneAt || e.gone ? 'undone' : ''}">
          <div class="what"><b>${esc(e.target)}</b> ${e.delta > 0 ? '+' : ''}${e.delta}${unit}${e.reason ? ` · ${esc(e.reason)}` : ''}${e.by === 'person' ? ' · 직접' : ''}</div>
          ${e.evidence ? `<div class="ev">${quoted(e.evidence)}</div>` : ''}
          <div class="when">${fmtTime(e.at)}${e.gone ? ' · 메시지가 사라져 합계에서 뺌' : ''}${e.undoneAt ? ' · 되돌림' : ''}</div>
          <div class="side-act">${e.undoneAt ? `<button class="quiet" type="button" data-act="score-undo" data-id="${esc(e.eventId)}" data-undo="0">다시 넣기</button>` : `<button class="quiet" type="button" data-act="score-undo" data-id="${esc(e.eventId)}" data-undo="1">되돌리기</button>`}</div>
        </li>`).join('')}</ul></div>` : '';
    return head + `<div class="paper">${totals}</div>` + add + list;
  }

  // ------------------------------------------------------------------ 세계관 칸 (v0.6.0 · 시안 C · E · F · G)
  // 장소별 탭: a tab per big place (a place in no other place) holding the places inside it, the groups based there
  // (and their smaller groups), the rules and systems that hold there, and their 시간표 · 학사일정. 「세계 전체」: what
  // holds everywhere. 「모름」: what no place has yet. All worked out here from the settings and relations (no new API).
  const DAY_EN = { 월: 'MON', 화: 'TUE', 수: 'WED', 목: 'THU', 금: 'FRI', 토: 'SAT', 일: 'SUN' };
  const MONTH_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const KO_DAYS = ['일', '월', '화', '수', '목', '금', '토'];
  const WEEK = ['월', '화', '수', '목', '금', '토', '일'];
  const ROLE_RE = /(교수|교사|선생|사감|기숙사장|반장|감독생|교장|부교장|학장|원장|단장|부단장|회장|부회장|대장|주장|관리인|관리자|사서|집사|하인|하녀|시종|주인|점원|지배인|족장|우두머리|지도자|수장|창립자|설립자|출신|졸업)/;
  const hasYear = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
  const utc = (d) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  const dowOf = (d) => KO_DAYS[new Date(utc(d)).getUTCDay()];
  const fmtKo = (d) => (hasYear(d) ? `${Number(d.slice(0, 4))}년 ${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일` : String(d || '').replace(/^--(\d\d)-(\d\d)$/, (_, m, dd) => `${Number(m)}월 ${Number(dd)}일`));
  /** The school year (학년도) a date belongs to — the same as world-archive/lib/calendar.cjs schoolYear. */
  function schoolYearOf(date) {
    if (!hasYear(date)) return null;
    const start = world()?.yearStart || 9;
    const y = Number(date.slice(0, 4));
    const first = Number(date.slice(5, 7)) >= start ? y : y - 1;
    return start === 1 ? String(first) : `${first}–${String(first + 1).slice(-2)}`;
  }
  /** The story's today in this room (when the room reads the world on screen): { date, weekday } or null. */
  const storyToday = () => (st.room?.worldId === st.worldId && st.room?.story?.date ? st.room.story : null);

  // v0.6.2: a place whose 위치 칸 names a group (교장실 → 「호그와트」) is in that group — the same rule as the server's
  // groupOfPlace (world-archive/lib/store.cjs): the group's name or other name, or that without 학교 · 기숙사 · 가문 …
  const SQ = (x) => String(x || '').normalize('NFC').toLowerCase().replace(/[\s"'“”‘’·,.()]+/g, '');
  const GROUP_ENDS = ['마법학교', '기숙사', '기사단', '가문', '집안', '일가', '학교', '학원', '조직', '무리', '일행', 'family', 'school', 'house'];
  const groupKeysC = (g) => [...new Set([g.name, ...(g.aliases || [])].map(SQ).flatMap((k) => { const end = GROUP_ENDS.find((x) => k.endsWith(x) && k.length - x.length >= 2); return [k, end ? k.slice(0, -end.length) : k]; }))].filter((k) => k.length >= 2);
  const GROUP_BUILDING = ['성', '성채', '본관', '교정', '캠퍼스', '본부', 'castle', 'campus', 'grounds', 'manor', 'estate', 'hall', 'headquarters', 'hq'];
  const VEHICLE = /(열차|기차|마차|보트|급행|호차|(^|\s)배(\s|$)|express|train|carriage|coach|boat)/i; // v0.6.4 f: the same as the server's
  function groupOfPlaceC(p, all) {
    if (p?.type !== 'place' || VEHICLE.test(String(p.name || ''))) return null;
    const nm = SQ(p.name);
    const own = all.find((g) => g.type === 'group' && groupKeysC(g).some((k) => GROUP_BUILDING.some((w) => nm === k + w)));
    if (own) return own;
    const t = SQ(p?.fields?.location);
    if (!t) return null;
    if (all.some((x) => x.type === 'place' && x.entityId !== p.entityId && [x.name, ...(x.aliases || [])].some((n) => SQ(n).length >= 2 && SQ(n) === t))) return null;
    const len = (g) => Math.max(0, ...groupKeysC(g).filter((k) => t.includes(k)).map((k) => k.length));
    return all.filter((g) => g.type === 'group' && len(g) > 0).sort((a, b) => len(b) - len(a))[0] || null;
  }
  function worldMap() {
    const byId = new Map(st.entities.map((e) => [e.entityId, e]));
    const rels = st.relations || [];
    const up = new Map(); // a place → the place it is in (위치)
    for (const r of rels) if (r.type === '위치' && byId.get(r.from)?.type === 'place' && byId.get(r.to)?.type === 'place' && !up.has(r.from)) up.set(r.from, r.to);
    const chain = (id) => { const out = []; const seen = new Set([id]); let x = id; while (up.has(x) && !seen.has(up.get(x))) { x = up.get(x); seen.add(x); out.push(x); } return out; }; // the places it is in, nearest first
    const top = (id) => chain(id).at(-1) || id;
    // a top place that is in a group: the group heads its tab
    const inGroup = new Map();
    for (const p of st.entities.filter((e) => e.type === 'place' && !up.has(e.entityId))) { const g = groupOfPlaceC(p, st.entities); if (g) inGroup.set(p.entityId, g.entityId); }
    const tabTop = (id) => inGroup.get(top(id)) || top(id);
    const heads = new Set(inGroup.values());
    const groupUp = new Map(); // a group → the bigger group it belongs to (소속, smaller → bigger)
    for (const r of rels) if (r.type === '소속' && byId.get(r.from)?.type === 'group' && byId.get(r.to)?.type === 'group' && !groupUp.has(r.from)) groupUp.set(r.from, r.to);
    const groupHome = (g) => { const seen = new Set(); let x = g; while (x && !seen.has(x.entityId)) { seen.add(x.entityId); if (x.base && byId.get(x.base)?.type === 'place') return tabTop(x.base); if (heads.has(x.entityId)) return x.entityId; x = byId.get(groupUp.get(x.entityId)); } return null; };
    const homeOf = (id) => { const e = byId.get(id); return !e ? null : e.type === 'place' ? tabTop(id) : e.type === 'group' ? groupHome(e) : e.type === 'person' && e.room && byId.has(e.room) ? tabTop(e.room) : null; };
    const tabs = new Map();
    const tabOf = (id) => { if (!tabs.has(id)) tabs.set(id, { key: id, place: byId.get(id), places: [], groups: [], rules: [], sheets: [], cals: [] }); return tabs.get(id); };
    const everywhere = { key: 'world', rules: [], sheets: [], cals: [] };
    const lost = { key: 'unknown', rules: [], groups: [], places: [], sheets: [], cals: [] };
    for (const p of st.entities.filter((e) => e.type === 'place')) { const t = tabTop(p.entityId); if (t !== p.entityId) tabOf(t).places.push(p); else tabOf(p.entityId); }
    for (const g of st.entities.filter((e) => e.type === 'group')) { const h = groupHome(g); (h ? tabOf(h).groups : lost.groups).push(g); }
    for (const e of st.entities) {
      if (RULEISH.has(e.type)) { if (e.appliesTo === 'world') everywhere.rules.push(e); else { const h = e.appliesTo && homeOf(e.appliesTo); (h ? tabOf(h).rules : lost.rules).push(e); } }
      if (e.timetable) { const h = homeOf(e.timetable.ownerId); (h ? tabOf(h).sheets : lost.sheets).push(e); }
      if (e.calendar) { if (!e.calendar.ownerId) everywhere.cals.push(e); else { const h = homeOf(e.calendar.ownerId); (h ? tabOf(h).cals : lost.cals).push(e); } }
    }
    const size = (t) => t.places.length + t.groups.length + t.rules.length + t.sheets.length + t.cals.length;
    const list = [...tabs.values()].filter((t) => t.place);
    for (const t of list) if (!size(t) && t.place.type === 'place') lost.places.push(t.place);
    const big = list.filter((t) => size(t) && (t.place.type === 'place' || heads.has(t.key))).sort((a, b) => size(b) - size(a) || a.place.name.localeCompare(b.place.name, 'ko'));
    // the path inside the tab: every place it is in but the tab's own head (a group head: the top place is shown)
    const pathOf = (p, key) => [...chain(p.entityId).reverse().filter((id) => id !== key).map((id) => byId.get(id)?.name), p.name].filter(Boolean).join(' › ');
    return { byId, big, everywhere, lost, size, pathOf, top: tabTop, homeOf, up, groupUp };
  }
  const RULEISH = new Set(['rule', 'system']);
  const caps = (list, label = (e) => e.name) => `<div class="wt-row">${list.map((e) => `<button class="cap" type="button" data-act="open" data-id="${esc(e.entityId)}" data-q="${esc(label(e).toLowerCase())}">${esc(label(e))}</button>`).join('')}</div>`;
  const ruleText = (e) => e.description || e.fields?.how || e.fields?.category || '';
  // v0.6.2 ②: a rule or system one batch spoke of — kept, not in {{세계}} (the same test as the server's)
  const LAW_NAME = /([^\s마]법(\s|$)|령(\s|$)|규칙|제도)|\b(?:laws?|decrees?|statutes?|acts?|codes?|charters?|treaty|treaties|rules?|regulations?|edicts?)\b/i; // the server's (inject.cjs)
  function isOnce(e) {
    // v0.8.0: only once the world has been read long enough (the server's onceReady)
    return world()?.onceReady !== false && ['rule', 'system', 'custom', 'history'].includes(e.type) && !(e.appliesTo && e.appliesTo !== 'world') && !e.pinned && e.provenance?.source !== 'manual' && !Object.values(e.sources || {}).includes('manual') && !LAW_NAME.test(e.name) && Number.isFinite(e.seen?.n) && e.seen.n < 2;
  }
  const topicRank = (t) => { const i = (st.topics || []).indexOf(t); return i < 0 ? 99 : i; };
  const ruleRow = (e) => `<div class="wt-rule" data-q="${esc(`${e.name} ${ruleText(e)} ${e.topic || ''}`.toLowerCase())}"><span class="tcap${e.topic ? '' : ' none'}">${esc(e.topic || '주제 없음')}</span><div class="rb"><button class="rt" type="button" data-act="open" data-id="${esc(e.entityId)}">${esc(e.name)}</button>${st.ruleKind ? `<small class="kind">${e.type === 'system' ? '시스템' : '규칙'}</small>` : ''}${ruleText(e) ? `<p class="rd">${esc(clip(ruleText(e), 220))}</p>` : ''}</div></div>`;
  /** The 주제 capsules over a tab's rules: 전부 · each topic (with its count) · 한 번 나옴 숨기기 · 규칙/시스템 나눠 보기. */
  function topicBar(list) {
    const n = (t) => list.filter((e) => (t === '' ? true : (e.topic || '그 밖') === t)).length;
    const pick = st.topicFilter || '';
    const caps = ['', ...(st.topics || [])].filter((t) => t === '' || t === pick || n(t)).map((t) => `<button class="cap${t === pick ? ' on' : ''}" type="button" data-act="topic-filter" data-topic="${esc(t)}" aria-pressed="${t === pick}">${t ? esc(t) : '전부'}<small>${n(t)}</small></button>`).join('');
    const onceN = list.filter(isOnce).length;
    const opts = `${onceN || st.hideOnce ? `<button class="cap opt${st.hideOnce ? ' on' : ''}" type="button" data-act="hide-once" aria-pressed="${!!st.hideOnce}">한 번 나옴 숨기기<small>${onceN}</small></button>` : ''}<button class="cap opt${st.ruleKind ? ' on' : ''}" type="button" data-act="rule-kind" aria-pressed="${!!st.ruleKind}">규칙 · 시스템 나눠 보기</button>${!st.readOnly && st.entities.some((e) => RULEISH_T.has(e.type) && !e.topic && e.sources?.topic !== 'manual') ? '<button class="cap opt" type="button" data-act="topic-fill" title="주제가 빈 규칙 · 시스템을 이름 · 분류 · 내용만으로 한 번에 묻습니다(작은 호출).">주제 채우기</button>' : ''}`;
    return `<div class="topic-bar" role="group" aria-label="주제로 거르기">${caps}${opts}</div>`;
  }
  const RULEISH_T = new Set(['rule', 'system']);
  /**
   * A tab's rules and systems: the 주제 bar, then (in a big place's tab, key) one block per small place they hold in
   * (「시장 전체」 first, then 「지팡이 가게」 …), each sorted by 주제 then name.
   */
  function rulesHtml(list, key = null) {
    const m = key ? worldMap() : null;
    const pick = st.topicFilter || '';
    const shown = list.filter((e) => (!pick || (e.topic || '그 밖') === pick) && !(st.hideOnce && isOnce(e)));
    const sort = (a, b) => topicRank(a.topic) - topicRank(b.topic) || a.name.localeCompare(b.name, 'ko');
    let rows;
    if (!m) rows = shown.slice().sort(sort).map(ruleRow).join('');
    else {
      const bigName = m.byId.get(key)?.name || '';
      const blocks = new Map();
      for (const e of shown) {
        const at = e.appliesTo && e.appliesTo !== key ? m.byId.get(e.appliesTo) : null;
        const label = at ? at.name : `${bigName} 전체`;
        if (!blocks.has(label)) blocks.set(label, { whole: !at, path: at ? m.pathOf(at, key) : '', list: [] });
        blocks.get(label).list.push(e);
      }
      const order = [...blocks.entries()].sort(([a, x], [b, y]) => (y.whole - x.whole) || x.path.localeCompare(y.path, 'ko') || a.localeCompare(b, 'ko'));
      rows = order.length < 2 && order[0]?.[1].whole ? order[0][1].list.sort(sort).map(ruleRow).join('')
        : order.map(([label, b]) => `<h4 class="wt-rgrp">${esc(label)}<small>${b.list.length}</small></h4>${b.list.sort(sort).map(ruleRow).join('')}`).join('');
    }
    return `${topicBar(list)}${rows || '<p class="wt-empty">고른 주제에 맞는 것이 없습니다.</p>'}`;
  }

  /** The part of a 소속 칸 that says what the person is there (「5학년 반장」 of 「은사슴 기숙사생 5학년 반장」). */
  function roleIn(p, g) {
    const aff = String(p?.fields?.affiliation || '');
    // the piece of the 소속 칸 that names this group; another group's role is not this one's
    const named = aff.split(/[,，、]/).filter((x) => [g.name, ...(g.aliases || [])].some((n) => n && x.includes(n)));
    const piece = (named.length ? named : aff.split(/[,，、]/)).find((x) => ROLE_RE.test(x)) || '';
    let t = piece;
    for (const n of [g.name, ...(g.aliases || [])]) t = t.split(n).join(' ');
    t = t.replace(/\s+/g, ' ').trim();
    return t || (piece.match(ROLE_RE) || [''])[0];
  }
  /** 「은사슴 1학년」 under 「은사슴 기숙사생」: only the words the bigger group's name does not have (「1학년」). */
  const shortVia = (via, g) => { const have = new Set(String(g.name).split(/\s+/)); const left = String(via).split(/\s+/).filter((x) => !have.has(x) && !String(g.name).includes(x)).join(' '); return left || via; };
  function rosterCard(g, subs = []) {
    const r = st.rosters?.[g.entityId];
    if (!r || r.loading) { if (!r) void loadRoster(g.entityId); return `<div class="world-card" data-q="${esc(g.name.toLowerCase())}"><h3><button type="button" data-act="open" data-id="${esc(g.entityId)}">${esc(g.name)}</button> <span class="pill">집단</span></h3><p class="wt-empty">명단을 불러오는 중…</p></div>`; }
    const list = r.members || [];
    const byId = new Map(st.entities.map((e) => [e.entityId, e]));
    const open = st.rosterOpen?.has(g.entityId);
    const cap = (m, extra) => `<button class="cap" type="button" data-act="open" data-id="${esc(m.entityId)}" data-q="${esc(m.name.toLowerCase())}">${esc(m.name)}${m.unnamed ? ' (이름 모름)' : extra ? ` · ${esc(extra)}` : ''}</button>`;
    const part = (kind, label, more) => {
      const rows = list.filter((m) => m.kind === kind);
      if (!rows.length) return '';
      const shown = kind === 'member' && !open && rows.length > 6 ? rows.slice(0, 5) : rows;
      const rest = rows.length - shown.length;
      return `<div class="wt-grp">${label}${more || ''}</div><div class="wt-row">${shown.map((m) => cap(m, kind === 'member' ? (m.via ? shortVia(m.via, g) : '') : roleIn(byId.get(m.entityId), g))).join('')}${rest ? `<button class="cap ghost" type="button" data-act="roster-more" data-id="${esc(g.entityId)}">+ ${rest}명</button>` : ''}</div>`;
    };
    const c = r.counts || {};
    const head = c.total ? ` · 이름 아는 사람 ${c.known}명 / 전체 ${c.total}명` : ` · ${list.filter((m) => m.kind === 'member').length}명`;
    const small = subs.length ? `<div class="wt-grp">작은 집단</div><div class="wt-row">${subs.map((x) => `<button class="cap" type="button" data-act="open" data-id="${esc(x.entityId)}" data-q="${esc(x.name.toLowerCase())}">${esc(x.name)}${x.fields?.size ? ` · ${esc(x.fields.size)}` : ''}</button>`).join('')}</div>` : '';
    const body = list.length ? part('member', '구성원', head) + small + part('staff', '맡은 사람') + part('past', '지난 구성원') + part('animal', '함께 사는 동물') : small + `<p class="wt-empty">아직 이 집단에 소속된 인물이 없습니다.${c.total ? ` 전체 ${c.total}명` : ''}</p>`;
    return `<div class="world-card" data-q="${esc([g.name, ...list.map((m) => m.name)].join(' ').toLowerCase())}"><h3><button type="button" data-act="open" data-id="${esc(g.entityId)}">${esc(g.name)}</button> <span class="pill">집단</span></h3>${body}</div>`;
  }

  // 시간표 (시안 E): days across, times down; the same subject the same soft tone; a lesson that runs two hours joins
  // the next 교시; the story's weekday a cream band; a night lesson dark with stars; 「이전」 in blue. On a phone: one
  // day at a time, picked by capsules.
  function ttGrid(e) {
    const cellsAll = Object.entries(e.timetable?.cells || {});
    if (!cellsAll.length) return '<p class="wt-empty">아직 칸이 없습니다.</p>';
    const today = storyToday()?.weekday || (storyToday() ? dowOf(storyToday().date) : null);
    const spread = (d) => (d === '평일' ? ['월', '화', '수', '목', '금'] : d === '매일' ? WEEK : [d]);
    const at = new Map(); // `${day}|${slot}` → [key, cell]
    for (const [k, c] of cellsAll) for (const d of spread(c.day)) if (!at.has(`${d}|${c.slot}`)) at.set(`${d}|${c.slot}`, [k, c]);
    const days = WEEK.filter((d, i) => i < 5 || cellsAll.some(([, c]) => spread(c.day).includes(d)));
    const slots = [...new Set(cellsAll.map(([, c]) => c.slot))].sort((a, b) => ttSlotRank(a) - ttSlotRank(b) || a.localeCompare(b, 'ko'));
    const tones = new Map();
    const TONES = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];
    for (const s of slots) for (const d of days) { const c = at.get(`${d}|${s}`)?.[1]; const subj = c && (c.subject || c.value); if (subj && !tones.has(subj)) tones.set(subj, TONES[tones.size % TONES.length]); }
    const night = (s) => /밤|자정|새벽/.test(s) || ttSlotRank(s) >= 1200 && ttSlotRank(s) < 2000;
    const lesson = (s) => Number((String(s).match(/^(\d+)\s*교시/) || [])[1]) || null;
    const HOURS = ['', '한', '두', '세', '네', '다섯'];
    // which cells a two-hour lesson covers below it (only the next 교시 numbers, only when they are empty)
    const covered = new Set();
    const span = new Map();
    for (const d of days) for (let i = 0; i < slots.length; i++) {
      const c = at.get(`${d}|${slots[i]}`)?.[1];
      if (!c || !(c.hours > 1) || !lesson(slots[i])) continue;
      let n = 1;
      while (n < c.hours && slots[i + n] && lesson(slots[i + n]) === lesson(slots[i]) + n && !at.has(`${d}|${slots[i + n]}`)) { covered.add(`${d}|${slots[i + n]}`); n++; }
      span.set(`${d}|${slots[i]}`, n);
    }
    const stars = '<i style="left:14%;top:22%"></i><i style="left:72%;top:18%"></i><i style="left:46%;top:76%"></i><i style="left:88%;top:62%"></i><i style="left:28%;top:58%"></i>';
    const box = (d, s, tall) => {
      const hit = at.get(`${d}|${s}`);
      if (!hit) return night(s) ? '' : '<div class="wt-free"></div>';
      const [k, c] = hit;
      const subj = c.subject || c.value;
      // the small line: place · how long · what the value adds to the subject (「천문 관측 23:00」 → 「23:00」), never the subject again
      const extra = c.value !== subj ? (c.value.startsWith(subj) ? c.value.slice(subj.length).replace(/^[\s·,—–-]+/, '') : c.value) : '';
      const sub = [c.place, c.hours > 1 ? `${HOURS[c.hours] || c.hours} 시간` : '', extra].filter(Boolean).join(' · ');
      const was = c.past?.[0] ? `<div class="wt-was">이전: ${esc(c.past[0].value)}</div>` : '';
      const wait = c.pending ? `<div class="wt-was">대화에서는 「${esc(c.pending.value)}」</div>` : '';
      const q = esc(`${c.value} ${c.place || ''}`.toLowerCase());
      if (night(s)) return `<button class="wt-night" type="button" data-act="open" data-id="${esc(e.entityId)}" data-q="${q}" title="${esc(c.evidence || '')}">${stars}<b>${esc(subj)}</b><small>${esc(sub)}</small>${was}</button>`;
      const cls = c.past?.[0] ? 'changed' : tones.get(subj) || 's3';
      return `<button class="wt-c ${cls}${(e.timetable.wide || []).includes(k) ? ' wide' : ''}" type="button" data-act="open" data-id="${esc(e.entityId)}" data-q="${q}" title="${esc(c.evidence || '')}" ${tall ? `style="min-height:${58 * tall + 6 * (tall - 1)}px"` : ''}><b>${esc(subj)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}${was}${wait}</button>`;
    };
    const morning = (s) => ttSlotRank(s) < 720;
    const lunchAt = slots.findIndex((s, i) => i > 0 && morning(slots[i - 1]) && !morning(s));
    // v0.6.1: the story's weekday is one cream band from the head to the last row (every row's cell of that day, the
    // 점심 line too, rounded at the bottom)
    const mid = Math.floor((days.length - 1) / 2);
    const lunchRow = `<tr class="wt-lunch"><td></td>${days.map((d, j) => `<td class="l${d === today ? ' todaycol' : ''}">${j === mid ? '점 심' : ''}</td>`).join('')}</tr>`;
    const cellTd = (d, s, i) => {
      const n = span.get(`${d}|${s}`) || 1;
      const cls = d === today ? `todaycol${i + n - 1 === slots.length - 1 ? ' end' : ''}` : '';
      return `<td ${n > 1 ? `rowspan="${n}"` : ''} class="${cls}">${box(d, s, n > 1 ? n : 0)}</td>`;
    };
    const rows = slots.map((s, i) => `${i === lunchAt ? lunchRow : ''}<tr><td class="t"><b>${esc(s)}</b></td>${days.map((d) => (covered.has(`${d}|${s}`) ? '' : cellTd(d, s, i))).join('')}</tr>`).join('');
    const table = `<table class="wt-tt"><thead><tr><th class="blank"></th>${days.map((d) => `<th class="${d === today ? 'today' : ''}">${d}<small>${DAY_EN[d]}</small></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
    // phone: one day
    const pick = st.ttDay && days.includes(st.ttDay) ? st.ttDay : today && days.includes(today) ? today : days[0];
    const dayRows = (d) => { let out = ''; for (let i = 0; i < slots.length; i++) { const s = slots[i]; if (covered.has(`${d}|${s}`)) continue; if (i === lunchAt) out += '<div class="wt-dlunch">점 심</div>'; const n = span.get(`${d}|${s}`) || 1; const label = n > 1 && lesson(s) ? `${lesson(s)}–${lesson(s) + n - 1}교시` : s; out += `<div class="wt-drow"><div class="t"><b>${esc(label)}</b></div>${box(d, s) || '<div class="wt-free"></div>'}</div>`; } return out; };
    const phone = `<div class="wt-dtab">${days.map((d) => `<button type="button" data-act="tt-day" data-day="${d}" class="${d === pick ? 'on' : d === today ? 'td' : ''}">${d}</button>`).join('')}</div>${days.map((d) => `<div class="wt-day ${d === pick ? 'on' : ''}">${dayRows(d)}</div>`).join('')}`;
    const clash = (e.timetable.overlaps || []).length ? `<p class="wt-clash">시간이 겹치는 칸이 ${e.timetable.overlaps.length}쌍 있어요 — 칸을 눌러 고르세요.</p>` : '';
    return clash + table + phone;
  }

  // 학사일정 (시안 F): the chosen school year by month; a new calendar year with a big year and a double line; what is
  // over faded; today a blue line; the very next one dark; cancelled struck through; 「N일 뒤」 for what is ahead.
  const kindWord = (n) => (/시험/.test(n) ? '시험' : /방학/.test(n) ? '방학' : /경기|시합|대회/.test(n) ? '경기' : /연회|축제|파티/.test(n) ? '연회' : '행사');
  const kindTone = (k) => ({ 시험: 'c3', 경기: 'c1', 방학: 'c2', 연회: 'c2', 행사: 'c2' })[k] || 'c2';
  function calList(e, year) {
    const all = Object.values(e.calendar?.events || {});
    const evs = all.filter((x) => (year === 'none' ? !hasYear(x.date) : schoolYearOf(x.date) === year)).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    if (!evs.length) return '<p class="wt-empty">이 학년도에는 일정이 없습니다.</p>';
    const today = storyToday()?.date || null;
    const next = today ? evs.find((x) => hasYear(x.date) && x.date >= today && !x.cancelled) : null;
    let out = '';
    let lastMonth = '';
    let lastYear = '';
    let todayShown = !today || year === 'none';
    for (const x of evs) {
      if (hasYear(x.date)) {
        const y = x.date.slice(0, 4);
        const m = x.date.slice(5, 7);
        if (!todayShown && x.date >= today) { out += `<div class="wt-today">오늘 · ${esc(fmtKo(today))}</div>`; todayShown = true; }
        if (lastYear && y !== lastYear) out += `<div class="wt-newyear"><b>${y}</b></div>`;
        if (`${y}-${m}` !== lastMonth) out += `<div class="wt-mon"><b>${Number(m)}월</b><small>${MONTH_EN[Number(m) - 1]} ${y}</small></div>`;
        lastYear = y; lastMonth = `${y}-${m}`;
      }
      const left = today && hasYear(x.date) ? Math.round((utc(x.date) - utc(today)) / 86400000) : null;
      const kw = kindWord(x.name);
      const k = x.cancelled ? '취소' : left != null && left > 0 ? `${left}일 뒤` : left === 0 ? '오늘' : kw;
      const sub = x.end ? `${fmtKo(x.date)} ~ ${fmtKo(x.end)}${x.place ? ` · ${x.place}` : ''}` : [x.place, x.who].filter(Boolean).join(' · ') || (x.cancelled ? '취소됨' : '');
      const was = x.past?.[0]?.date ? `<span class="was">이전: ${esc(x.past[0].date.slice(5).replace('-', '/'))}</span>` : '';
      const cls = ['wt-ev', x === next ? 'next' : kindTone(kw), left != null && left < 0 ? 'past' : '', x.cancelled ? 'cancel' : '', hasYear(x.date) ? '' : 'noyear'].filter(Boolean).join(' ');
      const d = hasYear(x.date) ? `${Number(x.date.slice(8, 10))}<small>${dowOf(x.date)}</small>` : `${Number(String(x.date).slice(-2)) || '?'}<small>${Number(String(x.date).slice(2, 4)) || '?'}월</small>`;
      out += `<button class="${cls}" type="button" data-act="open" data-id="${esc(e.entityId)}" data-q="${esc(`${x.name} ${x.place || ''}`.toLowerCase())}" title="${esc(x.evidence || '')}"><div class="d">${d}</div><div class="n"><b>${esc(x.name)}</b><small>${esc(sub)}${was}</small></div><span class="k">${esc(k)}</span></button>`;
    }
    if (!todayShown) out += `<div class="wt-today">오늘 · ${esc(fmtKo(today))}</div>`;
    return out;
  }

  /** 학년도 capsules (시안 G): the years the tab's 시간표 · 학사일정 have — before faded, now black, after dashed. */
  function yearsOf(t) {
    const set = new Set();
    let none = 0;
    for (const s of t.sheets) if (s.timetable.year) set.add(s.timetable.year);
    for (const c of t.cals) for (const x of Object.values(c.calendar.events || {})) { const y = schoolYearOf(x.date); if (y) set.add(y); else none++; }
    const today = storyToday()?.date;
    const years = [...set].sort();
    const now = today ? schoolYearOf(today) : years.at(-1) || null;
    if (now && !set.has(now) && years.length) years.push(now), years.sort();
    const chosen = st.year === 'none' && none ? 'none' : st.year && years.includes(st.year) ? st.year : now || years.at(-1) || (none ? 'none' : null);
    return { years, now, none, chosen };
  }
  function yearsHtml(y) {
    if (!y.years.length && !y.none) return '';
    const cap = (v) => `<button class="wt-year ${v < y.now ? 'past' : v === y.now ? 'now' : 'next'}${v === y.chosen ? ' on' : ''}" type="button" data-act="year" data-year="${esc(v)}">${esc(v)}${v === y.now && storyToday() ? ' · 지금' : ''}</button>`;
    return `<div class="wt-years"><span>학년도</span>${y.years.map(cap).join('')}${y.none ? `<button class="wt-year none${y.chosen === 'none' ? ' on' : ''}" type="button" data-act="year" data-year="none">연도 모름 ${y.none}</button>` : ''}</div>`;
  }

  function subtabsHtml(m, sel) {
    const t = (key, label, n) => `<button class="subtab${sel === key ? ' selected' : ''}" type="button" data-act="tab" data-tab="${esc(key)}" role="tab" aria-selected="${sel === key}">${esc(label)}${n != null ? ` ${n}` : ''}</button>`;
    const go2 = (view, label) => `<button class="subtab${st.view === view ? ' selected' : ''}" type="button" data-act="go" data-view="${view}">${label}</button>`;
    const w = m.everywhere;
    const lostN = m.lost.rules.length + m.lost.groups.length + m.lost.places.length + m.lost.sheets.length + m.lost.cals.length;
    return `<div class="subtabs" role="tablist">${t('world', '세계 전체', w.rules.length + w.cals.length)}${m.big.map((x) => t(x.key, x.place.name, m.size(x))).join('')}${lostN ? t('unknown', '모름', lostN) : ''}${world()?.scoreboard?.name ? go2('scores', '점수판') : ''}${go2('log', '기록')}${EMBEDDED ? `${go2('overview', '모든 설정')}${go2('world', '세계관 정보')}` : ''}</div>`;
  }

  function tabsHtml() {
    const m = worldMap();
    const keys = ['world', 'unknown', ...m.big.map((x) => x.key)];
    // first: the biggest place; with none, 「세계 전체」 when it has anything, else 「모름」
    const lostN = m.lost.rules.length + m.lost.groups.length + m.lost.places.length + m.lost.sheets.length + m.lost.cals.length;
    const sel = keys.includes(st.tab) ? st.tab : m.big[0]?.key || (m.everywhere.rules.length + m.everywhere.cals.length || !lostN ? 'world' : 'unknown');
    const today = storyToday();
    const todayLine = today ? ` · 이야기 속 오늘은 ${fmtKo(today.date)}(${today.weekday || dowOf(today.date)})` : '';
    const find = `<input class="wt-find" id="tabq" type="search" placeholder="이 탭에서 찾기" value="${esc(st.tabQuery || '')}" aria-label="이 탭에서 찾기">`;
    const timeParts = (t, y) => {
      const sheets = t.sheets.filter((s) => !y.chosen || y.chosen === 'none' || !s.timetable.year || s.timetable.year === y.chosen);
      const ownerName = (s) => m.byId.get(s.timetable.ownerId)?.name || s.name;
      return (y.chosen === 'none' ? '' : sheets.map((s) => `<div class="wt-sec">시간표 · ${esc(ownerName(s))}${s.timetable.year ? ` <small class="sub">${esc(s.timetable.year)}</small>` : ''}</div>${ttGrid(s)}`).join(''))
        + t.cals.map((c) => `<div class="wt-sec">학사일정 · ${esc(m.byId.get(c.calendar.ownerId)?.name || '세계')}${y.chosen ? ` <small class="sub">${y.chosen === 'none' ? '연도 모름' : `${esc(y.chosen)} 학년도`}</small>` : ''}</div>${calList(c, y.chosen)}`).join('');
    };
    let body;
    if (sel === 'world') {
      const t = m.everywhere;
      const y = yearsOf(t);
      body = `${yearsHtml(y)}<p class="wt-eyebrow">세계 전체</p><h1 class="wt-h1">${esc(world().name)}</h1><p class="wt-lead">어디서나 통하는 규칙 · 시스템이에요. 장면과 상관없이 {{세계}}에 들어가요(장면 방식에서는 한도의 3분의 1까지)${todayLine}.</p>${find}
        <div class="wt-sec">규칙 · 시스템</div>${t.rules.length ? rulesHtml(t.rules) : '<p class="wt-empty">아직 세계 전체에 통하는 규칙이 없습니다.</p>'}${timeParts(t, y)}`;
    } else if (sel === 'unknown') {
      const t = m.lost;
      body = `<p class="wt-eyebrow">모름</p><h1 class="wt-h1">어디 것인지 모름</h1><p class="wt-lead">아직 어느 장소에도 붙지 않은 것이에요. 카드에서 「적용되는 곳」 · 「본거지」 · 위치 관계를 정하면 그 장소 탭으로 옮겨 가요. 장면 방식에서는 맨 뒤에 들어가요.</p>${find}
        ${t.rules.length ? `<div class="wt-sec">규칙 · 시스템</div>${rulesHtml(t.rules)}` : ''}${t.groups.length ? `<div class="wt-sec">본거지를 모르는 집단</div>${t.groups.map((g) => rosterCard(g)).join('')}` : ''}
        ${t.places.length ? `<div class="wt-sec">따로 있는 장소</div>${caps(t.places)}` : ''}${t.sheets.length || t.cals.length ? timeParts(t, yearsOf(t)) : ''}`;
    } else {
      const t = m.big.find((x) => x.key === sel);
      const y = yearsOf(t);
      const p = t.place;
      const based = t.groups.some((g) => g.base);
      const lead = p.description || p.fields?.use || '';
      const staying = st.entities.filter((e) => e.type === 'person' && e.room && m.top(e.room) === p.entityId);
      body = `${yearsHtml(y)}<p class="wt-eyebrow">${p.type === 'group' ? '큰 장소 · 집단' : based ? '큰 장소 · 집단 본거지' : '큰 장소'}</p><h1 class="wt-h1">${esc(p.name)}</h1><p class="wt-lead">${esc(lead)}${lead ? (/[.!?。」)]$/.test(lead.trim()) ? ' ' : '. ') : ''}이 탭의 규칙은 장면이 여기일 때 모델에게 들어가요${todayLine}.</p>${find}
        ${t.places.length ? `<div class="wt-sec">안의 장소</div>${caps(t.places.slice().sort((a, b) => m.pathOf(a, t.key).localeCompare(m.pathOf(b, t.key), 'ko')), (e) => m.pathOf(e, t.key))}` : ''}
        ${t.groups.length ? `<div class="wt-sec">집단 · 명단</div>${t.groups.filter((g) => !t.groups.some((x) => x.entityId === m.groupUp.get(g.entityId))).map((g) => rosterCard(g, t.groups.filter((x) => m.groupUp.get(x.entityId) === g.entityId))).join('')}` : ''}
        ${staying.length ? `<div class="wt-sec">여기서 지내는 사람</div>${caps(staying, (e) => `${e.name} · ${m.byId.get(e.room)?.name || ''}`)}` : ''}
        ${timeParts(t, y)}
        ${t.rules.length ? `<div class="wt-sec">규칙 · 시스템</div>${rulesHtml(t.rules, t.key)}` : ''}
        <p class="wt-empty" style="margin-top:18px"><button class="quiet" type="button" data-act="open" data-id="${esc(p.entityId)}">「${esc(p.name)}」 카드 열기</button></p>`;
    }
    return `${subtabsHtml(m, sel)}${body}<p class="sub" id="tabNoHit" hidden>이 탭에는 찾는 것이 없습니다.</p>`;
  }
  function filterTab() {
    const q = String(st.tabQuery || '').trim().toLowerCase();
    let shown = 0;
    root.querySelectorAll('main [data-q]').forEach((x) => { const hit = !q || x.dataset.q.includes(q); x.hidden = !hit; if (hit) shown++; });
    const none = $('#tabNoHit');
    if (none) none.hidden = !q || shown > 0;
  }

  /** The right column in 기억 서재 (its inspector, in its own classes): this world at a glance, this room, {{세계}}. */
  function worldRailHtml() {
    const w = world();
    if (!w) return '';
    const m = worldMap();
    const people = st.entities.filter((e) => e.type === 'person');
    const animals = people.filter((e) => String(e.fields?.species || '').trim()).length;
    const rules = st.entities.filter((e) => RULEISH.has(e.type));
    const inside = m.big.reduce((n, t) => n + t.places.length, 0);
    const p = st.preview;
    const today = storyToday();
    return `<div class="rail-title">이 세계관</div>
      <div class="rail-stat"><b>${people.length}</b><span>인물<small>${animals ? `동물 ${animals} 포함` : '&nbsp;'}</small></span></div>
      <div class="rail-stat"><b>${m.big.length}</b><span>큰 장소<small>안의 장소 ${inside}</small></span></div>
      <div class="rail-stat"><b>${rules.length}</b><span>규칙 · 시스템<small>세계 전체 ${m.everywhere.rules.length}</small></span></div>
      <div class="rail-divider"></div>
      <div class="rail-note"><h3>이 방</h3><p>${roomState().kind === 'this' ? `「${esc(w.name)}」 세계관을 읽는 중이에요.` : esc(roomLine())}${today ? `<br>이야기 속 오늘: ${esc(fmtKo(today.date))}` : ''}</p></div>
      ${p && roomState().kind === 'this' ? `<div class="rail-divider"></div><div class="rail-note"><h3>{{세계}}에 들어갈 내용</h3><p>${p.chars.toLocaleString()} / ${p.budget.toLocaleString()}자<br>설정 ${p.included.length}개${p.omitted.length ? ` · 한도 때문에 빠진 것 ${p.omitted.length}개` : ''}${p.skipped > 0 ? ` · 장면 밖 ${p.skipped}개` : ''}</p></div>` : ''}`;
  }

  function mainHtml() {
    if (!st.loaded) return st.bad ? '' : '<p class="sub">불러오는 중…</p>';
    if (st.view === 'new-world' || !world()) return newWorldHtml(!st.worlds.length);
    if (st.view === 'world') return worldHtml();
    if (st.view === 'tabs') return tabsHtml();
    if (st.view === 'log') return historyHtml();
    if (st.view === 'scores') return scoresHtml();
    if (KIND[st.view]) {
      if (st.editing === 'new') return formHtml(null, st.view);
      const e = st.entities.find((x) => x.entityId === (st.editing || st.detail));
      if (e && st.editing) return formHtml(e, st.view);
      if (e) return detailHtml(e);
      if (st.dupes) return dupesHtml();
      return listHtml(st.view);
    }
    return overviewHtml();
  }

  let lastScreen = '';
  function render() {
    host.setAttribute('data-theme', st.theme);
    el.side.innerHTML = sideHtml();
    el.top.innerHTML = topHtml();
    el.rail.innerHTML = railHtml();
    const screen = `${st.view}|${st.worldId}|${st.detail}|${st.editing}|${st.dupes}|${st.tab}|${st.year}`;
    const keep = screen === lastScreen ? el.main.scrollTop : 0;
    const skew = st.readOnly
      ? `<p class="msg bad" role="status">${esc(UPDATE_MSG)}</p>`
      : !target && st.serverVersion && st.serverVersion !== VERSION
      ? `<p class="msg bad" role="status">서버 쪽 World Archive(v${esc(st.serverVersion)})와 이 화면(v${esc(VERSION)})의 판이 달라요. 서버 쪽을 업데이트해 주세요 — 서버에서 설치 명령을 다시 실행하면 됩니다.</p>`
      : '';
    const nav = EMBEDDED && st.loaded && world() && st.view !== 'tabs' && !st.detail && !st.editing && (['log', 'scores', 'world', 'overview'].includes(st.view) || KIND[st.view]) ? subtabsHtml(worldMap(), null) : '';
    const viewBar = EMBEDDED && st.loaded && st.worldId ? `<div class="emb-view" data-no-tr>${viewLangHtml()}</div>` : '';
    // v0.8.4: the band on every screen of a world (한눈에 with this room linked has it in its 자동 반영 box instead)
    const band = st.loaded && st.view !== 'new-world' && !(st.view === 'overview' && roomState().kind === 'this') ? modelBandHtml(false) : '';
    el.main.innerHTML = band + viewBar + skew + (st.msg && !(st.readOnly && st.msg === UPDATE_MSG) ? `<p class="msg ${st.bad ? 'bad' : ''}" role="status">${esc(st.msg)}</p>` : '') + nav + mainHtml();
    el.main.scrollTop = keep;
    lastScreen = screen;
    if (st.query) filterCards();
    if (st.view === 'tabs' && st.tabQuery) filterTab();
    if (st.busy) root.querySelectorAll('main button, .rail button').forEach((b) => { b.disabled = true; });
    koFix([el.side, el.top, el.rail, el.main]);
    if (st.viewKo) koView();
    // v0.8.4: from the band — straight to 자동 반영, the switch on (saved only with 저장), the picker focused
    if (st.pickModel && st.view === 'world' && !st.busy && st.connections != null) {
      st.pickModel = false;
      const on = root.getElementById('a-on');
      const sel = root.getElementById('a-conn');
      if (on) on.checked = true;
      if (sel) {
        sel.closest('form')?.scrollIntoView({ block: 'start' });
        sel.focus({ preventScroll: true });
        sel.classList.add('pick-flash');
        setTimeout(() => sel.classList.remove('pick-flash'), 1600);
      }
    }
  }
  // ------------------------------------------------------------------ v0.7.0 3: 「보기: 한국어」
  // Only a view: text nodes on the screen that are not Korean show their Korean (cache by text, then small calls on
  // the server, cached there by value hash). Inputs are never touched; {{세계}} always gets the original.
  const koCache = new Map(); // original text → Korean
  const koFailed = new Set();
  // the screen's own English (PEOPLE · 14, WORLD ARCHIVE) is decoration in capitals: never sent
  const needsKo = (t) => /[A-Za-z]{2}/.test(t) && /[a-z]/.test(t) && !/[가-힣]/.test(t);
  let koAsking = false;
  function koNodes() {
    const out = [];
    for (const box of [el.main, el.rail]) {
      const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest('input,textarea,select,script,style,[data-no-tr],.eyebrow,.wt-eyebrow,.brand') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
      for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.nodeValue.trim(); if (t && needsKo(t)) out.push(n); }
    }
    return out;
  }
  function koView() {
    const missing = new Set();
    for (const n of koNodes()) {
      const t = n.nodeValue.trim();
      const ko = koCache.get(t);
      if (ko) n.nodeValue = n.nodeValue.replace(t, ko);
      else if (!koFailed.has(t)) missing.add(t);
    }
    if (!missing.size || koAsking || !st.worldId) return;
    koAsking = true;
    st.koBusy = true;
    refreshViewLang();
    const texts = [...missing].slice(0, 120);
    const worldId = st.worldId;
    api('POST', `/worlds/${worldId}/translate`, { texts })
      .then((r) => { for (const [k, v] of Object.entries(r.items || {})) koCache.set(k, v); for (const t of texts) if (!koCache.has(t)) koFailed.add(t); })
      .catch((e) => { for (const t of texts) koFailed.add(t); st.msg = `한국어 보기: ${e?.message || e}`; st.bad = true; })
      // never a whole redraw (a form being written stays): the top bar, and the Korean put into the nodes there are
      .finally(() => { koAsking = false; st.koBusy = false; refreshViewLang(); if (st.viewKo && st.worldId === worldId) koView(); });
  }
  /** Korean for these settings values (the edit form in the Korean view), into koCache. */
  async function koFor(values) {
    const texts = [...new Set(values.map((t) => String(t || '').trim()).filter((t) => t && needsKo(t) && !koCache.has(t)))];
    if (!texts.length) return;
    const r = await api('POST', `/worlds/${st.worldId}/translate`, { texts });
    for (const [k, v] of Object.entries(r.items || {})) koCache.set(k, v);
  }
  /**
   * v0.7.0 1: the small fixed-width, letter-spaced styles are English decoration (WORLD · SETTINGS); a label or note in
   * Korean in one of them is set like a Korean label (명조, no letter spacing) — labels bold 14px in ink, notes 12.5px.
   */
  const KO_LABEL = '.eyebrow,.wt-eyebrow,.sec small,.state small,.fact small,.rail-title,.nav-label,.wt-tt th small,.wt-mon small,.chart .num small';
  const KO_NOTE = '.pill,.card .foot,.meta,.hist .when,.auto-tag,.card .al,.sheet-head .al,.side-bottom small,.wt-ev .d small,.brand small';
  function koFix(parts) {
    const hangul = /[가-힣]/;
    for (const part of parts) {
      if (!part) continue;
      part.querySelectorAll(KO_LABEL).forEach((x) => { if (hangul.test(x.textContent)) x.classList.add('ko', 'lab'); });
      part.querySelectorAll(KO_NOTE).forEach((x) => { if (hangul.test(x.textContent)) x.classList.add('ko', 'sm'); });
    }
  }

  // 할 일 6 — 검색: the server finds names, other names, field values and memos (and the glossary's English names);
  // the cards of this list are shown in its order with the matched part marked. Until it answers, names filter locally.
  let searchTimer = null;
  let searchSeq = 0;
  function runSearch() {
    clearTimeout(searchTimer);
    const q = st.query.trim();
    if (!q || !st.worldId) { st.hits = null; filterCards(); return; }
    filterCards();
    const seq = ++searchSeq;
    searchTimer = setTimeout(async () => {
      try {
        const r = await api('GET', `/worlds/${st.worldId}/search?q=${encodeURIComponent(q)}&types=${encodeURIComponent(KIND[st.view] ? st.view : '')}`);
        if (seq !== searchSeq) return;
        st.hits = new Map((r.results || []).map((x, i) => [x.entityId, { ...x, order: i }]));
        filterCards();
      } catch { /* keep the local filter */ }
    }, 200);
  }
  const marked = (h) => `${h.label ? `${esc(h.label)} · ` : ''}${esc(h.text.slice(0, h.start))}<mark>${esc(h.text.slice(h.start, h.end))}</mark>${esc(h.text.slice(h.end))}`;

  function filterCards() {
    const q = st.query.trim().toLowerCase();
    let shown = 0;
    root.querySelectorAll('.card').forEach((c) => {
      const found = q && st.hits ? st.hits.get(c.dataset.id) : null;
      const hit = !q || (st.hits ? !!found : c.dataset.search.includes(q));
      c.hidden = !hit;
      c.style.order = found ? String(found.order) : '';
      c.querySelector('.hit')?.remove();
      const show = found?.hits.find((h) => h.where !== 'name');
      if (show) c.querySelector('.nm')?.insertAdjacentHTML('afterend', `<p class="hit">${marked(show)}</p>`);
      if (hit) shown++;
    });
    const none = $('#noHit');
    if (none) none.hidden = shown > 0;
  }

  // ------------------------------------------------------------------ actions
  const val = (id) => root.getElementById(id)?.value ?? '';
  const setVal = (v, key, value) => { if (key === 'description') v.description = value; else v.fields[key] = value; };
  async function saveEntity(v) {
    let e;
    if (st.editing === 'new') e = await api('POST', `/worlds/${st.worldId}/entities`, v);
    else {
      const old = st.entities.find((x) => x.entityId === st.editing);
      e = await api('PATCH', `/worlds/${st.worldId}/entities/${old.entityId}`, { ...v, revision: old.revision });
    }
    st.view = e.type; st.detail = e.entityId; st.editing = null; st.draft = null; st.backCheck = null;
    await loadEntities();
    await loadRoom();
  }
  function readForm() {
    const fields = {};
    root.querySelectorAll('[data-field]').forEach((x) => { fields[x.dataset.field] = x.value; });
    const extra = [...root.querySelectorAll('[data-extra]')].map((r) => ({ label: r.querySelector('[data-x=label]').value, value: r.querySelector('[data-x=value]').value }));
    return {
      name: val('fd-name'),
      type: val('fd-type'),
      aliases: val('fd-aliases').split(/[,，、]/).map((x) => x.trim()).filter(Boolean),
      fields,
      extra,
      description: val('fd-desc'),
      pinned: !!root.getElementById('fd-pinned')?.checked,
      // v0.7.0 7: 숨김 · 주제 · 일하는 곳 — only when the form shows them
      ...(root.querySelector('[data-hidden]') ? { hidden: Object.fromEntries([...root.querySelectorAll('[data-hidden]')].map((x) => [x.dataset.hidden, x.checked])) } : {}),
      ...(root.getElementById('fd-topic') ? { topic: val('fd-topic') } : {}),
      ...(root.getElementById('fd-work') ? { work: val('fd-work') || null } : {}),
    };
  }

  const go = (view) => { st.view = view; st.hits = null; st.dupes = false; st.detail = null; st.editing = null; st.draft = null; st.ask = null; st.query = ''; st.msg = ''; st.fromTabs = false; };

  const actions = {
    go: (b) => {
      go(b.dataset.view);
      if (b.dataset.view === 'log') return run(loadHistory);
      if (b.dataset.view === 'scores') return run(loadScores);
      if ((b.dataset.view === 'world' || b.dataset.view === 'new-world') && st.connections == null) { render(); return run(loadConnections); }
      render();
    },
    'pick-model': () => {
      go('world');
      st.pickModel = true;
      if (st.connections == null) { render(); return run(loadConnections); }
      render();
    },
    'read-now': () => run(async () => {
      st.auto = await api('POST', `/rooms/${encodeURIComponent(activeChatId())}/auto`, { all: true });
      if (st.auto.job?.state !== 'running') { await loadEntities(); await loadRoom(); }
      pollAuto();
    }),
    'read-restart': () => run(async () => {
      st.ask = null;
      st.auto = await api('POST', `/rooms/${encodeURIComponent(activeChatId())}/auto`, { all: true, restart: true });
      if (st.auto.job?.state !== 'running') { await loadEntities(); await loadRoom(); }
      pollAuto();
    }),
    undo: (b) => run(async () => {
      await api('POST', `/worlds/${st.worldId}/history/${b.dataset.id}/undo`, {});
      await loadHistory();
      await loadEntities();
      await loadRoom();
    }, '되돌렸습니다.'),
    dupes: () => { st.dupes = true; st.detail = null; st.editing = null; st.ask = null; st.msg = ''; render(); },
    merge: (b) => run(async () => {
      const keep = st.entities.find((x) => x.entityId === b.dataset.keep);
      const drop = st.entities.find((x) => x.entityId === b.dataset.drop);
      if (!keep || !drop) throw Error('설정을 찾지 못했습니다. 새로 불러온 뒤 다시 해 주세요.');
      st.ask = null;
      await api('POST', `/worlds/${st.worldId}/merge`, { keepId: keep.entityId, dropId: drop.entityId, keepRevision: keep.revision, dropRevision: drop.revision });
      await loadEntities();
      await loadRoom();
    }, '합쳤습니다. 잘못 합쳤다면 「기록」에서 되돌릴 수 있습니다.'),
    dismiss: (b) => run(async () => {
      await api('POST', `/worlds/${st.worldId}/duplicates/dismiss`, { a: b.dataset.a, b: b.dataset.b });
      await loadEntities();
    }, '다른 사람으로 두었습니다. 이 두 사람은 다시 묻지 않습니다.'),
    'save-auto': () => run(async () => {
      const w = world();
      const enabled = !!root.getElementById('a-on')?.checked;
      const connectionId = val('a-conn') || null;
      if (enabled && !connectionId) throw Error('자동 반영에 쓸 연결을 골라 주세요.');
      await api('PATCH', `/worlds/${w.worldId}`, { auto: { enabled, connectionId, every: Number(val('a-every')) }, revision: w.revision });
      await loadWorlds();
      await loadRoom();
    }, '저장했습니다.'),
    'view-lang': (b) => { st.viewKo = b.dataset.lang === 'ko'; store.set('world-archive-view', st.viewKo ? 'ko' : 'orig'); st.backCheck = null; render(); },
    'back-cancel': () => { st.backCheck = null; root.getElementById('backCheck')?.remove(); },
    'back-save': () => run(async () => {
      const plan = st.backCheck;
      if (!plan) return;
      st.backCheck = null;
      await saveEntity(plan.v);
    }, '저장했습니다.'),
    theme: () => { st.theme = st.theme === 'dark' ? 'light' : 'dark'; store.set('world-archive-theme', st.theme); render(); },
    close: () => toggle(false),
    open: (b) => { if (st.view === 'tabs') { st.fromTabs = true; st.view = st.entities.find((x) => x.entityId === b.dataset.id)?.type || st.view; } st.detail = b.dataset.id; st.editing = null; st.ask = null; st.msg = ''; render(); },
    // v0.7.0 4: from 세계관 정보 · 기록 · 모든 설정 too — back to the tab view, nothing open or being edited
    tab: (b) => { st.tab = b.dataset.tab; st.view = 'tabs'; st.detail = null; st.editing = null; st.ask = null; st.fromTabs = false; st.year = null; st.tabQuery = ''; st.ttDay = null; render(); },
    year: (b) => { st.year = b.dataset.year; render(); },
    // v0.7.0 2: a capsule sets the number field (saved with 「저장」 like the rest of the form; no re-render, so other
    // unsaved edits stay)
    budget: (b) => {
      const input = root.querySelector('#w-budget');
      if (!input) return;
      const custom = b.dataset.n === 'custom';
      st.budgetCustom = custom;
      if (!custom) input.value = b.dataset.n;
      input.hidden = !custom;
      b.parentElement.querySelectorAll('button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
      if (custom) input.focus();
    },
    'tt-day': (b) => { st.ttDay = b.dataset.day; render(); },
    'roster-more': (b) => { st.rosterOpen.add(b.dataset.id); render(); },
    new: (b) => { st.view = b.dataset.type; st.editing = 'new'; st.detail = null; st.draft = null; st.msg = ''; render(); },
    edit: (b) => {
      st.editing = b.dataset.id; st.detail = b.dataset.id; st.draft = null; st.msg = ''; st.backCheck = null;
      const e = st.entities.find((x) => x.entityId === b.dataset.id);
      // the Korean view: the values in Korean first (cache, then a small call)
      if (st.viewKo && e) return run(() => koFor([...Object.values(e.fields || {}), e.description || '']));
      render();
    },
    cancel: () => { if (st.editing !== 'new') st.view = st.entities.find((x) => x.entityId === st.editing)?.type || st.view; st.editing = null; st.draft = null; st.msg = ''; render(); },
    ask: (b) => { st.ask = b.dataset.key || null; render(); },
    'add-extra': () => { root.getElementById('extras').insertAdjacentHTML('beforeend', extraRow()); root.querySelector('#extras [data-extra]:last-child input')?.focus(); },
    'drop-extra': (b) => b.closest('[data-extra]').remove(),
    save: async () => {
      const v = readForm();
      // v0.7.0 3: written in the Korean view — what was left as shown keeps its original; what was changed goes back
      // into the settings' language (a small call) and both are shown before saving
      const shown = [...root.querySelectorAll('[data-orig]')];
      const changed = [];
      for (const x of shown) {
        const key = x.dataset.field || 'description';
        const now = x.value;
        if (now === x.dataset.ko) setVal(v, key, x.dataset.orig);
        else if (now.trim() && now !== x.dataset.orig) changed.push({ key, label: x.dataset.label || key, ko: now });
      }
      if (!changed.length) return run(() => saveEntity(v), '저장했습니다.');
      // not through run(): the form stays as written (with its originals) until the person confirms
      if (st.busy) return;
      st.busy = true;
      const btn = root.querySelector('#entityForm [data-act="save"]');
      if (btn) { btn.disabled = true; btn.textContent = '원문 언어로 되돌리는 중…'; }
      root.getElementById('backCheck')?.remove();
      let box;
      try {
        const r = await api('POST', `/worlds/${st.worldId}/translate-back`, { texts: changed.map((c) => c.ko), lang: 'en' });
        changed.forEach((c, i) => { c.to = r.items?.[i] || ''; });
        if (changed.some((c) => !c.to)) throw Error('원문 언어로 되돌리지 못했어요. 다시 해 보거나 「원문」 보기에서 고쳐 주세요.');
        for (const c of changed) { setVal(v, c.key, c.to); koCache.set(c.to.trim(), c.ko); }
        st.backCheck = { v, changed };
        box = backCheckHtml(st.backCheck);
      } catch (e) {
        box = `<p class="msg bad" id="backCheck" role="status" data-no-tr>${esc(e?.message || String(e))}</p>`;
      } finally {
        st.busy = false;
        if (btn) { btn.disabled = false; btn.textContent = '저장'; }
      }
      root.querySelector('#entityForm > .actions')?.insertAdjacentHTML('beforebegin', box);
      root.getElementById('backCheck')?.scrollIntoView?.({ block: 'nearest' });
    },
    // v0.7.2 L: 「대표 이름을 바꿀까요 [바꾸기]」 — the same ordinary rename (the old name stays as an other name)
    'name-suggest': (b) => run(async () => {
      const e = st.entities.find((x) => x.entityId === b.dataset.id);
      if (!e?.nameSuggest) throw Error('설정을 찾지 못했습니다. 새로 불러온 뒤 다시 해 주세요.');
      const name = e.nameSuggest;
      const aliases = [...e.aliases, e.name].filter((a, i, all) => a !== name && all.indexOf(a) === i).slice(0, 20);
      await api('PATCH', `/worlds/${st.worldId}/entities/${e.entityId}`, { name, aliases, revision: e.revision });
      await loadEntities();
      await loadRoom();
    }, '대표 이름을 바꿨습니다.'),
    // 「번역 단어장에는 ○○예요 [적용]」: an ordinary rename by the person; the old name stays as an other name.
    'glossary-name': (b) => run(async () => {
      const e = st.entities.find((x) => x.entityId === b.dataset.id);
      if (!e?.glossaryName) throw Error('설정을 찾지 못했습니다. 새로 불러온 뒤 다시 해 주세요.');
      const name = e.glossaryName;
      const aliases = [...e.aliases, e.name].filter((a, i, all) => a !== name && all.indexOf(a) === i).slice(0, 20);
      await api('PATCH', `/worlds/${st.worldId}/entities/${e.entityId}`, { name, aliases, revision: e.revision });
      await loadEntities();
      await loadRoom();
    }, '번역 단어장의 이름으로 바꿨습니다.'),
    // v0.5.0 명단: adding / taking off changes that person's 소속 칸 (in 기록, undoable).
    // v0.5.0 A-2: a name only one person's 소속 칸 has becomes a group when the person says so.
    'group-make': (b) => run(async () => {
      await api('POST', `/worlds/${st.worldId}/group-suggestions`, { name: b.dataset.name });
      await loadEntities();
    }, '집단으로 만들었습니다. 소속 칸이 그 이름을 가리키는 인물은 명단에 들어갑니다.'),
    'member-add': (b) => run(async () => {
      const personId = root.getElementById('rosterPick')?.value;
      if (!personId) return;
      await api('POST', `/worlds/${st.worldId}/entities/${b.dataset.group}/members`, { personId, on: true });
      await loadEntities();
    }, '명단에 더했습니다. 그 인물의 소속 칸에도 적었습니다.'),
    'member-off': (b) => run(async () => {
      await api('POST', `/worlds/${st.worldId}/entities/${b.dataset.group}/members`, { personId: b.dataset.id, on: false });
      await loadEntities();
    }, '명단에서 뺐습니다. 그 인물의 소속 칸에서도 지웠습니다(기록에서 되돌릴 수 있습니다).'),
    pin: (b) => run(async () => {
      const e = st.entities.find((x) => x.entityId === b.dataset.id);
      await api('PATCH', `/worlds/${st.worldId}/entities/${e.entityId}`, { pinned: !e.pinned, revision: e.revision });
      await loadEntities();
      await loadRoom();
    }),
    delete: (b) => run(async () => {
      const e = st.entities.find((x) => x.entityId === b.dataset.id);
      await api('DELETE', `/worlds/${st.worldId}/entities/${e.entityId}`, { revision: e.revision });
      go(e.type);
      await loadEntities();
      await loadRoom();
    }, '지웠습니다.'),
    link: () => run(async () => {
      await api('PUT', `/rooms/${encodeURIComponent(activeChatId())}`, { worldId: st.worldId });
      await loadRoom();
    }, '이제 이 방이 이 세계관을 읽습니다.'),
    unlink: () => run(async () => {
      await api('PUT', `/rooms/${encodeURIComponent(activeChatId())}`, { worldId: null });
      await loadRoom();
    }, '연결을 끊었습니다.'),
    'create-world': () => run(async () => {
      // v0.8.4: the model that organizes it and 자동 반영 (on by default) at once; no model is fine (the band asks later)
      const w = await api('POST', '/worlds', { name: val('nw-name'), description: val('nw-desc'), auto: { enabled: !!root.getElementById('nw-auto')?.checked, connectionId: val('nw-conn') || null } });
      st.worldId = w.worldId;
      store.set('world-archive-world', w.worldId);
      go('overview');
      await loadWorlds();
      await loadEntities();
    }, '세계관을 만들었습니다.'),
    'save-world': () => run(async () => {
      const w = world();
      await api('PATCH', `/worlds/${w.worldId}`, { name: val('w-name'), description: val('w-desc'), injectChars: Number(val('w-budget')), injectMode: val('w-mode') === 'scene' ? 'scene' : 'all', scoreboard: { name: val('w-board'), unit: val('w-unit') }, yearStart: Number(val('w-year')) || 9, nameStyle: val('w-names') || 'auto', summaryLang: val('w-lang') || 'auto', personFields: [...root.querySelectorAll('[data-pf]')].filter((x) => x.checked).map((x) => x.dataset.pf), tail: { cast: !!root.getElementById('w-tail-cast')?.checked, balance: !!root.getElementById('w-tail-bal')?.checked }, balance: val('w-balance').split(/[,，]/).map((x) => x.trim()).filter(Boolean).slice(0, 4), revision: w.revision });
      await loadWorlds();
      await loadRoom();
    }, '저장했습니다.'),
    pending: (b) => run(async () => {
      const e = st.entities.find((x) => x.entityId === b.dataset.id);
      await api('POST', `/worlds/${st.worldId}/entities/${e.entityId}/pending/${encodeURIComponent(b.dataset.key)}`, { revision: e.revision });
      await loadEntities();
    }, '대화의 값으로 바꿨습니다. 기록에서 되돌릴 수 있습니다.'),
    'pending-drop': (b) => run(async () => {
      const e = st.entities.find((x) => x.entityId === b.dataset.id);
      await api('POST', `/worlds/${st.worldId}/entities/${e.entityId}/pending/${encodeURIComponent(b.dataset.key)}`, { revision: e.revision, discard: true });
      await loadEntities();
    }),
    'past-prompt': (b) => run(async () => {
      const e = st.entities.find((x) => x.entityId === b.dataset.id);
      if (!e) throw Error('설정을 찾지 못했습니다. 새로 불러온 뒤 다시 해 주세요.');
      const k = b.dataset.key;
      await api('PATCH', `/worlds/${st.worldId}/entities/${e.entityId}`, { pastInPrompt: { ...(e.pastInPrompt || {}), [k]: !e.pastInPrompt?.[k] }, revision: e.revision });
      await loadEntities();
      await loadRoom();
    }),
    'score-add': () => run(async () => {
      const delta = Number(val('sc-delta'));
      if (!val('sc-target').trim() || !Number.isInteger(delta) || !delta) throw Error('대상과 점수(0이 아닌 정수)를 적어 주세요.');
      await api('POST', `/rooms/${encodeURIComponent(activeChatId())}/scores`, { target: val('sc-target'), delta, reason: val('sc-reason') || '손으로 고침' });
      await loadScores();
      await loadRoom();
    }, '기록했습니다.'),
    'score-undo': (b) => run(async () => {
      await api('POST', `/rooms/${encodeURIComponent(activeChatId())}/scores/${encodeURIComponent(b.dataset.id)}/undo`, { undo: b.dataset.undo === '1' });
      await loadScores();
      await loadRoom();
    }),
    // v0.5.0 B 시간표
    'cell-save': (b) => run(async () => {
      const e = st.entities.find((x) => x.entityId === b.dataset.id);
      await api('PUT', `/worlds/${st.worldId}/timetable/cell`, { entityId: e.entityId, revision: e.revision, day: root.getElementById('ttDay')?.value, slot: root.getElementById('ttSlot')?.value, value: root.getElementById('ttValue')?.value || '' });
      await loadEntities();
    }, '칸을 저장했습니다. 직접 쓴 칸은 대화가 덮어쓰지 않습니다.'),
    // v0.5.0 C
    'applies-set': (b) => run(async () => {
      const v = root.getElementById('appliesPick')?.value || null;
      await api('PUT', `/worlds/${st.worldId}/entities/${b.dataset.id}/applies-to`, { appliesTo: v });
      await loadEntities();
    }, '적용되는 곳을 바꿨습니다. 직접 정한 값은 대화가 덮어쓰지 않습니다.'),
    'cell-clear': (b) => run(async () => {
      const e = st.entities.find((x) => x.entityId === b.dataset.id);
      const [day, slot] = String(b.dataset.key).split('|');
      await api('PUT', `/worlds/${st.worldId}/timetable/cell`, { entityId: e.entityId, revision: e.revision, day, slot, value: '' });
      await loadEntities();
    }, '그 칸을 지웠습니다. 기록에서 되돌릴 수 있습니다.'),
    // v0.5.0 K
    'event-pending': (b) => run(async () => {
      await api('POST', `/worlds/${st.worldId}/entities/${b.dataset.id}/calendar/pending`, { eventId: b.dataset.event, discard: b.dataset.discard === '1' });
      await loadEntities();
    }),
    'cal-gather': () => run(async () => {
      const r = await api('POST', `/worlds/${st.worldId}/calendar-gather`, {});
      await loadEntities();
      st.bad = false;
      st.msg = r.moved.length ? `학사일정으로 옮겼습니다(${r.moved.length}개): ${r.moved.map((m) => m.name).join(', ')}. 기록에서 되돌릴 수 있습니다.` : '옮길 날짜 일정이 없습니다.';
    }),
    'cell-pending': (b) => run(async () => {
      await api('POST', `/worlds/${st.worldId}/entities/${b.dataset.id}/timetable/pending`, { key: b.dataset.key, discard: b.dataset.discard === '1' });
      await loadEntities();
    }),
    'tt-gather': () => run(async () => {
      const r = await api('POST', `/worlds/${st.worldId}/timetable-gather`, {});
      await loadEntities();
      st.bad = false;
      st.msg = r.moved.length
        ? `시간표로 옮겼습니다(${r.moved.length}개): ${r.moved.map((m) => m.name).join(', ')}${r.left.length ? ` · 못 옮긴 것 ${r.left.length}개: ${r.left.join(', ')}` : ''}. 기록에서 되돌릴 수 있습니다.`
        : `옮길 수업·일과 일정이 없습니다${r.left.length ? `(요일·시간이나 주인을 모르는 것 ${r.left.length}개: ${r.left.join(', ')})` : ''}.`;
    }),
    // v0.5.0 E
    'applies-fill': () => run(async () => {
      const r = await api('POST', `/worlds/${st.worldId}/applies-fill`, {});
      await loadEntities();
      st.bad = false;
      st.msg = `적용되는 곳이 빈 규칙·시스템 ${r.asked}개 가운데 ${r.filled.length}개를 채웠습니다(호출 ${r.calls}번). 나머지는 모름으로 둡니다. 기록에서 되돌릴 수 있습니다.`;
    }),
    'location-fill': () => run(async () => {
      const r = await api('POST', `/worlds/${st.worldId}/location-fill`, {});
      await loadEntities();
      st.bad = false;
      st.msg = `장소를 이었습니다 — 위치 칸으로 ${r.byCode.length}개, 모델로 ${r.byModel.length}개(호출 ${r.calls}번). 큰 장소 ${r.big}개. 기록에서 되돌릴 수 있습니다.`;
    }),
    // v0.7.0 6: list layout capsules
    'list-mode': (b) => { st.listMode = { ...(st.listMode || {}), [b.dataset.type]: b.dataset.key }; render(); },
    'list-filter': (b) => { st.listFilter = { ...(st.listFilter || {}), [b.dataset.key]: !(st.listFilter || {})[b.dataset.key] }; render(); },
    // v0.7.0 7: 관계 · 학사일정 in 「고치기」 (each at once, in 기록)
    'rel-add': (b) => run(async () => {
      const to = root.getElementById('relTo')?.value;
      if (!to) return;
      await api('POST', `/worlds/${st.worldId}/relations`, { from: b.dataset.id, to, type: root.getElementById('relType')?.value || '기타', note: '' });
      await loadEntities();
    }, '관계를 더했습니다.'),
    'rel-del': (b) => run(async () => {
      await api('DELETE', `/worlds/${st.worldId}/relations/${b.dataset.id}`);
      await loadEntities();
    }, '관계를 뺐습니다. 기록에서 되돌릴 수 있습니다.'),
    'rel-keep': (b) => run(async () => {
      await api('PATCH', `/worlds/${st.worldId}/relations/${b.dataset.id}`, { differs: null });
      await loadEntities();
    }, '지금 방향 그대로 둡니다.'),
    'rel-flip': (b) => run(async () => {
      const x = (st.relations || []).find((y) => y.relationId === b.dataset.id);
      if (!x) return;
      await api('PATCH', `/worlds/${st.worldId}/relations/${x.relationId}`, { from: x.to, to: x.from });
      await loadEntities();
    }, '방향을 바꿨습니다.'),
    'rel-type': (b) => run(async () => {
      const x = (st.relations || []).find((y) => y.relationId === b.dataset.id);
      const type = root.querySelector(`[data-rel-type="${b.dataset.id}"]`)?.value;
      if (!x || !type || type === x.type) return;
      // another kind: the old one taken off and the new one made (both in 기록)
      await api('POST', `/worlds/${st.worldId}/relations`, { from: x.from, to: x.to, type, note: x.note || '' });
      await api('DELETE', `/worlds/${st.worldId}/relations/${x.relationId}`);
      await loadEntities();
    }, '관계 종류를 바꿨습니다.'),
    'cal-add': (b) => run(async () => {
      const name = val('calName').trim();
      const date = val('calDate').trim();
      if (!name || !date) throw Error('날짜와 행사 이름을 적어 주세요.');
      await api('PUT', `/worlds/${st.worldId}/calendar/event`, { entityId: b.dataset.id, name, date, place: val('calPlace').trim() });
      await loadEntities();
    }, '일정을 더했습니다.'),
    'room-set': (b) => run(async () => {
      await api('PUT', `/worlds/${st.worldId}/entities/${b.dataset.id}/room`, { room: root.getElementById('roomPick')?.value || null });
      await loadEntities();
    }, '지내는 곳을 바꿨습니다.'),
    'base-set': (b) => run(async () => {
      await api('PUT', `/worlds/${st.worldId}/entities/${b.dataset.id}/base`, { base: root.getElementById('basePick')?.value || null });
      await loadEntities();
    }, '본거지를 바꿨습니다.'),
    // v0.5.0 P · Q
    tidy: () => run(async () => {
      st.tidy = await api('POST', `/worlds/${st.worldId}/tidy`, {});
      st.bad = false;
      st.msg = `후보 ${st.tidy.items.length + st.tidy.fields.length}개를 골랐습니다(호출 ${st.tidy.calls}번). 아래에서 하나씩 고르세요. 지운 것은 없습니다.`;
    }),
    'tidy-trash': (b) => run(async () => {
      const e = st.entities.find((x) => x.entityId === b.dataset.id);
      if (e) await api('DELETE', `/worlds/${st.worldId}/entities/${e.entityId}`, { revision: e.revision });
      await loadEntities();
      st.tidy = await api('GET', `/worlds/${st.worldId}/tidy`);
    }, '휴지통으로 보냈습니다. 기록에서 되돌릴 수 있습니다.'),
    'tidy-clear': (b) => run(async () => {
      const e = st.entities.find((x) => x.entityId === b.dataset.id);
      if (e) await api('PATCH', `/worlds/${st.worldId}/entities/${e.entityId}`, b.dataset.key === 'description' ? { description: '', revision: e.revision } : { fields: { ...e.fields, [b.dataset.key]: '' }, revision: e.revision });
      await loadEntities();
      st.tidy = await api('GET', `/worlds/${st.worldId}/tidy`);
    }, '칸을 비웠습니다. 기록에서 되돌릴 수 있습니다.'),
    'tidy-keep': (b) => run(async () => {
      st.tidy = await api('POST', `/worlds/${st.worldId}/tidy/keep`, { entityId: b.dataset.id, key: b.dataset.key || null });
    }),
    'topic-filter': (b) => { st.topicFilter = b.dataset.topic || ''; render(); },
    'hide-once': () => { st.hideOnce = !st.hideOnce; render(); },
    'rule-kind': () => { st.ruleKind = !st.ruleKind; render(); },
    'topic-redo': () => run(async () => {
      const r = await api('POST', `/worlds/${st.worldId}/topic-fill`, { redo: true });
      await loadEntities();
      st.bad = false;
      st.msg = `규칙·시스템 ${r.asked}개의 주제를 다시 물어 ${r.filled.length}개를 바꿨습니다(호출 ${r.calls}번). 기록에서 되돌릴 수 있습니다.`;
    }),
    'topic-fill': () => run(async () => {
      const r = await api('POST', `/worlds/${st.worldId}/topic-fill`, {});
      await loadEntities();
      st.bad = false;
      st.msg = `주제가 빈 규칙·시스템 ${r.asked}개 가운데 ${r.filled.length}개를 채웠습니다(호출 ${r.calls}번). 기록에서 되돌릴 수 있습니다.`;
    }),
    'hair-fill': () => run(async () => {
      const r = await api('POST', `/worlds/${st.worldId}/hair-fill`, {});
      await loadEntities();
      st.bad = false;
      st.msg = `머리색 · 눈색이 빈 인물 ${r.asked}명 가운데 ${r.filled.length}명을 외형 글에서 채웠습니다(호출 ${r.calls}번). 기록에서 되돌릴 수 있습니다.`;
    }),
    'species-fill': () => run(async () => {
      const r = await api('POST', `/worlds/${st.worldId}/species-fill`);
      await loadEntities();
      st.bad = false;
      st.msg = r.filled.length ? `종을 채웠습니다(${r.filled.length}명): ${r.filled.map((x) => `${x.name} — ${x.species}`).join(', ')}. 기록에서 되돌릴 수 있습니다.` : `종이 빈 인물 ${r.asked}명 가운데 사람이 아닌 존재를 찾지 못했습니다.`;    }),
    backup: () => run(async () => {
      const w = world();
      const file = await api('GET', `/worlds/${w.worldId}/export`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `세계관-${w.name.replace(/[\/:*?"<>|]+/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, '백업 파일을 내려받았습니다.'),
    'delete-world': () => run(async () => {
      const w = world();
      await api('DELETE', `/worlds/${w.worldId}`, { revision: w.revision });
      st.worldId = null;
      go('overview');
      await loadWorlds();
      await loadEntities();
      await loadRoom();
    }, '지웠습니다.'),
  };

  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b || b.disabled) return;
    if (b === el.launch) return toggle();
    const act = b.dataset.act;
    if (act && actions[act]) actions[act](b);
  });
  root.addEventListener('change', (ev) => {
    if (ev.target.id === 'worldSelect') {
      st.worldId = ev.target.value;
      store.set('world-archive-world', st.worldId);
      const keep = KIND[st.view] || st.view === 'log' || st.view === 'tabs' ? st.view : 'overview';
      st.tab = null; st.year = null;
      go(keep);
      run(async () => { await loadEntities(); if (keep === 'log') await loadHistory(); });
      st.scores = null;
    } else if (ev.target.id === 'fd-type' && st.editing) {
      // Switching kind in the form keeps everything typed; fields the new kind has keep their text.
      const now = readForm();
      // Fields the new kind lacks stay in the draft, so switching back brings them back. Saving sends only the
      // fields on screen.
      st.draft = { ...now, fields: { ...(st.draft?.fields || {}), ...now.fields } };
      st.view = now.type;
      render();
    }
  });
  root.addEventListener('change', (ev) => {
    if (ev.target.id !== 'restore-file' || !ev.target.files?.[0]) return;
    const f = ev.target.files[0];
    ev.target.value = '';
    run(async () => {
      let file;
      try { file = JSON.parse(await f.text()); } catch { throw Error('백업 파일을 읽지 못했습니다.'); }
      const r = await api('POST', '/worlds/import', file);
      await loadWorlds();
      st.worldId = r.world.worldId;
      go('overview');
      await loadEntities();
      await loadRoom();
    }, '새 세계관으로 복원했습니다.');
  });
  root.addEventListener('input', (ev) => {
    if (ev.target.id === 'q') { st.query = ev.target.value; runSearch(); }
    if (ev.target.id === 'tabq') { st.tabQuery = ev.target.value; filterTab(); }
  });
  el.backdrop.addEventListener('click', () => toggle(false));
  root.addEventListener('keydown', (ev) => { if (!target && ev.key === 'Escape' && !el.panel.hidden) toggle(false); });

  let watch = null;
  let lastChat = '';
  function toggle(open = el.panel.hidden) {
    el.panel.hidden = !open;
    el.backdrop.hidden = !open;
    el.launch.hidden = open || tabShown();
    el.launch.setAttribute('aria-expanded', String(open));
    clearInterval(watch);
    clearTimeout(pollTimer);
    if (!open) return;
    lastChat = activeChatId();
    render();
    run(() => loadAll(true));
    // Marinara keeps the open chat in localStorage; follow it while the window is open.
    watch = setInterval(() => {
      const now = activeChatId();
      if (now !== lastChat && !st.busy) { lastChat = now; run(loadRoom); }
    }, 1000);
  }
  // On its own: while 기억 서재 shows its 「세계관」 tab, this floating button hides (the same screen twice is too many).
  function tabShown() { return !target && document.documentElement.dataset.memoryWorldTab === 'on'; }
  if (!target) setInterval(() => { if (el.panel.hidden) el.launch.hidden = tabShown(); }, 2000);
  if (target) toggle(true);
  else render();
  return { host, setTheme(t) { if (t === 'dark' || t === 'light') { st.theme = t; render(); } }, railHtml: () => (st.loaded ? worldRailHtml() : '') };
  }

  if (EMBEDDED) globalThis.__memoryWorldPanel = { version: VERSION, contract: PANEL_CONTRACT, start: (target, opts) => boot(target, opts) };
  else boot(null);
})();
