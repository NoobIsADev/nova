'use strict';
const api=window.novaDownloads;
const $=q=>document.querySelector(q);
const I=(name,size=18)=>window.novaIcon(name,size);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
$('#title-icon').innerHTML=I('download',19);
$('#close').innerHTML=I('x',17);
$('#arrow-icon').innerHTML=I('arrow',14);
$('#close').addEventListener('click',()=>api.action('close'));
$('#all-downloads').addEventListener('click',()=>api.action('all-downloads'));
$('#clear').addEventListener('click',()=>api.action('clear-downloads'));
function fileSize(n){
  if(!Number.isFinite(n)||n<0)return '?';
  if(n<1024)return `${n} B`;
  if(n<1048576)return `${(n/1024).toFixed(1)} KB`;
  if(n<1073741824)return `${(n/1048576).toFixed(1)} MB`;
  return `${(n/1073741824).toFixed(2)} GB`;
}
function mini(iconName,title,action,id){
  const b=el('button','mini');b.type='button';b.title=title;b.setAttribute('aria-label',title);
  b.innerHTML=I(iconName,17);b.addEventListener('click',()=>api.action(action,{id}));return b;
}
function draw(items){
  const list=Array.isArray(items)?items:[];
  const target=$('#entries'),scroll=target.scrollTop;
  target.replaceChildren();
  $('#counter').textContent=list.length?String(list.length):'';
  $('#counter').hidden=list.length===0;
  if(!list.length){
    const empty=el('div','empty');empty.innerHTML=I('download',35);
    empty.append(el('h3','','No downloads yet'),el('p','','Your recent downloads will show up here.'));
    target.append(empty);$('#clear').disabled=true;return;
  }
  $('#clear').disabled=!list.some(d=>d.state!=='progressing'&&d.state!=='paused');
  for(const d of list){
    const row=el('div','entry');row.setAttribute('role','listitem');
    const icon=el('div','file-icon');icon.innerHTML=I(d.state==='completed'?'check':'download',18);row.append(icon);
    const body=el('div','file-details');body.append(el('div','file-name',d.filename||'Unknown file'));
    let desc='';
    if(d.state==='progressing')desc=`${fileSize(d.received||0)} of ${d.total?fileSize(d.total):'unknown'} `;
    else if(d.state==='paused')desc=`Paused · ${fileSize(d.received||0)}`;
    else if(d.state==='completed')desc=`Completed · ${fileSize(d.received||0)}`;
    else desc=(d.state||'Unknown').replace(/^(.)/,c=>c.toUpperCase());
    const status=el('div','file-status'+(d.state==='completed'?' good':d.state==='interrupted'?' bad':''),desc);body.append(status);
    if(d.state==='progressing'||d.state==='paused'){
      const track=el('div','file-progress');track.setAttribute('role','progressbar');
      const percent=d.total>0?Math.max(0,Math.min(100,Math.round(100*(d.received||0)/d.total))):0;
      track.setAttribute('aria-valuenow',String(percent));track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');
      const bar=el('div');bar.style.width=percent+'%';track.append(bar);body.append(track);
    }
    row.append(body);
    const controls=el('div','actions');
    if(d.state==='completed'){
      controls.append(mini('external','Open file','open-download',d.id));
      controls.append(mini('folder','Show in folder','show-download',d.id));
    } else if(d.state==='progressing'){
      controls.append(mini('pause','Pause','pause-download',d.id));
      controls.append(mini('x','Cancel','cancel-download',d.id));
    } else if(d.state==='paused'){
      controls.append(mini('play','Resume','resume-download',d.id));
      controls.append(mini('x','Cancel','cancel-download',d.id));
    }
    row.append(controls);target.append(row);
  }
  target.scrollTop=scroll;
}
api.onUpdate(draw);
api.action('list').then(draw).catch(()=>draw([]));
