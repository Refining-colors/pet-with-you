const path = require('node:path');

function hookCommand({ root = __dirname, packaged, executable } = {}) {
  if (packaged === undefined) {
    packaged = false;
    if (process.versions.electron) {
      packaged = process.env.ELECTRON_RUN_AS_NODE
        ? path.resolve(root, '../../pet-with-you.exe').toLowerCase() === process.execPath.toLowerCase()
        : !!require('electron').app?.isPackaged;
    }
  }
  const marker = path.join(root, packaged ? 'hook.cmd' : 'hook.cjs').replaceAll('\\', '/');
  return {
    marker,
    command: packaged ? '"' + marker + '"' : '"' + (executable || require('./node-runtime.cjs').locateNode()).replaceAll('\\', '/') + '" "' + marker + '"',
  };
}

module.exports = { hookCommand };
