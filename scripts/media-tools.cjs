const { spawnSync, spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
function findFFmpeg() {
  const command = process.env.PET_FFMPEG || 'ffmpeg';
  const result = spawnSync(command, ['-version'], { windowsHide: true, encoding: 'utf8', timeout: 10000 });
  if (result.error || result.status) throw new Error('FFmpeg is required for media generation. Install it on PATH or set PET_FFMPEG to ffmpeg.exe. See docs/MEDIA_GUIDE.md.');
  return command;
}
function ffmpeg(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    const stop = () => child.kill();
    process.once('exit', stop);
    let errors = '';
    child.stderr.on('data', chunk => { errors = (errors + chunk).slice(-4000); });
    child.on('error', reject);
    child.on('close', code => {
      process.removeListener('exit', stop);
      code ? reject(new Error('FFmpeg failed: ' + errors)) : resolve();
    });
  });
}
async function catalog() {
  const { readAllConfig } = await import('../config.mjs');
  const config = readAllConfig({ defaultFile: path.join(root, 'assets/config.jsonc'), userFile: path.join(root, 'assets/config.jsonc'), petDir: path.join(root, 'media-output/no-pets') }).main;
  const a = config.animations;
  const groups = [
    { name: '待机与转向', trigger: '随机动作链中的待机与转向，也可手动点播。', names: [...a.idle, ...a.turn] },
    ...a.categories.map(c => ({ name: c.id, trigger: `日常随机分类，权重 ${c.weight}；右键 → 动作 → ${c.id} 可逐个点播。${c.noMirror ? '含文字，镜像朝向时不参与随机播放。' : ''}`, names: c.actions })),
    { name: '点击回应', trigger: '点击宠物；右键动作菜单也能点播。候选轮换，避免连续重复。', names: a.clicks },
    { name: '拖拽', trigger: '按住宠物拖动；手动点播只演示姿态。', names: a.drag },
    { name: '移动与跑动', trigger: '随机移动或手动点播。「移动（原地播放）」只播姿态，「跑动（实际移动）」会改变桌面位置。禁止自主跑动不禁止手动跑动。', names: a.moves.actions.map(x => x.name) },
    { name: '额度查询', trigger: '额度查询成功后按已用比例分档：0–20%、20–40%、40–60%、60–80%、80–不足100%、100%。不会因闲置自动查询；也可手动点播动画。', names: a.events.balance.flat() },
    { name: '碎碎念', trigger: '手动/自动碎碎念、聊天回复；仅生成文本会调用所选 API。手动点播动画不调用模型。', names: a.events.whisper.flat() },
    { name: '任务反馈', trigger: '连接模式事件：思考、执行工具、整理结果、等待确认、完成、出错；事件关闭时不自动触发。可手动点播。', names: a.events.workStatus.flat() },
  ];
  const entries = groups.flatMap((group, g) => group.names.map((name, i) => ({ name, group: g, id: `${String(g + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}` })));
  const names = entries.map(x => x.name);
  const files = fs.readdirSync(path.join(root, 'assets/webm')).filter(x => x.endsWith('.webm')).map(x => x.slice(0, -5));
  if (new Set(names).size !== files.length || files.some(x => !names.includes(x))) throw new Error('Animation catalog does not cover the asset directory');
  return { groups, entries, memes: config.memes };
}
module.exports = { root, findFFmpeg, ffmpeg, catalog };
