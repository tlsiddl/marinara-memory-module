'use strict';
// The shipped UI is a single closure assembled from these sources by extension/build.py.
const fs = require('node:fs');
const path = require('node:path');
module.exports = function uiSource() {
  const read = (name) => fs.readFileSync(path.join(__dirname, '../extension', name), 'utf8').replace(/\r\n/g, '\n');
  const source = read('runtime.js');
  const marker = '  /*__TRACKER_MODULE__*/\n';
  if (source.split(marker).length !== 2) throw Error('expected exactly one tracker module marker');
  return source.replace(marker, read('tracker-ui.js'));
};
