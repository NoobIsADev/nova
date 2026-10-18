'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../src/chrome.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../src/chrome.html'), 'utf8');
const main = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');

test('frameless Electron window has a native draggable title bar', () => {
  assert.match(main, /frame:\s*false/);
  assert.match(css, /\.topbar\s*\{\s*-webkit-app-region:\s*drag\s*\}/);
  assert.match(html, /class="drag top-spacer"/);
  assert.match(css, /\.top-spacer\s*\{[^}]*-webkit-app-region:\s*drag/);
});

test('tab interactions and window buttons remain outside drag region', () => {
  assert.match(css, /\.tabs\s*\{[^}]*-webkit-app-region:\s*no-drag/);
  assert.match(css, /\.topbar \.win-btn[^}]*-webkit-app-region:\s*no-drag/);
  assert.match(css, /\.topbar \.tab-add[^}]*-webkit-app-region:\s*no-drag/);
  assert.match(css, /\.tabs \.tab[^}]*-webkit-app-region:\s*no-drag/);
});

test('tab strip never completely consumes the blank drag handle', () => {
  assert.match(css, /\.tabs\s*\{[^}]*max-width:\s*calc\(100% - 240px\)/);
  assert.match(css, /\.top-spacer\s*\{[^}]*flex:\s*1 1 auto/);
  assert.match(css, /\.top-spacer\s*\{[^}]*min-width:\s*46px/);
});
