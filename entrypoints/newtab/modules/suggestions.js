import { state } from "../core/state.js";
import { showCustomModal } from "../core/utils.js";

// Suggestion service configuration
const ONLINE_SUGGESTION_ENDPOINT = "";
const ONLINE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ONLINE_REQUEST_TIMEOUT_MS = 8 * 1000;
const MAX_QUERY_LENGTH = 256;
const MAX_ONLINE_RESULTS = 10;
const CACHE_STORAGE_KEY = "vv_search_suggestion_cache_v2";
const LEGACY_CACHE_STORAGE_KEYS = [
  "ydd_search_suggestion_cache_v1",
  "ydd_search_suggestion_cache_v2",
];
const onlineCache = new Map();
let cacheCleanupTimer = null;

// Suggestion cache
function scheduleCacheCleanup() {
  if (cacheCleanupTimer !== null) clearTimeout(cacheCleanupTimer);
  const now = Date.now();
  for (const [key, entry] of onlineCache) {
    if (Number(entry.expiresAtMs) <= now) onlineCache.delete(key);
  }
  persistCache();
  const expirations = [...onlineCache.values()].map((entry) =>
    Number(entry.expiresAtMs)
  );
  if (!expirations.length) {
    cacheCleanupTimer = null;
    return;
  }
  cacheCleanupTimer = setTimeout(
    scheduleCacheCleanup,
    Math.max(0, Math.min(...expirations) - now),
  );
}

function loadCache() {
  try {
    LEGACY_CACHE_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    const saved = JSON.parse(localStorage.getItem(CACHE_STORAGE_KEY) || "{}");
    const now = Date.now();
    Object.entries(saved).forEach(([key, entry]) => {
      if (
        entry && Number(entry.expiresAtMs) > now && Array.isArray(entry.items)
      ) {
        onlineCache.set(key, entry);
      }
    });
    scheduleCacheCleanup();
  } catch {
    localStorage.removeItem(CACHE_STORAGE_KEY);
  }
}

function persistCache() {
  try {
    localStorage.setItem(
      CACHE_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(onlineCache)),
    );
  } catch {}
}

export function clearSuggestionCache() {
  onlineCache.clear();
  if (cacheCleanupTimer !== null) clearTimeout(cacheCleanupTimer);
  cacheCleanupTimer = null;
  try {
    localStorage.removeItem(CACHE_STORAGE_KEY);
    LEGACY_CACHE_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {}
}

function getEndpoint() {
  const relay = state.get("searchSuggestionProxyUrl");
  return relay || ONLINE_SUGGESTION_ENDPOINT;
}

// Suggestion consent
export async function requestSearchSuggestionConsent(endpointOverride = "") {
  if (state.get("searchSuggestionConsentRemembered") === true) return true;
  const endpoint = endpointOverride || getEndpoint();
  const isChinese = (navigator.language || "").toLowerCase().startsWith("zh");

  const message = isChinese
    ? "在线搜索建议将向联想接口发送您当前输入的文字，以获取联想关键词。\n\n建议结果缓存在本地浏览器中，并在24小时后自动清除。\n\n当前接口: " +
      (endpoint || "默认建议源")
    : "Online search suggestions send only what you are currently typing to the suggestion relay. Submitted search history is not sent.\n\nSuggestions are cached locally and deleted after 24 hours.\n\nCurrent relay: " +
      (endpoint || "Default relay");

  const result = await showCustomModal(
    message,
    false,
    false,
    [
      {
        text: isChinese ? "我同意" : "I Agree",
        value: ({ checkboxChecked }) => ({
          action: "agree",
          remember: checkboxChecked,
        }),
        width: "130px",
      },
      {
        text: isChinese ? "取消" : "Cancel",
        value: "cancel",
        width: "130px",
        style: "background: var(--bg-interactive); color: var(--text-primary);",
      },
    ],
    false,
    {
      title: isChinese ? "搜索联想提示" : "Search Suggestions",
      checkbox: { label: isChinese ? "记住此选择" : "Remember choice" },
      italicText: isChinese
        ? "您可以随时在设置中关闭在线联想或切换为仅本地历史。"
        : "You can disable online suggestions or change the relay at any time.",
    },
  );
  if (!result || result === "cancel" || result.action !== "agree") return false;
  if (result.remember) state.set("searchSuggestionConsentRemembered", true);
  return true;
}

loadCache();

export function isOnlineSuggestionMode(mode) {
  if (mode === "history-custom") {
    return Boolean(state.get("searchSuggestionProxyUrl"));
  }
  return mode === "history-online" || mode === "history-local-online";
}

export function hasCustomSuggestionRelay() {
  return Boolean(state.get("searchSuggestionProxyUrl"));
}

export function dismissSearchSuggestionBadge() {
  if (state.get("searchSuggestionBadgeDismissed") === true) return;
  state.set("searchSuggestionBadgeDismissed", true);
}

export function syncSuggestionModeSelect(select) {
  if (!select) return;
  const onlineOption = select.querySelector('option[value="history-online"]');
  const customOption = select.querySelector('option[value="history-custom"]');
  if (onlineOption) onlineOption.textContent = "历史记录 + 在线联想";
  if (customOption) customOption.textContent = "历史记录 + 自定义中继";
  if (select.id === "search-suggestion-mode-select") {
    const mode = state.get("searchSuggestionMode");
    select.value = mode === "history-custom"
      ? "history-online"
      : mode || "history-only";
  }
}

// Relay validation
export async function validateCustomSuggestionRelay(rawEndpoint) {
  let endpoint;
  try {
    endpoint = new URL(String(rawEndpoint || "").trim());
    if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") return false;
  } catch {
    return false;
  }

  for (const testQuery of ["test", "hello", "today"]) {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      ONLINE_REQUEST_TIMEOUT_MS,
    );
    try {
      const url = new URL(endpoint.href);
      url.searchParams.set("q", testQuery);
      const response = await fetch(url, {
        method: "GET",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const payload = await response.json();
      if (
        Array.isArray(payload) &&
        (Array.isArray(payload[1]) || payload.every((item) => typeof item === "string"))
      ) {
        return true;
      }
      if (
        Array.isArray(payload?.suggestions) &&
        payload.suggestions.every((item) => typeof item === "string")
      ) {
        return true;
      }
    } catch {
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return false;
}

function uniqueQueries(values, typedQuery = "") {
  const typed = typedQuery.trim().toLocaleLowerCase();
  const seen = new Set();
  return values.filter((value) => {
    if (typeof value !== "string") return false;
    const query = value.trim();
    const key = query.toLocaleLowerCase();
    if (!query || key === typed || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Suggestion engine
export class SuggestionEngine {
  async fetchOnlineSuggestions(rawQuery, signal) {
    const query = String(rawQuery || "").trim().slice(0, MAX_QUERY_LENGTH);
    const endpoint = getEndpoint();
    if (!endpoint) return [];

    const cacheKey = `${endpoint}\n${query.toLocaleLowerCase()}`;
    if (query.length < 2) {
      return [];
    }

    const cached = onlineCache.get(cacheKey);
    if (cached?.expiresAtMs > Date.now()) {
      dismissSearchSuggestionBadge();
      return cached.items.map((item) => ({ ...item }));
    }
    if (cached) onlineCache.delete(cacheKey);

    const requestController = new AbortController();
    const abortRequest = () => requestController.abort();
    signal?.addEventListener("abort", abortRequest, { once: true });
    const timeoutId = setTimeout(abortRequest, ONLINE_REQUEST_TIMEOUT_MS);

    try {
      const url = new URL(endpoint);
      url.searchParams.set("q", query);
      const response = await fetch(url, {
        method: "GET",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        signal: requestController.signal,
      });
      if (!response.ok) return [];

      const payload = await response.json();
      let rawList = [];
      if (Array.isArray(payload)) {
        // OpenSearch format: ["query", ["item1", "item2", ...]]
        if (Array.isArray(payload[1])) {
          rawList = payload[1].filter((item) => typeof item === "string");
        } else {
          rawList = payload.filter((item) => typeof item === "string");
        }
      } else if (Array.isArray(payload?.suggestions)) {
        rawList = payload.suggestions.filter((item) => typeof item === "string");
      }

      if (!rawList.length) return [];
      dismissSearchSuggestionBadge();
      const values = uniqueQueries(rawList, query)
        .map((value) => value.slice(0, MAX_QUERY_LENGTH))
        .slice(0, MAX_ONLINE_RESULTS);
      const items = values.map((suggestedQuery) => ({
        query: suggestedQuery,
        source: "online",
        section: "online",
        icon: "🌐",
        timestamp: 0,
      }));

      const cachedAtMs = Date.now();
      onlineCache.set(cacheKey, {
        cachedAt: new Date(cachedAtMs).toISOString(),
        expiresAt: new Date(cachedAtMs + ONLINE_CACHE_TTL_MS).toISOString(),
        expiresAtMs: cachedAtMs + ONLINE_CACHE_TTL_MS,
        items,
      });
      persistCache();
      scheduleCacheCleanup();
      return items.map((item) => ({ ...item }));
    } catch {
      return [];
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abortRequest);
    }
  }

  clearCache() {
    clearSuggestionCache();
  }
}

export {
  MAX_QUERY_LENGTH,
  ONLINE_CACHE_TTL_MS,
  ONLINE_REQUEST_TIMEOUT_MS,
  ONLINE_SUGGESTION_ENDPOINT,
};
