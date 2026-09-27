const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const names = fs.readdirSync(path.join(root, 'assets/webm')).filter(name => name.endsWith('.webm'));
const requested = process.argv.slice(2);
if (!requested.length) {
  console.log('Use --all, or pass one or more exact animation names from this list:');
  console.log(names.join('\n'));
} else {
  const selected = requested.length === 1 && requested[0] === '--all' ? names : requested.map(name => name.endsWith('.webm') ? name : name + '.webm');
  for (const name of selected) if (!names.includes(name)) throw new Error('Unknown animation: ' + name);
  const out = path.join(root, 'media-output', 'animations-' + Date.now());
  fs.mkdirSync(out, { recursive: true });
  for (const name of selected) fs.copyFileSync(path.join(root, 'assets/webm', name), path.join(out, name));
  const attribution = 'Character animations: PC2005-cloud/dsh-pet\nhttps://github.com/PC2005-cloud/dsh-pet\nOpen-source use permitted; commercial use prohibited by upstream. Extraction does not create new original artwork.\n';
  fs.writeFileSync(path.join(out, 'SOURCE.txt'), attribution);
  const escape = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><meta charset="utf-8"><title>pet-with-you animations</title><style>body{font:16px sans-serif;background:#e9eee9;padding:24px}main{display:flex;flex-wrap:wrap;gap:20px}figure{margin:0;width:240px}video{width:240px;height:240px}</style><h1>pet-with-you / animation selection</h1><p><a href="https://github.com/PC2005-cloud/dsh-pet">Character assets: PC2005-cloud/dsh-pet</a> / noncommercial</p><main>' + selected.map(name => `<figure><video controls loop muted preload="none" src="${encodeURIComponent(name)}"></video><figcaption>${escape(name)}</figcaption></figure>`).join('') + '</main>');
  console.log('Exported ' + selected.length + ' animations to ' + path.relative(root, out));
}
