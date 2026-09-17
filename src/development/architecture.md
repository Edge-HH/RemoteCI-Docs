---
title: 项目架构
icon: diagram-project
order: 1
---

# 项目架构

RemoteCI 采用一个主项目仓库和一个独立文档仓库。当前稳定三端软件版本统一为 3.2.1.4，通信协议号独立为整数 3；稳定版使用 ClassIsland 要求的四段纯数字标签，Beta 保留 v3.x.x-beta.y 供测试且不进入插件市场。协议 v3 拆分主界面与电源权限，并增加独立扩展权限、逐扩展策略和能力协商。

## 运行组件

~~~text
ClassIsland 插件 ── 局域网 WebSocket（HMAC 挑战认证）── Wear OS
       │                                        │
       └──────────── 云端 WebSocket ────────────┘
                             │
                     RemoteCI 服务端
               账号 / 权限 / 状态 / 课表 / 命令中转
~~~

| 目录 | 技术 | 职责 |
| --- | --- | --- |
| <code>plugin</code> | .NET 8、ClassIsland Plugin SDK | 收集课表状态、提供局域网服务、执行远程命令、注册扩展、旁路观察通知 |
| <code>server</code> | ASP.NET Core 10、SQLite、WebSocket | 身份认证、权限检查、状态保存、消息中转与自动更新 |
| <code>wearos</code> | Kotlin、Compose for Wear OS（minSdk 30） | 展示课程、课表、通知与操作界面 |
| <code>android</code> | Kotlin / Jetpack Compose Material 3 Expressive 手机应用（minSdk 26）。 | 承接 WebUI 与手表的课表、控制和人员管理 |
| <code>shared</code> | C# 模型库 | 插件与服务端共享协议 v3 和数据模型 |

## 数据流

1. 插件从 ClassIsland 收集状态与七日课表，状态按秒推送，课表独立低频同步。
2. 插件把数据推送给局域网手表和云端服务端；服务端保存最近状态并转发给已认证手表。插件每次云端连接还会上报本机候选 IP、局域网端口与服务状态，服务端缓存并同步给手表用于自动直连。
3. 手表提交命令时，服务端先检查账号权限，再把命令转发给在线插件。
4. 插件执行后返回真实回执（成功、失败码、新修订号），服务端再把结果传回发起方，等待上限 15 秒。
5. 插件旁路观察 ClassIsland 统一通知入口，把自动化“显示提醒”和第三方插件通知转换为事件广播；其他插件注册的扩展功能清单通过 <code>extensions_sync</code> 同步给服务端和手表，WebUI 从服务端缓存渲染同一套控制入口。云端服务端与插件局域网服务都会缓存最近一次扩展清单，并在手表认证后补发。
6. 首次登录可用 UDP <code>48765</code> 扫描插件；选中后通过未登录的 <code>/bootstrap</code> WebSocket 仅读取云服务器地址。密码仍通过云端 HTTPS 登录，设备会话同步给插件后再进行局域网 HMAC 认证。

## 协议 v3 消息

所有 WebSocket 信封都带 <code>protocolVersion: 3</code>、<code>type</code>、<code>messageId</code> 与可选 <code>replyToMessageId</code>。软件版本不参与连接拒绝，协议号为 3 的端均可通信；协议号不是 3 才会被明确拒绝。主要类型：

| 类型 | 方向 | 用途 |
| --- | --- | --- |
| <code>auth_challenge</code> / <code>auth_proof</code> | 插件 ↔ 手表 | 局域网一次性 HMAC 挑战认证 |
| <code>account_sync</code> | 服务端 → 插件 | 账号、权限、设备验证器、服务端版本与可选服务端能力镜像 |
| <code>peer_capabilities</code> | 插件/手表 → 服务端 | 软件版本与稳定字符串能力列表 |
| <code>capabilities_sync</code> | 服务端/插件 → 手表 | 服务端与当前主插件的能力快照 |
| <code>state_push</code> | 插件 → 服务端/手表 | 高频当前课程状态 |
| <code>schedule_sync</code> | 插件 → 服务端/手表 | 未来七日课表 |
| <code>schedule_pull</code> | 服务端/手表 → 插件 | 请求插件立即重新生成并推送七日课表；不携带参数 |
| <code>extensions_sync</code> | 插件 → 服务端/手表 | 扩展功能清单；服务端同时供 WebUI 控制菜单读取 |
| <code>event_notify</code> | 插件 → 服务端/手表 | 上课、课间、放学、课表变更、自定义、自动化与插件通知事件 |
| <code>plugin_network_info</code> | 插件 → 服务端 → 手表 | 可用局域网 IP、监听端口与局域网服务状态；服务端缓存最近一次结果 |
| <code>connection_bootstrap</code> | 插件 → 手表 | 用户选中局域网插件后提供电脑名称与云服务器地址；不携带认证数据 |
| <code>command</code> / <code>command_result</code> | 手表/服务端 → 插件 | 换课、通知、清除提醒、主界面、电源、音量与扩展命令 |

命令编号：1 换课、2 发送通知、3 清除提醒、4 主界面显隐、5 电源、6 音量、7 运行扩展、8 老师来了、9 发送语音。`TeacherComing` 由插件一次性完成显示强调提醒、等待 1 秒和清除提醒。事件编号：1 上课、2 课间、3 放学、4 课表变更、5 自定义、6 自动化通知、7 第三方插件通知。

`SendVoiceMessage` 的 `voiceMessage` 包含固定格式 `format: pcm_s16le_16000_mono` 和标准 Base64 的 `audioBase64`；录音为 16 kHz、16 位小端单声道 PCM，最多 60 秒（1,920,000 字节）。WebUI 使用带防伪头的二进制上传，服务端转成同一命令；手表使用已认证的云端或局域网 WebSocket。传输接收上限为 16 MiB，以容纳 JSON 转义的最坏情况，音频解码后仍执行严格大小校验。各接入端覆盖发送人，插件只使用认证身份。语音不持久化、不离线排队，已有浮窗返回 `BUSY`。Windows 播放器使用 NAudio/WASAPI；Avalonia 浮窗复用宿主 `popup-bg`、`TransparentButton`、原生 Slider 和 `FluentIcon`，并在 Windows 上检测浮窗外的鼠标按下以实现不抢焦点的轻触关闭；通知开启强调，关闭提示音和朗读。

插件完成云端认证后，服务端立即发送一次 <code>schedule_pull</code>，以消除“插件启动时已生成课表、但 WebSocket 尚未连上”的竞态。已认证手表也可发出同一只读消息：云端由服务端转发，局域网由插件直接处理；该消息与换课命令分离，不需要也不会授予管理课表权限。

## 身份与权限

服务端使用 SQLite 持久化用户、PBKDF2 密码哈希、设备会话、插件凭据和一次性配对码。有效权限是位掩码：

| 值 | 权限 |
| --- | --- |
| 1 | 查看当前课程 |
| 2 | 概览 |
| 4 | 人员管理 |
| 8 | 发送与清除通知 |
| 16 | 换课 |
| 32 | 电源控制（含音量） |
| 64 | 老师来了 |
| 128 | 扩展功能 |
| 256 | 主界面 |
| 512 | 发送语音 |

管理员有效权限固定为 1023；普通用户固定含值 1，WebUI 课表查看和手动拉取只要求登录，值 16 保护换课与自动拉取设置，值 512 独立保护发送语音。访问令牌默认 1 小时，设备会话默认 30 天可续期；插件用一次性配对码换取长期凭据。扩展开放策略和个人手表展示偏好随授权镜像同步；镜像超过 24 小时未更新时，局域网直连只允许查看课程。

云端 WebSocket 只在握手时完整查询令牌，连接对象缓存插件凭据 ID、设备会话 ID、有效权限和访问令牌到期时间。普通 `state_push`、广播和命令转发不逐条访问 SQLite；凭据或设备会话吊销、改密、账号禁用和权限修改通过连接注册表主动失效，后台默认每分钟再做一次持久化授权兜底复查。

云端与局域网认证成功时，<code>auth_state.serverVersion</code> 都会携带当前 WebUI 软件版本；局域网值来自 <code>account_sync.serverVersion</code>。该版本用于诊断，不作为连接或手表更新上限。服务端和手表正式渠道只选择协议主版本相同的四段纯数字 Release，Beta 渠道额外选择 v3.x.x-beta.y，V4 需要协调升级。

WebUI 的有效能力是“服务端 ∩ 当前主插件”，手表的有效能力是“手表本地 ∩ 服务端 ∩ 当前主插件”。未上报能力的旧 V3 端回退到 V3 基础能力（该基线自 3.1.0 引入），未知能力安全忽略。当前主插件为最早接入的健康插件；主插件切换或能力变化时重新广播快照。能力只控制入口和转发兼容性，账号权限与扩展策略仍独立校验。

## 版本与构建

新增 `voice-message.send` 必须显式协商，不加入旧 V3 端默认获得的基础能力。新端使用当前能力列表通告语音支持；界面能力与独立的发送语音权限同时满足才显示入口。

- 插件 3.2.1.4：net8.0，兼容 ClassIsland 2.x 宿主；插件程序集为 AnyCPU，可随 ClassIsland 的 x86、x64 与 arm64 Windows 宿主一起加载，因此不得设置 x64 等平台专用目标。CIPX 由 <code>CreateCipx=true</code> 生成，市场资产固定为 <code>RemoteCI.Plugin.cipx</code>。
- 插件读写宿主成员时区分两类 API：签名稳定的接口直接编译绑定；ClassIsland 2.2 预览版（2.1.1.x）改过签名的成员（<code>Profile.Subjects</code>、<code>Profile.ClassPlans</code>、<code>FluentIcon.Glyph</code>、窗口装饰枚举、动态资源绑定的 <code>Bind</code> 重载）统一经 <code>HostApiCompat</code> 反射访问，避免同一份包在旧宿主可用、在新宿主抛 <code>MissingMethodException</code>。注意同名重载差异（如 <code>Bind(AvaloniaProperty, IBinding)</code> 变为 <code>Bind(AvaloniaProperty, BindingBase)</code>）无法靠编译期检查发现，新增宿主调用后需按目标版本的签名实际核对。
- 服务端 3.2.1.4：net10.0，发布 linux-x64 / win-x64 平台包。
- 手表 3.2.1.4：minSdk 30 / targetSdk 37，Release APK 使用签名密钥构建。
- Wear OS 源码若位于云盘或 NAS 按需同步目录，可在不入库的 <code>wearos/local.properties</code> 中设置 <code>remoteci.buildDir=C:/本地目录</code>，将 Gradle 生成文件放到普通本地磁盘，避免重解析占位文件触发 <code>Cannot snapshot ... not a regular file</code>；也支持环境变量 <code>REMOTECI_WEAROS_BUILD_DIR</code> 和命令行属性 <code>-Premoteci.buildDir</code>。

## 开发状态

3.2.1.4 已完成独立“老师来了”指令与权限、WebUI 控制页、V3 协议和三端能力协商，并修复 ClassIsland x86/arm64 宿主的程序集架构加载与 2.2 预览版宿主 API 兼容问题。发布前仍应使用稳定四段版本和 Beta 版本在真机完成端到端验收，见[开发状态](../guide/status.md)。
