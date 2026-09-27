const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { developmentEnvironment, assertDevelopmentPreferences } = require('../scripts/dev-env.cjs');

test('development preview isolates data and Codex even under inherited host or test flags', () => {
  const root = path.resolve('fixture space');
  const inherited = { PATH: 'system-path', APPDATA: 'daily-data', CODEX_HOME: 'daily-codex', OPENAI_API_KEY: 'fixture-only', CODEX_API_KEY: 'fixture-only', OPENAI_BASE_URL: 'https://example.test', PET_TEST_DATA_DIR: 'test-data', PET_DEMO_RECORD: '1', PET_CODEX_EXE: 'private-runtime', DSH_PET_CONFIG_URL: 'private-url', ELECTRON_RUN_AS_NODE: '1' };
  const env = developmentEnvironment(root, inherited);
  assert.equal(env.PET_DEV_DATA_DIR, path.join(root, '.local', 'dev-data'));
  assert.equal(env.CODEX_HOME, path.join(root, '.local', 'dev-codex'));
  assert.equal(env.PET_DEV_MODE, '1');
  assert.equal(env.PATH, 'system-path');
  for (const key of ['PET_TEST_DATA_DIR', 'PET_DEMO_RECORD', 'PET_CODEX_EXE', 'DSH_PET_CONFIG_URL', 'ELECTRON_RUN_AS_NODE', 'OPENAI_API_KEY', 'CODEX_API_KEY', 'OPENAI_BASE_URL']) assert.equal(env[key], undefined);
  assert.equal(inherited.CODEX_HOME, 'daily-codex');
});

test('development preview rejects lifecycle integration before touching Startup', () => {
  assert.doesNotThrow(() => assertDevelopmentPreferences({ mode: 'pet' }));
  for (const key of ['autostart', 'followClientStart', 'followClientClose']) {
    assert.throws(() => assertDevelopmentPreferences({ [key]: true }), /开发预览/);
  }
});
