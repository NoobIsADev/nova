'use strict';
// Electron's screen API supplies physical monitor layout in DIP coordinates.
function isPointOutsideBounds(point, bounds, slack = 8) {
  if (!point || !bounds || ![point.x,point.y,bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite)) return false;
  if (bounds.width <= 0 || bounds.height <= 0) return false;
  return point.x < bounds.x-slack || point.y < bounds.y-slack ||
    point.x > bounds.x+bounds.width+slack || point.y > bounds.y+bounds.height+slack;
}
function detachedWindowBounds(point,workArea) {
  if (!point || !workArea || ![point.x,point.y,workArea.x,workArea.y,workArea.width,workArea.height].every(Number.isFinite))
    return {width:1100,height:760};
  const width=Math.max(760,Math.min(1100,workArea.width));
  const height=Math.max(500,Math.min(760,workArea.height));
  const clamp=(v,min,max)=>Math.max(min,Math.min(v,Math.max(min,max)));
  // Cursor is in the new tab-strip area (not exactly at its window corner).
  return {width,height,
    x:Math.round(clamp(point.x-130,workArea.x,workArea.x+workArea.width-width)),
    y:Math.round(clamp(point.y-18,workArea.y,workArea.y+workArea.height-height))};
}
module.exports={isPointOutsideBounds,detachedWindowBounds};
