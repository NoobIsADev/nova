'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const {preferredDownloadPanelHeight, PANEL_MAX_HEIGHT}=require('../lib/download-panel');
const root=path.join(__dirname,'..');

test('download panel adapts to the number and progress state of recent downloads',()=>{
  const empty=preferredDownloadPanelHeight([]);
  const one=preferredDownloadPanelHeight([{state:'completed'}]);
  const two=preferredDownloadPanelHeight([{state:'completed'},{state:'completed'}]);
  const four=preferredDownloadPanelHeight(Array.from({length:4},()=>({state:'completed'})));
  const active=preferredDownloadPanelHeight(Array.from({length:4},()=>({state:'progressing'})));
  const many=preferredDownloadPanelHeight(Array.from({length:12},()=>({state:'completed'})));
  assert.ok(one>empty, 'a populated popup should grow from the empty state');
  assert.ok(one<408, 'one download should not leave the old oversized 408px popup');
  assert.ok(empty<408);
  assert.ok(two>one);
  assert.ok(four>two);
  assert.ok(active>four, 'progress bars need extra vertical room');
  assert.equal(many,PANEL_MAX_HEIGHT, 'long lists should scroll under a cap');
  assert.equal(preferredDownloadPanelHeight(null),empty);
  assert.equal(preferredDownloadPanelHeight([{state:'paused'}]),preferredDownloadPanelHeight([{state:'progressing'}]));
});

function mockBrowser(){
  let nextId=1;
  const allWindows=[];
  const sandbox=fs.mkdtempSync(path.join(os.tmpdir(),'nova-download-popup-'));
  class Contents {
    constructor(){this.id=nextId++;this.listeners=new Map();this.destroyed=false;this.mainFrame={};this.url='';}
    on(name,listener){const ls=this.listeners.get(name)||[];ls.push(listener);this.listeners.set(name,ls);}
    once(name,listener){this.on(name,listener);}
    fire(name,...args){for(const listener of this.listeners.get(name)||[])listener(...args);}
    isDestroyed(){return this.destroyed;}getURL(){return this.url;}
    loadFile(filepath){this.url='file://'+filepath;return Promise.resolve();}
    loadURL(url){this.url=url;return Promise.resolve();}
    setWindowOpenHandler(){}setBackgroundColor(){}send(){}focus(){}
    canGoBack(){return false;}canGoForward(){return false;}close(){this.destroyed=true;}
  }
  class View {
    constructor(){this.webContents=new Contents();this.bounds=null;}
    setBounds(bounds){this.bounds=bounds;}setBackgroundColor(){}
  }
  class Window {
    constructor(opts){this.opts=opts;this.webContents=new Contents();this.dead=false;this.views=[];this.focused=false;
      this.contentView={addChildView:view=>{if(!this.views.includes(view))this.views.push(view);},
        removeChildView:view=>{const idx=this.views.indexOf(view);if(idx>=0)this.views.splice(idx,1);}};
      allWindows.push(this);
    }
    setMenu(){}loadFile(){}on(){}once(){}show(){}focus(){this.focused=true;}
    isFocused(){return this.focused;}isDestroyed(){return this.dead;}isMaximized(){return false;}
    getContentSize(){return [this.opts.width,this.opts.height];}
  }
  class DownloadItem {
    constructor(filename){this.filename=filename;this.listeners=new Map();this.received=0;this.total=1000;this.paused=false;}
    getFilename(){return this.filename;}getURL(){return 'https://example.org/'+this.filename;}
    getTotalBytes(){return this.total;}getReceivedBytes(){return this.received;}
    setSavePath(value){this.path=value;}isPaused(){return this.paused;}
    pause(){this.paused=true;}resume(){this.paused=false;}cancel(){}
    on(name,fn){this.listeners.set(name,fn);}once(name,fn){this.listeners.set(name,fn);}
    fire(name,...args){this.listeners.get(name)?.(...args);}
  }
  const electron={app:{on(){},whenReady(){return {then(){}}},getPath:()=>sandbox},BrowserWindow:Window,WebContentsView:View,
    ipcMain:{},session:{},dialog:{},shell:{},Menu:{},nativeImage:{createFromPath:()=>({isEmpty:()=>false})},clipboard:{},
    screen:{getCursorScreenPoint:()=>({x:0,y:0}),getDisplayNearestPoint:()=>({workArea:{x:0,y:0,width:1920,height:1080}})}};
  const originalRequire=createRequire(path.join(root,'main.js'));
  const context={__dirname:root,require:name=>name==='electron'?electron:originalRequire(name),console,process,Buffer,URL,
    setTimeout:()=>1,clearTimeout:()=>{}};
  const source=fs.readFileSync(path.join(root,'main.js'),'utf8');
  vm.runInNewContext(source+`
    settings={adblock:false,accent:'violet',sidebar:false,bookmarkBar:true};
    bookmarks=[];historyItems=[];downloads=[];
    updateService={snapshot(){return {status:'unsupported'}}};
    globalThis.__test={make:(o)=>createBrowserController(o),setup:(session,priv)=>setupSession(session,priv),saved:()=>settingsFile()};
  `,context,{filename:'main.js'});
  function makeSession(){const listeners=new Map();return {
    getUserAgent:()=> 'Electron/44.0.0 Nova',setUserAgent(){},
    setPermissionCheckHandler(){},setPermissionRequestHandler(){},
    on:(name,fn)=>listeners.set(name,fn),
    start:(item,contents)=>{const fn=listeners.get('will-download');assert.ok(fn);fn({},item,contents);}
  };}
  return {api:context.__test,makeSession,DownloadItem,allWindows,dispose:()=>fs.rmSync(sandbox,{recursive:true,force:true})};
}

test('starting a download opens only the originating window and grows its popup',()=>{
  const m=mockBrowser();
  try {
    const ses=m.makeSession();m.api.setup(ses,false);
    const first=m.api.make();const second=m.api.make();
    const origin=second.tabs.get(second.activeId).view.webContents;
    const one=new m.DownloadItem('first.zip');
    ses.start(one,origin);
    assert.equal(first.snapshot().downloadPanelOpen,false);
    assert.equal(second.snapshot().downloadPanelOpen,true);
    assert.ok(second.window.views.includes(second.downloadPanel));
    assert.ok(!first.window.views.includes(first.downloadPanel));
    const firstHeight=second.downloadPanel.bounds.height;
    assert.equal(firstHeight,preferredDownloadPanelHeight([{state:'progressing'}]));
    const two=new m.DownloadItem('second.zip');
    ses.start(two,origin);
    assert.equal(second.snapshot().downloadPanelOpen,true,'new downloads must not toggle the existing popup closed');
    assert.ok(second.downloadPanel.bounds.height>firstHeight);
    // Updates reflow the height when progress indicators disappear.
    one.received=1000;one.fire('done',{},'completed');
    assert.equal(second.snapshot().downloads.filter(d=>d.state==='completed').length,1);
    assert.ok(second.downloadPanel.bounds.height<preferredDownloadPanelHeight([{state:'progressing'},{state:'progressing'}]));
    second.closeDownloadPanel();assert.equal(second.snapshot().downloadPanelOpen,false);
    ses.start(new m.DownloadItem('third.zip'),origin);
    assert.equal(second.snapshot().downloadPanelOpen,true, 'the next download reopens a closed popup');
  } finally {m.dispose();}
});

test('long downloads list is capped; clearing finished entries immediately shrinks popup',()=>{
  const m=mockBrowser();
  try {
    const ses=m.makeSession();m.api.setup(ses,false);
    const c=m.api.make();const origin=c.tabs.get(c.activeId).view.webContents;
    for(let i=0;i<13;i++){
      const d=new m.DownloadItem(`file-${i}.zip`);ses.start(d,origin);
      d.received=1000;d.fire('done',{},'completed');
    }
    assert.equal(c.downloadPanel.bounds.height,PANEL_MAX_HEIGHT);
    assert.equal(c.snapshot().downloads.length,12);
    assert.equal(c.action('clear-downloads'),true);
    assert.equal(c.snapshot().downloads.length,0);
    assert.equal(c.downloadPanel.bounds.height,preferredDownloadPanelHeight([]));
  } finally {m.dispose();}
});

test('private downloads open their own popup and are never added to saved history',()=>{
  const m=mockBrowser();
  try {
    const ses=m.makeSession();m.api.setup(ses,true);
    const c=m.api.make();const other=m.api.make();
    const origin=c.newTab('https://example.org',{private:true});
    const wc=c.tabs.get(origin).view.webContents;
    const item=new m.DownloadItem('secret.pdf');ses.start(item,wc);
    assert.equal(c.snapshot().downloadPanelOpen,true);
    assert.equal(c.snapshot().downloads[0].filename,'secret.pdf');
    assert.equal(other.snapshot().downloads.length,0);
    assert.equal(m.api.saved().downloads.length,0);
    assert.equal(c.privateDownloads[0].path,item.path);
    // Private download controls work while the app is running.
    assert.equal(c.action('pause-download',{id:c.privateDownloads[0].id}),true);
    assert.equal(c.privateDownloads[0].state,'paused');
    item.received=1000;item.fire('done',{},'completed');
    assert.equal(c.snapshot().downloads[0].state,'completed');
    assert.equal(m.api.saved().downloads.length,0);
  } finally {m.dispose();}
});

test('tiny windows clamp the adaptive popup so it stays within the content area',()=>{
  const m=mockBrowser();
  try{
    const ses=m.makeSession();m.api.setup(ses,false);
    const c=m.api.make({bounds:{height:330,width:760}});
    const wc=c.tabs.get(c.activeId).view.webContents;
    for(let i=0;i<10;i++)ses.start(new m.DownloadItem('small-'+i),wc);
    assert.ok(c.downloadPanel.bounds.height <= 330-103+4);
    assert.ok(c.downloadPanel.bounds.x>=0);
    assert.ok(c.downloadPanel.bounds.x+c.downloadPanel.bounds.width<=760);
  } finally {m.dispose();}
});
