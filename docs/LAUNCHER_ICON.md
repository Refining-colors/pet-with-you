# Codex withu 图标记录

用于联合启动器，普通桌宠、托盘和安装程序继续使用原 `build/icon.ico`。

- 成品：[透明 PNG](../build/codex-withu.png)、[Windows ICO](../build/codex-withu.ico)。
- 构图：黑色 GPT / ChatGPT 结形图标为主，右侧站着捧碗吃白饭的蓝毛小女仆。
- 输入一：维护者上传的黑白 GPT / ChatGPT 标志参考图。
- 输入二：项目 `assets/webm/吃白饭.webm` 约第 3 秒的透明帧，角色与姿态来自上游 dsh-pet。
- 制作：内置 ImageGen，透明背景；生成后保留 PNG 原图，格式转换为含 16、24、32、48、64、128、256 像素图层的 ICO。
- 参考帧、临时 QA 图不进入发行包；运行时仅使用项目内的成品，不依赖开发者电脑路径。

这是非官方联合启动器图标，原品牌与角色权利不因组合生成而转移；详见 [来源说明](../ATTRIBUTION.md)。

## 实际生成提示词

```text
Use case: compositing. Create ONE square Windows desktop launcher icon, transparent background, high resolution. Reference 1 is the user's black ChatGPT/OpenAI knot emblem on white: faithfully preserve its exact recognizable six-loop interwoven geometry, proportions and pure black strokes. Remove its rectangular white background; keep clean white interior areas of the emblem for desktop legibility. Reference 2 is the chosen blue-haired chibi maid eating rice animation frame: preserve the SAME character identity, blue hair with lighter blue tips, white maid headdress, dark maid dress with white apron and blue whale emblem, happy closed eyes, bowl of white rice held up at her mouth, chopsticks in the other hand. Faithful crisp 2D anime/chibi illustration, redraw cleanly at high resolution without changing outfit or expression. Main composition: dominant large black GPT knot at left/center, smaller but clearly visible full-body maid eating rice beside its lower right; slight overlap only at the knot's lower right edge, do not obscure the center of the emblem. Emblem about 78% canvas height, maid about 53% canvas height. Compact harmonious grouping, baseline aligned near bottom, 5% outer safe padding. Give the character a subtle clean white separation outline for legibility. Rice bowl and joyful eating pose must read at desktop icon size. No letters, captions, watermark, application frame, blue terminal icon, 3D effects, extra objects, decorative background, or enclosing tile. Actual alpha transparency outside subjects, not checkerboard.
```
