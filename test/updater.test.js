'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createUpdateService, determineUpdateSupport, signedMacUpdateAvailable} = require('../lib/updater');
const app = {isPackaged:true,getVersion:()=> '1.4.0'};
function makeUpdater() {
  const emitter=new EventEmitter();
  emitter.calls=0;emitter.installs=0;
  emitter.checkForUpdates=async()=>{emitter.calls++;};
  emitter.quitAndInstall=()=>{emitter.installs++;};
  return emitter;
}
function makeService(platform,env={},extra={}) {
  const updater=makeUpdater();
  const service=createUpdateService({app,platform,env,updater,notify:()=>{},...extra});
  return {service,updater};
}
test('dev launches never check GitHub, on any platform',()=>{
  for(const platform of ['win32','linux','darwin']) {
    const {service,updater}=makeService(platform,{APPIMAGE:'/tmp/nova.AppImage'},{app:{...app,isPackaged:false},signedMac:true});
    service.start();assert.equal(service.snapshot().status,'unsupported');assert.equal(service.check(),false);assert.equal(updater.calls,0);
  }
});
test('Windows Setup supports updates, portable EXE does not',()=>{
  assert.equal(determineUpdateSupport({platform:'win32',packaged:true,env:{}}).supported,true);
  const {service}=makeService('win32',{PORTABLE_EXECUTABLE_FILE:'nova.exe'});
  service.start();assert.match(service.snapshot().message,/Portable/);assert.equal(service.check(),false);
});
test('Linux AppImage supports background updates but unpacked and deb builds do not',()=>{
  assert.equal(determineUpdateSupport({platform:'linux',packaged:true,env:{APPIMAGE:'/home/user/Nova.AppImage'}}).supported,true);
  const {service}=makeService('linux',{});
  service.start();assert.match(service.snapshot().message,/AppImage/);assert.equal(service.check(),false);
});
test('macOS updates enabled only in signed app builds',()=>{
  assert.equal(determineUpdateSupport({platform:'darwin',packaged:true,signedMac:true}).supported,true);
  assert.equal(determineUpdateSupport({platform:'darwin',packaged:true,signedMac:false}).supported,false);
  const {service}=makeService('darwin');service.start();assert.match(service.snapshot().message,/signed macOS/);
});
test('embedded signed-mac policy is read safely and defaults off',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nova-updater-'));
  assert.equal(signedMacUpdateAvailable(dir),false);
  fs.writeFileSync(path.join(dir,'update-capabilities.json'),'{"macAutoUpdate":true}\n');
  assert.equal(signedMacUpdateAvailable(dir),true);
  fs.writeFileSync(path.join(dir,'update-capabilities.json'),'oops');
  assert.equal(signedMacUpdateAvailable(dir),false);
  fs.rmSync(dir,{recursive:true,force:true});
});
test('updater uses no prompt and installs on app quit for Windows, Linux, and signed Mac',async()=>{
  for(const [platform,env,extra] of [['win32',{},{}],['linux',{APPIMAGE:'/tmp/nova.AppImage'},{}],['darwin',{}, {signedMac:true}]]) {
    let changed=0;
    const {service,updater}=makeService(platform,env,{...extra,notify:()=>changed++});
    service.start();assert.equal(updater.autoDownload,true);
    assert.equal(updater.autoInstallOnAppQuit,true);
    assert.equal(updater.allowPrerelease,false);
    assert.equal(service.check(),true);
    await new Promise(resolve=>setImmediate(resolve));assert.equal(updater.calls,1);
    updater.emit('update-available',{version:'1.4.1'});
    updater.emit('download-progress',{percent:56.7});assert.equal(service.snapshot().percent,57);
    updater.emit('update-downloaded',{version:'1.4.1'});
    assert.equal(service.snapshot().status,'downloaded');
    assert.match(service.snapshot().message,/when you close Nova/);
    assert.equal(updater.installs,0); // install deferred to electron-updater's app-quit listener
    assert.equal(service.check(),true);assert.equal(updater.calls,1); // do not recheck downloaded update
    assert.ok(changed>=4);
    service.stop();
  }
});
test('update errors allow a new check',async()=>{
  const {service,updater}=makeService('win32');service.start();
  service.check();await new Promise(resolve=>setImmediate(resolve));
  updater.emit('error',new Error('temporary network error'));
  assert.equal(service.snapshot().status,'error');service.check();assert.equal(service.snapshot().status,'checking');service.stop();
});
test('start() attaches handlers only once',()=>{
  const {service,updater}=makeService('win32');service.start();service.start();
  assert.equal(updater.listenerCount('update-downloaded'),1);service.stop();
});
