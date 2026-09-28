const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { SettingsStore } = require('../settings-store.cjs');
const { offerFirstRunShortcut } = require('../pet-shortcut.cjs');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-first-run-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return new SettingsStore(dir);
}

test('first-run choice creates a shortcut and survives reopening without changing preferences', async t => {
  const store = fixture(t);
  store.set('preferences', { mode: 'pet', followClientClose: false });
  let prompts = 0, creations = 0;
  const options = {
    store, parent: {},
    dialog: { async showMessageBox(parent, config) {
      assert.equal(parent, options.parent);
      assert.equal(config.cancelId, 1);
      assert.match(config.message, /pet-with-u/);
      prompts++; return { response: 0 };
    } },
    async createShortcut() { creations++; return { ok: true, file: 'fixture.lnk' }; },
  };
  assert.equal((await offerFirstRunShortcut(options)).ok, true);
  assert.deepEqual(await offerFirstRunShortcut({ ...options, store: new SettingsStore(store.dir) }), { skipped: true });
  assert.equal(prompts, 1); assert.equal(creations, 1);
  assert.deepEqual(store.get('preferences'), { mode: 'pet', followClientClose: false });
});

for (const response of [0, 1]) {
  test(`first-run skip or canceled folder (${response}) is remembered without creating a link`, async t => {
    const store = fixture(t); let calls = 0;
    const result = await offerFirstRunShortcut({ store,
      dialog: { showMessageBox: async () => ({ response }) },
      createShortcut: async () => { calls++; return { canceled: true }; },
    });
    assert.equal(result.canceled, true); assert.equal(calls, response === 0 ? 1 : 0);
    assert.equal(store.get('onboarding').shortcutPrompted, true);
  });
}

test('failed shortcut creation does not suppress the next prompt or alter other onboarding flags', async t => {
  const store = fixture(t); store.set('onboarding', { otherStep: true });
  const options = { store, dialog: { showMessageBox: async () => ({ response: 0 }) },
    createShortcut: async () => { throw new Error('fixture write failure'); },
  };
  await assert.rejects(offerFirstRunShortcut(options), /fixture write failure/);
  assert.deepEqual(store.get('onboarding'), { otherStep: true });
  await offerFirstRunShortcut({ ...options, createShortcut: async () => ({ ok: true }) });
  assert.deepEqual(store.get('onboarding'), { otherStep: true, shortcutPrompted: true });
});
