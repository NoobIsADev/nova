'use strict';
const INTERNAL = new Set(['newtab', 'settings', 'history', 'downloads']);
const SEARCH_BASE = 'https://duckduckgo.com/?q=';

function targetFor(raw) {
  const text = String(raw ?? '').trim();
  if (!text || /^nova:\/\/(newtab|home)\/?$/i.test(text)) return {kind: 'internal', page: 'newtab'};
  const internal = text.match(/^nova:\/\/([a-z]+)\/?$/i);
  if (internal && INTERNAL.has(internal[1].toLowerCase())) return {kind: 'internal', page: internal[1].toLowerCase()};
  // Do not expose file://, javascript:, data:, Chrome internals or OS custom schemes from the address bar.
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      if (['http:', 'https:'].includes(url.protocol)) return {kind: 'web', url: url.href};
    } catch (_) { /* fall through to DuckDuckGo */ }
  }
  if (!/\s/.test(text) &&
      (/^(localhost|(?:\d{1,3}\.){3}\d{1,3}|\[::1\])(?::\d+)?(?:[/?#]|$)/i.test(text) ||
       /^(?:[a-z\d-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i.test(text))) {
    try {
      const url = new URL((/^(localhost|(?:\d{1,3}\.){3}\d{1,3}|\[::1\])/i.test(text) ? 'http://' : 'https://') + text);
      if (['http:', 'https:'].includes(url.protocol)) return {kind: 'web', url: url.href};
    } catch (_) { /* fall through to search */ }
  }
  return {kind: 'web', url: SEARCH_BASE + encodeURIComponent(text)};
}
function isWebURL(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}
function displayAddress(tab) {
  return tab.kind === 'internal' ? `nova://${tab.page}` : tab.url;
}
module.exports = {targetFor, isWebURL, displayAddress, INTERNAL};
