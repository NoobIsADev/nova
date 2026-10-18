'use strict';
// Embed a build-time capability flag. Unsigned test DMGs must not claim that
// Squirrel.Mac can install updates. GitHub CI supplies signing secrets.
const fs = require('node:fs');
const path = require('node:path');
const signedMac = process.platform === 'darwin' &&
  Boolean(process.env.CSC_LINK && process.env.CSC_KEY_PASSWORD);
const file = path.resolve(__dirname, '..', 'build', 'update-capabilities.json');
fs.mkdirSync(path.dirname(file), {recursive:true});
fs.writeFileSync(file, JSON.stringify({macAutoUpdate:signedMac}, null, 2) + '\n');
console.log(`[NOVA] macOS auto-update capability: ${signedMac ? 'signed release' : 'unsigned/development build'}`);
