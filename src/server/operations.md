---
title: 运维与安全
icon: shield-halved
order: 3
---

# 运维与安全

## 日常检查

~~~powershell
docker compose ps
docker compose logs --tail 200 remoteci
Invoke-RestMethod https://remoteci.example.com/api/health
~~~

同时在管理页面确认插件在线、手表连接数和最近一次课表同步时间。

## 备份

SQLite 数据库包含账号、权限、会话、插件凭据和 API Key 摘要。为避免复制到一半的数据库，建议短暂停止容器后备份整个数据目录：

~~~powershell
docker compose stop remoteci
Copy-Item -Recurse .\data ".\backup\data-$(Get-Date -Format yyyyMMdd-HHmmss)"
docker compose start remoteci
~~~

备份文件与生产数据库具有同等敏感性，应加密保存并限制访问。

登录页背景图保存在数据库的 `SystemMetadata` 表中，会随数据目录一起备份；导出加密配置包只包含主题、背景不透明度与登录卡片位置三项标量设置，不包含背景图，换机器部署后需要在“登录页设置”重新上传。

## 恢复

1. 停止容器。
2. 备份当前数据目录。
3. 用同一版本或兼容版本的备份替换数据目录。
4. 启动容器并检查迁移日志和健康检查。
5. 验证管理员登录、插件连接和手表登录。

不要在容器运行时直接覆盖 SQLite 文件。

## 升级

服务端、插件、手表和 ClassIsland 主程序使用不同的升级方式：

- 服务端：管理员登录 WebUI 后，在“系统配置 → 系统更新”选择正式版或 Beta 渠道并点击“检查更新”。正式版排除预发布，Beta 同时包含正式版和预发布；启用强制更新后可重新下载并覆盖同一版本，但不会降级。Docker 会就地替换后由 <code>restart: unless-stopped</code> 重新启动；Windows 与裸机 Linux 会启动独立更新器，等待旧进程退出和文件锁释放后再替换实际程序集目录并自动重启。更新前会核对包内服务端版本与 release 标签。Visual Studio 或 <code>dotnet run</code> 的 Development 环境由构建工具管理，WebUI 会禁用在线覆盖更新，避免 release 写入源码目录。
- 插件：默认仍由 ClassIsland 插件市场统一管理；管理员也可在 WebUI“批量控制”页勾选一台或多台在线设备批量触发官方插件升级。插件包仍使用同一个四段纯数字多端 Release，固定资产名为 `RemoteCI.Plugin.cipx`，Release 正文携带同名文件的 MD5 标记；Beta 使用 `v3.x.x-beta.y`，仅供三端测试，不进入市场。升级命令只代表设备已接受任务，下载完成后 ClassIsland 会重启并重新上报版本。
- 手表：连接 WebUI 后，在“设置 → 更新”选择正式版或 Beta 渠道；可强制重新下载并覆盖同一版本，但不能降级。稳定渠道只选择协议主版本相同的四段纯数字 Release，Beta 额外选择 `v3.x.x-beta.y`，旧三段 `v3.x.x` 稳定标签不再作为新候选；通过系统安装器覆盖安装时仍要求发布包与当前安装包签名一致。
- 飞牛 fnOS：WebUI 提示由 fnOS 应用中心管理；从 GitHub Release 下载在线或对应架构离线 FPK 后手动升级。
- ClassIsland 主程序：管理员可在 WebUI“批量控制”页勾选在线设备，使用 ClassIsland 官方更新服务批量升级主程序。该流程会校验官方文件图并在部署后自动重启，失败或已是最新版本时不会重启。

个人账号页的“修改密码”与系统配置页的“系统更新”位于不同页面和独立表单：检查或执行更新不会校验密码字段，只有提交密码修改按钮时才会校验当前密码、新密码和确认新密码；人员管理中的“重置密码”也要求填写确认新密码，两次输入必须一致。

人员管理页的 Excel 批量导出不包含密码列。导出的文件带有隐藏系统标识和导出范围信息，可修改后用于覆盖导入；覆盖导入只更新文件中出现的班级成员关系，文件中缺失的关系会保留，不会读取、重置或覆盖账号密码，并在发现任一错误时保持整批不写入。

班级管理页的 Excel 导入导出用于批量维护班级与分组，同样在发现任一错误时保持整批不写入，但覆盖导入只新增与修改、不会删除班级或分组。删除班级会移除成员关系与插件凭据，因此只能由管理员在班级管理页显式执行，不会由上传的文件触发。

升级前应先备份数据库卷。三端软件版本可以不同，但必须保持协议号为 3；不支持的新功能由能力协商隐藏，破坏性协议变更必须升级到 V4 并协调升级。

`3.2.1.2` 是从旧 `v3.2.0` 三段稳定标签切换后首个实际发布的 ClassIsland 四段纯数字版本。旧更新器不会自动发现新标签，首次迁移必须手动安装服务端或 FPK、`RemoteCI.Plugin.cipx` 和 `RemoteCI.Watch-3.2.1.2.apk`；之后稳定版可按四段数字标签自动更新。

手动升级服务端时：

~~~powershell
docker compose stop remoteci
# 先备份 remoteci-data 卷，再构建或拉取新镜像。
docker compose up -d
docker compose logs --tail 200 remoteci
~~~

## 安全清单

- 公网入口仅开放 443，并启用有效 HTTPS 证书。
- 8080 只绑定到回环地址或受信任的容器网络。
- 初始密码至少 8 位，实际部署建议使用随机长密码。
- 不在 Compose 文件、截图或问题反馈中公开密码、令牌、配对码和 API Key。API Key 只在创建时显示一次，泄露后应立即在“个人账号”或“人员权限”中吊销。
- 普通用户按最小权限分配，设备丢失后立即撤销会话。
- “老师来了”（TeacherComing）单独保护快捷提醒；“发送与清除通知”（SendNotifications）保护自定义通知和清除提醒；“扩展功能”（RunExtensions）是插件扩展的独立总权限；“主界面”（MainMenuControl）保护主界面显隐；“电源控制”（PowerControl）保护音量与电源操作；“修改用户名”（ChangeDisplayName）允许账号自行修改自己的显示名，默认不授予学生角色。
- 定期备份并实际演练恢复。
- 定期更新服务端镜像、插件和手表应用。
