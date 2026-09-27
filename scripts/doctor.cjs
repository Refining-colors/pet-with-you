const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(label, ok, detail) {
  console.log(`[${ok ? 'OK' : 'CHECK'}] ${label}: ${detail}`);
  if (!ok) failures++;
}
const [major, minor] = process.versions.node.split('.').map(Number);
check('Windows', process.platform === 'win32', process.platform);
check('Node.js', major > 22 || major === 22 && minor >= 12, process.versions.node);
try { check('Electron', fs.existsSync(require('electron')), 'installed'); }
catch { check('Electron', false, 'Run Install-Pet.cmd'); }
check('Animation assets', fs.existsSync(path.join(root, 'assets/config.jsonc')) && fs.existsSync(path.join(root, 'assets/webm')) && fs.readdirSync(path.join(root, 'assets/webm')).length > 0, 'assets/config.jsonc + assets/webm');
try { require('../codex-client.cjs').locateCodex(); console.log('[OPTIONAL] Codex runtime found. Connection still needs to be checked in Settings.'); }
catch { console.log('[OPTIONAL] Codex runtime not found. Pure pet and own API do not need it. See docs/INSTALL.md.'); }
console.log('Read-only check. No account, key, model or network request was made.');
process.exitCode = failures ? 1 : 0;
