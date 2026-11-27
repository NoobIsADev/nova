'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const {isPointOutsideBounds,detachedWindowBounds}=require('../lib/tab-detach');
const root=path.join(__dirname,'..');

test('detach only when the cursor leaves the native browser window',()=>{
  const bounds={x:200,y:100,width:1000,height:700};
  assert.equal(isPointOutsideBounds({x:500,y:400},bounds),false);
  assert.equal(isPointOutsideBounds({x:1199,y:799},bounds),false);
  assert.equal(isPointOutsideBounds({x:1212,y:400},bounds),true);
  assert.equal(isPointOutsideBounds({x:30,y:400},bounds),true);
  assert.equal(isPointOutsideBounds(null,bounds),false);
});
test('new window follows the drop point and stays inside monitor work area',()=>{
  const work={x:-1920,y:0,width:1920,height:1080};
  const result=detachedWindowBounds({x:-500,y:400},work);
  assert.ok(result.x<=-500 && result.x>=work.x);
  assert.ok(result.y>=work.y && result.y+result.height<=work.y+work.height);
  assert.ok(result.x+result.width<=work.x+work.width);
  const corner=detachedWindowBounds({x:-1900,y:3},work);
  assert.equal(corner.x,-1920);assert.equal(corner.y,0);
});
function mockApp(){
  let nextId=1;
  const windows=[];
  const mouse={point:{x:300,y:400}};
  class WC{
    constructor(){this.id=nextId++;this.listeners=new Map();this.mainFrame={};this.url='';this.destroyed=false;this.dragged=null;}
    on(name,cb){const ls=this.listeners.get(name)||[];ls.push(cb);this.listeners.set(name,ls);}
    once(name,cb){this.on(name,cb);}
    fire(name,...args){for(const cb of this.listeners.get(name)||[])cb(...args);}
    setWindowOpenHandler(){} setBackgroundColor(){} send(){} focus(){} isDestroyed(){return this.destroyed;}
    canGoBack(){return false;} canGoForward(){return false;} getURL(){return this.url;}
    close(){this.destroyed=true;}
    loadFile(file){this.url='file://'+file;return Promise.resolve();}
    loadURL(url){this.url=url;return Promise.resolve();}
    startDrag(args){this.dragged=args;}
  }
  class View{
    constructor(){this.webContents=new WC();this.bounds=null;}
    setBackgroundColor(){} setBounds(b){this.bounds=b;}
  }
  class Window{
    constructor(opts){this.opts=opts;this.webContents=new WC();this.views=[];this.dead=false;this.focused=false;
      this.contentView={addChildView:v=>{if(!this.views.includes(v))this.views.push(v);},removeChildView:v=>{const i=this.views.indexOf(v);if(i>=0)this.views.splice(i,1);}};
      windows.push(this);
    }
    setMenu(){} loadFile(){} on(){} once(){} show(){} focus(){this.focused=true;}
    isFocused(){return this.focused;} isDestroyed(){return this.dead;} isMaximized(){return false;}
    getContentSize(){return [this.opts.width,this.opts.height];}
    getBounds(){return {x:this.opts.x||0,y:this.opts.y||0,width:this.opts.width,height:this.opts.height};}
    static getAllWindows(){return windows.filter(w=>!w.dead);}
  }
  const electron={app:{on(){},whenReady(){return {then(){}}}},BrowserWindow:Window,WebContentsView:View,
    ipcMain:{},session:{},dialog:{},shell:{},Menu:{},nativeImage:{createFromPath:()=>({isEmpty:()=>false})},clipboard:{},
    screen:{getCursorScreenPoint:()=>mouse.point,getDisplayNearestPoint:()=>({workArea:{x:0,y:0,width:2560,height:1440}})}};
  const originalRequire=createRequire(path.join(root,'main.js'));
  const context={__dirname:root,require:name=>name==='electron'?electron:originalRequire(name), console, process, Buffer,URL,
    // Avoid persisting mocked app data during isolated source tests.
    setTimeout:()=>1, clearTimeout:()=>{}};
  const source=fs.readFileSync(path.join(root,'main.js'),'utf8');
  vm.runInNewContext(source+`
    settings={adblock:false,accent:'violet',sidebar:false,bookmarkBar:true};
    bookmarks=[];historyItems=[];downloads=[];
    updateService={snapshot(){return {status:'unsupported'}}};
    globalThis.__test={
      make:()=>createBrowserController(),
      all:()=>[...controllers],
      startDrag:(event,id)=>startNativeDownloadDrag(event,id),
      setDownloads:(items)=>{downloads=items;}
    };`,context,{filename:'main.js'});
  return {api:context.__test,mouse,windows};
}
test('tearing off a live tab reparents its WebContentsView, preserving session and history',()=>{
  const m=mockApp();const first=m.api.make();
  const id=first.newTab('https://example.org/test');
  const view=first.tabs.get(id).view;
  // Dropping inside the same browser should do nothing.
  assert.equal(first.detachTab(id),false);
  assert.equal(first.tabs.get(id).view,view);
  // Dropping outside creates a second independent browser window.
  m.mouse.point={x:1650,y:500};
  assert.equal(first.detachTab(id),true);
  const windows=m.api.all();
  assert.equal(windows.length,2);
  const second=windows.find(c=>c!==first);
  assert.ok(second);
  assert.equal(second.tabs.get(id).view,view);
  assert.equal(second.tabs.get(id).owner,second);
  assert.equal(view.webContents.destroyed,false);
  assert.equal(first.tabs.has(id),false);
  assert.ok(first.tabs.size>=1); // original browser remains usable
  assert.ok(second.window.opts.x>1000);
  // Navigating the moved webContents must now update the destination, not source.
  view.webContents.fire('did-navigate',{},'https://example.org/after');
  assert.equal(second.tabs.get(id).url,'https://example.org/after');
  assert.equal(first.tabs.has(id),false);
});
test('the detached window has fully independent tabs, including privacy state',()=>{
  const m=mockApp();const source=m.api.make();
  const regular=source.newTab('https://example.com/first');
  const privateId=source.newTab('https://example.com/private',{private:true});
  const privateView=source.tabs.get(privateId).view;
  m.mouse.point={x:1700,y:550};
  assert.equal(source.detachTab(privateId),true);
  const dest=m.api.all().find(c=>c!==source);
  assert.equal(dest.tabs.get(privateId).private,true);
  assert.equal(dest.tabs.get(privateId).view,privateView);
  assert.equal(source.tabs.get(regular).url,'https://example.com/first');
  const third=dest.newTab('https://example.net/other');
  assert.ok(dest.tabs.has(third));
  assert.equal(source.tabs.has(third),false);
  const s=source.snapshot(),d=dest.snapshot();
  assert.equal(s.tabs.some(t=>t.id===privateId),false);
  assert.equal(d.tabs.some(t=>t.id===privateId&&t.private),true);
});
test('native download drag accepts only completed existing files from trusted views',()=>{
  const m=mockApp();const ctrl=m.api.make();
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'nova-native-drag-'));
  try {
    const file=path.join(tmp,'completed.txt');fs.writeFileSync(file,'download data');
    m.api.setDownloads([{id:'good',path:file,state:'completed'},{id:'wait',path:file,state:'progressing'},
      {id:'gone',path:path.join(tmp,'missing'),state:'completed'}]);
    const wc=ctrl.downloadPanel.webContents;
    const event={sender:wc,senderFrame:wc.mainFrame};
    assert.equal(m.api.startDrag(event,'wait'),false);
    assert.equal(m.api.startDrag(event,'gone'),false);
    assert.equal(m.api.startDrag(event,'good'),true);
    assert.equal(wc.dragged.file,file);
    const webId=ctrl.newTab('https://example.org');
    const tabWc=ctrl.tabs.get(webId).view.webContents;
    const other={sender:tabWc,senderFrame:tabWc.mainFrame};
    assert.equal(m.api.startDrag(other,'good'),false); // only internal/download pages
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});
test('download popover and full download page expose native file drag with a verified id only',()=>{
  const pop=fs.readFileSync(path.join(root,'src/downloads-popover.js'),'utf8');
  const internal=fs.readFileSync(path.join(root,'src/internal.js'),'utf8');
  const main=fs.readFileSync(path.join(root,'main.js'),'utf8');
  assert.match(pop,/startDownloadDrag\(d\.id\)/);
  assert.match(internal,/startDownloadDrag\(item\.id\)/);
  assert.match(main,/event\.sender\.startDrag\(\{file:download\.path,icon\}\)/);
  assert.match(main,/download\.state!=='completed'/);
});
