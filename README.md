# XiaoMusic 自用改版

这是我基于 [hanxi/xiaomusic](https://github.com/hanxi/xiaomusic) 修改的个人自用版本，主要围绕组合音箱双声道播放 bug、默认 Web 播放器界面、移动端适配、歌词搜索、歌词显示、歌词时间轴同步和公网拉取部署流程做了调整。

原项目版权和许可证仍归原作者及贡献者所有。本仓库用于记录我在原项目基础上的二次修改，方便在自己的 NAS 或服务器上直接从 GitHub 拉取、构建和更新。

## 修改内容

- 修复或优化组合音箱双声道播放相关问题。
- 重新设计默认播放器首页 UI，让界面更简洁，并适配手机和电脑尺寸。
- 将定时、测试、倍速、设置等低频功能收进“更多”二级菜单。
- 歌曲下拉框选择歌曲后可直接播放，不再只是选中。
- 新增歌词面板，支持播放时按时间轴高亮当前歌词。
- 新增播放或切歌时自动搜索下载歌词。
- 新增歌词本地保存：搜索到的歌词会写入歌曲标签，下次播放优先读取。
- 新增繁体转简体：在线歌词保存和显示前会转换为简体。
- 优化歌词搜索速度和命中率，增加多个在线来源：
  - LRCLIB
  - QQ 音乐
  - 网易云音乐
  - 原在线插件兜底
- 新增歌词时间轴调整功能，并放入“更多”菜单。
- 歌词时间轴偏移会写入歌曲文件标签，换浏览器或换设备访问也能同步。
- 取消歌词时间轴调整的正负 10 秒限制。
- 固定歌词面板尺寸，避免歌词加载和切歌时页面跳动。
- 播放下一曲、上一曲后自动同步当前歌曲和歌词。

## 仓库地址

```bash
https://github.com/guguwio/xiaomusic.git
```

## 公网拉取部署

本仓库已设置为公开仓库，可以直接在 NAS、服务器或本地 Docker 环境中通过公网拉取。

```bash
git clone https://github.com/guguwio/xiaomusic.git
cd xiaomusic
```

如果已经拉取过，以后更新代码：

```bash
cd xiaomusic
git pull
```

## Docker 部署

下面的 `guguwio/xiaomusic:latest` 是在本机或 NAS 上通过当前仓库源码构建出来的镜像标签。项目代码仍然通过前面的 `git clone https://github.com/guguwio/xiaomusic.git` 拉取。

进入项目目录后构建镜像：

```bash
docker build -t guguwio/xiaomusic:latest .
```

启动容器示例：

```bash
docker run -d \
  --name xiaomusic \
  -p 58090:8090 \
  -e TZ=Asia/Shanghai \
  -e XIAOMUSIC_PUBLIC_PORT=58090 \
  -v /volume1/docker/xiaomusic:/app/conf \
  -v /volume1/music:/app/music \
  --restart unless-stopped \
  guguwio/xiaomusic:latest
```

访问地址：

```text
http://你的服务器IP:58090
```

如果需要重新部署：

```bash
docker stop xiaomusic
docker rm xiaomusic
git pull
docker build -t guguwio/xiaomusic:latest .
docker run -d \
  --name xiaomusic \
  -p 58090:8090 \
  -e TZ=Asia/Shanghai \
  -e XIAOMUSIC_PUBLIC_PORT=58090 \
  -v /volume1/docker/xiaomusic:/app/conf \
  -v /volume1/music:/app/music \
  --restart unless-stopped \
  guguwio/xiaomusic:latest
```

## Docker Compose 部署

也可以在项目目录中新建 `docker-compose.yml`：

```yaml
services:
  xiaomusic:
    build: .
    image: guguwio/xiaomusic:latest
    container_name: xiaomusic
    environment:
      - XIAOMUSIC_PUBLIC_PORT=58090
      - TZ=Asia/Shanghai
    ports:
      - "58090:8090"
    volumes:
      - /volume1/docker/xiaomusic:/app/conf
      - /volume1/music:/app/music
    restart: unless-stopped
```

启动：

```bash
docker compose up -d --build
```

更新：

```bash
git pull
docker compose up -d --build
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
