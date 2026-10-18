'use strict';
// Convert the user's provided transparent Imgur logo into app/taskbar icons before launch/build.
const path=require('node:path');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'build','logo.png');
if(process.platform==='win32'){
  try {
    execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'prepare-logo.ps1')],{stdio:'inherit'});
  } catch(err){
    console.error('\n[NOVA] Logo setup failed. If Imgur blocks downloads, save your image manually as build\\logo.png and retry.');
    process.exit(err.status||1);
  }
} else if(fs.existsSync(output)){
  fs.copyFileSync(output,path.join(root,'build','icon.png'));
} else {
  // npm start on Linux/macOS: download the transparent PNG; .ico generation is Windows-only.
  (async()=>{
    const r=await fetch('https://i.imgur.com/P5SoPEh.png',{signal:AbortSignal.timeout(15000)});
    if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw new Error(`Image download returned ${r.status}`);
    const b=Buffer.from(await r.arrayBuffer());
    if(b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('Logo is not a PNG');
    fs.writeFileSync(output,b);fs.copyFileSync(output,path.join(root,'build','icon.png'));
  })().catch(e=>{console.error('[NOVA] Logo download failed:',e.message);console.error('Save the PNG from https://i.imgur.com/P5SoPEh.png to build/logo.png and retry.');process.exitCode=1;});
}
