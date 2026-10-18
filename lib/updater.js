'use strict';
// GitHub Releases updater for installed Windows NSIS builds.
// Keeping Electron injected makes the behavior testable without an Electron runtime.
function createUpdateService({app, dialog, getWindow, notify, updater, platform = process.platform, env = process.env}) {
  const publicRelease = 'https://github.com/NoobIsADev/nova/releases/latest';
  const supported = platform === 'win32' && app.isPackaged && !env.PORTABLE_EXECUTABLE_FILE;
  let timer = null;
  let startupTimer = null;
  let working = false;
  let installed = false;
  let state = {
    status: supported ? 'idle' : 'unsupported',
    message: supported ? 'Updates are checked automatically from GitHub Releases.' :
      (env.PORTABLE_EXECUTABLE_FILE ? 'Portable builds do not install updates automatically. Use the Windows Setup installer.' :
        'Auto-update requires the installed Windows Setup version (not npm start).'),
    currentVersion: app.getVersion(),
    version: '',
    percent: 0,
    releaseUrl: publicRelease
  };
  function snapshot() {return {...state};}
  function emit(status, message, extra = {}) {
    state = {...state, status, message, ...extra};
    notify();
  }
  function askToRestart() {
    if (state.status !== 'downloaded') return false;
    const window = getWindow();
    if (!window || window.isDestroyed()) return false;
    dialog.showMessageBox(window, {
      type:'info', title:'Nova Browser update ready',
      message:`Nova Browser ${state.version || ''} is ready to install.`,
      detail:'Restart now to update. Choosing Later keeps your tabs open; the update will install when Nova closes.',
      buttons:['Restart and update','Later'], defaultId:1, cancelId:1, noLink:true
    }).then(({response}) => {
      if (response === 0) updater.quitAndInstall(false, true);
    }).catch(err => console.error('[NOVA] Update prompt failed:',err));
    return true;
  }
  function check() {
    if (!supported) return false;
    if (['downloading','downloaded'].includes(state.status)) {
      if(state.status==='downloaded') askToRestart();
      return true;
    }
    if (working) return true;
    working = true;
    emit('checking', 'Checking GitHub Releases for updates…', {percent:0});
    // Electron-updater event handlers reset 'working', even if the call resolves early.
    Promise.resolve().then(() => updater.checkForUpdates()).catch(err => {
      working = false;
      emit('error',`Update check failed: ${String(err?.message || err).slice(0,180)}`);
    });
    return true;
  }
  function start() {
    if (!supported || installed) return;
    installed = true;
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.allowPrerelease = false;
    updater.on('checking-for-update', () => emit('checking','Checking GitHub Releases for updates…'));
    updater.on('update-available', info => {
      working = false;
      emit('available',`Downloading Nova Browser ${info.version}…`,{version:info.version,percent:0});
    });
    updater.on('update-not-available', () => {
      working = false;
      emit('up-to-date','You are using the latest published version.',{percent:0});
    });
    updater.on('download-progress', progress => {
      emit('downloading',`Downloading update: ${Math.round(progress.percent||0)}%`,{percent:Math.max(0,Math.min(100,Math.round(progress.percent||0)))});
    });
    updater.on('update-downloaded', info => {
      working = false;
      emit('downloaded',`Nova Browser ${info.version} is ready. Restart to install.`,{version:info.version,percent:100});
      askToRestart();
    });
    updater.on('error', err => {
      working = false;
      emit('error',`Update error: ${String(err?.message || err).slice(0,180)}`);
    });
    startupTimer = setTimeout(check, 12000);
    if (startupTimer.unref) startupTimer.unref();
    timer = setInterval(check, 4*60*60*1000);
    if (timer.unref) timer.unref();
    return () => clearTimeout(startupTimer);
  }
  function stop() {if(timer)clearInterval(timer);if(startupTimer)clearTimeout(startupTimer);timer=null;startupTimer=null;}
  return {start, stop, check, snapshot, askToRestart};
}
module.exports = {createUpdateService};
