const {contextBridge,ipcRenderer}=require('electron');
// This preload also exists on site tabs after navigation. Never expose privileged APIs to websites.
if(location.protocol==='file:' && location.pathname.endsWith('/internal.html')) {
  contextBridge.exposeInMainWorld('novaPage',Object.freeze({
    action:(name,payload)=>ipcRenderer.invoke('nova:internal',name,payload),
    onUpdate:(fn)=>{const l=()=>fn();ipcRenderer.on('nova:data-updated',l);return()=>ipcRenderer.removeListener('nova:data-updated',l);}
  }));
}
