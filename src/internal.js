'use strict';
const $ = selector => document.querySelector(selector);
const el=(tag,cl,text)=>{const n=document.createElement(tag);if(cl)n.className=cl;if(text!==undefined)n.textContent=String(text);return n;};
const I=(n,s=18)=>window.novaIcon(n,s);
const qp=new URLSearchParams(location.search);
const page=['newtab','settings','history','downloads'].includes(qp.get('page'))?qp.get('page'):'newtab';
let state=null;
const actions=window.novaPage;
const app=$('#app');
function navigate(text){return actions.action('navigate',{text});}
function openPage(pageName){return navigate('nova://'+pageName);}
function makeButton(label,cls,handler,iconName){
  const b=el('button',cls);if(iconName)b.innerHTML=I(iconName,16);b.append(document.createTextNode(label));b.addEventListener('click',handler);return b;
}
function scaffold(){
  app.replaceChildren();
  const backdrop=el('div','backdrop');app.append(backdrop);
  const pageEl=el('div','page');app.append(pageEl);
  const topline=el('div','topline');pageEl.append(topline);
  const left=el('div','topline-start');left.innerHTML='<img class="topline-logo" src="../build/logo.png" alt="Nova Browser">';topline.append(left);
  const right=el('div','top-right');
  right.innerHTML=`<span class="dot"></span><span>${state?.private?'Private browsing':'DuckDuckGo search'}</span>`;topline.append(right);
  return pageEl;
}
function home(){
  document.title=state?.private?'Private Tab — Nova':'New Tab — Nova';
  const root=scaffold();
  root.classList.add('newtab-page');
  root.querySelector('.topline').remove();
  const hero=el('section','hero hero-clean');root.append(hero);
  const logo=el('img','hero-logo');logo.src='../build/logo.png';logo.alt='Nova Browser';hero.append(logo);
  const form=el('form','searchbar');form.innerHTML=`<span class="search-icon">${I('search',23)}</span><input id="hero-search" spellcheck="false" autocomplete="off" placeholder="Search the web or enter a URL…" aria-label="DuckDuckGo search"><button class="search-go" aria-label="Search">${I('arrow',20)}</button>`;
  form.addEventListener('submit',e=>{e.preventDefault();navigate(form.querySelector('input').value);});hero.append(form);

}
function subHeader(name,desc){
  const root=scaffold();
  const header=el('div','sub-header');const left=el('div');
  left.innerHTML=`<div class="overline">NOVA BROWSER</div>`;left.append(el('h1','',name));left.append(el('p','',desc));header.append(left);root.append(header);
  return {root,header};
}
function settingLine(card,title,note,id,selected,callback){
  const row=el('div','setting-line');const left=el('div');left.append(el('strong','',title));left.append(el('div','note',note));row.append(left);
  const toggle=el('button','switch'+(selected?' on':''));toggle.id=id;toggle.setAttribute('role','switch');toggle.setAttribute('aria-checked',String(Boolean(selected)));toggle.title=title;
  toggle.addEventListener('click',callback);row.append(toggle);card.append(row);
}
function settingsPage(){
  document.title='Settings — Nova';
  const {root}=subHeader('Settings','Tune your Nova experience to fit how you browse.');
  const layout=el('div','settings-layout');root.append(layout);
  const nav=el('nav','settings-nav');layout.append(nav);
  for(const [id,title,icon] of [['privacy','Privacy & shields','shield'],['appearance','Appearance','spark'],['shortcuts','Keyboard shortcuts','grid'],['updates','Updates','download']]){
    const a=el('a',id==='privacy'?'current':'');a.href='#'+id;a.innerHTML=I(icon,17);a.append(document.createTextNode(title));nav.append(a);
  }
  const main=el('div','settings-main');layout.append(main);
  const privacy=el('section','settings-card');privacy.id='privacy';main.append(privacy);
  privacy.innerHTML='<h2>Privacy & shields</h2><p class="description">Your browsing protection lives here, no extra extension needed.</p>';
  settingLine(privacy,'Block ads and trackers','Community-powered filters and YouTube cleanup help reduce ads and tracking.','toggle-shields',state.settings.adblock,async()=>{
    await actions.action('toggle-setting',{key:'adblock',value:!state.settings.adblock});await update();
  });
  const protection=el('div','setting-line');const left=el('div');left.append(el('strong','','Protection engine'));
  const engineLabel=state.protection==='full'?'Community filters loaded':state.protection==='basic'?'Basic offline filters':'Loading filter lists';
  left.append(el('div','note',engineLabel+(state.protection==='basic'?'. Full filter update requires internet access.':'')));protection.append(left);
  const btn=makeButton('Refresh lists','outline-btn',()=>{actions.action('refresh-filters');btn.textContent='Updating…';setTimeout(update,4000);},'reload');protection.append(btn);privacy.append(protection);
  if(state.protectionError)privacy.append(el('div','hint',state.protectionError));
  const appearance=el('section','settings-card');appearance.id='appearance';main.append(appearance);
  appearance.innerHTML='<h2>Appearance</h2><p class="description">A personal touch for your desktop.</p>';
  settingLine(appearance,'Show sidebar on new tabs','Keep your favorite apps and browser tools on the start page only.','toggle-side',state.settings.sidebar,async()=>{
    await actions.action('toggle-setting',{key:'sidebar',value:!state.settings.sidebar});await update();
  });
  settingLine(appearance,'Show bookmarks bar','Display your saved sites below the address bar on every page. (Ctrl+Shift+B)','toggle-bookmarks',state.settings.bookmarkBar!==false,async()=>{
    await actions.action('toggle-setting',{key:'bookmarkBar',value:state.settings.bookmarkBar===false});await update();
  });
  const colors=el('div','setting-line');const colLabel=el('div');colLabel.append(el('strong','','Accent color'));colLabel.append(el('div','note','Pick the glow that suits your setup.'));colors.append(colLabel);
  const dots=el('div','accent-row');colors.append(dots);
  for(const c of ['violet','red','cyan','emerald']){
    const color=el('button','accent-dot'+(c===state.settings.accent?' chosen':''));color.dataset.color=c;color.title=c;
    color.addEventListener('click',async()=>{await actions.action('toggle-setting',{key:'accent',value:c});await update();});dots.append(color);
  }appearance.append(colors);
  const updates=el('section','settings-card');updates.id='updates';main.append(updates);
  updates.innerHTML='<h2>Browser updates</h2><p class="description">Nova checks GitHub Releases at startup and every four hours on Windows Setup, Linux AppImage, and signed macOS installs. Updates download quietly and install when you close the browser.</p>';
  const updateInfo=state.updates || {status:'unsupported',currentVersion:'',message:'Updates unavailable in this build.'};
  const updateRow=el('div','setting-line');const updateText=el('div');
  updateText.append(el('strong','',`Version ${updateInfo.currentVersion || 'unknown'}`));
  updateText.append(el('div','note',updateInfo.message));
  updateRow.append(updateText);
  const action=makeButton(updateInfo.status==='downloaded'?'Ready for next launch':'Check now','outline-btn',async()=>{
    if(updateInfo.status!=='downloaded')await actions.action('check-updates');
    await update();
  }, updateInfo.status==='downloaded'?'check':'download');
  if(['checking','downloading','available','downloaded','unsupported'].includes(updateInfo.status)) action.disabled=true;
  updateRow.append(action);updates.append(updateRow);
  if(['downloading','available','downloaded'].includes(updateInfo.status)) {
    const progress=el('div','note',`${updateInfo.percent||0}% downloaded${updateInfo.version?' · v'+updateInfo.version:''}`);
    progress.style.marginTop='8px';updates.append(progress);
  }
  const releaseLink=el('a','', 'View GitHub Releases');
  releaseLink.href='https://github.com/NoobIsADev/nova/releases/latest';
  releaseLink.target='_blank';releaseLink.rel='noopener noreferrer';
  // External links in internal pages are opened in the system browser by explicit user action.
  releaseLink.addEventListener('click',e=>{e.preventDefault();actions.action('open-release-page');});
  updates.append(releaseLink);
  const shortcuts=el('section','settings-card');shortcuts.id='shortcuts';main.append(shortcuts);
  shortcuts.innerHTML='<h2>Keyboard shortcuts</h2><p class="description">Move around the browser without lifting a hand.</p>';
  const keyList=[['New tab','Ctrl + T'],['Close tab','Ctrl + W'],['Address bar','Ctrl + L'],['Private tab','Ctrl + Shift + N'],['Reload page','Ctrl + R'],['Bookmark page','Ctrl + D'],['Show/hide bookmarks bar','Ctrl + Shift + B'],['History','Ctrl + H'],['Recent downloads','Ctrl + J'],['Find in page','Ctrl + F'],['Switch tabs','Ctrl + Tab']];
  const keys=el('div','shortcut-grid');for(const [name,hotkey] of keyList){const row=el('div','shortcut');row.append(el('span','',name));const k=el('kbd','',hotkey);row.append(k);keys.append(row);}shortcuts.append(keys);
  shortcuts.append(el('div','hint','Nova is an independent Electron browser project. Some sites and DRM-protected streaming services may require features that full browsers such as Brave and Opera provide.'));
}
function blankState(parent,iconName,title,desc){const box=el('div','blank-state');box.innerHTML=`<div class="icon-blank">${I(iconName,31)}</div>`;box.append(el('h3','',title));box.append(el('p','',desc));parent.append(box);}
function historyPage(){
  document.title='History — Nova';const {root,header}=subHeader('Your history','Find a page you visited earlier. Private browsing is never recorded.');
  const clear=makeButton('Clear history','outline-btn',()=>{if(confirm('Delete all browsing history?'))actions.action('clear-history').then(update);},'trash');header.append(clear);
  const bar=el('div','toolbar-list');root.append(bar);const input=el('input','filter-input');input.placeholder='Search your history...';bar.append(input);
  const entries=el('div','entries');root.append(entries);
  function paint(){entries.replaceChildren();const q=input.value.trim().toLowerCase();const rows=(state.history||[]).filter(x=>(x.title+' '+x.url).toLowerCase().includes(q)).slice(0,400);
    if(!rows.length)return blankState(entries,'clock','All clear','Pages you visit will show up here.');
    for(const item of rows){const row=el('div','entry');const icon=el('div','entry-icon');icon.innerHTML=I('globe',17);row.append(icon);
      const body=el('div','entry-body');const b=el('button','entry-main',item.title||item.url);b.addEventListener('click',()=>navigate(item.url));body.append(b);
      body.append(el('div','entry-sub',item.url));row.append(body);
      row.append(el('span','entry-meta',new Date(item.time).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})));
      const del=el('button','entry-action');del.title='Remove this URL';del.innerHTML=I('x',16);del.addEventListener('click',()=>actions.action('remove-history',{url:item.url}).then(update));row.append(del);entries.append(row);
    }
  }input.addEventListener('input',paint);paint();
}
function bytes(n){if(!n || n<0)return 'Unknown size';if(n<1024)return n+' B';if(n<1024*1024)return (n/1024).toFixed(1)+' KB';return (n/1024/1024).toFixed(1)+' MB';}
function downloadPage(){
  document.title='Downloads — Nova';const {root,header}=subHeader('Downloads','Files downloaded using Nova are saved in your usual Downloads folder.');
  header.append(makeButton('Clear list','outline-btn',()=>actions.action('clear-downloads').then(update),'trash'));
  const entries=el('div','entries');root.append(entries);
  if(!state.downloads?.length)return blankState(entries,'download','No downloads yet','Downloaded files will appear here.');
  for(const item of state.downloads){const row=el('div','entry');const icon=el('div','entry-icon');icon.innerHTML=I('download',18);row.append(icon);
    const body=el('div','entry-body');body.append(el('div','entry-main',item.filename));
    body.append(el('div','entry-sub',item.state==='progressing'?`${bytes(item.received)} of ${bytes(item.total)}`:`${item.state} · ${bytes(item.received)}`));row.append(body);
    row.append(el('div','entry-meta',new Date(item.time).toLocaleDateString()));
    if(item.path){const show=el('button','entry-action');show.title='Show in folder';show.innerHTML=I('folder',17);show.addEventListener('click',()=>actions.action('show-download',{id:item.id}));row.append(show);}entries.append(row);
  }
}
function render(){
  if(!state)return;
  document.documentElement.dataset.accent=state.settings?.accent||'violet';
  ({newtab:home,settings:settingsPage,history:historyPage,downloads:downloadPage})[page]();
}
async function update(){const data=await actions.action('get-data');if(data){state=data;render();}}
actions.onUpdate(()=>{
  // Preserve history search typing on updates; only re-render others automatically.
  if(page==='history' && document.activeElement?.classList.contains('filter-input'))return;
  update();
});
update();
