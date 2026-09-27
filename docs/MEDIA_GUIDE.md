# 演示录制与动画导出

下一轮以 4K 作为母版和发布目标；蓝色配色、竖屏平台适配、演示内容和片头设想记录在 [视频计划](VIDEO_PLAN.md)。该计划尚未实施，下面描述的仍是现有 720p 工具。

可以直接用项目自动生成演示，不必安装 PixPin、OBS 或 FFmpeg。已有 PixPin 也可以用于录制你真实操作设置的过程。

角色与动画来自 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)。这里的自动录制展示本项目的界面与新增功能，原素材的非商业使用和署名约定仍然适用。

## 一键生成演示视频

完成安装后，双击 `Record-Demo.cmd`，或在项目目录运行：

```powershell
npm run media:record
```

录制会临时启动一个独立演示桌宠，通常几十秒内完成。它捕获本项目窗口，不截取整个桌面；任务名、额度、时间和回复全部使用预设演示数据，不读取真实账户、不连接 Codex、不调用模型。过程可能短暂显示一只额外宠物，请不要操作这个演示窗口。

输出在项目的 `media-output/`：

| 文件 | 内容 |
| --- | --- |
| `pet-with-you-demo.webm` | 1280×720、约 15 秒、无声的四段功能演示 |
| `scene-1.png` 至 `scene-4.png` | 每段首帧，适合作为说明文档配图 |
| `recording.json` | 录制尺寸、耗时、帧数和来源说明，不含密钥 |

四段分别是动作点播、多任务反馈、碎碎念、Codex 额度卡。录制使用真实桌宠渲染界面和本机视频编码器；捕获帧率受机器性能影响，当前适合功能预览，不代替高帧率宣传片制作。重复运行会覆盖同名演示文件，需要保留旧版时先复制到自己的视频目录。

GitHub README 可以直接显示 PNG 配图。视频通常上传为 GitHub 附件或放在 Releases，再将真实链接放入 README；不要填写本机 `D:\...` 路径或伪造下载链接。生成输出默认不纳入 Git；选好的配图可复制到 `docs/images/`。

## 提取已有动画

先列出可用动画名：

```powershell
npm run media:animations
```

挑选动作后导出，例如：

```powershell
npm run media:animations -- "被鼠标拖拽悬空反馈"
```

也可一次导出全部：

```powershell
npm run media:animations -- --all
```

每次生成一个新的 `media-output/animations-时间戳/` 目录，内含所选 WebM、`SOURCE.txt` 和 `index.html` 预览页。双击预览页后，按每个视频的播放按钮即可挑选。

这是按原文件导出，保留透明通道，不会提高原有清晰度，也不会将原角色动画变为原创作品。导出不调用图像模型、不消耗 token。

## 想用 MP4 / GIF / 竖屏宣传片

当前内置输出是 WebM，**不是 MP4**。支持 WebM 的剪辑软件可以直接导入。也可以自行安装 [FFmpeg](https://ffmpeg.org/download.html)，然后在项目目录转换：

```powershell
ffmpeg -i media-output/pet-with-you-demo.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart media-output/pet-with-you-demo.mp4
```

FFmpeg 是可选工具，不参与桌宠正常运行。普通 MP4 不保留透明通道，透明角色素材需要在剪辑软件中先铺背景；演示视频本身已有背景。GIF 的色彩、体积和清晰度通常不如视频。

现成模板为横屏。后续可在 `scripts/demo-canvas.html` 改画布尺寸、字幕和版式，在 `scripts/record-demo.cjs` 改演示场景；竖屏应重新排版，不建议只拉伸横屏。

## 用 PixPin 录真实操作

1. 桌宠的 GPT 连接设置中开启“关闭事件响应”，避免私密任务标题突然出现。
2. 关闭自动碎碎念；使用演示账户或预设文本，不展示密钥页面。
3. 用 PixPin 框选桌宠和设置区域，依次演示右键点播、尺寸滑条、字体、设置拖动排序等。
4. 停止录制后检查画面，再按需要恢复原设置。

功能视频的标题可使用 `pet-with-you`，文案介绍本项目新增的独立桌宠、自有 API、Codex 联动与交互功能。包含原角色时，在介绍/发布说明中附原仓库链接；自动模板已经把来源放入画面。
