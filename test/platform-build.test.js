'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root=path.join(__dirname,'..');
const pkg=require('../package.json');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/cross-platform-release.yml'),'utf8');
const main=fs.readFileSync(path.join(root,'main.js'),'utf8');
const internal=fs.readFileSync(path.join(root,'src/internal.js'),'utf8');
test('Windows, Linux, and macOS targets are bundled without dropping any browser files',()=>{
  assert.match(pkg.scripts['build:win'],/nsis portable/);
  assert.match(pkg.scripts['build:linux'],/AppImage/);
  assert.match(pkg.scripts['build:mac'],/dmg zip --universal/);
  assert.deepEqual(pkg.build.mac.target,['dmg','zip']);
  assert.ok(pkg.build.files.includes('lib/**/*') && pkg.build.files.includes('src/**/*'));
  assert.ok(pkg.build.extraResources.some(r=>r.to==='update-capabilities.json'));
});
test('GitHub publishes Linux AppImage even when other OS build fails',()=>{
  assert.match(workflow,/runs-on: windows-latest/);
  assert.match(workflow,/runs-on: ubuntu-22.04/);
  assert.match(workflow,/runs-on: macos-15/);
  for(const manifest of ['latest.yml','latest-linux.yml','latest-mac.yml'])assert.ok(workflow.includes(manifest));
  assert.match(workflow,/needs: \[windows, linux, macos\]/);
  assert.match(workflow,/always\(\) && needs\.linux\.result == 'success'/);
  assert.match(workflow,/Verify Linux AppImage is ready for direct download/);
});
test('last window closing quits on macOS too so updater sees app quit',()=>{
  assert.match(main,/app\.on\('window-all-closed',\(\)=>app\.quit\(\)\)/);
});
test('settings describe unattended on-close updates and never offer restart button',()=>{
  assert.match(internal,/install when you close the browser/);
  assert.doesNotMatch(internal,/Restart to update/);
});

test('One-click Windows publisher pushes code and tag, triggering prebuilt GitHub downloads',()=>{
  const bat=fs.readFileSync(path.join(root,'PUBLISH-TO-GITHUB.bat'),'utf8');
  assert.match(bat,/git clone --depth 1 --branch main/);
  assert.match(bat,/git push origin HEAD:main/);
  assert.match(bat,/git push origin "%TAG%"/);
  assert.match(bat,/AppImage/); // release is announced as AppImage
  assert.doesNotMatch(bat,/npm (install|run build)/);
});
test('unsigned macOS builds skip notarization and cannot block Linux publication',()=>{
  assert.match(pkg.scripts['build:mac:unsigned'],/config.mac.notarize=false/);
  assert.match(workflow,/CSC_IDENTITY_AUTO_DISCOVERY/);
  assert.match(workflow,/env.CSC_LINK == ''/);
  assert.match(workflow,/needs.linux.result == 'success'/);
});
