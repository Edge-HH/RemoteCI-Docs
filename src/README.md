---
home: true
icon: home
title: 首页
heroImage: /logo.svg
heroImageStyle:
  maxWidth: 180px
heroText: RemoteCI 文档
tagline: 让 ClassIsland 的课表与 Wear OS 手表保持同步
actions:
  - text: 开始使用
    icon: rocket
    link: ./guide/getting-started
    type: primary
  - text: 部署服务端
    icon: server
    link: ./server/deployment
  - text: GitHub
    icon: brands:github
    link: https://github.com/Edge-HH/RemoteCI
features:
  - title: 课表随身查看
    icon: clock
    details: 在手表上查看当前课程、下一节课程、倒计时和七日课表。
  - title: 局域网优先
    icon: wifi
    details: 手表与教室电脑同网时优先直连插件，减少中转依赖。
  - title: 云端中转
    icon: cloud
    details: 跨网络时由自建服务端转发状态和操作，并提供账号与权限控制。
  - title: 双向控制
    icon: arrows-rotate
    details: 在获得权限后，从手表执行换课、调课或发送通知等操作。
  - title: 丰富控制
    icon: sliders
    details: 控制音量、电源、ClassIsland 主界面显隐，还能执行其他插件注册的扩展功能。
  - title: 自动更新
    icon: cloud-arrow-down
    details: WebUI 与手表端可从 GitHub 最新 release 一键检查并升级，插件由插件市场管理。
---

RemoteCI 是面向 ClassIsland 2.x 的课表手表联动项目，由 ClassIsland 插件、ASP.NET Core 服务端、Wear OS 客户端和共享通信协议组成。

当前稳定软件发布版本统一为 3.2.1.4，通信协议号为整数 3。稳定版使用 ClassIsland 要求的四段纯数字标签，Beta 使用 v3.x.x-beta.y 且不进入插件市场。协议号为 3 的组件可以互连，新功能是否显示由能力协商决定；V2/V4 与 V3 不能直接通信。部署到正式环境前，请先阅读[安全与运维建议](./server/operations.md)。

## 从这里开始

<div class="vp-card-container">
  <VPCard
    title="快速开始"
    desc="完成服务端、插件和手表端的首次连接。"
    link="./guide/getting-started.html"
  />
  <VPCard
    title="使用文档"
    desc="了解课程状态、七日课表、通知和远程操作。"
    link="./guide/features.html"
  />
  <VPCard
    title="服务端部署"
    desc="使用 Docker 部署，并配置数据持久化与 HTTPS。"
    link="./server/deployment.html"
  />
  <VPCard
    title="接入扩展"
    desc="把其他插件注册的自定义远程功能带到手表控制页。"
    link="./extensions/"
  />
  <VPCard
    title="开发与贡献"
    desc="了解仓库结构，以及功能与文档同步规则。"
    link="./development/docs-maintenance.html"
  />
</div>

## 适合哪些场景

- 希望在 Wear OS 手表上随时查看 ClassIsland 当前课程和下一节安排。
- 希望离开教室电脑后，仍能通过自建服务端查看课程状态。
- 需要按账号分配查看课表、管理课表、发送通知或管理用户的权限。
- 希望数据保留在自己的 NAS、服务器或局域网环境中。
- 希望通过扩展接口把更多课堂操作带到手表。

::: warning 当前状态
RemoteCI 3.2.1.4 已覆盖自动化构建与测试，但尚未完成真实 WebUI、ClassIsland 插件和 Wear OS 手表的端到端验收。本文档依据当前源码编写；若发布包与源码版本不一致，应以发布说明为准。
:::
