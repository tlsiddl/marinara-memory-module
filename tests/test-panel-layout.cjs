'use strict';
// Source checks for the library panel's layout, moving and resizing (no browser here; the geometry math runs for real).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rt = fs.readFileSync(path.join(__dirname, '..', 'extension', 'runtime.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(__dirname, '..', 'extension', 'ui.css'), 'utf8').replace(/\r\n/g, '\n');

test('layout: one bounded row, #content is the only scroller, panel never taller than the viewport', () => {
  const desktopCss = css.slice(css.lastIndexOf('@media(min-width:721px)'));
  assert.match(desktopCss, /#panel\{grid-template-rows:minmax\(0,1fr\);/);
  // regression (0.11.63): an unconditional one-row rule after the 720px block overrode the phone layout's "auto minmax(0,1fr)" rows
  assert.doesNotMatch(css, /^#panel\{grid-template-rows:minmax\(0,1fr\)\}/m);
  assert.match(css, /#content\{[^}]*overflow:auto[^}]*flex:1;min-height:0/);
  assert.match(css, /\.workspace\{[^}]*min-height:0[^}]*flex-direction:column/);
  assert.match(css, /\.workspace\{overflow:hidden\}/);
  assert.match(css, /max-height:calc\(100dvh - 16px\)/);
  assert.match(css, /max-height:calc\(100vh - 16px\)/);
  assert.match(css, /#content\{padding:8px 30px 32px/); // the bottom padding sits inside the scroller
});

test('layout: the full-screen mobile rules stay and the max-height only applies on desktop', () => {
  assert.match(css, /@media\(max-width:720px\)\{#panel\{inset:0;[^}]*height:100dvh;[^}]*grid-template-rows:auto minmax\(0,1fr\)/);
  const desktop = css.slice(css.lastIndexOf('@media(min-width:721px)'));
  assert.match(desktop, /#panel\{[^}]*max-height:calc\(100dvh - 16px\)/);
  assert.match(css, /\.resize-edge,\.resize-grip\{display:none\}/); // hidden unless the desktop media block shows them
});

test('moving: the top bar drags with pointer events, skipping its controls, and the grips resize', () => {
  assert.match(rt, /bind\(root\.querySelector\('\.topbar'\), 'move'\)/);
  assert.match(rt, /closest\?\.\('button,select,input,textarea,a,label,summary,\.room-menu'\)/);
  for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) assert.ok(rt.includes(`addEventListener('${t}'`), t);
  for (const id of ['resizeCorner', 'resizeRight', 'resizeBottom']) assert.ok(rt.includes(`id="${id}"`) && rt.includes(`'#${id}'`), id);
  assert.match(css, /\.resize-grip\{[^}]*cursor:nwse-resize/);
});

test('moving: disabled while the panel is full screen (720px and narrower)', () => {
  assert.match(rt, /const PANEL_NARROW = 720;/);
  assert.match(rt, /function panelIsFree\(\) \{\s*return panelViewport\(\)\.vw > PANEL_NARROW;/);
  assert.match(rt, /if \(e\.button !== 0 \|\| !panelIsFree\(\)\) return;/);
  assert.match(rt, /const g = panelIsFree\(\) \? clampPanelGeometry\(panelGeo, vw, vh\) : null;/);
});

test('geometry: clamped to the viewport with a minimum size, saved to localStorage, restored on open and on resize', () => {
  const src = rt.match(/const PANEL_MIN_W[\s\S]*?const PANEL_COMPACT_W = \d+;\n[\s\S]*?function clampPanelGeometry[\s\S]*?\n  }\n/)[0];
  const clamp = new Function(`${src}; return clampPanelGeometry;`)();
  assert.deepEqual(clamp({ x: -50, y: -9, w: 300, h: 100 }, 1024, 768), { x: 0, y: 0, w: 520, h: 360 });
  assert.deepEqual(clamp({ x: 900, y: 700, w: 600, h: 400 }, 1024, 768), { x: 424, y: 368, w: 600, h: 400 });
  assert.deepEqual(clamp({ x: 0, y: 0, w: 5000, h: 5000 }, 1024, 768), { x: 0, y: 0, w: 1024, h: 768 });
  // viewport smaller than the minimum size: no inline geometry at all (full layout), never a forced 520x360
  assert.equal(clamp({ x: 10, y: 10, w: 800, h: 500 }, 400, 300), null);
  assert.equal(clamp({ x: 10, y: 10, w: 800, h: 500 }, 1366, 359), null);
  assert.equal(clamp({ x: 10, y: 10, w: 800, h: 500 }, 519, 700), null);
  assert.deepEqual(clamp({ x: 10, y: 10, w: 800, h: 500 }, 520, 360), { x: 0, y: 0, w: 520, h: 360 });
  // saved from a bigger window, off-screen, zero/negative/NaN/Infinity/string
  assert.deepEqual(clamp({ x: 200, y: 60, w: 1000, h: 640 }, 760, 560), { x: 0, y: 0, w: 760, h: 560 });
  assert.deepEqual(clamp({ x: 5000, y: 5000, w: 600, h: 400 }, 800, 600), { x: 200, y: 200, w: 600, h: 400 });
  assert.deepEqual(clamp({ x: -5000, y: -5000, w: 600, h: 400 }, 800, 600), { x: 0, y: 0, w: 600, h: 400 });
  for (const bad of [{ w: 0 }, { h: 0 }, { w: -10 }, { h: -10 }, { x: Infinity }, { y: NaN }, { w: NaN }, { h: undefined }, { x: '5' }]) assert.equal(clamp({ x: 10, y: 10, w: 600, h: 400, ...bad }, 1024, 768), null, JSON.stringify(bad));
  assert.equal(clamp({ x: 0, y: 0, w: 600, h: 400 }, NaN, 768), null);
  assert.equal(clamp({ x: 0, y: 0, w: 600, h: 400 }, 1024, 0), null);
  assert.equal(clamp({ x: 0, y: 0, w: 600, h: 400 }, undefined, 768), null);
  // shrinking the window step by step always stays inside the viewport
  let g = { x: 200, y: 60, w: 1000, h: 640 };
  for (const [vw, vh] of [[1280, 720], [1000, 650], [900, 600], [800, 600], [760, 560], [721, 520], [721, 361], [1366, 400]]) {
    const c = clamp(g, vw, vh);
    assert.ok(c.x >= 0 && c.y >= 0 && c.w >= 520 && c.h >= 360 && c.x + c.w <= vw && c.y + c.h <= vh, JSON.stringify([vw, vh, c]));
  }
  assert.equal(clamp({ x: NaN, y: 0, w: 600, h: 400 }, 1024, 768), null);
  assert.equal(clamp(null, 1024, 768), null);
  assert.match(rt, /localStorage\.setItem\(PANEL_GEO_KEY, JSON\.stringify\(panelGeo\)\)/);
  assert.match(rt, /try \{\s*const g = JSON\.parse\(localStorage\.getItem\(PANEL_GEO_KEY\)/);
  assert.match(rt, /render\(\);\s*applyPanelGeometry\(\);/); // on open
  assert.match(rt, /const refit = \(\) => \{\s*if \(open\) applyPanelGeometry\(\);\s*\};\s*addEventListener\('resize', refit\);/);
  assert.match(rt, /visualViewport\?\.addEventListener\('resize', refit\)/);
  // inline values are CSS min()/clamp() so a stale value can never leave the panel off-screen before the next resize event
  assert.match(rt, /left: `clamp\(0px, \$\{g\.x\}px, calc\(100vw - \$\{w\}\)\)`/);
  assert.match(rt, /const w = `min\(\$\{g\.w\}px, 100vw\)`;/);
  assert.match(rt, /setupPanelMove\(\);/);
});

test('reset: a settings button puts the default layout back and forgets the stored geometry', () => {
  assert.match(rt, /<button data-act="resetPanel">창 위치 초기화<\/button>/);
  assert.match(rt, /case 'resetPanel':\s*resetPanelGeometry\(\);/);
  assert.match(rt, /function resetPanelGeometry\(\) \{\s*panelGeo = null;\s*try \{\s*localStorage\.removeItem\(PANEL_GEO_KEY\);/);
  assert.match(rt, /for \(const k of \['left', 'top', 'width', 'height', 'transform'\]\) panel\.style\.removeProperty\(k\)/);
});

test('narrow layout: tabs wrap instead of scrolling sideways, header is compact, touch targets stay >=36px', () => {
  const theme = fs.readFileSync(path.join(__dirname, '..', 'extension', 'theme.css'), 'utf8').replace(/\r\n/g, '\n');
  const narrow = theme.slice(theme.lastIndexOf('@media(max-width:720px){'));
  assert.match(narrow, /\.sidebar nav\{[^}]*flex-wrap:wrap/);
  assert.match(narrow, /\.sidebar nav\{[^}]*overflow:visible/);
  assert.doesNotMatch(narrow, /overflow-x:(auto|scroll)/);
  assert.match(narrow, /\.sidebar nav button\{[^}]*min-height:36px/);
  assert.match(narrow, /\.brand \.logo\{width:28px;height:28px/);
  assert.match(narrow, /#close,#themeToggle\{[^}]*width:36px;height:36px/);
  assert.match(narrow, /\.topbar\{min-height:0;/);
});
