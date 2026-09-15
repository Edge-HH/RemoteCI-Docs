---
title: 飞牛 fnOS 安装
icon: box
order: 4
---

# 飞牛 fnOS 安装

RemoteCI 以飞牛 fnOS 应用（`.fpk`）形式发布，采用 Docker 应用形态：容器内运行 RemoteCI WebUI，数据保存在 fnOS 数据卷，可由应用中心统一管理启动、停止和升级。稳定版本使用四段纯数字标签（当前为 `3.2.1.4`），Beta 使用 `v3.x.x-beta.y` 且不进入插件市场；旧 `v3.2.0` 安装的首次迁移需要手动安装新 FPK。

## 安装包与镜像

每个 GitHub Release 都会附带：

- `RemoteCI-<版本>.fpk`：约 45 KB 的在线多架构包，安装时从 GHCR 拉取镜像。
- `RemoteCI-<版本>-fnos-x86_64-offline.fpk`：约 116 MB，内置 amd64 镜像的 x86_64 离线包。
- `RemoteCI-<版本>-fnos-arm64-offline.fpk`：约 112 MB，内置 arm64 镜像的 ARM64 离线包。
- `ghcr.io/edge-hh/remoteci:<版本>`：多架构 Docker 镜像（linux/amd64 与 linux/arm64），由发布流水线自动构建并推送。

离线包的实际体积会随镜像压缩结果变化。网络可以稳定访问 GHCR 时可选在线包；网络较慢或不可达时应选与 NAS 架构一致的离线包。离线包会先校验归档、架构、版本标签和 Image ID，再执行 `docker load`，不会回退到 GHCR。飞牛应用中心把 Intel/AMD 设备记为 `x86`，这不是 32 位；请继续使用 `x86_64-offline` 包。

离线镜像在 `install_init`/`upgrade_init` 阶段导入。此时应用数据临时目录可能尚未创建，加载器会使用应用中心已经准备好的安装解压目录或系统可写临时目录。生命周期脚本需要访问 fnOS Docker daemon，因此由应用中心以 `root` 执行；RemoteCI 服务本身仍运行在应用中心管理的容器内。

镜像包需保持 Public，否则在线 FPK 无法匿名拉取。当前 FPK 仅通过 GitHub Releases 分发，尚未提交飞牛应用商店。

## 安装步骤

1. 从 GitHub Releases 下载在线包，或与设备架构匹配的离线包。
2. 打开飞牛 fnOS 的"应用中心"，选择"手动安装"，选中该 fpk 文件。
3. 按安装向导填写：
   - Web 服务端口（默认 8080，桌面入口会跟随该端口）。
   - 管理员初始密码（至少 8 位；留空则首次启动随机生成并写入应用日志）。
   - 插件一次性配对码（留空则首次启动随机生成并写入应用日志）。
4. 安装完成后，从飞牛桌面打开 RemoteCI 入口（默认以新标签页打开 `http://NAS-IP:端口/`），用 `admin` 和初始密码登录。

::: tip 数据位置
SQLite 数据库保存在 `/var/apps/remoteci/var/data`（即安装时选择的存储卷），删除或升级应用不会丢失数据。
:::

## 更新

WebUI 登录后进入“系统配置 → 系统更新”（管理员可见），该面板提示更新由 fnOS 应用中心管理，不会在容器内下载或安装 FPK。

::: tip 更新入口
请从 GitHub Releases 下载新版本 FPK，再在 fnOS 应用中心手动安装。在线包和同架构离线包可以相互覆盖升级，应用中心会重建容器，SQLite 数据卷保持不变。
:::

## 常见问题

### 桌面入口打不开

确认 `manifest.service_port`、compose 的端口映射和入口 `port` 三者一致；安装向导中修改过端口时，入口会自动使用向导值。

### 容器一直显示未运行

检查 `cmd/main` 中的 `CONTAINER_NAME` 是否与 `docker-compose.yaml` 的 `container_name` 一致（当前均为 `remoteci`）。在线包还需确认 NAS 可以访问 `ghcr.io`；离线包应检查应用中心安装日志中的镜像校验和导入错误。

### 镜像拉取失败

该问题只影响在线包。确认镜像在 GHCR 中为 Public，且 NAS 网络可以访问 `ghcr.io`；也可以改装与设备架构一致的离线 FPK。

### 离线包提示架构不匹配

x86_64 / Intel / AMD 设备使用文件名含 `x86_64-offline` 的包，ARM64 设备使用 `arm64-offline` 包。飞牛应用中心会把 64 位 Intel 设备标成 `x86`、把 ARM64 标成 `arm`，安装脚本把它们分别视为 `amd64` 与 `arm64`，不会因此拒绝安装。真正的 32 位 `i386` 仍会失败，当前也没有单独的 32 位离线包。错误架构会被拒绝，且不会改动现有数据。

### 离线镜像导入失败

如果应用中心回滚安装，请检查 `/var/log/apps/remoteci.log` 和应用中心错误日志。加载器会明确报告临时目录不可写、Docker daemon 权限不足、归档哈希错误或 `docker load` 失败；修复后的安装包不会尝试创建尚不存在的应用数据临时目录，并由 fnOS 生命周期权限访问 Docker daemon。

## 开发与打包

FPK 工程位于仓库 `fnos/` 目录，打包命令、三种产物和离线镜像校验说明见 `fnos/README.md`；fnOS 应用包格式的调研笔记保存在仓库 `research/fnos-fpk-packaging.md`。
