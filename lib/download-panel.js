'use strict';

// All values are in Electron device-independent pixels. The 54 px header and
// approximately 55 px footer remain visible even when the list scrolls.
const PANEL_MAX_HEIGHT = 564;
const PANEL_CHROME_HEIGHT = 110;
const PANEL_EMPTY_HEIGHT = 70;
const PANEL_ROW_HEIGHT = 71;
const PANEL_ACTIVE_ROW_HEIGHT = 83;
const PANEL_MIN_HEIGHT = 180;

/**
 * Calculate the preferred floating downloads panel size. Only visible download
 * entries are considered; the main process will clamp the result again to the
 * current browser window height. Extra items use a scrollbar, not an enormous
 * overlay that would cover the user's page.
 *
 * @param {Array<{state?: string}>} entries
 * @returns {number}
 */
function preferredDownloadPanelHeight(entries) {
  const items = Array.isArray(entries) ? entries : [];
  const listHeight = items.length === 0 ? PANEL_EMPTY_HEIGHT : items.reduce((height, item) => (
    height + (item && (item.state === 'progressing' || item.state === 'paused')
      ? PANEL_ACTIVE_ROW_HEIGHT : PANEL_ROW_HEIGHT)
  ), 0);
  return Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, PANEL_CHROME_HEIGHT + listHeight));
}

module.exports = {preferredDownloadPanelHeight, PANEL_MAX_HEIGHT};
