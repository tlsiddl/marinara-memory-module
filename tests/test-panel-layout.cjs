'use strict';
// Source checks for the library panel's layout, moving and resizing (no browser here; the geometry math runs for real).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rt = fs.readFileSync(path.join(__dirname, '..', 'extension', 'runtime.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(__dirname, '..', 'extension', 'ui.css'), 'utf8').replace(/\r\n/g, '\n');

test('layout: one bounded row, #content is the only scroller, panel never taller than the viewport', () => {
  assert.match(css, /#panel\{grid-template-rows:minmax\(0,1fr\)\}/);
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
  assert.deepEqual(clamp({ x: 10, y: 10, w: 800, h: 500 }, 400, 300), { x: 0, y: 0, w: 400, h: 300 });
  assert.equal(clamp({ x: NaN, y: 0, w: 600, h: 400 }, 1024, 768), null);
  assert.equal(clamp(null, 1024, 768), null);
  assert.match(rt, /localStorage\.setItem\(PANEL_GEO_KEY, JSON\.stringify\(panelGeo\)\)/);
  assert.match(rt, /try \{\s*const g = JSON\.parse\(localStorage\.getItem\(PANEL_GEO_KEY\)/);
  assert.match(rt, /render\(\);\s*applyPanelGeometry\(\);/); // on open
  assert.match(rt, /addEventListener\('resize', \(\) => \{\s*if \(open\) applyPanelGeometry\(\);/);
  assert.match(rt, /setupPanelMove\(\);/);
});

test('reset: a settings button puts the default layout back and forgets the stored geometry', () => {
  assert.match(rt, /<button data-act="resetPanel">창 위치 초기화<\/button>/);
  assert.match(rt, /case 'resetPanel':\s*resetPanelGeometry\(\);/);
  assert.match(rt, /function resetPanelGeometry\(\) \{\s*panelGeo = null;\s*try \{\s*localStorage\.removeItem\(PANEL_GEO_KEY\);/);
  assert.match(rt, /for \(const k of \['left', 'top', 'width', 'height', 'transform'\]\) panel\.style\.removeProperty\(k\)/);
});
