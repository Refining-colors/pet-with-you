const fs = require('node:fs');
const path = require('node:path');
const { root, findFFmpeg, ffmpeg, catalog } = require('./media-tools.cjs');
(async () => {
  const { groups, entries, memes } = await catalog();
  const output = path.join(root, 'docs/images/animations');
  fs.mkdirSync(output, { recursive: true });
  if (!process.argv.includes('--docs-only')) {
    const command = findFFmpeg();
    for (const [index, entry] of entries.entries()) {
      const file = path.join(output, entry.id + '.gif');
      if (!fs.existsSync(file) || process.argv.includes('--force')) {
        // Decode VP9 alpha explicitly; the native decoder can discard transparency.
        await ffmpeg(command, ['-c:v', 'libvpx-vp9', '-i', path.join(root, 'assets/webm', entry.name + '.webm'), '-filter_complex', '[0:v]fps=8,scale=240:135:flags=lanczos,split[fg][base];[base]drawbox=c=0xeaf5ff:t=fill:replace=1[bg];[bg][fg]overlay=shortest=1,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer', '-loop', '0', file]);
      }
      console.log(`Animation preview ${index + 1}/${entries.length}: ${entry.name}`);
    }
  }
  const lines = ['# 动画与表情图鉴', '', `共 **${entries.length} 段动画**、**${Object.keys(memes).length} 张表情图**。以下预览从本项目当前 WebM 素材重新生成，没有复制上游 README 的 GIF。`, '', 'GIF 为完整动作的轻量预览（240×135、8fps），不代表实际桌宠清晰度与帧率；点击动画名可查看仓库原始 WebM。全部动画都可以在右键动作菜单中找到。', '', '日常随机动作按分类权重抽取，并避开近期重复；事件专属动画不会混入普通随机池。因此日常看不到部分额度/任务动画是正常现象。详见各分类触发说明。', '', '[回到首页](../README.md) · [使用手册](USER_GUIDE.md) · [媒体制作](MEDIA_GUIDE.md)', ''];
  groups.forEach((group, g) => {
    lines.push(`## ${group.name}（${group.names.length}）`, '', group.trigger, '', '| 动画 | 预览 |', '| --- | --- |');
    for (const entry of entries.filter(x => x.group === g)) lines.push(`| [${entry.name}](../assets/webm/${encodeURIComponent(entry.name)}.webm) | ![${entry.name}](images/animations/${entry.id}.gif) |`);
    lines.push('');
  });
  lines.push('## 聊天与碎碎念表情图', '', '是否附图由对应设置控制；这些是静态表情图，不是新增动作。', '', '| 表情 | 使用语境 |', '| --- | --- |');
  for (const [name, description] of Object.entries(memes)) lines.push(`| [${name}](../assets/memes/${encodeURIComponent(name)}.png)<br><img src="../assets/memes/${encodeURIComponent(name)}.png" width="160" alt="${name}"> | ${description} |`);
  lines.push('', '## 来源与再生成', '', '角色与动画来自 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)，保留非商用与署名约定，详见 [来源与致谢](../ATTRIBUTION.md)。', '', '开发者运行 `npm run media:catalog` 更新目录与缺失 GIF；加 `-- --force` 重建全部预览。无需调用模型。分类从 `assets/config.jsonc` 读取，素材有缺漏时生成器会报错。', '');
  fs.writeFileSync(path.join(root, 'docs/ANIMATIONS.md'), lines.join('\n'));
  const escape = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const gallery = ['## 动画图鉴', '', `**${entries.length} 段动画**按分类展示。将鼠标放在预览上可查看名称，点击可打开原始动画；所有动作均可在桌宠右键菜单中点播。`, '', '日常随机播放与事件触发使用不同的动作池，额度、任务等专用动画不会混入普通随机播放。', ''];
  groups.forEach((group, g) => {
    gallery.push(`### ${group.name}（${group.names.length}）`, '', group.trigger, '', '<p>');
    for (const entry of entries.filter(x => x.group === g)) gallery.push(`<a href="assets/webm/${encodeURIComponent(entry.name)}.webm"><img src="docs/images/animations/${entry.id}.gif" width="240" alt="${escape(entry.name)}" title="${escape(entry.name)}"></a>`);
    gallery.push('</p>', '');
  });
  gallery.push(`### 聊天与碎碎念表情图（${Object.keys(memes).length}）`, '', '可按设置为聊天与碎碎念附图。以下为静态表情，完整使用语境见[独立图鉴](docs/ANIMATIONS.md#聊天与碎碎念表情图)。', '', '<p>');
  for (const name of Object.keys(memes)) gallery.push(`<a href="assets/memes/${encodeURIComponent(name)}.png"><img src="assets/memes/${encodeURIComponent(name)}.png" width="160" alt="${escape(name)}" title="${escape(name)}"></a>`);
  gallery.push('</p>', '', '角色与动画的来源、许可及致谢见[文末说明](#原作维护与许可)。', '');
  const readmePath = path.join(root, 'README.md');
  const readme = fs.readFileSync(readmePath, 'utf8');
  const start = '<!-- ANIMATION_GALLERY:START -->', end = '<!-- ANIMATION_GALLERY:END -->';
  const first = readme.indexOf(start), last = readme.indexOf(end);
  if (first < 0 || last < first) throw new Error('README animation gallery markers are missing');
  // Only replace the gallery; preserve the hand-written introduction and manuals.
  fs.writeFileSync(readmePath, readme.slice(0, first) + start + '\n' + gallery.join('\n') + end + readme.slice(last + end.length));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
