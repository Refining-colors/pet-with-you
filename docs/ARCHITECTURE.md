# 项目结构与维护边界

## 目录职责

```text
pet-with-you/                 # 独立源码仓库；实际路径仍可自行选择
  *.cmd / launcher.vbs       # 面向用户的安装、启动、检查和录制入口
  bootstrap.cjs / main.cjs / launch.cjs # 打包入口、生命周期与源码启动器
  electron-builder.cjs / build/ # Windows 安装器配置、图标与快捷方式选项
  project.cjs                # 展示名与兼容的数据路径
  server.cjs                 # 本地带随机令牌的服务、路由与功能协调
  *-client.cjs / quota.cjs    # API、Codex、额度与流式请求
  state.cjs / session-monitor.cjs / hook.cjs
                             # 多任务聚合、本地记录与 Hook 事件
  settings-store.cjs         # 统一 settings.json、旧配置迁移与本机密钥分离
  preferences.cjs / appearance.cjs / positions.cjs
                             # 设置、字体和位置持久化
  autostart.cjs / startup-watch.ps1 # 登录时一次性启动，保留旧文件名兼容
  shell-shortcut.ps1         # 共享 Unicode Windows 快捷方式读写
  client-launcher*.cjs / launch-detached.ps1 # 无常驻联动入口、Explorer 独立启动
  fullscreen-watch.ps1       # 桌宠运行期间的窗口策略与退出检测
  runtime/                   # 宠物窗口、动画、鼠标与反馈气泡
  ui/                        # 设置界面、自动保存与模块排序
  assets/                    # 默认配置、106 段动画与配套资源
  scripts/                   # 环境检查、隔离测试入口、媒体生成
  test/                      # 单元测试与 Electron 界面验证
  docs/                      # 安装、使用、排错、配图和发布说明
  .github/                   # Issue 模板、PR 模板与基础自动检查
```

开发预览由 `Dev-Pet.cmd` / `scripts/dev.cjs` 启动，使用 `.local/` 中的独立桌宠数据和 Codex 目录；正常启动仍使用兼容的 Windows 用户数据目录。详见 [源码工作区指南](WORKSPACE.md)。

`qa-output/` 是测试输出，`media-output/` 是录制/提取输出，`release/` 是源码导出目标；均排除版本控制。此前的旧快照仅保留在原日常目录，新仓库没有复制。

## 数据流

1. 源码由 `launch.cjs` 定位 Electron；打包 EXE 由 `bootstrap.cjs` 分流普通启动与屏幕缩放探测，避免探测被单实例锁拦截。
2. `main.cjs` 建立本机服务、设置窗口、宠物窗口、托盘和系统窗口策略。
3. 渲染器从本地服务读配置；自身负责动画播放和鼠标交互。任务记录/Hooks 经 `TaskState` 聚合后提供给渲染器。
4. 聊天与额度服务各自封装连接和错误分类，不把密钥返回到界面。任务反馈和媒体生成不经过聊天模型。
5. 设置关闭时等待自动保存完成；涉及重建窗口的改动恢复位置及本次运行中的保留回复。

## 维护决策

- 产品展示名统一到 pet-with-you；`project.cjs` 集中数据路径，运行程序选择也遵循测试目录隔离。
- 保留 `%APPDATA%/DSH Pet Companion` 和原 Startup 快捷方式名称，避免现有密钥、位置、启动入口丢失或重复；不要求搬动当前项目文件夹。
- 删除过时的启动/周期额度查询与无服务端功能的广播/触发计数轮询。额度只有手动或用户开启的新回合结束触发。
- 本地记录首次恢复的历史完成不会递增自动查询计数。
- 删除主进程内两套早期验证分支及上游遗留冒烟脚本，统一 `npm run test:ui`，使用临时数据，避免旧脚本误碰真实账户。
- 源码按白名单整理，排除研究网页、旧日志/截图、生成协议、历史发布备份和临时媒体；它们不属于新仓库。
- Codex 路径检测补充常见 npm Windows 原生程序目录；Hooks 卸载遵循 `CODEX_HOME`，与安装路径一致。
- 提供环境检查、文档链接检查和可复现的演示录制/动画提取。

## 仍需谨慎演进的地方

`server.cjs` 和 `runtime/sprite.js` 仍偏大，是后续按路由/气泡/交互进一步拆分的候选；本轮没有为了目录好看大规模搬迁这些稳定接口。渲染脚本按顺序共享作用域，改为模块前要验证动画切换、缩放与拖动。

从上游继承的部分 DSH 协议名、动画配置字段和内部兼容代码仍保留。它们不是用户机器绝对路径，不应简单替换为新品牌以免破坏协议或素材配置。余额刷新字段可能仍在兼容配置中，但不再驱动周期查询。

外部兼容边界：Codex 本地会话格式、Hooks、app-server 版本；Windows 缩放/多显示器/Startup 权限；服务商 Chat Completions 和额度接口。测试使用模拟服务，不能证明每个安装渠道/中转站都兼容，也不能视作独立安全审计。

## 验证与打包

见 [贡献说明](../CONTRIBUTING.md)。源码导出使用 `export-source.cjs` 的白名单，只在准备发布时手动执行；导出前仍需检查选中的素材、文档和截图。白名单不是个人隐私检查的替代品。

Windows 安装程序和升级边界见 [打包说明](PACKAGING.md)。预览使用真实资源路径供 PowerShell、命令脚本和 Hooks 调用；运行目录不保存个人配置。Hooks 在安装版通过 Electron 内置 Node 运行，源码版使用已解析的 Node 路径。

下一次真正发布前，必须在全新目录进行“下载 → 安装 → 纯桌宠 → 可选连接”的完整验收，核对第三方资源的分发范围；代码已采用 MIT。
