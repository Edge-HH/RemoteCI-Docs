---
title: Docker 部署
icon: server
order: 1
---

# Docker 部署

Docker 是当前最直接的部署方式。RemoteCI 服务端使用 ASP.NET Core 10 和 SQLite，数据库默认保存在容器内的 <code>/app/data/remoteci.db</code>。仓库根目录自带 <code>compose.yaml</code>，可以直接用于首次部署。

::: warning 验证边界
本文内容依据当前 Dockerfile 与 compose.yaml 整理，文档站构建已经通过，但未在 RemoteCI 目录内构建镜像或启动服务。真机与生产环境验收清单见[开发状态](../guide/status.md)。
:::

## 前置条件

- 已安装 Docker Engine 24 与 Docker Compose v2 或更新版本。
- 已获取 RemoteCI 源码。
- TCP 8080 未被其他程序占用。
- 公网部署时，已准备域名、HTTPS 证书和反向代理。

## 使用 Compose 启动

在服务器上创建部署目录，把 RemoteCI 仓库根目录的 <code>compose.yaml</code> 复制进去。该文件默认：

- 只把 <code>127.0.0.1:8080</code> 暴露给宿主机。
- 把 SQLite 保存在命名卷 <code>remoteci-data</code>，删除容器不会丢数据。
- 从 <code>.env</code> 或环境变量读取 <code>REMOTECI_ADMIN_PASSWORD</code> 与 <code>REMOTECI_PLUGIN_PAIR_CODE</code>。

在同目录创建不提交到 Git 的 <code>.env</code>：

~~~dotenv
REMOTECI_ADMIN_PASSWORD=请替换为至少8位的强密码
REMOTECI_PLUGIN_PAIR_CODE=请替换为一次性随机配对码
~~~

两个变量都可以省略；缺省时服务端会各生成一个随机值并只在首次启动日志中显示。

构建镜像并启动：

~~~powershell
docker compose up -d --build
docker compose logs -f remoteci
~~~

::: warning 不要省略数据卷
删除容器前请确认命名卷 <code>remoteci-data</code> 仍然存在；删除卷会同时丢失账号、设备会话和插件凭据。
:::

也可以单独构建镜像：

~~~powershell
docker build --file server/RemoteCI.Server/Dockerfile --tag remoteci-server:local .
~~~

Dockerfile 会同时复制 <code>shared</code> 和 <code>server</code>，因此必须在 RemoteCI 仓库根目录执行构建。

## 验证服务

~~~powershell
Invoke-RestMethod http://127.0.0.1:8080/api/health
~~~

正常响应应包含 <code>status</code> 与 <code>protocolVersion</code>。随后打开服务端页面，使用管理员账号登录并立即修改初始密码。

## 配置 HTTPS

公网环境不要直接暴露 8080 端口。推荐让 Caddy 或 Nginx 终止 TLS，再转发 HTTP 和 WebSocket。

最小 Caddyfile：

~~~text
remoteci.example.com {
    reverse_proxy 127.0.0.1:8080
}
~~~

Caddy 会自动转发 WebSocket 握手。请把 <code>remoteci.example.com</code> 替换为真实域名，并确认代理发送 <code>X-Forwarded-Proto</code>。

::: danger 公网必须使用 HTTPS
HTTP 和 WS 不能保护登录密码、访问令牌与课表内容。不要通过端口映射把 8080 直接开放到公网。
:::

## 获取发布物

正式使用时推荐直接从 GitHub Releases 获取：

- 服务端：<code>RemoteCI.Server-版本-linux-x64.zip</code> 或 <code>RemoteCI.Server-版本-win-x64.zip</code>。
- 插件：稳定 Release 固定使用 <code>RemoteCI.Plugin.cipx</code> 与 <code>checksums.md</code>，正文包含同名资产的 <code>CLASSISLAND_PKG_MD5</code> 标记；<code>v3.x.x-beta.y</code> 仅供测试，不进入插件市场。
- 手表：<code>RemoteCI.Watch-版本.apk</code>。
- 飞牛 fnOS：在线多架构 <code>RemoteCI-版本.fpk</code>，或对应架构的 x86_64/ARM64 离线 FPK（安装与更新见[飞牛 fnOS 安装](./fnos.md)）。

稳定 Release 标签必须是四段纯数字（例如 <code>3.2.1.3</code>）；Beta 标签使用 <code>v3.x.x-beta.y</code>。旧三段 <code>v3.x.x</code> 稳定标签仅保留历史兼容记录，不再作为新更新候选。

仓库根目录的 <code>remoteci.plugin.yml</code> 已按 ClassIsland 市场字段准备，可直接复制到
<code>ClassIsland/PluginIndex/index/plugins-v2/</code>；插件包内的 <code>manifest.yml</code> 与该描述文件保持一致。

需要本地构建时：

~~~powershell
dotnet publish server/RemoteCI.Server/RemoteCI.Server.csproj -c Release -r win-x64 --self-contained false
dotnet build plugin/RemoteCI.Plugin/RemoteCI.Plugin.csproj -c Release -p:CreateCipx=true
cd wearos
.\gradlew.bat assembleDebug
~~~

## 连接插件和手表

- 插件的云端服务地址填写 <code>https://remoteci.example.com</code>。
- 手表的云端服务地址填写同一个地址。
- 不要手写 <code>/api</code> 或 <code>/ws</code> 路径，客户端会自动拼接。

## 飞牛 fnOS

RemoteCI 同时以飞牛 fnOS 应用（fpk）形式发布，安装、端口配置与更新方式见[飞牛 fnOS 安装](./fnos.md)。
