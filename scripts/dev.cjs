const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { developmentEnvironment } = require('./dev-env.cjs');

const root = path.resolve(__dirname, '..');
const env = developmentEnvironment(root);
for (const directory of [env.PET_DEV_DATA_DIR, env.CODEX_HOME]) fs.mkdirSync(directory, { recursive: true });
console.log('Development preview: isolated settings in .local/dev-data; isolated Codex home in .local/dev-codex.');
let executable;
try { executable = require('electron'); }
catch { console.error('Run Install-Pet.cmd first.'); process.exit(1); }
const child = spawn(executable, [root, '--settings'], { cwd: root, env, windowsHide: true, stdio: 'inherit' });
child.on('error', error => { console.error('Development preview could not start: ' + error.message); process.exitCode = 1; });
child.on('close', code => { process.exitCode = code ?? 1; });
