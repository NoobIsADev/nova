'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {hasVisibleBookmarks} = require('../lib/bookmark-bar');

test('hides the bookmarks bar when there are no bookmarks', () => {
  assert.equal(hasVisibleBookmarks({bookmarkBar:true}, []), false);
  assert.equal(hasVisibleBookmarks({bookmarkBar:true}, null), false);
});

test('shows after the first bookmark and hides after the last is removed', () => {
  const items=[];
  assert.equal(hasVisibleBookmarks({bookmarkBar:true}, items), false);
  items.push({url:'https://example.org'});
  assert.equal(hasVisibleBookmarks({bookmarkBar:true}, items), true);
  items.pop();
  assert.equal(hasVisibleBookmarks({bookmarkBar:true}, items), false);
});

test('user preference can keep bookmarks bar hidden with saved bookmarks', () => {
  assert.equal(hasVisibleBookmarks({bookmarkBar:false}, [{url:'https://example.org'}]), false);
  assert.equal(hasVisibleBookmarks({bookmarkBar:true}, [{url:'https://example.org'}]), true);
});

test('web contents and browser chrome share the bookmark visibility signal', () => {
  const main=fs.readFileSync(path.join(__dirname,'../main.js'),'utf8');
  const chrome=fs.readFileSync(path.join(__dirname,'../src/chrome.js'),'utf8');
  assert.match(main,/bookmarksBarVisible:hasVisibleBookmarks\(settings, bookmarks\)/);
  assert.match(main,/const chromeHeight = \(\) => CHROME_BASE_HEIGHT \+ \(hasVisibleBookmarks\(settings, bookmarks\)/);
  assert.match(chrome,/const bookmarkBarVisible=Boolean\(snapshot.bookmarksBarVisible\)/);
  assert.match(main,/function notifyBookmarksChanged\(\) \{[\s\S]*?positionActiveView\(\);/);
});
