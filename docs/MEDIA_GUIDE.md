# 演示制作与动画导出

当前提供 **3840×2160、24fps、96 秒、无声 H.264 MP4** 文档演示。画面采用蓝色配色，从开头标明“GitHub 开源项目 · pet-with-you”，不显示仓库网址。更完整的宣传片、竖屏版本及发布会式开场见 [视频计划](VIDEO_PLAN.md)。

这份视频是**离线合成的功能介绍**：取本项目实际渲染的气泡卡片，以演示数据重绘为高清截图，再与本项目原始透明动画合成。不是鼠标操作实录，也没有调用真实 API；不把预设文本的出现速度当作服务商响应速度。卡片与角色分区，不遮挡头部。

## 准备制作环境

桌宠正常使用不需要 FFmpeg。制作 MP4 或重新生成 GIF 图鉴需要：

1. 按 [安装手册](INSTALL.md) 安装源码依赖。
2. 从 [FFmpeg 下载页](https://ffmpeg.org/download.html) 选择可信的 Windows 构建并解压，把 `bin` 加入 PATH。重新打开终端，执行 `ffmpeg -version` 确认。
3. 也可仅在本次 PowerShell 中设置 `$env:PET_FFMPEG = '你解压后的完整路径\ffmpeg.exe'`，不修改系统环境。需包含 `libvpx-vp9` 解码器、`libx264` 编码器和 PNG/GIF 支持。

制作过程只捕获隔离演示桌宠的卡片，不截取用户整个桌面、不读取真实账户、不连接 Codex、不调用聊天模型。可能短暂出现额外桌宠，请不要操作它。所有文件输出到被 Git 排除的 `media-output/`。

## 一键生成文档演示

双击 `Record-Demo.cmd`，或运行：

```powershell
npm run media:record
```

通常需要数分钟；每完成一段会显示 `Rendered demo scene`。采用离线固定帧率编码，速度取决于处理器，无需 4K 显示器或高刷新率屏幕。超时上限为 30 分钟。重复运行覆盖同名产物，保留旧版请先另存。

输出在 `media-output/demo-4k/`：

| 文件 | 内容 |
| --- | --- |
| `pet-with-you-demo-4k.mp4` | 12 段横屏完整介绍 |
| `hello.mp4`、`rice.mp4` 等 | 可单独剪辑的分段 |
| `tasks.png`、`quota.png`、`proxy.png`、`whisper.png` 等 | 对应场景第 3 秒的 4K 配图 |
| `*-plate.png` | 文字与界面底板，便于后期检查 |
| `recording.json` | 尺寸、帧率、场景时长、演示数据与制作方式说明 |

顺序为：项目亮相 → 吃饭 → 玩耍 → 时节 → 点击回应 → 碎碎念 → 自有 API 聊天 → 密钥/代理统计 → 多任务 → 等待确认 → 登录额度 → 收尾。聊天场景展示回复卡；实际配置、发送输入和流式等待的操作教程另录。

仅检查版式可设置 `$env:PET_DEMO_PREVIEW = '1'` 再运行，生成四段各一秒的 `layout-preview.mp4`；完成后移除该环境变量，再输出完整版。

**画质边界：** 文字与构图按 4K 绘制，但角色源动画是 640×360、24fps。没有插帧或重新生成角色，不能称作原生 4K 角色素材。

## 全部动画图鉴

[动画与表情图鉴](ANIMATIONS.md) 列出 106 段动作及触发方法、27 张表情图，预览由本项目当前素材重新生成。

```powershell
npm run media:catalog
npm run media:catalog -- --force
```

第一条补充缺失预览并更新文档；第二条重建全部。GIF 是 240×135、8fps 的完整循环，仅用于文档预览；实际原始动画仍为 24fps WebM。生成器会核对配置和素材目录，发现未列入的动画即报错。

## 提取原始透明动画

这一步不需要 FFmpeg，也不调用图像模型：

```powershell
npm run media:animations
npm run media:animations -- "吃白饭" "原地专心玩魔方"
npm run media:animations -- --all
```

无参数列出名称，指定名称导出所选动画，`--all` 导出全部。输出为新的 `media-output/animations-时间戳/` 目录，内含原始 WebM、来源说明与可播放的 `index.html`。透明素材导出不会增加清晰度，也不会改变原作素材的许可。

## 手册和 GitHub 如何展示视频

README 可直接显示 PNG/GIF，首页已展开完整动画与表情图鉴，独立图鉴补充逐项说明。视频母版体积较大，默认不加入源码 Git 历史。确认成片后可上传 GitHub 附件或 Release，再填写真实链接；当前没有公开视频附件，不写虚构下载地址。

## 节奏优化版正片

设置环境变量 `PET_DEMO_EDITION=story` 后运行 `npm run media:record`，输出到 `media-output/demo-story-4k/`。纯桌宠动作采用 3–4 秒短段，聊天和额度卡片保留 5–7 秒，12 个场景总计 59 秒；该版使用与发布会片头相同的蓝色背景和文字层级，不覆盖原 96 秒版本。

本机另有包含约 8 秒片头的 67 秒合成预览，横屏 4K/24fps，无声。片头采用生成的二维宣传立绘，正片使用原角色动画和真实 UI 卡片；不将整张立绘运动称为 Live2D，也不把低分辨率角色素材称为原生 4K。视频尚未附加到公开安装 Release。

## 下一步：真实操作教程与竖屏

- 设置操作：用 PixPin 或 OBS 录制隔离演示实例，局部放大尺寸条、字体、排序和配置列表；不录日常密钥页面。
- 竖屏：重新排为 2160×3840，按手机界面安全区域调整标题和卡片，不把横屏硬拉伸。
- 发布会式开头：高清二维角色特写与 2.5D 镜头另做，先校验角色一致性，不复用参考视频或音轨。

脚本中的 `scripts/demo-canvas.html` 控制版式，`scripts/record-demo.cjs` 控制场景，`scripts/media-tools.cjs` 共用素材目录核对与 FFmpeg 调用。

角色与动画来自 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)，保留其非商用与署名要求，详见 [来源与致谢](../ATTRIBUTION.md)。视频画面不放来源网址；对外发布介绍/说明仍应保留来源关系。

最新剪辑交付：完整片头与正片分开，保留各自原始输出，放在本机 `media-output/editing-delivery/`；11 秒 4K/30fps 片头与 59 秒 4K/24fps 正片均无声，由维护者自行组合。
