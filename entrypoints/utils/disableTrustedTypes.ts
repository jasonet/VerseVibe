/**
 * 必须在任何会引入 Vue（@vue/runtime-dom）的模块之前被求值的「副作用模块」。
 *
 * 背景：部分站点（如 GitHub）通过 CSP 设置了严格的 Trusted Types 策略白名单，
 * 例如 `trusted-types xqUQ2 default`。Vue 在 `@vue/runtime-dom` 模块初始化时
 * 会调用 `trustedTypes.createPolicy('vue', ...)`，名字 'vue' 不在白名单中，
 * 浏览器会抛出并在控制台报 CSP 违规：
 *   "Creating a TrustedTypePolicy named 'vue' violates ... trusted-types ...".
 * 这发生在「模块求值期」，早于任何 .mount() 调用，因此 mount 时的临时绕过来不及。
 *
 * 处理：内容脚本运行在隔离世界（isolated world），Chrome 对内容脚本的
 * Trusted Types「DOM sink 强制」是豁免的——也就是说在内容脚本里给 innerHTML
 * 赋普通字符串不会被拦截。于是这里在 Vue 加载前，把本隔离世界中 `window.trustedTypes`
 * 隐藏掉（仅影响内容脚本自身这份 window，不影响页面真实的 TT 工厂）。
 * Vue 检测不到 trustedTypes，就不会创建 'vue' 策略，既消除控制台 CSP 报错，
 * 又能正常用原始字符串渲染 UI（划词翻译/悬浮球/进度面板）。
 *
 * 注意：`trustedTypes` 是 Window.prototype 上的只读访问器，直接赋值无效，
 * 必须用 defineProperty 在 window 自身上「遮蔽」它。
 */
try {
  const w = window as Window & { trustedTypes?: unknown };
  if ('trustedTypes' in w && w.trustedTypes) {
    Object.defineProperty(w, 'trustedTypes', {
      configurable: true,
      writable: true,
      value: undefined,
    });
  }
} catch {
  // 某些环境下不可配置时直接忽略；mount 时的 mountVueWithTrustedTypesBypass 仍是兜底
}
