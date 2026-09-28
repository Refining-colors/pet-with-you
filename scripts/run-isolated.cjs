const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const mode = process.argv[2];
if (!['test', 'demo'].includes(mode)) throw new Error('Expected test or demo');
const root = path.resolve(__dirname, '..');
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-with-you-'));
const env = { ...process.env, PET_TEST_DATA_DIR: data, CODEX_HOME: path.join(data, 'codex-home') };
fs.mkdirSync(env.CODEX_HOME, { recursive: true });
delete env.PET_DEV_MODE;
delete env.PET_DEV_DATA_DIR;
for (const key of ['ELECTRON_RUN_AS_NODE', 'DSH_PET_HOST_PID', 'DSH_PET_BRIDGE', 'PET_VERIFY', 'PET_ENTRY_VERIFY', 'DSH_PET_SMOKE', 'PET_INTEGRATION_VERIFY', 'PET_DEMO_RECORD']) delete env[key];
env[mode === 'test' ? 'PET_INTEGRATION_VERIFY' : 'PET_DEMO_RECORD'] = '1';
const child = spawn(require('electron'), [root], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let errors = '', timedOut = false;
child.stderr.on('data', bytes => { errors = (errors + bytes).slice(-16000); if(mode==='demo')for(const line of bytes.toString().split('\n'))if(line.startsWith('Rendered demo scene'))console.log(line); });
const timer = setTimeout(() => { timedOut = true; child.kill(); }, mode === 'test' ? 240000 : 1800000);
child.on('error', () => { console.error('Electron could not start. Run Install-Pet.cmd first.'); });
child.on('close', code => {
  clearTimeout(timer);
  fs.rmSync(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  if (code || timedOut) console.error(errors.split('\n').filter(line => !/configUrl=|127\.0\.0\.1|%2F/.test(line)).slice(-25).join('\n'));
  console.log(code || timedOut ? (mode === 'demo' ? 'Demo generation failed.' : 'UI verification failed.') : (mode === 'demo' ? 'Demo output: media-output/'+(env.PET_DEMO_EDITION==='story'?'demo-story-4k/':'demo-4k/') : 'UI verification passed.'));
  process.exitCode = code || (timedOut ? 1 : 0);
});
