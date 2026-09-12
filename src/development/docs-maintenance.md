---
title: 文档同步规则
icon: file-pen
order: 2
---

# 文档同步规则

功能与文档属于同一个交付结果。以后每次增加、删除或改变 RemoteCI 功能，都应在合并功能前同步更新本仓库。

## 哪些变更必须更新文档

| 代码变更 | 至少检查的文档 |
| --- | --- |
| 新增或删除用户功能 | 首页、功能说明、快速开始 |
| 修改设置项或默认值 | 配置参考、快速开始 |
| 修改端口、URL 或协议 | 连接方式、部署文档、故障排查 |
| 修改服务端环境变量 | 配置参考、Compose 示例 |
| 修改账号或权限 | 功能说明、快速开始、安全建议 |
| 修改数据库或升级方式 | 运维、备份与恢复 |
| 修复用户可见问题 | 故障排查、发布说明 |
| 删除功能 | 删除旧说明，并检查站内链接与搜索结果 |

## 功能合并检查清单

- [ ] 说明用户能看到什么变化。
- [ ] 更新安装、配置或操作步骤。
- [ ] 更新截图或示例，删除已经失效的内容。
- [ ] 标明版本要求、兼容性和已知限制。
- [ ] 在本地运行 <code>pnpm docs:build</code>。
- [ ] 检查文档链接和 GitHub Pages 预览。

## 同步验证（RemoteCI 侧）

功能合并前，RemoteCI 应能通过仓库 CI 的同一组检查：

~~~powershell
dotnet build RemoteCI.slnx -c Release
dotnet test RemoteCI.slnx -c Release --no-build
cd wearos
.\gradlew.bat testDebugUnitTest assembleDebug
~~~

手表构建需要 JDK 17 与 Android SDK。RemoteCI 功能变更应关联本仓库对应文档改动，并在合并前完成 <code>pnpm docs:build</code> 验证。

::: important 仓库边界
RemoteCI 与 RemoteCI-Docs 是两个独立仓库。功能 PR 应关联对应的文档 PR；在 RemoteCI 主仓库尚未增加自动检查前，需要由维护者在代码评审中执行这项规则。
:::

## 本地编写

需要 Node.js 20 和 pnpm 9：

~~~powershell
corepack enable
corepack prepare pnpm@9.9.0 --activate
pnpm install
pnpm docs:dev
~~~

构建生产版本：

~~~powershell
pnpm docs:build
~~~

静态文件输出到 <code>src/.vuepress/dist</code>。

## 内容约定

- 文件名使用小写英文和连字符。
- 一个页面只解决一个主要任务。
- 命令必须可以直接复制，变量用明确的示例值。
- 不写未经源码或实际运行验证的功能。
- 尚未完成的能力标为“计划中”或“开发中”。
- 涉及密码、令牌和配对码时，示例只能使用占位值。

## 图标资源

页面和主题配置中的图标使用 Font Awesome 6 短名称，例如 <code>home</code> 或 <code>brands:github</code>。CSS 与字体在构建时由 <code>src/.vuepress/client.ts</code> 打包进站点，不依赖运行时 CDN；新增图标前请先在 Font Awesome 免费图标集中确认名称可用。
