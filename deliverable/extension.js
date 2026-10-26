/* 기억 서재 · 마리나라 엔진용 기억 모듈 (비공식) */
(() => {
  'use strict';
  // 기억 서재 (기억 모듈판): a window onto the server-side memory module (/api/memory-module).
  // All memory lives on the server; this only shows it and sends the user's changes back.
  const VERSION = "0.7.1";
  const UI_CSS = /*__UI_CSS__*/ ":host{all:initial;color:#34374b;font:14px/1.65 \"Pretendard\",\"Noto Sans KR\",-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;--im-accent:#7777c8;--im-ink:#34374b;--im-muted:#8e91a6;--im-line:#e9e9f2;--im-paper:#fff;--im-canvas:#f5f5fb;--im-soft:#eeeefa}\n*{box-sizing:border-box}button,input,select,textarea{font:inherit}button{cursor:pointer;color:inherit;border:1px solid var(--im-line);background:var(--im-paper);padding:9px 14px;border-radius:11px;transition:background .15s,transform .15s,box-shadow .15s}button:hover{background:var(--im-soft)}button:disabled{opacity:.45;cursor:default}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #aaa7e5;outline-offset:3px}.icon{width:19px;height:19px;flex:none;display:inline-block;vertical-align:middle}#launch{position:fixed;right:20px;bottom:126px;z-index:2147483600;display:flex;align-items:center;gap:8px;color:#fff;background:#7777c8;border:0;border-radius:24px;padding:11px 19px;box-shadow:0 7px 20px #7777c84d}#backdrop{position:fixed;inset:0;background:#20233654;z-index:2147483601}#panel{position:fixed;z-index:2147483602;left:50%;top:50%;transform:translate(-50%,-50%);width:min(1320px,96vw);height:min(900px,91vh);display:grid;grid-template-columns:192px minmax(0,1fr) 224px;background:var(--im-paper);border-radius:26px;box-shadow:0 25px 100px #25254435;overflow:hidden}#panel[hidden],[hidden]{display:none!important}\n.sidebar{display:flex;flex-direction:column;padding:30px 18px 20px;border-right:1px solid var(--im-line);min-width:0}.brand{display:flex;align-items:center;gap:10px;padding:0 12px 30px;color:var(--im-accent);font-size:18px;font-weight:750;letter-spacing:-.8px}.brand .icon{width:27px;height:27px}.brand small{display:block;white-space:nowrap;font:7px/1.8 ui-monospace,monospace;letter-spacing:1.3px;color:#a8a6bd}.nav-label{font-size:9px;letter-spacing:1.8px;color:#b2b1c2;padding:13px 14px 9px}nav{display:flex;flex-direction:column;gap:6px}nav button{display:flex;gap:11px;align-items:center;border:0;background:transparent;text-align:left;font-size:12px;padding:11px 13px;border-radius:10px;color:#9291aa}nav button.selected{background:#eeeeFA;color:#6d69b4;font-weight:700}nav button .icon{width:17px;height:17px}.side-bottom{margin-top:auto;padding-top:26px;display:grid;gap:10px}.side-bottom button{font-size:11px;border:0;display:flex;align-items:center;gap:8px;background:#f7f7fb}.side-bottom small{font-size:9px;color:#b0aec0;padding-left:10px}\n.workspace{min-width:0;min-height:0;display:flex;flex-direction:column;background:var(--im-canvas)}.topbar{min-height:84px;display:flex;gap:14px;align-items:center;padding:20px 30px}.crumb{font-size:11px;color:#a2a0b6;flex:1}.crumb b{color:#636178;font-weight:500}.global-search{display:flex;align-items:center;gap:7px;border:1px solid #e8e7f2;background:#fff9;padding:6px 7px 6px 12px;border-radius:30px;width:min(225px,44%)}.global-search input{border:0!important;background:transparent!important;outline:0;width:100%;min-width:0;font-size:10px!important;padding:0!important}.global-search button{padding:5px;border-radius:50%;border:0;background:#7a77c9;color:#fff;line-height:0}.global-search .icon{width:14px;height:14px}.close{border:0;background:transparent;padding:7px;line-height:0;color:#a5a1b5}.close:hover{background:#eae9f4}#status{font-size:10px;color:#a09cb4;padding:0 30px 5px;min-height:20px}#error{margin:0 28px 12px;padding:12px 14px;border-radius:12px;background:#fff0e7;color:#995c42;font-size:12px;white-space:pre-wrap}#content{padding:8px 30px 32px;overflow:auto;overscroll-behavior:contain;flex:1;min-height:0;scrollbar-width:thin;scrollbar-color:#dad7e9 transparent}.eyebrow{font:9px ui-monospace,monospace;letter-spacing:2.2px;color:#a9a5bc;text-transform:uppercase;margin:4px 0 8px}h1{font-size:25px;line-height:1.4;letter-spacing:-1.1px;margin:0 0 10px;font-weight:740}h2,h3{font-size:14px;letter-spacing:-.35px;margin:20px 0 12px;font-weight:700}h4{margin:0;font-size:13px}p{margin:8px 0 14px;overflow-wrap:anywhere}.intro{font-size:11px;color:#9995ac;line-height:1.85;margin-bottom:25px}.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 15px}.section-head h2,.section-head h3{margin:0}.section-head>small{font-size:10px;color:var(--im-muted)}small{color:var(--im-muted);font-size:10px;overflow-wrap:anywhere}.buttons{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.primary{background:var(--im-accent)!important;border-color:var(--im-accent)!important;color:#fff!important;box-shadow:0 4px 10px #7777c824}.ghost{border:0;background:transparent;padding:6px 9px;font-size:10px;color:#9390aa}.pill{display:inline-flex;gap:4px;align-items:center;background:var(--im-soft);color:#7e76b4;border-radius:30px;padding:3px 9px;font-size:9px;white-space:nowrap}.pill.green{background:#eaf4ef;color:#68957a}.pill.neutral{background:#efeff4;color:#9693a6}\n.folder-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:17px;margin:36px 0 26px}.folder-card{position:relative;border:0;text-align:left;min-height:155px;padding:23px 18px 17px;border-radius:0 16px 16px 16px;box-shadow:0 8px 25px #30305b08;background:#fff;display:flex;flex-direction:column;align-items:flex-start;isolation:isolate}.folder-card:before{content:\"\";position:absolute;top:-12px;left:0;width:52%;height:26px;background:inherit;border-radius:11px 12px 0 0;z-index:-1}.folder-card.purple{background:#7a78c7;color:#fff}.folder-card.cream{background:#eee8db}.folder-card:hover{transform:translateY(-3px);background:#f0eff9}.folder-card.purple:hover{background:#706dc0}.folder-card.cream:hover{background:#e8e0ce}.folder-card .icon{width:23px;height:23px;opacity:.7;margin-bottom:16px}.folder-card small{font-size:8px;letter-spacing:1.3px;color:inherit;opacity:.55}.folder-card strong{font-size:13px;line-height:1.6;margin:5px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.folder-card span:last-child{margin-top:auto;font-size:9px;opacity:.7}.welcome-strip{display:flex;align-items:center;justify-content:space-between;gap:18px;background:#fff;padding:15px 18px;border-radius:13px;margin:20px 0;font-size:11px;color:#8e88a6}.welcome-strip b{display:block;color:#625d7c;font-size:12px;margin-bottom:4px}\n.file-shelf{display:flex;gap:0;overflow-x:auto;overflow-y:hidden;padding:12px 6px 18px 0;min-height:225px;scrollbar-width:thin}.file-index{flex:1 0 115px;position:relative;min-width:115px;max-width:210px;min-height:215px;margin-left:-13px;padding:28px 15px 20px 29px;text-align:left;border:0;border-radius:0 11px 7px 0;box-shadow:-4px 0 10px #2c2a321c;background:linear-gradient(96deg,#ffffff18,transparent 30%),repeating-linear-gradient(0deg,#ffffff08 0,#ffffff08 1px,#00000003 1px,#00000003 3px),#e5e0d0;isolation:isolate;color:#4e5044;transition:transform .18s;overflow:visible}.file-index:first-child{margin-left:0}.file-index:before{content:\"\";position:absolute;top:-10px;left:0;width:82%;height:24px;z-index:-1;background:inherit;border-radius:6px 11px 0 0}.file-index:nth-child(4n+2){background-color:#bfc4ca;color:#3f4653}.file-index:nth-child(4n+3){background-color:#c6b49b;color:#55432e}.file-index:nth-child(4n+4){background-color:#aeb8aa;color:#344b40}.file-index.is-current{background-color:#8481b5;color:#fff}.file-index:hover,.file-index.is-selected{transform:translateY(-7px);z-index:4}.file-index.is-selected{box-shadow:-4px 0 12px #35305422,inset 0 0 0 1px #6f6a9a55}.file-code{font:8px ui-monospace,monospace;letter-spacing:1.1px;opacity:.68}.file-index h3{font-size:16px;line-height:1.55;font-weight:650;margin:20px 0 12px;word-break:keep-all;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.file-index .file-spine{position:absolute;left:8px;top:40px;writing-mode:vertical-rl;font:8px ui-monospace,monospace;letter-spacing:1.8px;opacity:.48}.file-index .file-foot{position:absolute;bottom:18px;left:29px;right:12px;font-size:9px;border-top:1px solid #0000001a;padding-top:10px;display:flex;justify-content:space-between}.file-index .barcode{height:14px;width:43px;margin-top:15px;opacity:.35;background:repeating-linear-gradient(90deg,currentColor 0,currentColor 1px,transparent 1px,transparent 3px,currentColor 3px,currentColor 5px,transparent 5px,transparent 7px)}\n.paper{background:var(--im-paper);border:1px solid #eeeef5;border-radius:15px;padding:20px;margin:16px 0}.paper h3:first-child{margin-top:0}.paper .hint{font-size:11px;color:#9993ac;line-height:1.8}.paper-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px}.paper-toolbar h2{margin:0}.editor-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}.editor-grid .paper{margin:0}.note{background:#eeeefa;border:1px solid #e4e2f2;border-radius:12px;padding:14px 16px;font-size:11px;color:#827a9c;line-height:1.85}.event-row{border-bottom:1px solid #efedf5;background:transparent}.event-row:last-child{border-bottom:0}.event-row>summary{list-style:none;cursor:pointer;padding:16px 0;display:flex;align-items:center;gap:12px}.event-row>summary::-webkit-details-marker{display:none}.event-no{font:10px ui-monospace,monospace;color:#a6a0bc;min-width:24px}.event-main{min-width:0;flex:1}.event-main b{font-size:12px;font-weight:600;display:block}.event-main small{font-size:9px;display:block;margin-top:3px}.event-body{padding:0 0 16px 36px;font-size:12px}.fact-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 24px}.fact-grid .wide{grid-column:1/-1}.fact-grid label{padding:0;color:#aba4bd;font-size:9px}.fact-grid p{color:#615b73;font-size:12px;margin:5px 0 0;white-space:pre-wrap}.quote-card{border-left:2px solid #c3bde2;margin:15px 0;padding:2px 14px}.quote-card blockquote{margin:6px 0;font-size:13px;color:#665a83;white-space:pre-wrap}.quote-card small{font-size:9px}.empty{padding:35px 20px;text-align:center;color:#aaa3b8;font-size:12px}.empty .icon{display:block;margin:0 auto 10px;width:30px;height:30px;opacity:.5}\nlabel{display:block;font-size:11px;color:#777187;margin:12px 0 6px}input:not([type=checkbox]),textarea,select{width:100%;background:#fafafe;color:#575167;border:1px solid #e5e1ef;border-radius:9px;padding:10px 11px;outline:none;font-size:12px}input[type=checkbox]{accent-color:var(--im-accent);vertical-align:middle;width:15px;height:15px;margin-right:7px}textarea{min-height:180px;resize:vertical;line-height:1.85}textarea.event-field{min-height:88px}#eventEditor textarea[data-q]{min-height:90px}#eventEditor article{background:#faf9fd;padding:17px;border:1px solid #ebe6f2;border-radius:12px;margin:15px 0}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 15px}.form-grid .full{grid-column:1/-1}.setting-switch{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f0eef5;margin:0}.setting-switch span{font-size:12px}.setting-switch small{display:block;margin-top:3px;font-size:10px}.setting-switch input{order:2;margin:0}.check-row{display:flex;gap:8px;border-top:1px solid #f0eef5;padding:13px 0;margin:0}.check-row span{min-width:0}.check-row b{font-size:12px;color:#6d657e}.check-row small{display:block;font-size:10px;margin-top:4px;line-height:1.75}.check-row input{flex:none;margin-top:3px}.range-preview{border:1px solid #e7e3f1;border-radius:10px;margin:15px 0;padding:13px}.range-preview p{font-size:11px;margin:6px 0}.range-preview .snippet{color:#aaa0b4;font-size:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.import-preview{max-height:350px;overflow:auto}.metric-row{display:flex;gap:12px}.metric{flex:1;padding:16px;background:#fff;border-radius:12px}.metric strong{display:block;font-size:22px;font-weight:500;color:#7870b5}.metric small{font-size:10px}pre{font:10px/1.8 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#f8f6fc;border-radius:10px;padding:15px;color:#82778d}details>summary{cursor:pointer;color:#8e83a0;font-size:11px;padding:10px 0}#records>article{padding:16px 0;border-bottom:1px solid #ece8f2}#records>article>b{font-size:12px}#records>article>p{font-size:12px;color:#82768d}#records>article>small{display:block}#records blockquote{border-left:2px solid #cbc0e2;margin:12px 0;padding:5px 13px;font-size:12px}\n.inspector{padding:30px 22px;border-left:1px solid var(--im-line);overflow:auto}.rail-title{font-size:12px;font-weight:650;margin:7px 0 20px}.rail-stat{display:flex;align-items:center;gap:12px;background:#f5f4fa;border-radius:14px;padding:15px 12px;margin:11px 0}.rail-stat b{width:46px;height:46px;display:grid;place-items:center;border:1px solid #c9c4e9;border-radius:50%;color:#8178ba;font-size:16px;font-weight:500;flex:none}.rail-stat small{font-size:10px;line-height:1.8;color:#9c92ac}.rail-divider{height:1px;background:#efebf4;margin:24px 0}.rail-note h3{font-size:12px;line-height:1.8;margin:0 0 8px}.rail-note p{font-size:10px;color:#a296af;line-height:1.9}.rail-note .icon{color:#9c91c8;width:28px;height:28px;margin-bottom:10px}.rail-folder{height:90px;background:linear-gradient(135deg,#eeeafa,#e7e3f4);border-radius:10px;position:relative;margin:24px 4px;color:#a59ac6;display:grid;place-items:center}.rail-folder:before{content:\"\";position:absolute;top:-10px;left:0;width:55%;height:20px;background:#eeeafa;border-radius:8px}.rail-folder .icon{width:42px;height:42px}.room-label{font-size:11px;color:#82778e;margin:12px 0;overflow-wrap:anywhere}.rail-footer{font-size:9px;color:#b9aec1;line-height:1.9;margin-top:28px}\n@media(max-width:1120px){#panel{grid-template-columns:174px minmax(0,1fr)}.inspector{display:none}.sidebar{padding-left:12px;padding-right:12px}}@media(max-width:720px){#panel{inset:0;left:0;top:0;transform:none;width:100%;height:100dvh;border-radius:0;grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}.sidebar{padding:14px 14px 0;border:0;display:block;overflow:clip}.brand{padding:0 4px 10px;font-size:16px}.brand small,.nav-label,.side-bottom{display:none}.sidebar nav{flex-direction:row;overflow-x:auto;gap:3px;padding-bottom:10px;scrollbar-width:none}.sidebar nav button{flex:none;font-size:10px;padding:8px 9px;gap:6px}.sidebar nav .icon{width:14px;height:14px}.topbar{min-height:60px;padding:12px 18px;gap:9px}.crumb{font-size:10px}.global-search{width:42%;padding-left:9px}.global-search input{font-size:16px!important}#content{padding:6px 18px 25px}#status{padding:0 18px 6px}#error{margin:0 16px 10px}.editor-grid{grid-template-columns:1fr}.folder-grid{gap:10px;margin-top:28px}.folder-card{padding:17px 11px 12px;min-height:143px}.folder-card strong{font-size:11px}.folder-card .icon{width:20px;height:20px;margin-bottom:12px}.folder-card small{font-size:7px}.file-index{min-width:115px;max-width:170px;flex:0 0 134px}.welcome-strip{padding:13px;gap:9px;font-size:10px}.welcome-strip button{flex:none;font-size:10px}.form-grid{grid-template-columns:1fr}.form-grid .full{grid-column:auto}input:not([type=checkbox]),select,textarea{font-size:16px!important}.paper{padding:16px}.fact-grid{grid-template-columns:1fr}.fact-grid .wide{grid-column:auto}.event-body{padding-left:0}.event-row>summary{gap:8px}.paper-toolbar{align-items:flex-start}.paper-toolbar .buttons{justify-content:flex-end}.metric-row{gap:7px}.metric{padding:12px}.metric strong{font-size:19px}h1{font-size:23px}}\n@media(prefers-reduced-motion:reduce){*{transition:none!important}}\n/* v0.5 — calm controls, readable editors, complete light/dark surfaces */\n:host{--im-ink:#37354a;--im-muted:#757086;--im-line:#e4e1ed;--im-paper:#fff;--im-canvas:#f5f4fa;--im-soft:#efedf8;--im-accent:#7770b8;--im-accent-hover:#665da6;--im-accent-active:#554c92;--im-field:#faf9fd;--im-field-border:#ded9e9;--im-subtle:#f4f2f9;--im-selected:#eae6f7;color:var(--im-ink);color-scheme:light}\n:host([data-theme=dark]){--im-ink:#e8e5f2;--im-muted:#afa8c1;--im-line:#3b354b;--im-paper:#252130;--im-canvas:#1c1925;--im-soft:#393246;--im-accent:#aaa0e3;--im-accent-hover:#bcb2f1;--im-accent-active:#c9c0f8;--im-field:#211d2a;--im-field-border:#4a425d;--im-subtle:#2d273a;--im-selected:#3e3456;color-scheme:dark}\nbutton{font-weight:550;transition:background-color .16s,border-color .16s,color .16s,box-shadow .16s; -webkit-tap-highlight-color:transparent;touch-action:manipulation}\nbutton:not(:disabled):hover{background-color:var(--im-selected);border-color:#b8aed5;color:var(--im-ink);box-shadow:0 2px 7px #5a487512}\nbutton:not(:disabled):active{background-color:var(--im-soft);border-color:var(--im-accent);box-shadow:inset 0 1px 3px #30233d25;color:var(--im-accent-active)}\nbutton:disabled{opacity:.48;box-shadow:none}\n.primary:not(:disabled):hover{background:var(--im-accent-hover)!important;border-color:var(--im-accent-hover)!important;color:#fff!important;box-shadow:0 4px 12px #5d4e9c30}\n.primary:not(:disabled):active{background:var(--im-accent-active)!important;border-color:var(--im-accent-active)!important;box-shadow:inset 0 2px 5px #28194336}\n:host([data-theme=dark]) .primary{color:#20192f!important}\n:host([data-theme=dark]) .primary:not(:disabled):hover{color:#20192f!important}\nbutton:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--im-accent);outline-offset:3px}\nnav button{color:var(--im-muted)}nav button.selected{background:var(--im-selected);color:var(--im-accent)}nav button:not(:disabled):active{background:var(--im-soft)}\n.side-bottom button{background:var(--im-subtle)}.side-bottom small,.brand small,.nav-label,.eyebrow,.crumb,#status{color:var(--im-muted)}.crumb b{color:var(--im-ink)}\n.topbar{gap:10px}.global-search{background:var(--im-paper);border-color:var(--im-line)}.global-search button:not(:disabled):hover{background:var(--im-accent-hover);color:#fff}.close{color:var(--im-muted)}\n.theme-toggle{border:1px solid var(--im-line);background:var(--im-paper);color:var(--im-accent);width:34px;height:34px;flex:none;padding:0;display:grid;place-items:center;font:22px/1 system-ui;border-radius:11px}\n#launch:hover{background:var(--im-accent-hover);color:#fff}#launch:active{background:var(--im-accent-active);color:#fff}\n.intro,.paper .hint,.ghost,.empty,details>summary,.room-label{color:var(--im-muted)}.intro{font-size:12px}.paper{border-color:var(--im-line)}\n.note{background:var(--im-soft);border-color:var(--im-line);color:var(--im-muted)}\nlabel{color:var(--im-muted)}input:not([type=checkbox]),textarea,select{background:var(--im-field);border-color:var(--im-field-border);color:var(--im-ink)}input::placeholder,textarea::placeholder{color:var(--im-muted);opacity:.85}\ninput[type=checkbox]{appearance:none;-webkit-appearance:none;display:inline-block;width:38px;height:22px;min-width:38px;flex:none;border:1px solid #bdb6cb;border-radius:30px;background:#d4cfdf;position:relative;vertical-align:middle;cursor:pointer;margin:0;transition:background-color .18s,border-color .18s;outline-offset:4px}\ninput[type=checkbox]:before{content:\"\";position:absolute;width:16px;height:16px;top:2px;left:2px;border-radius:50%;background:#fff;box-shadow:0 1px 3px #30293d30;transition:transform .18s}\ninput[type=checkbox]:checked{background:var(--im-accent);border-color:var(--im-accent)}input[type=checkbox]:checked:before{transform:translateX(16px)}input[type=checkbox]:hover{border-color:var(--im-accent);box-shadow:0 0 0 3px #9486bd1c}input[type=checkbox]:active:before{width:18px}input[type=checkbox]:checked:active:before{transform:translateX(14px)}\n:host([data-theme=dark]) input[type=checkbox]{background:#4a435a;border-color:#6c627d}:host([data-theme=dark]) input[type=checkbox]:checked{background:var(--im-accent);border-color:var(--im-accent)}\n.setting-switch,.check-row{border-color:var(--im-line)}.setting-switch{gap:20px}.setting-switch input{align-self:center}.check-row{align-items:flex-start;gap:13px}.check-row input{margin-top:3px}.check-row b{color:var(--im-ink)}\n.room-switch{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;font-size:10px;margin:0}.room-switch input{width:34px;min-width:34px;height:20px}.room-switch input:before{width:14px;height:14px}.room-switch input:checked:before{transform:translateX(14px)}\n.folder-card{background:var(--im-paper)}.folder-card:not(:disabled):hover{transform:none;background:var(--im-soft)}.folder-card.purple:not(:disabled):hover{background:#6c64b3;color:#fff}.folder-card.cream:not(:disabled):hover{background:#e5dccb;color:#554a37}.folder-card:not(:disabled):active{box-shadow:inset 0 2px 6px #30233d20}.folder-card.purple:active{background:#5c549f!important}\n.file-index:not(:disabled):hover{background-color:#d8d1be;color:#4e5044;border-color:transparent;box-shadow:-4px 0 13px #28202b2e}.file-index.is-current:not(:disabled):hover{background-color:#726aab;color:#fff}.file-index:not(:disabled):active{filter:brightness(.92);color:inherit}\n.welcome-strip{background:var(--im-paper);color:var(--im-muted)}.welcome-strip b{color:var(--im-ink)}.metric{background:var(--im-paper)}.metric strong{color:var(--im-accent)}\n.event-row,#records>article{border-color:var(--im-line)}.event-no,.fact-grid label,.rail-footer{color:var(--im-muted)}.fact-grid p,.quote-card blockquote,#records>article>p{color:var(--im-ink)}.event-row>summary:hover{background:var(--im-soft);border-radius:9px}.event-row>summary{transition:background .15s}\n#eventEditor article,pre{background:var(--im-field);border-color:var(--im-line);color:var(--im-ink)}.range-preview{border-color:var(--im-line)}.range-preview .snippet{color:var(--im-muted)}\n.rail-stat{background:var(--im-subtle)}.rail-stat b{border-color:var(--im-field-border);color:var(--im-accent)}.rail-stat small,.rail-note p{color:var(--im-muted)}.rail-divider{background:var(--im-line)}\n.editor-grid{grid-template-columns:1fr;gap:22px}.memory-editor{padding:0;overflow:hidden;border:1px solid var(--im-line);border-radius:18px;box-shadow:0 4px 18px #42325606}.editor-heading{display:flex;align-items:center;gap:13px;padding:23px 24px 18px}.editor-number{display:grid;place-items:center;width:37px;height:37px;flex:none;border-radius:12px;background:var(--im-soft);color:var(--im-accent);font:12px ui-monospace,monospace}.editor-heading>div{min-width:0;flex:1}.editor-heading h2{font-size:16px;margin:0 0 4px;color:var(--im-ink)}.editor-heading .hint{margin:0;font-size:12px;line-height:1.7}.editor-heading .pill{font-size:9px;background:var(--im-soft);color:var(--im-accent)}.editor-surface{margin:0 24px;border:1px solid var(--im-field-border);border-radius:12px;background:var(--im-field);overflow:hidden}.editor-surface:focus-within{border-color:var(--im-accent);box-shadow:0 0 0 3px #9686c017}.editor-surface textarea{display:block;min-height:320px;max-height:70vh;border:0!important;border-radius:0;background:transparent;padding:20px 22px;color:var(--im-ink);font-size:14px;line-height:2;letter-spacing:.02em;word-break:normal;overflow-wrap:anywhere;tab-size:2;resize:vertical}.editor-surface textarea:focus-visible{outline:0}.editor-meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 25px 18px;font-size:10px;color:var(--im-muted)}.editor-actions{align-items:center;margin:23px 0 15px}.editor-actions small{flex-basis:100%}\n:host([data-theme=dark]) #backdrop{background:#0c0913a8}:host([data-theme=dark]) #panel{box-shadow:0 24px 100px #0008}:host([data-theme=dark]) #error{background:#49302e;color:#ffc4ad}\n:host([data-theme=dark]) .folder-card.cream{background:#453e33;color:#e4d6bc}:host([data-theme=dark]) .folder-card.cream:hover{background:#514734;color:#f3e4c8}:host([data-theme=dark]) .folder-card.purple{background:#62568f}\n:host([data-theme=dark]) .pill.neutral{background:#393342;color:#bcb3cc}:host([data-theme=dark]) .pill.green{background:#293d37;color:#aed5bd}:host([data-theme=dark]) .pill{background:var(--im-soft);color:var(--im-accent)}\n:host([data-theme=dark]) .file-index{background-color:#6a6252;color:#f0e7d6}:host([data-theme=dark]) .file-index:nth-child(4n+2){background-color:#515b6b;color:#e3e9f1}:host([data-theme=dark]) .file-index:nth-child(4n+3){background-color:#725d49;color:#f1e3d2}:host([data-theme=dark]) .file-index:nth-child(4n+4){background-color:#4f6457;color:#e2ede5}:host([data-theme=dark]) .file-index.is-current{background-color:#6f6099;color:#fff}:host([data-theme=dark]) .file-index:hover{filter:brightness(1.12)}\n:host([data-theme=dark]) .rail-folder{background:linear-gradient(135deg,#393149,#30293e);color:#a99ac6}:host([data-theme=dark]) .rail-folder:before{background:#393149}\n@media(max-width:720px){.topbar{gap:7px}.crumb{max-width:34%;line-height:1.7}.global-search{flex:1;width:auto;min-width:0}.theme-toggle{width:30px;height:30px;font-size:20px;border-radius:9px}.close{padding:4px}.editor-heading{padding:18px 16px 14px;gap:10px;flex-wrap:wrap}.editor-heading h2{font-size:15px}.editor-heading .hint{font-size:11px}.editor-heading .pill{margin-left:47px}.editor-surface{margin:0 14px}.editor-surface textarea{padding:16px;min-height:300px;line-height:1.95}.editor-meta{padding:12px 16px 16px;display:grid;gap:4px}.memory-editor{padding:0}.editor-grid{gap:16px}.room-switch{display:none}}\n\n/* v0.5.1 — namespaced colors isolate the host theme; filled hover states. */\n:host{--im-ink:#302c40;--im-muted:#655e75;--im-line:#d8d2e4;--im-accent:#6b5aa8;--im-accent-hover:#584591;--im-accent-active:#483578;--im-field-border:#c9bfdc;--im-button-hover:#ddd4f1;--im-button-active:#c9bce7}\n:host([data-theme=dark]){--im-ink:#f0ebfa;--im-muted:#c4bcd5;--im-line:#51465f;--im-accent:#b8a7ed;--im-accent-hover:#cebcff;--im-accent-active:#dfd0ff;--im-field-border:#6b5b80;--im-button-hover:#594774;--im-button-active:#70558d}\n#panel{color:var(--im-ink)}\nbutton{color:var(--im-ink)}\nbutton:not(:disabled):hover{background:var(--im-button-hover);border-color:var(--im-accent);color:var(--im-ink);box-shadow:0 2px 8px #3b255218}\nbutton:not(:disabled):active{background:var(--im-button-active);border-color:var(--im-accent);color:var(--im-ink);box-shadow:inset 0 2px 4px #25153525}\n.primary:not(:disabled):hover{background:var(--im-accent-hover)!important;color:#fff!important}.primary:not(:disabled):active{background:var(--im-accent-active)!important;color:#fff!important}\n:host([data-theme=dark]) .primary,:host([data-theme=dark]) .primary:not(:disabled):hover,:host([data-theme=dark]) .primary:not(:disabled):active{color:#21172f!important}\nnav button.selected{color:var(--im-accent);background:var(--im-selected)}nav button:not(:disabled):hover,nav button.selected:not(:disabled):hover{background:var(--im-button-hover);color:var(--im-ink)}nav button:not(:disabled):active{background:var(--im-button-active);color:var(--im-ink)}\n.side-bottom button:not(:disabled):hover,.ghost:not(:disabled):hover,.close:not(:disabled):hover,.theme-toggle:not(:disabled):hover{background:var(--im-button-hover);color:var(--im-ink)}\n.file-index:not(:disabled):hover,.folder-card:not(:disabled):hover,.folder-card.cream:not(:disabled):hover{background:var(--im-button-hover);color:var(--im-ink)}.file-index.is-current:not(:disabled):hover,.folder-card.purple:not(:disabled):hover{background:var(--im-accent-hover);color:#fff}\n.file-index:not(:disabled):active,.folder-card:not(:disabled):active{background:var(--im-button-active)!important;color:var(--im-ink);filter:none}\n:host([data-theme=dark]) .file-index:not(:disabled):hover,:host([data-theme=dark]) .folder-card.cream:not(:disabled):hover{background:var(--im-button-hover);color:var(--im-ink);filter:none}\n:host([data-theme=dark]) .file-index.is-current:not(:disabled):hover{background:#8570b3;color:#fff}\n.brand{color:var(--im-accent)}.pill{color:var(--im-accent)}.pill.neutral{color:var(--im-muted)}.rail-stat small,.rail-footer,.rail-note p{color:var(--im-muted)}.folder-card small{opacity:.85}.folder-card span:last-child{opacity:.9}.file-code{opacity:.9}.file-index .file-spine{opacity:.75}\ninput::placeholder,textarea::placeholder{color:var(--im-muted);opacity:1}.global-search input::placeholder{color:var(--im-muted)}\n.overview-tabs{display:flex;gap:6px;padding:5px;margin:0 0 16px;background:var(--im-soft);border:1px solid var(--im-line);border-radius:13px;flex:none}\n.overview-tabs button{flex:1;background:transparent;border:1px solid transparent;border-radius:9px;padding:10px 14px;color:var(--im-muted);font-size:12px;white-space:nowrap}\n.overview-tabs button[aria-selected=true]{background:var(--im-paper);border-color:var(--im-field-border);color:var(--im-ink);box-shadow:0 2px 5px #2515350d;font-weight:700}\n.overview-tabs button:not(:disabled):hover{background:var(--im-button-hover);color:var(--im-ink)}.overview-tabs button:not(:disabled):active{background:var(--im-button-active)}\n#content.overview-page{display:flex;flex-direction:column;overflow:hidden}.overview-page .eyebrow{margin-top:0}.overview-page h1{flex:none}.overview-page>.intro{margin:0 0 14px;flex:none}.overview-page .editor-grid{display:flex;flex-direction:column;flex:1;min-height:0;gap:0}.overview-page .memory-editor{display:flex;flex-direction:column;flex:1;min-height:0;margin:0}.overview-page .editor-heading{padding:16px 20px 12px;flex:none}.overview-page .editor-surface{flex:1;min-height:60px;margin:0 20px}.overview-page .editor-surface textarea{min-height:0;max-height:none;height:100%;resize:none}.overview-page .editor-meta{flex:none;padding:10px 21px 12px}.overview-page .editor-actions{flex:none;margin:13px 0 8px;gap:8px}.overview-page>.note{font-size:10px;padding:9px 12px;flex:none}.overview-page .editor-actions small{font-size:10px}\n@media(max-width:720px){.overview-tabs{gap:4px;padding:4px;margin-bottom:12px}.overview-tabs button{font-size:11px;padding:9px 5px}.overview-page .editor-heading{padding:13px 14px 9px;flex-wrap:nowrap;gap:9px}.overview-page .editor-heading h2{font-size:13px}.overview-page .editor-heading .hint{font-size:10px}.overview-page .editor-heading .pill{display:none}.overview-page .editor-surface{margin:0 12px}.overview-page .editor-surface textarea{padding:13px}.overview-page .editor-meta{padding:8px 14px 10px;font-size:9px;display:flex;gap:4px}.overview-page .editor-actions button{font-size:11px;padding:9px 10px}.overview-page .editor-actions small{font-size:9px}.overview-page>.note{font-size:9px;padding:8px 10px}.overview-page>.intro{font-size:11px}.overview-page h1{font-size:22px;margin-bottom:7px}.overview-page .eyebrow{font-size:8px;margin-bottom:5px}}\n@media(max-height:650px){#content.overview-page{overflow:auto}.overview-page .editor-grid{min-height:240px}}\n/* v0.6 — room identity, scoped library picker, icon-only launcher */\n#launch{width:50px;height:50px;padding:0;display:grid;place-items:center;border-radius:17px;background:#6b5aa8;color:#fff;border:1px solid #ffffff36;box-shadow:0 5px 16px #3f30552b;right:22px;bottom:124px}\n#launch .icon{width:26px;height:26px;stroke-width:1.55}#launch:not(:disabled):hover{background:#55418f;color:#fff;border-color:#ffffff65;box-shadow:0 7px 20px #40305d40}#launch:not(:disabled):active{background:#463575;color:#fff}\n:host([data-theme=dark]) #launch{background:#a68ed9;color:#211630;border-color:#cfc0ec55}:host([data-theme=dark]) #launch:hover{background:#bda4ee;color:#211630}\n.topbar{align-items:center;min-height:100px}.crumb{min-width:0;flex:1}.room-picker{position:relative;min-width:0}#roomButton{display:flex;align-items:center;gap:6px;max-width:100%;padding:5px 7px;margin-left:-7px;border:1px solid transparent;background:transparent;color:var(--im-ink);font-size:13px;font-weight:700;text-align:left;line-height:1.5}#roomButton #room{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}#roomButton .icon{width:14px;height:14px;color:var(--im-muted)}#roomButton:not(:disabled):hover{background:var(--im-button-hover);border-color:var(--im-field-border)}.room-stats{display:block;font-size:10px;color:var(--im-muted);padding-top:2px}.room-page{display:flex;align-items:center;gap:9px;margin-top:5px;font-size:10px}.room-page #roomContext{font-size:9px;color:var(--im-accent)}.room-menu{position:absolute;left:-7px;top:calc(100% + 12px);width:360px;max-width:calc(100vw - 50px);max-height:65vh;overflow:auto;background:var(--im-paper);border:1px solid var(--im-field-border);box-shadow:0 12px 35px #160d2933;border-radius:15px;padding:13px;z-index:20}.room-search-label{margin:0 0 9px;font-size:10px}.room-search-label input{font-size:12px!important;margin-top:5px}#roomOptions{display:grid;gap:3px}.room-option,.room-current{display:flex;align-items:center;justify-content:space-between;gap:9px;width:100%;text-align:left;padding:10px;border:0;border-radius:9px;background:transparent}.room-option>span:first-child{display:flex;gap:10px;align-items:center;min-width:0}.room-option b{display:block;font-size:12px;font-weight:600;white-space:normal;overflow-wrap:anywhere}.room-option small{display:block;font-size:9px;margin-top:3px}.room-option .icon{width:17px;height:17px;color:var(--im-accent)}.room-option.selected{background:var(--im-selected)}.room-check{color:var(--im-accent)}.room-current{justify-content:flex-start;font-size:11px;background:var(--im-subtle)}.room-menu-label{font-size:9px;color:var(--im-muted);padding:10px 6px 5px}.room-menu-help{font-size:9px;color:var(--im-muted);margin:10px 5px 0;padding-top:10px;border-top:1px solid var(--im-line)}\n@media(max-width:720px){.topbar{flex-wrap:wrap;gap:7px;padding-top:9px;padding-bottom:8px}.crumb{max-width:none;flex-basis:100%;display:flex;align-items:center;justify-content:space-between;gap:9px}.room-picker{flex:1;min-width:0}.room-page{flex:none;max-width:35%;display:block;text-align:right;margin:0}.room-page b{font-size:9px}.room-page #roomContext{display:block;font-size:8px}#roomButton{font-size:12px}.room-stats{font-size:9px}.global-search{max-width:none;width:auto}.room-menu{width:340px;max-width:calc(100vw - 36px);left:0;max-height:60vh}.room-search-label input{font-size:16px!important}#launch{width:46px;height:46px;border-radius:15px;right:17px;bottom:115px}#launch .icon{width:24px;height:24px}}\n.auto-organize{border-color:var(--im-field-border);background:var(--im-paper)}.auto-organize .paper-toolbar h3{margin:8px 0}.auto-organize .paper-toolbar>.icon{width:28px;height:28px;color:var(--im-accent)}.organize-progress{padding:14px;background:var(--im-soft);border-radius:12px;margin:12px 0}.organize-progress>div{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:var(--im-ink)}.organize-progress progress{display:block;width:100%;height:8px;margin:13px 0 16px;accent-color:var(--im-accent);border:0;border-radius:20px;overflow:hidden;background:var(--im-line)}.organize-progress progress::-webkit-progress-bar{background:var(--im-line)}.organize-progress progress::-webkit-progress-value{background:var(--im-accent);border-radius:20px}.organize-progress button{font-size:11px}.manual-range>summary{font-size:12px;font-weight:650;color:var(--im-ink)}\n.quote-review-panel{border:1px solid var(--im-field-border);background:var(--im-soft);padding:16px;border-radius:13px;margin-bottom:20px}.quote-review-panel h3{margin-top:0}.quote-review-panel .hint{font-size:11px;color:var(--im-muted)}.quote-review{border-top:1px solid var(--im-line);padding:6px 0}.quote-review summary{color:var(--im-ink);overflow-wrap:anywhere}.quote-review blockquote{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.review-source pre{max-height:230px;overflow:auto;font-size:11px}.review-notice{width:100%;text-align:left;font-size:10px;margin-bottom:10px;background:var(--im-soft)}\n.review-source pre{font-family:inherit;line-height:1.85}\n.repair-summary{font-size:10px;line-height:1.8;color:var(--im-muted);background:var(--im-soft);padding:10px;border-radius:10px;margin:0 0 15px}\n/* Independent overlay surface: the host itself never blocks the app. */\n:host{position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:block;visibility:visible;opacity:1}\n#launch,#panel,#backdrop{pointer-events:auto}#launch{display:grid!important;visibility:visible!important;opacity:1!important;touch-action:manipulation;user-select:none;-webkit-user-select:none}\n.person-chips{display:flex;gap:7px;flex-wrap:wrap;max-height:180px;overflow:auto;padding:5px 0;margin:16px 0}.person-chips button{display:flex;align-items:center;gap:6px;font-size:12px;padding:8px 12px}.person-chips button.selected{background:var(--im-selected);border-color:var(--im-accent);color:var(--im-accent)}.person-chips .icon{width:16px;height:16px}.person-profile .paper-toolbar h2{margin:8px 0 0;font-size:20px}.person-fact{border-bottom:1px solid var(--im-line);padding:10px 0}.person-fact p{font-size:12px;white-space:pre-wrap}.people-hint{font-size:11px;color:var(--im-muted)}\n.file-time{display:block;font-size:9px;line-height:1.5;margin:5px 0;max-height:27px;overflow:hidden;opacity:.9}.file-index{min-height:244px}.file-index h3{margin-top:15px;margin-bottom:8px}.file-index .barcode{margin-top:9px}.timeline-card{display:grid;grid-template-columns:165px minmax(0,1fr);gap:18px;margin:15px 0;border:1px solid var(--im-line);border-radius:14px;background:var(--im-paper);padding:18px}.timeline-stamp{color:var(--im-accent);font-size:12px;line-height:1.8}.timeline-stamp .icon{width:15px;height:15px;display:block;margin-bottom:8px}.timeline-stamp small{display:block}.timeline-content{min-width:0}.timeline-content h3{margin:9px 0;font-size:13px}.timeline-content blockquote{margin:10px 0;padding:6px 13px;border-left:2px solid var(--im-accent);font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}.timeline-content .hint{font-size:10px;color:var(--im-muted)}\n@media(max-width:720px){.timeline-card{grid-template-columns:1fr;gap:9px;padding:15px}.timeline-stamp{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.timeline-stamp .icon{margin:0;display:inline-block}.timeline-stamp small{font-size:9px}.file-index{min-height:245px}}\n\n/* v0.7.5: mobile header controls and movable launcher */\n#themeToggle{font:inherit}#themeToggle .icon{width:20px;height:20px}\n#close{width:44px;height:44px;display:grid;place-items:center;flex:none;padding:0;border-radius:12px}\n#launch{touch-action:none;cursor:grab;-webkit-touch-callout:none;transition:background .15s,box-shadow .15s}\n#launch.dragging{cursor:grabbing;box-shadow:0 9px 28px #30204766;transition:none}\n@media(max-width:720px){\n .sidebar{padding-top:calc(8px + env(safe-area-inset-top,0px))}\n .brand{min-height:44px;padding-right:110px;padding-bottom:8px}\n #close,#themeToggle{position:absolute;top:calc(8px + env(safe-area-inset-top,0px));z-index:30;width:44px;height:44px;border:1px solid var(--im-line);background:var(--im-paper);border-radius:12px}\n #close{right:14px}#themeToggle{right:66px}\n #close:hover,#themeToggle:hover{background:var(--im-button-hover)}\n .topbar .global-search{width:100%;max-width:none;flex-basis:100%}\n #content{padding-bottom:calc(25px + env(safe-area-inset-bottom,0px))}\n}\n\n.profile-field{padding:14px 16px;margin:12px 0;border:1px solid var(--im-line);border-radius:14px;background:var(--im-field);}\n.profile-field h4{margin:0 0 8px;color:var(--im-accent);font-size:14px;}\n.profile-field p{margin:6px 0;line-height:1.75;white-space:pre-wrap;overflow-wrap:anywhere;}\n.identity-editor{margin:20px 0;padding:16px;border:1px solid var(--im-line);border-radius:14px;}\n.selection-toolbar{padding-bottom:18px;margin-bottom:18px;border-bottom:1px solid var(--im-line);}\n.memory-select{margin:0 0 14px;}\n\n/* v0.9.13: complete chapter index and readable saved-memory cards. */\n.file-shelf.chapter-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,210px),1fr));gap:28px 20px;overflow:visible;padding:18px 4px 25px;min-height:0}\n.chapter-grid .file-index{display:flex;flex-direction:column;width:100%;min-width:0;max-width:none;margin:0;flex:none;min-height:250px;padding:22px 16px 20px 30px}\n.chapter-grid .file-index h3{display:block;-webkit-line-clamp:unset;overflow:visible;font-size:15px;line-height:1.65;margin:16px 0 10px}\n.chapter-grid .file-time{max-height:none;overflow:visible;overflow-wrap:anywhere;margin:6px 0 16px}\n.chapter-grid .file-index .file-foot{position:static;margin-top:auto;gap:8px;flex-wrap:wrap;width:100%;line-height:1.6}\n.chapter-grid .barcode{margin-bottom:16px}.chapter-navigation{scroll-margin-top:16px}#chapterDetail{scroll-margin-top:16px}\n#records>article.memory-card{padding:18px;margin:14px 0;border:1px solid var(--im-line);border-radius:15px;background:var(--im-paper)}\n.memory-card-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.memory-card .memory-select{margin-left:auto;padding:0;border:0;gap:10px}.memory-card .memory-select span{font-size:10px;color:var(--im-muted)}\n.memory-details>summary{list-style:none;border-radius:10px;padding:15px 0 0;color:var(--im-ink)}.memory-details>summary::-webkit-details-marker{display:none}.memory-details>summary:hover{background:var(--im-soft)}\n.memory-details h3{font-size:14px;line-height:1.8;font-weight:600;margin:0 0 8px;overflow-wrap:anywhere}.memory-details summary small{display:block;color:var(--im-muted);font-size:11px;line-height:1.7}.memory-expand{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--im-accent);margin-top:12px}.memory-expand .icon{width:13px;height:13px}.memory-details[open]>summary .memory-expand .icon{transform:rotate(180deg)}\n.memory-full{border-top:1px solid var(--im-line);margin-top:14px;padding-top:8px}.memory-full>p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.9;font-size:13px;color:var(--im-ink)}.memory-full small{font-size:10px;color:var(--im-muted)}.memory-options{margin-top:15px;border-top:1px solid var(--im-line)}.memory-options summary{font-size:11px}.memory-options .hint{overflow-wrap:anywhere}\n@media(max-width:720px){.file-shelf.chapter-grid{grid-template-columns:repeat(auto-fill,minmax(min(100%,150px),1fr));gap:26px 12px}.chapter-grid .file-index{min-height:250px;padding:20px 12px 16px 25px}.chapter-grid .file-index h3{font-size:14px}.chapter-grid .file-code{font-size:8px;letter-spacing:.7px}#records>article.memory-card{padding:14px}.memory-card .memory-select span{font-size:9px}.memory-card-top{gap:6px}.memory-details h3{font-size:14px}}\n\n.paper-toolbar>button{flex-shrink:0;white-space:nowrap}.event-narrative{border-bottom:1px solid var(--im-line);padding:0 0 16px;margin:0 0 16px}.event-narrative h4{font-size:11px;color:var(--im-accent);margin:10px 0}.event-narrative p{font-size:13px;line-height:1.9;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--im-ink)}\n\n.chapter-page-toolbar{flex-wrap:wrap}.chapter-page-toolbar>.buttons{max-width:100%;justify-content:flex-start}\n\n#diagnosticCopyText{min-height:260px;max-height:55vh;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;line-height:1.6;white-space:pre;overflow:auto;resize:vertical;}\n\n.memory-link-section{margin:18px 0;padding:14px 0;border-top:1px solid var(--im-line)}.memory-link-section h4{font-size:12px;color:var(--im-accent)}.memory-link-section p{display:grid;gap:5px;line-height:1.7}.memory-link{color:var(--im-accent);text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}.memory-link:hover{color:var(--im-ink)}.memory-link-section small,.memory-link-section span{font-size:12px}\n\n.continuous-events{border:1px solid var(--im-line);border-radius:18px;padding:18px;margin:18px 0;background:var(--im-paper)}\n.continuous-events>summary{display:flex;flex-wrap:wrap;gap:12px;align-items:center;cursor:pointer;padding:12px}\n.continuous-events>summary span,.memory-link-badge{color:var(--im-accent);font-size:.85rem}\n.continuous-events .memory-card{margin:12px 0}\n.timeline-content .event-narrative{margin:16px 0;line-height:1.85;white-space:normal}\n@media(max-width:640px){.continuous-events{padding:10px}.timeline-content .quote-card{padding:12px}}\n\n/* Chapter continuity facts share the existing theme and button behavior. */\n.chapter-details{margin:1.25rem 0;padding:1rem;border:1px solid var(--im-line);border-radius:14px}\n.chapter-fact{padding:.75rem 0;border-bottom:1px solid var(--im-line)}\n.chapter-fact:last-of-type{border-bottom:0}\n.chapter-fact p{line-height:1.75;overflow-wrap:anywhere;white-space:pre-wrap}\n.chapter-details nav{margin-top:1rem;gap:.75rem;flex-wrap:wrap}\n\n/* Local and model diagnostics stay reachable above the scrolling tab content. */\n.error-diagnostics{margin:0 28px 12px;max-height:35vh;overflow:auto;flex-shrink:0;min-width:0}.error-diagnostics .buttons{margin:0;flex-wrap:wrap}.error-diagnostics textarea{width:100%;box-sizing:border-box;min-height:100px;max-height:22vh;white-space:pre-wrap;overflow:auto}@media(max-width:720px){.error-diagnostics{margin-left:18px;margin-right:18px}}\n\n/* Links between records: soft chips and rows instead of underlined text. */\na.record-link{text-decoration:none;color:inherit;cursor:pointer;transition:background .15s,border-color .15s,transform .15s}\n.record-links{display:flex;flex-wrap:wrap;gap:8px 14px;margin:6px 0 12px}\n.chip-wrap{display:inline-flex;align-items:center;gap:6px}\n.chip-wrap small{font-size:10px;color:var(--im-muted)}\na.chip{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:4px 8px 4px 5px;border-radius:999px;background:var(--im-soft);color:var(--im-accent);font-size:11px;font-weight:600;border:1px solid transparent}\na.chip:hover{background:var(--im-button-hover);border-color:var(--im-field-border)}\n.chip-id{font:9px ui-monospace,monospace;padding:2px 6px;border-radius:999px;background:var(--im-paper);color:var(--im-muted);font-weight:400}\n.chip-arrow{font-size:14px;line-height:1;opacity:.55}\n.record-list{display:flex;flex-direction:column;gap:6px;margin:4px 0 18px}\na.record-row{display:flex;align-items:center;gap:12px;padding:11px 14px;border:1px solid var(--im-line);border-radius:12px;background:var(--im-paper)}\na.record-row:hover{background:var(--im-soft);border-color:var(--im-field-border);transform:translateX(2px)}\na.record-row .pill{flex:none;min-width:38px;justify-content:center}\n.row-main{min-width:0;flex:1}\n.row-main b{display:block;font-size:12px;font-weight:600;line-height:1.6;color:var(--im-ink);overflow-wrap:anywhere}\n.row-main small{display:block;margin-top:2px;font-size:10px}\na.record-row .chip-arrow{color:var(--im-accent)}\n.is-focus{border-radius:12px;box-shadow:0 0 0 2px var(--im-accent);animation:focus-fade 2.4s ease-out forwards}\n@keyframes focus-fade{0%{box-shadow:0 0 0 2px var(--im-accent),0 0 0 8px var(--im-soft)}70%{box-shadow:0 0 0 2px var(--im-accent)}100%{box-shadow:0 0 0 0 transparent}}\n\n/* Chapters: a scrolling row of chips above the scene shelf. */\n.chapter-bar{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 12px;margin:0 0 6px;scrollbar-width:thin}\n.chapter-chip{flex:none;display:inline-flex;align-items:center;gap:7px;max-width:240px;padding:6px 12px 6px 6px;border-radius:999px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--im-paper)}\n.chapter-chip.is-selected{background:var(--im-accent);border-color:var(--im-accent);color:#fff}\n.chapter-chip.is-selected .chip-id{background:#ffffff33;color:#fff}\n.chapter-paper{margin-top:4px}\n:host([data-theme=dark]) .chapter-chip.is-selected{color:#211a30}:host([data-theme=dark]) .chapter-chip.is-selected .chip-id{color:#211a30;background:#ffffff55}\n\n/* Daily life rows: what · when · what exactly · flags · buttons, wrapping on a phone. */\n.routine-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--im-line)}\n.routine-row:last-child{border-bottom:0}\n.routine-row select{width:auto;flex:0 0 92px}\n.routine-row input[type=datetime-local]{width:auto;flex:0 0 200px}\n.routine-row input[data-f=text]{flex:1 1 200px;width:auto}\n.routine-row.routine-new{border-bottom:0;padding-bottom:0}\n.routine-row.routine-new input[data-f=who]{flex:0 0 160px;width:auto}\n.routine-row .mini{display:inline-flex;align-items:center;margin:0;font-size:11px;white-space:nowrap}\n.routine-row button{padding:7px 12px;font-size:11px}\ndetails.paper>summary{font-size:13px;font-weight:600;color:var(--im-ink)}\n.routine-row .warn{flex-basis:100%;color:#b0623f}:host([data-theme=dark]) .routine-row .warn{color:#ffb08a}\n";
  const host = typeof marinara === 'object' ? marinara : globalThis.marinara || {};
  const BASE = '/api/memory-module';
  const NAV = [
    ['home', '기억 보관함', 'archive'],
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
  let serverSettings = null;
  let notice = '';
  let lastError = '';
  let busy = false;
  let pollTimer = null;
  let armed = '';
  let disposed = false;
  let theme = 'light';
  /** A record to jump to after the next render: { kind: 'thread' | 'fact', id }. */
  let focus = null;
  /** A group story (two or more characters): who-knows-what fields are shown. */
  const group = () => (info?.cast || store?.cast || []).filter((n) => !(store?.personas || info?.personas || []).includes(n)).length >= 2;
  try {
    const saved = localStorage.getItem('memory-module-theme');
    theme = ['light', 'dark'].includes(saved) ? saved : window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
          <span class="file-code">${esc(s.id)} · ${s.start}~${s.end}</span><span class="file-spine">SCENE ${String(i + 1).padStart(3, '0')}</span>
          <h3>${esc(s.title)}</h3><span class="barcode"></span>
          <span class="file-foot"><span>${esc((s.time || '').split(/\s+/).slice(0, 2).join(' '))}</span><span>${s.edited ? '고침' : ''}</span></span></button>`;
      })
      .join('');
    const s = inGroup.find((x) => x.id === selectedScene);
    return `<div class="eyebrow">SCENES · ${store.scenes.length}${chapters.length ? ` · CHAPTERS · ${chapters.length}` : ''}</div><h1>장면</h1>
      <p class="intro">보라색 카드는 아직 모델이 원문으로 직접 보고 있는 장면입니다(기억 칸에는 들어가지 않습니다). 카드를 누르면 아래에서 고치실 수 있습니다.${chapters.length ? ' 오래된 장면은 챕터로 묶여, 기억 칸에는 챕터 요약으로 들어갑니다.' : ''}</p>
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
      <h3>사건</h3><div id="eventEditor">${events || '<p class="hint">사건이 없습니다.</p>'}</div>
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
          return `<div class="fact-row" data-fact="${esc(f.id)}"><label>${esc(f.id)}${f.unaware?.length ? ` · 모름: ${esc(f.unaware.join('·'))}` : ''}${f.guess?.length ? ` · 짐작만: ${esc(f.guess.join('·'))}` : ''}${f.edited ? ' · 직접 고침' : ''}${replaced ? ` · ${esc(f.replacedBy)}로 바뀜(기억 칸에서 제외)` : ''}</label>
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
      ${info.rendered ? `<pre>${esc(info.rendered)}</pre>` : '<div class="empty">아직 들어가는 기억이 없습니다.</div>'}`;
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
        <div class="buttons"><button class="primary" data-act="saveSettings">저장</button></div>
      </div>
      <div class="paper"><h2>뜻으로 찾기 (임베딩)</h2>
        <p class="hint">말을 바꿔 물어도 비슷한 내용의 지난 장면을 찾습니다. 위의 ‘기억 정리에 쓸 연결’로 임베딩 모델을 부릅니다. 비워 두면 꺼집니다.</p>
        <label>임베딩 모델<input id="setEmbedding" list="embeddingModels" value="${esc(serverSettings?.embedding?.model || '')}" placeholder="예: Qwen/Qwen3-Embedding-8B"></label>
        <datalist id="embeddingModels"><option value="Qwen/Qwen3-Embedding-8B"><option value="BAAI/bge-m3"><option value="Qwen/Qwen3-Embedding-0.6B"></datalist>
        ${info.vectors ? `<p class="hint">이 방: 장면 ${info.vectors.total}개 중 ${info.vectors.indexed}개 색인됨${info.vectors.indexed < info.vectors.total ? ' (다음 정리 때 이어서 만듭니다)' : ''}</p>` : ''}
        <div class="buttons"><button data-act="saveEmbedding">임베딩 저장·연결 확인</button></div>
      </div>
      <p class="hint">기억 모듈 업데이트는 서버 터미널에서 해 주세요: curl … update.sh | sh</p>`;
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
        const body = { title: ed.querySelector('#cTitle').value, summary: ed.querySelector('#cSummary').value, turns: ed.querySelector('#cTurns').value.split('\n') };
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
        return act(async () => {
          const r = await api('POST', '/settings/embedding', { model });
          serverSettings = (await api('GET', '/status')).settings;
          if (model && info?.enabled) await api('POST', `/chats/${chat}/start`, {}).catch(() => {});
          notice = model ? `임베딩 모델을 연결했습니다 (${r.dimensions}차원). 장면 색인을 시작합니다.` : '뜻으로 찾기를 껐습니다.';
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
          serverSettings = (await api('GET', '/status')).settings;
        }, '설정을 저장했습니다.');
      }
      default:
    }
  }

  async function openSettings() {
    try {
      const [status, list] = await Promise.all([api('GET', '/status'), api('GET', '/api/connections').catch(() => [])]);
      serverSettings = status.settings;
      connections = (Array.isArray(list) ? list : list?.connections || []).map((c) => ({ id: c.id, name: c.name, model: c.model }));
    } catch (error) {
      lastError = error.message;
    }
    render();
  }

  const LAUNCH_ICON = '<svg class="launch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M3 7.2c2.9-1.1 5.9-.9 9 1.1 3.1-2 6.1-2.2 9-1.1v11.6c-2.9-1.1-5.9-.9-9 1.1-3.1-2-6.1-2.2-9-1.1z"/>'
    + '<path d="M12 8.3v11.6"/><path d="M6 11.4c1.4-.4 2.7-.3 3.8.2M6 14.4c1.4-.4 2.7-.3 3.8.2M14.2 11.6c1.1-.5 2.4-.6 3.8-.2" opacity=".55"/>'
    + '<path d="M12 1.2l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" fill="currentColor" stroke-width=".8"/>'
    + '</svg>';
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
    root.innerHTML = `<style>${UI_CSS}${EXTRA_CSS}</style>
      <button id="launch" aria-label="기억 서재 열기" title="기억 서재 (끌어서 옮길 수 있습니다)">${LAUNCH_ICON}</button>
      <div id="backdrop" hidden></div>
      <section id="panel" role="dialog" aria-label="기억 서재" aria-modal="true" hidden>
        <aside class="sidebar"><div class="brand">${icon('book')}<div>기억 서재<small>MEMORY MODULE</small></div></div>
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
    #launch{position:fixed;right:20px;bottom:126px;width:52px;height:52px;padding:0;border-radius:18px;place-items:center;color:#fff;
      background:linear-gradient(145deg,#8f7ad8 0%,#6a55b5 55%,#54418f 100%);border:1px solid #ffffff3d;
      box-shadow:0 8px 22px #3a2a6a40,inset 0 1px 0 #ffffff40;transition:transform .18s,box-shadow .18s}
    #launch:not(:disabled):hover{background:linear-gradient(145deg,#9c88e2 0%,#735ec0 55%,#5b479a 100%);transform:translateY(-1px);box-shadow:0 11px 26px #3a2a6a55,inset 0 1px 0 #ffffff50}
    #launch:not(:disabled):active{transform:scale(.96)}
    #launch.dragging{transform:scale(1.06);box-shadow:0 14px 32px #2a1d5070,inset 0 1px 0 #ffffff50}
    #launch .launch-icon{width:28px;height:28px;filter:drop-shadow(0 1px 1px #2a1d5055)}
    :host([data-theme=dark]) #launch{color:#fff;background:linear-gradient(145deg,#a891ea 0%,#7c66c9 55%,#5f4ba4 100%);border-color:#ffffff30}
    :host([data-theme=dark]) #launch:not(:disabled):hover{color:#fff;background:linear-gradient(145deg,#b6a1f0 0%,#8771d2 55%,#6853ae 100%)}
    #roomSelect{max-width:min(360px,100%);font-size:12px;padding:7px 10px;border-radius:10px}
    .fact-row{border-top:1px solid var(--im-line);padding:10px 0}.fact-row:first-of-type{border-top:0}.fact-row label{margin:0 0 6px}
    .fact-row textarea{min-height:64px}
    #eventEditor article,#recEditor article{background:var(--im-field);padding:14px;border:1px solid var(--im-line);border-radius:12px;margin:12px 0}
    .metric-row{flex-wrap:wrap}.metric{min-width:120px}
    pre{max-height:none}
    @media(max-width:720px){.metric{min-width:calc(50% - 6px)}#launch{width:48px;height:48px;border-radius:16px}#launch .launch-icon{width:26px;height:26px}}
  `;

  function cleanup() {
    disposed = true;
    clearTimeout(pollTimer);
    root?.host?.remove();
  }

  install();
  host.onCleanup?.(cleanup);
})();
