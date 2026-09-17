/**
 * BG 图点赞模块
 *
 * 允许用户在 todolist 标题右侧给当前背景图点赞（图标：BG图 + 👍）
 * 记录该图位置 URL，本地 JSON 数组累计记录
 * 预留并提供后续同步数据到对应云端（cloud sync）的完整接口
 */

import { state } from "../core/state.js";

const STORAGE_KEY = "vv_liked_bgs";

export function getLikedBgs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveLikedBgs(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("[BgLikes] 存储点赞记录失败:", e);
  }
}

export function getCurrentBgInfo() {
  let url = state.get("savedBgUrl") || state.get("backgroundImage") || "";
  if (!url) {
    const bgStyle = document.body?.style?.backgroundImage || "";
    const match = bgStyle.match(/url\(['"]?(.*?)['"]?\)/);
    if (match && match[1] && !match[1].startsWith("blob:")) {
      url = match[1];
    }
  }

  if (url.startsWith("/th?") || url.startsWith("/HPImageArchive")) {
    url = `https://cn.bing.com${url}`;
  }

  const identity = state.get("randomBgCurrentPreview") || url || "";
  let source = "custom";
  if (url.includes("bing.com") || identity.startsWith("bing:")) {
    source = "bing";
  } else if (url.includes("unsplash.com")) {
    source = "unsplash";
  } else if (url.includes("wallhaven.cc")) {
    source = "wallhaven";
  }

  return { url, identity, source };
}

export function isCurrentBgLiked() {
  const { url, identity } = getCurrentBgInfo();
  if (!url && !identity) return false;
  const list = getLikedBgs();
  return list.some(
    (item) =>
      (identity && item.identity === identity) ||
      (url && item.url === url),
  );
}

export function toggleLikeCurrentBg() {
  const { url, identity, source } = getCurrentBgInfo();
  if (!url && !identity) {
    return { liked: false, url: "", count: getLikedBgs().length };
  }

  const list = getLikedBgs();
  const existingIdx = list.findIndex(
    (item) =>
      (identity && item.identity === identity) ||
      (url && item.url === url),
  );

  let liked = false;
  if (existingIdx >= 0) {
    list.splice(existingIdx, 1);
    saveLikedBgs(list);
    liked = false;
  } else {
    const newItem = {
      id: `bg_like_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      url: url,
      identity: identity,
      source: source,
      likedAt: Date.now(),
      likedDate: new Date().toISOString(),
      synced: false,
    };
    list.push(newItem);
    saveLikedBgs(list);
    liked = true;
  }

  return { liked, url, count: list.length };
}

// 预留与提供后续同步到对应 Cloud 的能力
export const bgLikesCloudSync = {
  getPendingSyncItems() {
    return getLikedBgs().filter((item) => !item.synced);
  },
  markSynced(idsOrIdentities) {
    const targets = new Set(
      Array.isArray(idsOrIdentities) ? idsOrIdentities : [idsOrIdentities],
    );
    const list = getLikedBgs().map((item) => {
      if (
        targets.has(item.id) ||
        targets.has(item.identity) ||
        targets.has(item.url)
      ) {
        return { ...item, synced: true, syncedAt: Date.now() };
      }
      return item;
    });
    saveLikedBgs(list);
    return list;
  },
  mergeFromCloud(cloudItems) {
    if (!Array.isArray(cloudItems)) return getLikedBgs();
    const local = getLikedBgs();
    const map = new Map();
    local.forEach((item) => map.set(item.identity || item.url, item));
    cloudItems.forEach((cItem) => {
      const key = cItem.identity || cItem.url;
      if (key && !map.has(key)) {
        map.set(key, { ...cItem, synced: true });
      }
    });
    const merged = Array.from(map.values()).sort(
      (a, b) => (b.likedAt || 0) - (a.likedAt || 0),
    );
    saveLikedBgs(merged);
    return merged;
  },
  exportJson() {
    return JSON.stringify(getLikedBgs(), null, 2);
  },
  getAll: getLikedBgs,
};

// 按钮控制器：同时支持 popup 标题和 pinned tasks 标题两个位置
export class BgLikeManager {
  constructor() {
    this.buttons = Array.from(document.querySelectorAll(".bg-like-btn"));
    if (!this.buttons.length) return;

    this.bindEvents();
    this.updateState();

    state.subscribe((key) => {
      if (
        key === "savedBgUrl" ||
        key === "backgroundImage" ||
        key === "randomBgCurrentPreview"
      ) {
        this.updateState();
      }
    });

    // 挂载到 window 方便调试与外部调用
    window.__bgLikesCloudSync = bgLikesCloudSync;
  }

  bindEvents() {
    this.buttons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.handleClick(btn);
      });
    });
  }

  handleClick(clickedBtn) {
    toggleLikeCurrentBg();
    this.updateState();
    this.animateButtons(clickedBtn);
  }

  updateState() {
    const liked = isCurrentBgLiked();
    const count = getLikedBgs().length;
    this.buttons.forEach((btn) => {
      btn.classList.toggle("bg-like-active", liked);
      btn.setAttribute("aria-pressed", String(liked));
      btn.title = liked
        ? `已点赞当前背景 (共 ${count} 张已赞壁纸，点击取消)`
        : `为当前背景图点赞 (已有 ${count} 张)`;
    });
  }

  animateButtons() {
    this.buttons.forEach((btn) => {
      btn.classList.remove("bg-like-pop");
      void btn.offsetWidth;
      btn.classList.add("bg-like-pop");
      btn.addEventListener(
        "animationend",
        () => btn.classList.remove("bg-like-pop"),
        { once: true },
      );
    });
  }
}
