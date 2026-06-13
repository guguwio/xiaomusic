// ============ 字体加载检测 ============
// 检测字体加载完成，避免图标文字闪烁
(function () {
  // 使用 Promise.race 实现超时保护
  const fontLoadTimeout = new Promise((resolve) => {
    setTimeout(() => {
      console.warn("字体加载超时，强制显示图标");
      resolve("timeout");
    }, 3000);
  });

  const fontLoadReady = document.fonts.ready.then(() => "loaded");

  Promise.race([fontLoadReady, fontLoadTimeout])
    .then((result) => {
      document.body.classList.add("fonts-loaded");
      if (result === "loaded") {
        console.log("Material Icons 字体加载完成");
      }
    })
    .catch((error) => {
      console.error("字体加载检测失败:", error);
      // 出错时也显示图标，避免永久隐藏
      document.body.classList.add("fonts-loaded");
    });
})();

// $(function () {

// })

// ============ 无障碍辅助函数 ============

// 屏幕阅读器状态通知函数
function announceToScreenReader(message) {
  const announcer = document.getElementById("sr-announcer");
  if (announcer) {
    announcer.textContent = "";
    setTimeout(() => {
      announcer.textContent = message;
    }, 100);
  }
}

// 批量填充 select 选项（优化读屏性能）
function fillSelectOptions(
  selectElement,
  options,
  selectedValue,
  announceMessage,
) {
  const $select = $(selectElement);

  // 设置忙碌状态，告知读屏软件正在加载
  $select.attr("aria-busy", "true");

  // 构建所有 option 的 HTML 字符串
  const optionsHtml = options
    .map((opt) => {
      const isSelected = opt.value === selectedValue;
      const selectedAttr = isSelected ? " selected" : "";
      // 转义 HTML 特殊字符
      const escapedText = $("<div>").text(opt.text).html();
      const escapedValue = $("<div>").text(opt.value).html();
      return `<option value="${escapedValue}"${selectedAttr}>${escapedText}</option>`;
    })
    .join("");

  // 一次性设置所有选项
  $select.html(optionsHtml);

  // 恢复状态
  $select.attr("aria-busy", "false");

  // 通知读屏软件加载完成
  if (announceMessage) {
    announceToScreenReader(announceMessage);
  }
}

// 弹窗焦点管理
let lastFocusedElement = null;
const openDialogs = new Set();

function openDialog(dialogId) {
  const dialog = document.getElementById(dialogId);
  if (!dialog) return;

  // 保存当前焦点元素
  lastFocusedElement = document.activeElement;

  // 显示遮罩层
  const overlay = document.getElementById("component-overlay");
  if (overlay) {
    overlay.style.display = "block";
    setTimeout(() => overlay.classList.add("show"), 10);
  }

  // 显示弹窗
  dialog.style.display = "block";
  setTimeout(() => dialog.classList.add("show"), 10);
  openDialogs.add(dialogId);

  // 将焦点移到弹窗内第一个可交互元素
  setTimeout(() => {
    const firstFocusable = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )[0];
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }, 100);
}

function closeDialog(dialogId) {
  const dialog = document.getElementById(dialogId);
  if (!dialog) return;

  // 隐藏弹窗动画
  dialog.classList.remove("show");
  openDialogs.delete(dialogId);

  // 如果没有其他打开的弹窗，隐藏遮罩层
  if (openDialogs.size === 0) {
    const overlay = document.getElementById("component-overlay");
    if (overlay) {
      overlay.classList.remove("show");
      setTimeout(() => (overlay.style.display = "none"), 300);
    }
  }

  // 延迟隐藏弹窗以显示动画
  setTimeout(() => {
    dialog.style.display = "none";
  }, 300);

  // 恢复焦点到触发按钮
  if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

// 关闭所有弹窗
function closeAllDialogs() {
  const dialogs = Array.from(openDialogs);
  dialogs.forEach((dialogId) => closeDialog(dialogId));
}

// 更新进度条 ARIA 属性
function updateProgressAria(currentTime, totalTime) {
  const progress = document.getElementById("progress");
  if (progress) {
    const percentage =
      totalTime > 0 ? Math.round((currentTime / totalTime) * 100) : 0;
    progress.setAttribute("aria-valuenow", percentage);

    const currentMin = Math.floor(currentTime / 60);
    const currentSec = Math.floor(currentTime % 60);
    const totalMin = Math.floor(totalTime / 60);
    const totalSec = Math.floor(totalTime % 60);
    progress.setAttribute(
      "aria-valuetext",
      `已播放 ${currentMin} 分 ${currentSec} 秒，共 ${totalMin} 分 ${totalSec} 秒`,
    );
  }
}

// 更新音量滑块 ARIA 属性
function updateVolumeAria(volume) {
  const volumeSlider = document.getElementById("volume");
  if (volumeSlider) {
    volumeSlider.setAttribute("aria-valuenow", volume);
  }
}

// 更新收藏按钮 ARIA 属性
function updateFavoriteAria(isFavorited) {
  const favoriteBtn = document.querySelector(".favorite");
  if (favoriteBtn) {
    favoriteBtn.setAttribute(
      "aria-label",
      isFavorited ? "取消收藏" : "收藏歌曲",
    );
  }
}

// 更新语音口令开关 ARIA 属性
function updatePullAskAria(isEnabled) {
  const toggle = document.getElementById("pullAskToggle");
  if (toggle) {
    toggle.setAttribute("aria-checked", isEnabled ? "true" : "false");
  }
}

// ============ 原有代码 ============

let isPlaying = false;
let playModeIndex = 2;
//重新设计playModes
const playModes = {
  0: {
    icon: "repeat_one",
    cmd: "单曲循环",
  },
  1: {
    icon: "repeat",
    cmd: "全部循环",
  },
  2: {
    icon: "shuffle",
    cmd: "随机播放",
  },
  3: {
    icon: "filter_1",
    cmd: "单曲播放",
  },
  4: {
    icon: "playlist_play",
    cmd: "顺序播放",
  },
};

let favoritelist = []; //收藏列表
let currentLyrics = [];
let lyricLines = [];
let currentLyricMusic = "";
let autoLyricSearchMusic = "";
let isAutoLyricSearching = false;
let suppressMusicSelectChange = false;
let currentLyricOffset = 0;
let currentLyricText = "";

// ============ 本机播放器状态管理 ============

// 本机播放器状态管理对象
const WebPlayer = {
  // 获取当前播放列表名称
  getPlaylist: function () {
    return localStorage.getItem("web_playlist") || "全部";
  },

  // 设置当前播放列表
  setPlaylist: function (playlist) {
    localStorage.setItem("web_playlist", playlist);
  },

  // 获取当前播放歌曲
  getCurrentMusic: function () {
    return localStorage.getItem("web_current_music") || "";
  },

  // 设置当前播放歌曲
  setCurrentMusic: function (music) {
    localStorage.setItem("web_current_music", music);
  },

  // 获取播放模式
  getPlayMode: function () {
    const mode = localStorage.getItem("web_play_mode");
    return mode !== null ? parseInt(mode) : 2; // 默认随机播放
  },

  // 设置播放模式
  setPlayMode: function (mode) {
    localStorage.setItem("web_play_mode", mode.toString());
  },

  // 获取播放列表数组
  getPlayList: function () {
    const list = localStorage.getItem("web_play_list");
    return list ? JSON.parse(list) : [];
  },

  // 设置播放列表数组
  setPlayList: function (list) {
    localStorage.setItem("web_play_list", JSON.stringify(list));
  },

  // 获取当前播放索引
  getCurrentIndex: function () {
    const index = localStorage.getItem("web_current_index");
    return index !== null ? parseInt(index) : -1;
  },

  // 设置当前播放索引
  setCurrentIndex: function (index) {
    localStorage.setItem("web_current_index", index.toString());
  },

  // 获取音量
  getVolume: function () {
    const volume = localStorage.getItem("web_volume");
    return volume !== null ? parseInt(volume) : 50;
  },

  // 设置音量
  setVolume: function (volume) {
    localStorage.setItem("web_volume", volume.toString());
  },

  // 检查是否已收藏（直接使用全局 favoritelist，数据来源于服务器）
  isFavorited: function (music) {
    return Array.isArray(favoritelist) && favoritelist.includes(music);
  },
};

let lastMusicName = "";  // 上一首播放的歌曲名
// 本机播放：加载并播放指定歌曲
function loadAndPlayMusic(musicName) {
  console.log("loadAndPlayMusic:", musicName);

  const audioElement = document.getElementById("audio");
  const playMusicIcon = document.getElementById('playPauseIcon');
  // 2. 判断：切换了新歌曲 → 重新加载播放
  if (musicName !== lastMusicName) {
    // 停止上一首歌曲
    if (audioElement) {
      audioElement.pause();
    }

    // 向后端请求歌曲地址（你原来的接口，自动编码参数，解决&截断问题）
    $.get("/musicinfo", { name: musicName, musictag: true }, function (data) {
      if (data.ret !== "OK" || !data.url) {
        alert("歌曲地址获取失败！");
        return;
      }
      // 设置音频源
      audioElement.src = data.url;
      // 播放音频
      audioElement.play()
          .then(() => {
              console.log("播放成功:", musicName);
              // 更新本机播放状态
              WebPlayer.setCurrentMusic(musicName);

              // 更新播放列表和索引
              const playlist = $("#music_list").val();
              WebPlayer.setPlaylist(playlist);

              const playList = WebPlayer.getPlayList();
              const index = playList.indexOf(musicName);
              if (index !== -1) {
                  WebPlayer.setCurrentIndex(index);
              }
              // 更新 UI
              updateWebPlayingUI();
              // 更新收藏按钮状态
              updateWebFavoriteButton();
          })
          .catch((error) => {
              console.error("播放失败:", error);
              alert("播放失败: " + error.message);
          });

      isPlaying = true;
      lastMusicName = musicName;
      const tagLyrics = data.tags && data.tags.lyrics ? data.tags.lyrics : "";
      loadLyricsForMusic(musicName, tagLyrics);
      // 切换为暂停图标
      playMusicIcon.textContent = 'pause_circle_outline';

      // 监听：歌曲播放完毕 → 自动切回播放图标
      audioElement.addEventListener("ended", function () {
      isPlaying = false;
      playMusicIcon.textContent = "play_circle_outline";
      });
    }).fail(function () {
      alert("请求歌曲信息失败！");
    });

    return;
  }

// 3. 同一首歌曲 → 播放/暂停 切换
  if (isPlaying) {
    // 当前正在播放 → 暂停
    audioElement.pause();
    isPlaying = false;
    playMusicIcon.textContent = "play_circle_outline";
  } else {
    // 当前已暂停 → 继续播放
    audioElement.play();
    isPlaying = true;
    // 切换为暂停图标
    playMusicIcon.textContent = 'pause_circle_outline';
  }

}

function webPlay() {
  console.log("webPlay");
  const music_name = $("#music_name").val();

  if (!music_name) {
    alert("请选择要播放的歌曲");
    return;
  }

  // 获取当前播放列表
  const playlist = $("#music_list").val();
  const playlistData = $("#music_name option")
    .map(function () {
      return $(this).val();
    })
    .get();

  // 保存播放列表到 localStorage
  WebPlayer.setPlayList(playlistData);
  WebPlayer.setPlaylist(playlist);

  // 加载并播放歌曲
  loadAndPlayMusic(music_name);
}

function play() {
  var did = $("#did").val();
  if (did == "web_device") {
    webPlay();
  } else {
    toggleDevicePlay();
  }
}

function toggleDevicePlay() {
  var did = $("#did").val();
  var url = isPlaying ? "/device/pause" : "/device/resume";
  $.ajax({
    type: "POST",
    url: url,
    contentType: "application/json; charset=utf-8",
    data: JSON.stringify({ did: did }),
    success: () => {
      isPlaying = !isPlaying;
      $("#playPauseIcon").text(isPlaying ? "pause_circle_outline" : "play_circle_outline");
    },
    error: () => {
      console.log("toggle device play failed");
    },
  });
}

function playOnDevice() {
  console.log("playOnDevice");
  var music_list = $("#music_list").val();
  var music_name = $("#music_name").val();
  if (no_warning) {
    do_play_music_list(music_list, music_name);
    return;
  }
  $.get(`/musicinfo?name=${music_name}`, function (data, status) {
    console.log(data);
    if (data.ret == "OK") {
      console.log(
        "%cmd.js:42 validHost(data.url) ",
        "color: #007acc;",
        validHost(data.url),
      );
      validHost(data.url) && do_play_music_list(music_list, music_name);
    }
  });
}
function stopPlay() {
  var did = $("#did").val();

  if (did == "web_device") {
    // 本机播放：停止播放
    const audioElement = document.getElementById("audio");
    audioElement.pause();
    audioElement.currentTime = 0;
    // 更新 UI
    updateWebPlayingUI();

    console.log("本机停止播放");
  } else {
    // 设备播放：调用后端接口
    $.ajax({
      type: "POST",
      url: "/device/stop",
      contentType: "application/json; charset=utf-8",
      data: JSON.stringify({
        did: did,
      }),
      success: () => {
        console.log("stop play succ");
      },
      error: () => {
        console.log("stop play failed");
      },
    });
  }
}

function prevTrack() {
  var did = $("#did").val();
  audioElement = document.getElementById("audio");
  audioElement.removeAttribute('src')
  audioElement.pause();
  if (did == "web_device") {
    // 本机播放：播放上一首
    webPlayPrevious();
  } else {
    // 设备播放：发送命令
    sendcmd("上一首");
    show_now_player_music_name();
  }
}

function nextTrack() {
  var did = $("#did").val();
  audioElement = document.getElementById("audio");
  audioElement.removeAttribute('src')
  audioElement.pause();
  if (did == "web_device") {
    // 本机播放：播放下一首
    webPlayNext();
  } else {
    // 设备播放：发送命令
    sendcmd("下一首");

    show_now_player_music_name();
  }
}

function normalizePlayingMusicName(text) {
  return String(text || "")
    .replace(/^【(?:播放中|空闲中|暂停中|暂停)】\s*/, "")
    .trim();
}

function syncSelectedMusic(musicName, shouldLoadLyrics = true) {
  const name = normalizePlayingMusicName(musicName);
  if (!name) return;

  const $musicSelect = $("#music_name");
  const hasOption = $musicSelect.find("option").filter(function () {
    return this.value === name;
  }).length > 0;

  suppressMusicSelectChange = true;
  if (hasOption) {
    $musicSelect.val(name).trigger("change");
  } else {
    $musicSelect.val(name);
  }
  suppressMusicSelectChange = false;

  if (shouldLoadLyrics && name !== currentLyricMusic) {
    loadLyricsForMusic(name);
  }
}

//获取当前正在播放的歌曲显示到歌曲选择列表
function show_now_player_music_name(retry = 0){
  setTimeout(() => {
    const nowPlayerMusicName = normalizePlayingMusicName($("#playering-music").text());
    if (nowPlayerMusicName) {
      syncSelectedMusic(nowPlayerMusicName, true);
      return;
    }

    if (retry < 4) {
      show_now_player_music_name(retry + 1);
    }
  }, retry === 0 ? 1000 : 700);
}


// 本机播放：播放上一首
function webPlayPrevious() {
  const playList = WebPlayer.getPlayList();
  const currentIndex = WebPlayer.getCurrentIndex();

  if (playList.length === 0) {
    alert("播放列表为空");
    return;
  }

  let prevIndex;
  const playMode = WebPlayer.getPlayMode();

  if (playMode === 2) {
    // 随机播放：随机选择一首（不包括当前）
    const availableIndices = playList
      .map((_, i) => i)
      .filter((i) => i !== currentIndex);
    if (availableIndices.length > 0) {
      prevIndex =
        availableIndices[Math.floor(Math.random() * availableIndices.length)];
    } else {
      prevIndex = 0;
    }
  } else {
    // 其他模式：播放前一首
    prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = playList.length - 1;
    }
  }

  const prevMusic = playList[prevIndex];
  syncSelectedMusic(prevMusic, false);
  if (prevMusic) {
    loadAndPlayMusic(prevMusic);
  }
}

// 本机播放：播放下一首
function webPlayNext() {
  const playList = WebPlayer.getPlayList();
  const currentIndex = WebPlayer.getCurrentIndex();
  if (playList.length === 0) {
    alert("播放列表为空");
    return;
  }

  let nextIndex;
  const playMode = WebPlayer.getPlayMode();

  switch (playMode) {
    case 0: // 单曲循环
      nextIndex = currentIndex;
      break;

    case 1: // 全部循环
      nextIndex = (currentIndex + 1) % playList.length;
      break;

    case 2: // 随机播放
      const availableIndices = playList
        .map((_, i) => i)
        .filter((i) => i !== currentIndex);
      if (availableIndices.length > 0) {
        nextIndex =
          availableIndices[Math.floor(Math.random() * availableIndices.length)];
      } else {
        nextIndex = Math.floor(Math.random() * playList.length);
      }
      break;

    case 3: // 单曲播放
      // 不自动播放下一首
      return;

    case 4: // 顺序播放
      nextIndex = currentIndex + 1;
      if (nextIndex >= playList.length) {
        // 到末尾停止
        return;
      }
      break;

    default:
      nextIndex = (currentIndex + 1) % playList.length;
  }

  const nextMusic = playList[nextIndex];
  syncSelectedMusic(nextMusic, false);
  if (nextMusic) {
    loadAndPlayMusic(nextMusic);
  }
}

function togglePlayMode(isSend = true) {
  var did = $("#did").val();
  const modeBtnIcon = $("#modeBtn .material-icons");

  if (did == "web_device") {
    // 本机播放：使用 localStorage 管理播放模式
    let currentMode = WebPlayer.getPlayMode();

    // 切换到下一个模式
    const nextMode = (currentMode + 1) % Object.keys(playModes).length;
    WebPlayer.setPlayMode(nextMode);

    // 更新图标和提示（显示新的模式）
    modeBtnIcon.text(playModes[nextMode].icon);
    $("#modeBtn .tooltip").text(playModes[nextMode].cmd);

    console.log(`播放模式已切换为: ${nextMode} ${playModes[nextMode].cmd}`);

    // 更新 audio 元素的 loop 属性
    const audioElement = document.getElementById("audio");
    if (nextMode === 0) {
      // 单曲循环
      audioElement.loop = true;
    } else {
      audioElement.loop = false;
    }

    announceToScreenReader(`播放模式已切换为${playModes[nextMode].cmd}`);
  } else {
    // 设备播放：使用原有逻辑
    if (playModeIndex === "") {
      playModeIndex = 2;
    }
    modeBtnIcon.text(playModes[playModeIndex].icon);
    $("#modeBtn .tooltip").text(playModes[playModeIndex].cmd);

    isSend && sendcmd(playModes[playModeIndex].cmd);
    console.log(
      `当前播放模式: ${playModeIndex} ${playModes[playModeIndex].cmd}`,
    );
    playModeIndex = (playModeIndex + 1) % Object.keys(playModes).length;
  }
}

// 调用后端接口将歌曲加入指定歌单
function playlistAddMusic(playlistName, musicName) {
  return $.ajax({
    type: "POST",
    url: "/playlistaddmusic",
    contentType: "application/json; charset=utf-8",
    data: JSON.stringify({ name: playlistName, music_list: [musicName] }),
  });
}

// 调用后端接口将歌曲从指定歌单移除
function playlistDelMusic(playlistName, musicName) {
  return $.ajax({
    type: "POST",
    url: "/playlistdelmusic",
    contentType: "application/json; charset=utf-8",
    data: JSON.stringify({ name: playlistName, music_list: [musicName] }),
  });
}

function addToFavorites() {
  const isLiked = $(".favorite").hasClass("favorite-active");
  const musicName = WebPlayer.getCurrentMusic() || $("#music_name").val();

  if (!musicName) {
    alert("请先选择或播放一首歌曲");
    return;
  }

  if (isLiked) {
    $(".favorite").removeClass("favorite-active");
    favoritelist = Array.isArray(favoritelist) ? favoritelist.filter((item) => item !== musicName) : [];
    updateFavoriteAria(false);
    announceToScreenReader(`已取消收藏 ${musicName}`);
    playlistDelMusic("收藏", musicName)
      .done((data) => {
        console.log("取消收藏成功:", musicName, data);
      })
      .fail(() => {
        console.error("取消收藏失败:", musicName);
      });
  } else {
    $(".favorite").addClass("favorite-active");
    if (Array.isArray(favoritelist)) favoritelist.push(musicName);
    updateFavoriteAria(true);
    announceToScreenReader(`已收藏 ${musicName}`);
    playlistAddMusic("收藏", musicName)
      .done((data) => {
        console.log("收藏成功:", musicName, data);
      })
      .fail(() => {
        console.error("收藏失败:", musicName);
      });
  }
}

function openSettings() {
  console.log("打开设置");
  window.location.href = "setting.html";
}
function toggleVolume() {
  const isVisible = $("#volume-component").is(":visible");
  if (isVisible) {
    closeDialog("volume-component");
  } else {
    openDialog("volume-component");
  }
}

function toggleSearch() {
  const isVisible = $("#search-component").is(":visible");
  if (isVisible) {
    closeDialog("search-component");
  } else {
    openDialog("search-component");
  }
}

function toggleTimer() {
  const isVisible = $("#timer-component").is(":visible");
  if (isVisible) {
    closeDialog("timer-component");
  } else {
    openDialog("timer-component");
  }
}

function togglePlayLink() {
  const isVisible = $("#playlink-component").is(":visible");
  if (isVisible) {
    closeDialog("playlink-component");
  } else {
    openDialog("playlink-component");
  }
}

function toggleMoreMenu() {
  const isVisible = $("#more-component").is(":visible");
  if (isVisible) {
    closeDialog("more-component");
  } else {
    openDialog("more-component");
  }
}

function toggleLocalPlay() {
  $("#audio").fadeIn();
}

function setLyricsStatus(message) {
  const status = document.getElementById("lyrics-status");
  if (status) {
    status.textContent = message;
  }
}

function getLyricOffsetKey(musicName = currentLyricMusic) {
  return `lyric_offset:${musicName || "global"}`;
}

function getTaggedLyricOffset(lyrics) {
  const match = String(lyrics || "").match(/^\[x-xiaomusic-offset:([+-]?\d+(?:\.\d+)?)\]\s*\n?/i);
  return match ? Number(match[1]) : null;
}

function stripLyricOffsetTag(lyrics) {
  return String(lyrics || "").replace(/^\[x-xiaomusic-offset:[+-]?\d+(?:\.\d+)?\]\s*\n?/i, "");
}

function mergeLyricOffsetIntoLyrics(lyrics, offsetValue = currentLyricOffset) {
  const cleanLyrics = stripLyricOffsetTag(lyrics).trim();
  const normalizedOffset = Number(offsetValue || 0).toFixed(1);
  return `[x-xiaomusic-offset:${normalizedOffset}]\n${cleanLyrics}`;
}

function loadLyricOffset(musicName = currentLyricMusic, lyrics = "") {
  const taggedValue = getTaggedLyricOffset(lyrics);
  const value = taggedValue !== null
    ? taggedValue
    : Number(localStorage.getItem(getLyricOffsetKey(musicName)) || "0");
  currentLyricOffset = Number.isFinite(value) ? value : 0;
  if (musicName) {
    localStorage.setItem(getLyricOffsetKey(musicName), currentLyricOffset.toFixed(1));
  }
  updateLyricOffsetUI();
}

function saveLyricOffset() {
  if (!currentLyricMusic) return;
  localStorage.setItem(getLyricOffsetKey(currentLyricMusic), currentLyricOffset.toFixed(1));
}

async function saveCurrentLyricOffsetToTag() {
  if (!currentLyricMusic) return false;

  let lyrics = currentLyricText;
  if (!lyrics) {
    lyrics = await readLocalLyrics(currentLyricMusic);
  }
  lyrics = stripLyricOffsetTag(lyrics).trim();
  if (!lyrics) return false;

  return saveLyricsToLocalTag(currentLyricMusic, mergeLyricOffsetIntoLyrics(lyrics, currentLyricOffset));
}

function updateLyricOffsetUI() {
  const offsetValue = document.getElementById("lyric-offset-value");
  if (!offsetValue) return;

  const prefix = currentLyricOffset > 0 ? "+" : "";
  offsetValue.textContent = `${prefix}${currentLyricOffset.toFixed(1)}s`;
}

function adjustLyricOffset(delta) {
  currentLyricOffset = Number((currentLyricOffset + delta).toFixed(1));
  saveLyricOffset();
  updateLyricOffsetUI();
  updateLyricHighlight(offset || 0, true);
  setLyricsStatus(`歌词时间轴已调整为 ${currentLyricOffset > 0 ? "+" : ""}${currentLyricOffset.toFixed(1)}s`);
  saveCurrentLyricOffsetToTag().then((saved) => {
    if (!saved) {
      console.warn("歌词偏移未能写入歌曲标签");
    }
  });
}

function resetLyricOffset() {
  currentLyricOffset = 0;
  saveLyricOffset();
  updateLyricOffsetUI();
  updateLyricHighlight(offset || 0, true);
  setLyricsStatus("歌词时间轴已重置");
  saveCurrentLyricOffsetToTag().then((saved) => {
    if (!saved) {
      console.warn("歌词偏移未能写入歌曲标签");
    }
  });
}

function clearLyrics(message = "暂无歌词") {
  currentLyrics = [];
  lyricLines = [];
  currentLyricText = "";
  const lyricContent = document.getElementById("lyrics-content");
  if (lyricContent) {
    lyricContent.innerHTML = `<div class="lyric-placeholder">${message}</div>`;
  }
}

function parseAndDisplayLyrics(lrcText) {
  const lyricContent = document.getElementById("lyrics-content");
  if (!lyricContent) return;

  const cleanLrcText = stripLyricOffsetTag(lrcText);
  currentLyricText = cleanLrcText;
  currentLyrics = [];
  lyricLines = [];
  lyricContent.innerHTML = "";

  String(cleanLrcText || "")
    .split("\n")
    .forEach((line) => {
      const matches = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{2,3}))?\]/g)];
      const text = line.replace(/\[[^\]]+\]/g, "").trim();
      if (!matches.length || !text) return;

      matches.forEach((match) => {
        const minute = parseInt(match[1], 10);
        const second = parseInt(match[2], 10);
        const fraction = match[3] || "0";
        const millisecond = fraction.length === 2 ? parseInt(fraction, 10) * 10 : parseInt(fraction, 10);
        currentLyrics.push({
          time: minute * 60 + second + millisecond / 1000,
          text,
        });
      });
    });

  currentLyrics.sort((a, b) => a.time - b.time);

  if (!currentLyrics.length) {
    renderPlainLyrics(cleanLrcText);
    return;
  }

  currentLyrics.forEach((lyric) => {
    const lineElement = document.createElement("div");
    lineElement.className = "lyric-line";
    lineElement.textContent = lyric.text;
    lineElement.dataset.time = lyric.time;
    lyricContent.appendChild(lineElement);
    lyricLines.push(lineElement);
  });
}

function parseSongNameForLyrics(name) {
  const cleaned = String(name || "")
    .replace(/【[^】]*】/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\.(mp3|m4a|wav|flac|aac|ogg|ape)$/i, "")
    .trim();
  const parts = cleaned.split(/\s*-\s*/).filter(Boolean);

  if (parts.length >= 2) {
    return {
      track: parts[0].trim(),
      artist: parts.slice(1).join("-").trim(),
      query: cleaned,
    };
  }

  return {
    track: cleaned,
    artist: "",
    query: cleaned,
  };
}

function traditionalToSimplified(text) {
  const traditionalChars = "萬與醜專業叢東絲丟兩嚴喪個豐臨為麗舉麼義烏樂喬習鄉書買亂爭於虧雲亞產畝親褻嚲億僅從侖倉儀們價眾優夥會傘偉傳傷倀倫偽佇體餘傭僉俠侶僥偵側僑儈儂俁儔儼儻儷倆儐儲儺兒兌黨蘭關興茲養獸冁內岡冊寫軍農馮沖決況凍淨淒準涼淩減湊凜幾鳳鳧憑凱擊鑿芻劃劉則剛創刪別剗剄劊劌劍劑剝劇勸辦務勻動勵勁勞勢勳勻匭匯匱區醫華協單賣盧鹵鹹卻廠廳歷厲壓厭厙廁廂厴廈廚廄廝縣參叢吳呂嗎嚇聽啟員唄唚問啞啟喬單喲嗆嗇嘗嘔嘆嘍嘩嘮嘯嘰噓噴噸噹嚀嚇嚌嚕嚮噯囂囅囈囉囑囪圇國圍園圓圖團聖場壞塊堅壇壩塢墳墜壟壟壯聲壺壼處備復夠頭誇夾奪奩奮獎奧妝婦媽嫵嫗媧媯姍薑婁婭嬈嬌孌娛媼嬡嬪嬋嬸孫學孿寧寶實寵審憲宮寬賓寢對尋導將爾塵嘗堯尷屍層屜屬岡峴島峽嶢崍崑崗嶄嵐嶁嶺嶽巋巒巔幣帥師帳帶幀幫幬幹並廣莊慶廬廁廂廄庫應廟廠廡廢廩開異棄張彌彎彙彥後徑徠復徹恆恥悅悵悶惡惱惲惻愛愜愴愷愾態慍慘慚慟慣慪慫慮慳慶憂憊憐憑憒憚憤憫憮憲憶懇應懌懍懣懶懷懸懺懼懾戀戇戔戲戧戰戩戶紮撲托執擴捫掃揚擾撫拋摶摳掄搶護報擔擬攏揀擁攔擰撥擇掛摯攣撾撻撈撐撓撝撟撣撢擋撻據擄擇撿擔擲擠擬擯擰擱擲擴擷擺擻擾攬敗敘敵斂數齋斕鬥斬斷無舊時曠曇曉曄暈暉暢暫曖術樸機殺雜權條來楊榪傑極構樅樞棗棟櫛柵標棧櫳樹栒樣欒槳樁夢檢梲欞欄樞橢樓櫚樂樅樑槨櫝槧槍槤槨槳樁櫃檻檳櫧櫟櫥櫦櫨櫪櫫櫬櫱櫳櫸櫻欄權欏欒欖欞歡歟歲歷歸歿殘殞殤殫殮殯殲毆毀轂畢斃氈氌氣氫氬氳氾漢湯洶溝沒灃漚瀝淪滄滬濘淚澩瀧瀘瀉潑澤涇潔灑窪浹淺漿澆湞濁測濟瀏渾滸濃潯濤澇澗漲澀淵漬瀆漸澠漁瀋滲溫遊灣濕潰濺漵滾滯灩灄滿濾濫灤濱灘灝灣災為烏爛燴煙煩燒燭燙燴燼熱煥燜燾愛爺牘牽犧狀猶狽猙獄獅獨狹獪獫獮獰獲獵獷獸獺獻獼玀現琺琿瑋瑣瓊瑤瑩璉璣璦璽瓏甌電畫暢畬疇療瘧癘瘍瘡瘋皰皸皺盞鹽監蓋盜盤眥眾睏睜睞瞞瞭瞶瞼矚矯礬礦碭碼磚硨硯碸礪礫礱祿禍禎禕禦禪禮禰禱禿稈種積稱穢穠穡穩穫窮竊竅窯窩窪窺竄竅竇竈竊競筆筍箋箏節範築篋篔篤篩簀簍簞簡簣簫簹簽簾籃籌籟籠籙籜籟籤籥糴類糶糲糴糶糾紀紂約紅紆紇紈紉紋納紐紓純紕紗紙級紛紜紝紡紮細紱紲紳紵紹紺紼絀終組絆絎結絕絛絝絞絡絢給絨絰統絲絳絹綁綃綆綈綏經綜綠綴緇綽綾綿綸維綰綱網綴綵綸綹綺綻綽綾綿緄緇緊緋緒緓緔緗緘緙線緝緞締緡緣編緩緬緯緱縛縝縞縟縣縫縭縮縱縲縳縴縵縶縷縹總績繃繅繆繈繒織繕繚繞繡繢繩繪繫繭繮繯繰繳繹繼纈纊續纍纏纓纖纘纜缽罈罌罰罵罷羅羆羈羋羥義習翹耬聖聞聯聰聲聳職聶聹聽肅脅脈脛脫脹腎腡腦腫腳腸膃膚膠膩膽膾膿臉臍臏臘臚臟臠臺與興舉艙艦艫艱艷藝節芻莧華萇萊萬萵葉葒著葤葷蒔蒞蒼蓀蓋蓮蓯蓽蔔蔞蔣蔥蔦蕁蕆蕎蕒蕓蕕蕘蕢蕭薈薌薑薔薘薟薦薩薺藍薺藎藝藥藪藶藺蘄蘆蘇蘊蘋蘚蘞蘢蘭蘺蘿處虛虜號虧蟲虯蛺蟶蠣蟻螞蠶蠻蟄蟈蟬蠐蟯螄蠅蠆蠍螻蠑蠔蠟蠣蠱蠶蠻衆術衛衝袞裊裡補裝褘褲褳褸襖襠襤襪襯襲見規覓視覘覽覺覬覯覲覷觴觸訁訂訃計訊訌討訐訓訕訖託記訛訝訟訣訥訪設許訴訶診詁詆詔評詛詞詠詡詢詣試詩詫詬詭詮詰話該詳詵詼詿誄誅誆誇誌認誑誒誕誘誚語誠誡誣誤誥誦誨說誰課誶誹誼調諂諄談諉請諍諏諑諒論諗諛諜諝諞諡諢諤諦諧諫諭諮諱諳諶諷諸諺諼諾謀謁謂謄謅謊謎謐謔謖謗謙謚講謝謠謡謨謫謬謳謹謾譁證譎譏譖識譙譚譜譫譯議譴護譽讀變讎讒讓讖讜讞豈豎豐豬貓貝貞負財貢貧貨販貪貫責貯貰貲貳貴貶買貸貺費貼貽貿賀賁賂賃賄資賈賊賑賒賓賕賙賚賜賞賠賡賢賣賤賦質賬賭賴賵賺賻購賽賾贄贅贈贊贍贏贓贖贗贛趙趕趨趲跡踐踴蹌蹕蹣蹤蹺躂躉躊躋躍躎躒躓躕躚躡躥躦車軋軌軍軒軔軛軟軤軫軲軸軹軺軻軼軾較輅輇載輊輒輔輕輛輜輝輦輩輪輯輸輻輾輿轄轅轆轉轍轎轔轟轡轢轤辦辭辮辯農迴逕這連週進遊運過達違遙遜遞遠適遲遷選遺遼邁還邇邊邏鄧鄭鄰鄲鄴鄶鄺酈醞醬醱釀釁釃釅釋裏鑒鑠針釘釗釙針釣釧鈁鈄鈉鈀鈣鈦鈧鈮鈰鈳鈴鈷鈸鈹鈺鈾鈿鉀鉅鉆鉈鉉鉋鉍鉑鉕鉗鉚鉛鉞鉤鉦鉬鉭鉯鉸鉺鉻鉿銃銅銍銑銓銖銘銚銜銠銣銥銦銨銩銪銫銬銭銱銳銷銹銻銼鋁鋃鋅鋇鋌鋏鋒鋙鋝鋟鋣鋤鋥鋦鋨鋪鋭鋮鋯鋰鋱鋶鏈鋸鋼錁錄錆錇錈錐錒錕錘錙錚錛錟錠錡錢錦錨錫錮錯錳錶鍀鍁鍃鍆鍇鍈鍊鍋鍍鍔鍘鍚鍛鍠鍤鍥鍬鍰鍵鍶鍺鍼鍾鎂鎄鎇鎊鎔鎖鎘鎚鎛鎡鎢鎣鎦鎧鎩鎪鎬鎮鎰鎳鎵鎸鎿鏃鏇鏈鏌鏍鏐鏑鏗鏘鏜鏝鏞鏟鏡鏢鏤鏨鏰鏵鏷鏹鏺鐃鐋鐐鐒鐓鐔鐘鐙鐠鐨鐫鐮鐲鐳鐵鐶鐸鐺鑄鑊鑌鑒鑔鑕鑞鑠鑣鑥鑭鑰鑲鑷鑹鑼鑽鑾鑿長門閂閃閆閉開閌閎閏閑間閔閘閡閣閥閨閩閫閬閭閱閶閹閻閼閽閾閿闃闆闈闊闋闌闍闐闒闓闔闕闖關闞闠闡闢阨阬陘陝陣陰陳陸陽隉隊階隕際隨險隱隴隸隻雋雖雙雛雜雞離難雲電霧霽靂靄靚靜靨韃鞏鞽韁韃韆韋韌韓韙韞韻響頁頂頃項順須頊頌預頑頒頓頗領頜頡頤頦頭頰頲頷頸頹頻顆題額顎顏顒願顛類顢顥顧顫顯顰顱風颯颱颳颶颺颼飄飆飛飢飣飥飩飪飫飭飯飲飴飼飽飾餃餄餅餉養餌餓餘餛餞餡館餱餳餵餶餷餺餼餾餿饃饅饈饉饊饋饌饑饒饗饜饞饢馬馭馮馱馳馴駁駐駑駒駔駕駘駙駛駝駟駢駭駰駱駸駿騁騂騅騌騍騎騏騖騙騫騭騮騰騶騷騸騾驀驁驂驃驅驊驌驍驏驕驗驚驛驟驢驥驦驪驫骯髏髒體髕髖鬢鬥鬧鬩鬮鬱魎魘魚魛魢魨魯魴魷鮁鮃鮊鮋鮍鮐鮑鮒鮓鮚鮜鮞鮟鮠鮦鮪鮫鮭鮮鮳鮶鮺鯀鯁鯇鯉鯊鯒鯔鯖鯗鯛鯝鯡鯢鯤鯧鯨鯪鯫鯰鯴鯷鯽鰂鰈鰉鰍鰒鰓鰜鰟鰠鰣鰥鰨鰩鰭鰱鰲鰳鰵鰷鰹鰻鰾鱂鱅鱈鱉鱒鱔鱖鱗鱘鱝鱟鱠鱣鱤鱧鱨鱭鱷鱸鱺鳥鳩鳶鳳鳴鳶鴆鴇鴉鴒鴕鴛鴝鴞鴟鴣鴦鴨鴯鴰鴻鴿鵂鵃鵐鵑鵒鵓鵜鵝鵠鵡鵪鵬鵮鵯鵲鶇鶉鶊鶓鶖鶘鶚鶡鶥鶩鶯鶲鶴鶹鶺鷁鷂鷄鷈鷓鷗鷙鷚鷥鷦鷫鷯鷲鷸鷹鷺鸇鸌鸕鸚鸛鹺麥麩黃黌點黨黲黴黶黷黽黿鼉鼕鼴齊齋齎齏齒齔齕齗齙齜齟齠齡齣齦齧齪齬齲齶齷龍龔龕龜";
  const simplifiedChars = "万与丑专业丛东丝丢两严丧个丰临为丽举么义乌乐乔习乡书买乱争于亏云亚产亩亲亵亸亿仅从仑仓仪们价众优伙会伞伟传伤伥伦伪伫体余佣佥侠侣侥侦侧侨侩侬俣俦俨傥俪俩傧储傩儿兑党兰关兴兹养兽冁内冈册写军农冯冲决况冻净凄准凉凌减凑凛几凤凫凭凯击凿刍划刘则刚创删别刬刭刽刿剑剂剥剧劝办务匀动励劲劳势勋匀匦汇匮区医华协单卖卢卤咸却厂厅历厉压厌厍厕厢厣厦厨厩厮县参丛吴吕吗吓听启员呗吣问哑启乔单哟呛啬尝呕叹喽哗唠啸叽嘘喷吨当咛吓哜噜向嗳嚣冁呓啰嘱囱囵国围园圆图团圣场坏块坚坛坝坞坟坠垄垄壮声壶壸处备复够头夸夹夺奁奋奖奥妆妇妈妩妪娲妫姗姜娄娅娆娇娈娱媪嫒嫔婵婶孙学孪宁宝实宠审宪宫宽宾寝对寻导将尔尘尝尧尴尸层屉属冈岘岛峡峣崃昆岗崭岚嵝岭岳岿峦巅币帅师帐带帧帮帱干并广庄庆庐厕厢厩库应庙厂庑废廪开异弃张弥弯汇彦后径徕复彻恒耻悦怅闷恶恼恽恻爱惬怆恺忾态愠惨惭恸惯怄怂虑悭庆忧惫怜凭愦惮愤悯怃宪忆恳应怿懔懑懒怀悬忏惧慑恋戆戋戏戗战戬户扎扑托执扩扪扫扬扰抚抛抟抠抡抢护报担拟拢拣拥拦拧拨择挂挚挛挝挞捞撑挠㧟挢掸掸挡挞据掳择捡担掷挤拟摈拧搁掷扩撷摆擞扰揽败叙敌敛数斋斓斗斩断无旧时旷昙晓晔晕晖畅暂暧术朴机杀杂权条来杨杩杰极构枞枢枣栋栉栅标栈栊树栒样栾桨桩梦检棁棂栏枢椭楼榈乐枞梁椁椟椠枪梿椁桨桩柜槛槟槠栎橱橥栌枥橥榇蘖栊榉樱栏权椤栾榄棂欢欤岁历归殁残殒殇殚殓殡歼殴毁毂毕毙毡氇气氢氩氲泛汉汤汹沟没沣沤沥沦沧沪泞泪泶泷泸泻泼泽泾洁洒洼浃浅浆浇浈浊测济浏浑浒浓浔涛涝涧涨涩渊渍渎渐渑渔沈渗温游湾湿溃溅溆滚滞滟滠满滤滥滦滨滩灏湾灾为乌烂烩烟烦烧烛烫烩烬热焕焖焘爱爷牍牵牺状犹狈狰狱狮独狭狯猃狝狞获猎犷兽獭献猕猡现珐珲玮琐琼瑶莹琏玑瑷玺珑瓯电画畅畲畴疗疟疠疡疮疯疱皲皱盏盐监盖盗盘眦众困睁睐瞒了瞆睑瞩矫矾矿砀码砖砗砚砜砺砾砻禄祸祯祎御禅礼祢祷秃秆种积称秽秾穑稳获穷窃窍窑窝洼窥窜窍窦灶窃竞笔笋笺筝节范筑箧筼笃筛箦篓箪简篑箫筜签帘篮筹籁笼箓箨籁签钥籴类粜粝籴粜纠纪纣约红纡纥纨纫纹纳纽纾纯纰纱纸级纷纭纴纺扎细绂绁绅纻绍绀绋绌终组绊绗结绝绦绔绞络绚给绒绖统丝绛绢绑绡绠绨绥经综绿缀缁绰绫绵纶维绾纲网缀彩纶绺绮绽绰绫绵绲缁紧绯绪绬绱缃缄缂线缉缎缔缗缘编缓缅纬缑缚缜缟缛县缝缡缩纵缧䌸纤缦絷缕缥总绩绷缫缪襁缯织缮缭绕绣缋绳绘系茧缰缳缲缴绎继缬纩续累缠缨纤缵缆钵坛罂罚骂罢罗罴羁芈羟义习翘耧圣闻联聪声耸职聂聍听肃胁脉胫脱胀肾脶脑肿脚肠腽肤胶腻胆脍脓脸脐膑腊胪脏脔台与兴举舱舰舻艰艳艺节刍苋华苌莱万莴叶荭着荮荤莳莅苍荪盖莲苁荜卜蒌蒋葱茑荨蒇荞荬芸莸荛蒉萧荟芗姜蔷荙莶荐萨荠蓝荠荩艺药薮苈蔺蕲芦苏蕴苹藓蔹茏兰蓠萝处虚虏号亏虫虬蛱蛏蛎蚁蚂蚕蛮蛰蝈蝉蛴蛲蛳蝇虿蝎蝼蝾蚝蜡蛎蛊蚕蛮众术卫冲衮袅里补装袆裤裢褛袄裆褴袜衬袭见规觅视觇览觉觊觏觐觑觞触讠订讣计讯讧讨讦训讪讫托记讹讶讼诀讷访设许诉诃诊诂诋诏评诅词咏诩询诣试诗诧诟诡诠诘话该详诜诙诖诔诛诓夸志认诳诶诞诱诮语诚诫诬误诰诵诲说谁课谇诽谊调谄谆谈诿请诤诹诼谅论谂谀谍谞谝谥诨谔谛谐谏谕谘讳谙谌讽诸谚谖诺谋谒谓誊诌谎谜谧谑谡谤谦谥讲谢谣谣谟谪谬讴谨谩哗证谲讥谮识谯谭谱谵译议谴护誉读变雠谗让谶谠谳岂竖丰猪猫贝贞负财贡贫货贩贪贯责贮贳赀贰贵贬买贷贶费贴贻贸贺贲赂赁贿资贾贼赈赊宾赇赒赉赐赏赔赓贤卖贱赋质账赌赖赗赚赙购赛赜贽赘赠赞赡赢赃赎赝赣赵赶趋趱迹践踊跄跸蹒踪跷跶趸踌跻跃躜跞踬蹰跹蹑蹿躜车轧轨军轩轫轭软轷轸轱轴轵轺轲轶轼较辂辁载轾辄辅轻辆辎辉辇辈轮辑输辐辗舆辖辕辘转辙轿辚轰辔轹轳办辞辫辩农回迳这连周进游运过达违遥逊递远适迟迁选遗辽迈还迩边逻邓郑邻郸邺郐邝郦酝酱酦酿衅酾酽释里鉴铄针钉钊钋针钓钏钫钭钠钯钙钛钪铌铈钶铃钴钹铍钰铀钿钾钜钻铊铉铇铋铂钷钳铆铅钺钩钲钼钽䥺铰铒铬铪铳铜铚铣铨铢铭铫衔铑铷铱铟铵铥铕铯铐钱铞锐销锈锑锉铝锒锌钡铤铗锋铻锊锓铘锄锃锔锇铺锐铖锆锂铽锍链锯钢锞录锖锫锩锥锕锟锤锱铮锛锬锭锜钱锦锚锡锢错锰表锝锨锪钔锴锳链锅镀锷铡锳锻锽锸锲锹锾键锶锗针钟镁锿镅镑镕锁镉锤镈镃钨蓥镏铠铩锼镐镇镒镍镓镅镢镞镟链镆镠镝铿锵镗镘镛铲镜镖镂錾镚铧镤镪䥽铙铴镣镠镡镢钟镫镨䥕镢镰镯镭铁镮铎铛铸镬镔鉴镲锧镴铄镳镥镧钥镶镊锈锣钻銮凿长门闩闪闫闭开闶闳闰闲间闵闸阂阁阀闺闽阃阆闾阅阊阉阎阏阍阈阌阒板闱阔阕阑阇阗阘闿阖阙闯关阚阓阐辟阨阬陉陕阵阴陈陆阳陧队阶陨际随险隐陇隶只隽虽双雏杂鸡离难云电雾霁雳霭靓静靥鞑巩鞒缰鞑千韦韧韩韪韫韵响页顶顷项顺须顼颂预顽颁顿颇领颌颉颐颏头颊颋颔颈颓频颗题额颚颜颙愿颠类颟颢顾颤显颦颅风飒台刮飓飏飕飘飙飞饥饤饦饨饪饫饬饭饮饴饲饱饰饺饸饼饷养饵饿余馄饯馅馆糇饧喂馉馇馎饩馏馊馍馒馐馑馓馈馔饥饶飨餍馋馕马驭冯驮驰驯驳驻驽驹驵驾骀驸驶驼驷骈骇骃骆骎骏骋骍骓骔骒骑骐骛骗骞骘骝腾驺骚骟骡蓦骜骖骠驱骅骕骁骣骄验惊驿骤驴骥骦骊骉肮髅脏体髌髋鬓斗闹阋阄郁魉魇鱼鱽鱾鲀鲁鲂鱿鲅鲆鲌鲉鲏鲐鲍鲋鲊鲒鲘鲕鲹鲶鲖鲔鲛鲑鲜鲓鲪鲝鲧鲠鲩鲤鲨鲬鲻鲭鲞鲷鲴鲱鲵鲲鲳鲸鲮鲰鲶鲺鳀鲫鲗鲽鳇鳅鳆鳃鳒鳑鳋鲥鳏鳎鳐鳍鲢鳌鳓鳘鲦鲣鳗鳔鳉鳙鳕鳖鳟鳝鳜鳞鲟鲼鲎鲙鳣鳡鳢鲿鲚鳄鲈鲡鸟鸠鸢凤鸣鸢鸩鸨鸦鸰鸵鸳鸲鸮鸱鸪鸯鸭鸸鸹鸿鸽鸺鸼鹀鹃鹆鹁鹈鹅鹄鹉鹌鹏鹐鹎鹊鸫鹑鹒鹋鹙鹕鹗鹖鹛鹜莺鹟鹤鹠鹡鹢鹞鸡鹝鹧鸥鸷鹨鸶鹪鹔鹩鹫鹬鹰鹭鹯鹱鸬鹦鹳鹾麦麸黄黉点党黪霉黡黩黾鼋鼍冬鼹齐斋赍齑齿龀龁龂龅龇龃龆龄出龈啮龊龉龋腭龌龙龚龛龟";
  const map = traditionalToSimplified.map || (traditionalToSimplified.map = (() => {
    const result = {};
    for (let i = 0; i < traditionalChars.length; i++) {
      result[traditionalChars[i]] = simplifiedChars[i] || traditionalChars[i];
    }
    return result;
  })());

  return String(text || "").replace(/[\u3400-\u9fff]/g, (char) => map[char] || char);
}

function renderPlainLyrics(text) {
  const lyricContent = document.getElementById("lyrics-content");
  if (!lyricContent) return;

  const cleanText = stripLyricOffsetTag(text);
  currentLyricText = cleanText;
  currentLyrics = [];
  lyricLines = [];
  const lines = String(cleanText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    clearLyrics("没有可显示的歌词");
    return;
  }

  lyricContent.innerHTML = "";
  lines.forEach((line) => {
    const lineElement = document.createElement("div");
    lineElement.className = "lyric-line";
    lineElement.textContent = line;
    lyricContent.appendChild(lineElement);
  });
}

function updateLyricHighlight(currentTime, forceScroll = false) {
  if (!lyricLines.length) return;

  const lyricTime = Math.max(0, Number(currentTime || 0) + currentLyricOffset);
  let activeIndex = -1;
  for (let i = 0; i < currentLyrics.length; i++) {
    if (currentLyrics[i].time <= lyricTime) {
      activeIndex = i;
    } else {
      break;
    }
  }

  lyricLines.forEach((line, index) => {
    line.classList.toggle("active", index === activeIndex);
  });

  if (activeIndex >= 0) {
    const activeLine = lyricLines[activeIndex];
    const container = document.getElementById("lyrics-content");
    if (container && activeLine) {
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeLine.getBoundingClientRect();
      const targetTop =
        container.scrollTop +
        (activeRect.top - containerRect.top) -
        container.clientHeight * 0.42 +
        activeLine.clientHeight / 2;

      const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
      const nextTop = Math.max(0, Math.min(maxTop, targetTop));
      if (forceScroll || Math.abs(container.scrollTop - nextTop) > 4) {
        container.scrollTo({
          top: nextTop,
          behavior: "smooth",
        });
      }
    }
  }
}

function autoSearchLyricsForMusic(musicName) {
  if (!musicName || isAutoLyricSearching || autoLyricSearchMusic === musicName) return;

  autoLyricSearchMusic = musicName;
  isAutoLyricSearching = true;
  searchAndLoadLyrics(musicName, { auto: true }).finally(() => {
    isAutoLyricSearching = false;
  });
}

function loadLyricsForMusic(musicName, lrcText = "", options = {}) {
  const autoSearch = options.autoSearch !== false;
  if (!musicName) {
    currentLyricMusic = "";
    setLyricsStatus("选择或播放歌曲后会自动尝试加载歌词");
    clearLyrics();
    return;
  }

  currentLyricMusic = musicName;
  setLyricsStatus(`正在匹配《${musicName}》的歌词`);

  if (lrcText && String(lrcText).trim()) {
    loadLyricOffset(musicName, lrcText);
    parseAndDisplayLyrics(stripLyricOffsetTag(lrcText));
    setLyricsStatus(`已加载《${musicName}》的本地歌词`);
    return;
  }

  $.get("/musicinfo", { name: musicName, musictag: true })
    .done((data) => {
      const tagLyrics = data && data.tags && data.tags.lyrics ? data.tags.lyrics : "";
      if (tagLyrics && tagLyrics.trim()) {
        loadLyricOffset(musicName, tagLyrics);
        parseAndDisplayLyrics(stripLyricOffsetTag(tagLyrics));
        setLyricsStatus(`已加载《${musicName}》的本地歌词`);
      } else {
        loadLyricOffset(musicName);
        setLyricsStatus(autoSearch ? "未找到本地歌词，正在自动在线匹配" : "未找到本地歌词，可点击“搜索歌词”自动在线匹配");
        clearLyrics(autoSearch ? "正在自动搜索歌词..." : "暂无歌词，点击右上角搜索歌词");
        if (autoSearch) {
          autoSearchLyricsForMusic(musicName);
        }
      }
    })
    .fail(() => {
      setLyricsStatus("歌词读取失败，可稍后重试");
      clearLyrics("歌词读取失败");
    });
}

async function searchAndLoadLyrics(targetMusicName, options = {}) {
  const musicName = targetMusicName || $("#music_name").val() || WebPlayer.getCurrentMusic() || currentLyricMusic;
  const isAuto = !!options.auto;
  if (!musicName) {
    if (!isAuto) alert("请先选择或播放一首歌曲");
    return;
  }

  setLyricsStatus(`${isAuto ? "正在自动" : "正在快速"}搜索《${musicName}》歌词`);
  clearLyrics("正在搜索歌词...");

  try {
    const localLyrics = await readLocalLyrics(musicName);
    if (localLyrics) {
      await handleFoundLyrics(musicName, localLyrics, "本地缓存");
      return;
    }

    const loadedFromLrclib = await searchLyricsFromLrclib(musicName);
    if (loadedFromLrclib) {
      return;
    }

    const loadedFromQQ = await searchLyricsFromQQ(musicName);
    if (loadedFromQQ) {
      return;
    }

    const loadedFromNetease = await searchLyricsFromNetease(musicName);
    if (loadedFromNetease) {
      return;
    }

    const loadedFromPlugin = await searchLyricsFromPlugin(musicName);
    if (loadedFromPlugin) {
      return;
    }

    setLyricsStatus(isAuto ? "自动搜索没有匹配到歌词，可手动再试一次" : "没有匹配到歌词，可稍后换关键词重试");
    clearLyrics("没有匹配到歌词");
  } catch (error) {
    console.error("歌词搜索失败:", error);
    setLyricsStatus(isAuto ? "自动搜索歌词失败，可手动重试" : "歌词搜索失败");
    clearLyrics(isAuto ? "自动搜索歌词失败" : "歌词搜索失败");
  }
}

function fetchWithTimeout(url, options = {}, timeout = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function normalizeLyricKeyword(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\.(mp3|m4a|wav|flac|aac|ogg|ape)$/i, "")
    .replace(/【[^】]*】|\[[^\]]*\]|\([^)]*\)|（[^）]*）/g, "")
    .replace(/\b(official|lyrics?|audio|mv|live|cover|remix|伴奏|纯音乐|完整版|无损)\b/gi, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function uniqueLyricQueries(parsed) {
  const queries = [
    parsed.artist ? `${parsed.track} ${parsed.artist}` : "",
    parsed.query,
    parsed.track,
  ].map(normalizeLyricKeyword).filter(Boolean);

  return [...new Set(queries)];
}

function lyricCandidateScore(candidate, parsed) {
  const track = normalizeLyricKeyword(parsed.track);
  const artist = normalizeLyricKeyword(parsed.artist);
  const candidateTrack = normalizeLyricKeyword(candidate.trackName || candidate.name || candidate.title);
  const candidateArtist = normalizeLyricKeyword(candidate.artistName || candidate.artist);
  let score = 0;

  if (candidate.syncedLyrics) score += 40;
  if (candidate.plainLyrics) score += 20;
  if (track && candidateTrack === track) score += 45;
  else if (track && (candidateTrack.includes(track) || track.includes(candidateTrack))) score += 25;
  if (artist && candidateArtist === artist) score += 30;
  else if (artist && candidateArtist && (candidateArtist.includes(artist) || artist.includes(candidateArtist))) score += 14;
  if (candidate.duration && duration && Math.abs(Number(candidate.duration) - Number(duration)) <= 3) score += 10;

  return score;
}

function pickBestLyricCandidate(candidates, parsed) {
  return candidates
    .filter((item) => item && (item.syncedLyrics || item.plainLyrics))
    .sort((a, b) => lyricCandidateScore(b, parsed) - lyricCandidateScore(a, parsed))[0];
}

async function readLocalLyrics(musicName) {
  try {
    const response = await fetchWithTimeout(`/musicinfo?name=${encodeURIComponent(musicName)}&musictag=true`, {}, 4000);
    const data = await response.json();
    const lyrics = data && data.tags && data.tags.lyrics ? data.tags.lyrics : "";
    return lyrics && lyrics.trim() ? lyrics : "";
  } catch (error) {
    console.warn("读取本地歌词失败", error);
    return "";
  }
}

async function saveLyricsToLocalTag(musicName, lyrics) {
  try {
    const response = await fetchWithTimeout(`/musicinfo?name=${encodeURIComponent(musicName)}&musictag=true`, {}, 4000);
    const data = await response.json();
    const tags = data && data.tags ? data.tags : {};
    const payload = {
      musicname: musicName,
      title: tags.title || musicName,
      artist: tags.artist || "",
      album: tags.album || "",
      year: tags.year || "",
      genre: tags.genre || "",
      lyrics,
      picture: "",
    };

    const saveResponse = await fetchWithTimeout("/setmusictag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, 5000);
    const result = await saveResponse.json();
    return result && (result.ret === "OK" || String(result.ret || "").includes("running"));
  } catch (error) {
    console.warn("保存歌词到本地失败", error);
    return false;
  }
}

async function handleFoundLyrics(musicName, rawLyrics, source) {
  const simplifiedLyrics = traditionalToSimplified(rawLyrics);
  loadLyricOffset(musicName, simplifiedLyrics);
  const cleanLyrics = stripLyricOffsetTag(simplifiedLyrics);
  parseAndDisplayLyrics(cleanLyrics);
  const savedLyrics = mergeLyricOffsetIntoLyrics(cleanLyrics, currentLyricOffset);
  const saved = source === "本地缓存" ? true : await saveLyricsToLocalTag(musicName, savedLyrics);
  setLyricsStatus(saved
    ? `已通过${source}匹配并保存《${musicName}》歌词`
    : `已通过${source}匹配《${musicName}》歌词，但保存本地失败`);
  return true;
}

async function searchLyricsFromLrclib(musicName) {
  try {
    setLyricsStatus(`正在通过 LRCLIB 匹配《${musicName}》歌词`);
    const response = await fetchWithTimeout(`/api/lyrics/lrclib?name=${encodeURIComponent(musicName)}`, {}, 8000);
    const data = await response.json();
    const lyrics = data && data.lyrics ? data.lyrics : "";
    if (data && data.success && lyrics.trim()) {
      return handleFoundLyrics(musicName, lyrics, "LRCLIB");
    }

    setLyricsStatus("LRCLIB 没有匹配到歌词，正在尝试网易云");
    return false;
  } catch (error) {
    console.warn("LRCLIB 歌词搜索失败", error);
    return false;
  }
}

async function searchLyricsFromNetease(musicName) {
  try {
    setLyricsStatus(`正在通过网易云匹配《${musicName}》歌词`);
    const response = await fetchWithTimeout(`/api/lyrics/netease?name=${encodeURIComponent(musicName)}`, {}, 8000);
    const data = await response.json();
    const lyrics = data && data.lyrics ? data.lyrics : "";
    if (data && data.success && lyrics.trim()) {
      return handleFoundLyrics(musicName, lyrics, "网易云");
    }
  } catch (error) {
    console.warn("网易云歌词搜索失败", error);
  }

  return false;
}

async function searchLyricsFromQQ(musicName) {
  try {
    setLyricsStatus(`正在通过 QQ 音乐匹配《${musicName}》歌词`);
    const response = await fetchWithTimeout(`/api/lyrics/qq?name=${encodeURIComponent(musicName)}`, {}, 8000);
    const data = await response.json();
    const lyrics = data && data.lyrics ? data.lyrics : "";
    if (data && data.success && lyrics.trim()) {
      return handleFoundLyrics(musicName, lyrics, "QQ 音乐");
    }
  } catch (error) {
    console.warn("QQ 音乐歌词搜索失败", error);
  }

  return false;
}

async function searchLyricsFromPlugin(musicName) {
  try {
    const searchResponse = await fetchWithTimeout(`/api/search/online?keyword=${encodeURIComponent(musicName)}&plugin=all&page=1&limit=12`, {}, 6500);
    const searchData = await searchResponse.json();
    const candidates = Array.isArray(searchData.data)
      ? searchData.data
      : Array.isArray(searchData.list)
        ? searchData.list
        : Array.isArray(searchData.result)
          ? searchData.result
          : Array.isArray(searchData)
            ? searchData
            : [];

    for (const candidate of candidates.slice(0, 6)) {
      try {
        const embeddedLrc = candidate.rawLrc || candidate.lyric || candidate.lyrics || "";
        if (embeddedLrc && String(embeddedLrc).trim()) {
          return handleFoundLyrics(musicName, embeddedLrc, "在线插件");
        }

        if (candidate.isOpenAPI && candidate.lrc) {
          const lrcResponse = await fetchWithTimeout(candidate.lrc, {
            method: "GET",
            headers: { "Content-Type": "text/lrc" },
          }, 5000);
          const lrcText = await lrcResponse.text();
          if (lrcText && lrcText.trim()) {
            return handleFoundLyrics(musicName, lrcText, "在线插件");
          }
        }

        const response = await fetchWithTimeout("/api/play/getLyric", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(candidate),
        }, 5000);
        const lyricData = await response.json();
        const lrcText = lyricData.rawLrc || lyricData.lyric || lyricData.lyrics || lyricData.lrc || "";
        if ((lyricData.success || lrcText) && lrcText) {
          return handleFoundLyrics(musicName, lrcText, "在线插件");
        }
      } catch (error) {
        console.warn("尝试候选歌词失败", error);
      }
    }
  } catch (error) {
    console.warn("在线插件歌词搜索失败", error);
  }

  return false;
}

function toggleWarning() {
  const isVisible = $("#warning-component").is(":visible");
  if (isVisible) {
    closeDialog("warning-component");
  } else {
    openDialog("warning-component");
  }
}

function toggleDelete() {
  var del_music_name = $("#music_name").val();
  $("#delete-music-name").text(del_music_name);
  const isVisible = $("#delete-component").is(":visible");
  if (isVisible) {
    closeDialog("delete-component");
  } else {
    openDialog("delete-component");
  }
}
function confirmDelete() {
  var del_music_name = $("#music_name").val();
  console.log(`删除歌曲 ${del_music_name}`);
  $("#delete-component").hide(); // 隐藏删除框
  $.ajax({
    type: "POST",
    url: "/delmusic",
    data: JSON.stringify({ name: del_music_name }),
    contentType: "application/json; charset=utf-8",
    success: () => {
      alert(`删除 ${del_music_name} 成功`);
      refresh_music_list();
    },
    error: () => {
      alert(`删除 ${del_music_name} 失败`);
    },
  });
}
function formatTime(seconds) {
  // 处理无效值
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs < 10 ? "0" : ""}${secs}`; // Format time as mm:ss
}

var offset = 0;
var duration = 0;
let no_warning = localStorage.getItem("no-warning");

// 全局 did 变量初始化，默认为本机播放
var did = localStorage.getItem("cur_did") || "web_device";

// 拉取现有配置
$.get("/getsetting", function (data, status) {
  console.log(data, status);
  localStorage.setItem("mi_did", data.mi_did);

  did = localStorage.getItem("cur_did") || "web_device";
  var dids = [];
  if (data.mi_did != null) {
    dids = data.mi_did.split(",");
  }
  console.log("cur_did", did);
  console.log("dids", dids);

  // 如果当前 did 不是 web_device，且配置了设备列表，但 did 不在列表中，则使用第一个设备
  if (did != "web_device" && dids.length > 0 && !dids.includes(did)) {
    did = dids[0];
    localStorage.setItem("cur_did", did);
  }

  // 如果 did 仍然为空或未设置，默认使用 web_device
  if (!did || did === "") {
    did = "web_device";
    localStorage.setItem("cur_did", did);
  }

  window.did = did;
  $.get(`/getvolume?did=${did}`, function (data, status) {
    console.log(data, status, data["volume"]);
    $("#volume").val(data.volume);
  });
  refresh_music_list();

  $("#did").empty();
  var dids = data.mi_did.split(",");

  // 收集所有设备选项
  var deviceOptions = [];
  $.each(dids, function (index, value) {
    var cur_device = Object.values(data.devices).find(
      (device) => device.did === value,
    );

    if (cur_device) {
      deviceOptions.push({
        value: value,
        text: cur_device.name,
      });

      if (value === did) {
        playModeIndex = cur_device.play_type;
        console.log(
          "%c当前设备播放模式: ",
          "color: #007acc;",
          cur_device.play_type,
        );
        togglePlayMode(false);
      }
    }
  });

  // 添加本机选项
  deviceOptions.push({
    value: "web_device",
    text: "本机",
  });
  // 批量填充设备选项
  fillSelectOptions(
    "#did",
    deviceOptions,
    did,
    `设备列表已加载，共 ${deviceOptions.length} 个设备`,
  );

  console.log("cur_did", did);
  $("#did").change(function () {
    did = $(this).val();
    localStorage.setItem("cur_did", did);
    window.did = did;
    console.log("cur_did", did);
    location.reload();
  });

  if (did == "web_device") {
    // 本机播放：显示 audio 控件和进度条
    $("#audio").fadeIn();
    $("#device-audio").fadeIn(); // 保持显示，因为进度条在这里

    //本机播放隐藏关机按钮
    $('#stop').hide();
    // 本机播放：禁用设备相关按钮，启用本机按钮
    // 搜索、定时、测试按钮禁用
    $(".icon-item").each(function () {
      const text = $(this).find("p").text();
      if (text === "搜索" || text === "定时" || text === "测试") {
        $(this).addClass("disabled");
        $(this).css("opacity", "0.5");
        $(this).css("pointer-events", "none");
      }
    });

    // 其他按钮启用（播放模式、上一曲、播放、下一曲、停止、收藏、音量、设置）
    $("#modeBtn").removeClass("disabled");
    $(".favorite").removeClass("disabled");
  } else {
    // 设备播放：隐藏 audio 控件，显示进度条
    $("#audio").fadeOut();
    $("#device-audio").fadeIn();

    // 设备播放：恢复所有按钮
    $(".device-enable").removeClass("disabled");
    $(".icon-item").removeClass("disabled");
    $(".icon-item").css("opacity", "");
    $(".icon-item").css("pointer-events", "");

    //设备播放隐藏快进快退倍速按钮
     $("#speedDiv").hide();
     $("#rewindDiv").hide();
     $("#forwardDiv").hide();


  }

  // 初始化对话记录开关状态
  updatePullAskUI(data.enable_pull_ask);
});

function compareVersion(version1, version2) {
  const v1 = version1.split(".").map(Number);
  const v2 = version2.split(".").map(Number);
  const len = Math.max(v1.length, v2.length);

  for (let i = 0; i < len; i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

// 拉取版本
$.get("/getversion", function (data, status) {
  console.log(data, status, data["version"]);
  $("#version").text(`${data.version}`);

  $.get("/latestversion", function (ret, status) {
    console.log(ret, status);
    if (ret.ret == "OK") {
      const result = compareVersion(ret.version, data.version);
      if (result > 0) {
        console.log(`${ret.version} is greater than ${data.version}`);
        $("#versionnew").text("new").css("display", "inline-block");
      }
    }
  });
});

function _refresh_music_list(callback) {
  $("#music_list").empty();
  $.get("/musiclist", function (data, status) {
    console.log(data, status);
    favoritelist = Array.isArray(data["收藏"]) ? data["收藏"] : [];

    // 收集所有播放列表选项
    var playlistOptions = [];
    $.each(data, function (key, value) {
      let cnt = value.length;
      playlistOptions.push({
        value: key,
        text: `${key} (${cnt})`,
      });
    });

    // 批量填充播放列表选项
    fillSelectOptions(
      "#music_list",
      playlistOptions,
      null, // 选中值将在后面通过 trigger('change') 设置
      `播放列表已加载，共 ${playlistOptions.length} 个列表`,
    );

    $("#music_list").off("change").on("change", function () {
      const selectedValue = $(this).val();
      localStorage.setItem("cur_playlist", selectedValue);
      $("#music_name").empty();
      const cur_music = localStorage.getItem("cur_music");
      console.log("#music_name cur_music", cur_music);

      // 收集所有歌曲选项
      var songOptions = [];
      $.each(data[selectedValue], function (index, item) {
        const songValue =
          typeof item === "string"
            ? item
            : item && typeof item === "object"
              ? item.name || item.title || item.id || JSON.stringify(item)
              : String(item);
        songOptions.push({
          value: songValue,
          text: songValue,
        });
      });

      // 批量填充歌曲选项
      fillSelectOptions(
        "#music_name",
        songOptions,
        cur_music,
        `歌曲列表已加载，共 ${songOptions.length} 首歌曲`,
      );

      // 本机播放：更新播放列表
      var did = $("#did").val();
      if (did == "web_device") {
        const playlistData = $("#music_name option")
          .map(function () {
            return $(this).val();
          })
          .get();
        WebPlayer.setPlayList(playlistData);
        WebPlayer.setPlaylist(selectedValue);
        console.log("本机播放列表已更新:", selectedValue);
      }
    });

    // 监听歌曲选择变化（本机播放）
    $("#music_name").off("change").on("change", function () {
      if (suppressMusicSelectChange) return;

      var did = $("#did").val();
      const selectedMusic = $(this).val();
      if (!selectedMusic) return;

      if (did == "web_device") {
        console.log("本机选择歌曲并播放:", selectedMusic);
        webPlay();
      } else {
        console.log("设备选择歌曲并播放:", selectedMusic);
        playOnDevice();
        loadLyricsForMusic(selectedMusic);
      }
    });

    // 本机模式：直接使用 WebPlayer 的状态，不调用后端接口
    if (did == "web_device") {
      const savedPlaylist = WebPlayer.getPlaylist();
      const savedMusic = WebPlayer.getCurrentMusic();

      console.log(
        "恢复本机播放状态 - 歌单:",
        savedPlaylist,
        "歌曲:",
        savedMusic,
      );

      // 恢复歌单选择
      if (savedPlaylist && data.hasOwnProperty(savedPlaylist)) {
        $("#music_list").val(savedPlaylist);
        $("#music_list").trigger("change");

        // 等待歌单切换完成后，恢复歌曲选择
        setTimeout(function () {
          if (
            savedMusic &&
            $("#music_name option[value='" + savedMusic + "']").length > 0
          ) {
            $("#music_name").val(savedMusic);
            loadLyricsForMusic(savedMusic);
            console.log("已恢复歌曲选择:", savedMusic);
          }
        }, 100);
      } else {
        // 没有保存的歌单，使用默认
        $("#music_list").trigger("change");
      }
      callback();
    } else {
      // 设备模式：使用原有逻辑
      $("#music_list").trigger("change");

      // 获取当前播放列表
      $.get(`/curplaylist?did=${did}`, function (playlist, status) {
        if (playlist != "") {
          $("#music_list").val(playlist);
          $("#music_list").trigger("change");
        } else {
          // 使用本地记录的
          playlist = localStorage.getItem("cur_playlist");
          if (data.hasOwnProperty(playlist)) {
            $("#music_list").val(playlist);
            $("#music_list").trigger("change");
          }
        }
      });
      callback();
    }
  });
}

// 拉取播放列表
function refresh_music_list() {
  // 刷新列表时清空并临时禁用搜索框
  const searchInput = document.getElementById("search");
  const oriPlaceHolder = searchInput.placeholder;
  const oriValue = searchInput.value;
  const inputEvent = new Event("input", { bubbles: true });
  searchInput.value = "";
  // 分发事件，让其他控件改变状态
  searchInput.dispatchEvent(inputEvent);
  searchInput.disabled = true;
  searchInput.placeholder = "请等待...";

  _refresh_music_list(() => {
    // 刷新完成再启用
    searchInput.disabled = false;
    searchInput.value = oriValue;
    searchInput.dispatchEvent(inputEvent);
    searchInput.placeholder = oriPlaceHolder;
    // 获取下正在播放的音乐
    if (did != "web_device") {
      connectWebSocket(did);
    }
  });
}

function do_play_music_list(listname, musicname) {
  $.ajax({
    type: "POST",
    url: "/playmusiclist",
    contentType: "application/json; charset=utf-8",
    data: JSON.stringify({
      did: did,
      listname: listname,
      musicname: musicname,
    }),
    success: () => {
      console.log("do_play_music_list succ", listname, musicname);
    },
    error: () => {
      console.log("do_play_music_list failed", listname, musicname);
    },
  });
}

$("#play_music_list").on("click", () => {
  var music_list = $("#music_list").val();
  var music_name = $("#music_name").val();
  if (no_warning) {
    do_play_music_list(music_list, music_name);
    return;
  }
  $.get(`/musicinfo?name=${music_name}`, function (data, status) {
    console.log(data);
    if (data.ret == "OK") {
      validHost(data.url) && do_play_music_list(music_list, music_name);
    }
  });
});

function playUrl() {
  var url = $("#music-url").val();
  const encoded_url = encodeURIComponent(url);
  $.get(`/playurl?url=${encoded_url}&did=${did}`, function (data, status) {
    console.log(data);
  });
}

function playProxyUrl() {
  const origin_url = $("#music-url").val();
  const protocol = window.location.protocol;
  const host = window.location.host;
  const baseUrl = `${protocol}//${host}`;
  const urlb64 = btoa(origin_url);
  const url = `${baseUrl}/proxy?urlb64=${urlb64}`;
  const encoded_url = encodeURIComponent(url);
  $.get(`/playurl?url=${encoded_url}&did=${did}`, function (data, status) {
    console.log(data);
  });
}

function playTts() {
  var value = $("#text-tts").val();
  $.get(`/playtts?text=${value}&did=${did}`, function (data, status) {
    console.log(data);
  });
}

function sendCustomCmd() {
  var cmd = $("#custom-cmd").val();
  if (!cmd || cmd.trim() === "") {
    alert("请输入自定义口令");
    return;
  }
  $.ajax({
    type: "POST",
    url: "/cmd",
    contentType: "application/json; charset=utf-8",
    data: JSON.stringify({ did: did, cmd: cmd }),
    success: () => {
      console.log("发送自定义口令成功:", cmd);
      alert(`口令 "${cmd}" 已发送`);
    },
    error: () => {
      console.log("发送自定义口令失败:", cmd);
      alert(`口令 "${cmd}" 发送失败`);
    },
  });
}

function do_play_music(musicname, searchkey) {
  $.ajax({
    type: "POST",
    url: "/playmusic",
    contentType: "application/json; charset=utf-8",
    data: JSON.stringify({
      did: did,
      musicname: musicname,
      searchkey: searchkey,
    }),
    success: () => {
      console.log("do_play_music succ", musicname, searchkey);
    },
    error: () => {
      console.log("do_play_music failed", musicname, searchkey);
    },
  });
}

// 上传功能：触发文件选择并提交到后端
function triggerUpload() {
  const uploadInput = document.getElementById("upload-file");
  if (uploadInput) {
    uploadInput.value = null;
    uploadInput.click();
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const uploadInput = document.getElementById("upload-file");
  if (uploadInput) {
    uploadInput.addEventListener("change", async function (e) {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const file = files[0];
      const playlist = $("#music_list").val();
      const form = new FormData();
      form.append("playlist", playlist);
      form.append("file", file);
      try {
        const resp = await fetch("/uploadmusic", {
          method: "POST",
          body: form,
        });
        if (!resp.ok) throw new Error("网络错误");
        const data = await resp.json();
        if (data && data.ret === "OK") {
          alert("上传成功: " + data.filename);
          refresh_music_list();
        } else {
          alert("上传失败");
        }
      } catch (err) {
        console.error(err);
        alert("上传失败");
      }
    });
  }
});

$("#play").on("click", () => {
  var search_key = $("#music-name").val();
  if (search_key == null) {
    search_key = "";
  }
  var filename = $("#music-filename").val();
  if (filename == null || filename == "") {
    filename = search_key;
  }
  do_play_music(filename, search_key);
});

$("#volume").on("change", function () {
  var value = $(this).val();
  var did = $("#did").val();

  updateVolumeAria(value);

  if (did == "web_device") {
    // 本机播放：直接控制 audio 元素音量
    const audioElement = document.getElementById("audio");
    audioElement.volume = value / 100; // audio.volume 范围是 0-1

    // 保存到 localStorage
    WebPlayer.setVolume(value);

    console.log("本机音量已设置为:", value);
  } else {
    // 设备播放：调用后端接口
    $.ajax({
      type: "POST",
      url: "/setvolume",
      contentType: "application/json; charset=utf-8",
      data: JSON.stringify({ did: did, volume: value }),
      success: () => {},
      error: () => {},
    });
  }
});

function check_status_refresh_music_list(retries) {
  $.get("/cmdstatus", function (data) {
    if (data.status === "finish") {
      refresh_music_list();
    } else if (retries > 0) {
      setTimeout(function () {
        check_status_refresh_music_list(retries - 1);
      }, 1000); // 等待1秒后重试
    }
  });
}

function refreshlist() {
  $.ajax({
    type: "POST",
    url: "/api/music/refreshlist",
    contentType: "application/json; charset=utf-8",
    data: JSON.stringify({}),
    success: () => {
      check_status_refresh_music_list(3); // 最多重试3次
    },
    error: () => {
      // 请求失败时执行的操作
    },
  });
}

function sendcmd(cmd) {
  $.ajax({
    type: "POST",
    url: "/cmd",
    contentType: "application/json; charset=utf-8",
    data: JSON.stringify({ did: did, cmd: cmd }),
    success: () => {
      if (cmd == "刷新列表") {
        check_status_refresh_music_list(3); // 最多重试3次
      }
      if (
        ["全部循环", "单曲循环", "随机播放", "单曲播放", "顺序播放"].includes(
          cmd,
        )
      ) {
        location.reload();
      }
    },
    error: () => {
      // 请求失败时执行的操作
    },
  });
}

// 监听输入框的输入事件
function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

let selectedSearchResult = null;

function handleSearch() {
  const searchInput = document.getElementById("search");
  const resultsContainer = document.getElementById("music-name");
  const musicFilenameInput = document.getElementById("music-filename");

  searchInput.addEventListener(
    "input",
    debounce(function () {
      const query = searchInput.value.trim();

      if (query.length === 0) {
        resultsContainer.innerHTML =
          '<div class="search-result-empty">请输入搜索关键词</div>';
        selectedSearchResult = null;
        musicFilenameInput.style.display = "none";
        return;
      }

      // 显示加载状态
      resultsContainer.innerHTML =
        '<div class="search-result-empty">搜索中...</div>';

      fetch(`/searchmusic?name=${encodeURIComponent(query)}`)
        .then((response) => response.json())
        .then((data) => {
          resultsContainer.innerHTML = ""; // 清空现有内容

          // 添加用户输入作为关键词选项（始终显示在第一位）
          const keywordItem = document.createElement("div");
          keywordItem.className = "search-result-item keyword-option";
          keywordItem.textContent = `🔍 使用关键词播放: ${query}`;
          keywordItem.dataset.value = query;
          keywordItem.dataset.isKeyword = "true";
          keywordItem.onclick = function () {
            selectSearchResult(this);
          };
          resultsContainer.appendChild(keywordItem);

          // 找到的歌曲结果
          if (data.length > 0) {
            data.forEach((song) => {
              const item = document.createElement("div");
              item.className = "search-result-item";
              item.textContent = song;
              item.dataset.value = song;
              item.dataset.isKeyword = "false";
              item.onclick = function () {
                selectSearchResult(this);
              };
              resultsContainer.appendChild(item);
            });
          } else {
            // 没有找到本地歌曲
            const emptyItem = document.createElement("div");
            emptyItem.className = "search-result-empty";
            emptyItem.textContent = "没有找到本地歌曲，可使用关键词在线播放";
            resultsContainer.appendChild(emptyItem);
          }

          // 默认选中关键词选项
          selectSearchResult(keywordItem);
        })
        .catch((error) => {
          console.error("Error fetching data:", error);
          resultsContainer.innerHTML =
            '<div class="search-result-empty">搜索失败，请重试</div>';
        });
    }, 600),
  );
}

function selectSearchResult(element) {
  // 移除所有选中状态
  const allItems = document.querySelectorAll(".search-result-item");
  allItems.forEach((item) => item.classList.remove("selected"));

  // 添加选中状态
  element.classList.add("selected");
  selectedSearchResult = {
    value: element.dataset.value,
    isKeyword: element.dataset.isKeyword === "true",
  };

  // 根据是否是关键词选项决定是否显示文件名输入框
  const musicFilenameInput = document.getElementById("music-filename");
  if (selectedSearchResult.isKeyword) {
    musicFilenameInput.style.display = "block";
    musicFilenameInput.placeholder = `请输入保存为的文件名称(默认: ${selectedSearchResult.value})`;
  } else {
    musicFilenameInput.style.display = "none";
  }
}

handleSearch();

function formatTime(seconds) {
  var minutes = Math.floor(seconds / 60);
  var remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

$("audio").on("error", (e) => {
  //如果audio标签的src为空，则不做任何操作，兼容安卓端的低版本webview
  if ($("audio").attr("src") === "") {
    return;
  }
  console.log(
    "%c网页播放出现错误: ",
    "color: #007acc;",
    e.currentTarget.error.code,
    e.currentTarget.error.message,
  );
  alert(
    e.currentTarget.error.code == 4
      ? "无法打开媒体文件，XIAOMUSIC_HOSTNAME或端口地址错误，请重新设置"
      : "在线播放失败，请截图反馈: " + e.currentTarget.error.message,
  );
});
function validHost(url) {
  //如果 localStorage 中有 no-warning 则直接返回true
  if (no_warning) {
    return true;
  }
  const local = location.host;
  const host = new URL(url).host;
  // 如果当前页面的Host与设置中的XIAOMUSIC_HOSTNAME、PORT一致, 不再提醒
  if (local === host) {
    return true;
  }

  $("#local-host").text(local);
  $("#setting-host").text(host);
  $("#warning-component").show();
  console.log("%c 验证返回false", "color: #007acc;");
  return false;
}

function nowarning() {
  localStorage.setItem("no-warning", "true");
  no_warning = true;
  $("#warning-component").hide();
}
function timedShutDown(cmd) {
  $(".timer-tooltip").toggle();
  sendcmd(cmd);
  setTimeout(() => {
    $(".timer-tooltip").fadeOut();
  }, 3000);
}

function confirmSearch() {
  if (!selectedSearchResult) {
    alert("请先选择一个搜索结果");
    return;
  }

  var search_key = $("#search").val();
  var filename = selectedSearchResult.value;
  var musicfilename = $("#music-filename").val();

  // 如果是关键词选项且用户输入了自定义文件名
  if (
    selectedSearchResult.isKeyword &&
    musicfilename &&
    musicfilename.trim() !== ""
  ) {
    filename = musicfilename.trim();
  }

  console.log("confirmSearch", filename, search_key);
  do_play_music(filename, search_key);
  toggleSearch();
}

let ws = null;
let wsReconnectTimer = null;
let currentDid = null;
let isConnecting = false;

// 清理 WebSocket 连接
function cleanupWebSocket() {
  // 清除重连定时器
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }

  // 关闭现有连接
  if (ws) {
    try {
      // 移除事件监听器，避免触发 onclose 重连
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;

      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
    } catch (e) {
      console.error("关闭 WebSocket 失败:", e);
    }
    ws = null;
  }

  isConnecting = false;
}

// 启动 WebSocket 连接
function connectWebSocket(did) {
  // 如果正在连接中，直接返回
  if (isConnecting) {
    console.log("WebSocket 正在连接中，跳过重复连接");
    return;
  }

  // 如果 did 改变了，需要重新连接
  if (currentDid !== did) {
    console.log(`设备切换: ${currentDid} -> ${did}`);
    cleanupWebSocket();
    currentDid = did;
  }

  isConnecting = true;

  fetch(`/generate_ws_token?did=${did}`)
    .then((res) => res.json())
    .then((data) => {
      const token = data.token;
      startWebSocket(did, token);
    })
    .catch((err) => {
      console.error("获取 token 失败:", err);
      isConnecting = false;
      // 5秒后重试
      wsReconnectTimer = setTimeout(() => connectWebSocket(did), 5000);
    });
}

function startWebSocket(did, token) {
  // 再次检查，确保没有重复连接
  if (
    ws &&
    (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
  ) {
    console.log("WebSocket 已存在，跳过创建");
    isConnecting = false;
    return;
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const wsUrl = `${protocol}://${window.location.host}/ws/playingmusic?token=${token}`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket 连接成功");
      isConnecting = false;
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.ret !== "OK") return;

      isPlaying = data.is_playing;
      let cur_music = data.cur_music || "";

      $("#playering-music").text(
        isPlaying ? `【播放中】 ${cur_music}` : `【空闲中】 ${cur_music}`,
      );

      if (cur_music) {
        syncSelectedMusic(cur_music, cur_music !== currentLyricMusic);
      }

      offset = data.offset || 0;
      duration = data.duration || 0;

      if (Array.isArray(favoritelist) && favoritelist.includes(cur_music)) {
        $(".favorite").addClass("favorite-active");
      } else {
        $(".favorite").removeClass("favorite-active");
      }

      localStorage.setItem("cur_music", cur_music);
      updateProgressUI();
      updateLyricHighlight(offset);
    };

    ws.onclose = (event) => {
      console.log("WebSocket 已断开", event.code, event.reason);
      ws = null;
      isConnecting = false;

      // 只有在非主动关闭的情况下才重连
      if (event.code !== 1000) {
        console.log("3秒后尝试重连...");
        wsReconnectTimer = setTimeout(() => connectWebSocket(did), 3000);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket 错误:", err);
      isConnecting = false;
      // onerror 后会触发 onclose，所以这里不需要重连
    };
  } catch (e) {
    console.error("创建 WebSocket 失败:", e);
    isConnecting = false;
    wsReconnectTimer = setTimeout(() => connectWebSocket(did), 3000);
  }
}

// 每秒更新播放进度
function updateProgressUI() {
  const progressPercent = duration > 0 ? (offset / duration) * 100 : 0;
  $("#progress").val(progressPercent);
  $("#current-time").text(formatTime(offset));

  // 更新进度条 ARIA 属性
  updateProgressAria(offset, duration);
  $("#duration").text(formatTime(duration));
}

setInterval(() => {
  if (duration > 0 && isPlaying) {
    offset++;
    if (offset > duration) offset = duration;
    updateProgressUI();
    updateLyricHighlight(offset);
  }
}, 1000);

function togglePullAsk() {
  console.log("切换对话记录状态");
  $.get("/getsetting", function (data, status) {
    const currentState = data.enable_pull_ask;
    const newState = !currentState;

    $.ajax({
      type: "POST",
      url: "/api/system/modifiysetting",
      contentType: "application/json; charset=utf-8",
      data: JSON.stringify({
        enable_pull_ask: newState,
      }),
      success: (response) => {
        console.log("对话记录状态切换成功", response);
        updatePullAskUI(newState);
        alert(newState ? "对话记录已开启" : "对话记录已关闭");
      },
      error: (error) => {
        console.error("对话记录状态切换失败", error);
        alert("切换失败，请重试");
      },
    });
  });
}

function updatePullAskUI(enabled) {
  const pullAskToggle = $("#pullAskToggle");
  if (enabled) {
    pullAskToggle.addClass("active");
  } else {
    pullAskToggle.removeClass("active");
  }
  // 更新 ARIA 属性
  updatePullAskAria(enabled);
}

// ============ 无障碍功能初始化 ============

// 键盘事件监听
$(document).on("keydown", function (e) {
  // 如果焦点在输入框、文本域或选择框中，不处理快捷键
  const tagName = document.activeElement.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return;
  }

  // ESC 键 - 关闭当前打开的弹窗
  if (e.key === "Escape") {
    if (openDialogs.size > 0) {
      const dialogId = Array.from(openDialogs)[openDialogs.size - 1];
      closeDialog(dialogId);
      e.preventDefault();
    }
  }

  // 空格键 - 播放
  if (e.key === " " || e.code === "Space") {
    play();
    e.preventDefault();
  }
});

// 为自定义按钮添加键盘支持（Enter 和 Space 键）
$(document).on("keydown", '[role="button"], [role="switch"]', function (e) {
  if (e.key === "Enter" || e.key === " ") {
    $(this).click();
    e.preventDefault();
  }
});

// 初始化收藏按钮的 ARIA 状态
$(document).ready(function () {
  const isFavorited = $(".favorite").hasClass("favorite-active");
  updateFavoriteAria(isFavorited);
});

// ============ 本机播放器 UI 更新函数 ============

// 更新本机播放状态 UI
function updateWebPlayingUI() {
  const audioElement = document.getElementById("audio");
  const currentMusic = WebPlayer.getCurrentMusic();

  if (!audioElement) return;

  const isPlaying = !audioElement.paused;
  const statusText = isPlaying ? "【播放中】" : "【暂停】";

  $("#playering-music").text(statusText + (currentMusic || "无"));
}

// 更新本机收藏按钮状态
function updateWebFavoriteButton() {
  const currentMusic = WebPlayer.getCurrentMusic();

  if (!currentMusic) return;

  // 直接使用全局 favoritelist，数据来源于服务器
  const isFavorited = Array.isArray(favoritelist) && favoritelist.includes(currentMusic);

  if (isFavorited) {
    $(".favorite").addClass("favorite-active");
  } else {
    $(".favorite").removeClass("favorite-active");
  }

  updateFavoriteAria(isFavorited);
}

// ============ 本机播放器事件监听器 ============

// 初始化本机播放器
function initWebPlayer() {
  const audioElement = document.getElementById("audio");

  if (!audioElement) {
    console.error("Audio element not found");
    return;
  }

  // 从 localStorage 恢复音量
  const savedVolume = WebPlayer.getVolume();
  audioElement.volume = savedVolume / 100;
  $("#volume").val(savedVolume);
  updateVolumeAria(savedVolume);

  // 从 localStorage 恢复播放模式
  const savedMode = WebPlayer.getPlayMode();
  const modeBtnIcon = $("#modeBtn .material-icons");
  modeBtnIcon.text(playModes[savedMode].icon);
  $("#modeBtn .tooltip").text(playModes[savedMode].cmd);

  // 设置单曲循环模式
  if (savedMode === 0) {
    audioElement.loop = true;
  }

  // 监听播放事件
  audioElement.addEventListener("play", function () {
    console.log("Audio play event");
    updateWebPlayingUI();
  });

  // 监听暂停事件
  audioElement.addEventListener("pause", function () {
    console.log("Audio pause event");
    updateWebPlayingUI();
  });

  // 监听播放结束事件
  audioElement.addEventListener("ended", function () {
    console.log("Audio ended event triggered");

    const playMode = WebPlayer.getPlayMode();
    console.log("Current play mode:", playMode, playModes[playMode].cmd);

    // 单曲循环模式下，loop 属性会自动处理，不需要手动处理
    if (playMode === 0) {
      console.log("Single loop mode, audio.loop will handle it");
      return;
    }

    // 单曲播放模式：不自动播放下一首
    if (playMode === 3) {
      console.log("Single play mode, stop after current song");
      updateWebPlayingUI();
      return;
    }

    // 顺序播放模式：到末尾停止
    if (playMode === 4) {
      const playList = WebPlayer.getPlayList();
      const currentIndex = WebPlayer.getCurrentIndex();
      console.log(
        "Sequential play mode, current index:",
        currentIndex,
        "playlist length:",
        playList.length,
      );
      if (currentIndex >= playList.length - 1) {
        console.log("Reached end of playlist, stop playing");
        updateWebPlayingUI();
        return;
      }
    }

    // 其他模式：自动播放下一首
    console.log("Auto playing next song...");
    webPlayNext();
  });

  // 监听时间更新事件
  audioElement.addEventListener("timeupdate", function () {
    const currentTime = audioElement.currentTime;
    const duration = audioElement.duration;

    // 检查是否为流媒体（duration 为 Infinity）
    const isStream = !isFinite(duration);

    if (isStream) {
      // 流媒体：只显示当前播放时间，不显示进度条
      $("#current-time").text(formatTime(currentTime));
      $("#duration").text("直播流");
      $("#progress").val(0); // 进度条设为 0
      console.log("Stream playing, current time:", currentTime);
    } else if (duration > 0) {
      // 普通音频：显示进度条和时长
      const progressPercent = (currentTime / duration) * 100;
      $("#progress").val(progressPercent);
      $("#current-time").text(formatTime(currentTime));
      $("#duration").text(formatTime(duration));
      updateLyricHighlight(currentTime);

      // 更新 ARIA 属性
      updateProgressAria(currentTime, duration);
    }
  });

  // 监听元数据加载事件
  audioElement.addEventListener("loadedmetadata", function () {
    const duration = audioElement.duration;
    console.log("Audio metadata loaded, duration:", duration);

    // 检查是否为流媒体
    const isStream = !isFinite(duration);

    if (isStream) {
      // 流媒体：显示特殊标识
      $("#duration").text("直播流");
      $("#progress").val(0);
      $("#current-time").text("0:00");
      console.log("Stream detected");
    } else if (duration > 0) {
      // 普通音频文件
      $("#duration").text(formatTime(duration));
      $("#progress").val(0);
      $("#current-time").text("0:00");
    } else {
      // 无效的 duration
      $("#duration").text("0:00");
      $("#progress").val(0);
      $("#current-time").text("0:00");
    }
  });

  // 监听错误事件（已有，但确保本机播放也能正确处理）
  // 原有的 error 事件监听器已经存在，不需要重复添加

  console.log("Web player initialized");
}

// 页面加载完成后初始化本机播放器
$(document).ready(function () {
  // 等待设备选择器初始化完成后再执行
  setTimeout(function () {
    var did = $("#did").val();

    if (did == "web_device") {
      initWebPlayer();

      // 恢复上次播放的歌曲信息（仅显示，不自动播放）
      const lastMusic = WebPlayer.getCurrentMusic();
      if (lastMusic) {
        loadLyricOffset(lastMusic);
        updateWebPlayingUI();
        updateWebFavoriteButton();
      } else {
        updateLyricOffsetUI();
      }
    }
  }, 100);
});
