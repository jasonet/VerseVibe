/**
 * 字体配置与字体栈
 */
export const FONT_OPTIONS = Object.freeze([
  Object.freeze({
    id: "system",
    label: "系统默认 (System)",
    googleFamily: "",
    stack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
  }),
  Object.freeze({
    id: "outfit",
    label: "Outfit",
    googleFamily: "Outfit:wght@400;500;600;700",
    stack: '"Outfit", system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
  }),
  Object.freeze({
    id: "inter",
    label: "Inter",
    googleFamily: "Inter:wght@400;600;700;800",
    stack: '"Inter", system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
  }),
  Object.freeze({
    id: "lexend",
    label: "Lexend",
    googleFamily: "Lexend:wght@400;500;700",
    stack: '"Lexend", system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
  }),
  Object.freeze({
    id: "fira-code",
    label: "Fira Code (等宽代码)",
    googleFamily: "Fira+Code:wght@400;500;600",
    stack: '"Fira Code", monospace, "PingFang SC", "Microsoft YaHei"',
  }),
]);
