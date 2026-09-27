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
- 班管理员默认包含“API 访问”，因此默认可使用 API。
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
- `POST /api/auth/refresh`
- `POST /api/auth/setup-password`
- `POST /api/auth/logout`
- `GET /api/me/sessions`
- `POST /api/me/password`
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

返回当前账号可访问的班级列表。普通账号只返回自己加入的班级；管理员返回全部班级。

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
| `8` | 老师来了 | 老师来了 |
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

以下端点按班级内的有效权限判断，班管理员可管理自己所属班级，系统管理员可管理全部班级：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `PUT` | `/api/classes/{id}/info` | 修改班级名称 |
| `PUT` | `/api/classes/{id}/avatar` | 上传班级头像，原始二进制请求体，最大 256 KB |
| `DELETE` | `/api/classes/{id}/avatar` | 删除班级头像 |

## 管理、设置与维护接口

以下接口沿用 WebUI 的权限判断：人员、角色列表、访客设置和插件配对码要求“人员管理”；角色创建/修改/删除、班级创建/删除、分组、插件凭据和备份恢复要求系统管理员；班级名称与头像要求系统管理员或该班班管理员；通知发送人设置要求“发送与清除通知”或管理员；课表自动拉取设置要求“换课”；概览状态要求“概览”。拥有“人员管理”的普通账号不能创建、编辑、删除管理员，也不能创建管理员的 API Key。

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
| `PUT` | `/api/settings/schedule-pull` | 修改自动拉取课表周期 |
| `GET` | `/api/admin/status` | 读取服务端与插件连接概览 |
| `GET` | `/api/admin/system` | 读取当前版本与自更新状态 |
| `POST` | `/api/admin/updates/check` | 检查更新 |
| `GET` | `/api/admin/backups` | 列出备份 |
| `POST` | `/api/admin/backups` | 创建备份 |
| `DELETE` | `/api/admin/backups/{name}` | 删除备份 |
| `POST` | `/api/admin/backups/{name}/restore` | 恢复备份并重启服务 |

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
