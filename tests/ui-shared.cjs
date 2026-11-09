'use strict';
// The scene-link renderers every screen shares, and the Korean-translation helpers, taken from the real runtime.js for
// tests that run one screen function alone. The helpers see no translations (trMap is empty) unless one is passed.
const vm = require('node:vm');
const body = (source, head, tail) => { const start = source.indexOf(head); if (start < 0) throw Error(head); return source.slice(start, source.indexOf(tail, start) + tail.length); };
module.exports = function sceneGlobals(source, esc, trMap = {}) {
  source = source.replace(/\r\n/g, '\n');
  const code = [
    body(source, '  function sceneLink(', '\n  }\n'),
    body(source, '  function sceneRef(', '\n  }\n'),
    body(source, '  const sceneRefs = ', '\n'),
    body(source, '  function ko(', '\n  }\n'),
    body(source, '  const shown = ', '\n'),
    body(source, '  const trLine = ', '\n  };\n'),
    body(source, '  const withKo = ', '\n'),
    body(source, '  const nameShown = ', '\n'),
  ].join('\n');
  return vm.runInNewContext(`(() => { const store = null; ${code}; return { sceneLink, sceneRef, sceneRefs, ko, shown, trLine, withKo, nameShown }; })()`, { esc, trMap });
};
