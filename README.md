# XiaoMusic 自用改版

这是基于 [hanxi/xiaomusic](https://github.com/hanxi/xiaomusic) 修改的个人自用版本，主要围绕组合音箱双声道播放bug、默认 Web 播放器界面、歌词搜索、歌词显示、歌词时间轴同步和 NAS Docker 部署流程做了调整。

原项目版权和许可证仍归原作者及贡献者所有。本仓库只记录我在原项目基础上的二次修改，方便在自己的 NAS 上拉取、构建和更新。

## 修改内容

- 重新设计默认播放器首页 UI，使界面更简洁，并适配手机和电脑尺寸。
- 将定时、测试、倍速、设置等低频功能收进“更多”二级菜单。
- 歌曲下拉框选择歌曲后可直接播放，不再只是选中。
- 新增歌词面板，支持播放时按时间轴高亮当前歌词。
- 新增自动搜索歌词：播放或切歌时，本地没有歌词会自动在线匹配。
- 新增歌词本地保存：搜索到的歌词会写入歌曲标签，下次播放优先读取。
- 新增繁体转简体：在线歌词保存和显示前会转换为简体。
- 新增歌词搜索后端代理：
  - LRCLIB
  - QQ 音乐
  - 网易云音乐
  - 原在线插件兜底
- 新增歌词时间轴调整功能，放在“更多”菜单中。
- 歌词时间轴偏移会写入歌曲标签，换浏览器也能同步。
- 取消歌词时间轴调整的正负 10 秒限制。
- 固定歌词面板尺寸，避免歌词加载和切歌时页面跳动。
- 播放下一曲/上一曲后自动同步当前歌曲和歌词。
- 添加 NAS Docker 本地构建部署脚本 `deploy-xiaomusic-on-nas.sh`。

## 仓库地址

```bash
https://github.com/guguwio/xiaomusic.git
```

如果仓库设置为私有，NAS 拉取时需要 GitHub Token 或 SSH Deploy Key。

## 在 NAS 上拉取

SSH 登录 NAS 后，建议放在 `/volume1/docker` 下：

```bash
cd /volume1/docker
git clone https://github.com/guguwio/xiaomusic.git
```

如果仓库是私有仓库，GitHub 会要求输入账号和密码：

```text
Username: guguwio
Password: GitHub Personal Access Token
```

以后更新代码：

```bash
cd /volume1/docker/xiaomusic
git pull
```

## 使用 SSH Key 拉取私有仓库

也可以在 NAS 上创建 SSH Key：

```bash
ssh-keygen -t ed25519 -C "nas-xiaomusic"
cat ~/.ssh/id_ed25519.pub
```

把输出的公钥添加到 GitHub 仓库：

```text
仓库 Settings -> Deploy keys -> Add deploy key
```

如果 NAS 只需要拉取代码，不需要勾选 `Allow write access`。

然后使用 SSH 地址拉取：

```bash
cd /volume1/docker
git clone git@github.com:guguwio/xiaomusic.git
```

更新：

```bash
cd /volume1/docker/xiaomusic
git pull
```

## Docker Compose 部署

本项目默认容器端口仍是 `8090`，NAS 对外端口示例为 `58090`。

```yaml
services:
  xiaomusic:
    image: xiaomusic-local:codex
    container_name: xiaomusic
    environment:
      - XIAOMUSIC_PUBLIC_PORT=58090
      - TZ=Asia/Shanghai
    ports:
      - "58090:8090"
    volumes:
      - /volume1/docker/xiaomusic:/app/conf
      - /volume1/music:/app/music
    restart: "no"
```

构建并启动：

```bash
cd /volume1/docker/xiaomusic
docker build -t xiaomusic-local:codex .
docker compose up -d --force-recreate
```

访问地址：

```text
http://NAS_IP:58090
```

## 使用部署脚本

仓库内包含 `deploy-xiaomusic-on-nas.sh`，这是我用于把本地修改打包上传到 NAS 后重建容器的脚本。默认路径如下：

```text
源码构建目录：/volume1/docker/xiaomusic-build
应用配置目录：/volume1/docker/xiaomusic
音乐目录：/volume1/music
镜像名：xiaomusic-local:codex
容器名：xiaomusic
端口：58090:8090
```

如果已经把压缩包放到：

```text
/volume1/docker/xiaomusic-build/xiaomusic-main-deploy.tar.gz
```

可以执行：

```bash
cd /volume1/docker/xiaomusic-build
chmod +x deploy-xiaomusic-on-nas.sh
sudo sh ./deploy-xiaomusic-on-nas.sh
```

## 歌词功能说明

播放歌曲时，页面会按以下顺序加载歌词：

1. 读取歌曲标签里的本地歌词。
2. 如果没有歌词，自动尝试在线搜索。
3. 搜索命中后写入歌曲标签。
4. 下次播放同一首歌时直接读取本地标签。

歌词来源顺序：

```text
本地标签 -> LRCLIB -> QQ 音乐 -> 网易云音乐 -> 原在线插件
```

歌词时间轴偏移也会写入歌曲歌词标签中，格式为内部标记：

```text
[x-xiaomusic-offset:1.5]
```

页面显示时会隐藏这行标记，只用于同步歌词时间轴。

## 开发运行

安装依赖：

```bash
pdm install
```

启动：

```bash
pdm run xiaomusic.py
```

默认访问：

```text
http://localhost:8090
```

## 与原项目关系

本仓库不是原项目的官方版本。原始项目地址：

[https://github.com/hanxi/xiaomusic](https://github.com/hanxi/xiaomusic)

感谢原作者提供 XiaoMusic 的基础能力，包括小爱音箱播放、本地音乐管理、Docker 部署和 Web 控制台等。本仓库只是在这些基础上做个人化修改。

## 许可证

沿用原项目许可证。详见 [LICENSE](./LICENSE)。
