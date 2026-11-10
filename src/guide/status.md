---
title: 项目状态
icon: circle-info
order: 6
---

# 项目状态

RemoteCI 当前稳定版为 **3.3.2.1**（2026-11-08），通信协议号为整数 **3**。软件版本与协议版本独立：协议号为 3 的服务端、插件、WebUI、Android 与 Wear OS 可以互连，新功能是否显示由能力协商决定；V2/V4 与 V3 不能直接通信。

## 组件与要求

| 组件 | 版本 / 要求 | 说明 |
| --- | --- | --- |
| 服务端 | .NET 10、ASP.NET Core 10、SQLite | 发布 linux-x64、linux-arm64、win-x64 压缩包，也提供 Docker 镜像与国产 NAS / fnOS FPK |
| ClassIsland 插件 | net8.0；ClassIsland 2.1.0 及以上 | 以 ClassIsland Plugin SDK 2.1.0.1 编译，AnyCPU，可随 x86 / x64 / arm64 宿主加载 |
| 桌面 WebUI | 浏览器 | 主要管理入口：班级、档案、课表、集控、权限、统计与系统设置 |
| 手机网页 / PWA | 现代浏览器；iOS / iPadOS 16.4+ | 与桌面 WebUI 共用服务端，无需安装应用 |
| Android | Android 8.0（API 26）及以上 | 原生课表、控制、小组件、上课状态通知与系统日历 |
| Wear OS | Wear OS 3（API 30）及以上 | 课表、状态、通知与授权控制；功能更新可能滞后于 WebUI 与 Android |
| AstrBot 插件 | AstrBot 4.26 及以上 | 独立仓库 `astrbot_plugin_remoteci`，仍在开发中 |

## 当前能力

- **集控**：通知与语音、主界面、音量、电源、屏幕截图、文件分发、远程终端、插件市场与 CIPX 安装、ClassIsland 与插件升级、加入 ClassIsland 集控、班级策略、ClassIsland 设置远程读写、应用守护。
- **教务**：基础课表与调课记录、直接换课与永久换课、老师换课申请与审批、强制换课与撤回、学期与教学周、节假日与调休、课时统计、档案库与班级档案、科目教师与地点。
- **日程**：老师按姓名绑定任教班级、跨班“我的日程”、每周 / 单双周 / 多周轮换的自定义课程、课前与上课提醒、系统日历与网页日历订阅。
- **运维**：设备状态与离线告警、自动化规则、操作记录、档案版本历史与设备差异、电子班牌。
- **账号与安全**：角色默认权限 + 个人新增 / 收回、班级权限与系统管理权限分离、TOTP 二步验证、可撤销设备会话、API Key、插件长期凭据。
- **开放接口**：REST API、AstrBot、Agent Skill，以及其他 ClassIsland 插件注册的扩展功能与设置页。

## 发布与更新

稳定版使用四段纯数字标签（例如 <code>3.3.2.1</code>），Beta 使用 <code>v3.x.x-beta.y</code> 且不进入插件市场。推送标签会触发 Release 工作流，产物包括：

- 服务端：<code>RemoteCI.Server-版本-linux-x64.zip</code>、<code>linux-arm64</code>、<code>win-x64</code> 压缩包及 SHA-256 校验文件。
- 插件：固定资产名 <code>RemoteCI.Plugin.cipx</code> 与 <code>checksums.md</code>，正文携带同名文件的 <code>CLASSISLAND_PKG_MD5</code> 标记。
- Android：<code>RemoteCI.Mobile-版本.apk</code>；Wear OS：<code>RemoteCI.Watch-版本.apk</code>。APK 使用发布签名。
- 飞牛 fnOS：在线多架构 FPK、x86_64 与 ARM64 离线 FPK，以及 <code>ghcr.io/edge-hh/remoteci</code> 多架构镜像。

服务端与 Android / Wear OS 可在应用内选择正式版或 Beta 渠道；插件由 ClassIsland 插件市场或 WebUI 批量升级；飞牛可在 WebUI 自更新，或从应用中心安装新 FPK。正式渠道只选择与当前协议主版本相同的四段发布，Beta 渠道额外包含预发布版本。

## 持续集成

仓库的 GitHub Actions 当前包含：

- **dotnet**：构建并测试服务端、插件与共享协议库，校验市场包与发布标签解析。
- **wearos**：`./gradlew :app:assembleDebug :app:testDebugUnitTest`。
- **android-mobile**：`./gradlew :app:assembleDebug :app:testDebugUnitTest`。
- **container**：构建镜像并验证自更新入口。
- **fnos fpk**：打包三种 FPK 并校验结构与离线镜像导入流程。

## 已知限制

- Wear OS 端的功能更新可能慢于 WebUI 与 Android；不同端的入口与能力以实际发布版本为准。
- iOS / iPadOS 通过手机网页与主屏幕 PWA 使用，没有原生客户端；不提供 watchOS 客户端。
- 不提供面向公网的托管服务，账号、课表与档案都由部署者自行保存。
- 应用守护用于减少误退出与误删除，不是不可绕过的防篡改机制；通过 Microsoft Store（MSIX）安装的 ClassIsland 不支持“禁止删除”，其余守护功能照常生效。
- 屏幕截图默认保留 24 小时、每班最多 30 张；配置备份不包含截图。
- 课时台账从启用后开始累积，服务端停机期间结束的课无法补录。

## 相关页面

- [项目架构](../development/architecture.md)：运行组件、数据流、协议与权限模型。
- [功能说明](features.md)：当前全部用户功能。
- [文档同步规则](../development/docs-maintenance.md)：功能变更时的文档同步要求。
