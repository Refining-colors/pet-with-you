const path = require('node:path');

function developmentEnvironment(root, inherited = process.env) {
  const env = { ...inherited };
  for (const key of Object.keys(env)) {
    if (/^(PET_|DSH_PET_)/.test(key) || ['ELECTRON_RUN_AS_NODE', 'OPENAI_API_KEY', 'CODEX_API_KEY', 'OPENAI_BASE_URL'].includes(key)) delete env[key];
  }
  return {
    ...env,
    PET_DEV_MODE: '1',
    PET_DEV_DATA_DIR: path.join(root, '.local', 'dev-data'),
    CODEX_HOME: path.join(root, '.local', 'dev-codex'),
  };
}

function assertDevelopmentPreferences(preferences) {
  if (preferences.autostart || preferences.followClientClose) {
    throw new Error('开发预览不支持开机启动或随客户端启停，请关闭这些选项后再保存。');
  }
}

module.exports = { developmentEnvironment, assertDevelopmentPreferences };
