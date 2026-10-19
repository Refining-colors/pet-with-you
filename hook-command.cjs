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
  const quote = value => "'" + value.replaceAll("'", "''") + "'";
  // A quoted path alone is a PowerShell string, whose output becomes hook context.
  // Encode the invocation so either Windows shell preserves literal paths and stdin.
  const invocation = packaged ? quote(marker) : quote((executable || require('./node-runtime.cjs').locateNode()).replaceAll('\\', '/')) + ' ' + quote(marker);
  const script = '& ' + invocation + ' *> $null; exit 0';
  return {
    marker,
    command: 'powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand ' + Buffer.from(script, 'utf16le').toString('base64'),
  };
}

function ownsHook(command, root = __dirname) {
  if (typeof command !== 'string') return false;
  const encoded = /^powershell\.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand ([A-Za-z0-9+/=]+)$/.exec(command);
  const text = (encoded ? Buffer.from(encoded[1], 'base64').toString('utf16le') : command).replaceAll('\\', '/');
  return ['hook.cmd', 'hook.cjs'].some(file => {
    const marker = path.join(root, file).replaceAll('\\', '/');
    return text.includes('"' + marker + '"') || text.includes("'" + marker.replaceAll("'", "''") + "'");
  });
}

module.exports = { hookCommand, ownsHook };
