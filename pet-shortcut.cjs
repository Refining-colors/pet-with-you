const fs = require('node:fs');
const path = require('node:path');

function createPetShortcut({ directory, root = __dirname, executable = process.execPath, packaged = false, development = false, shell, nodeExecutable }) {
  if (!path.isAbsolute(directory) || !fs.statSync(directory).isDirectory()) throw new Error('请选择已存在的快捷方式保存目录。');
  const icon = packaged ? executable : path.join(root, 'build', 'icon.ico');
  const target = packaged ? executable : path.join(process.env.WINDIR, 'System32', 'wscript.exe');
  const launcher = path.join(root, 'launcher.vbs');
  let args = '--settings';
  if (!packaged) {
    nodeExecutable ||= require('./node-runtime.cjs').locateNode();
    if (!fs.existsSync(nodeExecutable) || !fs.existsSync(launcher)) throw new Error('启动文件缺失，请先修复源码安装。');
    args = `"${launcher}" ${development ? 'dev' : 'normal'} "${nodeExecutable}"`;
  }
  if (!fs.existsSync(target) || !fs.existsSync(icon)) throw new Error('软件或图标文件缺失，请先修复安装。');
  const name = development ? 'pet-with-u 开发预览' : 'pet-with-u';
  // Never replace a user's existing shortcut or another file with the same name.
  let file = path.join(directory, name + '.lnk');
  for (let index = 2; fs.existsSync(file); index++) file = path.join(directory, `${name} (${index}).lnk`);
  const ok = shell.writeShortcutLink(file, 'create', {
    target, args, cwd: root, icon, iconIndex: 0,
    description: development ? 'pet-with-you development preview' : 'pet-with-you desktop companion',
  });
  if (!ok) throw new Error('快捷方式创建失败，请检查目录写入权限，或选择桌面等个人目录。');
  return { ok: true, file, development };
}

async function offerFirstRunShortcut({ store, dialog, parent, createShortcut }) {
  if (store.get('onboarding', {}).shortcutPrompted) return { skipped: true };
  const choice = await dialog.showMessageBox(parent, {
    type: 'question', title: '创建桌宠快捷方式',
    message: '是否创建 pet-with-u 启动快捷方式？',
    detail: '可以选择桌面或其他文件夹，快捷方式使用桌宠图标。如果安装时已创建，可选择“暂不创建”。以后也能从基础设置底部创建。',
    buttons: ['选择目录并创建', '暂不创建'], defaultId: 0, cancelId: 1,
  });
  const result = choice.response === 0 ? await createShortcut() : { canceled: true };
  // Remember an explicit choice or canceled folder picker, but allow retry after errors.
  store.set('onboarding', { ...store.get('onboarding', {}), shortcutPrompted: true });
  return result;
}

module.exports = { createPetShortcut, offerFirstRunShortcut };
