---
home: true
icon: home
title: 首页
heroImage: /logo.svg
heroImageStyle:
  maxWidth: 180px
heroText: RemoteCI 文档
tagline: 集控 · 教务 · 日程，一体化的 ClassIsland 管理平台
actions:
  - text: 开始使用
    icon: rocket
    link: ./guide/getting-started
    type: primary
  - text: 功能说明
    icon: book
    link: ./guide/features
  - text: 部署服务端
    icon: server
    link: ./server/deployment
  - text: GitHub
    icon: brands:github
    link: https://github.com/Edge-HH/RemoteCI
features:
  - title: 全校集控
    icon: tower-broadcast
    details: 按班级、分组或设备发送通知与语音，管理主界面、音量与电源，查看屏幕截图、分发文件、执行远程终端，并统一安装、升级与启用插件。
  - title: 教务管理
    icon: school
    details: 汇总各班课表与调课，处理老师发起的互换、替换与强制换课，维护学期、教学周、节假日调休与课时统计。
  - title: 班级档案
    icon: folder-tree
    details: 从教室收集、集中编辑并下发 ClassIsland 档案；保留历史版本，检查教室端与服务端的差异，支持模板和临时层。
  - title: 个人日程
    icon: calendar-days
    details: 按教师姓名聚合跨班课次，支持每周、单双周与多周轮换的自定义课程、课前提醒、系统日历与手机日历订阅。
  - title: 多端访问
    icon: mobile-screen
    details: 电脑 WebUI 负责完整管理；手机网页 / PWA、Android 与 Wear OS 提供课表、换课、控制与个人日程。
  - title: 自动化与告警
    icon: wand-magic-sparkles
    details: 按上课、下课、放学、定时或设备上线自动执行通知、音量、电源与临时层操作；离线告警、操作记录和课时台账可追溯。
  - title: 课堂策略与守护
    icon: shield-halved
    details: 按班下发 ClassIsland 限制策略，锁定档案、设置与调试入口；应用守护负责退出自启、崩溃重启与误删除恢复。
  - title: 开放接口
    icon: code
    details: API Key 与 REST API、AstrBot 聊天机器人、Agent Skill，以及其他 ClassIsland 插件注册的扩展功能与设置页。
---

RemoteCI 是面向 **ClassIsland 2.1 及以上**的课堂集控、教务与日程管理平台。它把散布在各教室的 ClassIsland 连接到一个自托管服务端：管理员维护班级、账号、档案与策略，教务和班主任处理课表、换课、学期与调休，老师查看跨班日程，学生查看本班课表。

系统由 ClassIsland 插件、ASP.NET Core 服务端、桌面与手机 WebUI、Android 与 Wear OS 应用组成，支持 Windows、Linux、Docker 与飞牛 fnOS 部署。**WebUI 是主要入口**；Android、Wear OS 与手机网页按需使用。

当前稳定版为 **3.3.2.1**，通信协议为整数 **3**。稳定版使用四段纯数字标签，Beta 使用 `v3.x.x-beta.y` 且不进入插件市场；协议号为 3 的组件可以互连，新功能是否显示由能力协商决定，V2/V4 与 V3 不能直接通信。部署到正式环境前，请先阅读[安全与运维建议](./server/operations.md)。

## 从这里开始

<div class="vp-card-container">
  <VPCard
    title="快速开始"
    desc="部署服务端、连接教室插件并建立第一个班级。"
    link="./guide/getting-started.html"
  />
  <VPCard
    title="功能说明"
    desc="了解课表、换课、档案、集控、统计与各端使用方式。"
    link="./guide/features.html"
  />
  <VPCard
    title="服务端部署"
    desc="使用 Docker、发布包或飞牛 fnOS 部署并配置 HTTPS。"
    link="./server/deployment.html"
  />
  <VPCard
    title="接入扩展"
    desc="把其他插件注册的远程功能与设置页带到 WebUI 和客户端。"
    link="./extensions/"
  />
  <VPCard
    title="开发与贡献"
    desc="了解系统架构，以及功能与文档同步规则。"
    link="./development/docs-maintenance.html"
  />
</div>

## 适合哪些场景

- 学校信息中心或教务处需要统一维护全校 ClassIsland、班级档案与教室电脑。
- 需要在网页上集中处理老师换课、学期开始日期、节假日调休与课时统计。
- 老师希望查看跨班级的个人日程、接收换课提醒，学生希望随时查看本班课表。
- 需要把通知、语音、电源、截图、插件升级等操作按角色和权限下放给班主任。
- 希望数据保留在自己的 NAS、服务器或局域网，并通过 API、聊天机器人或自建脚本扩展。
