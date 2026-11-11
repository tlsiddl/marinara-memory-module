/* 기억 서재 · 마리나라 엔진용 기억 모듈 (비공식) */
(() => {
  'use strict';
  // 기억 서재 (기억 모듈판): a window onto the server-side memory module (/api/memory-module).
  // All memory lives on the server; this only shows it and sends the user's changes back.
  const VERSION = "0.32.2";
  const UI_CSS = /*__UI_CSS__*/ ":host{all:initial;color:#34374b;font:14px/1.65 \"Pretendard\",\"Noto Sans KR\",-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;--im-accent:#7777c8;--im-ink:#34374b;--im-muted:#8e91a6;--im-line:#e9e9f2;--im-paper:#fff;--im-canvas:#f5f5fb;--im-soft:#eeeefa}\n*{box-sizing:border-box}button,input,select,textarea{font:inherit}button{cursor:pointer;color:inherit;border:1px solid var(--im-line);background:var(--im-paper);padding:9px 14px;border-radius:11px;transition:background .15s,transform .15s,box-shadow .15s}button:hover{background:var(--im-soft)}button:disabled{opacity:.45;cursor:default}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #aaa7e5;outline-offset:3px}.icon{width:19px;height:19px;flex:none;display:inline-block;vertical-align:middle}#launch{position:fixed;right:20px;bottom:126px;z-index:2147483600;display:flex;align-items:center;gap:8px;color:#fff;background:#7777c8;border:0;border-radius:24px;padding:11px 19px;box-shadow:0 7px 20px #7777c84d}#backdrop{position:fixed;inset:0;background:#20233654;z-index:2147483601}#panel{position:fixed;z-index:2147483602;left:50%;top:50%;transform:translate(-50%,-50%);width:min(1320px,96vw);height:min(900px,91vh);display:grid;grid-template-columns:192px minmax(0,1fr) 224px;background:var(--im-paper);border-radius:26px;box-shadow:0 25px 100px #25254435;overflow:hidden}#panel[hidden],[hidden]{display:none!important}\n.sidebar{display:flex;flex-direction:column;padding:30px 18px 20px;border-right:1px solid var(--im-line);min-width:0}.brand{display:flex;align-items:center;gap:10px;padding:0 12px 30px;color:var(--im-accent);font-size:18px;font-weight:750;letter-spacing:-.8px}.brand .icon{width:27px;height:27px}.brand small{display:block;white-space:nowrap;font:7px/1.8 ui-monospace,monospace;letter-spacing:1.3px;color:#a8a6bd}.nav-label{font-size:9px;letter-spacing:1.8px;color:#b2b1c2;padding:13px 14px 9px}nav{display:flex;flex-direction:column;gap:6px}nav button{display:flex;gap:11px;align-items:center;border:0;background:transparent;text-align:left;font-size:12px;padding:11px 13px;border-radius:10px;color:#9291aa}nav button.selected{background:#eeeeFA;color:#6d69b4;font-weight:700}nav button .icon{width:17px;height:17px}.side-bottom{margin-top:auto;padding-top:26px;display:grid;gap:10px}.side-bottom button{font-size:11px;border:0;display:flex;align-items:center;gap:8px;background:#f7f7fb}.side-bottom small{font-size:9px;color:#b0aec0;padding-left:10px}\n.workspace{min-width:0;min-height:0;display:flex;flex-direction:column;background:var(--im-canvas)}.topbar{min-height:84px;display:flex;gap:14px;align-items:center;padding:20px 30px}.crumb{font-size:11px;color:#a2a0b6;flex:1}.crumb b{color:#636178;font-weight:500}.global-search{display:flex;align-items:center;gap:7px;border:1px solid #e8e7f2;background:#fff9;padding:6px 7px 6px 12px;border-radius:30px;width:min(225px,44%)}.global-search input{border:0!important;background:transparent!important;outline:0;width:100%;min-width:0;font-size:10px!important;padding:0!important}.global-search button{padding:5px;border-radius:50%;border:0;background:#7a77c9;color:#fff;line-height:0}.global-search .icon{width:14px;height:14px}.close{border:0;background:transparent;padding:7px;line-height:0;color:#a5a1b5}.close:hover{background:#eae9f4}#status{font-size:10px;color:#a09cb4;padding:0 30px 5px;min-height:20px}#error{margin:0 28px 12px;padding:12px 14px;border-radius:12px;background:#fff0e7;color:#995c42;font-size:12px;white-space:pre-wrap}#content{padding:8px 30px 32px;overflow:auto;overscroll-behavior:contain;flex:1;min-height:0;scrollbar-width:thin;scrollbar-color:#dad7e9 transparent}.eyebrow{font:9px ui-monospace,monospace;letter-spacing:2.2px;color:#a9a5bc;text-transform:uppercase;margin:4px 0 8px}h1{font-size:25px;line-height:1.4;letter-spacing:-1.1px;margin:0 0 10px;font-weight:740}h2,h3{font-size:14px;letter-spacing:-.35px;margin:20px 0 12px;font-weight:700}h4{margin:0;font-size:13px}p{margin:8px 0 14px;overflow-wrap:anywhere}.intro{font-size:11px;color:#9995ac;line-height:1.85;margin-bottom:25px}.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 15px}.section-head h2,.section-head h3{margin:0}.section-head>small{font-size:10px;color:var(--im-muted)}small{color:var(--im-muted);font-size:10px;overflow-wrap:anywhere}.buttons{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.primary{background:var(--im-accent)!important;border-color:var(--im-accent)!important;color:#fff!important;box-shadow:0 4px 10px #7777c824}.ghost{border:0;background:transparent;padding:6px 9px;font-size:10px;color:#9390aa}.recall-marks{display:inline-flex;gap:4px;margin-left:auto}.mark-button.is-on{background:var(--im-soft);color:var(--im-accent);font-weight:700}.reason-list{display:grid;gap:6px}.reason-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--im-line);border-radius:10px}.reason-row .row-main{display:grid;gap:3px;min-width:0;flex:1}.reason-chips{display:flex;gap:4px;flex-wrap:wrap}.pill{display:inline-flex;gap:4px;align-items:center;background:var(--im-soft);color:#7e76b4;border-radius:30px;padding:3px 9px;font-size:9px;white-space:nowrap}.pill.green{background:#eaf4ef;color:#68957a}.pill.neutral{background:#efeff4;color:#9693a6}\n.folder-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:17px;margin:36px 0 26px}.folder-card{position:relative;border:0;text-align:left;min-height:155px;padding:23px 18px 17px;border-radius:0 16px 16px 16px;box-shadow:0 8px 25px #30305b08;background:#fff;display:flex;flex-direction:column;align-items:flex-start;isolation:isolate}.folder-card:before{content:\"\";position:absolute;top:-12px;left:0;width:52%;height:26px;background:inherit;border-radius:11px 12px 0 0;z-index:-1}.folder-card.purple{background:#7a78c7;color:#fff}.folder-card.cream{background:#eee8db}.folder-card:hover{transform:translateY(-3px);background:#f0eff9}.folder-card.purple:hover{background:#706dc0}.folder-card.cream:hover{background:#e8e0ce}.folder-card .icon{width:23px;height:23px;opacity:.7;margin-bottom:16px}.folder-card small{font-size:8px;letter-spacing:1.3px;color:inherit;opacity:.55}.folder-card strong{font-size:13px;line-height:1.6;margin:5px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.folder-card span:last-child{margin-top:auto;font-size:9px;opacity:.7}.welcome-strip{display:flex;align-items:center;justify-content:space-between;gap:18px;background:#fff;padding:15px 18px;border-radius:13px;margin:20px 0;font-size:11px;color:#8e88a6}.welcome-strip b{display:block;color:#625d7c;font-size:12px;margin-bottom:4px}\n.file-shelf{display:flex;gap:0;overflow-x:auto;overflow-y:hidden;padding:12px 6px 18px 0;min-height:225px;scrollbar-width:thin}.file-index{flex:1 0 115px;position:relative;min-width:115px;max-width:210px;min-height:215px;margin-left:-13px;padding:28px 15px 20px 29px;text-align:left;border:0;border-radius:0 11px 7px 0;box-shadow:-4px 0 10px #2c2a321c;background:linear-gradient(96deg,#ffffff18,transparent 30%),repeating-linear-gradient(0deg,#ffffff08 0,#ffffff08 1px,#00000003 1px,#00000003 3px),#e5e0d0;isolation:isolate;color:#4e5044;transition:transform .18s;overflow:visible}.file-index:first-child{margin-left:0}.file-index:before{content:\"\";position:absolute;top:-10px;left:0;width:82%;height:24px;z-index:-1;background:inherit;border-radius:6px 11px 0 0}.file-index:nth-child(4n+2){background-color:#bfc4ca;color:#3f4653}.file-index:nth-child(4n+3){background-color:#c6b49b;color:#55432e}.file-index:nth-child(4n+4){background-color:#aeb8aa;color:#344b40}.file-index.is-current{background-color:#8481b5;color:#fff}.file-index:hover,.file-index.is-selected{transform:translateY(-7px);z-index:4}.file-index.is-selected{box-shadow:-4px 0 12px #35305422,inset 0 0 0 1px #6f6a9a55}.file-code{font:8px ui-monospace,monospace;letter-spacing:1.1px;opacity:.68}.file-index h3{font-size:16px;line-height:1.55;font-weight:650;margin:20px 0 12px;word-break:keep-all;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.file-index .file-spine{position:absolute;left:8px;top:40px;writing-mode:vertical-rl;font:8px ui-monospace,monospace;letter-spacing:1.8px;opacity:.48}.file-index .file-foot{position:absolute;bottom:18px;left:29px;right:12px;font-size:9px;border-top:1px solid #0000001a;padding-top:10px;display:flex;justify-content:space-between}.file-index .barcode{height:14px;width:43px;margin-top:15px;opacity:.35;background:repeating-linear-gradient(90deg,currentColor 0,currentColor 1px,transparent 1px,transparent 3px,currentColor 3px,currentColor 5px,transparent 5px,transparent 7px)}\n.paper{background:var(--im-paper);border:1px solid #eeeef5;border-radius:15px;padding:20px;margin:16px 0}.paper h3:first-child{margin-top:0}.paper .hint{font-size:11px;color:#9993ac;line-height:1.8}.paper-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px}.paper-toolbar h2{margin:0}.editor-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}.editor-grid .paper{margin:0}.note{background:#eeeefa;border:1px solid #e4e2f2;border-radius:12px;padding:14px 16px;font-size:11px;color:#827a9c;line-height:1.85}.event-row{border-bottom:1px solid #efedf5;background:transparent}.event-row:last-child{border-bottom:0}.event-row>summary{list-style:none;cursor:pointer;padding:16px 0;display:flex;align-items:center;gap:12px}.event-row>summary::-webkit-details-marker{display:none}.event-no{font:10px ui-monospace,monospace;color:#a6a0bc;min-width:24px}.event-main{min-width:0;flex:1}.event-main b{font-size:12px;font-weight:600;display:block}.event-main small{font-size:9px;display:block;margin-top:3px}.event-body{padding:0 0 16px 36px;font-size:12px}.fact-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 24px}.fact-grid .wide{grid-column:1/-1}.fact-grid label{padding:0;color:#aba4bd;font-size:9px}.fact-grid p{color:#615b73;font-size:12px;margin:5px 0 0;white-space:pre-wrap}.quote-card{border-left:2px solid #c3bde2;margin:15px 0;padding:2px 14px}.quote-card blockquote{margin:6px 0;font-size:13px;color:#665a83;white-space:pre-wrap}.quote-card small{font-size:9px}.empty{padding:35px 20px;text-align:center;color:#aaa3b8;font-size:12px}.empty .icon{display:block;margin:0 auto 10px;width:30px;height:30px;opacity:.5}\nlabel{display:block;font-size:11px;color:#777187;margin:12px 0 6px}input:not([type=checkbox]),textarea,select{width:100%;background:#fafafe;color:#575167;border:1px solid #e5e1ef;border-radius:9px;padding:10px 11px;outline:none;font-size:12px}input[type=checkbox]{accent-color:var(--im-accent);vertical-align:middle;width:15px;height:15px;margin-right:7px}textarea{min-height:180px;resize:vertical;line-height:1.85}textarea.event-field{min-height:88px}#eventEditor textarea[data-q]{min-height:90px}#eventEditor article{background:#faf9fd;padding:17px;border:1px solid #ebe6f2;border-radius:12px;margin:15px 0}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 15px}.form-grid .full{grid-column:1/-1}.setting-switch{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f0eef5;margin:0}.setting-switch span{font-size:12px}.setting-switch small{display:block;margin-top:3px;font-size:10px}.setting-switch input{order:2;margin:0}.check-row{display:flex;gap:8px;border-top:1px solid #f0eef5;padding:13px 0;margin:0}.check-row span{min-width:0}.check-row b{font-size:12px;color:#6d657e}.check-row small{display:block;font-size:10px;margin-top:4px;line-height:1.75}.check-row input{flex:none;margin-top:3px}.range-preview{border:1px solid #e7e3f1;border-radius:10px;margin:15px 0;padding:13px}.range-preview p{font-size:11px;margin:6px 0}.range-preview .snippet{color:#aaa0b4;font-size:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.import-preview{max-height:350px;overflow:auto}.metric-row{display:flex;gap:12px}.metric{flex:1;padding:16px;background:#fff;border-radius:12px}.metric strong{display:block;font-size:22px;font-weight:500;color:#7870b5}.metric small{font-size:10px}pre{font:10px/1.8 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#f8f6fc;border-radius:10px;padding:15px;color:#82778d}details>summary{cursor:pointer;color:#8e83a0;font-size:11px;padding:10px 0}#records>article{padding:16px 0;border-bottom:1px solid #ece8f2}#records>article>b{font-size:12px}#records>article>p{font-size:12px;color:#82768d}#records>article>small{display:block}#records blockquote{border-left:2px solid #cbc0e2;margin:12px 0;padding:5px 13px;font-size:12px}\n.inspector{padding:30px 22px;border-left:1px solid var(--im-line);overflow:auto}.rail-title{font-size:12px;font-weight:650;margin:7px 0 20px}.rail-stat{display:flex;align-items:center;gap:12px;background:#f5f4fa;border-radius:14px;padding:15px 12px;margin:11px 0}.rail-stat b{width:46px;height:46px;display:grid;place-items:center;border:1px solid #c9c4e9;border-radius:50%;color:#8178ba;font-size:16px;font-weight:500;flex:none}.rail-stat small{font-size:10px;line-height:1.8;color:#9c92ac}.rail-divider{height:1px;background:#efebf4;margin:24px 0}.rail-note h3{font-size:12px;line-height:1.8;margin:0 0 8px}.rail-note p{font-size:10px;color:#a296af;line-height:1.9}.rail-note .icon{color:#9c91c8;width:28px;height:28px;margin-bottom:10px}.rail-folder{height:90px;background:linear-gradient(135deg,#eeeafa,#e7e3f4);border-radius:10px;position:relative;margin:24px 4px;color:#a59ac6;display:grid;place-items:center}.rail-folder:before{content:\"\";position:absolute;top:-10px;left:0;width:55%;height:20px;background:#eeeafa;border-radius:8px}.rail-folder .icon{width:42px;height:42px}.room-label{font-size:11px;color:#82778e;margin:12px 0;overflow-wrap:anywhere}.rail-footer{font-size:9px;color:#b9aec1;line-height:1.9;margin-top:28px}\n@media(max-width:1120px){#panel{grid-template-columns:174px minmax(0,1fr)}.inspector{display:none}.sidebar{padding-left:12px;padding-right:12px}}@media(max-width:720px){#panel{inset:0;left:0;top:0;transform:none;width:100%;height:100dvh;border-radius:0;grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}.sidebar{padding:14px 14px 0;border:0;display:block;overflow:clip}.brand{padding:0 4px 10px;font-size:16px}.brand small,.nav-label,.side-bottom{display:none}.sidebar nav{flex-direction:row;overflow-x:auto;gap:3px;padding-bottom:10px;scrollbar-width:none}.sidebar nav button{flex:none;font-size:10px;padding:8px 9px;gap:6px}.sidebar nav .icon{width:14px;height:14px}.topbar{min-height:60px;padding:12px 18px;gap:9px}.crumb{font-size:10px}.global-search{width:42%;padding-left:9px}.global-search input{font-size:16px!important}#content{padding:6px 18px 25px}#status{padding:0 18px 6px}#error{margin:0 16px 10px}.editor-grid{grid-template-columns:1fr}.folder-grid{gap:10px;margin-top:28px}.folder-card{padding:17px 11px 12px;min-height:143px}.folder-card strong{font-size:11px}.folder-card .icon{width:20px;height:20px;margin-bottom:12px}.folder-card small{font-size:7px}.file-index{min-width:115px;max-width:170px;flex:0 0 134px}.welcome-strip{padding:13px;gap:9px;font-size:10px}.welcome-strip button{flex:none;font-size:10px}.form-grid{grid-template-columns:1fr}.form-grid .full{grid-column:auto}input:not([type=checkbox]),select,textarea{font-size:16px!important}.paper{padding:16px}.fact-grid{grid-template-columns:1fr}.fact-grid .wide{grid-column:auto}.event-body{padding-left:0}.event-row>summary{gap:8px}.paper-toolbar{align-items:flex-start}.paper-toolbar .buttons{justify-content:flex-end}.metric-row{gap:7px}.metric{padding:12px}.metric strong{font-size:19px}h1{font-size:23px}}\n@media(prefers-reduced-motion:reduce){*{transition:none!important}}\n/* v0.5 — calm controls, readable editors, complete light/dark surfaces */\n:host{--im-ink:#37354a;--im-muted:#757086;--im-line:#e4e1ed;--im-paper:#fff;--im-canvas:#f5f4fa;--im-soft:#efedf8;--im-accent:#7770b8;--im-accent-hover:#665da6;--im-accent-active:#554c92;--im-field:#faf9fd;--im-field-border:#ded9e9;--im-subtle:#f4f2f9;--im-selected:#eae6f7;color:var(--im-ink);color-scheme:light}\n:host([data-theme=dark]){--im-ink:#e8e5f2;--im-muted:#afa8c1;--im-line:#3b354b;--im-paper:#252130;--im-canvas:#1c1925;--im-soft:#393246;--im-accent:#aaa0e3;--im-accent-hover:#bcb2f1;--im-accent-active:#c9c0f8;--im-field:#211d2a;--im-field-border:#4a425d;--im-subtle:#2d273a;--im-selected:#3e3456;color-scheme:dark}\nbutton{font-weight:550;transition:background-color .16s,border-color .16s,color .16s,box-shadow .16s; -webkit-tap-highlight-color:transparent;touch-action:manipulation}\nbutton:not(:disabled):hover{background-color:var(--im-selected);border-color:#b8aed5;color:var(--im-ink);box-shadow:0 2px 7px #5a487512}\nbutton:not(:disabled):active{background-color:var(--im-soft);border-color:var(--im-accent);box-shadow:inset 0 1px 3px #30233d25;color:var(--im-accent-active)}\nbutton:disabled{opacity:.48;box-shadow:none}\n.primary:not(:disabled):hover{background:var(--im-accent-hover)!important;border-color:var(--im-accent-hover)!important;color:#fff!important;box-shadow:0 4px 12px #5d4e9c30}\n.primary:not(:disabled):active{background:var(--im-accent-active)!important;border-color:var(--im-accent-active)!important;box-shadow:inset 0 2px 5px #28194336}\n:host([data-theme=dark]) .primary{color:#20192f!important}\n:host([data-theme=dark]) .primary:not(:disabled):hover{color:#20192f!important}\nbutton:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--im-accent);outline-offset:3px}\nnav button{color:var(--im-muted)}nav button.selected{background:var(--im-selected);color:var(--im-accent)}nav button:not(:disabled):active{background:var(--im-soft)}\n.side-bottom button{background:var(--im-subtle)}.side-bottom small,.brand small,.nav-label,.eyebrow,.crumb,#status{color:var(--im-muted)}.crumb b{color:var(--im-ink)}\n.topbar{gap:10px}.global-search{background:var(--im-paper);border-color:var(--im-line)}.global-search button:not(:disabled):hover{background:var(--im-accent-hover);color:#fff}.close{color:var(--im-muted)}\n.theme-toggle{border:1px solid var(--im-line);background:var(--im-paper);color:var(--im-accent);width:34px;height:34px;flex:none;padding:0;display:grid;place-items:center;font:22px/1 system-ui;border-radius:11px}\n#launch:hover{background:var(--im-accent-hover);color:#fff}#launch:active{background:var(--im-accent-active);color:#fff}\n.intro,.paper .hint,.ghost,.empty,details>summary,.room-label{color:var(--im-muted)}.intro{font-size:12px}.paper{border-color:var(--im-line)}\n.note{background:var(--im-soft);border-color:var(--im-line);color:var(--im-muted)}\nlabel{color:var(--im-muted)}input:not([type=checkbox]),textarea,select{background:var(--im-field);border-color:var(--im-field-border);color:var(--im-ink)}input::placeholder,textarea::placeholder{color:var(--im-muted);opacity:.85}\ninput[type=checkbox]{appearance:none;-webkit-appearance:none;display:inline-block;width:38px;height:22px;min-width:38px;flex:none;border:1px solid #bdb6cb;border-radius:30px;background:#d4cfdf;position:relative;vertical-align:middle;cursor:pointer;margin:0;transition:background-color .18s,border-color .18s;outline-offset:4px}\ninput[type=checkbox]:before{content:\"\";position:absolute;width:16px;height:16px;top:2px;left:2px;border-radius:50%;background:#fff;box-shadow:0 1px 3px #30293d30;transition:transform .18s}\ninput[type=checkbox]:checked{background:var(--im-accent);border-color:var(--im-accent)}input[type=checkbox]:checked:before{transform:translateX(16px)}input[type=checkbox]:hover{border-color:var(--im-accent);box-shadow:0 0 0 3px #9486bd1c}input[type=checkbox]:active:before{width:18px}input[type=checkbox]:checked:active:before{transform:translateX(14px)}\n:host([data-theme=dark]) input[type=checkbox]{background:#4a435a;border-color:#6c627d}:host([data-theme=dark]) input[type=checkbox]:checked{background:var(--im-accent);border-color:var(--im-accent)}\n.setting-switch,.check-row{border-color:var(--im-line)}.setting-switch{gap:20px}.setting-switch input{align-self:center}.check-row{align-items:flex-start;gap:13px}.check-row input{margin-top:3px}.check-row b{color:var(--im-ink)}\n.room-switch{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;font-size:10px;margin:0}.room-switch input{width:34px;min-width:34px;height:20px}.room-switch input:before{width:14px;height:14px}.room-switch input:checked:before{transform:translateX(14px)}\n.folder-card{background:var(--im-paper)}.folder-card:not(:disabled):hover{transform:none;background:var(--im-soft)}.folder-card.purple:not(:disabled):hover{background:#6c64b3;color:#fff}.folder-card.cream:not(:disabled):hover{background:#e5dccb;color:#554a37}.folder-card:not(:disabled):active{box-shadow:inset 0 2px 6px #30233d20}.folder-card.purple:active{background:#5c549f!important}\n.file-index:not(:disabled):hover{background-color:#d8d1be;color:#4e5044;border-color:transparent;box-shadow:-4px 0 13px #28202b2e}.file-index.is-current:not(:disabled):hover{background-color:#726aab;color:#fff}.file-index:not(:disabled):active{filter:brightness(.92);color:inherit}\n.welcome-strip{background:var(--im-paper);color:var(--im-muted)}.welcome-strip b{color:var(--im-ink)}.metric{background:var(--im-paper)}.metric strong{color:var(--im-accent)}\n.event-row,#records>article{border-color:var(--im-line)}.event-no,.fact-grid label,.rail-footer{color:var(--im-muted)}.fact-grid p,.quote-card blockquote,#records>article>p{color:var(--im-ink)}.event-row>summary:hover{background:var(--im-soft);border-radius:9px}.event-row>summary{transition:background .15s}\n#eventEditor article,pre{background:var(--im-field);border-color:var(--im-line);color:var(--im-ink)}.range-preview{border-color:var(--im-line)}.range-preview .snippet{color:var(--im-muted)}\n.rail-stat{background:var(--im-subtle)}.rail-stat b{border-color:var(--im-field-border);color:var(--im-accent)}.rail-stat small,.rail-note p{color:var(--im-muted)}.rail-divider{background:var(--im-line)}\n.editor-grid{grid-template-columns:1fr;gap:22px}.memory-editor{padding:0;overflow:hidden;border:1px solid var(--im-line);border-radius:18px;box-shadow:0 4px 18px #42325606}.editor-heading{display:flex;align-items:center;gap:13px;padding:23px 24px 18px}.editor-number{display:grid;place-items:center;width:37px;height:37px;flex:none;border-radius:12px;background:var(--im-soft);color:var(--im-accent);font:12px ui-monospace,monospace}.editor-heading>div{min-width:0;flex:1}.editor-heading h2{font-size:16px;margin:0 0 4px;color:var(--im-ink)}.editor-heading .hint{margin:0;font-size:12px;line-height:1.7}.editor-heading .pill{font-size:9px;background:var(--im-soft);color:var(--im-accent)}.editor-surface{margin:0 24px;border:1px solid var(--im-field-border);border-radius:12px;background:var(--im-field);overflow:hidden}.editor-surface:focus-within{border-color:var(--im-accent);box-shadow:0 0 0 3px #9686c017}.editor-surface textarea{display:block;min-height:320px;max-height:70vh;border:0!important;border-radius:0;background:transparent;padding:20px 22px;color:var(--im-ink);font-size:14px;line-height:2;letter-spacing:.02em;word-break:normal;overflow-wrap:anywhere;tab-size:2;resize:vertical}.editor-surface textarea:focus-visible{outline:0}.editor-meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 25px 18px;font-size:10px;color:var(--im-muted)}.editor-actions{align-items:center;margin:23px 0 15px}.editor-actions small{flex-basis:100%}\n:host([data-theme=dark]) #backdrop{background:#0c0913a8}:host([data-theme=dark]) #panel{box-shadow:0 24px 100px #0008}:host([data-theme=dark]) #error{background:#49302e;color:#ffc4ad}\n:host([data-theme=dark]) .folder-card.cream{background:#453e33;color:#e4d6bc}:host([data-theme=dark]) .folder-card.cream:hover{background:#514734;color:#f3e4c8}:host([data-theme=dark]) .folder-card.purple{background:#62568f}\n:host([data-theme=dark]) .pill.neutral{background:#393342;color:#bcb3cc}:host([data-theme=dark]) .pill.green{background:#293d37;color:#aed5bd}:host([data-theme=dark]) .pill{background:var(--im-soft);color:var(--im-accent)}\n:host([data-theme=dark]) .file-index{background-color:#6a6252;color:#f0e7d6}:host([data-theme=dark]) .file-index:nth-child(4n+2){background-color:#515b6b;color:#e3e9f1}:host([data-theme=dark]) .file-index:nth-child(4n+3){background-color:#725d49;color:#f1e3d2}:host([data-theme=dark]) .file-index:nth-child(4n+4){background-color:#4f6457;color:#e2ede5}:host([data-theme=dark]) .file-index.is-current{background-color:#6f6099;color:#fff}:host([data-theme=dark]) .file-index:hover{filter:brightness(1.12)}\n:host([data-theme=dark]) .rail-folder{background:linear-gradient(135deg,#393149,#30293e);color:#a99ac6}:host([data-theme=dark]) .rail-folder:before{background:#393149}\n@media(max-width:720px){.topbar{gap:7px}.crumb{max-width:34%;line-height:1.7}.global-search{flex:1;width:auto;min-width:0}.theme-toggle{width:30px;height:30px;font-size:20px;border-radius:9px}.close{padding:4px}.editor-heading{padding:18px 16px 14px;gap:10px;flex-wrap:wrap}.editor-heading h2{font-size:15px}.editor-heading .hint{font-size:11px}.editor-heading .pill{margin-left:47px}.editor-surface{margin:0 14px}.editor-surface textarea{padding:16px;min-height:300px;line-height:1.95}.editor-meta{padding:12px 16px 16px;display:grid;gap:4px}.memory-editor{padding:0}.editor-grid{gap:16px}.room-switch{display:none}}\n\n/* v0.5.1 — namespaced colors isolate the host theme; filled hover states. */\n:host{--im-ink:#302c40;--im-muted:#655e75;--im-line:#d8d2e4;--im-accent:#6b5aa8;--im-accent-hover:#584591;--im-accent-active:#483578;--im-field-border:#c9bfdc;--im-button-hover:#ddd4f1;--im-button-active:#c9bce7}\n:host([data-theme=dark]){--im-ink:#f0ebfa;--im-muted:#c4bcd5;--im-line:#51465f;--im-accent:#b8a7ed;--im-accent-hover:#cebcff;--im-accent-active:#dfd0ff;--im-field-border:#6b5b80;--im-button-hover:#594774;--im-button-active:#70558d}\n#panel{color:var(--im-ink)}\nbutton{color:var(--im-ink)}\nbutton:not(:disabled):hover{background:var(--im-button-hover);border-color:var(--im-accent);color:var(--im-ink);box-shadow:0 2px 8px #3b255218}\nbutton:not(:disabled):active{background:var(--im-button-active);border-color:var(--im-accent);color:var(--im-ink);box-shadow:inset 0 2px 4px #25153525}\n.primary:not(:disabled):hover{background:var(--im-accent-hover)!important;color:#fff!important}.primary:not(:disabled):active{background:var(--im-accent-active)!important;color:#fff!important}\n:host([data-theme=dark]) .primary,:host([data-theme=dark]) .primary:not(:disabled):hover,:host([data-theme=dark]) .primary:not(:disabled):active{color:#21172f!important}\nnav button.selected{color:var(--im-accent);background:var(--im-selected)}nav button:not(:disabled):hover,nav button.selected:not(:disabled):hover{background:var(--im-button-hover);color:var(--im-ink)}nav button:not(:disabled):active{background:var(--im-button-active);color:var(--im-ink)}\n.side-bottom button:not(:disabled):hover,.ghost:not(:disabled):hover,.close:not(:disabled):hover,.theme-toggle:not(:disabled):hover{background:var(--im-button-hover);color:var(--im-ink)}\n.file-index:not(:disabled):hover,.folder-card:not(:disabled):hover,.folder-card.cream:not(:disabled):hover{background:var(--im-button-hover);color:var(--im-ink)}.file-index.is-current:not(:disabled):hover,.folder-card.purple:not(:disabled):hover{background:var(--im-accent-hover);color:#fff}\n.file-index:not(:disabled):active,.folder-card:not(:disabled):active{background:var(--im-button-active)!important;color:var(--im-ink);filter:none}\n:host([data-theme=dark]) .file-index:not(:disabled):hover,:host([data-theme=dark]) .folder-card.cream:not(:disabled):hover{background:var(--im-button-hover);color:var(--im-ink);filter:none}\n:host([data-theme=dark]) .file-index.is-current:not(:disabled):hover{background:#8570b3;color:#fff}\n.brand{color:var(--im-accent)}.pill{color:var(--im-accent)}.pill.neutral{color:var(--im-muted)}.rail-stat small,.rail-footer,.rail-note p{color:var(--im-muted)}.folder-card small{opacity:.85}.folder-card span:last-child{opacity:.9}.file-code{opacity:.9}.file-index .file-spine{opacity:.75}\ninput::placeholder,textarea::placeholder{color:var(--im-muted);opacity:1}.global-search input::placeholder{color:var(--im-muted)}\n.overview-tabs{display:flex;gap:6px;padding:5px;margin:0 0 16px;background:var(--im-soft);border:1px solid var(--im-line);border-radius:13px;flex:none}\n.overview-tabs button{flex:1;background:transparent;border:1px solid transparent;border-radius:9px;padding:10px 14px;color:var(--im-muted);font-size:12px;white-space:nowrap}\n.overview-tabs button[aria-selected=true]{background:var(--im-paper);border-color:var(--im-field-border);color:var(--im-ink);box-shadow:0 2px 5px #2515350d;font-weight:700}\n.overview-tabs button:not(:disabled):hover{background:var(--im-button-hover);color:var(--im-ink)}.overview-tabs button:not(:disabled):active{background:var(--im-button-active)}\n#content.overview-page{display:flex;flex-direction:column;overflow:hidden}.overview-page .eyebrow{margin-top:0}.overview-page h1{flex:none}.overview-page>.intro{margin:0 0 14px;flex:none}.overview-page .editor-grid{display:flex;flex-direction:column;flex:1;min-height:0;gap:0}.overview-page .memory-editor{display:flex;flex-direction:column;flex:1;min-height:0;margin:0}.overview-page .editor-heading{padding:16px 20px 12px;flex:none}.overview-page .editor-surface{flex:1;min-height:60px;margin:0 20px}.overview-page .editor-surface textarea{min-height:0;max-height:none;height:100%;resize:none}.overview-page .editor-meta{flex:none;padding:10px 21px 12px}.overview-page .editor-actions{flex:none;margin:13px 0 8px;gap:8px}.overview-page>.note{font-size:10px;padding:9px 12px;flex:none}.overview-page .editor-actions small{font-size:10px}\n@media(max-width:720px){.overview-tabs{gap:4px;padding:4px;margin-bottom:12px}.overview-tabs button{font-size:11px;padding:9px 5px}.overview-page .editor-heading{padding:13px 14px 9px;flex-wrap:nowrap;gap:9px}.overview-page .editor-heading h2{font-size:13px}.overview-page .editor-heading .hint{font-size:10px}.overview-page .editor-heading .pill{display:none}.overview-page .editor-surface{margin:0 12px}.overview-page .editor-surface textarea{padding:13px}.overview-page .editor-meta{padding:8px 14px 10px;font-size:9px;display:flex;gap:4px}.overview-page .editor-actions button{font-size:11px;padding:9px 10px}.overview-page .editor-actions small{font-size:9px}.overview-page>.note{font-size:9px;padding:8px 10px}.overview-page>.intro{font-size:11px}.overview-page h1{font-size:22px;margin-bottom:7px}.overview-page .eyebrow{font-size:8px;margin-bottom:5px}}\n@media(max-height:650px){#content.overview-page{overflow:auto}.overview-page .editor-grid{min-height:240px}}\n/* v0.6 — room identity, scoped library picker, icon-only launcher */\n#launch{width:50px;height:50px;padding:0;display:grid;place-items:center;border-radius:17px;background:#6b5aa8;color:#fff;border:1px solid #ffffff36;box-shadow:0 5px 16px #3f30552b;right:22px;bottom:124px}\n#launch .icon{width:26px;height:26px;stroke-width:1.55}#launch:not(:disabled):hover{background:#55418f;color:#fff;border-color:#ffffff65;box-shadow:0 7px 20px #40305d40}#launch:not(:disabled):active{background:#463575;color:#fff}\n:host([data-theme=dark]) #launch{background:#a68ed9;color:#211630;border-color:#cfc0ec55}:host([data-theme=dark]) #launch:hover{background:#bda4ee;color:#211630}\n.topbar{align-items:center;min-height:100px}.crumb{min-width:0;flex:1}.room-picker{position:relative;min-width:0}#roomButton{display:flex;align-items:center;gap:6px;max-width:100%;padding:5px 7px;margin-left:-7px;border:1px solid transparent;background:transparent;color:var(--im-ink);font-size:13px;font-weight:700;text-align:left;line-height:1.5}#roomButton #room{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}#roomButton .icon{width:14px;height:14px;color:var(--im-muted)}#roomButton:not(:disabled):hover{background:var(--im-button-hover);border-color:var(--im-field-border)}.room-stats{display:block;font-size:10px;color:var(--im-muted);padding-top:2px}.room-page{display:flex;align-items:center;gap:9px;margin-top:5px;font-size:10px}.room-page #roomContext{font-size:9px;color:var(--im-accent)}.room-menu{position:absolute;left:-7px;top:calc(100% + 12px);width:360px;max-width:calc(100vw - 50px);max-height:65vh;overflow:auto;background:var(--im-paper);border:1px solid var(--im-field-border);box-shadow:0 12px 35px #160d2933;border-radius:15px;padding:13px;z-index:20}.room-search-label{margin:0 0 9px;font-size:10px}.room-search-label input{font-size:12px!important;margin-top:5px}#roomOptions{display:grid;gap:3px}.room-option,.room-current{display:flex;align-items:center;justify-content:space-between;gap:9px;width:100%;text-align:left;padding:10px;border:0;border-radius:9px;background:transparent}.room-option>span:first-child{display:flex;gap:10px;align-items:center;min-width:0}.room-option b{display:block;font-size:12px;font-weight:600;white-space:normal;overflow-wrap:anywhere}.room-option small{display:block;font-size:9px;margin-top:3px}.room-option .icon{width:17px;height:17px;color:var(--im-accent)}.room-option.selected{background:var(--im-selected)}.room-check{color:var(--im-accent)}.room-current{justify-content:flex-start;font-size:11px;background:var(--im-subtle)}.room-menu-label{font-size:9px;color:var(--im-muted);padding:10px 6px 5px}.room-menu-help{font-size:9px;color:var(--im-muted);margin:10px 5px 0;padding-top:10px;border-top:1px solid var(--im-line)}\n@media(max-width:720px){.topbar{flex-wrap:wrap;gap:7px;padding-top:9px;padding-bottom:8px}.crumb{max-width:none;flex-basis:100%;display:flex;align-items:center;justify-content:space-between;gap:9px}.room-picker{flex:1;min-width:0}.room-page{flex:none;max-width:35%;display:block;text-align:right;margin:0}.room-page b{font-size:9px}.room-page #roomContext{display:block;font-size:8px}#roomButton{font-size:12px}.room-stats{font-size:9px}.global-search{max-width:none;width:auto}.room-menu{width:340px;max-width:calc(100vw - 36px);left:0;max-height:60vh}.room-search-label input{font-size:16px!important}#launch{width:46px;height:46px;border-radius:15px;right:17px;bottom:115px}#launch .icon{width:24px;height:24px}}\n.auto-organize{border-color:var(--im-field-border);background:var(--im-paper)}.auto-organize .paper-toolbar h3{margin:8px 0}.auto-organize .paper-toolbar>.icon{width:28px;height:28px;color:var(--im-accent)}.organize-progress{padding:14px;background:var(--im-soft);border-radius:12px;margin:12px 0}.organize-progress>div{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:var(--im-ink)}.organize-progress progress{display:block;width:100%;height:8px;margin:13px 0 16px;accent-color:var(--im-accent);border:0;border-radius:20px;overflow:hidden;background:var(--im-line)}.organize-progress progress::-webkit-progress-bar{background:var(--im-line)}.organize-progress progress::-webkit-progress-value{background:var(--im-accent);border-radius:20px}.organize-progress button{font-size:11px}.manual-range>summary{font-size:12px;font-weight:650;color:var(--im-ink)}\n.quote-review-panel{border:1px solid var(--im-field-border);background:var(--im-soft);padding:16px;border-radius:13px;margin-bottom:20px}.quote-review-panel h3{margin-top:0}.quote-review-panel .hint{font-size:11px;color:var(--im-muted)}.quote-review{border-top:1px solid var(--im-line);padding:6px 0}.quote-review summary{color:var(--im-ink);overflow-wrap:anywhere}.quote-review blockquote{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.review-source pre{max-height:230px;overflow:auto;font-size:11px}.review-notice{width:100%;text-align:left;font-size:10px;margin-bottom:10px;background:var(--im-soft)}\n.review-source pre{font-family:inherit;line-height:1.85}\n.repair-summary{font-size:10px;line-height:1.8;color:var(--im-muted);background:var(--im-soft);padding:10px;border-radius:10px;margin:0 0 15px}\n/* Independent overlay surface: the host itself never blocks the app. */\n:host{position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:block;visibility:visible;opacity:1}\n#launch,#panel,#backdrop{pointer-events:auto}#launch{display:grid!important;visibility:visible!important;opacity:1!important;touch-action:manipulation;user-select:none;-webkit-user-select:none}\n.person-chips{display:flex;gap:7px;flex-wrap:wrap;max-height:180px;overflow:auto;padding:5px 0;margin:16px 0}.person-chips button{display:flex;align-items:center;gap:6px;font-size:12px;padding:8px 12px}.person-chips button.selected{background:var(--im-selected);border-color:var(--im-accent);color:var(--im-accent)}.person-chips .icon{width:16px;height:16px}.person-profile .paper-toolbar h2{margin:8px 0 0;font-size:20px}.person-fact{border-bottom:1px solid var(--im-line);padding:10px 0}.person-fact p{font-size:12px;white-space:pre-wrap}.people-hint{font-size:11px;color:var(--im-muted)}\n.file-time{display:block;font-size:9px;line-height:1.5;margin:5px 0;max-height:27px;overflow:hidden;opacity:.9}.file-index{min-height:244px}.file-index h3{margin-top:15px;margin-bottom:8px}.file-index .barcode{margin-top:9px}.timeline-card{display:grid;grid-template-columns:165px minmax(0,1fr);gap:18px;margin:15px 0;border:1px solid var(--im-line);border-radius:14px;background:var(--im-paper);padding:18px}.timeline-stamp{color:var(--im-accent);font-size:12px;line-height:1.8}.timeline-stamp .icon{width:15px;height:15px;display:block;margin-bottom:8px}.timeline-stamp small{display:block}.timeline-content{min-width:0}.timeline-content h3{margin:9px 0;font-size:13px}.timeline-content blockquote{margin:10px 0;padding:6px 13px;border-left:2px solid var(--im-accent);font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}.timeline-content .hint{font-size:10px;color:var(--im-muted)}\n@media(max-width:720px){.timeline-card{grid-template-columns:1fr;gap:9px;padding:15px}.timeline-stamp{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.timeline-stamp .icon{margin:0;display:inline-block}.timeline-stamp small{font-size:9px}.file-index{min-height:245px}}\n\n/* v0.7.5: mobile header controls and movable launcher */\n#themeToggle{font:inherit}#themeToggle .icon{width:20px;height:20px}\n#close{width:44px;height:44px;display:grid;place-items:center;flex:none;padding:0;border-radius:12px}\n#launch{touch-action:none;cursor:grab;-webkit-touch-callout:none;transition:background .15s,box-shadow .15s}\n#launch.dragging{cursor:grabbing;box-shadow:0 9px 28px #30204766;transition:none}\n@media(max-width:720px){\n .sidebar{padding-top:calc(8px + env(safe-area-inset-top,0px))}\n .brand{min-height:44px;padding-right:110px;padding-bottom:8px}\n #close,#themeToggle{position:absolute;top:calc(8px + env(safe-area-inset-top,0px));z-index:30;width:44px;height:44px;border:1px solid var(--im-line);background:var(--im-paper);border-radius:12px}\n #close{right:14px}#themeToggle{right:66px}\n #close:hover,#themeToggle:hover{background:var(--im-button-hover)}\n .topbar .global-search{width:100%;max-width:none;flex-basis:100%}\n #content{padding-bottom:calc(25px + env(safe-area-inset-bottom,0px))}\n}\n\n.profile-field{padding:14px 16px;margin:12px 0;border:1px solid var(--im-line);border-radius:14px;background:var(--im-field);}\n.profile-field h4{margin:0 0 8px;color:var(--im-accent);font-size:14px;}\n.profile-field p{margin:6px 0;line-height:1.75;white-space:pre-wrap;overflow-wrap:anywhere;}\n.identity-editor{margin:20px 0;padding:16px;border:1px solid var(--im-line);border-radius:14px;}\n.selection-toolbar{padding-bottom:18px;margin-bottom:18px;border-bottom:1px solid var(--im-line);}\n.memory-select{margin:0 0 14px;}\n\n/* v0.9.13: complete chapter index and readable saved-memory cards. */\n.file-shelf.chapter-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,210px),1fr));gap:28px 20px;overflow:visible;padding:18px 4px 25px;min-height:0}\n.chapter-grid .file-index{display:flex;flex-direction:column;width:100%;min-width:0;max-width:none;margin:0;flex:none;min-height:250px;padding:22px 16px 20px 30px}\n.chapter-grid .file-index h3{display:block;-webkit-line-clamp:unset;overflow:visible;font-size:15px;line-height:1.65;margin:16px 0 10px}\n.chapter-grid .file-time{max-height:none;overflow:visible;overflow-wrap:anywhere;margin:6px 0 16px}\n.chapter-grid .file-index .file-foot{position:static;margin-top:auto;gap:8px;flex-wrap:wrap;width:100%;line-height:1.6}\n.chapter-grid .barcode{margin-bottom:16px}.chapter-navigation{scroll-margin-top:16px}#chapterDetail{scroll-margin-top:16px}\n#records>article.memory-card{padding:18px;margin:14px 0;border:1px solid var(--im-line);border-radius:15px;background:var(--im-paper)}\n.memory-card-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.memory-card .memory-select{margin-left:auto;padding:0;border:0;gap:10px}.memory-card .memory-select span{font-size:10px;color:var(--im-muted)}\n.memory-details>summary{list-style:none;border-radius:10px;padding:15px 0 0;color:var(--im-ink)}.memory-details>summary::-webkit-details-marker{display:none}.memory-details>summary:hover{background:var(--im-soft)}\n.memory-details h3{font-size:14px;line-height:1.8;font-weight:600;margin:0 0 8px;overflow-wrap:anywhere}.memory-details summary small{display:block;color:var(--im-muted);font-size:11px;line-height:1.7}.memory-expand{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--im-accent);margin-top:12px}.memory-expand .icon{width:13px;height:13px}.memory-details[open]>summary .memory-expand .icon{transform:rotate(180deg)}\n.memory-full{border-top:1px solid var(--im-line);margin-top:14px;padding-top:8px}.memory-full>p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.9;font-size:13px;color:var(--im-ink)}.memory-full small{font-size:10px;color:var(--im-muted)}.memory-options{margin-top:15px;border-top:1px solid var(--im-line)}.memory-options summary{font-size:11px}.memory-options .hint{overflow-wrap:anywhere}\n@media(max-width:720px){.file-shelf.chapter-grid{grid-template-columns:repeat(auto-fill,minmax(min(100%,150px),1fr));gap:26px 12px}.chapter-grid .file-index{min-height:250px;padding:20px 12px 16px 25px}.chapter-grid .file-index h3{font-size:14px}.chapter-grid .file-code{font-size:8px;letter-spacing:.7px}#records>article.memory-card{padding:14px}.memory-card .memory-select span{font-size:9px}.memory-card-top{gap:6px}.memory-details h3{font-size:14px}}\n\n.paper-toolbar>button{flex-shrink:0;white-space:nowrap}.event-narrative{border-bottom:1px solid var(--im-line);padding:0 0 16px;margin:0 0 16px}.event-narrative h4{font-size:11px;color:var(--im-accent);margin:10px 0}.event-narrative p{font-size:13px;line-height:1.9;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--im-ink)}\n\n.chapter-page-toolbar{flex-wrap:wrap}.chapter-page-toolbar>.buttons{max-width:100%;justify-content:flex-start}\n\n#diagnosticCopyText{min-height:260px;max-height:55vh;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;line-height:1.6;white-space:pre;overflow:auto;resize:vertical;}\n\n.memory-link-section{margin:18px 0;padding:14px 0;border-top:1px solid var(--im-line)}.memory-link-section h4{font-size:12px;color:var(--im-accent)}.memory-link-section p{display:grid;gap:5px;line-height:1.7}.memory-link{color:var(--im-accent);text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}.memory-link:hover{color:var(--im-ink)}.memory-link-section small,.memory-link-section span{font-size:12px}\n\n.continuous-events{border:1px solid var(--im-line);border-radius:18px;padding:18px;margin:18px 0;background:var(--im-paper)}\n.continuous-events>summary{display:flex;flex-wrap:wrap;gap:12px;align-items:center;cursor:pointer;padding:12px}\n.continuous-events>summary span,.memory-link-badge{color:var(--im-accent);font-size:.85rem}\n.continuous-events .memory-card{margin:12px 0}\n.timeline-content .event-narrative{margin:16px 0;line-height:1.85;white-space:normal}\n@media(max-width:640px){.continuous-events{padding:10px}.timeline-content .quote-card{padding:12px}}\n\n/* Chapter continuity facts share the existing theme and button behavior. */\n.chapter-details{margin:1.25rem 0;padding:1rem;border:1px solid var(--im-line);border-radius:14px}\n.chapter-fact{padding:.75rem 0;border-bottom:1px solid var(--im-line)}\n.chapter-fact:last-of-type{border-bottom:0}\n.chapter-fact p{line-height:1.75;overflow-wrap:anywhere;white-space:pre-wrap}\n.chapter-details nav{margin-top:1rem;gap:.75rem;flex-wrap:wrap}\n\n/* Local and model diagnostics stay reachable above the scrolling tab content. */\n.error-diagnostics{margin:0 28px 12px;max-height:35vh;overflow:auto;flex-shrink:0;min-width:0}.error-diagnostics .buttons{margin:0;flex-wrap:wrap}.error-diagnostics textarea{width:100%;box-sizing:border-box;min-height:100px;max-height:22vh;white-space:pre-wrap;overflow:auto}@media(max-width:720px){.error-diagnostics{margin-left:18px;margin-right:18px}}\n\n/* Links between records: soft chips and rows instead of underlined text. */\na.record-link{text-decoration:none;color:inherit;cursor:pointer;transition:background .15s,border-color .15s,transform .15s}\n.record-links{display:flex;flex-wrap:wrap;gap:8px 14px;margin:6px 0 12px}\n.chip-wrap{display:inline-flex;align-items:center;gap:6px;max-width:100%;min-width:0}\n.chip-title{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}\n.record-links+.hint,.world-card .record-links{margin-top:4px}\n@media(max-width:720px){.record-links{flex-direction:column;align-items:stretch}.record-links .chip-wrap{display:flex;width:100%}.record-links a.chip{flex:1 1 auto;min-width:0}.record-links .chip-wrap small{flex:none}}\n.chip-wrap small{font-size:10px;color:var(--im-muted)}\na.chip{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:4px 8px 4px 5px;border-radius:999px;background:var(--im-soft);color:var(--im-accent);font-size:11px;font-weight:600;border:1px solid transparent}\na.chip:hover{background:var(--im-button-hover);border-color:var(--im-field-border)}\n.chip-id{font:9px ui-monospace,monospace;padding:2px 6px;border-radius:999px;background:var(--im-paper);color:var(--im-muted);font-weight:400}\n.chip-arrow{font-size:14px;line-height:1;opacity:.55}\n.record-list{display:flex;flex-direction:column;gap:6px;margin:4px 0 18px}\na.record-row{display:flex;align-items:center;gap:12px;padding:11px 14px;border:1px solid var(--im-line);border-radius:12px;background:var(--im-paper)}\na.record-row:hover{background:var(--im-soft);border-color:var(--im-field-border);transform:translateX(2px)}\na.record-row .pill{flex:none;min-width:38px;justify-content:center}\n.row-main{min-width:0;flex:1}\n.row-main b{display:block;font-size:12px;font-weight:600;line-height:1.6;color:var(--im-ink);overflow-wrap:anywhere}\n.row-main small{display:block;margin-top:2px;font-size:10px}\na.record-row .chip-arrow{color:var(--im-accent)}\n.is-focus{border-radius:12px;box-shadow:0 0 0 2px var(--im-accent);animation:focus-fade 2.4s ease-out forwards}\n@keyframes focus-fade{0%{box-shadow:0 0 0 2px var(--im-accent),0 0 0 8px var(--im-soft)}70%{box-shadow:0 0 0 2px var(--im-accent)}100%{box-shadow:0 0 0 0 transparent}}\n\n/* Chapters: a scrolling row of chips above the scene shelf. */\n.chapter-bar{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 12px;margin:0 0 6px;scrollbar-width:thin}\n.chapter-chip{flex:none;display:inline-flex;align-items:center;gap:7px;max-width:240px;padding:6px 12px 6px 6px;border-radius:999px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--im-paper)}\n.chapter-chip.is-selected{background:var(--im-accent);border-color:var(--im-accent);color:#fff}\n.chapter-chip.is-selected .chip-id{background:#ffffff33;color:#fff}\n.chapter-paper{margin-top:4px}\n:host([data-theme=dark]) .chapter-chip.is-selected{color:#211a30}:host([data-theme=dark]) .chapter-chip.is-selected .chip-id{color:#211a30;background:#ffffff55}\n\n/* Daily life rows: what · when · what exactly · flags · buttons, wrapping on a phone. */\n/* 인물·장소 cards. */\n.world-card{border-top:1px solid var(--im-line);padding:12px 0}\n.world-card h3{margin:0 0 6px}\n.world-field{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:4px 0}\n.world-field>span{flex:0 0 64px;font-size:11px}\n.world-field input{flex:1 1 200px;width:auto}\n.world-field button{padding:7px 12px;font-size:11px}\n.routine-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--im-line)}\n.routine-row:last-child{border-bottom:0}\n.routine-row select{width:auto;flex:0 0 92px}\n.routine-row input[type=datetime-local]{width:auto;flex:0 0 200px}\n.routine-row input[data-f=text]{flex:1 1 200px;width:auto}\n.routine-row.routine-new{border-bottom:0;padding-bottom:0}\n.routine-row.routine-new input[data-f=who]{flex:0 0 160px;width:auto}\n.routine-row .mini{display:inline-flex;align-items:center;margin:0;font-size:11px;white-space:nowrap}\n.routine-row button{padding:7px 12px;font-size:11px}\ndetails.paper>summary{font-size:13px;font-weight:600;color:var(--im-ink)}\n.routine-row .warn{flex-basis:100%;color:#b0623f}:host([data-theme=dark]) .routine-row .warn{color:#ffb08a}\n\n\n.counts{border-collapse:collapse;margin:8px 0;font-size:12px}.counts th{text-align:left;font-weight:500;padding:3px 16px 3px 0;color:var(--im-ink)}.counts td{padding:3px 0}\n.warn{color:#b0623f}:host([data-theme=dark]) .warn{color:#ffb08a}\n/* 아는 사람·모르는 사람, 기록 충돌, 소중한 물건. */\n.know-chips{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:4px 0 8px;font-size:11px}\n.know-label{font-size:10px;color:var(--im-muted)}\n.kchip{padding:2px 9px;border-radius:999px;background:var(--im-soft);border:1px solid var(--im-line);font-size:11px}\n.kchip.is-unknown{color:#b0623f}:host([data-theme=dark]) .kchip.is-unknown{color:#ffb08a}\n.conflict-row{border-top:1px solid var(--im-line);padding:12px 0}\n.conflict-head{margin:0 0 6px;font-size:12px;font-weight:600}\n.conflict-pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}\n.conflict-pair>div{background:var(--im-soft);border-radius:10px;padding:8px 10px}\n.conflict-pair small{display:block;font-size:10px;color:var(--im-muted)}\n.conflict-pair p{margin:4px 0 0;font-size:12px;white-space:pre-wrap}\n.world-field select{flex:0 1 160px;width:auto}\n@media(max-width:720px){.conflict-pair{grid-template-columns:1fr}}\n\n/* 패널은 보이는 화면 안에서만 자라고, 스크롤은 #content 하나만 합니다 (끝까지 내려도 잘리지 않게). */\n.workspace{overflow:hidden}.inspector{min-height:0}\n.resize-edge,.resize-grip{display:none}\n@media(min-width:721px){\n  #panel{grid-template-rows:minmax(0,1fr);max-width:100vw;max-height:calc(100vh - 16px);max-height:calc(100dvh - 16px)}\n  .sidebar{min-height:0;overflow:auto}\n  .topbar{cursor:move;user-select:none;-webkit-user-select:none;touch-action:none}\n  .topbar :is(button,select,input,label,a,.room-menu){cursor:auto;user-select:auto;-webkit-user-select:auto}\n  .topbar button{cursor:pointer}\n  .resize-edge,.resize-grip{display:block;position:absolute;z-index:30;touch-action:none}\n  .resize-r{top:26px;right:0;bottom:26px;width:6px;cursor:ew-resize}\n  .resize-b{left:26px;right:26px;bottom:0;height:6px;cursor:ns-resize}\n  .resize-grip{right:0;bottom:0;width:22px;height:22px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 0 55%,var(--im-muted) 55% 60%,transparent 60% 72%,var(--im-muted) 72% 77%,transparent 77% 88%,var(--im-muted) 88% 93%,transparent 93%);opacity:.55}\n  .resize-grip:hover{opacity:1}\n  #panel[data-compact=true]{grid-template-columns:174px minmax(0,1fr)}\n  #panel[data-compact=true] .inspector{display:none}\n}\n.feature-row{border-top:1px solid var(--im-line);padding:8px 0}.feature-row>summary{cursor:pointer;display:flex;align-items:center;gap:6px;list-style-position:inside}.feature-row>summary .feature-name{font-weight:600;color:var(--im-ink)}.feature-row[open]>summary{margin-bottom:6px}\n.tr-edit>span{color:var(--im-muted);font-size:10px}.tr-edit textarea{min-height:60px}\n.tr-inline{display:block;color:var(--im-muted);font-size:10px;margin-top:2px}h3 .tr-inline{display:inline}\n.promise-row{display:flex;flex-direction:column;gap:4px;margin-bottom:6px}.promise-row>.pill{align-self:flex-start}\n.notebook-note{border-top:1px solid var(--im-line);padding:8px 0}.notebook-head{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px}\n";
  const THEME_CSS = /*__THEME_CSS__*/ "/* 기억 서재 — 종이 티켓과 LP 테마 (ui.css 위에 덮어씀) */\n:host{--vinyl:url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%3Cg%20transform%3D%22translate(9%200)%22%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2239%22%20fill%3D%22%23111%22%20stroke%3D%22%23f2efe8%22%20stroke-width%3D%222%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2214%22%20fill%3D%22none%22%20stroke%3D%22%233a3a3a%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2217%22%20fill%3D%22none%22%20stroke%3D%22%233a3a3a%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2220%22%20fill%3D%22none%22%20stroke%3D%22%233a3a3a%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2223%22%20fill%3D%22none%22%20stroke%3D%22%233a3a3a%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2226%22%20fill%3D%22none%22%20stroke%3D%22%233a3a3a%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2229%22%20fill%3D%22none%22%20stroke%3D%22%233a3a3a%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2232%22%20fill%3D%22none%22%20stroke%3D%22%233a3a3a%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2235%22%20fill%3D%22none%22%20stroke%3D%22%233a3a3a%22%20stroke-width%3D%22.7%22%2F%3E%3Cpolygon%20points%3D%2268.07%2C16.57%2069.91%2C17.63%2065.91%2C22.45%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2270.95%2C18.30%2073.11%2C19.83%2067.38%2C25.59%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2273.66%2C20.26%2076.07%2C22.35%2068.25%2C28.94%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2276.19%2C22.46%2078.75%2C25.15%2067.71%2C33.11%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2278.51%2C24.88%2081.13%2C28.21%2066.40%2C37.10%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2280.61%2C27.49%2083.19%2C31.50%2065.90%2C39.78%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2282.62%2C30.50%2084.80%2C34.74%2062.65%2C43.48%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2284.43%2C33.93%2086.01%2C37.87%2068.63%2C42.54%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2285.89%2C37.53%2086.94%2C41.09%2071.35%2C43.73%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2286.98%2C41.25%2087.58%2C44.38%2074.46%2C45.29%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2287.68%2C45.07%2087.93%2C47.71%2080.65%2C47.07%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2287.99%2C48.94%2087.99%2C51.06%2082.92%2C50.00%22%20fill%3D%22%23f2efe8%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2210%22%20fill%3D%22%23f2efe8%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%221.8%22%20fill%3D%22%23111%22%2F%3E%3C%2Fg%3E%0A%20%20%20%20%20%20%3Crect%20x%3D%224%22%20y%3D%2210%22%20width%3D%2258%22%20height%3D%2280%22%20rx%3D%222%22%20fill%3D%22%23f2efe8%22%20stroke%3D%22%23111%22%20stroke-width%3D%222.4%22%2F%3E%0A%20%20%20%20%20%20%3Cpath%20d%3D%22M12%2024h28M12%2030h18%22%20stroke%3D%22%23111%22%20stroke-width%3D%221.6%22%2F%3E%0A%20%20%20%20%20%20%3Ctext%20x%3D%2233%22%20y%3D%2278%22%20text-anchor%3D%22middle%22%20font-family%3D%22Georgia%2Cserif%22%20font-size%3D%229%22%20font-weight%3D%22700%22%20fill%3D%22%23111%22%3EMEMORY%3C%2Ftext%3E%3C%2Fsvg%3E\");--vinyl-label:url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2249%22%20fill%3D%22%23111%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2225.0%22%20fill%3D%22none%22%20stroke%3D%22%232c2c2c%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2227.4%22%20fill%3D%22none%22%20stroke%3D%22%232c2c2c%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2229.8%22%20fill%3D%22none%22%20stroke%3D%22%232c2c2c%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2232.2%22%20fill%3D%22none%22%20stroke%3D%22%232c2c2c%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2234.6%22%20fill%3D%22none%22%20stroke%3D%22%232c2c2c%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2237.0%22%20fill%3D%22none%22%20stroke%3D%22%232c2c2c%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2239.4%22%20fill%3D%22none%22%20stroke%3D%22%232c2c2c%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2241.8%22%20fill%3D%22none%22%20stroke%3D%22%232c2c2c%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2244.2%22%20fill%3D%22none%22%20stroke%3D%22%232c2c2c%22%20stroke-width%3D%22.7%22%2F%3E%3Cpath%20d%3D%22M50%204.5A45.5%2045.5%200%200%201%2092.5%2034%22%20fill%3D%22none%22%20stroke%3D%22%23f2efe8%22%20stroke-width%3D%222.4%22%20stroke-linecap%3D%22round%22%20opacity%3D%22.85%22%2F%3E%3Cpath%20d%3D%22M50%2012A38%2038%200%200%201%2084%2032%22%20fill%3D%22none%22%20stroke%3D%22%23f2efe8%22%20stroke-width%3D%221.3%22%20stroke-linecap%3D%22round%22%20opacity%3D%22.55%22%2F%3E%3Cpath%20d%3D%22M50%2095.5A45.5%2045.5%200%200%201%207.5%2066%22%20fill%3D%22none%22%20stroke%3D%22%23f2efe8%22%20stroke-width%3D%222.4%22%20stroke-linecap%3D%22round%22%20opacity%3D%22.85%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2222%22%20fill%3D%22%23f2efe8%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2219.5%22%20fill%3D%22none%22%20stroke%3D%22%23111%22%20stroke-width%3D%22.5%22%20opacity%3D%22.35%22%2F%3E%3C%2Fsvg%3E\")}\n/* ===== 티켓·LP 테마 시안 ===== */\n:host{\n  --t-ink:#151515; --t-paper:#f4f1ea; --t-paper2:#ebe7dd; --t-muted:#6d685f; --t-line:#15151526; --t-hair:#15151514;\n  --serif:var(--font-y2k,\"Nanum Myeongjo\",\"Noto Serif KR\",Georgia,serif); --mono:ui-monospace,\"SFMono-Regular\",Menlo,Consolas,monospace;\n  --im-canvas:var(--t-paper2); --im-paper:var(--t-paper); --im-field:#faf8f3; --im-field-border:#1515153a; --im-ink:var(--t-ink); --im-muted:var(--t-muted);\n  --im-line:var(--t-line); --im-soft:#e4dfd3; --im-subtle:#ece8df; --im-selected:#e0dbcf; --im-accent:var(--t-ink); --im-accent-hover:#000; --im-accent-active:#000;\n  --im-button-hover:#e4dfd3; --im-button-active:#d6d0c2;\n  --grain:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\");\n}\n:host([data-theme=dark]){\n  --t-ink:#ece8df; --t-paper:#1b1a18; --t-paper2:#131312; --t-muted:#a39d92; --t-line:#ece8df2b; --t-hair:#ece8df14;\n  --im-canvas:var(--t-paper2); --im-paper:var(--t-paper); --im-field:#222120; --im-field-border:#ece8df40; --im-ink:var(--t-ink); --im-muted:var(--t-muted);\n  --im-line:var(--t-line); --im-soft:#2a2826; --im-subtle:#201f1d; --im-selected:#2e2c29; --im-accent:var(--t-ink); --im-accent-hover:#fff; --im-accent-active:#fff;\n  --im-button-hover:#2a2826; --im-button-active:#33312e;\n}\n#backdrop{background:#0a0a0a8c;backdrop-filter:grayscale(1)}\n#panel{background:var(--grain),var(--t-paper);color:var(--t-ink);border-radius:6px;border:1.5px solid var(--t-ink);box-shadow:0 30px 90px #0007;font-family:var(--font-y2k,\"Pretendard\",\"Noto Sans KR\",system-ui,sans-serif)}\n.workspace,.topbar,#content{background:transparent!important}\nh1{font-family:var(--serif)!important;font-weight:800!important;letter-spacing:-.5px;color:var(--t-ink)!important}\nh2,h3{font-family:var(--serif);font-weight:700;color:var(--t-ink)}\n.eyebrow{font-family:var(--mono)!important;letter-spacing:3px!important;color:var(--t-ink)!important;opacity:.75;display:flex;align-items:center;gap:10px}\n.eyebrow:after{content:\"\";flex:1;max-width:220px;border-top:1px dashed currentColor;opacity:.6}\n.intro,.hint{color:var(--t-muted)!important}\n\n/* sidebar = ticket stub (dark) with perforation */\n.sidebar{background:var(--grain),#151515!important;color:#ece8df!important;border:0!important;position:relative;box-shadow:none!important}\n:host([data-theme=dark]) .sidebar{background:var(--grain),#0c0c0b!important}\n.sidebar:after{content:\"\";position:absolute;top:10px;bottom:10px;right:-1px;border-right:2px dashed #ece8df55}\n.brand{color:#ece8df!important;font-family:var(--serif)!important;align-items:center}\n.brand>svg.icon{display:none}\n.brand:before{content:\"\";flex:none;width:46px;height:46px;border-radius:50%;margin-right:4px;\n  background:radial-gradient(circle,#ece8df 0 2px,#151515 2.5px 5px,#e9e4d8 5.5px 11px,#151515 11.5px),\n  repeating-radial-gradient(circle,#1d1d1d 0 1px,#2b2b2b 1.4px 2.2px);\n  box-shadow:0 0 0 1.5px #ece8df44,inset 0 0 0 1px #000;\n  -webkit-mask:radial-gradient(circle,#000 70%,#000);animation:spin 6s linear infinite paused}\n#panel.is-running .brand:before{animation-play-state:running}\n@keyframes spin{to{transform:rotate(360deg)}}\n.brand small{font-family:var(--mono);letter-spacing:2.5px;color:#ece8df99!important}\n.nav-label{font-family:var(--mono);color:#ece8df80!important;letter-spacing:3px}\n.sidebar nav button{color:#ece8dfcc!important;background:transparent!important;border:1px solid transparent!important;border-radius:3px!important;font-weight:500}\n.sidebar nav button:hover{background:#ece8df14!important;color:#fff!important}\n.sidebar nav button.selected{background:#ece8df!important;color:#151515!important;border-color:#ece8df!important;font-weight:700;\n  -webkit-mask:radial-gradient(circle at 0 50%,#0000 6px,#000 6.5px) left/51% 100% no-repeat,radial-gradient(circle at 100% 50%,#0000 6px,#000 6.5px) right/51% 100% no-repeat}\n.side-bottom,.side-bottom small,.room-switch{color:#ece8dfaa!important}\n.side-bottom button{background:transparent!important;color:#ece8df!important;border:1px solid #ece8df55!important;border-radius:3px!important}\n.room-switch input{accent-color:#ece8df}\n\n/* inspector = record shelf */\n.inspector{background:transparent!important;border-left:1.5px solid var(--t-ink)!important}\n.rail-title{font-family:var(--mono);letter-spacing:2px;text-transform:uppercase;color:var(--t-ink)!important}\n.rail-stat{background:transparent!important;border:0!important;box-shadow:none!important;padding:8px 0!important;display:flex!important;align-items:center;gap:14px}\n.rail-stat b{flex:none;width:64px!important;height:64px!important;border-radius:50%!important;display:grid!important;place-items:center;font:700 15px var(--serif)!important;color:#151515!important;border:0!important;\n  background:radial-gradient(circle,#151515 0 1.6px,#f4f1ea 2.2px 14px,#151515 14.5px 15.5px,#0000 16px),repeating-radial-gradient(circle,#151515 0 1.1px,#2a2a2a 1.5px 2.4px)!important;\n  box-shadow:0 3px 8px #0004;transition:transform .6s}\n.rail-stat:hover b{transform:rotate(200deg)}\n.rail-stat small{font-size:12px;color:var(--t-ink)!important}\n.rail-divider{height:0!important;background:none!important;border:0!important;border-top:1.5px dashed var(--t-line)!important}\n.inspector .icon,.rail-note svg{color:var(--t-ink)!important}\n\n/* topbar */\n.topbar{border-bottom:1.5px solid var(--t-ink)!important}\n#roomSelect,select,input:not([type=checkbox]),textarea{border-radius:3px!important;background:var(--im-field)!important;border:1px solid var(--im-field-border)!important;color:var(--t-ink)!important}\n#themeToggle,#close{border-radius:50%!important;border:1px solid var(--t-ink)!important;background:transparent!important;color:var(--t-ink)!important}\n/* On mobile these controls overlap a dark sidebar, even in light mode. */\n@media(max-width:720px){\n  #close{z-index:100!important;background:#f3efe7!important;color:#151515!important;border:1.5px solid #151515!important}\n  :host([data-theme=dark]) #close{background:#262522!important;color:#f3efe7!important;border-color:#f3efe7!important}\n}\n\n/* metrics = admission stubs */\n.metric-row{gap:12px!important}\n.metric{position:relative;background:var(--grain),var(--t-paper)!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:18px 16px 26px!important;\n  outline:1.5px solid var(--t-ink);outline-offset:-6px;\n  -webkit-mask:radial-gradient(circle at 0 50%,#0000 7px,#000 7.5px) left/51% 100% no-repeat,radial-gradient(circle at 100% 50%,#0000 7px,#000 7.5px) right/51% 100% no-repeat;\n  mask:radial-gradient(circle at 0 50%,#0000 7px,#000 7.5px) left/51% 100% no-repeat,radial-gradient(circle at 100% 50%,#0000 7px,#000 7.5px) right/51% 100% no-repeat}\n.metric:after{content:\"\";position:absolute;left:14px;right:14px;bottom:10px;height:7px;opacity:.35;background:repeating-linear-gradient(90deg,currentColor 0 1px,#0000 1px 3px,currentColor 3px 5px,#0000 5px 7px)}\n:host .metric{filter:drop-shadow(0 2px 3px #0002)}\n.metric strong{font:800 26px var(--serif)!important;color:var(--t-ink)!important}\n.metric small{font-size:11px!important;color:var(--t-muted)!important}\n\n/* paper sections = tickets */\n.paper{background:var(--grain),var(--t-paper)!important;border:1.5px solid var(--t-ink)!important;border-radius:4px!important;box-shadow:4px 4px 0 var(--t-ink)!important;position:relative}\n.paper-toolbar h2,.paper>h2{font-family:var(--serif)}\n.pill{font-family:var(--mono)!important;font-size:10px!important;letter-spacing:1.5px;text-transform:uppercase;border:1px solid var(--t-ink)!important;border-radius:2px!important;background:transparent!important;color:var(--t-ink)!important;transform:rotate(-2deg)}\nbutton.primary,.primary{background:var(--t-ink)!important;color:var(--t-paper)!important;border:1.5px solid var(--t-ink)!important;border-radius:3px!important;font-weight:700;letter-spacing:.3px}\nbutton.primary:hover{filter:none;background:#000!important}\n:host([data-theme=dark]) button.primary:hover{background:#fff!important}\nbutton:not(.primary):not(.file-index):not(.chapter-chip):not(#launch){border-radius:3px}\n.paper button:not(.primary):not(.file-index):not(.chapter-chip){background:transparent;border:1.5px solid var(--t-ink);color:var(--t-ink)}\n.paper button:not(.primary):not(.file-index):not(.chapter-chip):hover{background:var(--im-button-hover)}\n\n/* chapter chips = small tickets */\n.chapter-chip{border-radius:2px!important;border:1.5px solid var(--t-ink)!important;background:var(--t-paper)!important;color:var(--t-ink)!important;font-family:var(--serif);font-weight:700;\n  -webkit-mask:radial-gradient(circle at 0 50%,#0000 5px,#000 5.5px) left/51% 100% no-repeat,radial-gradient(circle at 100% 50%,#0000 5px,#000 5.5px) right/51% 100% no-repeat;padding-left:16px!important;padding-right:16px!important}\n.chapter-chip .chip-id{font-family:var(--mono);background:transparent!important;color:inherit!important;border-right:1px dashed currentColor;padding-right:8px;margin-right:6px;border-radius:0!important}\n.chapter-chip.is-selected{background:var(--t-ink)!important;color:var(--t-paper)!important}\n\n/* scene cards = admission tickets */\n.file-shelf{gap:14px!important;padding-top:16px!important}\n.file-index{margin-left:0!important;border-radius:3px!important;background:var(--grain),var(--t-paper)!important;color:var(--t-ink)!important;border:1.5px solid var(--t-ink)!important;box-shadow:3px 3px 0 var(--t-ink)!important;\n  -webkit-mask:radial-gradient(circle at 0 72%,#0000 7px,#000 7.5px) left/51% 100% no-repeat,radial-gradient(circle at 100% 72%,#0000 7px,#000 7.5px) right/51% 100% no-repeat;\n  padding:22px 14px 18px 26px!important}\n.file-index:before{display:none!important}\n.file-index:after{content:\"\";position:absolute;left:9px;right:9px;top:72%;border-top:1.5px dashed var(--t-ink);opacity:.55}\n.file-index:nth-child(n){background-color:var(--t-paper)!important}\n.file-index.is-current{background:var(--grain),var(--t-ink)!important;color:var(--t-paper)!important}\n.file-index.is-current:after{border-color:var(--t-paper)}\n.file-index.is-selected{transform:translateY(-6px) rotate(-1.2deg)!important;box-shadow:5px 6px 0 var(--t-ink)!important}\n.file-index:not(:disabled):hover{background:var(--grain),var(--im-button-hover)!important;color:var(--t-ink)!important}\n.file-index.is-current:not(:disabled):hover{background:var(--grain),#000!important;color:var(--t-paper)!important}\n.file-index h3{font-family:var(--serif)!important;font-weight:800!important;font-size:17px!important}\n.file-code,.file-spine{font-family:var(--mono)!important;opacity:.8!important}\n.file-index .barcode{opacity:.8!important;width:56px!important;height:16px!important}\n.file-foot{border-top:0!important;font-family:var(--mono);font-size:9.5px!important;top:auto}\n\n/* record rows, links, chips */\n.record-row,.event-row,.fact-row,.routine-row{border-color:var(--t-line)!important}\na.record-link,.record-link{color:var(--t-ink)!important;background:transparent!important;border:1px solid var(--t-ink)!important;border-radius:2px!important;font-family:var(--mono);font-size:11px!important;text-decoration:none!important}\n.chip,.chip-wrap .chip{border-radius:2px!important;border:1px solid var(--t-ink)!important;background:transparent!important;color:var(--t-ink)!important}\n.quote-card{border-left:3px solid var(--t-ink)!important;background:var(--im-subtle)!important;padding:12px 16px!important}\n.quote-card blockquote{border:0!important;background:none!important;margin:6px 0 0!important;padding:0!important}\n.note{background:var(--im-subtle)!important;border:1px dashed var(--t-ink)!important;border-radius:3px!important;color:var(--t-ink)!important}\n#status{font-family:var(--mono);font-size:11px;letter-spacing:.3px}\ndetails>summary{font-family:var(--serif);font-weight:700}\n.empty{border:1.5px dashed var(--t-line)!important;border-radius:3px!important;background:transparent!important}\n\n@media(max-width:720px){\n  .sidebar:after{top:auto;left:10px;right:10px;bottom:0;border-right:0;border-bottom:2px dashed #ece8df55}\n  .brand:before{width:34px;height:34px}\n  #panel{border:0;border-radius:0}\n}\n\n\n/* ---- ticket stocks: neighbours never share a colour ---- */\n.file-index:nth-child(4n+1){--stock:#f4f1ea}\n.file-index:nth-child(4n+2){--stock:#dcdad4}\n.file-index:nth-child(4n+3){--stock:#e6d8bf}\n.file-index:nth-child(4n+4){--stock:#cfd6d2}\n.file-index,.file-index:nth-child(n){background:var(--grain),var(--stock,#f4f1ea)!important;color:#151515!important}\n.file-index:not(:disabled):hover{background:var(--grain),var(--stock,#f4f1ea)!important;filter:brightness(.96)}\n.file-index.is-current,.file-index.is-current:not(:disabled):hover{background:var(--grain),var(--stock,#f4f1ea)!important;color:#151515!important}\n.file-index.is-current:after{border-color:#151515}\n.file-index.is-current:before{content:\"ON AIR\"!important;display:grid!important;place-items:center;position:absolute!important;top:12px!important;right:12px!important;left:auto!important;width:44px!important;height:44px!important;z-index:2!important;background:none!important;border:1.5px solid #151515;border-radius:50%!important;font:700 8px var(--mono);letter-spacing:1px;color:#151515;transform:rotate(-14deg);opacity:.75}\n.file-index.is-selected{outline:2.5px solid #151515!important;outline-offset:-6px}\n.chapter-chip:nth-child(3n+1){--stock:#f4f1ea}.chapter-chip:nth-child(3n+2){--stock:#e6d8bf}.chapter-chip:nth-child(3n+3){--stock:#dcdad4}\n.chapter-chip:last-child{--stock:#cfd6d2}\n.chapter-chip{background:var(--grain),var(--stock,#f4f1ea)!important;color:#151515!important}\n.chapter-chip.is-selected{background:var(--grain),#151515!important;color:#f4f1ea!important;transform:translateY(-2px)}\n\n/* ---- dark: the same paper tickets laid on a black table ---- */\n:host([data-theme=dark]){--t-ink:#ece8df;--t-paper:#121212;--t-paper2:#0b0b0b;--t-muted:#9d978c}\n:host([data-theme=dark]) #panel{background:var(--grain),#121212;border-color:#ece8df55}\n:host([data-theme=dark]) .sidebar{background:var(--grain),#1d1c1a!important}\n:host([data-theme=dark]) .topbar{border-bottom-color:#ece8df33!important}\n:host([data-theme=dark]) .inspector{border-left-color:#ece8df33!important}\n:host([data-theme=dark]) :is(.paper,.metric,.empty,.file-index,.chapter-chip){\n  --t-ink:#151515;--t-paper:#ece8df;--t-muted:#5f5a51;--t-line:#15151526;--im-field:#f7f4ee;--im-field-border:#1515153a;--im-ink:#151515;--im-muted:#5f5a51;\n  --im-line:#15151526;--im-subtle:#e2ddd2;--im-button-hover:#ddd7ca;color:#151515}\n:host([data-theme=dark]) .paper{box-shadow:0 10px 28px #000c!important;border-color:#ece8df!important}\n:host([data-theme=dark]) .metric{filter:drop-shadow(0 6px 12px #000c)}\n:host([data-theme=dark]) .file-index{box-shadow:0 8px 20px #000c!important;border-color:#ece8df!important}\n:host([data-theme=dark]) .paper button.primary{background:#151515!important;color:#ece8df!important;border-color:#151515!important}\n:host([data-theme=dark]) .chapter-chip{border-color:#ece8df!important}\n:host([data-theme=dark]) .chapter-chip.is-selected{background:var(--grain),#ece8df!important;color:#151515!important;outline:2px solid #151515;outline-offset:-5px}\n:host([data-theme=dark]) .rail-stat b{box-shadow:0 0 0 1px #ece8df30,0 6px 14px #000c!important;\n  background:radial-gradient(circle,#151515 0 1.6px,#ece8df 2.2px 14px,#0000 14.5px),repeating-radial-gradient(circle,#191919 0 1.1px,#2c2b29 1.5px 2.4px)!important}\n:host([data-theme=dark]) .brand:before{box-shadow:0 0 0 1.5px #ece8df44}\n:host([data-theme=dark]) #roomSelect{background:#1d1c1a!important;color:#ece8df!important;border-color:#ece8df44!important}\n\n/* ---- printed records with light reflections ---- */\n.brand:before,:host([data-theme=dark]) .brand:before{background:var(--vinyl) center/contain no-repeat!important;box-shadow:none!important;width:48px;height:48px}\n:host([data-theme=dark]) .brand:before{outline:0}\n.rail-stat b,:host([data-theme=dark]) .rail-stat b{background:var(--vinyl-label) center/contain no-repeat!important;color:#151515!important;width:70px!important;height:70px!important;font-size:16px!important;box-shadow:0 4px 10px #0003!important}\n:host([data-theme=dark]) .rail-stat b{box-shadow:0 0 0 1.5px #ece8df40,0 6px 14px #000c!important}\n\n.brand:before{border-radius:0!important;width:52px!important;height:52px!important;animation:none!important}\n\n/* ---- logo: a record in its sleeve; it slides out and turns while memories are being sorted ---- */\n:host{--logo-disc:url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%3Cg%20transform%3D%22translate(9%200)%22%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2239%22%20fill%3D%22%23111%22%20stroke%3D%22%23f2efe8%22%20stroke-width%3D%222%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2214%22%20fill%3D%22none%22%20stroke%3D%22%233a3a3a%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2217%22%20fill%3D%22none%22%20stroke%3D%22%233a3a3a%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2220%22%20fill%3D%22none%22%20stroke%3D%22%233a3a3a%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2223%22%20fill%3D%22none%22%20stroke%3D%22%233a3a3a%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2226%22%20fill%3D%22none%22%20stroke%3D%22%233a3a3a%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2229%22%20fill%3D%22none%22%20stroke%3D%22%233a3a3a%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2232%22%20fill%3D%22none%22%20stroke%3D%22%233a3a3a%22%20stroke-width%3D%22.7%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2235%22%20fill%3D%22none%22%20stroke%3D%22%233a3a3a%22%20stroke-width%3D%22.7%22%2F%3E%3Cpolygon%20points%3D%2268.07%2C16.57%2069.91%2C17.63%2065.91%2C22.45%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2270.95%2C18.30%2073.11%2C19.83%2067.38%2C25.59%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2273.66%2C20.26%2076.07%2C22.35%2068.25%2C28.94%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2276.19%2C22.46%2078.75%2C25.15%2067.71%2C33.11%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2278.51%2C24.88%2081.13%2C28.21%2066.40%2C37.10%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2280.61%2C27.49%2083.19%2C31.50%2065.90%2C39.78%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2282.62%2C30.50%2084.80%2C34.74%2062.65%2C43.48%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2284.43%2C33.93%2086.01%2C37.87%2068.63%2C42.54%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2285.89%2C37.53%2086.94%2C41.09%2071.35%2C43.73%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2286.98%2C41.25%2087.58%2C44.38%2074.46%2C45.29%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2287.68%2C45.07%2087.93%2C47.71%2080.65%2C47.07%22%20fill%3D%22%23f2efe8%22%2F%3E%3Cpolygon%20points%3D%2287.99%2C48.94%2087.99%2C51.06%2082.92%2C50.00%22%20fill%3D%22%23f2efe8%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2210%22%20fill%3D%22%23f2efe8%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%221.8%22%20fill%3D%22%23111%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E\");--logo-sleeve:url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%0A%20%20%20%20%20%20%3Crect%20x%3D%224%22%20y%3D%2210%22%20width%3D%2258%22%20height%3D%2280%22%20rx%3D%222%22%20fill%3D%22%23f2efe8%22%20stroke%3D%22%23111%22%20stroke-width%3D%222.4%22%2F%3E%0A%20%20%20%20%20%20%3Cpath%20d%3D%22M12%2024h28M12%2030h18%22%20stroke%3D%22%23111%22%20stroke-width%3D%221.6%22%2F%3E%0A%20%20%20%20%20%20%3Ctext%20x%3D%2233%22%20y%3D%2278%22%20text-anchor%3D%22middle%22%20font-family%3D%22Georgia%2Cserif%22%20font-size%3D%229%22%20font-weight%3D%22700%22%20fill%3D%22%23111%22%3EMEMORY%3C%2Ftext%3E%3C%2Fsvg%3E\")}\n.brand:before{display:none!important}\n.brand .logo{position:relative;flex:none;width:56px;height:56px;margin-right:2px}\n.brand .logo i{position:absolute;inset:0;background:center/contain no-repeat}\n.brand .logo .disc{background-image:var(--logo-disc);transform-origin:59% 50%;transition:transform .5s}\n.brand .logo .sleeve{background-image:var(--logo-sleeve)}\n/* While memory is being sorted the record slides out of its sleeve and plays, then goes back in. */\n#panel.is-running .brand .logo .disc{animation:mm-play 4s linear infinite}\n@keyframes mm-play{0%{transform:translateX(0) rotate(0)}12%{transform:translateX(18%) rotate(40deg)}88%{transform:translateX(18%) rotate(680deg)}100%{transform:translateX(0) rotate(720deg)}}\n@media (prefers-reduced-motion:reduce){#panel.is-running .brand .logo .disc{animation:mm-play 12s linear infinite}}\n@media(max-width:720px){.brand .logo{width:40px;height:40px}}\n\n/* ---- font: Marinara's own font unless the reader picked the library's ---- */\n:host([data-font=own]){--serif:\"Nanum Myeongjo\",\"Noto Serif KR\",\"AppleMyungjo\",\"Batang\",Georgia,serif}\n:host([data-font=own]) #panel{font-family:\"Pretendard\",\"Noto Sans KR\",\"Apple SD Gothic Neo\",system-ui,sans-serif}\n\n/* ---- one font everywhere: Marinara's (or the library's own); typewriter only for short Latin labels ---- */\n:host{--body-font:var(--font-y2k,\"Pretendard\",\"Noto Sans KR\",system-ui,sans-serif)}\n:host([data-font=own]){--body-font:\"Pretendard\",\"Noto Sans KR\",\"Apple SD Gothic Neo\",system-ui,sans-serif}\n#panel,#panel *:not(svg):not(svg *){font-family:var(--body-font)!important}\n#panel :is(h1,h2,h3,.paper-toolbar h2,details>summary,.file-index h3,.metric strong,.rail-stat b,.chapter-chip,.quote-card blockquote,.brand>div){font-family:var(--serif)!important}\n#panel :is(.eyebrow,.nav-label,.brand small,.file-code,.file-spine,.chip-id,.event-no,.editor-number,code){font-family:var(--mono)!important}\n.rail-title{letter-spacing:1px!important;text-transform:none!important}\n.pill{letter-spacing:.5px!important}\na.record-link,.record-link{font-size:13px!important}\n#status{letter-spacing:0}\npre{font-size:12.5px!important;line-height:1.85!important}\n\n/* ---- scene tickets: code on one line, title above the tear line, date below ---- */\n.file-index{display:flex!important;flex-direction:column;min-height:240px!important;padding:18px 14px 0 30px!important}\n.file-index .file-code{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:9px!important;letter-spacing:.6px!important}\n.file-index h3{font-size:16px!important;line-height:1.45!important;margin:14px 0 0!important;-webkit-line-clamp:4!important;max-height:calc(1.45em * 4);word-break:keep-all;overflow-wrap:anywhere}\n.file-index .barcode{display:none!important}\n.file-index:after{top:auto!important;bottom:52px!important}\n.file-index .file-foot{position:absolute!important;left:30px!important;right:12px!important;bottom:18px!important;top:auto!important;padding:0!important}\n.file-index.is-current:before{top:8px!important;right:8px!important;width:40px!important;height:40px!important}\n.chapter-chip{max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:none}\n.file-index{-webkit-mask:radial-gradient(circle at 0 calc(100% - 52px),#0000 7px,#000 7.5px) left/51% 100% no-repeat,radial-gradient(circle at 100% calc(100% - 52px),#0000 7px,#000 7.5px) right/51% 100% no-repeat!important;\n  mask:radial-gradient(circle at 0 calc(100% - 52px),#0000 7px,#000 7.5px) left/51% 100% no-repeat,radial-gradient(circle at 100% calc(100% - 52px),#0000 7px,#000 7.5px) right/51% 100% no-repeat!important}\n.file-index .file-code{letter-spacing:0!important;font-size:8.5px!important}\n.file-index .file-code{white-space:normal!important;overflow:visible!important;line-height:1.5}.file-index .file-range{display:block;opacity:.75;font-family:var(--body-font)!important;font-size:10px}.file-index .file-range{white-space:nowrap}\n\n/* Lines kept on a scene without a clear event */\n.quote-card.loose { border-style: dashed !important; opacity: .85; }\n\n/* Korean beside memory written in another language */\n.tr-note{margin:-4px 0 6px!important;padding:6px 10px!important;font-size:13px!important;line-height:1.55!important;color:var(--im-muted)!important;border-left:2px solid var(--im-muted)!important;background:transparent!important}\n.tr-note span{display:inline-block;margin-right:8px;font-family:var(--mono)!important;font-size:9px!important;letter-spacing:1.5px;text-transform:uppercase;opacity:.75}\n.quote-card .tr-note{margin:8px 0 0!important}\n\n\n/* v0.11.65: phone / narrow layout (<=720px). Tabs wrap onto rows instead of scrolling sideways, and the header is compact so #content gets the height. */\n@media(max-width:720px){\n  .sidebar{padding:calc(6px + env(safe-area-inset-top,0px)) 10px 0}\n  .brand{min-height:36px;padding:0 84px 0 2px;margin-bottom:8px;gap:8px;font-size:15px;letter-spacing:-.5px;line-height:1.2}\n  .brand .logo{width:28px;height:28px;margin-right:0}\n  #close,#themeToggle{top:calc(6px + env(safe-area-inset-top,0px));width:36px;height:36px;font-size:18px}\n  #close{right:10px}#themeToggle{right:52px}\n  #close .icon{width:18px;height:18px}\n  .sidebar nav{flex-direction:row;flex-wrap:wrap;overflow:visible;overflow-x:visible;gap:4px 6px;justify-content:flex-start;align-content:flex-start;padding-bottom:6px}\n  .sidebar nav button{flex:0 0 auto;min-height:36px;padding:6px 9px;font-size:12px;gap:5px;justify-content:flex-start;white-space:nowrap}\n  .sidebar nav .icon{width:14px;height:14px}\n  .topbar{min-height:0;padding:6px 12px;gap:6px}\n  #status{padding:0 12px 4px}\n}\n\n/* ===== 0.31 개편: 하위 탭 · 시간순 · 인물별 · 여러 개 고르기 · 한눈에 카드 ===== */\n.subtabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 16px}\n.subtab{border:1px solid var(--im-line);background:var(--im-paper);color:var(--im-ink);border-radius:999px;padding:5px 12px;font-size:11px}\n.subtab.selected{background:var(--im-ink);color:var(--im-paper);border-color:var(--im-ink)}\n.subtabs select{border-radius:999px;font-size:11px;padding:4px 10px}\n.tl-day{display:grid;grid-template-columns:110px minmax(0,1fr);gap:14px;margin:0 0 18px}\n.tl-stamp{font-family:var(--mono);align-self:start;position:sticky;top:0}.tl-stamp b{display:block;font-size:13px}\n.tl-list{display:grid;gap:8px;border-left:2px solid var(--im-line);padding-left:14px;min-width:0}\n.tl-scene{border:1px solid var(--im-line);border-radius:10px;padding:10px 12px;background:var(--im-paper);min-width:0}\n.tl-scene p{margin:6px 0}.tl-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center}\n.tl-after{font-size:12px;border-left:3px solid var(--im-line);padding:2px 10px}.tl-after small{font-weight:700;color:var(--im-ink)}\n.tl-chapter{font-size:12px;margin:6px 0 2px;color:var(--im-muted)}.tl-lines .pill{margin-right:4px}\n.person-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}\n.person-chips button{border:1px solid var(--im-line);border-radius:999px;padding:5px 12px;background:var(--im-paper);font-size:12px}\n.person-chips button.selected{background:var(--im-ink);color:var(--im-paper);border-color:var(--im-ink)}\n.person-now{display:grid;grid-template-columns:80px minmax(0,1fr);gap:4px 12px;font-size:12px;margin:6px 0}.person-now dt{color:var(--im-muted)}.person-now dd{margin:0}\n.person-sec>summary{cursor:pointer}.person-row{font-size:12px;margin:6px 0}\n.ledger-tools{margin:0 0 12px}.pick-all{display:flex;gap:6px;align-items:center;font-size:11px;margin:6px 0}\n.pick-row{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:start}.pick-row>input{margin-top:14px}\n.fact-row{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:8px}.fact-row>.pick-fact{margin-top:3px}.fact-row>*:not(.pick-fact){grid-column:2}\n.bulk-bar{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;background:var(--im-ink);color:var(--im-paper);border-radius:10px;padding:8px 12px;margin:8px 0}\n.bulk-bar .buttons{margin:0}.bulk-bar button{color:var(--im-paper);border-color:var(--im-paper)}\n.next-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 0;border-top:1px dashed var(--im-line)}.next-row:first-of-type{border-top:0}\n.next-row small{display:block}.sev{width:7px;height:28px;border-radius:4px;background:#b8862f}.sev.bad{background:#a8443d}.sev.ok{background:#3f7d5c}\n.tracker-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}\n.tracker-tile{border:1px solid var(--im-line);border-radius:10px;padding:8px 10px;display:grid;gap:2px}.tracker-tile b{font-family:var(--mono);font-size:16px}\n.recent-row,.cost-row{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:10px;align-items:center;padding:6px 0;border-top:1px dashed var(--im-line);font-size:12px}\n.cost-row{grid-template-columns:70px auto minmax(0,1fr)}\n.bar-row{display:grid;grid-template-columns:140px minmax(0,1fr) 40px;gap:8px;align-items:center;font-size:11px;margin:4px 0}\n.bar{height:9px;border-radius:5px;background:var(--im-line);overflow:hidden}.bar>span{display:block;height:100%;background:var(--im-ink)}\n.search-filters select{font-size:11px}\n@media (max-width:720px){.tl-day{grid-template-columns:minmax(0,1fr)}.tl-stamp{position:static}.bar-row{grid-template-columns:90px minmax(0,1fr) 36px}}\n/* 페르소나 말 표시: one row per mark (start message, mark, language) */\n.speech-row{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin:6px 0}.speech-row label{flex:1 1 110px;min-width:0}.speech-row input,.speech-row select{width:100%}.speech-row button{flex:none}\n.speech-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}\n";
  const host = typeof marinara === 'object' ? marinara : globalThis.marinara || {};
  const BASE = '/api/memory-module';
  const NAV = [
    ['home', '한눈에', 'archive'],
    ['scenes', '장면', 'folder'],
    ['search', '검색', 'search'],
    ['facts', '알게 된 사실', 'person'],
    ['ledger', '아직 끝나지 않은 일', 'note'],
    ['promises', '약속', 'clock'],
    ['life', '최근 생활', 'clock'],
    ['world', '인물·장소', 'folder'],
    ['notebook', '수첩', 'note'],
    ['names', '이름 정리', 'person'],
    ['inject', '주입 확인', 'search'],
    ['settings', '설정', 'settings'],
  ];
  /**
   * Seven tabs, each holding one or more of the old screens as sub-tabs (every old screen and every link into it
   * stays). The tab bar shows the group; the bar under the title shows its screens.
   */
  const GROUPS = [
    ['home', '한눈에', 'archive', ['home']],
    ['story', '이야기', 'folder', ['timeline', 'lines', 'scenes', 'setup']],
    ['people', '인물', 'person', ['person', 'facts', 'notebook', 'world', 'names']],
    ['todo', '할 일', 'note', ['ledger', 'promises', 'life']],
    ['search', '검색', 'search', ['search']],
    ['inject', '주입 확인', 'search', ['inject']],
    ['settings', '설정', 'settings', ['settings']],
  ];
  const SUBTAB = { timeline: '시간순', lines: '줄기', scenes: '장면·챕터', setup: '배경 설정', person: '인물별', facts: '알게 된 사실', notebook: '수첩', world: '상태·장소·물건', names: '이름 정리', ledger: '끝나지 않은 일', promises: '약속', life: '최근 생활' };
  const groupOf = (t) => GROUPS.find((g) => g[3].includes(t)) || GROUPS[0];
  /** The screen each group was last on, so its tab goes back there. */
  const lastIn = {};
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
  const needsScenes = () => ['scenes', 'search', 'facts', 'ledger', 'promises', 'timeline', 'lines', 'person', 'home'].includes(tab);
  // The open items carry their evidence quotes (most of the room data): fetched with the scenes, only for the tabs that list them.
  const needsThreads = () => ['scenes', 'search', 'ledger', 'promises', 'timeline', 'person', 'home'].includes(tab);
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
  // OOC로 본 메시지 (아직 끝나지 않은 일 tab): loaded when asked for.
  let oocList = null;
  let oocRoom = '';
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
  let searchKind = 'all';
  const pickedFacts = new Set();
  let searchWho = 'all';
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
  let trStamp = null;
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
    noteRecentRoom(id);
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

  const needsNames = () => ['names', 'life', 'person'].includes(tab);
  const needsWorld = () => ['world', 'notebook', 'person', 'home'].includes(tab);
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
      if (info?.translationStamp != null) trStamp = info.translationStamp;
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
      // A missing or unreadable config is not an empty glossary: send nothing. Only a glossary the person saved
      // (even an empty one) is sent.
      const config = stored?.value?.config;
      if (!config || typeof config !== 'object') return;
      const scope = config.chats?.[id] || config.defaults;
      if (typeof scope?.glossary !== 'string') return;
      const text = scope.glossary;
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

  /* The rooms opened lately (this browser) and the tab each was left on. */
  const RECENT_ROOMS = 5;
  function recentRooms() {
    try { return JSON.parse(localStorage.getItem('memory-module-recent-rooms') || '[]').filter((x) => typeof x === 'string'); } catch { return []; }
  }
  function noteRecentRoom(id) {
    if (!id) return;
    try { localStorage.setItem('memory-module-recent-rooms', JSON.stringify([id, ...recentRooms().filter((x) => x !== id)].slice(0, RECENT_ROOMS))); } catch {}
  }
  function roomTab(id) {
    try { const t = JSON.parse(localStorage.getItem('memory-module-room-tabs') || '{}')[id]; return VIEWS[t] ? t : ''; } catch { return ''; }
  }
  function rememberRoomTab(id, t) {
    if (!id || !t) return;
    try { const all = JSON.parse(localStorage.getItem('memory-module-room-tabs') || '{}'); all[id] = t; localStorage.setItem('memory-module-room-tabs', JSON.stringify(all)); } catch {}
  }

  /** The scene a message number falls in. */
  function sceneOf(number) {
    return number == null ? null : (store?.scenes || []).find((x) => x.start <= number && number <= x.end) || null;
  }

  /** A small button that opens a scene in the scene tab. */
  function sceneLink(scene, label = '') {
    return scene ? `<span class="chip-wrap"><a href="#" class="record-link chip" data-goto-scene="${esc(scene.id)}"><span class="chip-id">${esc(scene.id)}</span><span class="chip-title">${esc(shown(scene.title))}</span><span class="chip-arrow">›</span></a>${label ? `<small>${esc(label)}</small>` : ''}</span>` : '';
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

  const notebookJobKey = (i) => { const j = i?.notebookJob; return j ? `${j.state}:${j.done}:${j.kept}:${j.stage || ''}` : ''; };

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
            const nbBefore = notebookJobKey(info);
            info = polledInfo;
            if (notebookJobKey(info) !== nbBefore) {
              if (needsWorld()) await loadWorld(room);
              if (tab === 'notebook' && !editing()) render();
            }
            if ((wasPreparing || info?.translationPrep?.working) && tab === 'settings' && !editing()) render();
            // New Korean was made in the background (after a run, while the library stayed open): load it.
            const stampChanged = polledInfo.translationStamp != null && polledInfo.translationStamp !== trStamp;
            if (trPending || stampChanged) {
              const before = `${trPending}:${trError}:${trWorking}:${trStamp}`;
              await loadTranslations(room);
              trStamp = polledInfo.translationStamp ?? trStamp;
              if (`${trPending}:${trError}:${trWorking}:${trStamp}` !== before && !editing()) render();
            }
          }
          if (was && !running()) notice = [info?.job?.state, info?.sceneJob?.state].includes('error') ? '정리가 멈췄습니다. 아래 오류를 확인해 주세요.' : '정리가 끝났습니다.';
          if (was || running()) (editing() ? renderStatus() : render());
        }
      } catch {}
      schedulePoll();
    }, was || info?.translationPrep?.working || info?.displayTranslating || info?.notebookJob?.state === 'running' ? 3000 : 10000);
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

  const roomName = () => { const r = rooms.find((x) => x.id === room); return r ? roomLabel(r) : '채팅방을 선택해 주세요'; };
  /**
   * A room's name in the room list: a branch says so ("↳ 분기", with its own name unless it is Marinara's default
   * "New Branch"), and rooms that share a name (a branch and the room it came from) get their last-used time, so they
   * can be told apart when picked from the list.
   */
  function roomLabel(r) {
    const same = rooms.filter((x) => x.name === r.name).length > 1;
    const own = r.branch?.name && !/^new branch$/i.test(r.branch.name.trim()) ? `: ${r.branch.name}` : '';
    const when = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    const time = same ? when(r.lastMessageAt || r.updatedAt) : '';
    return `${r.name}${r.branch ? ` ↳ 분기${own}` : ''}${time ? ` · ${time}` : ''}`;
  }
  const tokens = (text) => Math.round(String(text || '').length / 1.5).toLocaleString();
  const day = (iso) => (iso ? String(iso).slice(2, 10) : '');

  function quoteLine(q) {
    let text = String(q.text || '').replace(/<speaker="[^"]*">/g, '').replace(/<\/speaker>/g, '');
    const prefix = text.match(/^\s*([^|"“(]{1,20}?)\s*\|\s*/);
    const by = q.by || (prefix ? prefix[1].trim() : '');
    if (prefix) text = text.slice(prefix[0].length);
    // The original and its translation are saved apart and shown in one form: "original" (번역).
    if (typeof q.translation === 'string' && q.translation.trim()) text = `${text.trim()} (${q.translation.trim()})`;
    // The language the room's speech marks gave the line (페르소나 말 표시).
    const lang = SPEECH_LANGS[q.lang] ? ` · ${SPEECH_LANGS[q.lang]}로` : '';
    const who = by ? `${by}${q.to ? ` → ${q.to}${q.toGuess ? '(추정)' : ''}` : ''}` : q.to ? `화자 미확정 → ${q.to}${q.toGuess ? '(추정)' : ''}` : (/^\s*["“'‘「『]/.test(text) ? '대사' : '서술');
    return { who: who + lang, text: text.trim() };
  }

  /* 페르소나 말 표시: which marks around the user's character's words are speech, and in what language. */
  const SPEECH_LANGS = { en: '영어', it: '이탈리아어', el: '그리스어', fr: '프랑스어', de: '독일어', es: '스페인어', pt: '포르투갈어', ru: '러시아어', la: '라틴어', ja: '일본어', zh: '중국어', ko: '한국어', grc: '고대 그리스어' };
  const SPEECH_MARKS = [['"', '"…"'], ['[', '[…]'], ['{', '{…}'], ['<', '<…>'], ['「', '「…」'], ['『', '『…』'], ['«', '«…»']];
  // Rows being edited (one per mark and start), kept apart from what is saved until 저장 is pressed.
  let speechRows = null;
  let speechRowsRoom = null;
  function speechRowsFrom(rules) {
    return (rules || []).flatMap((r) => Object.entries(r.marks || {}).map(([mark, lang]) => ({ from: r.from, mark, lang })));
  }
  function speechMarksPaper() {
    if (!room || !info) return '';
    if (speechRowsRoom !== room || !speechRows) {
      speechRows = speechRowsFrom(info.speechMarks);
      speechRowsRoom = room;
    }
    const opt = (list, v) => list.map(([value, label]) => `<option value="${esc(value)}" ${value === v ? 'selected' : ''}>${esc(label)}</option>`).join('');
    const langs = Object.entries(SPEECH_LANGS);
    const rows = speechRows.map((r, i) => `<div class="speech-row" data-speech-row="${i}">
        <label>시작 메시지<input type="number" min="1" data-speech-from value="${esc(String(r.from || 1))}"></label>
        <label>표시<select data-speech-mark>${opt(SPEECH_MARKS, r.mark)}</select></label>
        <label>언어<select data-speech-lang>${opt(langs, r.lang)}</select></label>
        <button data-act="speechRowRemove" data-i="${i}" title="이 줄 빼기">빼기</button></div>`).join('');
    const saved = speechRowsFrom(info.speechMarks);
    const dirty = JSON.stringify(saved) !== JSON.stringify(speechRows);
    return `<details class="paper" data-list="speechMarks" ${openLists.has('speechMarks') ? 'open' : ''}><summary>페르소나 말 표시 · ${saved.length ? `${saved.length}개` : '없음'}</summary>
      <p class="hint">내 캐릭터가 표시마다 다른 언어로 말할 때 씁니다. 예를 들어 <b>"…"는 영어, […]는 이탈리아어</b>로 정해 두면 […] 줄도 대사로 저장되고, 기억에는 "(이탈리아어로)"처럼 무슨 언어로 한 말인지 함께 들어갑니다. 대사를 한국어로 적어도 됩니다.</p>
      <p class="hint">나중에 표시의 뜻을 바꿀 때는 지우지 말고 <b>시작 메시지</b>를 그때 번호로 한 새 줄을 더하세요. 그 메시지부터 새 규칙을 쓰고, 그 전 대사는 그때 규칙대로 남습니다. 내 메시지에만 적용되고, 저장하면 이미 저장된 대사도 다음 정리 때 다시 읽어 언어를 붙입니다(모델 호출 없음).</p>
      ${rows || '<p class="hint">아직 없습니다.</p>'}
      <div class="speech-actions"><button data-act="speechRowAdd">줄 더하기</button><button data-act="speechSave" ${dirty ? '' : 'disabled'}>저장</button>${dirty ? '<small class="hint">저장하지 않은 변경이 있습니다.</small>' : ''}</div>
    </details>`;
  }

  /* 배경 설정 · 진행 규칙: what the user set for the room from the start (kept as typed until 저장). */
  let setupDraft = null;
  let setupDraftRoom = null;
  function viewSetup() {
    if (!room || !info) return emptyRoom();
    const saved = { lore: info.setup?.lore || '', rules: info.setup?.rules || '' };
    if (setupDraftRoom !== room || !setupDraft) {
      setupDraft = { ...saved };
      setupDraftRoom = room;
    }
    const count = (t) => (t ? `${t.length.toLocaleString()}자` : '비어 있음');
    return `<div class="eyebrow">ROOM SETUP</div><h1>배경 설정 · 진행 규칙</h1>
      <p class="intro">이 방에서 처음부터 정해 둔 것을 적어 두는 곳입니다. 작가 노트에 있던 내용을 옮겨 와도 됩니다. 적은 그대로 들어가고 번역하지 않습니다. 기억 갱신을 꺼 둔 방에도 들어가고, <b>{{user}}</b> 같은 매크로는 바뀌지 않습니다. 칸마다 12,000자까지 쓸 수 있습니다.</p>
      <div class="paper"><h2>배경 설정 <small class="hint">사실 · ${count(saved.lore)}</small></h2>
        <p class="hint">인물, 관계, 과거, 비밀처럼 <b>이야기 속 사실</b>을 적어 주세요. 답글마다 기억 맨 앞에 들어가고, 기억을 정리하는 모델도 이 내용을 참고해 인물과 비밀을 헷갈리지 않습니다. 정리할 때는 앞부분 6,000자까지만 읽습니다.</p>
        <label class="full"><textarea class="event-field" data-setup="lore" style="min-height:260px" maxlength="12000" placeholder="예: 두 사람은 오래전부터 아는 사이다. 마을 사람들에게는 정체를 숨긴다.">${esc(setupDraft.lore)}</textarea></label>
      </div>
      <div class="paper"><h2>진행 규칙 <small class="hint">지시 · ${count(saved.rules)}</small></h2>
        <p class="hint">대사 형식, 문체, 금지 표현, 내 메시지의 표시를 어떻게 읽을지 같은 <b>지시</b>를 적어 주세요. 롤플레이 답글을 쓸 때 프롬프트 끝 쪽(출력 형식 자리)에 들어가 잘 지켜집니다. Marinara의 프롬프트 미리보기에서 확인할 수 있습니다.</p>
        <label class="full"><textarea class="event-field" data-setup="rules" style="min-height:260px" maxlength="12000" placeholder="예: 대사와 대사 사이에는 빈 줄. 내 메시지의 <…>는 고대 그리스어로 한 말.">${esc(setupDraft.rules)}</textarea></label>
      </div>
      <div class="buttons"><button class="primary" data-act="setupSave">저장</button></div>
      <p class="hint">내 메시지의 표시(""·[]·&lt;&gt; 등)를 기억에 언어로 남기는 설정은 <b>설정 → 기억 언어 → 페르소나 말 표시</b>에 있습니다.</p>`;
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
    const NAMES = { macro: '{{기억}} 자리 채우기', app: '답변 뒤 자동 정리와 이 화면', speakers: '말풍선 태그 되살리기', speakerNamesPrompt: '대사 이름 표시 지침', speakerPrompt: '화자 태그 생성 지침', speakerPreview: '화자 태그 미리보기 지침', speakerDryRun: '화자 태그 미리 생성 지침', namesPreview: '진행 규칙·대사 이름 미리보기', namesDryRun: '진행 규칙·대사 이름 미리 생성' };
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
    loadServerStatus();
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
      ${versionNote()}
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
        장면: ${esc(STATE[sj.state] || sj.state || '쉬는 중')}${sj.stage ? ` · ${esc(sj.stage)}` : ''}${lt ? `<br>마지막 장부 점검: 닫음 ${lt.closed}${lt.feelingsResolved != null ? ` (풀린 감정 ${lt.feelingsResolved})` : ''} · 합침 ${lt.merged}${lt.updated ? ` · 지금 상황 고침 ${lt.updated}` : ''}` : ''}</p>
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
      ${suggestionsCard()}
      ${trackersCard()}
      ${recentCard()}
      ${deadlinePaper()}
      ${costCard()}
      <div class="paper">
        <h2>최근 회상</h2>
        ${rc.at
          ? `<p class="hint">${rc.used === 'model' ? '기억 모델이 골랐습니다' : '빠른 방식으로 골랐습니다'} · ${(rc.ms / 1000).toFixed(1)}초</p>
             ${rc.picks?.length ? rc.picks.map((p) => `<p><span class="pill">${esc(p.id)}</span> ${esc(shown(p.title || ''))}${p.why ? `<br><small>${esc(p.why)}</small>` : ''}</p>`).join('') : '<p class="hint">고른 장면이 없습니다.</p>'}
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
          ${threads.map(({ t, how }) => `<a href="#" class="record-link record-row" data-goto-thread="${esc(t.id)}"><span class="pill ${t.status !== 'open' ? 'neutral' : ''}">${KIND[t.kind] || t.kind}</span><span class="row-main"><b title="${esc(t.title)}">${esc(shown(t.title))}</b><small>${esc(t.id)} · 이 장면에서 ${how}${how === '끝남' && t.closed?.how ? `: ${esc(shown(t.closed.how))}` : how === '바뀜' && t.latest?.text && sceneOf(t.latest.number) === s ? `: ${esc(shown(t.latest.text))}` : ''}${how !== '끝남' && t.status !== 'open' ? ' · 지금은 닫힘' : ''}</small></span><span class="chip-arrow">›</span></a>`).join('')}
          ${facts.map((f) => `<a href="#" class="record-link record-row" data-goto-fact="${esc(f.id)}"><span class="pill neutral">사실</span><span class="row-main"><b title="${esc(f.text)}">${f.about ? `${esc(nameShown(f.about))}: ` : ''}${esc(shown(f.text))}</b><small>${esc(f.id)}${f.state ? ` · ${esc(f.sceneId || s.id)} 기준` : ''}</small></span><span class="chip-arrow">›</span></a>`).join('')}
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
      ${pickedFacts.size ? `<div class="bulk-bar" role="region" aria-label="고른 사실"><span>${pickedFacts.size}개 고름</span><span class="buttons"><button class="ghost" data-act="factPickClear">고르기 풀기</button><button data-act="factBulkExclude">답변에서 빼기</button><button class="primary" data-act="factBulkDelete">${armed === 'factBulkDelete' ? '한 번 더 누르면 지웁니다' : '지우기'}</button></span></div>` : '<p class="hint">사실 앞의 네모를 누르면 여러 개를 골라 한 번에 답변에서 빼거나 지울 수 있습니다.</p>'}
      ${[...groups].map(([who, list]) => `<div class="paper"><h2>${esc(who)}</h2>${list
        .map((f) => {
          const replaced = f.replacedBy && ids.has(f.replacedBy);
          return `<div class="fact-row" data-fact="${esc(f.id)}"><input type="checkbox" class="pick-fact" data-pick-fact="${esc(f.id)}" ${pickedFacts.has(f.id) ? 'checked' : ''} aria-label="${esc(f.id)} 고르기"><label>${esc(f.id)}${f.unaware?.length ? ` · 모름: ${esc(f.unaware.join('·'))}` : ''}${f.guess?.length ? ` · 짐작만: ${esc(f.guess.join('·'))}` : ''}${f.edited || f.knowSet?.length || f.knownLock ? ' · 직접 고침' : ''}${replaced ? ` · ${esc(f.replacedBy)}로 바뀜(기억 칸에서 제외)` : ''}${superseded.has(f.id) ? ' · 기록 충돌에서 뒤로 물림(기억 칸에서 제외)' : ''}</label>
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

  /**
   * OOC로 본 메시지: the messages taken for talk outside the story (left out of scenes, facts and notes; plans decided
   * there become 작가 계획). Each can be set back to story, and any message can be marked OOC by its number.
   */
  function oocPaper() {
    const list = oocRoom === room ? oocList : null;
    const ROLE = { user: '사용자', assistant: 'AI', narrator: '나레이터' };
    const row = (m) => `<div class="ooc-row"><p><b>#${esc(m.number)}</b> ${esc(ROLE[m.role] || m.role)} · ${m.ooc ? 'OOC로 봄' : '이야기로 봄'}${m.set != null ? ' (직접 정함)' : ''}</p><p class="hint">${esc(m.preview)}</p>
      <div class="buttons">${m.ooc ? `<button class="ghost" data-act="oocSet" data-id="${esc(m.id)}" data-ooc="false">이야기로 보기</button>` : `<button class="ghost" data-act="oocSet" data-id="${esc(m.id)}" data-ooc="true">OOC로 보기</button>`}${m.set != null ? `<button class="ghost" data-act="oocSet" data-id="${esc(m.id)}" data-ooc="null">자동으로 되돌리기</button>` : ''}</div></div>`;
    return `<details class="paper" data-list="ooc" ${openLists.has('ooc') ? 'open' : ''}><summary>OOC로 본 메시지${list ? ` · ${list.items.filter((m) => m.ooc).length}개` : ''}</summary>
      <p class="hint">"OOC", "(OOC", "((" 로 시작하는 사용자 메시지와, 거기에 이야기 밖으로 답한 AI 메시지(이어지는 상의 포함)는 장면·사실·수첩에 넣지 않습니다. 거기서 정한 앞으로의 전개만 <b>작가 계획</b>으로 남깁니다. 잘못 본 메시지는 여기서 바로잡을 수 있습니다(새로 정리되는 기억부터 적용).</p>
      ${list ? (list.items.length ? list.items.map(row).join('') : '<p class="hint">OOC로 본 메시지가 없습니다.</p>') : '<div class="buttons"><button data-act="oocLoad">불러오기</button></div>'}
      <div class="buttons"><input id="oocNumber" type="number" min="1" placeholder="메시지 번호" style="max-width:9rem"><button class="ghost" data-act="oocMark">이 번호를 OOC로</button></div></details>`;
  }

  function threadRow(t) {
    const who = [t.who, t.toward].filter(Boolean).map(nameShown).join(' → ');
    const when = t.due ? `약속한 때 ${[t.due.date, t.due.time].filter(Boolean).join(' ')}` : t.period ? `기간 ${day(t.period.from)}~${day(t.period.to)}` : '';
    const closed = t.status !== 'open';
    return `<details class="event-row" data-tid="${esc(t.id)}"><summary><span class="event-no">${esc(t.id)}</span><span class="event-main"><b title="${esc(t.title)}">${esc(shown(t.title))}</b><small>${esc(who)}${when ? ` · ${esc(when)}` : ''}${t.unaware?.length ? ` · 모름: ${esc(t.unaware.map(nameShown).join('·'))}` : ''}${t.guess?.length ? ` · 짐작만: ${esc(t.guess.map(nameShown).join('·'))}` : ''}${closed ? ` · 닫힘: ${esc(shown(t.closed?.how))}` : ''}</small></span><span class="pill ${closed ? 'neutral' : ''}">${t.plan ? '작가 계획' : KIND[t.kind] || t.kind}</span></summary>
      <div class="event-body">
        <div class="form-grid" data-thread="${esc(t.id)}">
          <label class="full">제목<input data-f="title" value="${esc(t.title)}"></label>${trEdit(t.title)}
          <label class="full">설명<textarea class="event-field" data-f="detail">${esc(t.detail || '')}</textarea></label>${trEdit(t.detail)}
          ${t.plan ? `<label class="full">감추는 것 (답 없이 · 답변에 기본으로 들어가는 줄)<input data-f="mystery" value="${esc(t.mystery || '')}" placeholder="다음 장부 정리 때 저절로 적힙니다"></label>` : ''}
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
    const plans = open.filter((t) => t.plan);
    const groups = KIND_ORDER.map((k) => [k, open.filter((t) => t.kind === k && !t.plan && ledgerMatch(t)).sort(k === 'promise' ? byDue : () => 0)]).filter(([, l]) => l.length);
    return `<div class="eyebrow">LEDGER · ${open.length} OPEN</div><h1>아직 끝나지 않은 일</h1>
      <p class="intro">약속·감정·상태·비밀·미해결 일입니다. 항목을 누르면 제목과 설명을 고치실 수 있고, 잘못 닫힌 항목은 다시 열고 끝난 일은 닫으실 수 있습니다. 직접 고친 내용은 리롤해도 유지됩니다.</p>
      ${plans.length ? `<div class="paper"><h2>작가 계획 · ${plans.length}</h2><p class="hint">OOC(이야기 밖 대화)에서 정한 앞으로의 전개입니다. 답변에는 기본으로 <b>감추는 것</b>(답 없는 한 줄, 예: "손목 흉터가 생긴 진짜 이유")만 "아직 밝히지 말 것"으로 들어갑니다. 롤플 모델이 답을 모르면 인물이 미리 알아채는 일이 없습니다. 이야기에서 다 드러나면 닫힙니다.</p><div class="buttons"><button class="ghost ${info.planAnswers ? 'mark-button is-on' : ''}" data-act="planAnswers">${info.planAnswers ? '답까지 넣는 중 · 끄기' : '답은 넣지 않는 중 · 답까지 넣기'}</button></div>${info.planAnswers ? '<p class="hint">답까지 넣으면 복선을 맞춰 깔기는 쉬워지지만, 롤플 모델이 인물 생각이나 서술에 답을 흘릴 수 있습니다.</p>' : ''}${plans.map(threadRow).join('')}</div>` : ''}
      ${ledgerTools(open)}${roomLog()[0]?.a.undo ? `<div class="note" role="status">${esc(roomLog()[0].a.text)} <button data-act="undoAction" data-id="${roomLog()[0].i}">되돌리기</button></div>` : ''}
      ${groups.length ? groups.map(([k, l]) => `<div class="paper"><h2>${KIND[k]} · ${l.length}</h2>${l.map(pickRow).join('')}</div>`).join('') : (plans.length ? '' : '<div class="empty">열린 항목이 없습니다.</div>')}
      ${closed.length ? `<details class="paper"><summary>닫힌 항목 ${closed.length}개</summary>${closed.map(threadRow).join('')}</details>` : ''}
      ${oocPaper()}`;
  }

  /**
   * 약속: every promise of the room in one place, apart from the other open items. Kept ones and broken or called-off
   * ones stay listed under "끝난 약속" with how they ended, so a promise is not lost once it leaves the memory.
   * Rows are the usual item rows (edit, 중요/빼기, close, reopen).
   */
  function viewPromises() {
    if (!info) return emptyRoom();
    const promises = threadList().filter((t) => t.kind === 'promise' && !t.mergedInto);
    const state = new Map((info.deadlines || []).map((d) => [d.id, d]));
    const dueOf = (t) => t.due?.date || t.period?.to || '';
    const open = promises.filter((t) => t.status === 'open');
    const overdue = open.filter((t) => state.get(t.id)?.state === 'overdue').sort((a, b) => dueOf(a).localeCompare(dueOf(b)));
    const ahead = open.filter((t) => !overdue.includes(t)).sort((a, b) => (dueOf(a) ? 0 : 1) - (dueOf(b) ? 0 : 1) || dueOf(a).localeCompare(dueOf(b)) || (b.latest?.number ?? b.openedAt?.number ?? 0) - (a.latest?.number ?? a.openedAt?.number ?? 0));
    const ended = promises.filter((t) => t.status !== 'open').sort((a, b) => (b.closed?.at?.number ?? 0) - (a.closed?.at?.number ?? 0));
    const pinned = new Set(info.recallPrefs?.pinned || []);
    const badge = (t) => {
      const d = state.get(t.id);
      if (!d) return '';
      const text = d.state === 'overdue' ? `${Math.abs(d.days)}일 지남` : d.state === 'today' ? '오늘' : d.state === 'ahead' ? `D-${d.days}` : d.state === 'shelved' ? '기한 지나고 한동안 말 없음' : '';
      return text ? `<span class="pill ${d.state === 'overdue' ? '' : 'neutral'}">${esc(text)}</span>` : '';
    };
    const row = (t) => `<div class="promise-row">${badge(t)}${pinned.has(t.id) ? '<span class="pill">중요</span>' : ''}${threadRow(t)}</div>`;
    const section = (title, list, hint = '') => (list.length ? `<div class="paper"><h2>${title} · ${list.length}</h2>${hint ? `<p class="hint">${hint}</p>` : ''}${list.map(row).join('')}</div>` : '');
    return `<div class="eyebrow">PROMISES · ${open.length} OPEN</div><h1>약속</h1>
      <p class="intro">이 방의 약속만 모아 봅니다. 지켜야 할 약속은 기한이 가까운 것부터, 끝난 약속은 어떻게 끝났는지와 함께 남습니다. 항목을 누르면 고치거나 닫고 다시 열 수 있고, <b>중요</b>를 눌러 두면 기억 칸이 모자라도 늘 먼저 들어갑니다. 답변에 넣는 기억 칸에서도 약속은 감정·상태보다 먼저 들어갑니다.</p>
      ${open.length || ended.length ? '' : '<div class="empty">아직 약속이 없습니다. 정리가 끝나면 이야기 속 약속이 여기에 모입니다.</div>'}
      ${section('기한 지난 약속', overdue, '작중 날짜로 기한이 지났지만 아직 지켰다는 말이 없는 약속입니다. 지켰거나 깨졌으면 닫아 주세요.')}
      ${section('지켜야 할 약속', ahead)}
      ${ended.length ? `<details class="paper" data-list="promises-ended" ${openLists.has('promises-ended') ? 'open' : ''}><summary>끝난 약속 ${ended.length}개 (지킨 것·깨진 것·취소된 것)</summary>${ended.map(row).join('')}</details>` : ''}`;
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

  /** 수첩 tab: 인물의 수첩 on a page of its own (it comes with the 인물·장소 data). */
  function viewNotebook() {
    if (!info) return emptyRoom();
    if (!world || worldRoom !== room) return worldError ? `<div class="note" role="alert">수첩을 불러오지 못했습니다. ${esc(worldError)} 서버의 기억 모듈도 함께 업데이트했는지 확인해 주세요.</div>` : `<div class="empty">${icon('refresh')}불러오는 중입니다…</div>`;
    const count = Object.values(world.notes || {}).reduce((n, l) => n + l.length, 0);
    return `<div class="eyebrow">NOTEBOOK · ${count} NOTES</div><h1>인물의 수첩</h1>
      ${world.notebook ? notebookPaper(world, armed) : '<div class="note" role="status">이 방에서는 <b>인물의 수첩</b>이 꺼져 있습니다. <button data-tab="settings">설정 → 추가 기능에서 켜기</button></div>'}`;
  }

  /**
   * 인물의 수첩: each character's notes (대하는 법 / 속마음·다짐), newest last, each with the
   * scene it came from. A note can be reworded (kept when the scenes are read again), marked ★ (always kept, always
   * goes in first), or deleted (not written back). No hand-made notes: the scenes write them.
   */
  /**
   * 수첩만 다시 받기: the notes of scenes that are already organized, read again from the chat without organizing again.
   * It runs in the background a few scenes at a time; chatting goes on meanwhile.
   */
  function notebookRebuildPaper(armedNow) {
    const job = info?.notebookJob || { state: 'idle' };
    const stats = job.stats || {};
    const dropped = ['repeat', 'copied', 'noEvidence', 'notAllowed', 'tooMany'].reduce((n, k) => n + (stats[k] || 0), 0);
    let status = '';
    if (job.state === 'running') status = `<p class="note" role="status">${icon('refresh')} 수첩을 받는 중입니다${job.stage ? ` · ${esc(job.stage)}` : ''}. 채팅은 그대로 계속하셔도 됩니다.</p>`;
    else if (job.state === 'done') status = `<p class="hint">지난번: 장면 ${job.done}개를 읽고 메모 ${job.kept}개를 적었습니다${dropped ? ` (겹치거나 근거가 없는 ${dropped}개는 뺐습니다)` : ''}.${job.total === 0 ? ' 다시 받을 장면이 없었습니다.' : ''}</p>`;
    else if (job.state === 'stopped') status = `<p class="hint">멈췄습니다. 장면 ${job.done}/${job.total}개까지 읽고 메모 ${job.kept}개를 적었습니다. 나머지 장면의 메모는 그대로입니다.</p>`;
    else if (job.state === 'error') status = `<p class="note" role="alert">수첩 받기가 멈췄습니다. ${esc(job.error || '')}${job.done ? ` (장면 ${job.done}/${job.total}개까지 저장했습니다)` : ''}</p>`;
    const buttons = job.state === 'running'
      ? '<button class="ghost" data-act="noteRebuildStop">멈추기</button>'
      : `<button data-act="noteRebuild">빈 장면·상황 없는 메모만 받기</button><button class="ghost" data-act="noteRebuildAll">${armedNow === 'noteRebuildAll' ? '한 번 더 누르면 모든 장면을 다시 받습니다' : '모든 장면 다시 받기'}</button>`;
    return `<div class="paper"><h2>수첩만 다시 받기</h2>
      <p class="hint">이미 정리된 장면의 원문을 다시 읽고 인물의 수첩만 적습니다. 장면 기억은 그대로이고, 몇 장면씩 묶어 세 묶음씩 동시에 뒤에서 처리하니 그동안 채팅을 계속할 수 있습니다. <b>빈 장면·상황 없는 메모만 받기</b>는 메모가 없는 장면과, 상황 줄이 생기기 전에 적힌 메모가 있는 장면만 읽습니다. <b>모든 장면 다시 받기</b>는 지금 메모를 장면에서 새로 적은 것으로 바꿉니다(★ 표시·직접 고친 메모·지운 메모는 그대로 지켜집니다).</p>
      ${status}<div class="buttons">${buttons}</div></div>`;
  }

  /** 수첩 언어: the language new notes are written in (this room). */
  function notebookLanguagePaper(w) {
    const NAME = { ko: '한국어', en: '영어', zh: '중국어' };
    const now = NAME[w.notebookWriteLanguage] || '';
    const set = w.notebookLanguage || 'write';
    const options = [['write', `기억 정리 언어 따라감 (지금: ${now})`], ['character', '인물이 말하는 언어 (병기하는 인물은 한국어)'], ['ko', '한국어'], ['en', '영어'], ['zh', '중국어 (간체)']];
    return `<div class="paper"><h2>수첩 언어</h2><label>새 메모를 적을 언어<select id="setNoteLang">${options.map(([v, t]) => `<option value="${v}" ${set === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <p class="hint">메모는 말투 없는 메모체라 어느 언어로 적어도 됩니다. 기억을 영어로 정리하는 방은 영어로 두면 답변에 넣을 때 번역이 필요 없고, 서재에는 한국어 번역이 함께 보입니다. 바꾸면 <b>새로 적는 메모부터</b> 그 언어로 적습니다. 지금 메모까지 바꾸려면 아래 <b>모든 장면 다시 받기</b>를 눌러 주세요.</p></div>`;
  }

  function notebookPaper(w, armedNow) {
    if (!w || !w.notebook) return '';
    const people = Object.entries(w.notes || {});
    const titles = w.sceneTitles || {};
    const KIND = { about: '대하는 법', heart: '속마음·다짐' };
    const note = (n) => `<div class="notebook-note" data-note="${esc(n.id)}">
        <div class="notebook-head"><span class="pill ${n.kind === 'heart' ? '' : 'neutral'}">${KIND[n.kind] || n.kind}</span>${n.about ? `<small>${esc(nameShown(n.about))}에 대해</small>` : ''}${n.edited ? '<small>직접 고침</small>' : ''}${sceneRefs(sceneRef(n.sceneId, '', titles))}</div>
        <label class="world-field"><span>상황</span><input data-note-when="${esc(n.id)}" value="${esc(n.when || '')}" placeholder="그때 무슨 일이 있었는지 (비어 있으면 다시 받기로 채워짐)" aria-label="${esc(n.who)}의 메모 상황"></label>${n.when ? trEdit(n.when) : ''}
        <textarea class="event-field" data-note-text="${esc(n.id)}" aria-label="${esc(n.who)}의 메모">${esc(n.text)}</textarea>${trEdit(n.text)}
        <div class="buttons"><button data-act="noteSave" data-id="${esc(n.id)}">고친 내용 저장</button><button class="ghost ${n.star ? 'mark-button is-on' : ''}" data-act="${n.star ? 'noteUnstar' : 'noteStar'}" data-id="${esc(n.id)}">${n.star ? '★ 중요' : '☆ 중요로 표시'}</button><button class="ghost" data-act="noteDelete" data-id="${esc(n.id)}">${armedNow === `noteDelete:${n.id}` ? '한 번 더 누르면 지웁니다' : '지우기'}</button></div>
      </div>`;
    const person = ([who, list]) => `<details class="world-card" data-list="notebook:${esc(who)}" ${openLists.has(`notebook:${who}`) ? 'open' : ''}><summary><b>${esc(nameShown(who))}의 수첩</b> · ${list.length}개${list.some((n) => n.star) ? ` · ★ ${list.filter((n) => n.star).length}` : ''}</summary>${list.map(note).join('')}</details>`;
    return `${notebookLanguagePaper(w)}${notebookRebuildPaper(armedNow)}<div class="paper"><h2>인물의 수첩 · ${people.length}명</h2>
      <p class="hint">인물마다 마음에 담아 둔 것을 그 인물 시점의 짧은 메모로 적어 둡니다(말투는 흉내 내지 않고, 답변을 쓰는 모델이 캐릭터 말투로 풀어냄). 메모마다 <b>상황</b>(그때 무슨 일이 있었는지)이 함께 적혀 답변에도 같이 들어가서, 메모만 읽어도 무슨 일인지 알 수 있습니다(한국어 병기 대사를 하는 인물은 한국어로, 영어로만 말하는 인물은 영어로 적고 아래에 한국어 번역을 보여 줍니다). <b>대하는 법</b>은 그 인물이 상대를 어떻게 보고 어떻게 대하기로 했는지, <b>속마음·다짐</b>은 마음에 걸리는 것과 하기로 정한 것입니다. 상대가 어떤 사람인지 같은 사실은 <b>알게 된 사실</b>이 맡고, 수첩에는 같은 내용을 다시 적지 않습니다. 답변에는 지금 장면에 있는 인물의 것만 들어갑니다. 인물마다 핵심 3개(★ 먼저, 그다음 최근 것)는 늘, 지금 대화와 뜻이 가까운 것 3개까지는 더 들어갑니다(임베딩이 없으면 낱말로 찾음). 다른 인물은 이 수첩을 모르는 것으로 다룹니다. 사용자 캐릭터의 수첩은 만들지 않습니다.</p>
      ${people.length ? people.map(person).join('') : '<p class="hint">아직 없습니다. 켠 뒤에 정리되는 장면부터 채워집니다.</p>'}</div>`;
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
      ? `<div class="note" role="status"><b>자동으로 적용함</b>${t.applied.map((x) => `<div>자동으로 적용함: ${esc(x.text)}${sceneRefs(sceneRef(x.sceneId, '에서 받음', w.sceneTitles))} <button class="ghost" data-act="trackerUndoApplied" data-aid="${esc(x.id)}">${armedNow === `trackerUndoApplied:${x.id}` ? '한 번 더 누르면 되돌립니다. 그 뒤로 고치거나 더한 시작일도 함께 사라집니다' : '되돌리기'}</button></div>`).join('')}</div>`
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
    loadServerStatus();
    return `<div class="eyebrow">INJECTION · 약 ${tokens(info.rendered)} 토큰</div><h1>주입 확인</h1>
      <p class="intro">지금 프리셋의 {{기억}} 자리에 들어가는 내용 그대로입니다. 회상한 장면은 답변마다 바뀝니다.</p>
      ${injectBars()}${costCard()}${recallCard()}${recallTestCard()}${recallReasonsPaper(recallReportRoom === room ? recallReportData : null, info.recallPrefs, recallReportRoom !== room || (!recallReportData && !recallReportError) ? 'loading' : recallReportError)}
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
    const picks = (rc.picks || []).map((p) => `<a href="#" class="record-link record-row" data-goto-scene="${esc(p.id)}"><span class="pill">떠오름</span><span class="row-main"><b>${esc(shown(p.title || scene(p.id)?.title || p.id))}</b><small>${esc(p.id)}${p.why ? ` · ${esc(p.why)}` : ''}</small></span><span class="chip-arrow">›</span></a>`).join('');
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
        ${speechMarksPaper()}
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

  /* ---------- 이야기: 시간순 · 줄기 ---------- */

  /** The story's date at the start of a scene's time ("25-07-18 (금)"), or '' when the scene has none. */
  const dayOfScene = (sc) => String(sc?.time || '').match(/^\s*\d{2,4}-\d{1,2}-\d{1,2}(?:\s*\([^)]*\))?/)?.[0]?.trim() || '';
  const lineKey = (name) => String(name || '').toLowerCase().replace(/[\s"'“”‘’「」『』.,!?·~\-_()]/g, '');
  /** The room's story lines, folded from the scenes as the module does: { name, scenes: [ids], now, nowScene }. */
  function storyLines() {
    const map = new Map();
    for (const sc of store?.scenes || []) {
      if (sc.ooc) continue;
      for (const l of sc.lines || []) {
        const key = lineKey(l.name);
        if (!key) continue;
        const line = map.get(key) || { name: l.name, scenes: [], now: null, nowScene: null };
        line.scenes.push(sc.id);
        if (l.now) { line.now = l.now; line.nowScene = sc.id; }
        map.set(key, line);
      }
    }
    const order = (id) => (store?.scenes || []).findIndex((x) => x.id === id);
    return [...map.values()].sort((a, b) => order(b.scenes.at(-1)) - order(a.scenes.at(-1)));
  }
  /** How what began in a scene went on (from the open items): ended, or where it stands now. */
  function afterOf(sc) {
    const inside = (n) => typeof n === 'number' && sc.start <= n && n <= sc.end;
    const out = [];
    for (const t of threadList()) {
      if (t.plan || t.mergedInto || !inside(t.openedAt?.number ?? t.evidence?.[0]?.number)) continue;
      if (t.status !== 'open' && t.closed?.how && !/에 합침/.test(t.closed.how)) out.push({ t, text: shown(t.closed.how), end: sceneOf(t.closed?.at?.number ?? t.closed?.evidence?.[0]?.number) });
      else if (t.status === 'open' && t.latest?.text && (t.latest.number ?? 0) > sc.end) out.push({ t, text: shown(t.latest.text), now: true, end: sceneOf(t.latest.number) });
    }
    return out.slice(0, 3);
  }

  function viewTimeline() {
    if (!store) return emptyRoom();
    const scenes = (store.scenes || []).filter((x) => !x.ooc);
    if (!scenes.length) return `<h1>시간순</h1><div class="empty">${icon('clock')}아직 장면이 없습니다.</div>`;
    const chapterOf = new Map();
    for (const c of store.chapters || []) for (const id of c.scenes || []) chapterOf.set(id, c);
    const lines = storyLines();
    const days = [];
    for (const sc of scenes) {
      const d = dayOfScene(sc) || '날짜 모름';
      if (!days.length || days.at(-1).day !== d) days.push({ day: d, list: [] });
      days.at(-1).list.push(sc);
    }
    let lastChapter = null;
    const card = (sc) => {
      const c = chapterOf.get(sc.id);
      const chapterHead = c && c !== lastChapter ? `<div class="tl-chapter"><span class="pill neutral">${esc(c.id)}</span> ${esc(shown(c.title))}</div>` : '';
      lastChapter = c || lastChapter;
      const time = String(sc.time || '').replace(dayOfScene(sc), '').trim();
      const star = (sc.events || []).some((e) => e.importance === 'critical');
      const after = afterOf(sc);
      const own = lines.filter((l) => l.scenes.includes(sc.id));
      return `${chapterHead}<div class="tl-scene">
        <div class="tl-head">${sceneLink(sc)}<small>${esc([time, sc.place].filter(Boolean).join(' · '))}</small>${star ? '<span class="pill">★ 결정적</span>' : ''}</div>
        <p>${esc(shown(sc.summary))}</p>
        ${after.map((a) => `<p class="tl-after"><small>${a.now ? '지금' : '그 뒤'}</small> ${esc(shown(a.t.title))} — ${esc(a.text)}${a.end && a.end.id !== sc.id ? ` ${sceneLink(a.end)}` : ''}</p>`).join('')}
        ${own.length ? `<p class="tl-lines">${own.map((l) => `<span class="pill neutral">줄기 · ${esc(l.name)}</span>`).join(' ')}</p>` : ''}
      </div>`;
    };
    return `<div class="eyebrow">STORY · ${scenes.length} SCENES</div><h1>시간순</h1>
      <p class="intro">작중 날짜별로 장면을 이어 보여 줍니다. 장면에서 시작된 일이 그 뒤 어떻게 됐는지(그 뒤 · 지금)와 그 장면의 줄기도 함께 보입니다. 장면 번호를 누르면 장면·챕터 화면에서 열립니다.</p>
      ${days.map((d) => `<section class="tl-day"><div class="tl-stamp"><b>${esc(d.day)}</b><small>장면 ${d.list.length}</small></div><div class="tl-list">${d.list.map(card).join('')}</div></section>`).join('')}`;
  }

  function viewLines() {
    if (!store) return emptyRoom();
    const lines = storyLines();
    const titleOf = (id) => (store.scenes || []).find((x) => x.id === id);
    return `<div class="eyebrow">STORY LINES · ${lines.length}</div><h1>줄기</h1>
      <p class="intro">떨어진 장면이라도 같은 일을 따라가면 한 줄기로 묶고, 줄기마다 지금 어디까지 왔는지 한 줄을 둡니다. 장면을 정리할 때 함께 적고(호출이 따로 늘지 않음), 답변에는 요즘 줄기와 떠오른 장면의 줄기가 들어갑니다.</p>
      ${lines.length ? lines.map((l) => `<div class="paper"><h2>${esc(l.name)}</h2>
        <div class="record-links">${l.scenes.map((id) => sceneLink(titleOf(id) || { id, title: '' })).join('')}</div>
        ${l.now ? `<p class="tl-after"><small>지금</small> ${esc(shown(l.now))}${l.nowScene ? ` <small>(${esc(l.nowScene)} 기준)</small>` : ''}</p>` : '<p class="hint">지금 상태가 아직 없습니다.</p>'}
      </div>`).join('') : `<div class="empty">${icon('folder')}아직 줄기가 없습니다. 0.30.0부터 새로 정리되는 장면에 줄기가 붙습니다(이미 정리된 장면은 다시 정리하면 붙습니다).</div>`}`;
  }

  /* ---------- 인물별 ---------- */

  let selectedPerson = '';
  function personNames() {
    const set = new Set([...(store?.cast || info?.cast || []), ...(store?.personas || info?.personas || [])]);
    for (const c of world?.cards || []) set.add(c.name);
    for (const f of store?.facts || []) if (f.about) set.add(f.about);
    return [...set].filter(Boolean);
  }
  function viewPerson() {
    if (!store) return emptyRoom();
    const people = personNames();
    if (!people.length) return `<h1>인물별</h1><div class="empty">${icon('person')}아직 인물이 없습니다.</div>`;
    if (!people.includes(selectedPerson)) selectedPerson = people[0];
    const p = selectedPerson;
    const all = store.facts || [];
    const facts = all.filter((f) => f.about === p && !(f.replacedBy && all.some((x) => x.id === f.replacedBy)));
    const notes = (world?.notes || {})[p] || [];
    const card = (world?.cards || []).find((c) => c.name === p);
    const items = threadList().filter((t) => t.status === 'open' && !t.plan && [t.who, t.toward].some((n) => n && String(n).includes(p)));
    const scenes = (store.scenes || []).filter((x) => !x.ooc && (x.present || []).includes(p));
    const quotes = [];
    for (const sc of [...(store.scenes || [])].reverse()) for (const e of sc.events || []) for (const q of e.quotes || []) if ((q.by === p || q.to === p) && quotes.length < 12) quotes.push({ sc, q });
    // As on the names tab: a foreign term and its Korean translation are one "원어(번역)", the Korean half not again.
    const allCalls = names?.address?.entries || [];
    const callLabel = (e) => { const t = allCalls.find((x) => x.id === e.pairWith); return t ? `${e.term}(${t.term})` : e.term; };
    const calls = allCalls.filter((e) => (e.from === p || e.to === p) && !(e.pairOf && allCalls.some((x) => x.id === e.pairOf)));
    const field = (label, v) => (v && (!Array.isArray(v) || v.length) ? `<dt>${label}</dt><dd>${esc(Array.isArray(v) ? v.join(' · ') : v)}</dd>` : '');
    const section = (key, title, count, body, openNow = false) => `<details class="paper person-sec" data-list="person:${esc(key)}" ${openLists.has(`person:${key}`) || openNow ? 'open' : ''}><summary><b>${title}</b> · ${count}</summary>${body}</details>`;
    return `<div class="eyebrow">PEOPLE · ${people.length}</div><h1>인물별</h1>
      <p class="intro">한 사람에 대한 기억을 한곳에 모았습니다: 지금 상태, 부르는 말, 알게 된 사실, 수첩, 끝나지 않은 일, 함께한 장면과 주고받은 대사. 고치는 것은 각 항목의 원래 화면에서 합니다(링크).</p>
      <div class="person-chips">${people.map((n) => `<button class="${n === p ? 'selected' : ''}" data-act="selectPerson" data-id="${esc(n)}">${esc(nameShown(n))}</button>`).join('')}</div>
      <div class="paper"><h2>${esc(nameShown(p))}</h2>
        ${card ? `<dl class="person-now">${field('있는 곳', card.location)}${field('차림', card.outfit)}${field('다친 곳', card.injuries)}${field('가진 것', card.carrying)}${field('기분', card.mood)}${field('그 밖', card.other)}</dl>` : '<p class="hint">지금 상태 기록이 없습니다(상태·장소·물건에서 켜고 고칠 수 있음).</p>'}
        ${calls.length ? `<p class="hint">부르는 말: ${calls.map((e) => `${esc(nameShown(e.from))} → ${esc(nameShown(e.to))} “${esc(callLabel(e))}”`).join(' · ')}</p>` : ''}
        <div class="buttons"><button class="ghost" data-tab="world">상태 고치기</button><button class="ghost" data-tab="names">이름·호칭 고치기</button></div>
      </div>
      ${section('facts', '알게 된 사실', facts.length, facts.length ? facts.map((f) => `<p class="person-row">${esc(shown(f.text))}${f.state ? ` <small>(${esc(f.sceneId || '')} 기준)</small>` : ''} <a href="#" class="record-link chip" data-goto-fact="${esc(f.id)}"><span class="chip-id">${esc(f.id)}</span></a></p>`).join('') : '<p class="hint">없습니다.</p>', true)}
      ${section('notes', '수첩 (본인만 아는 다짐)', notes.length, notes.length ? notes.map((n) => `<p class="person-row">${n.star ? '★ ' : ''}${n.when ? `<small>(${esc(shown(n.when))})</small> ` : ''}${esc(shown(n.text))}</p>`).join('') + '<div class="buttons"><button class="ghost" data-tab="notebook">수첩에서 고치기</button></div>' : '<p class="hint">없습니다.</p>')}
      ${section('items', '이 사람의 끝나지 않은 일', items.length, items.length ? items.map((t) => `<p class="person-row"><span class="pill ${t.kind === 'promise' ? '' : 'neutral'}">${esc(KIND[t.kind] || t.kind)}</span> ${esc(shown(t.title))} <a href="#" class="record-link chip" data-goto-thread="${esc(t.id)}"><span class="chip-id">${esc(t.id)}</span></a></p>`).join('') : '<p class="hint">없습니다.</p>', items.length > 0)}
      ${section('scenes', '함께한 장면', scenes.length, scenes.length ? `<div class="record-links">${scenes.slice(-30).map((x) => sceneLink(x)).join('')}</div>` : '<p class="hint">없습니다.</p>')}
      ${section('quotes', '주고받은 대사 (최근 12개)', quotes.length, quotes.length ? quotes.map(({ sc, q }) => { const l = quoteLine(q); return `<div class="quote-card"><small>${esc(sc.id)} · ${esc(l.who)}</small><blockquote>${esc(l.text)}</blockquote></div>`; }).join('') : '<p class="hint">없습니다.</p>')}`;
  }

  /* ---------- 할 일: 거르기 · 여러 개 고르기 · 되돌리기 ---------- */

  let ledgerFilter = 'all';
  let ledgerWho = 'all';
  const pickedThreads = new Set();
  /** What the person did here, newest first, each with how to undo it: { at, text, undo: { act, ids } }. */
  const actionLog = [];
  const OLD_AFTER = 40;
  /** The newest message number the open items know of (how far the story has got). */
  function storyReach() {
    let n = info?.scenes?.coveredThrough || 0;
    for (const t of threadList()) for (const p of [...(t.evidence || []), ...(t.clues || [])]) if ((p.number || 0) > n) n = p.number;
    return n;
  }
  /** The last message where an item came up in the story itself (a line the check wrote does not count). */
  function lastMention(t) {
    const nums = [...(t.evidence || []), ...(t.clues || [])].map((p) => p.number).filter((n) => typeof n === 'number');
    if (typeof t.latest?.number === 'number' && !(t.latest.by === 'check' || t.latest.scene)) nums.push(t.latest.number);
    return nums.length ? Math.max(...nums) : t.openedAt?.number || 0;
  }
  const isOld = (t) => storyReach() - lastMention(t) >= OLD_AFTER;
  function ledgerMatch(t) {
    if (ledgerWho !== 'all' && ![t.who, t.toward].some((n) => n && String(n).includes(ledgerWho))) return false;
    if (ledgerFilter === 'all') return true;
    if (ledgerFilter === 'old') return isOld(t);
    return t.kind === ledgerFilter;
  }
  function ledgerTools(open) {
    const shownNow = open.filter((t) => !t.plan && ledgerMatch(t));
    const allOn = shownNow.length && shownNow.every((t) => pickedThreads.has(t.id));
    const people = [...new Set(open.flatMap((t) => [t.who, t.toward]).filter(Boolean).flatMap((n) => String(n).split(/\s*[·,]\s*/)))];
    const chip = (id, label) => `<button class="subtab ${ledgerFilter === id ? 'selected' : ''}" data-act="ledgerFilter" data-id="${esc(id)}">${esc(label)}</button>`;
    return `<div class="ledger-tools">
        <div class="subtabs">${chip('all', '전체')}${chip('old', `오래됨 (${OLD_AFTER}개 메시지 넘게 언급 없음) · ${open.filter((t) => !t.plan && isOld(t)).length}`)}${KIND_ORDER.map((k) => chip(k, KIND[k])).join('')}
          <select id="ledgerWho" aria-label="인물로 거르기"><option value="all">모든 인물</option>${people.map((n) => `<option value="${esc(n)}" ${ledgerWho === n ? 'selected' : ''}>${esc(nameShown(n))}</option>`).join('')}</select></div>
        <label class="pick-all"><input type="checkbox" id="pickAllLedger" ${allOn ? 'checked' : ''}> 보이는 ${shownNow.length}개 모두 고르기</label>
        ${pickedThreads.size ? `<div class="bulk-bar" role="region" aria-label="고른 항목"><span>${pickedThreads.size}개 고름</span><span class="buttons"><button class="ghost" data-act="bulkClear">고르기 풀기</button><button class="primary" data-act="bulkClose">고른 항목 닫기</button></span></div>` : ''}
      </div>`;
  }
  /** One open item with its pick box (the box sits outside the folding row, so ticking it does not open the row). */
  const pickRow = (t) => (t.status === 'open' && !t.plan ? `<div class="pick-row"><input type="checkbox" data-pick-thread="${esc(t.id)}" ${pickedThreads.has(t.id) ? 'checked' : ''} aria-label="${esc(t.id)} 고르기">${threadRow(t)}</div>` : threadRow(t));
  function logAction(text, undo, roomId = room) {
    actionLog.unshift({ at: new Date(), text, undo, room: roomId });
    actionLog.length = Math.min(actionLog.length, 8);
  }
  /** The log entries of the room on screen, each with its place in actionLog (the undo button points at that place). */
  const roomLog = () => actionLog.map((a, i) => ({ a, i })).filter(({ a }) => a.room === room);
  /**
   * Everything the person picked, armed or typed for the room they were in. Called wherever `room` changes, so a
   * one-click bulk delete, close or undo can never reach the same ids in another room.
   */
  function resetRoomUi() {
    pickedFacts.clear();
    pickedThreads.clear();
    actionLog.length = 0;
    armed = '';
    speechRows = null;
    speechRowsRoom = null;
    scenePicker = null;
    trackerDraft = null;
    namePreview = null;
    restorePreview = null;
    worldForm = { person: '', place: '', keep: '', keepOwner: '' };
    nameForm = { source: '', target: '', display: '', text: true };
    addressForm = { id: '', from: '', to: '', term: '', note: '' };
  }

  /* ---------- 한눈에: 버전 · 세고 있는 것 · 손볼 것 · 최근 바뀐 것 · 기억 비용 ---------- */

  let serverStatus = null;
  let serverStatusLoading = false;
  function loadServerStatus() {
    if (serverStatus || serverStatusLoading) return;
    serverStatusLoading = true;
    api('GET', '/status').then((st) => { serverStatus = st; serverStatusLoading = false; render(); }).catch(() => { serverStatusLoading = false; });
  }
  function versionNote() {
    const server = info?.version;
    if (!server || !VERSION || VERSION.includes('__VERSION__') || server === VERSION) return '';
    const newer = (a, b) => { const x = String(a).split(/[.-]/).map(Number), y = String(b).split(/[.-]/).map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
    const extNewer = newer(VERSION, server);
    return `<div class="note" role="status"><b>${extNewer ? '기억 모듈을 업데이트해 주세요' : '기억 서재(확장)를 업데이트해 주세요'}</b> · 확장 v${esc(VERSION)} · 모듈 v${esc(server)}<br>
      ${extNewer ? '화면(확장)이 서버의 기억 모듈보다 새 버전이라 새 기능이 동작하지 않을 수 있습니다. 서버에서 설치 명령(install.sh)을 한 번 실행하면 맞춰집니다.' : '서버의 기억 모듈이 화면(확장)보다 새 버전입니다. 저장소의 deliverable 폴더에서 새 ZIP을 받아 개인 확장을 바꿔 주세요.'}</div>`;
  }
  function trackersCard() {
    const items = world?.trackers?.items || [];
    if (!items.length) return '';
    return `<div class="paper"><div class="paper-toolbar"><h2>세고 있는 것</h2><button class="ghost" data-tab="world">고치기 · 추가</button></div>
      <div class="tracker-tiles">${items.map((it) => `<div class="tracker-tile"><small>${withKo(it.label)}</small><b>${esc(it.status?.text || '')}</b>${it.inject && it.inject !== 'off' ? '<small>답변에 넣음</small>' : ''}</div>`).join('')}</div></div>`;
  }
  function suggestionsCard() {
    const open = threadList().filter((t) => t.status === 'open' && !t.plan);
    const old = open.filter(isOld);
    const overdue = (info?.deadlines || []).filter((d) => d.state === 'overdue');
    const plans = threadList().filter((t) => t.status === 'open' && t.plan);
    const rows = [];
    if (old.length) rows.push(`<div class="next-row"><span class="sev bad"></span><div><b>오래된 항목 ${old.length}개</b><small>${OLD_AFTER}개 메시지 넘게 언급이 없는 끝나지 않은 일입니다. 끝났는지 한 번에 보고 골라서 닫을 수 있습니다.</small></div><button class="primary" data-act="openOld">확인하기</button></div>`);
    if (overdue.length) rows.push(`<div class="next-row"><span class="sev"></span><div><b>지난 기한 ${overdue.length}개</b><small>${overdue.slice(0, 2).map((d) => esc(shown(d.title))).join(' · ')}</small></div><button data-tab="ledger">보기</button></div>`);
    if (plans.length) rows.push(`<div class="next-row"><span class="sev ok"></span><div><b>작가 계획 ${plans.length}개</b><small>이야기에서 이미 드러난 계획이 있으면 닫아 주세요(답변에 "인물들은 모름"으로 계속 들어갑니다).</small></div><button data-tab="ledger">보기</button></div>`);
    if (!rows.length) return '';
    return `<div class="paper"><h2>손볼 것</h2>${rows.join('')}</div>`;
  }
  function recentCard() {
    const day = Date.now() - 86400000;
    const auto = threadList().filter((t) => t.status !== 'open' && t.updatedAt && Date.parse(t.updatedAt) > day && !/직접/.test(t.closed?.how || '')).slice(0, 5);
    const logged = roomLog();
    if (!logged.length && !auto.length) return '';
    const time = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `<div class="paper"><h2>최근 바뀐 것</h2>
      ${logged.map(({ a, i }) => `<div class="recent-row"><small>${time(a.at)}</small><span>${esc(a.text)}</span>${a.undo ? `<button class="ghost" data-act="undoAction" data-id="${i}">되돌리기</button>` : '<span></span>'}</div>`).join('')}
      ${auto.map((t) => `<div class="recent-row"><small>자동</small><span>${esc(t.id)} ${esc(shown(t.title))} 닫힘 — ${esc(shown(t.closed?.how || ''))}</span><button class="ghost" data-act="reopen" data-id="${esc(t.id)}">다시 열기</button></div>`).join('')}
    </div>`;
  }
  const kTok = (n) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n || 0));
  function costCard() {
    const u = serverStatus?.usage;
    if (!u) return '';
    const line = (label, d) => `<div class="cost-row"><span>${label}</span><b>호출 ${d.calls}번</b><small>입력 ${kTok(d.input)} · 출력 ${kTok(d.output)} 토큰${d.estimated ? ' (일부 어림)' : ''}</small></div>`;
    return `<div class="paper"><h2>기억 비용</h2><p class="hint">기억 모듈이 정리·점검·번역에 쓴 모델 호출입니다(답변 자체는 빼고, 모든 방 합계).</p>${line('오늘', u.today)}${line('최근 7일', u.week)}</div>`;
  }

  /* ---------- 주입 확인: 섹션별 분량 ---------- */

  function injectBars() {
    const text = info?.rendered || '';
    if (!text) return '';
    const parts = [];
    let current = { name: '안내문', size: 0 };
    for (const line of text.split('\n')) {
      const head = line.match(/^\[([^\]\n]{1,40})\]/);
      if (head && !/^\[(Memory:|End of memory)/.test(line)) { parts.push(current); current = { name: head[1], size: 0 }; }
      current.size += line.length + 1;
    }
    parts.push(current);
    const total = parts.reduce((n, p) => n + p.size, 0) || 1;
    const merged = [...parts.reduce((m, p) => m.set(p.name, (m.get(p.name) || 0) + p.size), new Map())].sort((a, b) => b[1] - a[1]);
    return `<div class="paper"><h2>섹션별 분량</h2>${merged.map(([name, size]) => `<div class="bar-row"><span>${esc(name)}</span><span class="bar"><span style="width:${Math.max(1, Math.round((size / total) * 100))}%"></span></span><small>${Math.round((size / total) * 100)}%</small></div>`).join('')}</div>`;
  }

  const VIEWS = { timeline: viewTimeline, lines: viewLines, person: viewPerson, notebook: viewNotebook, home: viewHome, setup: viewSetup, scenes: viewScenes, search: viewSearch, facts: viewFacts, ledger: viewLedger, promises: viewPromises, life: viewLife, world: viewWorld, names: viewNames, inject: viewInject, settings: viewSettings };

  /** The screens of the current tab, as a row of chips under the panel's top (nothing for a one-screen tab). */
  function subTabs() {
    const views = groupOf(tab)[3];
    if (views.length < 2) return '';
    return `<div class="subtabs" role="tablist">${views.map((v) => `<button class="subtab ${v === tab ? 'selected' : ''}" role="tab" aria-selected="${v === tab}" data-tab="${v}">${esc(SUBTAB[v] || v)}</button>`).join('')}</div>`;
  }

  function render() {
    if (!root) return;
    launcher?.setAttribute('data-theme', theme);
    launcher?.setAttribute('aria-expanded', String(open));
    root.querySelector('#backdrop').hidden = !open;
    root.host.setAttribute('data-font', font);
    root.querySelector('#panel').classList.toggle('is-running', Boolean(busy || (info && running())));
    root.querySelector('#panel').hidden = !open;
    if (!open) return;
    const here = groupOf(tab);
    lastIn[here[0]] = tab;
    for (const b of root.querySelectorAll('nav button')) {
      const g = GROUPS.find((x) => x[0] === b.dataset.groupTab);
      if (!g) { b.classList.toggle('selected', b.dataset.tab === tab); continue; }
      b.classList.toggle('selected', g === here);
      b.dataset.tab = lastIn[g[0]] || g[3][0];
    }
    const roomOption = (r) => `<option value="${esc(r.id)}" ${r.id === room ? 'selected' : ''}>${r.enabled ? '● ' : ''}${esc(roomLabel(r))}</option>`;
    const recent = recentRooms().map((id) => rooms.find((r) => r.id === id)).filter(Boolean);
    root.querySelector('#roomSelect').innerHTML = rooms.length
      ? (recent.length > 1 ? `<optgroup label="최근 연 방">${recent.map(roomOption).join('')}</optgroup><optgroup label="모든 방">${rooms.filter((r) => !recent.includes(r)).map(roomOption).join('')}</optgroup>` : rooms.map(roomOption).join(''))
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
    content.innerHTML = warning + translation + subTabs() + VIEWS[tab]();
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
    if (actName !== 'fresh' && !actName.startsWith('deleteFact') && actName !== 'closeThread' && actName !== 'factBulkDelete' && actName !== 'rebuildChapters' && actName !== 'deleteRoutine' && !['trackerUndoApplied', 'nameApply', 'mergeApply', 'aliasApply', 'nameUndo', 'backupDownload', 'restoreApply', 'restoreUndo', 'addressDelete', 'stateReset', 'placeDelete', 'keepDelete', 'noteDelete', 'noteRebuildAll', 'trackerDelete', 'trackerDropStart'].includes(actName)) armed = '';
    switch (actName) {
      case 'factPickClear':
        pickedFacts.clear();
        return render();
      case 'factBulkExclude': {
        const left = new Set(info?.recallPrefs?.excluded || []);
        const ids = [...pickedFacts].filter((f) => !left.has(f));
        return act(async () => {
          for (const f of ids) await api('POST', `/chats/${chat}/recall-prefs`, { id: f, action: 'exclude' });
          pickedFacts.clear();
        }, `사실 ${ids.length}개를 답변에서 뺐습니다. 각 사실의 '빼기 해제'로 되돌릴 수 있습니다.`);
      }
      case 'factBulkDelete': {
        if (armed !== 'factBulkDelete') { armed = 'factBulkDelete'; return render(); }
        armed = '';
        const ids = [...pickedFacts];
        return act(async () => {
          for (const f of ids) await api('DELETE', `/chats/${chat}/facts/${encodeURIComponent(f)}`);
          pickedFacts.clear();
        }, `사실 ${ids.length}개를 지웠습니다.`);
      }
      case 'ledgerFilter':
        ledgerFilter = id || 'all';
        return render();
      case 'openOld':
        tab = 'ledger';
        ledgerFilter = 'old';
        void ensureScenes();
        return render();
      case 'bulkClear':
        pickedThreads.clear();
        return render();
      case 'bulkClose': {
        const ids = [...pickedThreads];
        if (!ids.length) return;
        const closeRoom = room;
        return act(async () => {
          const closed = [];
          try {
            for (const t of ids) {
              await api('POST', `/chats/${chat}/threads/${encodeURIComponent(t)}/close`, { how: '직접 닫음' });
              closed.push(t);
            }
          } finally {
            // Whatever did get closed can be undone; only the ones not closed yet stay picked.
            if (closed.length) {
              if (room === closeRoom) for (const t of closed) pickedThreads.delete(t);
              logAction(`${closed.join(', ')} 닫음`, { act: 'reopen', ids: closed }, closeRoom);
            }
          }
        }, `${ids.length}개를 닫았습니다. 되돌리려면 위의 '되돌리기'를 눌러 주세요.`);
      }
      case 'undoAction': {
        const entry = actionLog[Number(id)];
        if (!entry?.undo) return;
        if (entry.room !== room) { lastError = '다른 방에서 한 작업이라 되돌릴 수 없습니다.'; return render(); }
        const { act: kind, ids } = entry.undo;
        return act(async () => {
          for (const t of ids) await api('POST', `/chats/${chat}/threads/${encodeURIComponent(t)}/${kind}`, kind === 'close' ? { how: '직접 닫음' } : undefined);
          entry.undo = null;
          entry.text += ' → 되돌림';
        }, '되돌렸습니다.');
      }
      case 'speechRowAdd': {
        const last = speechRows?.at(-1);
        speechRows = [...(speechRows || []), { from: last?.from || 1, mark: last ? '[' : '"', lang: last?.lang === 'en' ? 'it' : 'en' }];
        return render();
      }
      case 'speechRowRemove':
        speechRows = (speechRows || []).filter((_, i) => i !== Number(el.dataset.i));
        return render();
      case 'setupSave': {
        const body = { lore: setupDraft?.lore ?? '', rules: setupDraft?.rules ?? '' };
        return act(async () => {
          await api('POST', `/chats/${chat}/setup`, body);
          setupDraft = null;
        }, body.lore.trim() || body.rules.trim() ? '배경 설정과 진행 규칙을 저장했습니다. 다음 답글부터 들어갑니다.' : '배경 설정과 진행 규칙을 비웠습니다.');
      }
      case 'speechSave': {
        const rules = new Map();
        for (const r of speechRows || []) {
          const from = Math.max(1, Math.floor(Number(r.from) || 1));
          rules.set(from, { ...(rules.get(from) || {}), [r.mark]: r.lang });
        }
        return act(async () => {
          await api('POST', `/chats/${chat}/speech-marks`, { rules: [...rules].map(([from, marks]) => ({ from, marks })) });
          speechRows = null;
        }, rules.size ? '페르소나 말 표시를 저장했습니다. 이미 저장된 대사도 다음 정리 때 언어를 붙입니다.' : '페르소나 말 표시를 지웠습니다.');
      }
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
        if (armed !== `trackerUndoApplied:${el.dataset.aid}`) { armed = `trackerUndoApplied:${el.dataset.aid}`; return render(); }
        armed = '';
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
      case 'noteSave': {
        const text = root.querySelector(`[data-note-text="${CSS.escape(id)}"]`)?.value ?? '';
        const when = root.querySelector(`[data-note-when="${CSS.escape(id)}"]`)?.value;
        // A corrected Korean line becomes the note's own language (read now, before act() draws the screen again).
        const fixes = koreanEditsIn(root.querySelector(`[data-note="${CSS.escape(id)}"]`));
        return act(async () => {
          const body = await applyKoreanEdits(fixes, { text, ...(when != null ? { when } : {}) });
          await api('POST', `/chats/${chat}/notebook`, { action: 'edit', id, ...body });
          world = null;
        }, '메모를 저장했습니다.');
      }
      case 'noteStar':
      case 'noteUnstar':
        return act(async () => {
          await api('POST', `/chats/${chat}/notebook`, { action: actName === 'noteStar' ? 'star' : 'unstar', id });
          world = null;
        }, actName === 'noteStar' ? '중요로 표시했습니다. 이 인물이 장면에 있으면 늘 먼저 들어갑니다.' : '중요 표시를 뺐습니다.');
      case 'noteRebuild':
      case 'noteRebuildAll':
        if (actName === 'noteRebuildAll' && armed !== 'noteRebuildAll') { armed = 'noteRebuildAll'; return render(); }
        armed = '';
        return act(async () => {
          const r = await api('POST', `/chats/${chat}/notebook/rebuild`, { all: actName === 'noteRebuildAll' });
          if (info) info.notebookJob = r.notebookJob;
        }, '수첩 받기를 시작했습니다. 채팅은 계속하셔도 됩니다.', { reload: false });
      case 'planAnswers': {
        const on = !info?.planAnswers;
        return act(async () => {
          const r = await api('POST', `/chats/${chat}/plan-answers`, { on });
          if (info) info.planAnswers = r.planAnswers;
        }, on ? '작가 계획의 답까지 답변에 넣습니다.' : '작가 계획은 감추는 것만 답변에 넣습니다.', { reload: false });
      }
      case 'oocLoad':
        return act(async () => {
          oocList = await api('GET', `/chats/${chat}/ooc`);
          oocRoom = room;
          openLists.add('ooc');
        }, '', { reload: false });
      case 'oocSet':
      case 'oocMark': {
        const body = actName === 'oocMark'
          ? { number: Number(root.querySelector('#oocNumber')?.value || 0), ooc: true }
          : { id, ooc: el?.dataset?.ooc === 'null' ? null : el?.dataset?.ooc === 'true' };
        if (actName === 'oocMark' && !body.number) return;
        return act(async () => {
          oocList = await api('POST', `/chats/${chat}/ooc`, body);
          oocRoom = room;
          openLists.add('ooc');
        }, '저장했습니다. 새로 정리되는 기억부터 적용됩니다.', { reload: false });
      }
      case 'noteRebuildStop':
        return act(async () => {
          const r = await api('POST', `/chats/${chat}/notebook/rebuild`, { stop: true });
          if (info) info.notebookJob = r.notebookJob;
        }, '지금 묶음까지 하고 멈춥니다.', { reload: false });
      case 'noteDelete':
        if (armed !== `noteDelete:${id}`) { armed = `noteDelete:${id}`; return render(); }
        armed = '';
        return act(async () => {
          await api('POST', `/chats/${chat}/notebook`, { action: 'delete', id });
          world = null;
        }, '메모를 지웠습니다. 다시 정리해도 되살아나지 않습니다.');
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
        for (const f of ['title', 'detail', 'need', 'mystery', 'unaware', 'guess', 'dueDate', 'dueTime']) {
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
      resetRoomUi();
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
          <nav>${GROUPS.map(([id, label, i, views]) => `<button data-tab="${views[0]}" data-group-tab="${id}">${icon(i)}<span>${label}</span></button>`).join('')}</nav>
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
      if (e.target.dataset?.setup && setupDraft && setupDraftRoom === room) setupDraft[e.target.dataset.setup] = e.target.value;
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
      rememberRoomTab(room, tab);
      room = e.target.value;
      resetRoomUi();
      noteRecentRoom(room);
      tab = roomTab(room) || tab;
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
      // 페르소나 말 표시: a row being edited (saved only with 저장).
      const speechRow = e.target.closest?.('[data-speech-row]');
      if (speechRow && speechRows) {
        const r = speechRows[Number(speechRow.dataset.speechRow)];
        if (r) {
          if ('speechFrom' in e.target.dataset) r.from = Math.max(1, Math.floor(Number(e.target.value) || 1));
          if ('speechMark' in e.target.dataset) r.mark = e.target.value;
          if ('speechLang' in e.target.dataset) r.lang = e.target.value;
        }
        return render();
      }
      if (e.target.dataset?.pickFact) {
        if (e.target.checked) pickedFacts.add(e.target.dataset.pickFact);
        else pickedFacts.delete(e.target.dataset.pickFact);
        return render();
      }
      if (e.target.dataset?.pickThread) {
        if (e.target.checked) pickedThreads.add(e.target.dataset.pickThread);
        else pickedThreads.delete(e.target.dataset.pickThread);
        return render();
      }
      if (e.target.id === 'pickAllLedger') {
        for (const t of threadList().filter((x) => x.status === 'open' && !x.plan && ledgerMatch(x))) {
          if (e.target.checked) pickedThreads.add(t.id);
          else pickedThreads.delete(t.id);
        }
        return render();
      }
      if (e.target.id === 'searchKind' || e.target.id === 'searchWho') {
        if (e.target.id === 'searchKind') searchKind = e.target.value;
        else searchWho = e.target.value;
        return render();
      }
      if (e.target.id === 'ledgerWho') {
        ledgerWho = e.target.value;
        return render();
      }
      if (e.target.id === 'setNoteLang') {
        const language = e.target.value;
        const chat = room;
        return act(async () => {
          world = await api('POST', `/chats/${encodeURIComponent(chat)}/notebook/language`, { language });
          worldRoom = chat;
        }, '수첩 언어를 저장했습니다. 새로 적는 메모부터 적용됩니다.', { reload: false });
      }
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
      if (n.dataset.act === 'selectPerson') {
        selectedPerson = n.dataset.id || '';
        return render();
      }
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




