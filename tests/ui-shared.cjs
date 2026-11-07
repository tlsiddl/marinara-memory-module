'use strict';
// The scene-link renderers every screen shares, taken from the real runtime.js for tests that run one screen function alone.
const vm = require('node:vm');
const body = (source, head, tail) => { const start = source.indexOf(head); if (start < 0) throw Error(head); return source.slice(start, source.indexOf(tail, start) + tail.length); };
module.exports = function sceneGlobals(source, esc) {
  const code = [
    body(source, '  function sceneLink(', '\n  }\n'),
    body(source, '  function sceneRef(', '\n  }\n'),
    body(source, '  const sceneRefs = ', '\n'),
  ].join('\n');
  return vm.runInNewContext(`(() => { const store = null; ${code}; return { sceneLink, sceneRef, sceneRefs }; })()`, { esc });
};
