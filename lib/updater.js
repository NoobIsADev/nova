'use strict';
// Background GitHub Releases updater for Windows Setup, Linux AppImage, and
// Apple Developer ID-signed macOS DMG installations. All platforms share one
// release channel but each uses its own platform-specific update metadata.
const fs = require('node:fs');
const path = require('node:path');

function signedMacUpdateAvailable(resourcesPath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(resourcesPath, 'update-capabilities.json'), 'utf8')).macAutoUpdate === true;
  } catch { return false; }
}

function determineUpdateSupport({platform, packaged, env = {}, signedMac = false, hasUpdater = true}) {
  if (!packaged) return {supported:false, reason:'Auto-updates are available in installed release builds, not npm start.'};
  if (platform === 'win32') {
    if (env.PORTABLE_EXECUTABLE_FILE) return {supported:false, reason:'Portable EXEs cannot auto-install updates. Install Nova Browser Setup instead.'};
    return {supported:hasUpdater, reason:hasUpdater?'':'Updater is unavailable in this build.'};
  }
  if (platform === 'linux') {
    if (!env.APPIMAGE) return {supported:false, reason:'Automatic updates require the Linux AppImage (not npm start, unpacked folders, or distro packages).'};
    return {supported:hasUpdater, reason:hasUpdater?'':'Updater is unavailable in this build.'};
  }
  if (platform === 'darwin') {
    if (!signedMac) return {supported:false, reason:'Automatic updates require an Apple Developer ID-signed macOS release. This unsigned build needs manual updates.'};
    return {supported:hasUpdater, reason:hasUpdater?'':'Updater is unavailable in this build.'};
  }
  return {supported:false, reason:'Automatic updates are not supported on this platform.'};
}

// Injecting the updater and runtime makes this testable without Electron.
function createUpdateService({app, notify, updater, platform=process.platform, env=process.env, signedMac=false}) {
  const publicRelease = 'https://github.com/NoobIsADev/nova/releases/latest';
  const eligibility = determineUpdateSupport({platform,packaged:app.isPackaged,env,signedMac,hasUpdater:Boolean(updater)});
  const supported = eligibility.supported;
  let timer = null;
  let startupTimer = null;
  let working = false;
  let started = false;
  let state = {
    status:supported?'idle':'unsupported',
    message:supported?'Updates download in the background and install automatically when Nova closes.':eligibility.reason,
    currentVersion:app.getVersion(),version:'',percent:0,releaseUrl:publicRelease
  };
  function snapshot() {return {...state};}
  function emit(status, message, extra={}) {
    state={...state,status,message,...extra};
    notify();
  }
  function check() {
    if (!supported) return false;
    if (state.status==='downloaded' || state.status==='downloading' || state.status==='available') return true;
    if (working) return true;
    working=true;
    emit('checking','Checking GitHub Releases for updates…',{percent:0});
    Promise.resolve().then(()=>updater.checkForUpdates()).catch(err=>{
      working=false;
      emit('error',`Update check failed: ${String(err?.message||err).slice(0,180)}`);
    });
    return true;
  }
  function start() {
    if (!supported || started) return;
    started=true;
    updater.autoDownload=true;
    // electron-updater v6: after download it waits for the user to quit Nova,
    // then installs the update. No restart prompt or disruptive installer UI.
    updater.autoInstallOnAppQuit=true;
    updater.allowPrerelease=false;
    updater.on('checking-for-update',()=>emit('checking','Checking GitHub Releases for updates…'));
    updater.on('update-available',info=>{
      working=false;
      emit('available',`Downloading Nova Browser ${info.version} in the background…`,{version:info.version,percent:0});
    });
    updater.on('update-not-available',()=>{
      working=false;
      emit('up-to-date','You are using the latest published version.',{percent:0});
    });
    updater.on('download-progress',progress=>{
      emit('downloading',`Downloading update: ${Math.round(progress.percent||0)}%`,{percent:Math.max(0,Math.min(100,Math.round(progress.percent||0)))});
    });
    updater.on('update-downloaded',info=>{
      working=false;
      emit('downloaded',`Nova Browser ${info.version} is downloaded. It will install when you close Nova; the next launch will use the new version.`,{version:info.version,percent:100});
      // Deliberately no modal confirmation and no quitAndInstall here. The
      // updater's autoInstallOnAppQuit listener handles a regular app quit.
    });
    updater.on('error',err=>{
      working=false;
      emit('error',`Update error: ${String(err?.message||err).slice(0,180)}`);
    });
    startupTimer=setTimeout(check,12000);
    startupTimer.unref?.();
    timer=setInterval(check,4*60*60*1000);
    timer.unref?.();
  }
  function stop() {
    if(timer)clearInterval(timer);
    if(startupTimer)clearTimeout(startupTimer);
    timer=null;startupTimer=null;
  }
  return {start,stop,check,snapshot};
}
module.exports={createUpdateService,determineUpdateSupport,signedMacUpdateAvailable};
