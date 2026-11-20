/* Copied from tlsiddl/marinara-world-archive main 7136b3e (extension/extension.js, v0.4.0 · 연동 v2 · 계약 수준 2). Do not edit here: change it there and copy again. */
/* 세계관 설정집 · Marinara World Archive — personal extension UI.
 * Talks only to /api/world-archive on the same server. Visual language follows its sister module 기억 서재
 * (paper grain, ticket notches, ink shadows); the motif here is a star chart instead of a record. */
(() => {
  'use strict';
  // 연동 v2: also built into 기억 서재's screen as its 「세계관」 tab — 기억 서재's build.py wraps this file with
  // __WORLD_ARCHIVE_EMBEDDED__ = true; then nothing starts here and the tab calls __memoryWorldPanel.start(box).
  const EMBEDDED = typeof __WORLD_ARCHIVE_EMBEDDED__ !== 'undefined' && __WORLD_ARCHIVE_EMBEDDED__ === true;
  if (!EMBEDDED && document.getElementById('marinara-world-archive-root')) return;
  const VERSION = '0.4.0';
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
input,select,textarea{width:100%;border-radius:3px;background:var(--wa-field);border:1px solid var(--wa-field-line);padding:9px 11px;line-height:1.55}
textarea{min-height:84px;resize:vertical}
label.f{display:block;font:11px/1.4 var(--wa-mono);letter-spacing:1.5px;color:var(--wa-muted);margin:14px 0 6px}
label.f em{font:12px var(--wa-sans);letter-spacing:0;font-style:normal;opacity:.85;margin-left:6px}

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
    theme: opts.theme || store.get('world-archive-theme') || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    readOnly: false, // the server's contract level is not the one this screen was made for
    fields: {},
    worlds: [],
    worldId: store.get('world-archive-world') || null,
    entities: [],
    room: null,
    roomName: '',
    preview: null,
    view: 'overview', // overview | <type> | world | new-world
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
    try { st.pairs = st.worldId ? (await api('GET', `/worlds/${st.worldId}/duplicates`)).pairs || [] : []; } catch { st.pairs = []; }
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
    st.serverVersion = status.version || null; // 할 일 8: the screen and the server module should be the same version
    st.readOnly = Number(status.contract || 1) !== PANEL_CONTRACT; // 연동 v2: another contract level — look, do not change
    await loadRoom();
    if (followRoom && st.room?.worldId) st.worldId = st.room.worldId;
    await loadWorlds();
    await loadEntities();
    st.loaded = true;
  }

  // ------------------------------------------------------------------ pieces
  const defs = (type) => st.fields[type] || [];
  const count = (type) => st.entities.filter((e) => e.type === type).length;
  const fmtDate = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; };
  const shortId = (id) => String(id || '').slice(0, 4).toUpperCase();
  const roomTitle = () => esc(st.roomName || (activeChatId() ? '지금 채팅방' : '열린 채팅방 없음'));

  function sideHtml() {
    const items = [['overview', '한눈에', 'overview', null], ...KINDS.map((k) => [k.type, k.label, k.icon, count(k.type)]), ...(world()?.scoreboard?.name ? [['scores', '점수판', 'score', null]] : []), ['log', '기록', 'log', null]];
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

  function topHtml() {
    const opts = st.worlds.map((w) => `<option value="${esc(w.worldId)}" ${w.worldId === st.worldId ? 'selected' : ''}>${esc(w.name)}${w.worldId === st.room?.worldId ? '  · 이 방' : ''}</option>`).join('');
    return `${st.worlds.length ? `<select id="worldSelect" aria-label="세계관 고르기">${opts}</select>` : '<span class="sub">아직 세계관이 없습니다</span>'}
      <span class="grow"></span>
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

  function autoHtml(compact) {
    const s = roomState();
    if (s.kind !== 'this') return '';
    const w = world();
    const a = st.auto;
    const job = a?.job;
    if (!w.auto?.enabled) return `<div class="auto-line"><span class="dot"></span><span class="sub">자동 반영이 꺼져 있습니다.</span>${compact ? '' : ' <button class="quiet" type="button" data-act="go" data-view="world">켜기</button>'}</div>`;
    if (!w.auto.connectionId) return `<div class="auto-line"><span class="dot"></span><span class="sub">자동 반영에 쓸 연결을 골라 주세요.</span> <button class="quiet" type="button" data-act="go" data-view="world">고르기</button></div>`;
    const running = job?.state === 'running';
    const status = running
      ? `${esc(job.stage || '읽는 중')}`
      : `메시지 ${w.auto.every}개마다 읽습니다${a?.pending != null ? ` · 아직 안 읽은 메시지 ${a.pending}개` : ''}`;
    const last = job && !running && job.state === 'done' ? `<div class="sub">지난번: 새 설정 ${job.added}개 · 바뀐 칸 ${job.changed}개${job.dropped ? ` · 근거가 없어 뺀 것 ${job.dropped}개` : ''}${job.fieldsDropped ? ` · 근거와 안 맞아 뺀 칸 ${job.fieldsDropped}개` : ''}</div>` : '';
    const err = job?.state === 'error' ? `<div class="err">${esc(job.error)}</div>` : '';
    const again = st.ask === 'restart'
      ? `<span class="ask">이 방을 처음부터 다시 읽을까요? 설정은 지우지 않고, 읽은 위치만 처음으로 돌아갑니다. <button type="button" data-act="read-restart">다시 읽기</button><button class="quiet" type="button" data-act="ask" data-key="">취소</button></span>`
      : `<button class="quiet" type="button" data-act="ask" data-key="restart">처음부터 다시 읽기</button>`;
    return `<div class="auto-line"><span class="dot ${running ? 'run' : 'on'}"></span><span class="sub">자동 반영 · ${status}</span></div>${last}${err}
      ${running ? '' : `<div class="row" style="margin-top:8px"><button type="button" data-act="read-now" ${a?.pending === 0 ? 'disabled' : ''}>지금 읽기</button>${compact ? '' : again}</div>`}`;
  }

  function railHtml() {
    const p = st.preview;
    const s = roomState();
    return `
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
        <p class="sub" style="margin:8px 0 0">설정 ${p.included.length}개${p.omitted.length ? ` · 글자 수 한도 때문에 ${p.omitted.length}개 빠짐` : ''}${p.skipped > 0 ? ` · 장면 밖이라 뺀 것 ${p.skipped}개` : ''}. 프리셋의 {{세계}} 자리에 이대로 들어갑니다.</p>
        <pre>${esc(p.text) || '(비어 있음)'}</pre>
      </div>
      <div class="paper">
        <h2 style="margin:0">삽화용 외형 · {{세계외형}}</h2>
        <p class="sub" style="margin:8px 0 0">삽화 에이전트 프롬프트에 <b>{{세계외형}}</b>(또는 {{world_looks}})을 넣으면, 장면에 나온 인물 가운데 외형 칸이 있는 사람만 들어갑니다. 최근 메시지에 나온 사람이 먼저입니다.${p.looks?.omitted?.length ? ` 길이 때문에 ${p.looks.omitted.length}명 빠짐.` : ''}</p>
        <pre>${esc(p.looks?.text || '') || (p.looks?.sceneKnown ? '(장면에 외형이 적힌 인물이 없음)' : '(다음 답변부터 장면을 압니다)')}</pre>
      </div>` : ''}
      <div class="paper mobile-only"><p class="sub" style="margin:0">프리셋에 <b>{{세계}}</b>를 넣은 자리에 연결한 세계관 설정이 들어갑니다.</p></div>`;
  }

  function cardHtml(e) {
    const d = defs(e.type);
    const chips = d.filter((f) => f.kind === 'line' && e.fields?.[f.key]).map((f) => `<span class="chip" title="${esc(f.label)}">${esc(e.fields[f.key])}</span>`).join('');
    const firstText = d.find((f) => f.kind === 'text' && f.key !== 'state' && e.fields?.[f.key]);
    const snip = firstText ? e.fields[firstText.key] : e.description;
    return `<button class="card" type="button" data-act="open" data-id="${esc(e.entityId)}" data-search="${esc([e.name, ...e.aliases].join(' ').toLowerCase())}">
      ${e.pinned ? '<span class="pill pin">고정</span>' : e.provenance?.source === 'auto' ? '<span class="pill pin">자동</span>' : ''}
      <div class="nm">${esc(e.name)}</div>
      ${e.aliases.length ? `<div class="al">${esc(e.aliases.join(' · '))}</div>` : ''}
      ${chips ? `<div class="chips">${chips}</div>` : ''}
      ${snip ? `<p class="snip">${esc(snip)}</p>` : ''}
      <div class="foot"><span>${KIND[e.type].en} · ${shortId(e.entityId)}</span><span>${fmtDate(e.updatedAt)}</span></div>
    </button>`;
  }

  function listHtml(type) {
    const k = KIND[type];
    const list = st.entities.filter((e) => e.type === type).sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name, 'ko'));
    return `
      <div class="eyebrow">${k.en} · ${list.length}</div>
      <h1>${k.label}</h1>
      <p class="intro">${k.hint}</p>
      <div class="toolbar">
        ${list.length ? `<label class="search">${icon('search')}<input id="q" type="search" placeholder="이름 · 다른 이름 · 내용으로 찾기" value="${esc(st.query)}" aria-label="찾기"></label>` : ''}
        <span style="flex:1"></span>
        <button class="primary" type="button" data-act="new" data-type="${type}">새 ${k.label}</button>
      </div>
      ${type === 'person' && st.pairs.length ? `<p style="margin:-6px 0 14px"><button class="quiet" type="button" data-act="dupes">같은 사람일 수 있음 ${st.pairs.length}쌍</button></p>` : ''}
      ${list.length ? `<div class="cards">${list.map(cardHtml).join('')}</div><p class="sub" id="noHit" hidden>찾는 이름이 없습니다.</p>`
        : `<div class="empty"><h2>아직 ${k.label} 설정이 없습니다</h2><p>「새 ${k.label}」으로 첫 항목을 만들어 주세요.</p></div>`}`;
  }

  /** 「…예요」 after a word without a final consonant, 「…이에요」 after one. */
  function copula(word) {
    const c = String(word).trim().slice(-1).charCodeAt(0);
    return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? '이에요' : '예요';
  }

  function detailHtml(e) {
    const k = KIND[e.type];
    const d = defs(e.type);
    const f = e.fields || {};
    const src = e.sources || {};
    const tag = (k) => (src[k] === 'auto' ? '<span class="auto-tag">· 자동</span>' : '');
    // 할 일 10: the earlier value small under the field; a newer value from the story for a field the person wrote.
    const was = (k) => (e.past?.[k]?.[0] ? `<small class="past">이전: ${esc(e.past[k][0].value)} <button class="quiet" type="button" data-act="past-prompt" data-id="${esc(e.entityId)}" data-key="${esc(k)}" title="켜면 {{세계}}에 「(과거: …)」가 붙습니다">${e.pastInPrompt?.[k] ? '프롬프트에 넣는 중 · 끄기' : '프롬프트에도 넣기'}</button></small>` : '');
    const wait = (k) => (e.pending?.[k] ? `<small class="pending">대화에서는 「${esc(e.pending[k].value)}」${copula(e.pending[k].value)} <button class="quiet" type="button" data-act="pending" data-id="${esc(e.entityId)}" data-key="${esc(k)}">적용</button><button class="quiet" type="button" data-act="pending-drop" data-id="${esc(e.entityId)}" data-key="${esc(k)}">무시</button></small>` : '');
    const facts = d.filter((x) => x.kind === 'line' && f[x.key]).map((x) => `<div class="fact"><small>${esc(x.label)}${tag(x.key)}</small><b>${esc(f[x.key])}</b>${was(x.key)}${wait(x.key)}</div>`).join('');
    const secs = d.filter((x) => x.kind === 'text' && x.key !== 'state' && f[x.key]).map((x) => `<div class="sec"><small>${esc(x.label)}${tag(x.key)}</small><p>${esc(f[x.key])}</p>${was(x.key)}${wait(x.key)}</div>`).join('');
    const extra = (e.extra || []).filter((x) => x.value).map((x) => `<div class="sec"><small>${esc(x.label)}</small><p>${esc(x.value)}</p></div>`).join('');
    const memo = e.description ? `<div class="sec"><small>${d.length ? '메모' : '내용'}${tag('description')}</small><p>${esc(e.description)}</p></div>` : '';
    // 관계: both directions; a chip opens the other setting.
    const rels = (st.relations || []).filter((r) => r.from === e.entityId || r.to === e.entityId).map((r) => {
      const other = st.entities.find((x) => x.entityId === (r.from === e.entityId ? r.to : r.from));
      if (!other) return '';
      return `<button class="quiet" type="button" data-act="open" data-id="${esc(other.entityId)}">${esc(r.type)} · ${esc(other.name)}${r.note ? ` (${esc(r.note)})` : ''}${r.source === 'auto' ? '<span class="auto-tag">· 자동</span>' : ''}</button>`;
    }).join('');
    const relSec = rels ? `<div class="sec"><small>관계</small><p>${rels}</p></div>` : '';
    const empty = !facts && !secs && !extra && !memo && !f.state && !rels;
    const askKey = `entity:${e.entityId}`;
    return `
      <button class="back" type="button" data-act="go" data-view="${e.type}">${icon('back')}${k.label} 목록</button>
      <div class="paper">
        <div class="sheet-head">
          <div>
            <div class="eyebrow">${k.en} · ${shortId(e.entityId)}</div>
            <h1 style="margin-bottom:6px">${esc(e.name)}</h1>
            ${e.aliases.length ? `<p class="al">다른 이름 · ${esc(e.aliases.join(', '))}</p>` : ''}
            ${e.glossaryName && e.glossaryName !== e.name ? `<p class="sub" style="margin:6px 0 0">번역 단어장에는 「${esc(e.glossaryName)}」${copula(e.glossaryName)} <button class="quiet" type="button" data-act="glossary-name" data-id="${esc(e.entityId)}">적용</button></p>` : ''}
          </div>
          ${e.pinned ? '<span class="pill">늘 먼저 넣기</span>' : ''}
        </div>
        ${facts ? `<div class="facts">${facts}</div>` : ''}
        ${secs}${extra}${memo}${relSec}
        ${f.state ? `<div class="state"><small>지금 상태 · 사건으로 바뀐 것${tag('state')}</small><p>${esc(f.state)}</p>${was('state')}${wait('state')}</div>` : ''}
        ${empty ? '<p class="sub" style="margin-top:16px">아직 적힌 칸이 없습니다. 「고치기」에서 채워 주세요.</p>' : ''}
        <div class="meta">만든 날 ${fmtDate(e.createdAt)} · 고친 날 ${fmtDate(e.updatedAt)} · ${e.provenance?.source === 'auto' ? '대화에서 자동으로 추가' : '직접 입력'}${e.provenance?.evidence ? `<br>근거 “${esc(e.provenance.evidence)}”` : ''}</div>
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

  function dupesHtml() {
    const byId = (id) => st.entities.find((e) => e.entityId === id);
    const pairs = st.pairs.map((p) => ({ ...p, ea: byId(p.a), eb: byId(p.b) })).filter((p) => p.ea && p.eb);
    return `
      <button class="back" type="button" data-act="go" data-view="person">${icon('back')}인물 목록</button>
      <div class="eyebrow">PEOPLE · SAME PERSON? · ${pairs.length}</div>
      <h1>같은 사람일 수 있음</h1>
      <p class="intro">이름이나 다른 이름이 겹치는 인물입니다. 같은 사람이면 「합치기」로 하나로 모을 수 있습니다. 자동으로 합치지는 않습니다. 합친 뒤에도 「기록」에서 되돌릴 수 있습니다.</p>
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
                 <button type="button" data-act="dismiss" data-a="${esc(a)}" data-b="${esc(b)}">다른 사람이에요</button>`}
          </div>
        </div>`;
      }).join('') : '<div class="empty"><h2>같은 사람일 수 있는 인물이 없습니다</h2><p>이름이나 다른 이름이 겹치는 인물이 생기면 여기에 보입니다.</p></div>'}`;
  }

  function fieldInput(x, value, hideLabel) {
    const hint = x.hint ? `<em>${esc(x.hint)}</em>` : '';
    const label = `<label class="f" for="fd-${x.key}" ${hideLabel ? 'hidden' : ''}>${esc(x.label)}${hint}</label>`;
    return x.kind === 'line'
      ? `<div>${label}<input id="fd-${x.key}" data-field="${x.key}" maxlength="200" value="${esc(value)}"></div>`
      : `<div>${label}<textarea id="fd-${x.key}" data-field="${x.key}" maxlength="2000">${esc(value)}</textarea></div>`;
  }

  function extraRow(x = { label: '', value: '' }) {
    return `<div class="extra-row" data-extra><input data-x="label" maxlength="40" placeholder="칸 이름 (예: 좋아하는 것)" value="${esc(x.label)}"><textarea data-x="value" maxlength="2000" rows="1" style="min-height:42px">${esc(x.value)}</textarea><button class="quiet" type="button" data-act="drop-extra">빼기</button></div>`;
  }

  /** e: the saved setting, or null for a new one. st.draft (if any) wins over e for what is shown. */
  function formHtml(e, type) {
    const isNew = st.editing === 'new';
    const v = st.draft || e || {};
    const k = KIND[type];
    const d = defs(type);
    const f = v.fields || {};
    const lines = d.filter((x) => x.kind === 'line');
    const texts = d.filter((x) => x.kind === 'text' && x.key !== 'state');
    const state = d.find((x) => x.key === 'state');
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
        ${lines.length ? `<div class="grid3">${lines.map((x) => fieldInput(x, f[x.key] || '')).join('')}</div>` : ''}
        ${texts.map((x) => fieldInput(x, f[x.key] || '')).join('')}
        ${state ? `<div class="state"><small>지금 상태 · 사건으로 바뀐 것</small><p class="sub" style="margin:0 0 8px">${esc(state.hint || '')}</p>${fieldInput(state, f.state || '', true)}</div>` : ''}
        <label class="f">추가 칸<em>이 항목에만 필요한 칸</em></label>
        <div id="extras">${(v.extra || []).map(extraRow).join('')}</div>
        <button type="button" data-act="add-extra" style="margin-top:8px">칸 추가</button>
        <label class="f" for="fd-desc">${d.length ? '메모' : '내용'}</label>
        <textarea id="fd-desc" maxlength="4000">${esc(v.description || '')}</textarea>
        <label class="check"><input type="checkbox" id="fd-pinned" ${v.pinned ? 'checked' : ''}> 늘 먼저 넣기 (글자 수가 모자랄 때 이 설정부터 넣습니다)</label>
        <div class="actions"><button class="primary" type="button" data-act="save">저장</button><button class="quiet" type="button" data-act="cancel">취소</button></div>
      </form>`;
  }

  function newWorldHtml(first) {
    return `
      <div class="eyebrow">WORLD ARCHIVE · NEW</div>
      <h1>${first ? '첫 세계관 만들기' : '새 세계관'}</h1>
      <p class="intro">세계관 하나에 인물·장소·규칙 같은 설정을 모아 두고, 채팅방마다 어떤 세계관을 읽을지 고릅니다. 여러 방이 같은 세계관을 함께 써도 됩니다.</p>
      <form class="paper" onsubmit="return false">
        <label class="f" for="nw-name">세계관 이름</label><input id="nw-name" maxlength="120" placeholder="예: 별빛 학원">
        <label class="f" for="nw-desc">시대·배경<em>설정 맨 앞에 들어갑니다</em></label><textarea id="nw-desc" maxlength="4000" placeholder="예: 1988년, 산 위의 기숙학교."></textarea>
        <div class="actions"><button class="primary" type="button" data-act="create-world">만들기</button>${first ? '' : '<button class="quiet" type="button" data-act="go" data-view="overview">취소</button>'}</div>
      </form>`;
  }

  function worldHtml() {
    const w = world();
    return `
      <div class="eyebrow">WORLD · SETTINGS</div>
      <h1>세계관 정보</h1>
      <form class="paper" onsubmit="return false">
        <label class="f" for="w-name">이름</label><input id="w-name" maxlength="120" value="${esc(w.name)}">
        <label class="f" for="w-desc">시대·배경<em>설정 맨 앞에 들어갑니다</em></label><textarea id="w-desc" maxlength="4000" style="min-height:120px">${esc(w.description)}</textarea>
        <label class="f" for="w-budget">프롬프트에 넣을 최대 글자 수<em>300~20000. 넘치면 고정하지 않은 설정부터 빠집니다</em></label><input id="w-budget" type="number" min="300" max="20000" step="100" value="${w.injectChars}" style="max-width:200px">
        <label class="f" for="w-mode">넣는 방식<em>장면 방식은 최근 메시지 12개에 이름이 나온 설정만 넣습니다</em></label><select id="w-mode" style="max-width:360px"><option value="all" ${w.injectMode === 'scene' ? '' : 'selected'}>전부 넣기</option><option value="scene" ${w.injectMode === 'scene' ? 'selected' : ''}>장면에 나온 것만(고정·규칙·시스템은 늘)</option></select>
        <div class="grid2">
          <div><label class="f" for="w-board">점수판 이름<em>비우면 점수를 찾지 않습니다 (예: 기숙사 점수)</em></label><input id="w-board" maxlength="40" value="${esc(w.scoreboard?.name || '')}"></div>
          <div><label class="f" for="w-unit">단위<em>예: 점</em></label><input id="w-unit" maxlength="10" value="${esc(w.scoreboard?.unit || '')}" style="max-width:140px"></div>
        </div>
        <div class="actions"><button class="primary" type="button" data-act="save-world">저장</button></div>
      </form>
      <form class="paper" onsubmit="return false">
        <h2>자동 반영</h2>
        <p class="sub" style="margin:0 0 4px">이 세계관을 읽는 방에서 답변이 오면, 아직 안 읽은 대화를 읽고 새 인물·장소·규칙과 새로 밝혀진 사실을 바로 설정에 넣습니다. 원문에 근거가 있는 것만 넣고, 직접 쓴 칸은 덮어쓰지 않습니다. 바뀐 내용은 「기록」에서 하나씩 되돌릴 수 있습니다. 가장 최근 메시지 두 개는 리롤될 수 있어 다음 차례에 읽습니다.</p>
        <label class="toggle" style="margin-top:14px"><input type="checkbox" id="a-on" ${w.auto?.enabled ? 'checked' : ''}> 자동 반영 켜기</label>
        <div class="grid2">
          <div><label class="f" for="a-conn">읽을 때 쓸 연결<em>저렴하고 긴 글을 잘 읽는 모델</em></label>
            <select id="a-conn"><option value="">${st.connections == null ? '불러오는 중…' : '(골라 주세요)'}</option>${(st.connections || []).map((c) => `<option value="${esc(c.id)}" ${c.id === w.auto?.connectionId ? 'selected' : ''}>${esc(c.name)}${c.model ? ` · ${esc(c.model)}` : ''}</option>`).join('')}</select></div>
          <div><label class="f" for="a-every">몇 메시지마다 읽을까요<em>2~50</em></label><input id="a-every" type="number" min="2" max="50" value="${w.auto?.every ?? 6}" style="max-width:140px"></div>
        </div>
        <div class="actions"><button class="primary" type="button" data-act="save-auto">저장</button></div>
      </form>
      <div class="paper">
        <h2>인물 종 채우기 <small>추가 기능</small></h2>
        <p class="sub" style="margin:0 0 12px">「종」 칸이 생기기 전에 읽은 인물은 종이 비어 있습니다. 누를 때만, 종이 빈 인물의 이름 · 다른 이름 · 외형 · 메모를 모아 100명씩 작은 호출로 묻고, 사람이 아닌 존재(반려동물 · 마법 생물 같은)에만 종을 적습니다. 직접 고친 칸은 건드리지 않고, 기록에서 하나씩 되돌릴 수 있습니다. 자동 반영 연결을 씁니다.</p>
        <div class="row"><button type="button" data-act="species-fill">인물 종 채우기</button></div>
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
    field: (c) => `<b>${esc(c.name)}</b> · ${esc((st.fields[c.type] || []).find((f) => f.key === c.key)?.label || c.key)}: ${c.before ? `${esc(c.before)} → ` : ''}${esc(c.after)}`,
    alias: (c) => `<b>${esc(c.name)}</b> · 다른 이름 「${esc(c.after)}」`,
    memo: (c) => `<b>${esc(c.name)}</b> · 메모: ${esc(c.after)}`,
    merge: (c) => `<b>${esc(c.name)}</b> · 「${esc(c.dropName)}」와(과) 합침`,
    rename: (c) => `<b>${esc(c.before)}</b> → <b>${esc(c.after)}</b> · 번역 단어장의 이름으로`,
    'relation-add': (c) => `관계 <b>${esc(c.name)}</b> · ${esc(c.relation?.type || '')}${c.relation?.note ? ` (${esc(c.relation.note)})` : ''}`,
    'relation-note': (c) => `관계 <b>${esc(c.name)}</b> · ${c.before ? `${esc(c.before)} → ` : ''}${esc(c.after)}`,
    'relation-flip': (c) => `관계 <b>${esc(c.name)}</b> · ${esc(c.relation?.type || '')} 방향 바뀜`,
    'relation-remove': (c) => `관계 <b>${esc(c.name)}</b> · ${esc(c.relation?.type || '')} 끝남`,
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

  function mainHtml() {
    if (!st.loaded) return st.bad ? '' : '<p class="sub">불러오는 중…</p>';
    if (st.view === 'new-world' || !world()) return newWorldHtml(!st.worlds.length);
    if (st.view === 'world') return worldHtml();
    if (st.view === 'log') return historyHtml();
    if (st.view === 'scores') return scoresHtml();
    if (KIND[st.view]) {
      if (st.editing === 'new') return formHtml(null, st.view);
      const e = st.entities.find((x) => x.entityId === (st.editing || st.detail));
      if (e && st.editing) return formHtml(e, st.view);
      if (e) return detailHtml(e);
      if (st.view === 'person' && st.dupes) return dupesHtml();
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
    const screen = `${st.view}|${st.worldId}|${st.detail}|${st.editing}|${st.dupes}`;
    const keep = screen === lastScreen ? el.main.scrollTop : 0;
    const skew = st.readOnly
      ? `<p class="msg bad" role="status">${esc(UPDATE_MSG)}</p>`
      : !target && st.serverVersion && st.serverVersion !== VERSION
      ? `<p class="msg bad" role="status">서버 쪽 World Archive(v${esc(st.serverVersion)})와 이 화면(v${esc(VERSION)})의 판이 달라요. 서버 쪽을 업데이트해 주세요 — 서버에서 설치 명령을 다시 실행하면 됩니다.</p>`
      : '';
    el.main.innerHTML = skew + (st.msg && !(st.readOnly && st.msg === UPDATE_MSG) ? `<p class="msg ${st.bad ? 'bad' : ''}" role="status">${esc(st.msg)}</p>` : '') + mainHtml();
    el.main.scrollTop = keep;
    lastScreen = screen;
    if (st.query) filterCards();
    if (st.busy) root.querySelectorAll('main button, .rail button').forEach((b) => { b.disabled = true; });
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
    };
  }

  const go = (view) => { st.view = view; st.hits = null; st.dupes = false; st.detail = null; st.editing = null; st.draft = null; st.ask = null; st.query = ''; st.msg = ''; };

  const actions = {
    go: (b) => {
      go(b.dataset.view);
      if (b.dataset.view === 'log') return run(loadHistory);
      if (b.dataset.view === 'scores') return run(loadScores);
      if (b.dataset.view === 'world' && st.connections == null) { render(); return run(loadConnections); }
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
    theme: () => { st.theme = st.theme === 'dark' ? 'light' : 'dark'; store.set('world-archive-theme', st.theme); render(); },
    close: () => toggle(false),
    open: (b) => { st.detail = b.dataset.id; st.editing = null; st.ask = null; st.msg = ''; render(); },
    new: (b) => { st.view = b.dataset.type; st.editing = 'new'; st.detail = null; st.draft = null; st.msg = ''; render(); },
    edit: (b) => { st.editing = b.dataset.id; st.detail = b.dataset.id; st.draft = null; st.msg = ''; render(); },
    cancel: () => { if (st.editing !== 'new') st.view = st.entities.find((x) => x.entityId === st.editing)?.type || st.view; st.editing = null; st.draft = null; st.msg = ''; render(); },
    ask: (b) => { st.ask = b.dataset.key || null; render(); },
    'add-extra': () => { root.getElementById('extras').insertAdjacentHTML('beforeend', extraRow()); root.querySelector('#extras [data-extra]:last-child input')?.focus(); },
    'drop-extra': (b) => b.closest('[data-extra]').remove(),
    save: () => run(async () => {
      const v = readForm();
      let e;
      if (st.editing === 'new') e = await api('POST', `/worlds/${st.worldId}/entities`, v);
      else {
        const old = st.entities.find((x) => x.entityId === st.editing);
        e = await api('PATCH', `/worlds/${st.worldId}/entities/${old.entityId}`, { ...v, revision: old.revision });
      }
      st.view = e.type; st.detail = e.entityId; st.editing = null; st.draft = null;
      await loadEntities();
      await loadRoom();
    }, '저장했습니다.'),
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
      const w = await api('POST', '/worlds', { name: val('nw-name'), description: val('nw-desc') });
      st.worldId = w.worldId;
      store.set('world-archive-world', w.worldId);
      go('overview');
      await loadWorlds();
      await loadEntities();
    }, '세계관을 만들었습니다.'),
    'save-world': () => run(async () => {
      const w = world();
      await api('PATCH', `/worlds/${w.worldId}`, { name: val('w-name'), description: val('w-desc'), injectChars: Number(val('w-budget')), injectMode: val('w-mode') === 'scene' ? 'scene' : 'all', scoreboard: { name: val('w-board'), unit: val('w-unit') }, revision: w.revision });
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
      const keep = KIND[st.view] || st.view === 'log' ? st.view : 'overview';
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
  return { host, setTheme(t) { if (t === 'dark' || t === 'light') { st.theme = t; render(); } } };
  }

  if (EMBEDDED) globalThis.__memoryWorldPanel = { version: VERSION, contract: PANEL_CONTRACT, start: (target, opts) => boot(target, opts) };
  else boot(null);
})();
