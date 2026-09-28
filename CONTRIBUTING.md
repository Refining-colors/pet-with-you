# 参与 pet-with-you

目前处于发布准备阶段，仓库为 [Refining-colors/pet-with-you](https://github.com/Refining-colors/pet-with-you)，由 Refining-colors 维护；新增代码采用 [MIT 许可证](LICENSE)。上游素材不是无限制 MIT 素材，见 [ATTRIBUTION.md](ATTRIBUTION.md)。

## 开发环境

Windows 10/11、Node.js 22.12+，在项目目录运行 `npm ci --cache .npm-cache`。普通修改使用 `npm start`（或双击 `Dev-Pet.cmd`）打开隔离开发预览。开发设置保存在本仓库的 `.local/dev-data`，Codex 目录为 `.local/dev-codex`；不会自动使用日常密钥、登录或配置。不要把个人数据复制进仓库。

开发预览不写系统启动项，不允许开机自启动或随客户端关闭；此类改动保存时会提示关闭选项。开发预览也不创建真实客户端联动入口，不从设置启动日常客户端的 Hooks 审阅。自行填写 API 后的真实聊天仍会向所选服务发出请求，并非模拟模式。完整模拟验证请用 `npm run test:ui`。

`Start-Pet.cmd` / `node launch.cjs` 是正式使用入口，会使用当前用户的日常配置；维护者已有另一份桌宠运行时，不要用它作为开发预览。目录分工、默认设置和首次 Git 操作见 [源码工作区指南](docs/WORKSPACE.md)。

常用检查：

```powershell
npm run doctor
npm test
npm run test:ui
npm run check:docs
npm run audit:source
```

`test:ui` 创建临时数据目录，模拟聊天和额度，不调用付费模型，完成后清理临时数据。它会显示测试窗口，需要 Windows 桌面会话。`qa-output/` 保存可检查的测试截图。

## 代码与目录

见 [架构说明](docs/ARCHITECTURE.md)。功能服务保持单独模块；渲染层与系统窗口层不要重复换算坐标。不要为了换名字而全局替换上游标识和持久化路径。

新增设置需要同时考虑默认值、校验、旧配置兼容、自动保存、切换模式和窗口重建。涉及密钥时只向界面返回掩码，不把真实值放进 URL、错误消息或日志。

## 提交问题与改动

普通问题提供复现步骤、环境、预期结果、实际结果、脱敏错误编号或截图。安全问题按 [SECURITY.md](SECURITY.md) 处理。

修改说明应写清解决了什么问题、最终行为和验证结果。影响使用方式时同步修改安装/使用手册；有新素材时记录来源与许可。不要提交依赖目录、个人配置、临时录制、截图中的私密任务或自己的字体文件。

维护者发布前按 [发布清单](docs/RELEASE_PREPARATION.md) 检查。单元测试通过不能代替不同屏幕缩放、开机启动和真实客户端版本的人工验收。

本地 Windows 安装程序的构建与验证见 [打包说明](docs/PACKAGING.md)，首次预览的检查范围及剩余限制见 [检查记录](docs/RELEASE_CHECK.md)。
