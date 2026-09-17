/**
 * 壁纸服务配置
 *
 * 默认使用必应 (Bing) 每日高清壁纸，画质精美，拥有全球与国内极速 CDN。
 * 同时预留了 Unsplash、Wallhaven 开发者 API Key 槽位。
 */

export const WALLPAPER_CONFIG = {
  // 当前壁纸服务模式: "bing" | "unsplash" | "wallhaven" | "custom"
  provider: "bing",

  // 必应每日壁纸配置
  bing: {
    apiUrl: "https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=zh-CN",
    baseUrl: "https://cn.bing.com",
  },

  // Unsplash 开发者 API 配置 (申请地址: https://unsplash.com/developers)
  // 填入 Access Key 即可按关键词搜索海量高质量免版权图片
  unsplash: {
    apiKey: "", // 请在此填入 Unsplash Access Key
    apiHost: "https://api.unsplash.com",
    defaultQuery: "nature,landscape,minimalist",
  },

  // Wallhaven API 配置 (申请地址: https://wallhaven.cc/settings/api)
  wallhaven: {
    apiKey: "", // 请在此填入 Wallhaven API Key
    apiHost: "https://wallhaven.cc/api/v1",
    categories: "110", // 110: General & Anime, 100: General
  },
};
