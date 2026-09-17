/**
 * 搜索引擎与站内检索提供商配置
 */

export const SEARCH_PROVIDERS = {
  engines: [
    {
      id: "baidu",
      name: "百度",
      url: "https://www.baidu.com/s",
      queryParam: "wd",
      icon: "baidu.png",
    },
    {
      id: "bing",
      name: "必应",
      url: "https://www.bing.com/search",
      queryParam: "q",
      icon: "bing.png",
    },
    {
      id: "google",
      name: "Google",
      url: "https://www.google.com/search",
      queryParam: "q",
      icon: "google.png",
    },
    {
      id: "duckduckgo",
      name: "DuckDuckGo",
      url: "https://duckduckgo.com/",
      queryParam: "q",
      icon: "duckduckgo.png",
    },
    {
      id: "perplexity",
      name: "Perplexity",
      url: "https://www.perplexity.ai/search",
      queryParam: "q",
      icon: "assets/ai-tools/perplexity.png",
    },
    {
      id: "yahoo",
      name: "Yahoo",
      url: "https://search.yahoo.com/search",
      queryParam: "p",
      icon: "yahoo.png",
    },
  ],
  platforms: [
    {
      id: "github",
      name: "GitHub",
      url: "https://github.com/search",
      queryParam: "q",
      icon: "github.png",
    },
    {
      id: "bilibili",
      name: "哔哩哔哩",
      url: "https://search.bilibili.com/all",
      queryParam: "keyword",
      icon: "bilibili.png",
    },
    {
      id: "zhihu",
      name: "知乎",
      url: "https://www.zhihu.com/search",
      queryParam: "q",
      icon: "zhihu.png",
    },
    {
      id: "youtube",
      name: "YouTube",
      url: "https://www.youtube.com/results",
      queryParam: "search_query",
      icon: "youtube.png",
    },
    {
      id: "wikipedia",
      name: "维基百科",
      url: "https://zh.wikipedia.org/w/index.php",
      queryParam: "search",
      icon: "wikipedia.png",
    },
    {
      id: "reddit",
      name: "Reddit",
      url: "https://www.reddit.com/search/",
      queryParam: "q",
      icon: "reddit.png",
    },
  ],
};

export const SEARCH_SUGGESTIONS = [
  "VerseVibe 沉浸式多语言翻译",
  "GitHub 热门开源趋势",
  "今日科技热点与要闻",
  "如何写出干净优雅的代码",
];
