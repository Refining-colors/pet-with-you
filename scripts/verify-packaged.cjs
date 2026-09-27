const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const http = require('node:http');
const executable = path.resolve(process.argv[2] || 'dist/win-unpacked/pet-with-you.exe');
const root = path.join(path.dirname(executable), 'resources', 'app');
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-package-check-'));
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^(PET_|DSH_PET_)/.test(key) || ['ELECTRON_RUN_AS_NODE', 'OPENAI_API_KEY', 'CODEX_API_KEY'].includes(key)) delete env[key];
Object.assign(env, { PET_TEST_DATA_DIR: data, CODEX_HOME: path.join(data, 'codex-home'), PATH: path.join(process.env.WINDIR, 'System32') + ';' + path.join(process.env.WINDIR, 'System32/WindowsPowerShell/v1.0') });
fs.mkdirSync(env.CODEX_HOME);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function run(program, args, options = {}, input) {
  const child = spawn(program, args, { windowsHide: true, env, stdio: ['pipe', 'pipe', 'pipe'], ...options });
  let stdout = '';
  child.stdout.on('data', bytes => { stdout += bytes; });
  child.stderr.resume();
  child.stdin.end(input);
  const timer = setTimeout(() => child.kill(), 20000);
  try { const [code] = await once(child, 'close'); assert.equal(code, 0, path.basename(program) + ' ' + args[0] + ' exits successfully'); return stdout; }
  finally { clearTimeout(timer); }
}
(async () => {
  let child, closed, mock;
  try {
    assert.match(await run(executable, ['--dsh-pet-dpi-probe']), /dsh-pet-primary-scale:[0-9.]+/);
    child = spawn(executable, ['--background'], { env, windowsHide: true, stdio: 'ignore' }); closed = once(child, 'close');
    let connection;
    for (let i = 0; i < 160; i++) {
      await delay(100);
      try { const value = JSON.parse(fs.readFileSync(path.join(data, 'connection.json'))); if (value.pid === child.pid) { connection = value; break; } } catch {}
    }
    assert.ok(connection, 'packaged app starts its isolated service');
    const health = await fetch(connection.base + '/health').then(r => r.json());
    assert.equal(health.mode, 'pet'); assert.equal(health.apiConfigured, false); assert.equal(health.animations, 106);
    const config = await fetch(connection.base + '/config').then(r => r.json());
    assert.ok(Object.values(config).flatMap(c => c.pets).every(p => p.whisperEnabled === false));
    const asset = fs.readdirSync(path.join(root, 'assets/webm'))[0];
    const response = await fetch(connection.base + '/thumb/main/' + encodeURIComponent(asset), { headers: { Range: 'bytes=0-31' } });
    assert.equal(response.status, 206); assert.equal((await response.arrayBuffer()).byteLength, 32);
    await delay(2000);
    assert.ok(fs.existsSync(path.join(data, 'primary-scale.json')), 'DPI probe persists without a second-instance collision');
    assert.equal(fs.existsSync(path.join(data, 'startup-target.json')), false, 'test run leaves Startup untouched');
    child.kill(); await closed; child = null;
    let event;
    mock = http.createServer(async (req, res) => { let body = ''; for await (const bytes of req) body += bytes; event = JSON.parse(body); res.end('{}'); });
    await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
    fs.writeFileSync(path.join(data, 'connection.json'), JSON.stringify({ base: 'http://127.0.0.1:' + mock.address().port + '/fixture', pid: process.pid }));
    const payload = { session_id: 'fixture', hook_event_name: 'PostToolUse', tool_name: 'shell', tool_response: { exit_code: 1, private_output: 'must-not-forward' }, prompt: 'must-not-forward' };
    await run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', '""' + path.join(root, 'hook.cmd') + '""'], { windowsVerbatimArguments: true }, JSON.stringify(payload));
    assert.equal(event?.tool_failed, true); assert.equal(event?.session_id, 'fixture');
    assert.equal(JSON.stringify(event).includes('must-not-forward'), false);
    const hooksFile = path.join(env.CODEX_HOME, 'hooks.json');
    const unrelated = { hooks: [{ type: 'command', command: 'echo fixture-unrelated' }] };
    fs.writeFileSync(hooksFile, JSON.stringify({ hooks: { Stop: [unrelated] } }));
    const nodeMode = { env: { ...env, ELECTRON_RUN_AS_NODE: '1' } };
    await run(executable, [path.join(root, 'install-hooks.cjs')], nodeMode);
    const installed = JSON.parse(fs.readFileSync(hooksFile)).hooks;
    const commands = Object.values(installed).flatMap(groups => groups.flatMap(g => g.hooks)).map(h => h.command);
    assert.equal(commands.filter(c => c.endsWith('/hook.cmd"')).length, 9);
    await run(executable, [path.join(root, 'uninstall-hooks.cjs')], nodeMode);
    assert.deepEqual(JSON.parse(fs.readFileSync(hooksFile)), { hooks: { Stop: [unrelated] } });
    console.log('PASS: packaged startup, defaults, 106 animations, byte ranges, DPI probe, no external Node on PATH, hook delivery/install/removal and metadata privacy.');
  } finally {
    if (child) { child.kill(); await closed; }
    if (mock) await new Promise(resolve => mock.close(resolve));
    fs.rmSync(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
