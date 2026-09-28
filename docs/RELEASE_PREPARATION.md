# GitHub 发布准备

项目名为 **pet-with-you**，仓库为 [Refining-colors/pet-with-you](https://github.com/Refining-colors/pet-with-you)。源码、ZIP 下载和 Windows 自动检查已验证；首次公开安装包为 [0.1.0-alpha.5](https://github.com/Refining-colors/pet-with-you/releases/tag/v0.1.0-alpha.5)。安装包在干净 Windows 环境构建并完成安装/卸载验收，详见 [检查记录](RELEASE_CHECK.md)。

已建立独立 `pet-with-you` 源码目录，用于本机 Git 版本管理；日常软件运行于安装目录，历史源码和视频另行保留。开发预览使用独立配置，操作见 [源码工作区指南](WORKSPACE.md)。初始化和本机提交不会自动推送 GitHub。

## 对标上游后的材料

参考 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的安装、功能、配置、运行效果、素材链及许可章节，为本项目提供相应材料；DSH/pnpm/原插件安装流程不适用于我们的独立 Electron 应用，不照搬。

| 内容 | 本项目材料 | 状态 |
| --- | --- | --- |
| 仓库首页与功能介绍 | [README](../README.md) | 已按 pet-with-you 整理 |
| 零基础完整安装和连接 | [INSTALL](INSTALL.md) | 已编写，含官方前置下载链接和验收步骤 |
| 独立使用手册 | [USER_GUIDE](USER_GUIDE.md) | 已重新组织 |
| 常见问题与日志反馈 | [TROUBLESHOOTING](TROUBLESHOOTING.md)、Check-Setup.cmd | 已准备 |
| 动画/录屏宣传 | [MEDIA_GUIDE](MEDIA_GUIDE.md)、Record-Demo.cmd | 自动生成演示和单独动作导出已实现 |
| 原作关系及素材许可 | [ATTRIBUTION](../ATTRIBUTION.md)、LICENSE.upstream | 保留上游来源和条款 |
| 开发说明 / AI 配置入口 | [CONTRIBUTING](../CONTRIBUTING.md)、[AGENTS](../AGENTS.md)、[ARCHITECTURE](ARCHITECTURE.md) | 已准备 |
| 反馈模板与基础检查 | .github/ISSUE_TEMPLATE、PR 模板、Windows 自动测试工作流 | 本机与云端验证通过，补充独立安装包发布工作流 |
| 数据安全与更新记录 | [SECURITY](../SECURITY.md)、[CHANGELOG](../CHANGELOG.md) | 已准备 |
| 预览安装包与校验值 | [PACKAGING](PACKAGING.md)、[RELEASE_CHECK](RELEASE_CHECK.md) | 本地 alpha 预览；公开分发与签名待办 |

维护者与仓库链接已填写；尚未提供正式下载版本，不添加虚构下载链接或维护者邮箱。

## 发布前仍需决定

- 维护者已确定为 Refining-colors，仓库地址已确定。
- 新增代码已采用 MIT，保留上游 MIT 声明。代码 MIT 不覆盖素材的非商用限制。
- 字体及其他第三方资源的分发授权：`assets/fonts/上首软糖体.ttf` 等随上游带来的资源，需要确认具体字体授权；上游总体声明不能替代字体权利人的授权。
- 首个预览为 `0.1.0-alpha.1`，当前迭代为 `0.1.0-alpha.3`；源码已公开推送，EXE Release 尚未发布。

托盘保留“关于 pet-with-you”，点击直接打开本项目仓库，不再单列原作入口；维护者为 Refining-colors，原作信息保留在设置页折叠致谢与文档中。普通快捷方式名称为 `pet-with-u`，项目名称不变。历史数据目录和 Startup 入口保留旧名以兼容升级。

alpha.5 已统一版本与最新程序内容。日常安装目录和本机构建测试分开，发布不会自动替维护者升级日常软件；历史 alpha.3 安装器仅作本机回退，不能覆盖新版。

## 发布验收清单

- [x] 重新构建 alpha.5，验证 `Codex withu` 入口、独立图标、联合启动与卸载清理，首次提示与自选目录另有本机 UI 验证。
- [x] 名称、源码包名、README 和主要显示文字统一。
- [x] 运行代码检查个人机器绝对路径，清理无用研究文件和旧验证入口。
- [x] 隔离自动测试、文档链接检查、当前 Windows 桌面界面验证。
- [x] 用本项目界面生成截图及演示视频，全部使用演示数据。
- [x] 源码导出白名单覆盖新增文档、脚本和 .github 材料。
- [x] 独立源码目录安装依赖；单元测试、桌面界面验证、开发预览隔离验证和文档链接检查通过，详细范围见检查记录。
- [x] Electron 更新至 41.10.7；本次依赖审计没有已知漏洞（不等同于完整安全审计）。
- [x] 在全新目录重新下载源码依赖；安装版使用隔离设置验证启动、快捷方式、卸载与无外部 Node.js 的 Hooks。
- [ ] 在全新 Windows 账户/电脑重复验收图形安装向导及完整连接流程。
- [ ] 检查不同 Windows 显示缩放、多显示器、非默认安装渠道和正常退出保存。
- [ ] 实际登录重启验证开机自启动、Codex withu 联合启动、随客户端关闭和目录移动后的 Hooks 更新。
- [x] 新增代码选择 MIT，保留上游版权与许可。
- [x] 公开安装包不附带第三方字体；角色按原作许可与署名约定分发。源码保留字体的单独授权仍待核对。
- [x] 从版本标签构建并审计实际安装内容，排除个人配置、密钥、日志、私人字体及媒体实验；源码下载由同一 Git 标签提供。
- [x] 创建 GitHub 仓库并补全主页、问题反馈链接。
- [x] 首次推送源码，验证远端提交与 ZIP 下载。
- [x] 推送并复验 GitHub Actions，构建公开预览 Release；私密漏洞报告另行配置。
- [ ] 视频附件上传后再将链接写入 README；发布说明保留原作链接。

此前三个源码快照只保留在原日常目录作为本机备份，没有复制进新仓库。`node_modules/` 为本机依赖，`.npm-cache/` 为本机缓存，均不应上传。

## GitHub 页面上的内容从哪来

文件列表下面的介绍就是根目录 **README.md**，GitHub 自动排版，不需要另建网站。文档、截图、模板通常随源码上传。

| 页面内容 | 如何准备 |
| --- | --- |
| 长篇介绍、表格、章节、折叠说明 | 编写 README.md，使用 Markdown |
| 图片 / GIF | 存在 docs/images，再用相对路径引用 |
| 演示视频 | 上传为附件或发布下载文件，填真实链接 |
| 右侧 About 简介和标签 | 创建仓库后在 GitHub 页面设置 |
| Releases 安装包 | 单独创建版本说明并上传可下载产物 |
| Issue 表单 | 仓库里的 .github/ISSUE_TEMPLATE |
| PR 模板 | .github/PULL_REQUEST_TEMPLATE.md |
| 自动测试 | .github/workflows/check.yml；上传后由 GitHub Actions 运行 |
| 下载数、星数或测试徽章 | 仓库存在后引用真实数据地址 |

项目内链接使用相对路径，不能把开发者电脑的磁盘路径写入对外文档。GitHub 不会自动把源码变成可用的 Windows 安装程序。


## GitHub About 简介草稿

简介：Windows 桌面陪伴宠物，支持随机互动、自有 API 聊天与碎碎念，并可连接 Codex 显示任务状态和额度。

建议标签：`desktop-pet`、`windows`、`electron`、`codex`、`virtual-pet`、`openai-compatible`。这是待填入 GitHub About 的文字，尚未修改远程设置。

首页内容由根目录 README 自动显示；上传后无需另外制作网站。宣传视频以 4K 为目标，二维与三维取舍及待办见 [视频方案](VIDEO_PLAN.md)。
