const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(root).filter(name => name.endsWith('.md')).map(name => path.join(root, name));
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes:true })) { const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(file.endsWith('.md'))files.push(file); } }
walk(path.join(root,'docs'));
let count=0, errors=[];
for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  const targets=[...text.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)].map(match=>match[1]);
  for(const match of text.matchAll(/<(?:img|a)\b[^>]*\b(?:src|href)=["']([^"']+)["']/gi))targets.push(match[1]);
  for(const value of targets){
    const target=value.split('#')[0];if(!target||/^[a-z]+:/i.test(target))continue;
    count++;if(!fs.existsSync(path.resolve(path.dirname(file),decodeURIComponent(target))))errors.push(path.relative(root,file)+': '+target);
  }
}
for(const error of errors)console.error(error);
console.log(`${files.length} documents, ${count} local file links, ${errors.length} missing targets.`);
process.exitCode=errors.length?1:0;
