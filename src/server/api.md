---
title: API 接口
icon: code
order: 5
---

# API 接口

RemoteCI 提供面向账号的 REST API。API 复用 WebUI、手表和手机客户端正在使用的 `/api/*` 端点，不另建一套重复路由；API Key 只是账号的一种长期凭据，权限始终按账号当前角色与附加权限实时计算。

## 启用 API 访问

“API 访问”是独立的账号权限位：

- 管理员默认拥有全部权限，因此默认可使用 API。
- 班主任和老师默认包含“API 访问”，因此默认可使用 API。
- 学生默认没有“API 访问”。
- 管理员可在“人员权限 → 角色配置”调整角色默认权限，或在“人员权限 → 编辑账号 → 附加权限”为单个账号开启。

有权限的账号可在“个人账号 → API Key”自行创建和吊销密钥；系统管理员或拥有“人员管理”权限的账号也可在“人员权限 → 编辑账号 → API Key”为其他账号代管。密钥明文只在创建时显示一次，服务端只保存 SHA-256 摘要，数据库中无法恢复完整密钥。

移除“API 访问”权限、禁用账号或吊销密钥后，已签发的 API Key 会立即失效。修改密码不会自动吊销 API Key；如怀疑密钥泄露，应单独吊销。

## 认证方式

推荐使用标准 Bearer 头：

~~~http
Authorization: Bearer rci_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
~~~

部分脚本客户端也可以使用：

~~~http
X-API-Key: rci_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
~~~

API Key 固定以 `rci_` 开头。不要把密钥放进 URL 查询参数、浏览器前端代码、截图或公开日志；生产环境必须使用 HTTPS。

以下端点属于设备登录会话，不接受 API Key：

- `POST /api/auth/login`
- `POST /api/auth/mobile-login`（凭 WebUI 概览页生成的一次性扫码票据换取设备会话）
- `POST /api/auth/web-ticket`（需设备会话 Bearer 令牌，API Key 不可用；返回 `{ ticket, path, expiresAt }`。用浏览器打开 `服务器地址 + path`，可追加 `&returnUrl=/Control`（仅限本站路径）和 `&classId=<班级 Id>`，即以该账号登录 WebUI。票据 1 分钟内有效、只能成功兑换一次，签发新票据会作废同一账号的旧票据；服务端只保存票据摘要并持久化在数据库中，服务重启或多实例共享数据库时仍可兑换；账号被停用、锁定或改密后票据立即失效。票据会出现在浏览器地址栏，生产环境请务必使用 HTTPS）
- `POST /api/auth/refresh`
- `POST /api/auth/setup-password`
- `POST /api/auth/logout`
- `GET /api/me/sessions`
- `POST /api/me/password`
- `POST /api/me/display-name`
- `DELETE /api/me/sessions/{id}`

## 通用约定

- Base URL 示例：`https://remoteci.example.com`
- 请求和响应默认使用 JSON，字段名为 camelCase。
- 权限不足返回 `403 FORBIDDEN`；密钥无效、被吊销、已过期、账号被禁用或账号已失去“API 访问”权限时返回 `401 UNAUTHORIZED`。
- 错误响应格式：

~~~json
{
  "code": "FORBIDDEN",
  "message": "权限不足"
}
~~~

常用状态码：

| 状态码 | 含义 |
| --- | --- |
| `200` | 查询或命令执行成功 |
| `204` | 操作成功且无响应体 |
| `400` | 请求字段缺失或格式错误 |
| `401` | API Key 无效、过期或账号不可用 |
| `403` | 账号缺少所需权限，或不能访问目标班级 |
| `404` | 目标资源或状态不存在 |
| `409` | 资源冲突，例如重名、最后管理员保护或课表修订冲突 |
| `422` | 命令已被接受但执行失败 |
| `503` | 目标插件离线 |
| `504` | 等待插件回执超时 |

## 账号与课程信息

### 获取当前账号

~~~http
GET /api/me
~~~

返回账号 ID、用户名、显示名、角色、有效权限和可访问班级。该接口只需要有效 API Key。

### 获取可访问班级

~~~http
GET /api/me/classes
~~~

返回当前账号可访问的班级列表。普通账号只返回自己加入的班级；老师账号还包含按用户名关联到的任教班级；管理员返回全部班级。

### 获取我的日程

~~~http
GET /api/me/schedule
~~~

只对“老师”和“班主任”角色生效：按账号的用户名匹配各班课表中的教师名，返回跨班级聚合的日程 `{ fromDate, generatedAt, days[] }`；每天的 `items[]` 按班级分组，包含 `classId`、`className` 和按节次排序的 `courses[]`。其他角色的账号或没有匹配课程时 `days` 为空数组。

### 获取下一节课

~~~http
GET /api/me/schedule/next?at={ISO 8601 时间}
~~~

返回老师或班主任在指定时刻正在上的课 `current` 和接下来的第一节课 `next`，没有时省略对应字段；`at` 可省略，默认取服务端当前时间。

~~~json
{
  "at": "2026-09-29T07:30:00+08:00",
  "next": {
    "date": "2026-09-29",
    "classId": "33333333-3333-3333-3333-333333333333",
    "className": "高一(3)班",
    "course": { "index": 0, "label": "第 1 节", "subject": "数学", "startTime": "08:00", "endTime": "08:45", "teacher": "王老师", "enabled": true },
    "startsAt": "2026-09-29T08:00:00+08:00",
    "endsAt": "2026-09-29T08:45:00+08:00"
  }
}
~~~

`course.startTime`/`endTime` 是教室电脑的本地钟点；`startsAt`/`endsAt` 是按该班教室电脑时区换算出的绝对时间。

### 换课申请与个人通知

老师需要全局权限位 4096（老师主动换课）；强制换课还需要 8192。两者都在 `GET /api/me` 的 `permissions` 中。所有请求都使用 `Authorization: Bearer`，也接受 API Key。

| 方法与路径 | 说明 |
| --- | --- |
| `GET /api/swap-requests/catalog` | 所有班级七日课表（已叠加临时任课老师，`mine` 标出自己的课）与本人任教学科 `mySubjects` |
| `POST /api/swap-requests` | 发起申请：`{mode, source?, target, subjectName?, reason, force}` |
| `GET /api/swap-requests?box=incoming\|outgoing\|all&status=` | 发给我的、我发起的，或两者 |
| `GET /api/swap-requests/{id}` | 单条详情 |
| `POST /api/swap-requests/{id}/approve` | 通过，可带 `{note}`；立即下发临时换课 |
| `POST /api/swap-requests/{id}/reject` | 拒绝，可带 `{note}` |
| `POST /api/swap-requests/{id}/cancel` | 申请人撤销待审批申请 |
| `POST /api/swap-requests/{id}/revoke` | 对方老师撤回强制换课 |
| `GET /api/me/notifications?after=&unread=true` | 个人通知列表 |
| `POST /api/me/notifications/read` | 标记已读：`{ids:[…]}` 或 `{all:true}` |

- **`mode`**：`1` 互换，`source`、`target` 各是一节课 `{classId, date, index}`；`2` 替换，只填 `target` 与 `subjectName`。
- **`{id}`**：也接受响应中的 8 位 `shortId`。
- **`status`**：`1` 待审批、`2` 已通过、`3` 已拒绝、`4` 已撤销、`5` 已过期、`6` 已强制、`7` 已撤回。
- **错误码**：`SWAP_NOT_OWN`（两节都不是自己的课）、`SWAP_SUBJECT_MISSING`（目标班没有该学科）、`SWAP_SLOT_CHANGED`（课位已被调整）、`SWAP_STATE_CONFLICT`（申请已被处理）、`SWAP_FORCE_LOCKED`（当天这节课的强制换课已被撤回）。

发起互换申请的示例：

```bash
curl -X POST "$REMOTECI_BASE_URL/api/swap-requests"   -H "Authorization: Bearer $REMOTECI_API_KEY" -H "Content-Type: application/json"   -d '{"mode":1,"source":{"classId":"<班级ID>","date":"2026-10-06","index":2},"target":{"classId":"<班级ID>","date":"2026-10-07","index":1},"reason":"外出教研"}'
```

### 在 AI Agent 中使用 RemoteCI

RemoteCI 仓库的 `skills/remoteci` 是一个 Agent Skill。它让 AI 助手以你自己的账号调用上述 REST API，能做的事完全由账号权限决定。

| 角色 | 典型用法 |
| --- | --- |
| 学生 | 查看所在班级的当前课程和未来七日课表 |
| 老师 | 问“下节课去哪上什么”，查看跨班级的“我的日程”；向任教班级发送通知、语音；发起、审批、拒绝换课申请，撤回被强制换走的课 |
| 班主任 | 在本班发送通知、换课、设置科目教师、运行扩展、修改班级名称和头像；和老师一样查看“我的日程”、问“下节课去哪上什么” |
| 系统管理员 | 以上全部；另外可以创建、改名、删除班级，管理分组、账号和班级成员分配，生成插件配对码，以及对多个班级或分组集控广播 |

使用方法：

1. 把 `skills/remoteci` 目录复制到 Agent 的技能目录，例如 `~/.claude/skills/`。
2. 直接提问，例如“下节课去哪”“给高一年级发个通知”“新建高一(4)班并把这些学生加进去”。Agent 会先询问服务器地址和登录方式。

登录方式有两种：

- **API Key**：在“个人账号 → API Key”创建，适合长期使用；学生默认没有“API 访问”权限，需要管理员开启。
- **账号密码**：任何角色都可用。Agent 通过 `POST /api/auth/login` 换取 1 小时访问令牌，并在任务结束时退出这次会话。

也可以预先设置环境变量，免去询问：

- `REMOTECI_BASE_URL`：服务器地址。
- `REMOTECI_API_KEY`：API Key；或改用 `REMOTECI_USERNAME` 加 `REMOTECI_PASSWORD`。

电源、重启、远程终端、文件分发、删除和全校广播等高影响操作，Agent 会先复述目标和内容，经你确认后才执行。

想在 QQ、Telegram 等聊天平台里使用同样的能力，并让老师收到日程和换课的主动提醒，见 [RemoteCI AstrbotConnector](../extensions/astrbot.md)（开发中）。

### 修改用户名

~~~http
POST /api/me/display-name
~~~

请求体 `{ "displayName": "张三" }`（1-40 个字符），成功返回 `204`。只有系统管理员可以调用，且必须使用设备登录会话，不接受 API Key。

### 获取当前课程状态

~~~http
GET /api/state?classId={classId}
~~~

`classId` 可省略，此时服务端使用默认班级或账号的第一个可访问班级。账号必须能访问目标班级，否则返回 `403`。

### 获取七日课表

~~~http
GET /api/schedule?classId={classId}
~~~

返回目标班级最近一次同步的课表。尚未收到课表时返回 `404`。

### 获取扩展功能

~~~http
GET /api/extensions?classId={classId}
~~~

返回目标班级的扩展定义及当前账号是否能调用。是否可调用同时取决于账号的“扩展功能”权限、管理员逐扩展策略和个人手表展示偏好。

### 获取扩展插件分组与设置

~~~http
GET /api/extension-groups?classId={classId}
~~~

返回目标班级设备上报的扩展分组（通常对应一个 ClassIsland 插件），需要在该班拥有“扩展功能”权限：

~~~json
[
  {
    "id": "myplugin",
    "displayName": "我的提醒插件",
    "description": "定时提醒与播报设置",
    "settings": [
      { "key": "interval", "label": "提醒间隔（分钟）", "type": 2, "required": true, "min": 1, "max": 120 }
    ],
    "values": { "interval": "10" },
    "canEditSettings": true,
    "classId": "33333333-3333-3333-3333-333333333333"
  }
]
~~~

`values` 只对可以修改该班扩展设置的账号返回，其他账号为 `null`。

### 修改扩展插件设置

~~~http
PUT /api/classes/{classId}/extension-groups/{groupId}/settings
Content-Type: application/json

{ "values": { "interval": "15" } }
~~~

`values` 只需包含要修改的字段，未出现的字段保持设备当前值。服务端先按插件声明校验字段、类型、范围和必填，再把 `ApplyExtensionSettings` 命令发送到该班设备并等待回执，响应体与[单班级命令](#单班级命令)相同；该班插件离线时返回 `202` 与 `code: "QUEUED"`，设置已保存为待补发，插件上线后由服务端自动写入。系统管理员可修改任意班级；班主任需要系统管理员开启“修改本班的扩展插件设置”且在本班拥有“扩展功能”权限，否则返回 403。批量下发到多个班级请使用 WebUI 的“扩展插件”页。

## 发送命令

### 单班级命令

~~~http
POST /api/commands?classId={classId}
Content-Type: application/json
Authorization: Bearer rci_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
~~~

请求体是 `CommandMessage`。常用 `command` 数值：

| 数值 | 命令 | 所需权限 |
| --- | --- | --- |
| `1` | 换课 | 换课 |
| `2` | 发送通知 | 发送与清除通知 |
| `3` | 清除提醒 | 发送与清除通知 |
| `4` | 显示或隐藏主界面 | 主界面 |
| `5` | 电源操作 | 电源控制 |
| `6` | 音量控制 | 电源控制 |
| `7` | 执行扩展功能 | 扩展功能 |
| `9` | 发送语音消息 | 发送语音 |
| `10` | 升级插件 | 人员管理 |
| `11` | 升级 ClassIsland | 人员管理 |
| `12` | 刷新软件版本清单 | 人员管理 |
| `13` | 安装插件 | 人员管理 |
| `14` | 卸载插件 | 人员管理 |
| `15` | 启用或禁用插件 | 人员管理 |
| `16` | 设置插件管理策略 | 人员管理 |
| `17` | 分发档案 | 人员管理 |
| `18` | 修改时间表 | 人员管理 |
| `19` | 加入集控 | 人员管理 |
| `20` | 仅重启 ClassIsland | 人员管理 |
| `21` | 设置科目教师 | 换课 |
| `22` | 远程终端 | 人员管理，且必须是系统管理员 |
| `23` | 文件分发 | 人员管理，且必须是系统管理员 |
| `24` | 修改扩展插件设置 | 不能经此端点发送，请使用[修改扩展插件设置](#修改扩展插件设置) |

命令 `21` 的 `subjectTeacher` 包含 `subjectId` 和 `teacherName`（不超过 100 字，留空表示清除）。命令 `22` 的 `terminalCommand` 包含 `command`（不超过 4000 字符）、可选 `workingDirectory` 和 `timeoutSeconds`（1-10）；命令 `23` 的 `fileDistribution` 包含 `fileName`、`contentBase64`（解码后不超过 10 MB）、`targetFolder`（1 桌面、2 下载、3 文档）和 `overwrite`。终端输出或文件保存路径通过回执的 `data` 字段返回。命令 `7` 的 `extensionArgs` 会按扩展声明校验类型、范围与选项，不符合时返回 `INVALID_REQUEST`。

发送通知示例：

~~~powershell
$headers = @{ Authorization = "Bearer $env:REMOTECI_API_KEY" }
$body = @{
  command = 2
  notification = @{
    title = "临时通知"
    message = "请保持安静"
  }
} | ConvertTo-Json -Depth 8

Invoke-RestMethod `
  -Method Post `
  -Uri "https://remoteci.example.com/api/commands?classId=$classId" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body
~~~

### 批量命令

~~~http
POST /api/commands/broadcast
~~~

用于一次向多个班级、班级分组或设备连接投递通知、清除通知、电源或语音命令。服务端会逐班检查账号权限，并在响应中逐项返回成功或失败。

~~~json
{
  "classIds": ["33333333-3333-3333-3333-333333333333"],
  "groupIds": [],
  "connectionIds": [],
  "command": 2,
  "notification": {
    "title": "全校通知",
    "message": "请各班检查设备"
  }
}
~~~

## 班级管理

系统管理员可管理全部班级；班主任能否修改自己班级的名称和头像，由系统管理员在“班级管理 → 班主任权限”中统一决定（默认允许），未获准时返回 403：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `PUT` | `/api/classes/{id}/info` | 修改班级名称 |
| `PUT` | `/api/classes/{id}/avatar` | 上传班级头像，原始二进制请求体，最大 256 KB |
| `DELETE` | `/api/classes/{id}/avatar` | 删除班级头像 |

## 管理、设置与维护接口

以下接口沿用 WebUI 的权限判断：人员、角色列表、访客设置和插件配对码要求“人员管理”；角色创建/修改/删除、班级创建/删除、分组、插件凭据和备份恢复要求系统管理员；班级名称与头像要求系统管理员或该班班主任；通知发送人设置的读取只需登录，修改要求系统管理员；课表拉取与自动拉取设置要求系统管理员或当前班级班主任；换课仍要求“换课”；概览状态要求“概览”。拥有“人员管理”的普通账号不能创建、编辑、删除管理员，也不能创建管理员的 API Key。

### 人员

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/users` | 列出账号 |
| `POST` | `/api/users` | 创建账号 |
| `PUT` | `/api/users/{id}` | 修改显示名、角色、启用状态和权限 |
| `POST` | `/api/users/{id}/password` | 重置密码 |
| `DELETE` | `/api/users/{id}` | 删除账号 |
| `POST` | `/api/users/batch-import` | 文本批量导入账号 |

### 角色

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/roles` | 列出角色 |
| `POST` | `/api/roles` | 创建自定义角色 |
| `PUT` | `/api/roles/{id}` | 修改角色默认权限 |
| `DELETE` | `/api/roles/{id}` | 删除未被使用的自定义角色 |

### 班级与分组

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/classes` | 列出班级 |
| `POST` | `/api/classes` | 创建班级 |
| `PUT` | `/api/classes/{id}` | 修改班级名称 |
| `DELETE` | `/api/classes/{id}` | 删除班级 |
| `PUT` | `/api/classes/{id}/visitor` | 开启或关闭访客访问 |
| `PUT` | `/api/classes/{id}/groups` | 替换班级所属分组 |
| `GET` | `/api/classes/{id}/members` | 列出班级成员 |
| `PUT` | `/api/classes/{id}/members` | 替换班级成员 |
| `POST` | `/api/classes/batch` | 批量删除、开启访客或关闭访客 |
| `GET` | `/api/class-groups` | 列出班级分组 |
| `POST` | `/api/class-groups` | 创建分组 |
| `PUT` | `/api/class-groups/{id}` | 重命名分组或调整上级 |
| `PUT` | `/api/class-groups/{id}/classes` | 替换分组包含的班级 |
| `DELETE` | `/api/class-groups/{id}` | 删除分组 |

### 插件与系统设置

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/plugin/pairing-code` | 创建插件配对码 |
| `GET` | `/api/plugins/credentials` | 列出插件长期凭据 |
| `DELETE` | `/api/plugins/credentials/{id}` | 吊销插件凭据 |
| `GET` | `/api/visitor` | 读取访客自动进入设置 |
| `PUT` | `/api/visitor` | 修改访客自动进入设置 |
| `GET` | `/api/settings/notifications` | 读取通知发送人前缀设置 |
| `PUT` | `/api/settings/notifications` | 修改通知发送人前缀设置 |
| `GET` | `/api/settings/schedule-pull` | 读取自动拉取课表周期 |
| `PUT` | `/api/settings/schedule-pull` | 修改自动拉取课表周期；全局设置，仅系统管理员 |
| `GET` | `/api/settings/class-self-service` | 读取班主任权限（班级自治策略）；任何登录账号可读 |
| `PUT` | `/api/settings/class-self-service` | 修改班主任权限，请求体 `{"canRename":true,"canChangeAvatar":true,"canPullSchedule":true,"canEditExtensionSettings":false}`；仅系统管理员 |
| `GET` | `/api/admin/status` | 读取服务端与插件连接概览 |
| `GET` | `/api/admin/system` | 读取当前版本与自更新状态 |
| `POST` | `/api/admin/updates/check` | 检查更新 |
| `GET` | `/api/admin/backups` | 列出备份 |
| `POST` | `/api/admin/backups` | 创建备份 |
| `DELETE` | `/api/admin/backups/{name}` | 删除备份 |
| `POST` | `/api/admin/backups/{name}/restore` | 恢复备份并重启服务 |

### 调休

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/holidays` | 任何登录账号：返回开关 `enabled`、数据源、刷新状态 `status {lastAttemptAt, lastSuccessAt, lastError}`、近期假期 `periods[] {name, offStart, offEnd, makeupDays[]}` 与已失效的手动安排 `staleOverrideDates` |
| `PUT` | `/api/admin/holidays/settings` | 请求体 `{"enabled":true,"sourceUrlTemplate":null}`；自定义地址必须是包含 `{year}` 的 https 地址；仅系统管理员 |
| `PUT` | `/api/admin/holidays/overrides/{yyyy-MM-dd}` | 请求体 `{"followWeekday":3}` 指定调休上学日上周几（1-5）的课，`null` 表示不补课；日期必须是调休上学日；仅系统管理员 |
| `DELETE` | `/api/admin/holidays/overrides/{yyyy-MM-dd}` | 恢复自动推算；仅系统管理员 |
| `POST` | `/api/admin/holidays/refresh` | 立即拉取节假日数据，返回刷新状态；仅系统管理员 |

`makeupDays[]` 每项为 `{date, autoWeekday, followWeekday, followSource}`：`autoWeekday` 是自动推算值，`followWeekday` 是最终生效值，`followSource` 为 `auto` / `manual` / `skip` / `unresolved`。修改类接口成功后返回最新的总览；日期格式错误、不是调休上学日或周几超出 1-5 时返回 400。

## 完整调用流程示例

~~~powershell
$base = "https://remoteci.example.com"
$headers = @{ Authorization = "Bearer $env:REMOTECI_API_KEY" }

# 1. 确认当前账号和权限
$me = Invoke-RestMethod -Uri "$base/api/me" -Headers $headers

# 2. 获取可访问班级
$classes = Invoke-RestMethod -Uri "$base/api/me/classes" -Headers $headers
$classId = $classes[0].id

# 3. 读取当前课堂状态和课表
$state = Invoke-RestMethod -Uri "$base/api/state?classId=$classId" -Headers $headers
$schedule = Invoke-RestMethod -Uri "$base/api/schedule?classId=$classId" -Headers $headers

# 4. 按权限发送通知
$body = @{
  command = 2
  notification = @{ title = "API 测试"; message = "通知发送成功" }
} | ConvertTo-Json -Depth 8
Invoke-RestMethod -Method Post -Uri "$base/api/commands?classId=$classId" -Headers $headers -ContentType "application/json" -Body $body
~~~

## 安全建议

- API Key 只用于服务端到服务端或受控脚本，不要下发到浏览器、公开仓库或移动应用包。
- 为不同脚本创建不同名称的密钥，泄露时只吊销单个密钥。
- 定期在“个人账号 → API Key”检查最近使用时间，吊销不再使用的密钥。
- API Key 继承账号全部有效权限；不要给日常自动化脚本使用管理员账号。
- 生产环境只通过 HTTPS 暴露 API。
