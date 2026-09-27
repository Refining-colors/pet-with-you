const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const FILE_NAME = 'settings.json';
const legacy = {
  preferences: 'preferences.json', pet: 'main-config.json', appearance: 'appearance.json',
  positions: 'positions.json', tray: 'tray-state.json', api: 'api-settings.json',
  apiProfiles: 'api-settings.json.profiles', quota: 'quota.json', quotaProfiles: 'quota.json.profiles',
};
const privateSections = new Set(['api', 'apiProfiles', 'quota', 'quotaProfiles']);
function atomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(temp, file);
}
function read(file) {
  if (fs.statSync(file).size > 8 * 1024 * 1024) throw new Error('设置文件超过 8 MB，请检查文件。');
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
class SettingsStore {
  constructor(dir) {
    this.dir = dir; this.file = path.join(dir, FILE_NAME); this.vault = path.join(dir, 'credentials.local.json');
    if (!fs.existsSync(this.file)) this.migrate();
    this.document();
  }
  document() {
    let value;
    try { value = read(this.file); } catch { throw new Error('settings.json 无法读取，请修复 JSON 或恢复备份；原文件未覆盖。'); }
    if (value?.schemaVersion !== 1 || !value.sections || Array.isArray(value.sections) || typeof value.sections !== 'object') throw new Error('settings.json 版本或结构不受支持；原文件未覆盖。');
    return value;
  }
  credentials() {
    if (!fs.existsSync(this.vault)) return {};
    const value = read(this.vault);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('本机密钥文件损坏，请恢复备份。');
    return value;
  }
  // Shareable settings contain references only. Bind each local secret to its service URL.
  split(value, section, vault) {
    if (Array.isArray(value)) return value.map(item => this.split(item, section, vault));
    if (!value || typeof value !== 'object') return value;
    const out = Object.fromEntries(Object.entries(value).filter(([key]) => !['secret', 'credentialRef', '__proto__', 'constructor', 'prototype'].includes(key)).map(([key, item]) => [key, this.split(item, section, vault)]));
    if (typeof value.secret === 'string' && value.secret) {
      const binding = String(value.baseUrl || value.endpoint || '');
      const existing = Object.keys(vault).find(id => vault[id].section === section && vault[id].binding === binding && vault[id].ciphertext === value.secret);
      const id = existing || crypto.randomUUID();
      vault[id] = { section, binding, ciphertext: value.secret }; out.credentialRef = id;
    }
    return out;
  }
  join(value, section, vault) {
    if (Array.isArray(value)) return value.map(item => this.join(item, section, vault));
    if (!value || typeof value !== 'object') return value;
    const out = Object.fromEntries(Object.entries(value).filter(([key]) => !['secret', 'credentialRef', '__proto__', 'constructor', 'prototype'].includes(key)).map(([key, item]) => [key, this.join(item, section, vault)]));
    const entry = Object.hasOwn(vault, value.credentialRef || '') ? vault[value.credentialRef] : null;
    if (entry?.section === section && entry.binding === String(value.baseUrl || value.endpoint || '')) out.secret = entry.ciphertext;
    return out;
  }
  get(section, fallback) {
    const doc = this.document();
    if (!Object.hasOwn(doc.sections, section)) return structuredClone(fallback);
    const value = doc.sections[section];
    return privateSections.has(section) ? this.join(value, section, this.credentials()) : structuredClone(value);
  }
  has(section) { return Object.hasOwn(this.document().sections, section); }
  set(section, value) {
    if (!Object.hasOwn(legacy, section) && section !== 'petEntries') throw new Error('未知设置模块');
    const doc = this.document();
    if (privateSections.has(section)) {
      const vault = this.credentials();
      doc.sections[section] = this.split(value, section, vault);
      atomic(this.vault, vault);
      atomic(this.file, doc);
      const refs = new Set();
      const visit = item => { if (item && typeof item === 'object') { if (typeof item.credentialRef === 'string') refs.add(item.credentialRef); Object.values(item).forEach(visit); } };
      visit(doc.sections);
      atomic(this.vault, Object.fromEntries(Object.entries(vault).filter(([id]) => refs.has(id))));
    } else { doc.sections[section] = value; atomic(this.file, doc); }
    return value;
  }
  migrate() {
    const doc = { schemaVersion: 1, sections: {} }, vault = this.credentials(), originals = [];
    for (const [section, name] of Object.entries(legacy)) {
      const file = path.join(this.dir, name);
      if (!fs.existsSync(file)) continue;
      let value;
      try { value = read(file); } catch { throw new Error('旧设置 ' + name + ' 无法迁移，请修复或恢复备份；原文件未修改。'); }
      doc.sections[section] = privateSections.has(section) ? this.split(value, section, vault) : value;
      originals.push([file, name]);
    }
    const petDir = path.join(this.dir, 'pet');
    if (fs.existsSync(petDir)) {
      const entries = {};
      for (const name of fs.readdirSync(petDir).filter(name => name.endsWith('-config.json'))) {
        const file = path.join(petDir, name); entries[name.slice(0, -12)] = read(file); originals.push([file, name]);
      }
      if (Object.keys(entries).length) doc.sections.petEntries = entries;
    }
    atomic(this.vault, vault); atomic(this.file, doc);
    // Keep original settings as a local rollback backup; never include this directory in shares.
    for (const [file, name] of originals) {
      const backup = path.join(this.dir, 'legacy-settings', name);
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      if (!fs.existsSync(backup)) fs.renameSync(file, backup);
    }
  }
}
module.exports = { SettingsStore, FILE_NAME, atomic };
