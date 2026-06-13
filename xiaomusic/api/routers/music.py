"""音乐管理路由"""

import base64
import html
import json
import urllib.parse

import aiohttp
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
)
from fastapi.responses import RedirectResponse

from xiaomusic.api.dependencies import (
    log,
    verification,
    xiaomusic,
)
from xiaomusic.api.models import (
    DidPlayMusic,
    MusicInfoObj,
    MusicInfosQuery,
    MusicItem,
)

router = APIRouter(dependencies=[Depends(verification)])


@router.get("/searchmusic")
def searchmusic(name: str = ""):
    """搜索音乐"""
    return xiaomusic.music_library.searchmusic(name)


"""======================在线搜索相关接口============================="""


def _normalize_lyric_keyword(value: str) -> str:
    """清理歌名中的文件后缀、括号和常见版本说明。"""
    text = (value or "").lower()
    for suffix in (".mp3", ".m4a", ".wav", ".flac", ".aac", ".ogg", ".ape"):
        if text.endswith(suffix):
            text = text[: -len(suffix)]
            break

    for left, right in (("【", "】"), ("[", "]"), ("(", ")"), ("（", "）")):
        while left in text and right in text:
            start = text.find(left)
            end = text.find(right, start + 1)
            if end < 0:
                break
            text = f"{text[:start]} {text[end + 1:]}"

    for word in ("official", "lyrics", "lyric", "audio", "mv", "live", "cover", "remix", "伴奏", "纯音乐", "完整版", "无损"):
        text = text.replace(word, " ")

    return " ".join(text.replace("-", " ").replace("_", " ").split())


def _parse_lyric_query(name: str) -> tuple[str, str, str]:
    cleaned = _normalize_lyric_keyword(name)
    parts = [part.strip() for part in cleaned.split(" ") if part.strip()]
    if "-" in (name or ""):
        raw_parts = [part.strip() for part in name.rsplit(".", 1)[0].split("-") if part.strip()]
        if len(raw_parts) >= 2:
            return raw_parts[0], raw_parts[-1], cleaned
    return cleaned, "", " ".join(parts)


def _netease_song_score(song: dict, track: str, artist: str) -> int:
    song_name = _normalize_lyric_keyword(song.get("name", ""))
    artists = song.get("artists") or []
    artist_name = _normalize_lyric_keyword(" ".join(item.get("name", "") for item in artists))
    track_name = _normalize_lyric_keyword(track)
    artist_query = _normalize_lyric_keyword(artist)
    score = 0
    if track_name and song_name == track_name:
        score += 50
    elif track_name and (track_name in song_name or song_name in track_name):
        score += 28
    if artist_query and artist_name == artist_query:
        score += 35
    elif artist_query and artist_name and (artist_query in artist_name or artist_name in artist_query):
        score += 18
    if "live" not in track_name and "live" in song_name:
        score -= 10
    if "remix" not in track_name and "remix" in song_name:
        score -= 10
    return score


def _qq_song_score(song: dict, track: str, artist: str) -> int:
    song_name = _normalize_lyric_keyword(song.get("songname", ""))
    singers = song.get("singer") or []
    artist_name = _normalize_lyric_keyword(" ".join(item.get("name", "") for item in singers))
    track_name = _normalize_lyric_keyword(track)
    artist_query = _normalize_lyric_keyword(artist)
    score = 0
    if track_name and song_name == track_name:
        score += 55
    elif track_name and (track_name in song_name or song_name in track_name):
        score += 30
    if artist_query and artist_name == artist_query:
        score += 35
    elif artist_query and artist_name and (artist_query in artist_name or artist_name in artist_query):
        score += 18
    if "live" not in track_name and "live" in song_name:
        score -= 10
    if "remix" not in track_name and "remix" in song_name:
        score -= 10
    return score


@router.get("/api/lyrics/qq")
async def search_qq_lyrics(name: str = Query(..., description="歌曲名")):
    """通过服务端代理搜索 QQ 音乐歌词。"""
    if not name:
        return {"success": False, "error": "Name required"}

    track, artist, query = _parse_lyric_query(name)
    search_keywords = []
    for item in (f"{track} {artist}".strip(), query, track, name):
        cleaned = _normalize_lyric_keyword(item)
        if cleaned and cleaned not in search_keywords:
            search_keywords.append(cleaned)

    timeout = aiohttp.ClientTimeout(total=8)
    headers = {
        "Accept": "application/json,text/plain,*/*",
        "Referer": "https://y.qq.com/",
        "User-Agent": "Mozilla/5.0 XiaoMusic",
    }

    try:
        async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
            for keyword in search_keywords:
                async with session.get(
                    "https://c.y.qq.com/soso/fcgi-bin/client_search_cp",
                    params={"format": "json", "w": keyword, "p": "1", "n": "8"},
                ) as response:
                    search_data = await response.json(content_type=None)

                songs = ((search_data.get("data") or {}).get("song") or {}).get("list") or []
                if not songs:
                    continue

                songs = sorted(songs, key=lambda item: _qq_song_score(item, track, artist), reverse=True)
                for song in songs[:4]:
                    songmid = song.get("songmid")
                    if not songmid:
                        continue
                    async with session.get(
                        "https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg",
                        params={"songmid": songmid, "format": "json", "nobase64": "1"},
                    ) as response:
                        lyric_data = await response.json(content_type=None)

                    lyric = html.unescape((lyric_data.get("lyric") or "").strip())
                    if lyric:
                        singers = song.get("singer") or []
                        artist_name = " / ".join(item.get("name", "") for item in singers if item.get("name"))
                        return {
                            "success": True,
                            "source": "qq",
                            "trackName": song.get("songname") or name,
                            "artistName": artist_name,
                            "lyrics": lyric,
                        }

        return {"success": False, "error": "No lyric found"}
    except Exception as e:
        log.warning(f"QQ 歌词搜索失败: {e}")
        return {"success": False, "error": str(e)}


def _lyric_candidate_score(candidate: dict, track: str, artist: str) -> int:
    candidate_track = _normalize_lyric_keyword(
        candidate.get("trackName") or candidate.get("name") or candidate.get("title") or ""
    )
    candidate_artist = _normalize_lyric_keyword(
        candidate.get("artistName") or candidate.get("artist") or ""
    )
    track_name = _normalize_lyric_keyword(track)
    artist_query = _normalize_lyric_keyword(artist)
    score = 0
    if candidate.get("syncedLyrics"):
        score += 40
    if candidate.get("plainLyrics"):
        score += 20
    if track_name and candidate_track == track_name:
        score += 45
    elif track_name and (track_name in candidate_track or candidate_track in track_name):
        score += 25
    if artist_query and candidate_artist == artist_query:
        score += 30
    elif artist_query and candidate_artist and (artist_query in candidate_artist or candidate_artist in artist_query):
        score += 14
    return score


@router.get("/api/lyrics/lrclib")
async def search_lrclib_lyrics(name: str = Query(..., description="歌曲名")):
    """通过服务端代理搜索 LRCLIB 歌词，避免浏览器跨域或直连失败。"""
    if not name:
        return {"success": False, "error": "Name required"}

    track, artist, query = _parse_lyric_query(name)
    queries = []
    if track and artist:
        queries.append({"track_name": track, "artist_name": artist})
    for item in (f"{track} {artist}".strip(), query, track, name):
        cleaned = _normalize_lyric_keyword(item)
        if cleaned and {"q": cleaned} not in queries:
            queries.append({"q": cleaned})

    timeout = aiohttp.ClientTimeout(total=8)
    headers = {
        "Accept": "application/json",
        "Lrclib-Client": "XiaoMusic Default UI",
        "User-Agent": "XiaoMusic/0.6.1",
    }

    try:
        connector = aiohttp.TCPConnector(ssl=False)
        async with aiohttp.ClientSession(timeout=timeout, headers=headers, connector=connector) as session:
            for params in queries:
                async with session.get("https://lrclib.net/api/search", params=params) as response:
                    if response.status != 200:
                        continue
                    results = await response.json(content_type=None)
                candidates = [item for item in results if item.get("syncedLyrics") or item.get("plainLyrics")]
                if not candidates:
                    continue

                candidate = sorted(
                    candidates,
                    key=lambda item: _lyric_candidate_score(item, track, artist),
                    reverse=True,
                )[0]
                lyrics = candidate.get("syncedLyrics") or candidate.get("plainLyrics") or ""
                if lyrics.strip():
                    return {
                        "success": True,
                        "source": "lrclib",
                        "trackName": candidate.get("trackName") or name,
                        "artistName": candidate.get("artistName") or "",
                        "lyrics": lyrics,
                    }

        return {"success": False, "error": "No lyric found"}
    except Exception as e:
        log.warning(f"LRCLIB 歌词搜索失败: {e}")
        return {"success": False, "error": str(e)}


@router.get("/api/lyrics/netease")
async def search_netease_lyrics(name: str = Query(..., description="歌曲名")):
    """通过服务端代理搜索网易云歌词，避免浏览器跨域问题。"""
    if not name:
        return {"success": False, "error": "Name required"}

    track, artist, query = _parse_lyric_query(name)
    search_keyword = f"{track} {artist}".strip() or query or name
    timeout = aiohttp.ClientTimeout(total=7)
    headers = {
        "Accept": "application/json,text/plain,*/*",
        "Referer": "https://music.163.com/",
        "User-Agent": "Mozilla/5.0 XiaoMusic",
    }

    try:
        async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
            search_params = {
                "csrf_token": "",
                "s": search_keyword,
                "type": "1",
                "offset": "0",
                "total": "true",
                "limit": "8",
            }
            async with session.get(
                "https://music.163.com/api/search/get/web",
                params=search_params,
            ) as response:
                search_data = await response.json(content_type=None)

            songs = (search_data.get("result") or {}).get("songs") or []
            if not songs:
                return {"success": False, "error": "No songs matched"}

            song = sorted(
                songs,
                key=lambda item: _netease_song_score(item, track, artist),
                reverse=True,
            )[0]

            async with session.get(
                "https://music.163.com/api/song/lyric",
                params={"id": song.get("id"), "lv": "1", "kv": "1", "tv": "-1"},
            ) as response:
                lyric_data = await response.json(content_type=None)

            lyric = ((lyric_data.get("lrc") or {}).get("lyric") or "").strip()
            if not lyric:
                return {"success": False, "error": "No lyric found"}

            artists = song.get("artists") or []
            artist_name = " / ".join(item.get("name", "") for item in artists if item.get("name"))
            return {
                "success": True,
                "source": "netease",
                "trackName": song.get("name") or name,
                "artistName": artist_name,
                "lyrics": lyric,
            }
    except Exception as e:
        log.warning(f"网易云歌词搜索失败: {e}")
        return {"success": False, "error": str(e)}


@router.get("/api/search/online")
async def search_online_music(
    keyword: str = Query(..., description="搜索关键词"),
    plugin: str = Query("all", description="指定插件名称，all表示搜索所有插件"),
    page: int = Query(1, description="页码"),
    limit: int = Query(20, description="每页数量"),
    api_type: int = Query(
        None, description="接口类型：1=MusicFree，2=LXServer"
    ),  # 🌟 接收前端传来的 api_type
):
    """在线音乐搜索API"""
    try:
        if not keyword:
            return {"success": False, "error": "Keyword required"}

        return await xiaomusic.get_music_list_online(
            keyword=keyword, plugin=plugin, page=page, limit=limit, api_type=api_type
        )
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/api/search/online_playlist")
async def search_online_playlist(
    keyword: str = Query(..., description="搜索关键词"),
    plugin: str = Query("all", description="指定平台名称"),
    page: int = Query(1, description="页码"),
    limit: int = Query(20, description="每页数量"),
    api_type: int = Query(None, description="接口类型：1=MusicFree，2=LXServer"),
):
    """在线歌单搜索API"""
    try:
        if not keyword:
            return {"success": False, "error": "Keyword required"}

        return await xiaomusic.get_playlist_online(
            keyword=keyword, plugin=plugin, page=page, limit=limit, api_type=api_type
        )
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/api/search/online_playlist_detail")
async def search_online_playlist_detail(
    id: str = Query(..., description="歌单ID"),
    plugin: str = Query(..., description="平台名称(如wy/kg)"),
    api_type: int = Query(..., description="接口类型：1=MusicFree，2=LXServer"),
):
    """在线歌单详情获取API (歌单转歌曲)"""
    try:
        # 逻辑上 id, plugin, api_type 均由 Query(...) 强制要求，无需额外 if 判断
        return await xiaomusic.get_playlist_detail_online(
            id=id, plugin=plugin, api_type=api_type
        )
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/api/proxy/real-url")
async def get_real_music_url(url: str = Query(..., description="原始url")):
    """通过服务端代理获取真实的URL，不止是音频url,可能还有图片url"""
    try:
        # 获取真实的URL
        real_url = await xiaomusic.get_real_url_of_openapi(url)
        # 直接重定向到真实URL
        return RedirectResponse(url=real_url)

    except Exception as e:
        log.error(f"获取真实URL失败: {e}")
        # 如果代理获取失败，重定向到原始URL
        return RedirectResponse(url=url)


@router.get("/api/proxy/plugin-url")
async def get_plugin_source_url(
    data: str = Query(..., description="json对象压缩的base64"),
):
    try:
        # 获取请求数据
        # 容错处理1：将 URL 传输中可能被误转为空格的 '+' 还原回去（win平台）
        data = data.replace(" ", "+")
        # 2. 容错处理：自动补全 Base64 缺失的 '=' 填充符（Linux平台）
        missing_padding = len(data) % 4
        if missing_padding:
            data += "=" * (4 - missing_padding)

        # 将Base64编码的URL解码为Json字符串
        json_str = base64.b64decode(data).decode("utf-8")
        # 将json字符串转换为json对象
        json_data = json.loads(json_str)
        # 调用公共函数处理
        media_source = await xiaomusic.online_music_service.get_media_source_url(
            json_data
        )
        if media_source and media_source.get("url"):
            source_url = media_source.get("url")
            log.info(f"plugin-url 成功解析: {json_data} -> {source_url}")
            return RedirectResponse(url=source_url)
        else:
            # 没有有效链接时，直接抛出 404 错误！
            log.warning(f"plugin-url 解析失败(链接为空): {json_data}")
            raise HTTPException(status_code=404, detail="获取真实音频链接为空")

    except HTTPException:
        # 允许 HTTPException 继续向上传递，确保 404 能被前线捕获
        raise
    except Exception as e:
        log.error(f"获取真实音乐URL失败: {e}")
        # 发生其他未知异常时，同样抛出错误
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/api/play/getMediaSource")
async def get_media_source(request: Request):
    """获取音乐真实播放URL"""
    try:
        # 获取请求数据
        data = await request.json()
        # 调用公共函数处理
        return await xiaomusic.online_music_service.get_media_source_url(data)
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/api/play/getLyric")
async def get_media_lyric(request: Request):
    """获取音乐歌词"""
    try:
        # 获取请求数据
        data = await request.json()
        # 调用公共函数处理
        return await xiaomusic.get_media_lyric(data)
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/api/device/pushUrl")
async def device_push_url(request: Request):
    """推送url给设备端播放"""
    try:
        # 获取请求数据
        data = await request.json()
        did = data.get("did")
        openapi_info = xiaomusic.js_plugin_manager.get_lx_server_info()
        if openapi_info.get("enabled", False):
            url = data.get("url")
        else:
            # 调用公共函数处理,获取音乐真实播放URL
            url = xiaomusic.get_plugin_proxy_url(data)
        decoded_url = urllib.parse.unquote(url)
        return await xiaomusic.play_url(did=did, arg1=decoded_url)
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/api/device/pushList")
async def device_push_list(request: Request):
    """WEB前端推送歌单给设备端播放"""
    try:
        # 获取请求数据
        data = await request.json()
        did = data.get("did")
        song_list = data.get("songList")
        list_name = data.get("playlistName")
        # 调用公共函数处理,处理歌曲信息 -> 添加歌单 -> 播放歌单
        return await xiaomusic.push_music_list_play(
            did=did, song_list=song_list, list_name=list_name
        )
    except Exception as e:
        return {"success": False, "error": str(e)}


"""======================在线搜索相关接口END============================="""


@router.get("/playingmusic")
def playingmusic(did: str = ""):
    """当前播放音乐"""
    if not xiaomusic.did_exist(did):
        return {"ret": "Did not exist"}

    is_playing = xiaomusic.isplaying(did)
    cur_music = xiaomusic.playingmusic(did)
    cur_playlist = xiaomusic.get_cur_play_list(did)
    # 播放进度
    offset, duration = xiaomusic.get_offset_duration(did)
    return {
        "ret": "OK",
        "is_playing": is_playing,
        "cur_music": cur_music,
        "cur_playlist": cur_playlist,
        "offset": offset,
        "duration": duration,
    }


@router.get("/musiclist")
async def musiclist():
    """音乐列表"""
    return xiaomusic.music_library.get_music_list()


@router.get("/musicinfo")
async def musicinfo(name: str, musictag: bool = False):
    """音乐信息"""
    url, _ = await xiaomusic.music_library.get_music_url(name)
    info = {
        "ret": "OK",
        "name": name,
        "url": url,
    }
    if musictag:
        info["tags"] = await xiaomusic.music_library.get_music_tags(name)
    return info


@router.get("/musicinfos")
async def musicinfos(
    name: list[str] = Query(None),
    musictag: bool = False,
):
    """批量音乐信息"""
    ret = []
    for music_name in name:
        url, _ = await xiaomusic.music_library.get_music_url(music_name)
        info = {
            "name": music_name,
            "url": url,
        }
        if musictag:
            info["tags"] = await xiaomusic.music_library.get_music_tags(music_name)
        ret.append(info)
    return ret


@router.post("/musicinfos")
async def musicinfos_post(data: MusicInfosQuery):
    """批量音乐信息（POST，避免 URL 过长）"""
    ret = []
    for music_name in data.name:
        url, _ = await xiaomusic.music_library.get_music_url(music_name)
        info = {
            "name": music_name,
            "url": url,
        }
        if data.musictag:
            info["tags"] = await xiaomusic.music_library.get_music_tags(music_name)
        ret.append(info)
    return ret


@router.post("/setmusictag")
async def setmusictag(info: MusicInfoObj):
    """设置音乐标签"""
    ret = xiaomusic.music_library.set_music_tag(info.musicname, info)
    return {"ret": ret}


@router.post("/delmusic")
async def delmusic(data: MusicItem):
    """删除音乐"""
    log.info(data)
    await xiaomusic.del_music(data.name)
    return "success"


@router.post("/playmusic")
async def playmusic(data: DidPlayMusic):
    """播放音乐"""
    did = data.did
    musicname = data.musicname
    searchkey = data.searchkey
    if not xiaomusic.did_exist(did):
        return {"ret": "Did not exist"}

    log.info(f"playmusic {did} musicname:{musicname} searchkey:{searchkey}")
    await xiaomusic.do_play(did, musicname, searchkey)
    return {"ret": "OK"}


@router.post("/refreshmusictag")
async def refreshmusictag(Verifcation=Depends(verification)):
    """刷新音乐标签"""
    xiaomusic.music_library.refresh_music_tag()
    return {
        "ret": "OK",
    }


@router.post("/debug_play_by_music_url")
async def debug_play_by_music_url(request: Request, Verifcation=Depends(verification)):
    """调试播放音乐URL"""
    try:
        data = await request.body()
        data_dict = json.loads(data.decode("utf-8"))
        log.info(f"data:{data_dict}")
        return await xiaomusic.debug_play_by_music_url(arg1=data_dict)
    except json.JSONDecodeError as err:
        raise HTTPException(status_code=400, detail="Invalid JSON") from err


@router.post("/api/music/refreshlist")
async def refreshlist(Verifcation=Depends(verification)):
    """刷新歌曲列表"""
    await xiaomusic.gen_music_list()
    return {
        "ret": "OK",
    }
