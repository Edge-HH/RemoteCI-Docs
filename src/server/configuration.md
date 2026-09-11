---
title: 配置参考
icon: sliders
order: 2
---

# 配置参考

服务端使用 ASP.NET Core 标准配置系统。JSON 中的层级键可用双下划线转换为环境变量，例如 <code>Server:DatabasePath</code> 对应 <code>Server__DatabasePath</code>。

## 监听地址

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| <code>Urls</code> | <code>http://0.0.0.0:8080</code> | 服务端监听地址 |
| <code>ASPNETCORE_URLS</code> | 镜像内为 <code>http://0.0.0.0:8080</code> | 使用环境变量覆盖监听地址 |

## Server 配置

| JSON 键 | 环境变量 | 默认值 | 说明 |
| --- | --- | --- | --- |
| <code>Server:DatabasePath</code> | <code>Server__DatabasePath</code> | <code>data/remoteci.db</code> | SQLite 数据库路径 |
| <code>Server:BootstrapAdminUsername</code> | <code>Server__BootstrapAdminUsername</code> | <code>admin</code> | 首次启动创建的管理员用户名 |
| <code>Server:BootstrapAdminPassword</code> | <code>Server__BootstrapAdminPassword</code> | 自动生成 | 首次启动管理员密码 |
| <code>Server:BootstrapPluginPairCode</code> | <code>Server__BootstrapPluginPairCode</code> | 自动生成 | 首次启动插件配对码 |
| <code>Server:AccessTokenTtl</code> | <code>Server__AccessTokenTtl</code> | <code>01:00:00</code> | 短期访问令牌有效期 |
| <code>Server:DeviceSessionTtl</code> | <code>Server__DeviceSessionTtl</code> | <code>30.00:00:00</code> | 设备会话有效期 |
| <code>Server:ConnectionAuthorizationRefreshInterval</code> | <code>Server__ConnectionAuthorizationRefreshInterval</code> | <code>00:01:00</code> | 在线 WebSocket 持久化授权状态的兜底复查周期 |

另有两个优先级更高、便于容器首次启动的环境变量：

- <code>REMOTECI_ADMIN_PASSWORD</code>：首次管理员密码。
- <code>REMOTECI_PLUGIN_PAIR_CODE</code>：首次一次性插件配对码。

这些初始值只在数据库中没有对应数据时使用。修改已经运行过的容器环境变量，不会覆盖现有管理员密码或重新生成插件凭据。

WebSocket 在握手时完成一次完整数据库认证，后续高频状态消息使用连接内缓存身份。管理员吊销插件凭据、撤销设备会话、修改密码或调整账号权限时，服务端会主动断开或刷新对应连接；`ConnectionAuthorizationRefreshInterval` 仅用于处理外部数据库修改和主动通知遗漏，默认一分钟复查一次。设置过短会重新造成高频 SQLite 查询，生产环境通常不应低于默认值。

插件配对码在使用前持续有效，成功配对后立即作废。需要新配对码时，登录 WebUI 在概览页点击“生成插件配对码”。

## 时间格式

配置中的时长使用 .NET <code>TimeSpan</code> 格式：

- <code>01:00:00</code> 表示 1 小时。
- <code>30.00:00:00</code> 表示 30 天。

## 插件默认配置

插件设置保存在 ClassIsland 插件配置目录的 <code>Settings.json</code>，普通“RemoteCI 设置”界面可修改：

| 配置 | 默认值 |
| --- | --- |
| 局域网端口 | <code>8765</code> |
| 云端地址 | <code>http://localhost:8080</code> |
| 配对码 | 留空；配对时填写一次性配对码，成功后自动清空 |
| 显示开发者设置菜单 | 关闭；开启并重启 ClassIsland 后显示 |

保存服务器地址或端口后需要重启 ClassIsland 才会按新配置重新创建连接。新配对码保存后无需等待最长两分钟的自动退避，可点击“测试服务器连接”立即触发下一次配对和连接。

普通“RemoteCI 设置”页顶部会实时显示云端服务器状态，包括正在连接、已连接、等待配对和等待自动重试，并单独显示脱敏后的最近一次连接错误。点击“测试服务器连接”会验证当前真实 WebSocket 通道；断线时会跳过退避并执行配对、鉴权、能力上报和网络信息上报，因此不会把“健康检查网页可访问”误报成插件已经连通。完整异常仍写入 ClassIsland 日志，界面不会显示长期凭据。

WebSocket 握手明确返回 <code>401</code> 或 <code>403</code> 时，插件会清除被拒绝的长期凭据，并在已保存新配对码时于下一次重试重新配对。其他 HTTP 错误不会清除凭据。

插件每次建立云端 WebSocket 后都会上报当前局域网服务启用状态、监听端口和所有可用的非回环单播 IP。端口变更并重启 ClassIsland 后，新值会通过服务端自动同步到在线手表。

插件局域网服务还固定监听 UDP <code>48765</code> 作为设备发现端口。该端口只响应固定的 RemoteCI V3 扫描请求，并仅返回电脑名称和当前 WebSocket 端口；云服务器地址需要用户选中插件后再通过局域网 WebSocket <code>/bootstrap</code> 获取。

云端中转和局域网服务默认开启。“RemoteCI 开发者设置”菜单默认隐藏，可在普通设置中开启显示并重启 ClassIsland；该页提供两个连接开关和“测试接收语音”。语音测试会进入与远程消息相同的权限检查、格式校验、强调通知、自动播放、浮窗和事件广播流程。关闭云端后插件不会再向 WebUI 同步状态、账号和课表；关闭局域网服务后手表无法直连插件，通常只用于诊断网络。

## 手表端默认配置

连接设置：

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| ID（username） | 空 | 服务端创建的登录 ID |
| 云端地址 | <code>http://10.0.2.2:8080</code> | 仅 Android 模拟器默认可用，真机必须改为实际地址 |
| 启用局域网连接 | 是 | 仅在“设置 → 开发者”显示，开启时优先尝试局域网直连 |
| 局域网主机 | 空 | 自动接收插件 IP，也可手动指定电脑 IP 或主机名 |
| 局域网端口 | <code>8765</code> | 自动接收插件端口，也可在连接页手动修改 |

云端连接和局域网连接默认开启，普通“连接”页均不提供关闭开关。“设置 → 开发者”可分别关闭两种连接；密码登录仍会临时使用云端完成认证，避免退出账号后无法恢复登录。

通知开关（默认全部开启）：

| 开关 | 对应事件 |
| --- | --- |
| 上课 | 上课事件 |
| 课间 | 课间事件 |
| 放学 | 放学事件 |
| 课表变更 | 课表变更事件 |
| 自定义消息 | 自定义通知事件 |
| 自动化通知 | ClassIsland 自动化“显示提醒”事件 |
| 插件通知 | 第三方 ClassIsland 插件通知事件 |
