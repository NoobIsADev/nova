'use strict';
const {app, BrowserWindow, WebContentsView, ipcMain, session, dialog, shell, Menu, nativeImage, clipboard} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {fileURLToPath} = require('node:url');
const {targetFor, isWebURL, displayAddress, INTERNAL} = require('./lib/navigation');
const {createUpdateService, signedMacUpdateAvailable} = require('./lib/updater');
const {hasVisibleBookmarks} = require('./lib/bookmark-bar');

const CHROME_BASE_HEIGHT = 103;
const BOOKMARK_BAR_HEIGHT = 36;
const chromeHeight = () => CHROME_BASE_HEIGHT + (hasVisibleBookmarks(settings, bookmarks) ? BOOKMARK_BAR_HEIGHT : 0);
const SIDEBAR_WIDTH = 74;
const MAX_HISTORY = 1200;
const HOME = 'newtab';
const DOWNLOAD_PANEL_WIDTH = 382;
const DOWNLOAD_PANEL_HEIGHT = 408;
let win = null;
let tabs = new Map();
let order = [];
let activeId = null;
let nextTabId = 1;
let groups = new Map();
let nextGroupId = 1;
const GROUP_COLORS = ['violet','cyan','rose','amber','green','blue'];
let normalSession, privateSession;
let blocker = null;
let blockerStatus = 'loading';
let protectionError = '';
let settings, bookmarks, historyItems, downloads;
let writeTimer = null;
let activeFind = false;
let downloadPanel = null;
let downloadPanelOpen = false;
let updateService = null;
const activeDownloadItems = new Map();

const settingsDefaults = {adblock: true, accent: 'violet', sidebar: true, bookmarkBar: true, homepage: 'newtab'};
const dataFile = () => path.join(app.getPath('userData'), 'nova-data.json');
const blockerCacheFile = () => path.join(app.getPath('userData'), 'filters-cache.bin');
const settingsFile = () => ({settings, bookmarks, history:historyItems, downloads:downloads.slice(0, 100)});

function loadData() {
  let raw = {};
  try {raw = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));} catch {}
  settings = {...settingsDefaults, ...(raw.settings || {})};
  bookmarks = Array.isArray(raw.bookmarks) ? raw.bookmarks.filter(b => b && isWebURL(b.url)).slice(0, 400) : [];
  historyItems = Array.isArray(raw.history) ? raw.history.filter(h => h && isWebURL(h.url)).slice(0, MAX_HISTORY) : [];
  downloads = Array.isArray(raw.downloads) ? raw.downloads.map(d => ({...d, state: ['progressing','paused'].includes(d.state) ? 'interrupted' : d.state})).slice(0, 100) : [];
}
function saveSoon() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {fs.writeFileSync(dataFile(), JSON.stringify(settingsFile(), null, 2));}
    catch (err) {console.error('Could not save browser data:', err);}
  }, 350);
}
function openSafeURL(raw) {
  const parsed = targetFor(raw);
  return parsed;
}
function publicTab(tab) {
  return {id:tab.id, title:tab.title || 'New Tab', url:displayAddress(tab), favicon:tab.favicon,
    loading:tab.loading, canGoBack:!tab.view.webContents.isDestroyed() && tab.view.webContents.canGoBack(),
    canGoForward:!tab.view.webContents.isDestroyed() && tab.view.webContents.canGoForward(),
    private:tab.private, kind:tab.kind, page:tab.page, muted:tab.muted, playing:tab.playing, groupId:tab.groupId || null};
}
function publicGroups() {
  return [...groups.values()].filter(g=>order.some(id=>tabs.get(id)?.groupId===g.id)).map(g=>({...g}));
}
function publicBookmarks() {
  return bookmarks.map(b=>({url:b.url,title:b.title, favicon:b.favicon||''}));
}
function snapshot() {
  return {tabs:order.map(id=>tabs.get(id)).filter(Boolean).map(publicTab), activeId,
    groups:publicGroups(), settings, protection:blockerStatus, protectionError,
    bookmarks:publicBookmarks(), bookmarkedUrls:bookmarks.map(b=>b.url),
    bookmarksBarVisible:hasVisibleBookmarks(settings, bookmarks),
    windowMaximized:win.isMaximized(), downloads:publicDownloads(), downloadPanelOpen,
    updates:updateService?.snapshot() || null};
}
function publicDownloads() {
  return downloads.slice(0, 12).map(d=>({id:d.id,filename:d.filename,received:d.received,total:d.total,state:d.state,time:d.time}));
}
function emitDownloads() {
  emitState();
  if (downloadPanelOpen && downloadPanel && !downloadPanel.webContents.isDestroyed()) {
    downloadPanel.webContents.send('nova:downloads-update', publicDownloads());
  }
}
function emitState() {
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
  win.webContents.send('nova:state', snapshot());
}
function sendInternalUpdate() {
  for (const tab of tabs.values()) {
    if (tab.kind === 'internal' && !tab.view.webContents.isDestroyed()) tab.view.webContents.send('nova:data-updated');
  }
}
function recordHistory(tab) {
  if (tab.private || !isWebURL(tab.url)) return;
  const last = historyItems[0];
  if (last && last.url === tab.url && Date.now() - last.time < 3500) {
    last.title = tab.title;
  } else {
    historyItems.unshift({url:tab.url, title:tab.title || tab.url, time:Date.now()});
    historyItems = historyItems.slice(0, MAX_HISTORY);
  }
  saveSoon(); sendInternalUpdate();
}
function positionActiveView() {
  if (!win || win.isDestroyed()) return;
  const tab = tabs.get(activeId);
  if (!tab) return;
  const [w, h] = win.getContentSize();
  const y = chromeHeight();
  const x = settings.sidebar && tab.kind === 'internal' && tab.page === HOME ? SIDEBAR_WIDTH : 0;
  tab.view.setBounds({x, y, width:Math.max(1, w - x), height:Math.max(1, h-y)});
}
function selectTab(id) {
  const tab = tabs.get(Number(id)); if (!tab || !win) return;
  closeDownloadPanel();
  if (tab.groupId && groups.get(tab.groupId)?.collapsed) groups.get(tab.groupId).collapsed=false;
  const previous = tabs.get(activeId);
  if (previous && previous.id !== tab.id) win.contentView.removeChildView(previous.view);
  activeId = tab.id;
  win.contentView.addChildView(tab.view);
  positionActiveView();
  emitState();
  if (!win.isFocused()) win.focus();
  try {tab.view.webContents.focus();} catch {}
}
function normalizeTitle(value) {return String(value || '').trim().slice(0, 140) || 'New Tab';}
function pageFile() {return path.join(__dirname, 'src', 'internal.html');}
function injectYouTubeHelper(tab) {
  if (!settings.adblock || !tab || tab.view.webContents.isDestroyed()) return;
  if (!/^https:\/\/(?:www\.|m\.)?youtube\.com\//i.test(tab.url)) return;
  // Cosmetic clean-up and skippable-ad helper. Filter lists handle network/scriptlet rules.
  const script = `(() => {
    if (window.__novaYT) return;
    const selectors = ['ytd-display-ad-renderer', 'ytd-promoted-sparkles-web-renderer',
      'ytd-in-feed-ad-layout-renderer', 'ytd-ad-slot-renderer', '#player-ads',
      'ytd-banner-promo-renderer', '.ytp-ad-overlay-container', '.ytd-promoted-video-renderer'];
    const cleanup = () => {
      try {
        for (const selector of selectors) document.querySelectorAll(selector).forEach(node => {
          node.style.setProperty('display','none','important');
        });
        const skip = document.querySelector('.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern');
        if (skip) skip.click();
        const player = document.querySelector('.html5-video-player.ad-showing');
        if (player) {
          const video = player.querySelector('video');
          if (video && Number.isFinite(video.duration) && video.duration > 0 && video.duration < 240) {
            video.currentTime = Math.max(video.currentTime, video.duration - 0.15);
          }
        }
      } catch (_) {}
    };
    const timer = setInterval(cleanup, 1000);
    const observer = new MutationObserver(() => { if (document.visibilityState === 'visible') cleanup(); });
    observer.observe(document.documentElement, {childList:true,subtree:true});
    window.__novaYT = {stop() {clearInterval(timer); observer.disconnect(); delete window.__novaYT;}};
    cleanup();
  })()`;
  tab.view.webContents.executeJavaScript(script).catch(() => {});
}
function internalPageForURL(url) {
  try {
    const parsed = new URL(url);
    if(parsed.protocol !== 'file:' || path.normalize(fileURLToPath(parsed)) !== path.normalize(pageFile())) return null;
    const page=parsed.searchParams.get('page') || HOME;
    return INTERNAL.has(page) ? page : HOME;
  } catch {return null;}
}
function syncNavigation(tab, url) {
  if (isWebURL(url)) {
    const changed=tab.url !== url || tab.kind !== 'web';
    tab.kind='web';tab.url=url;
    if(changed){
      tab.favicon='';
      try{const hostname=new URL(url).hostname;if(tab.title==='New Tab')tab.title=hostname;}catch{}
    }
    recordHistory(tab);
  } else {
    const page=internalPageForURL(url);
    if (!page) return;
    tab.kind='internal';tab.page=page;tab.url='';
    tab.title=({newtab:'New Tab', settings:'Settings',history:'History',downloads:'Downloads'})[page];
    tab.favicon='';
  }
  if (tab.id === activeId) positionActiveView();
  emitState();
}
function setupTabEvents(tab) {
  const wc = tab.view.webContents;
  wc.on('context-menu',(_event, params) => {
    const menu=[];
    if (params.linkURL && isWebURL(params.linkURL)) menu.push({label:'Open link in new tab',click:()=>createTab(params.linkURL,{private:tab.private})});
    if (params.selectionText) menu.push({label:'Copy selection',click:()=>wc.copy()});
    if (params.isEditable) {
      menu.push({label:'Cut',enabled:params.editFlags.canCut,click:()=>wc.cut()});
      menu.push({label:'Copy',enabled:params.editFlags.canCopy,click:()=>wc.copy()});
      menu.push({label:'Paste',enabled:params.editFlags.canPaste,click:()=>wc.paste()});
      menu.push({label:'Select all',click:()=>wc.selectAll()});
    }
    if (menu.length) menu.push({type:'separator'});
    menu.push({label:'Back',enabled:wc.canGoBack(),click:()=>wc.goBack()});
    menu.push({label:'Reload page',click:()=>wc.reload()});
    if (menu.length && win) Menu.buildFromTemplate(menu).popup({window:win});
  });
  wc.on('page-title-updated', (_event, title) => {
    tab.title = normalizeTitle(title);
    if (!tab.private && tab.kind === 'web' && historyItems.length && historyItems[0].url === tab.url) {
      historyItems[0].title = tab.title; saveSoon(); sendInternalUpdate();
    }
    emitState();
  });
  wc.on('page-favicon-updated', (_event, urls) => {
    tab.favicon = (urls || []).find(u => /^https?:\/\//.test(u)) || '';
    emitState();
  });
  wc.on('did-start-loading', () => {tab.loading=true;emitState();});
  wc.on('did-stop-loading', () => {tab.loading=false;emitState();});
  wc.on('did-navigate', (_event, url) => syncNavigation(tab,url));
  wc.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (isMainFrame) syncNavigation(tab,url);
  });
  wc.on('did-finish-load', () => {
    if (tab.kind === 'web') injectYouTubeHelper(tab);
  });
  wc.on('media-started-playing', () => {tab.playing=true;emitState();});
  wc.on('media-paused', () => {tab.playing=false;emitState();});
  wc.on('render-process-gone', () => {tab.loading=false;emitState();});
  wc.on('will-navigate', (event, url) => {
    if (!isWebURL(url) && !internalPageForURL(url)) event.preventDefault();
  });
  wc.setWindowOpenHandler(({url, disposition}) => {
    if (isWebURL(url)) createTab(url, {background: disposition === 'background-tab', private:tab.private});
    return {action:'deny'};
  });
  wc.on('before-input-event', (event, input) => keyboard(event,input,tab));
}
function createTab(initial = 'nova://newtab', opts = {}) {
  if (tabs.size >= 40) return null;
  const privateTab = Boolean(opts.private);
  const group = groups.get(Number(opts.groupId));
  const target = openSafeURL(initial);
  const id = nextTabId++;
  const view = new WebContentsView({webPreferences: {
    partition: privateTab ? 'nova-private' : 'persist:nova',
    contextIsolation:true, sandbox:true, nodeIntegration:false, webSecurity:true,
    spellcheck:true, webviewTag:false,
    preload:path.join(__dirname, 'internal-preload.js')
  }});
  view.setBackgroundColor('#10111c');
  const tab = {id, view, private:privateTab, kind:target.kind, page:target.page || HOME,
    url:target.url || '', title:target.kind === 'internal' ? ({newtab:'New Tab', settings:'Settings',history:'History', downloads:'Downloads'}[target.page] || 'New Tab') : 'New Tab',
    favicon:'',loading:false,muted:false,playing:false,groupId:group?.id||null};
  tabs.set(id,tab);
  if(group) {
    const last=order.map((tabId,index)=>({tabId,index})).filter(item=>tabs.get(item.tabId)?.groupId===group.id).at(-1);
    order.splice(last ? last.index+1 : order.length,0,id);
    group.collapsed=false;
  } else order.push(id);
  setupTabEvents(tab);
  if (target.kind === 'internal') {
    view.webContents.loadFile(pageFile(), {query:{page:tab.page, private:privateTab ? '1' : '0'}}).catch(console.error);
  } else {
    view.webContents.loadURL(target.url).catch(() => {});
  }
  if (!opts.background || !activeId) selectTab(id);
  else emitState();
  return id;
}
function navigate(id, input) {
  const tab = tabs.get(Number(id) || activeId); if (!tab) return;
  const target = openSafeURL(input);
  tab.kind=target.kind;tab.page=target.page||HOME;tab.url=target.url||'';
  tab.title = target.kind === 'internal' ? ({newtab:'New Tab',settings:'Settings',history:'History',downloads:'Downloads'}[tab.page]) : 'Loading...';
  closeDownloadPanel();
  if (tab.id === activeId) positionActiveView();
  tab.favicon='';tab.loading=true;
  if (target.kind === 'internal') {
    tab.view.webContents.loadFile(pageFile(),{query:{page:tab.page,private:tab.private?'1':'0'}}).catch(() => {});
  } else {
    tab.view.webContents.loadURL(target.url).catch(() => {});
  }
  emitState();
}
function closeTab(id) {
  const index=order.indexOf(Number(id)); if(index < 0) return;
  const tab=tabs.get(Number(id));
  const wasActive=tab.id===activeId;
  if(wasActive && win) win.contentView.removeChildView(tab.view);
  order.splice(index,1);tabs.delete(tab.id);
  if (tab.groupId && !order.some(other=>tabs.get(other)?.groupId===tab.groupId)) groups.delete(tab.groupId);
  if(!tab.view.webContents.isDestroyed()) tab.view.webContents.close();
  if (!order.length) createTab();
  else if (wasActive) selectTab(order[Math.max(0,index-1)]);
  else emitState();
}
function moveTab(delta) {
  if(order.length < 2) return;
  const index=order.indexOf(activeId);
  selectTab(order[(index + delta + order.length)%order.length]);
}
// Recompute the native webview bounds when the bar appears or disappears.
function notifyBookmarksChanged() {
  positionActiveView();
  positionDownloadPanel();
  saveSoon();
  sendInternalUpdate();
  emitState();
}
function bookmarkCurrent() {
  const tab=tabs.get(activeId); if(!tab || !isWebURL(tab.url)) return false;
  const existing=bookmarks.findIndex(b=>b.url===tab.url);
  if(existing>=0) bookmarks.splice(existing,1);
  else bookmarks.push({url:tab.url,title:tab.title||tab.url,favicon:tab.favicon||''});
  notifyBookmarksChanged();
  return existing<0;
}
// Tab islands: groups are session-scoped because tabs themselves are not restored on launch.
function cleanGroupName(raw) {return String(raw||'').trim().slice(0,36)||'Group';}
function createGroup(tabId) {
  const tab=tabs.get(Number(tabId));if(!tab)return null;
  const oldId=tab.groupId;
  // Keep the old island contiguous when splitting a tab out into its own group.
  if(oldId){
    const oldIndex=order.indexOf(tab.id);
    order.splice(oldIndex,1);
    const last=order.map((tid,index)=>({tid,index})).filter(item=>tabs.get(item.tid)?.groupId===oldId).at(-1);
    order.splice(last ? last.index+1 : Math.min(oldIndex,order.length),0,tab.id);
  }
  const id=nextGroupId++;
  const group={id,name:`Group ${id}`,color:GROUP_COLORS[(id-1)%GROUP_COLORS.length],collapsed:false};
  groups.set(id,group);tab.groupId=id;
  cleanupGroup(oldId);emitState();return id;
}
function cleanupGroup(id) {
  if(id && !order.some(tid=>tabs.get(tid)?.groupId===id)) groups.delete(id);
}
function addToGroup(tabId,groupId) {
  const tab=tabs.get(Number(tabId)), group=groups.get(Number(groupId));
  if(!tab||!group)return false;
  if(tab.groupId===group.id){group.collapsed=false;emitState();return true;}
  const oldId=tab.groupId;
  order.splice(order.indexOf(tab.id),1);
  const last=order.map((tid,index)=>({tid,index})).filter(item=>tabs.get(item.tid)?.groupId===group.id).at(-1);
  order.splice(last ? last.index+1 : order.length,0,tab.id);
  tab.groupId=group.id;group.collapsed=false;cleanupGroup(oldId);emitState();return true;
}
function groupWithTab(tabId,targetId) {
  const source=tabs.get(Number(tabId)),target=tabs.get(Number(targetId));
  if(!source||!target||source===target)return false;
  if(target.groupId)return addToGroup(source.id,target.groupId);
  const id=createGroup(target.id);
  return addToGroup(source.id,id);
}
function ungroupTab(tabId) {
  const tab=tabs.get(Number(tabId));if(!tab||!tab.groupId)return false;
  const oldId=tab.groupId;
  // Place the ungrouped tab just after the previous group's other members.
  order.splice(order.indexOf(tab.id),1);
  const last=order.map((tid,index)=>({tid,index})).filter(item=>tabs.get(item.tid)?.groupId===oldId).at(-1);
  if(last)order.splice(last.index+1,0,tab.id);
  else order.push(tab.id);
  tab.groupId=null;cleanupGroup(oldId);emitState();return true;
}
function reorderTab(tabId,targetId,after=false) {
  const source=tabs.get(Number(tabId)),target=tabs.get(Number(targetId));
  if(!source||!target||source===target)return false;
  const oldId=source.groupId;
  order.splice(order.indexOf(source.id),1);
  const index=order.indexOf(target.id)+(after?1:0);
  order.splice(index,0,source.id);
  source.groupId=target.groupId||null;
  if(source.groupId)groups.get(source.groupId).collapsed=false;
  cleanupGroup(oldId);emitState();return true;
}
function renameGroup(groupId,name) {
  const group=groups.get(Number(groupId));if(!group)return false;
  group.name=cleanGroupName(name);emitState();return true;
}
function colorGroup(groupId,color) {
  const group=groups.get(Number(groupId));if(!group||!GROUP_COLORS.includes(color))return false;
  group.color=color;emitState();return true;
}
function toggleGroup(groupId) {
  const group=groups.get(Number(groupId));if(!group)return false;
  group.collapsed=!group.collapsed;
  if(group.collapsed && tabs.get(activeId)?.groupId===group.id){
    const next=order.find(id=>tabs.get(id)?.groupId!==group.id);
    if(next){selectTab(next);return true;}
  }
  emitState();return group.collapsed;
}
function ungroupAll(groupId) {
  const id=Number(groupId);if(!groups.has(id))return false;
  for(const tid of order)if(tabs.get(tid)?.groupId===id)tabs.get(tid).groupId=null;
  groups.delete(id);emitState();return true;
}
function closeGroup(groupId) {
  const id=Number(groupId);if(!groups.has(id))return false;
  // Close the group in one operation; don't switch views while tearing down tabs.
  const members=order.filter(tid=>tabs.get(tid)?.groupId===id);
  if(!members.length){groups.delete(id);emitState();return true;}
  const hasActive=members.includes(activeId);
  if(hasActive && win){const active=tabs.get(activeId);if(active)win.contentView.removeChildView(active.view);}
  for(const tid of members){const tab=tabs.get(tid);tabs.delete(tid);order.splice(order.indexOf(tid),1);if(tab&&!tab.view.webContents.isDestroyed())tab.view.webContents.close();}
  groups.delete(id);
  if(!order.length){activeId=null;createTab();}
  else if(hasActive){activeId=null;selectTab(order[0]);}
  else emitState();
  return true;
}
function sendRenameGroup(id) {
  if(!win||win.isDestroyed())return;
  // Ensure the group pill exists after the state event has been rendered.
  setTimeout(()=>{if(win && !win.isDestroyed())win.webContents.send('nova:rename-group',id);},70);
}
function showTabMenu(tabId) {
  const tab=tabs.get(Number(tabId));if(!tab||!win)return false;
  const groupChoices=[{label:'New group',click:()=>{const id=createGroup(tab.id);sendRenameGroup(id);}},
    ...[...groups.values()].filter(g=>g.id!==tab.groupId).map(g=>({label:`${g.name}`,click:()=>addToGroup(tab.id,g.id)}))];
  const tpl=[
    {label:'New tab',click:()=>createTab()},
    {type:'separator'},
    {label:'Add tab to group',submenu:groupChoices},
    ...(tab.groupId?[{label:'Remove from group',click:()=>ungroupTab(tab.id)}]:[]),
    {type:'separator'},
    {label:'Close tab',click:()=>closeTab(tab.id)}
  ];
  Menu.buildFromTemplate(tpl).popup({window:win});return true;
}
function showGroupMenu(groupId) {
  const group=groups.get(Number(groupId));if(!group||!win)return false;
  const tpl=[
    {label:'Rename group',click:()=>sendRenameGroup(group.id)},
    {label:'Group color',submenu:GROUP_COLORS.map(color=>({label:color[0].toUpperCase()+color.slice(1),type:'radio',checked:group.color===color,click:()=>colorGroup(group.id,color)}))},
    {label:group.collapsed?'Expand group':'Collapse group',click:()=>toggleGroup(group.id)},
    {label:'New tab in group',click:()=>createTab('nova://newtab',{groupId:group.id})},
    {type:'separator'},
    {label:'Ungroup tabs',click:()=>ungroupAll(group.id)},
    {label:'Close group',click:()=>closeGroup(group.id)}
  ];
  Menu.buildFromTemplate(tpl).popup({window:win});return true;
}
function removeBookmark(raw) {
  const url=String(raw||'');const before=bookmarks.length;
  bookmarks=bookmarks.filter(b=>b.url!==url);
  if(before===bookmarks.length)return false;
  notifyBookmarksChanged();return true;
}
function showBookmarkMenu(url) {
  const bookmark=bookmarks.find(b=>b.url===url);if(!bookmark||!win)return false;
  Menu.buildFromTemplate([
    {label:'Open',click:()=>navigate(activeId,url)},
    {label:'Open in new tab',click:()=>createTab(url)},
    {type:'separator'},
    {label:'Remove bookmark',click:()=>removeBookmark(url)}
  ]).popup({window:win});return true;
}
function showBookmarksMenu() {
  if(!win)return false;
  const menu=bookmarks.length?bookmarks.map(b=>({label:(b.title||b.url).slice(0,55),click:()=>navigate(activeId,b.url)})):
    [{label:'No bookmarks yet · Ctrl+D to save a page',enabled:false}];
  Menu.buildFromTemplate(menu).popup({window:win});return true;
}
function positionDownloadPanel() {
  if (!win || !downloadPanel || !downloadPanelOpen) return;
  const [w, h] = win.getContentSize();
  downloadPanel.setBounds({
    x: Math.max(0, w - DOWNLOAD_PANEL_WIDTH - 28),
    y: chromeHeight() - 4,
    width: Math.min(DOWNLOAD_PANEL_WIDTH, w),
    height: Math.min(DOWNLOAD_PANEL_HEIGHT, Math.max(1,h-chromeHeight()+4))
  });
}
function closeDownloadPanel() {
  if (!downloadPanelOpen) return;
  downloadPanelOpen = false;
  if (win && downloadPanel) {
    try {win.contentView.removeChildView(downloadPanel);} catch {}
  }
  emitState();
}
function toggleDownloadPanel() {
  if (downloadPanelOpen) {closeDownloadPanel();return false;}
  if (!win || !downloadPanel) return false;
  downloadPanelOpen = true;
  win.contentView.addChildView(downloadPanel);
  positionDownloadPanel();
  emitDownloads();
  try {downloadPanel.webContents.focus();} catch {}
  return true;
}
function downloadAction(type, id) {
  const row = downloads.find(d=>d.id === id);
  if (type === 'clear-downloads') {
    downloads = downloads.filter(d=>d.state==='progressing'||d.state==='paused');
    saveSoon();sendInternalUpdate();emitDownloads();return true;
  }
  if (!row) return false;
  const item = activeDownloadItems.get(id);
  if (type==='pause-download' && item && !item.isPaused()) {item.pause();row.state='paused';}
  else if (type==='resume-download' && item && item.isPaused()) {item.resume();row.state='progressing';}
  else if (type==='cancel-download' && item) {item.cancel();row.state='cancelled';}
  else if (type==='open-download' && row.state==='completed' && row.path && fs.existsSync(row.path)) {
    shell.openPath(row.path).catch(console.error);return true;
  }
  else if (type==='show-download' && row.path && fs.existsSync(row.path)) {
    shell.showItemInFolder(row.path);return true;
  }
  else return false;
  saveSoon();sendInternalUpdate();emitDownloads();return true;
}
function browserAction(type, payload) {
  const active=tabs.get(activeId);
  switch(type) {
    case 'new-tab':return createTab(payload?.url || 'nova://newtab', {private:Boolean(payload?.private)});
    case 'close-tab':return closeTab(payload?.id ?? activeId);
    case 'select-tab':return selectTab(payload?.id);
    case 'navigate':return navigate(payload?.id || activeId,payload?.text);
    case 'back':if(active && active.view.webContents.canGoBack()) active.view.webContents.goBack();return;
    case 'forward':if(active && active.view.webContents.canGoForward()) active.view.webContents.goForward();return;
    case 'reload':if(!active)return; if(payload?.hard) active.view.webContents.reloadIgnoringCache(); else active.view.webContents.reload();return;
    case 'stop':if(active)active.view.webContents.stop();return;
    case 'home':return navigate(activeId,'nova://newtab');
    case 'bookmark':return bookmarkCurrent();
    case 'open-bookmark':return navigate(activeId,payload?.url);
    case 'remove-bookmark':return removeBookmark(payload?.url);
    case 'bookmark-menu':return showBookmarksMenu();
    case 'bookmark-context':return showBookmarkMenu(payload?.url);
    case 'toggle-bookmark-bar':return updateSetting('bookmarkBar',!settings.bookmarkBar);
    case 'create-group':return createGroup(payload?.id);
    case 'group-with-tab':return groupWithTab(payload?.id,payload?.targetId);
    case 'add-tab-to-group':return addToGroup(payload?.id,payload?.groupId);
    case 'ungroup-tab':return ungroupTab(payload?.id);
    case 'reorder-tab':return reorderTab(payload?.id,payload?.targetId,payload?.after);
    case 'rename-group':return renameGroup(payload?.groupId,payload?.name);
    case 'color-group':return colorGroup(payload?.groupId,payload?.color);
    case 'toggle-group':return toggleGroup(payload?.groupId);
    case 'ungroup-all':return ungroupAll(payload?.groupId);
    case 'close-group':return closeGroup(payload?.groupId);
    case 'new-tab-in-group':return createTab('nova://newtab',{groupId:payload?.groupId});
    case 'tab-context':return showTabMenu(payload?.id);
    case 'group-context':return showGroupMenu(payload?.groupId);
    case 'open-page':return createTab('nova://'+(INTERNAL.has(payload?.page)?payload.page:'newtab'));
    case 'toggle-adblock':return setAdblock(!settings.adblock);
    case 'toggle-download-popover':return toggleDownloadPanel();
    case 'close-download-popover':closeDownloadPanel();return true;
    case 'open-download':case 'show-download':case 'pause-download':case 'resume-download':case 'cancel-download':case 'clear-downloads':
      return downloadAction(type, payload?.id);
    case 'settings':return updateSetting(payload?.key,payload?.value);
    case 'check-updates':return updateService?.check() ?? false;
    case 'install-update':return false; // Updates install automatically when the browser closes.
    case 'clear-history':historyItems=[];saveSoon();sendInternalUpdate();return true;
    case 'window-minimize':win.minimize();return;
    case 'window-maximize':win.isMaximized()?win.unmaximize():win.maximize();emitState();return;
    case 'window-close':win.close();return;
    case 'find-start':activeFind=true;win.webContents.send('nova:show-find');return;
    case 'find':if(active && typeof payload?.text==='string') {
      const text=payload.text.slice(0,200);
      if(text)active.view.webContents.findInPage(text,{findNext:Boolean(payload?.next),forward:payload?.backwards !== true});
      else active.view.webContents.stopFindInPage('clearSelection');
    }return;
    case 'find-end':activeFind=false;if(active)active.view.webContents.stopFindInPage('clearSelection');return;
    case 'mute':if(active){active.muted=!active.muted;active.view.webContents.setAudioMuted(active.muted);emitState();}return;
    case 'zoom':if(active){
      const wc=active.view.webContents;
      const next=payload?.delta===0?1:Math.min(2.5,Math.max(.5,wc.getZoomFactor()+(.1*Number(payload?.delta||0))));
      wc.setZoomFactor(next);
    }return;
    case 'copy-url':if(active)clipboard.writeText(displayAddress(active));return;
    default: throw new Error('Unknown action');
  }
}
function updateSetting(key, value) {
  if (key === 'adblock' && typeof value === 'boolean') return setAdblock(value);
  if (key === 'sidebar' && typeof value === 'boolean') {settings.sidebar=value;positionActiveView();}
  else if (key === 'bookmarkBar' && typeof value === 'boolean') {settings.bookmarkBar=value;positionActiveView();positionDownloadPanel();}
  else if (key === 'accent' && ['violet','red','cyan','emerald'].includes(value)) settings.accent=value;
  else return false;
  saveSoon();emitState();sendInternalUpdate();return true;
}
function setAdblock(value) {
  settings.adblock=Boolean(value);
  if(blocker){
    for (const ses of [normalSession,privateSession]) {
      try {blocker.disableBlockingInSession(ses);} catch {}
      if(settings.adblock) try {blocker.enableBlockingInSession(ses);} catch (err) {console.error(err);}
    }
  }
  if(!settings.adblock) {
    for(const tab of tabs.values()) if(!tab.view.webContents.isDestroyed() && tab.kind==='web') {
      tab.view.webContents.executeJavaScript('window.__novaYT?.stop?.()').catch(()=>{});
    }
  } else {
    for(const tab of tabs.values()) injectYouTubeHelper(tab);
  }
  saveSoon();emitState();sendInternalUpdate();return settings.adblock;
}
async function initAdblock(forceRefresh=false) {
  try {
    const {ElectronBlocker}=require('@ghostery/adblocker-electron');
    if(!blocker){
      // Start with bundled offline fallback until richer lists are available.
      blocker=ElectronBlocker.parse(fs.readFileSync(path.join(__dirname,'src','filters-fallback.txt'),'utf8'));
      if(settings.adblock)for(const s of [normalSession,privateSession]) blocker.enableBlockingInSession(s);
      blockerStatus='basic';emitState();
    }
    if(forceRefresh) try{fs.unlinkSync(blockerCacheFile());}catch{}
    const full=await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
      path:blockerCacheFile(),read:fs.promises.readFile,write:fs.promises.writeFile
    });
    const old=blocker;
    for(const s of [normalSession,privateSession]) try {old.disableBlockingInSession(s);}catch{}
    blocker=full;
    if(settings.adblock)for(const s of [normalSession,privateSession]) blocker.enableBlockingInSession(s);
    blockerStatus='full';protectionError='';emitState();sendInternalUpdate();
    return true;
  } catch(err) {
    console.warn('Full ad lists unavailable; using bundled protection:',err.message);
    protectionError='Could not refresh full lists. Basic offline rules are still available.';
    blockerStatus=blocker?'basic':'error';emitState();sendInternalUpdate();
    return false;
  }
}
function uniqueDownloadPath(filename) {
  const base=app.getPath('downloads');
  const cleaned=path.basename(filename).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_') || 'download';
  const ext=path.extname(cleaned), stem=path.basename(cleaned,ext);
  let candidate=path.join(base,cleaned),i=1;
  while(fs.existsSync(candidate) && i<9999) candidate=path.join(base,`${stem} (${i++})${ext}`);
  return candidate;
}
function setupSession(ses, isPrivate) {
  // Prevent sites from rejecting the Electron-specific user agent token.
  ses.setUserAgent(ses.getUserAgent().replace(/\sElectron\/[\d.]+/g, ''));
  const grants=new Set();
  ses.setPermissionCheckHandler((_wc,permission,origin)=>grants.has(String(origin)+'|'+permission));
  ses.setPermissionRequestHandler((wc,permission,callback,details) => {
    const allowed=new Set(['media','notifications','geolocation']);
    if(!allowed.has(permission) || !wc || wc.isDestroyed()) return callback(false);
    let origin;
    try{const raw=details?.requestingUrl || wc.getURL();origin=new URL(raw);if(origin.protocol!=='https:' && origin.hostname!=='localhost')return callback(false);}
    catch{return callback(false);}
    dialog.showMessageBox(win,{type:'question',buttons:['Block','Allow'],defaultId:0,cancelId:0,
      title:'Website permission', message:`Allow ${origin.hostname} to use ${permission}?`,
      detail:'Only allow sites you trust.'}).then(({response})=>{if(response===1)grants.add(origin.origin+'|'+permission);callback(response===1);}).catch(()=>callback(false));
  });
  ses.on('will-download', (_event,item) => {
    const dest=uniqueDownloadPath(item.getFilename());
    item.setSavePath(dest);
    const row={id:String(Date.now())+'-'+Math.random().toString(36).slice(2,6),
      filename:path.basename(dest),path:isPrivate?'':dest,url:isPrivate?'':item.getURL(),
      received:0,total:item.getTotalBytes(),state:'progressing',time:Date.now(),private:isPrivate};
    if(!isPrivate){
      downloads.unshift(row);downloads=downloads.slice(0,100);saveSoon();
      activeDownloadItems.set(row.id,item);
    }
    let lastUiUpdate=0;
    item.on('updated', () => {
      row.received=item.getReceivedBytes();row.total=item.getTotalBytes();
      row.state=item.isPaused()?'paused':'progressing';
      if (!isPrivate && Date.now()-lastUiUpdate>=300) {
        lastUiUpdate=Date.now();emitDownloads();sendInternalUpdate();
      }
    });
    item.once('done', (_e,state)=>{
      row.state=state;row.received=item.getReceivedBytes();
      if(!isPrivate){activeDownloadItems.delete(row.id);saveSoon();emitDownloads();}
      sendInternalUpdate();
    });
    sendInternalUpdate();emitDownloads();
  });
}
function keyboard(event,input,sourceTab) {
  if(input.type!=='keyDown')return;
  const mod=process.platform==='darwin'?input.meta:input.control;
  const key=(input.key||'').toLowerCase();
  if(mod && !input.alt) {
    if(key==='l'){event.preventDefault();win.webContents.send('nova:focus-address');}
    else if(key==='t'){event.preventDefault();createTab();}
    else if(key==='w'){event.preventDefault();closeTab(activeId);}
    else if(key==='r'){event.preventDefault();browserAction('reload',{hard:input.shift});}
    else if(key==='d'){event.preventDefault();bookmarkCurrent();}
    else if(key==='b' && input.shift){event.preventDefault();updateSetting('bookmarkBar',!settings.bookmarkBar);}
    else if(key==='h'){event.preventDefault();createTab('nova://history');}
    else if(key==='j'){event.preventDefault();toggleDownloadPanel();}
    else if(key==='f'){event.preventDefault();browserAction('find-start');}
    else if(key==='tab'){event.preventDefault();moveTab(input.shift?-1:1);}
    else if(key==='n' && input.shift){event.preventDefault();createTab('nova://newtab',{private:true});}
    else if(['+','=','add'].includes(key)){event.preventDefault();browserAction('zoom',{delta:1});}
    else if(key==='-'){event.preventDefault();browserAction('zoom',{delta:-1});}
    else if(key==='0'){event.preventDefault();browserAction('zoom',{delta:0});}
  } else if(input.alt && ['left','right'].includes(key)) {
    event.preventDefault();browserAction(key==='left'?'back':'forward');
  } else if(key==='f5'){event.preventDefault();browserAction('reload');}
  else if(key==='escape' && downloadPanelOpen) {event.preventDefault();closeDownloadPanel();}
  else if(key==='escape' && activeFind) {browserAction('find-end');win.webContents.send('nova:hide-find');}
}
function createWindow() {
  win=new BrowserWindow({width:1440,height:910,minWidth:760,minHeight:500,
    frame:false,backgroundColor:'#0b0d15',title:'Nova Browser',show:false,
    icon:path.join(__dirname,'build','icon.png'),
    webPreferences:{preload:path.join(__dirname,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false}});
  win.setMenu(null);
  win.loadFile(path.join(__dirname,'src','chrome.html'));
  win.once('ready-to-show',()=>win.show());
  win.on('resize',()=>{positionActiveView();positionDownloadPanel();});
  win.on('maximize',emitState);win.on('unmaximize',emitState);
  win.on('closed',()=>{downloadPanelOpen=false;downloadPanel=null;win=null;for(const tab of tabs.values()) if(!tab.view.webContents.isDestroyed())tab.view.webContents.close();tabs.clear();groups.clear();order=[];activeId=null;});
  win.webContents.on('before-input-event',(e,i)=>keyboard(e,i));
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event)=>event.preventDefault());
  downloadPanel = new WebContentsView({webPreferences:{
    preload:path.join(__dirname,'downloads-preload.js'),
    nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true
  }});
  downloadPanel.setBackgroundColor('#181b29');
  downloadPanel.webContents.loadFile(path.join(__dirname,'src','downloads-popover.html')).catch(console.error);
  downloadPanel.webContents.on('will-navigate',event=>event.preventDefault());
  downloadPanel.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  downloadPanel.webContents.on('before-input-event',(event,input)=>{
    if(input.type==='keyDown' && input.key==='Escape'){event.preventDefault();closeDownloadPanel();}
    if(input.type==='keyDown' && (input.control || input.meta) && (input.key||'').toLowerCase()==='j'){event.preventDefault();closeDownloadPanel();}
  });
  createTab();
}
function checkInternalSender(event) {
  if (event.senderFrame !== event.sender.mainFrame) return null;
  for(const tab of tabs.values()) if(tab.view.webContents.id===event.sender.id && tab.kind==='internal' &&
      event.sender.getURL().startsWith('file://') && event.sender.getURL().includes('/internal.html')) return tab;
  return null;
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  if (process.platform === 'win32') app.setAppUserModelId('com.nova.browser');
  if (process.platform === 'darwin' && app.dock && fs.existsSync(path.join(__dirname,'build','icon.png')))
    app.dock.setIcon(path.join(__dirname,'build','icon.png'));
  loadData();
  normalSession=session.fromPartition('persist:nova');
  privateSession=session.fromPartition('nova-private');
  setupSession(normalSession,false);setupSession(privateSession,true);
  ipcMain.handle('nova:action',(event,action,payload)=>{
    if(!win || event.sender.id!==win.webContents.id)return null;
    return browserAction(String(action).slice(0,50),payload||{});
  });
  ipcMain.handle('nova:get-state',(event)=>{
    if(!win || event.sender.id!==win.webContents.id)return null;
    return snapshot();
  });
  ipcMain.handle('nova:downloads',(event,action,payload)=>{
    if(!downloadPanel || event.sender.id!==downloadPanel.webContents.id ||
        event.senderFrame!==event.sender.mainFrame ||
        !event.sender.getURL().startsWith('file://')) return null;
    switch(action){
      case 'list':return publicDownloads();
      case 'close':closeDownloadPanel();return true;
      case 'open-download':case 'show-download':case 'pause-download':case 'resume-download':case 'cancel-download':case 'clear-downloads':
        return downloadAction(action,payload?.id);
      case 'all-downloads':closeDownloadPanel();createTab('nova://downloads');return true;
      default:return null;
    }
  });
  ipcMain.handle('nova:internal',(event,action,payload)=>{
    const tab=checkInternalSender(event);if(!tab)return null;
    switch(action){
      case 'get-data':return {page:tab.page,private:tab.private,settings,bookmarks,
        history:tab.private?[]:historyItems,downloads:tab.private?[]:downloads,protection:blockerStatus,protectionError,updates:updateService?.snapshot() || null};
      case 'navigate':navigate(tab.id,payload?.text);return true;
      case 'new-tab':createTab(payload?.url||'nova://newtab',{private:tab.private});return true;
      case 'delete-bookmark':{
        return removeBookmark(payload?.url);
      }
      case 'remove-history':{
        const url=String(payload?.url||'');historyItems=historyItems.filter(h=>h.url!==url);saveSoon();sendInternalUpdate();return true;
      }
      case 'clear-history':historyItems=[];saveSoon();sendInternalUpdate();return true;
      case 'toggle-setting':return updateSetting(payload?.key,payload?.value);
      case 'refresh-filters':initAdblock(true);return true;
      case 'open-release-page':shell.openExternal('https://github.com/NoobIsADev/nova/releases/latest');return true;
      case 'check-updates':return updateService?.check() ?? false;
      case 'install-update':return false; // Updates install automatically when the browser closes.
      case 'show-download':{
        const item=downloads.find(d=>d.id===payload?.id);
        if(item && item.path && fs.existsSync(item.path))shell.showItemInFolder(item.path);
        return true;
      }
      case 'clear-downloads':return downloadAction('clear-downloads');
      default:return null;
    }
  });
  // Windows Setup, Linux AppImage, and signed macOS DMG builds receive updates.
  // Unsigned macOS builds and Windows portable builds stay manual-update only.
  const signedMac = process.platform === 'darwin' && app.isPackaged && signedMacUpdateAvailable(process.resourcesPath);
  const canLoadUpdater = app.isPackaged && (
    (process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_FILE) ||
    (process.platform === 'linux' && !!process.env.APPIMAGE) ||
    (process.platform === 'darwin' && signedMac)
  );
  updateService = createUpdateService({
    app, signedMac, notify:()=>{emitState();sendInternalUpdate();},
    updater:canLoadUpdater ? require('electron-updater').autoUpdater : null
  });
  createWindow();
  updateService.start();
  // The offline rules protect immediately, while full community lists update in the background.
  initAdblock();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on('before-quit',()=>{
  updateService?.stop();
  clearTimeout(writeTimer);
  if(settings)try{fs.writeFileSync(dataFile(),JSON.stringify(settingsFile(),null,2));}catch{}
});
// Closing the last window quits on all platforms (including macOS), so the
// downloaded update installs on exit instead of leaving a headless Mac app.
app.on('window-all-closed',()=>app.quit());
