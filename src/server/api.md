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
- 管理员可在“人员与角色 → 角色”调整角色默认权限，或在“人员与角色 → 编辑账号 → 附加权限”为单个账号开启。

有权限的账号可在“个人账号 → API Key”自行创建和吊销密钥；系统管理员或拥有“人员管理”权限的账号也可在“人员与角色 → 编辑账号 → API Key”为其他账号代管。密钥明文只在创建时显示一次，服务端只保存 SHA-256 摘要，数据库中无法恢复完整密钥。

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
- `POST /api/auth/web-qr/scan`、`POST /api/auth/web-qr/confirm`（网页扫码登录：已登录的 App 扫描 WebUI 登录页二维码。`scan` 请求体 `{"code":"…"}`，返回 `{browser, ipAddress, expiresAt}` 供确认；`confirm` 请求体 `{"code":"…","approve":true}`，成功返回 `204`。只接受设备会话，确认必须由扫码的同一账号完成；二维码过期、已被其他账号扫描或不存在时返回 `404`）
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

返回当前账号的日程 `{ fromDate, generatedAt, days[] }`，包含本人的自定义课程；“老师”和“班主任”还会按显示名匹配各班课表中的教师名，聚合任教课程。每天的 `items[]` 包含 `classId`、`className` 和 `courses[]`。插件从未同步过课表的班级按该班当前档案推算，对应的 `items[]` 带 `"source": "profile"`；自定义课程带 `"source": "personal"`。没有任教课程且没有自定义课程时 `days` 为空数组。可选参数 `timeZoneOffsetMinutes` 见下一节。

### 获取下一节课

~~~http
GET /api/me/schedule/next?at={ISO 8601 时间}&timeZoneOffsetMinutes={分钟}
~~~

返回当前账号在指定时刻正在上的课 `current` 和接下来的第一节课 `next`，包含自定义课程及老师、班主任的任教课程，没有时省略对应字段；`at` 可省略，默认取服务端当前时间。来自档案推算班级的课程带 `"source": "profile"`。`next` 可能在之后几天，客户端自行判断是否“即将上课”。

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

`course.startTime`/`endTime` 是教室电脑的本地钟点；`startsAt`/`endsAt` 是按该班教室电脑时区换算出的绝对时间：优先用该班插件上报的时区；该班从未连接插件（按档案推算）时用任一班级插件上报的时区；还没有任何插件上报过时区时，用可选参数 `timeZoneOffsetMinutes`（调用方本机的 UTC 偏移分钟数，-840～840，例如东八区为 `480`；超出范围返回 400），都没有才退回服务端时区。Docker 部署的服务端默认是 UTC，脚本调用时建议带上该参数；手机 App 会自动携带。

### 管理自定义课程

所有已登录账号都可管理自己的自定义课程，设备令牌与用户 API Key 均可调用，API Key 仍需账号具备 API 访问权限。数据按认证账号隔离，不接受账号或班级参数。

| 方法与路径 | 说明 |
| --- | --- |
| `GET /api/me/schedule/courses` | 列出本人课程（每周课程按周一到周日、开始时刻排序，单次课程在后） |
| `POST /api/me/schedule/courses` | 新建课程 |
| `PUT /api/me/schedule/courses/{id}` | 完整替换课程，先查询并保留未修改字段 |
| `DELETE /api/me/schedule/courses/{id}` | 删除课程，成功返回 204 |

课程按“每周星期几 + 当天起止时刻 + 周次”重复。创建或修改的请求体：

~~~json
{"subject":"自习","location":"图书馆","weekDay":3,"startTime":"14:00","endTime":"15:00","weekCountDiv":1,"weekCountDivTotal":2,"timeZoneOffsetMinutes":480,"reminderMinutes":20,"notifyAtStart":true}
~~~

| 字段 | 说明 |
| --- | --- |
| `weekDay` | 0=周日，1=周一 … 6=周六 |
| `startTime` / `endTime` | `HH:mm`，结束晚于开始且在同一天内 |
| `weekCountDiv` / `weekCountDivTotal` | 0 为每周；否则为 `weekCountDivTotal`（2–4）周一轮中的第几周，1/2 单周、2/2 双周，含义与档案课表 `TimeRule` 相同。按[学期设置](#学期设置)的教学周计算，未设置学期开始日期时只能选每周 |
| `timeZoneOffsetMinutes` | 起止时刻所在时区的 UTC 偏移（-840～840），省略时为服务端时区；修改时保留原值 |

只上一次的安排不传 `weekDay`，改传含时区偏移的 ISO 8601 `startsAt` / `endsAt`（须在当天内结束），服务端保存为单次课程。名称为 1–100 字，地点最多 200 字。`reminderMinutes` 为 1–10080 分钟，null 或省略表示关闭课前提醒；`notifyAtStart` 默认 true。响应在这些字段外包含稳定的课程 `id`、`summary`（如“每周三 14:00–15:00 · 单周”）、单次课程的 `date`，以及下一次课的绝对时间 `startsAt` / `endsAt`。操作他人的编号与不存在的编号均返回 404。

### 学期设置

`GET /api/settings/semester`（任何已登录账号）返回 `{startDate, syncToClassrooms, currentWeek?}`。学期开始日期所在周（周一起）为第 1 教学周，`currentWeek` 为本周的教学周；`startDate` 为 null 表示未设置。`PUT /api/settings/semester`（仅系统管理员）请求体 `{"startDate":"2026-09-01","syncToClassrooms":true}`，`startDate` 传 null 清除。它决定自定义课程的单双周与按档案推算课表时的多周轮换；`syncToClassrooms` 为 true 时同时写入支持该能力的教室端 ClassIsland“单周起始日期”。

合并日程的自定义条目带 `source: "personal"`，`classId` 为全零 GUID，`className` 为地点或“自定义课程”，不代表真实班级，也不可用于换课。同一课程在七日内每周各出现一次，通过 `courses[].personalCourseId` 加日期识别某一次课，每次课带各自的绝对时间 `startsAt`、`endsAt` 和提醒设置。自定义课程不受班级节假日停课影响。

服务端约每 15 秒检查提醒，每周的每一次课分别提醒，生成 `personal_course_upcoming`、`personal_course_start` 个人通知；上课提醒可在开始后 5 分钟内补发，发送记录持久保存以避免重启后重复生成。客户端通过个人通知接收提醒，不应独立重复生成同类提醒。

### 换课申请与个人通知

老师需要全局权限位 4096（老师主动换课）；强制换课还需要 8192。两者都在 `GET /api/me` 的 `permissions` 中。所有请求都使用 `Authorization: Bearer`，也接受 API Key。

| 方法与路径 | 说明 |
| --- | --- |
| `GET /api/swap-requests/catalog` | 所有班级的可选日期范围 `minDate`～`maxDate`（今天起 30 天，含首尾；旧版插件只同步 7 天时为其最后一天）、范围内本人有课的日期 `myDates`、今天起 7 天的课程 `days`（已叠加调课，`mine` 标出自己的课），以及本人任教学科 `mySubjects` |
| `GET /api/swap-requests/catalog/day?classId=&date=` | 某班某天的课程 `{date, courses[]}`，用于选择 7 天以外的日期；放假或没有课时 `courses` 为空，超出范围或教室端未同步该日返回 400 |
| `POST /api/swap-requests` | 发起申请：`{mode, source?, target, subjectName?, reason, force, acknowledgeConflicts?}` |
| `POST /api/swap-requests/preview` | 请求体同上，只检查冲突、不写入数据，返回 `{conflicts:[…]}` |
| `GET /api/swap-requests?box=incoming\|outgoing\|all&status=` | 发给我的、我发起的，或两者 |
| `GET /api/swap-requests/{id}` | 单条详情；查看强制换课详情会自动标记为已看过 |
| `POST /api/swap-requests/{id}/approve` | 通过，可带 `{note, acknowledgeConflicts}`；立即写入调课记录并下发教室端 |
| `POST /api/swap-requests/{id}/reject` | 拒绝，可带 `{note}` |
| `POST /api/swap-requests/{id}/cancel` | 申请人撤销待审批申请 |
| `POST /api/swap-requests/{id}/revoke` | 对方老师撤回强制换课 |
| `POST /api/swap-requests/{id}/revert` | 相关班级的班主任或系统管理员撤回已通过或已强制的换课 |
| `GET /api/classes/{classId}/schedule-adjustments?from=` | 该班调课记录（默认从今天起）：来源 `swap` / `direct` / `classisland` / `backfill`，状态 `active` / `reverted` / `invalidated` / `expired`，送达 `pending` / `applied` / `conflict`，`effective` 表示该节当前生效的那条 |
| `DELETE /api/schedule-adjustments/{id}` | 本班班主任或系统管理员删除直接换课或教室端修改产生的调课；来自换课申请的请走 `revert` |
| `POST /api/swap-requests/seen` | 强制换课看过即处理：`{ids:[…]}`（省略表示全部），返回 `{pending}` 剩余待处理数 |
| `GET /api/me/notifications?after=&unread=true` | 个人通知列表 |
| `POST /api/me/notifications/read` | 标记已读：`{ids:[…]}` 或 `{all:true}` |
| `POST /api/me/action-links` | 为聊天卡片按钮签发一次性确认链接：`{action, targetId}`，`action` 为 `swap.approve`、`swap.reject` 或 `swap.revoke`，返回 `{url, path, expiresAt}` |

- **`mode`**：`1` 互换，`source`、`target` 各是一节课 `{classId, date, index}`；`2` 替换，只填 `target` 与 `subjectName`。
- **`{id}`**：也接受响应中的 8 位 `shortId`。
- **`status`**：`1` 待审批、`2` 已通过、`3` 已拒绝、`4` 已撤销、`5` 已过期、`6` 已强制、`7` 已撤回、`8` 已失效（同一节课已有其他换课生效，或生效后教室端无法再应用，原因见 `invalidReason`）。
- **`delivery`**：已通过或已强制的申请在教室端的状态，`pending`（教室电脑暂未确认，上线后自动生效）或 `applied`。`canRevert` 表示当前账号能否撤回已生效的换课；`acknowledgedConflicts` 为确认过的冲突。
- **冲突**：任课冲突（`teacher_clash`，按真实上下课时间）与同一节课的其他待审批申请（`slot_pending`）需要确认：未带 `acknowledgeConflicts: true` 时返回 `409 SWAP_CONFLICTS`，错误体 `conflicts[]` 每项含 `kind`、`message`、`requiresAcknowledgement` 以及班级、日期、节次、老师、时间等。`slot_adjusted`（课位当天已调整过）只作提示。
- **`needsAction`**：是否计入“待我处理”。可审批的申请，或对方还没看过的强制换课为 `true`；看过后为 `false`，但 `canRevoke` 仍为 `true`，可以继续撤回。客户端角标按它计数。
- **确认链接**：只有当前账号确实能执行该动作时才签发（否则 400）。链接 24 小时有效、只能成功使用一次；打开只显示确认页，点确认才执行，聊天软件预览链接不会误操作；执行失败（例如教室电脑离线）时链接恢复可用。
- **个人通知**：部分通知带 `classId` 与 `link`（站内路径，如 `/Devices`）。新增种类 `device_offline`、`device_online`、`automation_failed`、`swap_invalidated`（换课已失效）。
- **错误码**：`SWAP_NOT_OWN`（两节都不是自己的课）、`SWAP_SUBJECT_MISSING`（目标班没有该学科）、`SWAP_SLOT_CHANGED`（课位已被调整，或教室端无法应用）、`SWAP_STATE_CONFLICT`（申请已被处理或已有相同的待审批申请）、`SWAP_FORCE_LOCKED`（当天这节课的强制换课已被撤回）、`SWAP_CONFLICTS`（需要确认冲突）、`CAPABILITY_UNSUPPORTED`（教室端插件版本过旧，422）。

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

`classId` 可省略，此时服务端使用账号的第一个可访问班级（服务端没有默认班级）。账号必须能访问目标班级，否则返回 `403`。

### 获取七日课表

~~~http
GET /api/schedule?classId={classId}
~~~

返回目标班级最近一次同步的课表；插件离线时仍返回最后一次上线时同步的数据。插件从未同步过课表而本班保存了班级档案时，返回按该档案推算的七日课表，并带 `"source": "profile"`；这类课表只供查看，其中的 `revision` 不能用于向插件提交换课。插件同步的课表不带 `source` 字段。既没有课表也没有班级档案时返回 `404`。

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
    "allowClassAdmin": false,
    "classId": "33333333-3333-3333-3333-333333333333"
  }
]
~~~

`values` 只对可以修改该班该插件设置的账号返回，其他账号为 `null`；`allowClassAdmin` 表示该插件是否已开放给班主任自行管理。

### 修改扩展插件设置

~~~http
PUT /api/classes/{classId}/extension-groups/{groupId}/settings
Content-Type: application/json

{ "values": { "interval": "15" } }
~~~

`values` 只需包含要修改的字段，未出现的字段保持设备当前值。服务端先按插件声明校验字段、类型、范围和必填，再把 `ApplyExtensionSettings` 命令发送到该班设备并等待回执，响应体与[单班级命令](#单班级命令)相同；该班插件离线时返回 `202` 与 `code: "QUEUED"`，设置已保存为待补发，插件上线后由服务端自动写入。系统管理员可修改任意班级；班主任只能修改已开放给班级自行管理的插件，且需要在本班拥有“扩展功能”权限，否则返回 403。批量下发到多个班级或具体设备请使用 WebUI 管理区的“插件批量设置”页。

### 开放插件给班级自行管理

~~~http
PUT /api/extension-groups/{groupId}/class-admin-access
Content-Type: application/json

{ "allowClassAdmin": true }
~~~

仅系统管理员可调用，返回 `{"groupId":"myplugin","allowClassAdmin":true}`。开关按插件设置、对全部班级生效，插件尚未上报时也可以先设置；新插件默认不开放。开放后，班主任的 WebUI 班级区侧栏出现“扩展插件”入口，只列出已开放的插件，并可修改本班设置；`false` 收回后，该插件只由系统管理员统一管理。

## 服务端档案

档案库保存完整的 ClassIsland 档案 JSON：全局模板只有系统管理员可见；班级档案每班一份，系统管理员和本班班主任（且拥有 `ManageSchedule`，值 16）可以管理。WebUI 的 `/Profiles`、`/ClassProfiles` 页面与以下接口共用同一套服务端校验。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/profiles` | 档案列表（不含 JSON）：管理员得到全部档案，班主任得到可管理班级的档案；可加 `?classId=` 只看一个班 |
| `GET` | `/api/profiles/{id}` | 单份档案，含完整 `profileJson` |
| `POST` | `/api/profiles/preview` | 请求体 `{"profileJson":"…"}`，返回解析结果与校验错误，不保存 |
| `PUT` | `/api/profiles` | 批量保存，请求体 `{"items":[{"id":null,"classId":null,"sourceTemplateId":null,"name":"…","profileJson":"…","revision":0}]}`；修改时带上读到的 `id` 与 `revision`；一次最多 100 份，任一无效或冲突整批不写入 |
| `POST` | `/api/profiles/{id}/copy` | 请求体 `{"revision":1,"name":"副本名"}`，复制全局模板；仅系统管理员 |
| `DELETE` | `/api/profiles/{id}?revision=N` | 删除服务端档案，设备档案不受影响 |
| `POST` | `/api/profiles/collect` | 请求体 `{"classIds":["…"]}`（1–100 个班级），读取各班在线设备的当前档案（含临时层），见下文；只返回，不保存 |
| `POST` | `/api/profiles/apply` | 下发已保存的档案，见下文 |
| `GET` | `/api/profiles/{id}/versions` | 版本历史（每份保留最近 50 个），每项含 `revision`、`savedByName`、`savedAt`、`changeCount`、`isCurrent` |
| `GET` | `/api/profiles/{id}/versions/{revision}/diff?against=previous\|current` | 该版本与上一版本或当前内容的差异 `changes[]`（`{category, text}`） |
| `POST` | `/api/profiles/{id}/versions/{revision}/restore` | 请求体 `{"revision": 当前修订号}`，把历史版本另存为新版本 |
| `POST` | `/api/profiles/drift` | 请求体 `{"classIds":["…"]}`，读取教室电脑当前档案并与服务端班级档案比较（不含临时层） |
| `GET` | `/api/profiles/drift` | 可管理班级的最新设备差异结果 |

收集返回 `{success, message, results[]}`，每项含 `classId`、`className`、`deviceName`、`success`、`message`、`profileJson`（仅成功时）与 `errors`（仍需修正的校验问题）。结果已按 ClassIsland 规则对齐课程数并清除悬空指针；要保存时再调用 `PUT /api/profiles`（班级已有档案时带上其 `id` 与 `revision`）。离线班级返回“班级设备未在线”，插件缺少 `profile.read` 时提示升级；无权管理的班级逐班返回“没有管理此班级档案的权限”（不回显班级名），一个都不能管理时返回 403。

下发请求体为 `{"items":[{"id":"…","revision":3}],"mode":1,"sections":7,"classIds":[],"groupIds":[],"connectionIds":[],"confirmReplace":false,"importProfileName":null,"restartAfter":false,"tempLayerIds":null,"replaceExistingTempLayers":false}`：

- `mode` 必须显式选择：`1` 更新当前档案、`2` 整体替换所选类别（需 `confirmReplace: true`）、`3` 创建并启用新档案（需 `importProfileName`）、`4` 作为临时层下发。
- `sections` 为位掩码：`1` 时间表、`2` 课表、`4` 科目；`mode: 4` 时不需要。`1`–`3` 只处理常规对象，不包含临时层。
- `mode: 4` 只写入档案中按日期安排的临时层：`tempLayerIds` 指定临时层课表 ID（省略为全部，多份档案批量下发时忽略），已过期的由插件跳过；设备同一天已有临时层或预定课表时需 `replaceExistingTempLayers: true`，否则该设备失败并说明日期。档案中没有临时层时返回 400（批量时只让该班失败）。需要插件能力 `profile.temp-layer`。
- 单份全局模板可下发到多个班级、分组或设备；班级档案只能下发到所属班级，且不能与模板混在同一批。
- 返回 `{success, message, results[]}`，`results` 逐台设备报告结果；离线设备直接失败，不排队。

修订号不匹配时返回 409 `PROFILE_STALE`，重新读取后再操作。下发会生成 `25 ApplyProfile` 命令（需要插件能力 `profile.apply`），收集会生成 `26 ReadProfile` 命令（需要 `profile.read`），两者都属于 `serverOnly`：`POST /api/commands`、广播、手机/手表通用命令和局域网直连都会拒绝，只能经档案页面或上述档案接口发起。旧命令 17、18 保留原有管理员 API 语义，不读写服务端档案库。

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
| `16` | 设置插件管理策略（WebUI 已移除入口，仅为旧客户端保留） | 人员管理 |
| `17` | 分发档案 | 人员管理 |
| `18` | 修改时间表 | 人员管理 |
| `19` | 加入集控 | 人员管理 |
| `20` | 仅重启 ClassIsland | 人员管理 |
| `21` | 设置科目教师 | 换课 |
| `22` | 远程终端 | 人员管理，且必须是系统管理员 |
| `23` | 文件分发（内联方式） | 必须是系统管理员；推荐改用下方[文件分发](#文件分发)接口 |
| `24` | 修改扩展插件设置 | 不能经此端点发送，请使用[修改扩展插件设置](#修改扩展插件设置) |
| `25` | 应用服务端档案 | 不能经此端点发送，请使用 [`POST /api/profiles/apply`](#服务端档案) |
| `26` | 读取设备档案 | 不能经此端点发送，请使用 [`POST /api/profiles/collect`](#服务端档案) |
| `29` | 上传主界面文件 | 主界面 |
| `30` | 获取当前主界面文件 | 主界面 |
| `31` | 安装或更新服务端中转的 `.cipx` 插件包 | 不能经此端点发送；在 WebUI“安装插件 / 升级插件”开启“服务端预下载”或使用“从 CIPX 安装”，服务端会先为目标设备登记下载权限 |

命令 `21` 的 `subjectTeacher` 包含 `subjectId` 和 `teacherName`（不超过 100 字，留空表示清除）。命令 `22` 的 `terminalCommand` 包含 `command`（不超过 4000 字符）、可选 `workingDirectory` 和 `timeoutSeconds`（1-10）；命令 `23` 的 `fileDistribution` 包含 `fileName`、`contentBase64`（解码后不超过 10 MB）、`targetFolder`（1 桌面、2 下载、3 文档）和 `overwrite`；这一内联方式只供系统管理员兼容使用，发送大文件或由老师发送请使用[文件分发](#文件分发)接口。终端输出或文件保存路径通过回执的 `data` 字段返回。命令 `7` 的 `extensionArgs` 会按扩展声明校验类型、范围与选项，不符合时返回 `INVALID_REQUEST`。

命令 `29` 的 `mainWindowLayout` 包含 `layoutJson`（ClassIsland 主界面文件 `Config/ComponentLayouts/<名称>.json` 的内容，须是含 `Lines` 数组的 JSON 对象，不超过 2 MB）、`mode`（`1` 覆盖设备当前使用的主界面文件并立即生效，`2` 新建）、`name`（新建时的文件名，不含 `.json`，最长 64 字符，同名已存在时拒绝）与 `activate`（新建后是否立即使用，默认 `true`）。命令 `30` 无载荷，回执 `data` 是 JSON 字符串 `{"name","layoutJson","layouts","isManagementMode"}`。设备处于 ClassIsland 集控模式时只能获取，上传返回 `INVALID_REQUEST`；两条命令需要插件声明 `main-window.layout-apply` / `main-window.layout-read` 能力。

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

### 文件分发

把文件发到教室电脑的桌面、下载或文档文件夹。需要目标班级的“文件分发”权限（`SendFiles`，系统管理员默认拥有，其他账号由管理员开启）。文件先上传到服务端，设备在后台断点续传下载并校验 SHA-256，单个文件默认最大 2 GB（见[配置参考](configuration.md)）。

1. 上传：`POST /api/files?name=课件.pptx`，请求体就是文件的原始字节。返回 `201` 和 `{id, fileName, size, sha256, expiresAt, deliveries: []}`；超过上限返回 `413`。
2. 发送：`POST /api/files/{id}/send`，请求体：

```json
{
  "classNames": ["高一(3)班"],
  "nextClass": false,
  "timeZoneOffsetMinutes": 480,
  "targetFolder": 1,
  "overwrite": false
}
```

   也可以用 `classIds`。`nextClass: true` 表示加入当前账号“我的日程”中接下来要上课的班级。返回逐台状态 `deliveries`。
3. 查询进度：`GET /api/files/{id}`（上传者本人或系统管理员），`deliveries[]` 含 `targetName`、`state`（0 等待、1 接收中、2 已送达、3 失败）、`percent`、`receivedBytes`、`totalBytes`、`message` 与 `savedPath`。`DELETE /api/files/{id}` 可提前删除。

```bash
id=$(curl -s -X POST "$SERVER/api/files?name=课件.pptx" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/octet-stream" --data-binary @课件.pptx | jq -r .id)
curl -s -X POST "$SERVER/api/files/$id/send" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"nextClass":true,"targetFolder":1}'
curl -s "$SERVER/api/files/$id" -H "Authorization: Bearer $KEY"
```

默认不覆盖同名文件，而是自动改名为“名称 (2).扩展名”。插件离线的班级立即显示失败；服务端保留文件 24 小时，期间设备断线重连可以继续下载。旧版插件只能接收系统管理员发送的 10 MB 以内文件。

### 屏幕截图

让班级的教室电脑截取当前屏幕（全部显示器）并上传到服务端。需要该班的“屏幕截图”权限（`CaptureScreen`，值 32768；班主任默认拥有，系统管理员始终拥有）。通用 `POST /api/commands` 不能截图。

1. 截图：`POST /api/classes/{classId}/screenshot`，请求体可省略。服务端等待教室电脑截屏并上传完成（通常几秒，最长约 45 秒），成功返回 `201` 和 `{id, classId, deviceName, requestedBy, width, height, size, capturedAt, expiresAt, url}`。失败时返回 `503`（插件离线）、`409`（插件版本过旧）、`504`（超时）或 `422`（截图失败），响应体的 `message` 说明原因。系统管理员可传 `{"credentialId": "…"}` 指定同班的某台设备。
2. 下载：`GET {url}`（即 `/api/screenshots/{id}`），返回 `image/png`。
3. 列表：`GET /api/classes/{classId}/screenshots`，该班保留期内的截图，新到旧。

```bash
url=$(curl -s -X POST "$SERVER/api/classes/$CLASS/screenshot" -H "Authorization: Bearer $KEY" | jq -r .url)
curl -s "$SERVER$url" -H "Authorization: Bearer $KEY" -o screen.png
```

截图保留 24 小时，每个班级最多 30 张；无权查看或已过期的截图统一返回 `404`。

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
| `PUT` | `/api/classes/{id}/info` | 修改班级名称，请求体 `{"name":"高一(4)班"}` |
| `PUT` | `/api/classes/{id}/avatar` | 上传班级头像，原始二进制请求体，加请求头 `X-Avatar-Type: image/png`（或 `image/jpeg`、`image/webp`），最大 256 KB |
| `DELETE` | `/api/classes/{id}/avatar` | 删除班级头像；未设置头像的班级在各端显示默认班级图标 |
| `GET` | `/api/classes/{id}/avatar` | 读取班级头像（无需登录），未设置时返回 404 |

AstrBot 插件的 `/rci 班级改名`、`/rci 班级头像` 也基于这些接口。

## 首次部署

全新部署没有任何账号和班级。以下两个接口无需登录：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/setup` | 返回 `{"needsSystemAdmin":true,"needsFirstClass":true}` |
| `POST` | `/api/setup/system-admin` | 请求体 `{"username":"admin","displayName":"系统管理员","password":"…"}`；只在还没有任何账号时可用（之后返回 403），成功后返回与登录相同的令牌 |

创建系统管理员后，用返回的令牌调用 `POST /api/classes` 新建第一个班级。系统管理员在 `GET /api/users` 中的 `isSystemOwner` 为 `true`，其他账号修改、重置密码或删除它都会返回 403。

## 集控运维

可见范围：系统管理员看全部班级，班主任只看自己担任班主任的班级，其他账号返回 403；自动化仅系统管理员。

| 方法与路径 | 说明 |
| --- | --- |
| `GET /api/devices/health` | 教室电脑列表：`className`、`deviceName`、`online`、`lastSeenAt`、`offlineSince`、`pluginVersion`、`classIslandVersion`、`outdated`、`currentCourse`、`volumePercent`、`muted`、`profileDriftCount`、`timeline` |
| `GET /api/audit?from=&to=&classId=&userId=&command=&success=&before=&limit=` | 操作记录，按时间倒序 `{items, nextBefore}`；下一页把 `nextBefore` 作为 `before` |
| `GET /api/audit/export` | 同样筛选条件导出 Excel |
| `GET /api/automation/rules`、`POST /api/automation/rules` | 自动化规则列表、新建 |
| `GET/PUT/DELETE /api/automation/rules/{id}` | 读取、整体保存、删除 |
| `POST /api/automation/rules/{id}/run` | 立即对全部目标班级执行一次 |
| `GET /api/automation/runs?ruleId=&limit=` | 执行记录（`Pending`、`Running`、`Succeeded`、`Failed`、`Missed`） |
| `GET /api/lesson-stats?from=&to=&classId=&teacher=&includeProfile=` | 课时统计 `{teachers:[{teacher, total, substitute, substituted, classes}]}`，省略日期为本月 |
| `GET /api/lesson-stats/export` | 导出 Excel（汇总 + 明细） |
| `GET /api/me/lesson-stats?from=&to=` | 本人课时，任何账号可用 |

自动化规则结构：

```json
{
  "name": "放学 30 分钟后关机",
  "enabled": true,
  "trigger": { "kind": 2, "event": 3, "delayMinutes": 30 },
  "target": { "classIds": ["<班级ID>"], "groupIds": [] },
  "actions": [ { "kind": 5, "powerAction": 1 } ],
  "validFrom": null,
  "validTo": null
}
```

- `trigger.kind`：`1` 定时（`weekdays` 1=周一…7=周日、`time` 为教室本地 `HH:mm`、`schoolDaysOnly`）；`2` 课表事件（`event` 1 上课、2 下课、3 放学，可选 `subject`、`delayMinutes` 0–180）；`3` 教室电脑上线（`delaySeconds` 0–600）。
- `actions[].kind`：`1` 通知（`notification`）、`2` 清除提醒、`3` 主界面（`mainMenuVisible`）、`4` 音量（`volume`）、`5` 电源（`powerAction`）、`6` 扩展（`extensionId`、`extensionArgs`）、`7` 下发该班档案临时层（`replaceExistingTempLayers`）；1–5 个。
- `PUT` 是整体保存：先 `GET` 完整规则，只修改需要改的字段再提交。

### 应用守护

以下接口仅限系统管理员，其他账号返回 403。功能说明见 [应用守护](../guide/app-guard.md)。

| 方法与路径 | 说明 |
| --- | --- |
| `GET/PUT /api/settings/app-guard` | 全局策略 |
| `GET /api/devices/{credentialId}/app-guard` | 单台设备的生效策略 `{credentialId, overridden, policy}`；设备不存在返回 404 |
| `PUT /api/devices/{credentialId}/app-guard` | 让该设备改用单独策略 |
| `DELETE /api/devices/{credentialId}/app-guard` | 该设备恢复沿用全局 |
| `GET /api/app-guard/events?credentialId=&limit=` | 最近守护事件 `[{credentialId, deviceName, kind, kindName, detail, atUnixMs}]`，按时间倒序，`limit` 默认 100、最大 500 |

`credentialId` 取自 `GET /api/devices/health`。

策略对象：

```json
{
  "enabled": true,
  "restartAfterExit": true,
  "restartAfterExitDelayMinutes": 40,
  "restartOnCrash": true,
  "preventDeletion": true,
  "backupIntervalHours": 24,
  "organizationName": "RemoteCI"
}
```

- `restartAfterExitDelayMinutes` 取 0–1440，0 表示立即；`backupIntervalHours` 取 1–168。越界值会被截断。
- `organizationName` 只读，在 WebUI“系统设置 › 常规 › 组织信息”中修改。
- `PUT` 是整体保存。

事件的 `kind` 取值：

- `restored`：已自动恢复
- `restore-failed`：恢复失败
- `crash-restarted`：意外退出后重启
- `exit-restarted`：退出后自启
- `crash-loop-paused`：频繁崩溃，暂停重启
- `backup-completed`：备份完成
- `backup-failed`：备份失败

`restored` 与 `restore-failed` 会以个人通知 `app_guard` 发给全部系统管理员。

## 管理、设置与维护接口

以下接口沿用 WebUI 的权限判断：人员、角色列表、访客设置和插件配对码要求“人员管理”；角色创建/修改/删除、班级创建/删除、分组、插件凭据和备份恢复要求系统管理员；班级名称与头像要求系统管理员或该班班主任；通知发送人设置的读取只需登录，修改要求系统管理员；课表拉取与自动拉取设置要求系统管理员或当前班级班主任；换课仍要求“换课”；概览状态要求“概览”。拥有“人员管理”的普通账号不能创建、编辑、删除管理员，也不能创建管理员的 API Key。

### 人员

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/users` | 列出账号 |
| `POST` | `/api/users` | 创建账号；可选 `classId` 让账号以同一角色加入该班，省略则不加入任何班级。`password` 可留空，账号首次以空密码调用 `POST /api/auth/login` 时返回 `passwordPending` 与一次性 `setupToken`，再调用 `POST /api/auth/setup-password` 设置密码 |
| `PUT` | `/api/users/{id}` | 修改显示名、角色、启用状态和权限 |
| `POST` | `/api/users/{id}/password` | 重置密码 |
| `DELETE` | `/api/users/{id}` | 删除账号；系统管理员账号不能删除 |
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
| `POST` | `/api/plugin/pairing-code` | 创建插件配对码；一次性码和固定码必须指定 `classId`，`{"unified":true}` 为统一连接码 |
| `GET` | `/api/plugins/credentials` | 列出插件长期凭据 |
| `DELETE` | `/api/plugins/credentials/{id}` | 吊销插件凭据 |
| `GET` | `/api/visitor` | 读取访客自动进入设置 |
| `PUT` | `/api/visitor` | 修改访客自动进入设置 |
| `GET` | `/api/settings/notifications` | 读取通知发送人前缀设置 |
| `PUT` | `/api/settings/notifications` | 修改通知发送人前缀设置 |
| `GET` | `/api/settings/schedule-pull` | 读取自动拉取课表周期 |
| `PUT` | `/api/settings/schedule-pull` | 修改自动拉取课表周期；全局设置，仅系统管理员 |
| `GET` | `/api/settings/semester` | 读取学期开始日期与本周教学周，见[学期设置](#学期设置) |
| `PUT` | `/api/settings/semester` | 修改学期开始日期；仅系统管理员 |
| `GET` | `/api/settings/class-self-service` | 读取班主任权限（班级自治策略）；任何登录账号可读 |
| `PUT` | `/api/settings/class-self-service` | 修改班主任权限，请求体 `{"canRename":true,"canChangeAvatar":true,"canPullSchedule":true}`；仅系统管理员。扩展插件按插件开放，见[开放插件给班级自行管理](#开放插件给班级自行管理) |
| `GET` | `/api/admin/status` | 读取服务端与插件连接概览 |
| `GET` | `/api/admin/system` | 读取当前版本与自更新状态 |
| `POST` | `/api/admin/updates/check` | 检查更新；请求体 `{"channel":"stable"}` 或 `{"channel":"beta"}`，省略渠道时使用系统设置中保存的更新渠道 |
| `POST` | `/api/admin/updates/upload` | 调试用：请求体为当前平台服务端发布包 zip（`Content-Type: application/zip`，上限 512MB），安装后返回 `202` 与 `{"version":"…","mode":"…"}` 并自动重启；不校验 SHA-256，允许同版本覆盖和降级 |
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
