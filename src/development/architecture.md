---
title: 项目架构
icon: diagram-project
order: 1
---

# 项目架构

RemoteCI 采用一个主项目仓库和一个独立文档仓库。当前稳定软件版本为 **3.3.2.1**，通信协议号独立为整数 **3**：软件版本只用于更新与诊断，协议号为 3 的端可以互连，新功能是否可用由能力协商决定。破坏既有字段或命令语义的变更必须升级到 V4。

## 运行组件

~~~text
教室电脑：ClassIsland + RemoteCI 插件
       │ 云端 WebSocket（HTTPS/WSS）           │ 局域网 WebSocket（HMAC 挑战）
       ▼                                       ▼
                RemoteCI 服务端
      账号 / 权限 / 课表 / 档案 / 集控 / 命令中转
       ├─ 桌面 WebUI（Razor Pages）
       ├─ 手机网页 / PWA
       ├─ Android 手机
       ├─ Wear OS 手表
       ├─ API Key / AstrBot / Agent Skill
       └─ Docker / Windows / Linux / 飞牛 fnOS
~~~

| 目录 | 技术 | 职责 |
| --- | --- | --- |
| <code>plugin</code> | .NET 8、ClassIsland Plugin SDK 2.1.0.1 | 收集课表与课堂状态、提供局域网 WebSocket、执行远程命令、注册扩展、旁路观察通知、部署应用守护 |
| <code>server</code> | ASP.NET Core 10、Razor Pages、SQLite / EF Core、WebSocket | 账号与权限、课表与档案、集控与运维、REST API、桌面与手机 WebUI、自动更新 |
| <code>shared</code> | .NET 标准库 | 协议 V3 常量、能力标识与共享模型，供插件与服务端引用 |
| <code>android</code> | Kotlin / Jetpack Compose，minSdk 26 | 原生手机课表、换课、控制、小组件、上课状态通知与系统日历 |
| <code>wearos</code> | Kotlin / Compose for Wear OS，minSdk 30 | 课表、状态、通知与授权控制 |
| <code>fnos</code> | fnOS FPK 工程与脚本 | 在线 / 离线 FPK、Docker 镜像与生命周期脚本 |

WebUI 与手机网页由服务端直接渲染；Android 与 Wear OS 通过 REST 与 WebSocket 连接服务端，局域网时可直接连接插件。

## 数据流

1. 插件从 ClassIsland 收集当前课堂状态与课表；状态按秒通过 <code>state_push</code> 推送，课表通过 <code>schedule_sync</code> 低频同步（新版插件提供今天起 30 天，旧版为 7 天）。
2. 服务端保存最近状态与课表并转发给已认证客户端；插件每次连接云端都会上报本机候选 IP、局域网端口与服务状态，服务端缓存后供手机与手表自动直连。
3. 客户端提交命令时，服务端先检查账号在目标班级的有效权限与插件能力，再把命令转发给在线插件；插件返回真实回执（成功、错误码、新修订号），等待上限 15 秒。
4. 调课统一由服务端“调课记录”管理：插件按“基础课表 + 调课集合 + 调休”生成托管临时层，并在课表同步时回报每条调课是否生效。WebUI、手机、手表和教室大屏因此看到同一份生效课表。
5. 档案以服务端为源：可上传、从设备收集（命令 26）、编辑并保存，再按明确模式下发（命令 25）。服务端保留版本历史与设备差异，设备本地修改不会自动回写。
6. 班级策略（命令 36）与 ClassIsland 设置（命令 37 / 38）只能由服务端专用入口构造；策略会持久化在教室端，离线启动仍生效。
7. 集控运维在服务端实现：操作记录、设备状态与离线告警、自动化规则、课时台账、个人课程提醒、Web Push、学期与调休、电子班牌。
8. 服务端可自更新；插件由 ClassIsland 插件市场或 WebUI 批量升级；Android 与 Wear OS 在应用内检查更新；飞牛从应用中心手动升级。

## 协议 V3 消息

所有 WebSocket 信封都带 <code>protocolVersion: 3</code>、<code>type</code>、<code>messageId</code> 与可选 <code>replyToMessageId</code>。主要类型：

| 类型 | 方向 | 用途 |
| --- | --- | --- |
| <code>auth_challenge</code> / <code>auth_proof</code> | 插件 ↔ 客户端 | 局域网一次性 HMAC 挑战认证 |
| <code>account_sync</code> | 服务端 → 插件 | 账号、权限、设备验证器、服务端版本与能力镜像 |
| <code>peer_capabilities</code> / <code>capabilities_sync</code> | 双向 | 软件版本与稳定能力列表；服务端按每个可访问班级的主插件下发 |
| <code>state_push</code> | 插件 → 服务端 / 客户端 | 高频课堂状态 |
| <code>schedule_sync</code> | 插件 → 服务端 / 客户端 | 今天起 30 天课表（旧版插件 7 天） |
| <code>schedule_pull</code> / <code>schedule_sync_status</code> | 服务端 / 客户端 → 插件 | 请求重新生成课表并显示任务状态 |
| <code>schedule_adjustments</code> | 服务端 → 插件 | 调课集合；插件据此维护托管临时层并回报送达状态 |
| <code>event_notify</code> | 插件 → 服务端 / 客户端 | 上课、课间、放学、课表变更、自定义、自动化与第三方插件通知 |
| <code>extensions_sync</code> / <code>extension_groups_sync</code> | 插件 → 服务端 | 扩展功能清单；扩展分组、设置字段与当前值 |
| <code>settings_sync</code> | 服务端 ↔ 客户端 | 通知发送人等全局设置 |
| <code>software_inventory</code> | 插件 → 服务端 | 设备、ClassIsland 与插件版本清单及最近升级状态 |
| <code>plugin_network_info</code> / <code>connection_bootstrap</code> | 插件 → 服务端 / 客户端 | 局域网候选地址、端口、服务状态与首次登录引导 |
| <code>user_notify</code> | 服务端 → 客户端 | 个人通知、换课提醒、设备告警等 |
| <code>holiday_calendar</code> / <code>semester</code> | 服务端 → 插件 | 放假与调休安排、学期开始日期与教学周 |
| <code>file_transfer_progress</code> | 插件 → 服务端 | 大文件分发进度与结果 |
| <code>app_guard_policy</code> / <code>app_guard_event</code> | 服务端 ↔ 插件 | 应用守护策略与守护事件 |
| <code>class_policy</code> | 服务端 → 插件 | 班级策略；插件持久化并应用到 ClassIsland |
| <code>command</code> / <code>command_result</code> | 客户端 / 服务端 → 插件 | 换课、通知、控制、维护、档案、截图、策略与设置命令 |

### 命令编号

1 换课、2 发送通知、3 清除提醒、4 主界面显隐、5 电源、6 音量、7 运行扩展、8 “老师来了”（旧客户端兼容）、9 发送语音、10 升级插件、11 升级 ClassIsland、12 刷新软件版本清单、13 安装插件、14 卸载插件、15 启用 / 禁用插件、16 设置插件管理策略、17 分发档案、18 更新时间表、19 加入集控、20 仅重启 ClassIsland、21 设置科目教师、22 远程终端、23 文件分发（内联）、24 修改扩展插件设置、25 `ApplyProfile`、26 `ReadProfile`、27 屏幕截图、28 由守护启动 ClassIsland、29 / 30 上传 / 获取主界面文件、31 安装服务端中转的 `.cipx` 插件包、32 / 33 / 34 停用 / 卸载 / 更新设备守护、35 设置科目地点、36 设置班级策略、37 / 38 读取 / 修改 ClassIsland 设置。

命令 24–27、31–34、36–38 属于服务端专用命令：通用 `POST /api/commands`、手机 / 手表命令通道和插件局域网直连一律拒绝，只能由对应的 WebUI 页面或专用接口发起。事件编号：1 上课、2 课间、3 放学、4 课表变更、5 自定义、6 自动化通知、7 第三方插件通知。

### 能力协商

插件、Android 与 Wear OS 在连接时上报软件版本与稳定能力标识。WebUI 按“服务端 ∩ 当前主插件”显示功能；手机与手表还会与自身能力再取交集。未上报能力的旧 V3 端按 V3 基础能力处理（基线自 3.1.0 引入），未知能力安全忽略。当前主插件为最早接入的健康插件，主插件切换或能力变化时重新广播快照。能力只控制入口与转发兼容性，权限仍独立校验。

## 身份与权限

账号、设备会话、插件凭据与 API Key 保存在 SQLite。密码使用 ASP.NET Core Identity 的哈希；支持 TOTP 二步验证与恢复码。有效权限分为两套位掩码：

- **班级权限**（`UserPermissions`）：按账号在各班级的班内角色（任教班级按“老师”角色）计算，控制课表、通知、教室电脑、ClassIsland 与插件、班级信息等班级内操作。值 1 起，权限细化后新增了 `RequestScheduleSwap`、`ForceScheduleSwap`、`SendFiles`、`CaptureScreen`、`ManageClassProfile`、`PullSchedule`、`ClearNotifications`、`VolumeControl`、`MainWindowLayout`、`RemoteTerminal`、`ControlClassIsland`、`ConfigureExtensions`、`ManagePlugins`、`UpgradeSoftware`、`ManageDeviceGuard`、`ManageClassInfo`、`ManageClassBoards`、`ViewAuditLog`、`ViewLessonStats` 等独立位。
- **系统管理权限**（`ManagementPermissions`）：只按账号的全局角色计算，控制角色配置、人员导入、班级管理、档案库、学期与调休、设备状态、批量控制、自动化、应用守护、插件控制、登录页与访客、插件凭据、全部操作记录与课时统计。

每个角色有一组默认权限；账号的个人权限记录为相对角色的新增（`granted`）与收回（`revoked`），有效权限 = 角色默认 + 新增 − 收回，`ViewCurrentCourse` 不能收回。管理员固定拥有全部权限。老师角色按用户名（显示名）与课表科目教师名动态绑定任教班级，不写入数据库。API Key 不复制权限快照，每次请求都按账号当前角色与调整重新计算；吊销密钥、禁用账号或移除“API 访问”权限后立即失效。

插件与各客户端通过授权镜像获得账号权限与扩展策略；局域网授权镜像超过 24 小时未更新时，只允许查看课程，拒绝管理命令。WebSocket 只在握手时完整查询持久化状态，后续状态推送复用连接内身份；凭据吊销、设备会话撤销、改密或权限变化时主动刷新或断开连接，并每分钟做一次数据库兜底复查。

完整的权限位数值、命令权限映射与错误码见[通信协议](https://github.com/Edge-HH/RemoteCI/blob/main/docs/protocol.md#身份与权限)。

## 关键子系统

### 课表与调课

基础课表来自 ClassIsland 档案；单日调整写成调课记录，记录 `fromSubjectId` 作为守卫。换课申请、直接换课、教室端 ClassIsland 修改与升级回填都汇总到同一份调课记录。插件按“基础课表 + 调课 + 调休”生成托管临时层，可随时重建；基础课表变化导致守卫对不上时，调课标记为失效并通知相关老师。永久换课写入 ClassIsland 源课表，本周及以后每周生效。

### 档案库

SQLite / EF Core 保存完整 ClassIsland JSON、名称、修订号、来源模板与更新时间，每班至多一份工作副本。全局模板仅系统管理员或拥有“档案库”系统权限的账号可管理；班级档案需要本班的“本班档案”权限。服务端不依赖 ClassIsland UI 程序集，按 JSON 节点编辑并保留未知字段与附加配置。保存与下发分离，下发必须明确选择更新当前档案、整体替换类别、创建并启用新档案或作为临时层。历史版本每份保留最近 50 个，设备差异检查比较时间表、课表与科目（不含临时层）。

### 集控、策略与设置

班级策略把原版 ClassIsland 集控的限制项与 RemoteCI 自己的“禁止插件设置”“允许修改连接信息”“允许打开插件设置页”下发到教室端；插件写入 `ManagementPolicy` 并持久化。ClassIsland 设置通过目录白名单读取与部分更新，只提交用户修改过的项。插件管理支持浏览市场、上传 CIPX、服务端预下载、安装 / 卸载 / 启停与批量升级。应用守护由独立进程 `RemoteCI.Guard.exe` 执行，使用同一设备凭据建立独立云端通道，负责退出自启、崩溃重启、开机启动、备份与误删除恢复。

### 教务与运维

服务端自动拉取 holiday-cn 的法定节假日与调休安排，并下发到插件；学期开始日期统一各端教学周与多周轮换。换课申请支持冲突确认、审批、强制、撤回与失效通知。课时台账在每节课结束后记录实际上课老师，换课产生的临时任课老师记为代课。操作记录、设备状态、离线告警、自动化规则与电子班牌均在服务端实现，不需要升级插件。

### 多端与推送

WebUI、手机网页、Android 与 Wear OS 共用同一套账号、权限与课表数据。浏览器推送使用 Web Push（VAPID），服务端持久化投递队列并支持重试与失效订阅清理；Android 使用系统通知与小组件；Wear OS 通过云端或局域网接收事件。手机与手表可优先局域网直连插件，失败时回退云端；局域网认证使用一次性 HMAC 挑战，不发送密码或云端令牌。

## 版本与构建

- **插件**：net8.0，以 <code>ClassIsland.PluginSdk</code> 2.1.0.1 编译（manifest <code>apiVersion: 2.1.0.0</code>），最低支持 ClassIsland 2.1.0；程序集为 AnyCPU，可随 x86、x64 与 arm64 宿主加载。CIPX 由 <code>CreateCipx=true</code> 生成，市场资产固定为 <code>RemoteCI.Plugin.cipx</code>。
- **服务端**：net10.0，发布 linux-x64、linux-arm64 与 win-x64 平台包；Docker 镜像与 fnOS FPK 由 Release 工作流构建。
- **Android**：minSdk 26 / targetSdk 37；**Wear OS**：minSdk 30 / targetSdk 37；Release APK 使用签名密钥构建。
- **文档站**：VuePress 2 + Theme Hope，源文件在独立仓库 `RemoteCI-Docs`。

常用本地命令：

~~~powershell
dotnet build RemoteCI.slnx -c Release
dotnet test RemoteCI.slnx -c Release --no-build

cd android
.\gradlew.bat testDebugUnitTest assembleDebug

cd ../wearos
.\gradlew.bat testDebugUnitTest assembleDebug
~~~

稳定发布使用四段纯数字标签（例如 <code>3.3.2.1</code>），Beta 使用 <code>v3.x.x-beta.y</code>。Release 产物包括三平台服务端包、插件 CIPX、Android 与 Wear OS APK、三种 fnOS FPK 与多架构 GHCR 镜像。

## 相关文档

- [通信协议 V3](https://github.com/Edge-HH/RemoteCI/blob/main/docs/protocol.md)：消息、命令、权限位与能力标识。
- [服务端部署](../server/deployment.md) · [配置参考](../server/configuration.md) · [运维与安全](../server/operations.md)
- [功能说明](../guide/features.md) · [应用守护](../guide/app-guard.md)
- [接入扩展](../extensions/index.md)
