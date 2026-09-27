const { files } = require('./export-source.cjs');
module.exports = {
  appId: 'im.refiningcolors.petwithyou',
  productName: 'pet-with-you',
  executableName: 'pet-with-you',
  artifactName: '${productName}-${version}-${arch}-setup.${ext}',
  directories: { output: 'dist', buildResources: 'build' },
  electronDist: require('node:path').dirname(require('electron')),
  // External PowerShell and command helpers need real filesystem paths.
  asar: false,
  files: [
    ...files.filter(name => name.endsWith('.md') || (name.endsWith('.cjs') && !['export-source.cjs', 'electron-builder.cjs', 'launch.cjs'].includes(name)) || ['package.json','tray.png','LICENSE.upstream','PREVIEW-NOTICE.txt','hook.cmd','Review-Hooks.cmd','Uninstall-Integration.cmd','startup-watch.ps1','fullscreen-watch.ps1','cleanup-startup.ps1','config.mjs'].includes(name)),
    'assets/**/*', 'runtime/**/*', 'ui/**/*', 'docs/**/*', 'scripts/dev-env.cjs', 'build/icon.ico',
    '!**/node_modules/**/*', '!**/.local/**/*', '!**/*.log',
  ],
  win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: 'build/icon.ico', signAndEditExecutable: true },
  nsis: {
    oneClick: false, perMachine: false, allowElevation: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: false, createStartMenuShortcut: true,
    shortcutName: 'pet-with-you', runAfterFinish: false,
    installerIcon: 'build/icon.ico', uninstallerIcon: 'build/icon.ico',
    include: 'build/installer.nsh', deleteAppDataOnUninstall: false,
    installerLanguages: ['zh_CN', 'en_US'],
    license: 'PREVIEW-NOTICE.txt',
  },
  publish: [{ provider: 'github', owner: 'Refining-colors', repo: 'pet-with-you', releaseType: 'prerelease' }],
};
