const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('nova',Object.freeze({
  action:(name,payload)=>ipcRenderer.invoke('nova:action',name,payload),
  getState:()=>ipcRenderer.invoke('nova:get-state'),
  onState:(fn)=>{const l=(_e,data)=>fn(data);ipcRenderer.on('nova:state',l);return()=>ipcRenderer.removeListener('nova:state',l);},
  onRenameGroup:(fn)=>{const l=(_e,id)=>fn(id);ipcRenderer.on('nova:rename-group',l);return()=>ipcRenderer.removeListener('nova:rename-group',l);},
  onFocusAddress:(fn)=>{const l=()=>fn();ipcRenderer.on('nova:focus-address',l);return()=>ipcRenderer.removeListener('nova:focus-address',l);},
  onFind:(fn)=>{const open=()=>fn(true),close=()=>fn(false);ipcRenderer.on('nova:show-find',open);ipcRenderer.on('nova:hide-find',close);
    return()=>{ipcRenderer.removeListener('nova:show-find',open);ipcRenderer.removeListener('nova:hide-find',close);}}
}));
