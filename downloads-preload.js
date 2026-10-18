'use strict';
const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('novaDownloads',Object.freeze({
  action:(name,payload)=>ipcRenderer.invoke('nova:downloads',name,payload),
  onUpdate:(fn)=>{
    const handler=(_event,items)=>fn(items);
    ipcRenderer.on('nova:downloads-update',handler);
    return()=>ipcRenderer.removeListener('nova:downloads-update',handler);
  }
}));
