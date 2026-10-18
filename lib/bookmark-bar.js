'use strict';

// The bar is never shown with no saved items, regardless of the preference.
function hasVisibleBookmarks(settings, bookmarks) {
  return settings?.bookmarkBar !== false && Array.isArray(bookmarks) && bookmarks.length > 0;
}

module.exports = {hasVisibleBookmarks};
