/**
 * RSS 新闻资讯源配置文件
 *
 * 默认主源已配置为用户的 Horizon Feed: https://my.hkez.com/horizon/feed.xml
 * 如需更换或追加其它 RSS 读取源，只需修改下方的 NEWS_PROVIDERS 列表即可。
 */

export const NEWS_CATEGORIES = Object.freeze([
  { id: "top", label: "头条推荐" },
  { id: "tech", label: "科技前沿" },
  { id: "dev", label: "开发者" },
  { id: "life", label: "生活思考" },
  { id: "finance", label: "财经动态" },
]);

export const NEWS_PROVIDERS = Object.freeze([
  {
    id: "horizon",
    name: "Horizon Feed",
    shortName: "Horizon",
    color: "#3b82f6",
    description: "Horizon 核心动态资讯",
    permission: "https://my.hkez.com/*",
    // 默认源地址（如需更改，直接替换下方 URL 即可）
    feeds: {
      top: "https://my.hkez.com/horizon/feed.xml",
      tech: "https://my.hkez.com/horizon/feed.xml",
      dev: "https://my.hkez.com/horizon/feed.xml",
      life: "https://my.hkez.com/horizon/feed.xml",
      finance: "https://my.hkez.com/horizon/feed.xml",
    },
  },
  {
    id: "sspai",
    name: "少数派",
    shortName: "少数派",
    color: "#d7191d",
    description: "高效工作与数字生活",
    permission: "https://sspai.com/*",
    feeds: {
      top: "https://sspai.com/feed",
      tech: "https://sspai.com/feed",
      life: "https://sspai.com/feed",
    },
  },
  {
    id: "36kr",
    name: "36氪",
    shortName: "36氪",
    color: "#1890ff",
    description: "创业创新与科技资讯",
    permission: "https://36kr.com/*",
    feeds: {
      top: "https://36kr.com/feed",
      tech: "https://36kr.com/feed",
      finance: "https://36kr.com/feed",
    },
  },
  {
    id: "ithome",
    name: "IT之家",
    shortName: "IT之家",
    color: "#d32f2f",
    description: "IT业界与数码前沿",
    permission: "https://www.ithome.com/*",
    feeds: {
      top: "https://www.ithome.com/rss/",
      tech: "https://www.ithome.com/rss/",
      dev: "https://www.ithome.com/rss/",
    },
  },
]);

export const DEFAULT_NEWS_PROVIDER_IDS = ["horizon"];
export const DEFAULT_NEWS_CATEGORY_IDS = ["top", "tech"];
export const NEWS_REFRESH_INTERVALS = Object.freeze([1, 2, 5, 10]);
export const NEWS_HEADLINE_OPACITIES = Object.freeze([0, 30, 50, 70]);
export const NEWS_CARD_COUNTS = Object.freeze([0, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25]);
export const NEWS_MIN_REFETCH_MS = 60 * 1000;
