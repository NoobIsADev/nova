'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const {createUpdateService} = require('../lib/updater');
const app = {isPackaged:true,getVersion:()=> '1.3.0'};
function makeUpdater() {
  const emitter=new EventEmitter();
  emitter.calls=0;emitter.installs=0;
  emitter.checkForUpdates=async()=>{emitter.calls++;};
  emitter.quitAndInstall=()=>{emitter.installs++;};
  return emitter;
}
test('development launch never contacts the auto-update server',()=>{
  const updater=makeUpdater();
  const u=createUpdateService({app:{...app,isPackaged:false},dialog:{},getWindow:()=>null,notify:()=>{},updater,platform:'win32',env:{}});
  u.start();assert.equal(u.snapshot().status,'unsupported');assert.equal(u.check(),false);assert.equal(updater.calls,0);
});
test('portable build never installs updates automatically',()=>{
  const u=createUpdateService({app,dialog:{},getWindow:()=>null,notify:()=>{},updater:makeUpdater(),platform:'win32',env:{PORTABLE_EXECUTABLE_FILE:'nova.exe'}});
  u.start();assert.match(u.snapshot().message,/Portable/);assert.equal(u.check(),false);
});
test('GitHub update checks and download progress with restart prompt',async()=>{
  const updater=makeUpdater();let prompts=0;let changed=0;
  const dialog={showMessageBox:async()=>{prompts++;return {response:1};}};
  const u=createUpdateService({app,dialog,getWindow:()=>({isDestroyed:()=>false}),notify:()=>changed++,updater,platform:'win32',env:{}});
  u.start();assert.equal(u.check(),true);assert.equal(u.snapshot().status,'checking');
  await new Promise(resolve=>setImmediate(resolve));assert.equal(updater.calls,1);
  updater.emit('update-available',{version:'1.3.1'});
  assert.equal(u.snapshot().status,'available');
  updater.emit('download-progress',{percent:56.7});assert.equal(u.snapshot().percent,57);
  updater.emit('update-downloaded',{version:'1.3.1'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(u.snapshot().status,'downloaded');assert.equal(prompts,1);assert.equal(updater.installs,0);
  assert.equal(changed>=4,true);
  u.stop();
});
test('updater can install after explicit restart confirmation',async()=>{
  const updater=makeUpdater();
  const dialog={showMessageBox:async()=>({response:0})};
  const u=createUpdateService({app,dialog,getWindow:()=>({isDestroyed:()=>false}),notify:()=>{},updater,platform:'win32',env:{}});
  u.start();updater.emit('update-downloaded',{version:'1.4.0'});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(updater.installs,1);u.stop();
});
test('updater error is recoverable by checking again',async()=>{
  const updater=makeUpdater();
  const u=createUpdateService({app,dialog:{},getWindow:()=>null,notify:()=>{},updater,platform:'win32',env:{}});
  u.start();u.check();updater.emit('error',new Error('temporary network error'));
  assert.equal(u.snapshot().status,'error');u.check();assert.equal(u.snapshot().status,'checking');u.stop();
});
