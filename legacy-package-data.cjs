const fs = require('node:fs');
const path = require('node:path');

const markers = ['settings.json', 'preferences.json', 'main-config.json'];
const files = ['credentials.local.json', 'appearance.json', 'positions.json', 'tray-state.json', 'api-settings.json', 'api-settings.json.profiles', 'quota.json', 'quota.json.profiles', 'client-launcher.local.json', 'memory.json', ...markers];
const directories = ['fonts', 'pet'];
const hasSettings = directory => markers.some(name => fs.existsSync(path.join(directory, name)));

function importLegacyPackageData(dataDir, { localAppData = process.env.LOCALAPPDATA } = {}) {
  if (hasSettings(dataDir) || !localAppData) return { imported: false };
  const packages = path.join(localAppData, 'Packages');
  if (!fs.existsSync(packages)) return { imported: false };
  // MSIX can redirect a child process's AppData writes. Explorer launches see the real directory.
  const candidates = fs.readdirSync(packages, { withFileTypes: true })
    .filter(item => item.isDirectory() && !item.isSymbolicLink())
    .map(item => path.join(packages, item.name, 'LocalCache', 'Roaming', 'DSH Pet Companion'))
    .filter(hasSettings);
  if (!candidates.length) return { imported: false };
  if (candidates.length > 1) throw new Error('发现多份旧桌宠设置，未自动选择。请先将要使用的配置备份到正常用户数据目录，再启动桌宠。');
  const source = candidates[0];
  fs.mkdirSync(dataDir, { recursive: true });
  const stage = fs.mkdtempSync(path.join(path.resolve(dataDir), '.legacy-import-'));
  try {
    // Stage only pet-owned settings and media; never import runtime endpoints, caches or app logins.
    for (const name of [...directories, ...files]) {
      const from = path.join(source, name);
      if (fs.existsSync(from)) fs.cpSync(from, path.join(stage, name), { recursive: true, filter: file => !fs.lstatSync(file).isSymbolicLink() });
    }
    for (const name of [...directories, ...files]) {
      const from = path.join(stage, name), to = path.join(dataDir, name);
      if (fs.existsSync(from)) fs.cpSync(from, to, { recursive: true, force: false, errorOnExist: false });
    }
    return { imported: true };
  } finally {
    if (path.dirname(stage) === path.resolve(dataDir)) fs.rmSync(stage, { recursive: true, force: true });
  }
}

module.exports = { importLegacyPackageData };
