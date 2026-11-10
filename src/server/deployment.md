---
title: 服务端部署
icon: server
order: 1
---

# 服务端部署

RemoteCI 服务端使用 ASP.NET Core 10 与 SQLite，可以用 Docker、Windows / Linux 发布包或飞牛 fnOS 应用部署。推荐 Docker 或 fnOS；直接运行发布包时，需要自行准备 .NET 10 ASP.NET Core 运行时和反向代理。

| 方式 | 适合 | 说明 |
| --- | --- | --- |
| Docker Compose | 自有服务器、NAS | 仓库自带 <code>compose.yaml</code>，SQLite 保存在命名卷 |
| Windows / Linux 发布包 | 已有 .NET 运行时或需要接入现有服务 | 解压后运行 <code>dotnet RemoteCI.Server.dll</code> |
| 飞牛 fnOS FPK | 飞牛 NAS | 见[飞牛 fnOS 安装](./fnos.md) |

## 前置条件

- 公网部署时已准备域名、HTTPS 证书和反向代理。
- Docker 方式：Docker Engine 24 与 Docker Compose v2 或更新版本。
- 发布包方式：.NET 10 ASP.NET Core Runtime；Windows 或受支持的 Linux 架构。
- TCP 8080 未被其他程序占用。
- 服务端需要能访问 GitHub Releases 才能检查更新；需要外网才能拉取节假日数据与插件市场。

## 使用 Compose 启动

在服务器上创建部署目录，把 RemoteCI 仓库根目录的 <code>compose.yaml</code> 复制进去。该文件默认：

- 只把 <code>127.0.0.1:8080</code> 暴露给宿主机。
- 把 SQLite 保存在命名卷 <code>remoteci-data</code>，删除容器不会丢数据。
- 从 <code>.env</code> 或环境变量读取可选的 <code>REMOTECI_ADMIN_PASSWORD</code> 与 <code>REMOTECI_PLUGIN_PAIR_CODE</code>。

两个变量通常都不需要设置：首次打开 WebUI 时，初始化向导会让你创建系统管理员并新建第一个班级。无人值守部署可以在同目录创建不提交到 Git 的 <code>.env</code> 预先提供：

~~~dotenv
# 可选：预先创建登录 ID 为 admin 的系统管理员
REMOTECI_ADMIN_PASSWORD=请替换为至少8位的强密码
# 可选：插件引导配对码，接入的设备进入“未分配设备”
REMOTECI_PLUGIN_PAIR_CODE=请替换为一次性随机配对码
~~~

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

## 使用 Windows / Linux 发布包

1. 从 GitHub Releases 下载与平台对应的 <code>RemoteCI.Server-版本-linux-x64.zip</code>、<code>linux-arm64</code> 或 <code>win-x64</code>。
2. 解压到独立目录（不要覆盖源码目录）。数据库默认写入运行目录下的 <code>data/remoteci.db</code>，请确保该目录可写并纳入备份。
3. 安装 .NET 10 ASP.NET Core Runtime（发布包不是自包含的）。
4. 设置监听地址并启动：

   ~~~powershell
   $env:ASPNETCORE_URLS = "http://0.0.0.0:8080"
   dotnet .\RemoteCI.Server.dll
   ~~~

   Linux 下等价于 `ASPNETCORE_URLS=http://0.0.0.0:8080 dotnet ./RemoteCI.Server.dll`。

5. 用 systemd、Windows 服务或进程守护工具保持运行；更新时替换程序文件并重启。

服务端不会自动创建管理员或班级。首次打开 WebUI 会进入初始化向导；也可以预先设置 <code>REMOTECI_ADMIN_PASSWORD</code> 跳过创建管理员这一步。

## 验证服务

~~~powershell
Invoke-RestMethod http://127.0.0.1:8080/api/health
~~~

正常响应应包含 <code>status</code> 与 <code>protocolVersion</code>。随后打开服务端页面，按初始化向导创建系统管理员并新建第一个班级。

## 配置 HTTPS 与反向代理

公网环境不要直接暴露 8080 端口。推荐让 Caddy、Nginx 或 NAS 自带反向代理终止 TLS，再转发 HTTP 与 WebSocket。

最小 Caddyfile：

~~~text
remoteci.example.com {
    reverse_proxy 127.0.0.1:8080
}
~~~

Nginx 需要显式转发 WebSocket：

~~~text
location /ws {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
}
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 2g;
}
~~~

请把 <code>remoteci.example.com</code> 替换为真实域名，并确认代理发送 <code>X-Forwarded-Proto</code>。文件分发、语音和屏幕截图依赖较大的请求体；使用反向代理时需同步放开请求体大小。

::: danger 公网必须使用 HTTPS
HTTP 和 WS 不能保护登录密码、访问令牌与课表内容。不要通过端口映射把 8080 直接开放到公网。
:::

## 获取发布物

正式使用时推荐直接从 GitHub Releases 获取：

- 服务端：<code>RemoteCI.Server-版本-linux-x64.zip</code>、<code>linux-arm64</code> 或 <code>win-x64</code>，以及对应的 <code>.sha256</code> 文件。
- 插件：稳定 Release 固定使用 <code>RemoteCI.Plugin.cipx</code> 与 <code>checksums.md</code>，正文包含同名资产的 <code>CLASSISLAND_PKG_MD5</code> 标记；<code>v3.x.x-beta.y</code> 仅供测试，不进入插件市场。
- Android：<code>RemoteCI.Mobile-版本.apk</code>；Wear OS：<code>RemoteCI.Watch-版本.apk</code>。
- 飞牛 fnOS：在线多架构 <code>RemoteCI-版本.fpk</code>，或对应架构的 x86_64 / ARM64 离线 FPK（安装与更新见[飞牛 fnOS 安装](./fnos.md)）。
- 容器镜像：<code>ghcr.io/edge-hh/remoteci:版本</code> 多架构镜像。

稳定 Release 标签必须是四段纯数字（例如 <code>3.3.2.1</code>）；Beta 标签使用 <code>v3.x.x-beta.y</code>。旧三段 <code>v3.x.x</code> 稳定标签仅保留历史兼容记录，不再作为新更新候选。

仓库根目录的 <code>remoteci.plugin.yml</code> 已按 ClassIsland 市场字段准备，可直接复制到
<code>ClassIsland/PluginIndex/index/plugins-v2/</code>；插件包内的 <code>manifest.yml</code> 与该描述文件保持一致。

需要本地构建时：

~~~powershell
dotnet publish server/RemoteCI.Server/RemoteCI.Server.csproj -c Release -r win-x64 --self-contained false
dotnet build plugin/RemoteCI.Plugin/RemoteCI.Plugin.csproj -c Release -p:CreateCipx=true
cd android
.\gradlew.bat assembleDebug
cd ../wearos
.\gradlew.bat assembleDebug
~~~

## 连接插件与客户端

- 插件的云端服务地址填写 <code>https://remoteci.example.com</code>，在 WebUI 概览页生成配对码后填入插件设置。
- 浏览器直接打开同一地址即可使用 WebUI 与手机网页。
- Android 与 Wear OS 的云端地址填写同一个地址；也可以扫描 WebUI 生成的登录二维码。
- 不要手写 <code>/api</code> 或 <code>/ws</code> 路径，客户端会自动拼接。

## 飞牛 fnOS

RemoteCI 同时以飞牛 fnOS 应用（FPK）形式发布，安装、端口配置与更新方式见[飞牛 fnOS 安装](./fnos.md)。
