'use strict';
const $ = sel => document.querySelector(sel);
const icon=(n,size=18)=>window.novaIcon(n,size);
let snapshot=null;
let editing=false;
let lastAddress='';
const node=(tag,cl,text)=>{const e=document.createElement(tag);if(cl)e.className=cl;if(text!==undefined)e.textContent=text;return e;};
function put(sel,name,size=18){$(sel).innerHTML=icon(name,size);}
put('#add-tab','plus',18);put('#btn-min','minus',15);put('#btn-max','maximize',13);put('#btn-close','x',16);
put('#back','back');put('#forward','forward');put('#reload','reload');put('#home','home');
put('#bookmark','star',18);put('#downloads','download');put('#settings','menu');
put('#side-home','home',21);put('#side-youtube','youtube',22);put('#side-discord','discord',21);put('#side-twitch','twitch',21);
put('#side-github','github',21);put('#side-history','clock',20);put('#side-downloads','download',20);put('#side-settings','settings',20);
put('#bookmarks-more','chevron',17);put('#find-next','chevron',17);put('#find-close','x',16);
function current(){return snapshot?.tabs?.find(tab=>tab.id===snapshot.activeId);}
function groupById(id){return (snapshot?.groups||[]).find(g=>g.id===id);}
function dragPayload(e){const value=e.dataTransfer.getData('text/nova-tab');return /^\d+$/.test(value)?Number(value):null;}
function makeGroup(group){
  const b=node('button','tab-group group-'+group.color+(group.collapsed?' collapsed':'')+(current()?.groupId===group.id?' has-selected':''));
  b.type='button';b.dataset.groupId=group.id;b.title=`${group.name} — ${group.collapsed?'expand':'collapse'} tab group`;
  b.setAttribute('aria-expanded',String(!group.collapsed));
  const dot=node('span','group-dot');const name=node('span','group-name',group.name);
  const count=node('span','group-count',String((snapshot?.tabs||[]).filter(tab=>tab.groupId===group.id).length));
  const arrow=node('span','group-arrow');arrow.innerHTML=icon('chevron',13);
  b.append(dot,name,count,arrow);
  b.addEventListener('click',()=>window.nova.action('toggle-group',{groupId:group.id}));
  b.addEventListener('contextmenu',e=>{e.preventDefault();window.nova.action('group-context',{groupId:group.id});});
  b.addEventListener('dragover',e=>{if(!e.dataTransfer.types.includes('text/nova-tab'))return;e.preventDefault();e.dataTransfer.dropEffect='move';b.classList.add('drag-over');});
  b.addEventListener('dragleave',()=>b.classList.remove('drag-over'));
  b.addEventListener('drop',e=>{e.preventDefault();b.classList.remove('drag-over');const id=dragPayload(e);if(id!==null)window.nova.action('add-tab-to-group',{id,groupId:group.id});});
  return b;
}
function makeTab(tab){
  const b=node('div','tab'+(tab.id===snapshot.activeId?' selected':'')+(tab.groupId?' grouped group-'+groupById(tab.groupId)?.color:''));
  b.setAttribute('role','tab');b.setAttribute('aria-selected',String(tab.id===snapshot.activeId));
  b.dataset.tabId=tab.id;b.title=tab.title+'\n'+(tab.url||'');b.draggable=true;
  const fi=node('span','tab-icon');
  if(tab.private)fi.innerHTML=icon('private',15);
  else if(tab.kind==='internal'){const img=node('img');img.src='../build/logo.png';img.alt='';fi.append(img);}
  else if(tab.favicon){const img=node('img');img.src=tab.favicon;img.referrerPolicy='no-referrer';img.onerror=()=>{img.replaceWith(node('span','','◉'));};fi.append(img);}
  else fi.innerHTML=icon('globe',15);
  const title=node('span','tab-title',tab.title||'New Tab');
  const close=node('button','tab-close');close.type='button';close.title='Close tab';close.setAttribute('aria-label','Close '+tab.title);close.innerHTML=icon('x',13);
  close.addEventListener('click',e=>{e.stopPropagation();window.nova.action('close-tab',{id:tab.id});});
  b.addEventListener('click',()=>window.nova.action('select-tab',{id:tab.id}));
  b.addEventListener('auxclick',e=>{if(e.button===1)window.nova.action('close-tab',{id:tab.id});});
  b.addEventListener('contextmenu',e=>{e.preventDefault();window.nova.action('tab-context',{id:tab.id});});
  b.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/nova-tab',String(tab.id));e.dataTransfer.effectAllowed='move';b.classList.add('dragging');});
  b.addEventListener('dragend',()=>{b.classList.remove('dragging');document.querySelectorAll('.drag-over,.drag-left,.drag-right').forEach(el=>el.classList.remove('drag-over','drag-left','drag-right'));});
  b.addEventListener('dragover',e=>{
    if(!e.dataTransfer.types.includes('text/nova-tab'))return;e.preventDefault();e.dataTransfer.dropEffect='move';
    const rel=(e.clientX-b.getBoundingClientRect().left)/Math.max(1,b.clientWidth);
    b.classList.toggle('drag-left',rel<.23);b.classList.toggle('drag-right',rel>.77);
    b.classList.toggle('drag-over',rel>=.23&&rel<=.77);
  });
  b.addEventListener('dragleave',()=>b.classList.remove('drag-over','drag-left','drag-right'));
  b.addEventListener('drop',e=>{
    e.preventDefault();e.stopPropagation();b.classList.remove('drag-over','drag-left','drag-right');
    const id=dragPayload(e);if(id===null||id===tab.id)return;
    const rel=(e.clientX-b.getBoundingClientRect().left)/Math.max(1,b.clientWidth);
    if(rel<.23||rel>.77)window.nova.action('reorder-tab',{id,targetId:tab.id,after:rel>.77});
    else window.nova.action('group-with-tab',{id,targetId:tab.id});
  });
  b.append(fi,title,close);return b;
}
function applyTabDensity(){
  const root=$('#tabs');if(!root)return;
  for(const tab of root.querySelectorAll('.tab')){
    const width=tab.getBoundingClientRect().width;
    tab.classList.toggle('micro',width<67);tab.classList.toggle('narrow',width>=67&&width<111);
  }
  const groupCount=root.querySelectorAll('.tab-group').length;
  const tabCount=root.querySelectorAll('.tab').length;
  root.classList.toggle('dense',(tabCount+groupCount)>11);
  root.classList.toggle('super-dense',(tabCount+groupCount)>31);
}
function renderTabs(){
  const root=$('#tabs');root.replaceChildren();
  const seen=new Set();
  for(const tab of snapshot?.tabs||[]){
    if(tab.groupId){
      const group=groupById(tab.groupId);
      if(group && !seen.has(group.id)){root.append(makeGroup(group));seen.add(group.id);}
      if(group?.collapsed)continue;
    }
    root.append(makeTab(tab));
  }
  requestAnimationFrame(applyTabDensity);
}
function renameGroupInPlace(id){
  const group=groupById(Number(id));const pill=[...document.querySelectorAll('.tab-group')].find(p=>Number(p.dataset.groupId)===Number(id));
  if(!group||!pill)return;
  const input=node('input','group-edit');input.value=group.name;input.maxLength=36;input.setAttribute('aria-label','Group name');
  pill.replaceChildren(input);input.focus();input.select();
  let submitted=false;
  const submit=save=>{if(submitted)return;submitted=true;
    if(save)window.nova.action('rename-group',{groupId:group.id,name:input.value});else renderTabs();
  };
  input.addEventListener('click',e=>e.stopPropagation());
  input.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();submit(true);}if(e.key==='Escape'){e.preventDefault();submit(false);}});
  input.addEventListener('blur',()=>submit(true));
}
function renderBookmarks(){
  const items=$('#bookmark-items');items.replaceChildren();
  const list=snapshot?.bookmarks||[];
  $('#bookmarks-more').classList.toggle('hidden',list.length===0);
  if(!list.length)return;
  for(const bm of list){
    const b=node('button','bookmark-item');b.type='button';b.title=bm.title+'\n'+bm.url;
    const ico=node('span','bookmark-favicon');
    if(bm.favicon&&/^https?:\/\//i.test(bm.favicon)){
      const img=node('img');img.src=bm.favicon;img.alt='';img.referrerPolicy='no-referrer';
      img.onerror=()=>img.replaceWith(node('span','',new URL(bm.url).hostname[0].toUpperCase()));ico.append(img);
    }else {try {ico.textContent=new URL(bm.url).hostname[0].toUpperCase();}catch{ico.textContent='•';}}
    b.append(ico,node('span','bookmark-title',bm.title||bm.url));
    b.addEventListener('click',()=>window.nova.action('open-bookmark',{url:bm.url}));
    b.addEventListener('auxclick',e=>{if(e.button===1)window.nova.action('new-tab',{url:bm.url});});
    b.addEventListener('contextmenu',e=>{e.preventDefault();window.nova.action('bookmark-context',{url:bm.url});});
    items.append(b);
  }
}
function render(){
  if(!snapshot)return;
  document.documentElement.dataset.accent=snapshot.settings?.accent||'violet';
  const bookmarkBarVisible=Boolean(snapshot.bookmarksBarVisible);
  document.documentElement.style.setProperty('--chrome-height',bookmarkBarVisible?'139px':'103px');
  $('#bookmarksbar').classList.toggle('hidden',!bookmarkBarVisible);
  const tab=current();
  const showSide=Boolean(snapshot.settings.sidebar && tab?.kind==='internal' && tab?.page==='newtab');
  $('#sidebar').classList.toggle('is-hidden',!showSide);
  $('#empty-area').style.left=showSide?'74px':'0';
  $('#downloads').classList.toggle('popover-active',Boolean(snapshot.downloadPanelOpen));
  $('#downloads').setAttribute('aria-expanded',String(Boolean(snapshot.downloadPanelOpen)));
  $('#downloads').classList.toggle('has-activity',Boolean(snapshot.downloads?.some(d=>['progressing','paused'].includes(d.state))));
  renderTabs();renderBookmarks();
  if(tab){
    const address=tab.url||'nova://newtab';lastAddress=address;
    if(!editing)$('#address').value=tab.kind==='internal'?'':address;
    $('#address').placeholder=tab.kind==='internal'?'Search with DuckDuckGo or enter a URL':'Search or enter a URL';
    $('#back').disabled=!tab.canGoBack;$('#forward').disabled=!tab.canGoForward;
    put('#reload',tab.loading?'x':'reload');
    put('#site-status',tab.kind==='internal'?'spark':tab.url.startsWith('https://')?'lock':'globe',15);
    $('#bookmark').style.color='';
    if(snapshot.bookmarkedUrls?.includes(tab.url))$('#bookmark').style.color='var(--accent)';
    const shield=$('#address-shield');shield.classList.toggle('on',Boolean(snapshot.settings.adblock));
    shield.innerHTML=icon(snapshot.settings.adblock?'shield':'shieldoff',17);
    shield.title=`Protection ${snapshot.settings.adblock ? 'enabled' : 'paused'} — ${snapshot.protection==='full'?'community filter lists':snapshot.protection==='basic'?'basic filters':snapshot.protection}`;
    $('#progress').classList.toggle('loading',Boolean(tab.loading));
    document.title=(tab.title||'New Tab')+' — Nova Browser';
    for(const btn of document.querySelectorAll('[data-page]'))btn.classList.toggle('active',tab.kind==='internal'&&btn.dataset.page===tab.url.replace('nova://',''));
  }
  put('#btn-max',snapshot.windowMaximized?'restore':'maximize',14);
}
window.nova.onState(s=>{snapshot=s;render();});
window.nova.onRenameGroup(renameGroupInPlace);
new ResizeObserver(()=>applyTabDensity()).observe($('#tabs'));
window.nova.getState().then(s=>{snapshot=s;render();});
window.nova.onFocusAddress(()=>{$('#address').focus();$('#address').select();});
window.nova.onFind(open=>{if(open){$('#findbox').classList.remove('hidden');$('#find-input').focus();$('#find-input').select();}
  else{$('#findbox').classList.add('hidden');$('#find-input').value='';}});
$('#address').addEventListener('focus',()=>{editing=true;$('#address').select();});
$('#address').addEventListener('blur',()=>{editing=false;const t=current();if(t)$('#address').value=t.kind==='internal'?'':t.url;});
$('#address-form').addEventListener('submit',e=>{e.preventDefault();const text=$('#address').value;editing=false;$('#address').blur();window.nova.action('navigate',{text});});
$('#address').addEventListener('keydown',e=>{if(e.key==='Escape'){$('#address').blur();e.preventDefault();}});
$('#add-tab').addEventListener('click',()=>window.nova.action('new-tab'));
$('#bookmarks-more').addEventListener('click',()=>window.nova.action('bookmark-menu'));
$('#bookmark-items').addEventListener('wheel',e=>{if(e.deltaY){e.preventDefault();e.currentTarget.scrollLeft+=e.deltaY;}},{passive:false});
$('#back').addEventListener('click',()=>window.nova.action('back'));
$('#forward').addEventListener('click',()=>window.nova.action('forward'));
$('#reload').addEventListener('click',()=>window.nova.action(current()?.loading?'stop':'reload'));
$('#home').addEventListener('click',()=>window.nova.action('home'));
$('#bookmark').addEventListener('click',()=>window.nova.action('bookmark'));
$('#address-shield').addEventListener('click',()=>window.nova.action('toggle-adblock'));
$('#downloads').addEventListener('click',()=>window.nova.action('toggle-download-popover'));
$('#settings').addEventListener('click',()=>window.nova.action('open-page',{page:'settings'}));
for(const b of document.querySelectorAll('[data-window]'))b.addEventListener('click',()=>window.nova.action(b.dataset.window));
for(const b of document.querySelectorAll('[data-url]'))b.addEventListener('click',()=>window.nova.action('new-tab',{url:b.dataset.url}));
for(const b of document.querySelectorAll('[data-page]'))b.addEventListener('click',()=>window.nova.action('open-page',{page:b.dataset.page}));
$('#find-input').addEventListener('input',e=>window.nova.action('find',{text:e.target.value}));
$('#find-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();window.nova.action('find',{text:e.target.value,next:true,backwards:e.shiftKey});}
  if(e.key==='Escape')hideFind();});
function hideFind(){window.nova.action('find-end');$('#findbox').classList.add('hidden');$('#find-input').value='';}
$('#find-close').addEventListener('click',hideFind);
$('#find-next').addEventListener('click',()=>window.nova.action('find',{text:$('#find-input').value,next:true}));

// Hide the floating downloads panel when the user interacts elsewhere in the toolbar.
document.addEventListener('pointerdown',event=>{
  if(snapshot?.downloadPanelOpen && !event.target.closest('#downloads'))
    window.nova.action('close-download-popover');
},true);
