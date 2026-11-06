const fs=require('node:fs'),path=require('node:path');
const files=['.gitignore','README.md','LICENSE.upstream','package.json','package-lock.json','main.cjs','positions.cjs','tray-menu.cjs','server.cjs','api-client.cjs','chat-stream.cjs','think-filter.cjs','whisper-history.cjs','diagnostics.cjs','session-monitor.cjs','thread-metadata.cjs','client-lifecycle.cjs','appearance.cjs','autostart.cjs','startup-watch.ps1','codex-client.cjs','config.mjs','connection.cjs','crs.cjs','fullscreen-watch.ps1','hook.cjs','install-hooks.cjs','uninstall-hooks.cjs','node-runtime.cjs','launch.cjs','launcher.vbs','preferences.cjs','quota.cjs','review-hooks.cjs','state.cjs','window-policy.cjs','window-mode.cjs','tray.png','Install-Pet.cmd','Start-Pet.cmd','Connect-Pet.cmd','Start-And-Connect.cmd','Review-Hooks.cmd','export-source.cjs'];
files.push('ATTRIBUTION.md','project.cjs','AGENTS.md','CONTRIBUTING.md','SECURITY.md','CHANGELOG.md','Check-Setup.cmd','Record-Demo.cmd','Dev-Pet.cmd','.gitattributes');
files.push('bootstrap.cjs','hook-command.cjs','hook.cmd','Create-Shortcut.cmd','electron-builder.cjs','Uninstall-Integration.cmd','cleanup-startup.ps1','PREVIEW-NOTICE.txt');
files.push('LICENSE','settings-store.cjs','detached-launch.cjs','launch-detached.ps1','client-launcher.cjs','client-launcher-entry.cjs');
files.push('pet-shortcut.cjs');
files.push('codex-network.cjs');
files.push('legacy-package-data.cjs','shell-shortcut.ps1', 'repair-shortcuts.ps1','window-observer.cjs');
const directories=['assets','runtime','ui','test','docs','scripts','.github','build'];
// Installation content is separate from the source export and developer documentation.
const sourceOnly = new Set(['export-source.cjs','electron-builder.cjs','launch.cjs']);
const runtimeFiles = files.filter(name => name.endsWith('.cjs') && !sourceOnly.has(name));
runtimeFiles.push('package.json','config.mjs','tray.png','LICENSE','LICENSE.upstream','ATTRIBUTION.md','PREVIEW-NOTICE.txt',
  'hook.cmd','Review-Hooks.cmd','Uninstall-Integration.cmd','startup-watch.ps1','fullscreen-watch.ps1','cleanup-startup.ps1',
  'shell-shortcut.ps1','repair-shortcuts.ps1','launch-detached.ps1','scripts/dev-env.cjs',
  'build/icon.ico','build/codex-withu.ico','build/codex-withu.png');
function exportSource(destination){
  if(fs.existsSync(destination))throw new Error('导出目录已存在，请选择新的目录');
  fs.mkdirSync(destination,{recursive:true});
  for(const name of [...files,...directories])fs.cpSync(path.join(__dirname,name),path.join(destination,name),{recursive:true,errorOnExist:true});
  return destination;
}
if(require.main===module)console.log(exportSource(path.join(__dirname,'release','source-'+new Date().toISOString().replace(/[:.]/g,'-'))));
module.exports={exportSource,files,directories,runtimeFiles};
