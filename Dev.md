## FluentRead 开发日志（Dev）

> 本文记录 2026-02-11 对 FluentRead 项目的重新架构分析，以及 Chrome/Edge 扩展与 Android / iOS 方向的开发规划。

---

## 一、当前项目总体结构概览

- **Web 扩展主线（Chrome / Edge / Firefox）**
  - 基于 **WXT（Web eXtension Toolkit）**，典型 MV3 结构：
    - `entrypoints/background.ts`：右键菜单、标签页管理、消息路由、翻译请求中转。
    - `entrypoints/content.ts`：注入到页面，负责选中文本检测、快捷键、悬浮球、划词翻译等。
    - `entrypoints/popup/*`：扩展弹窗界面（Vue），用于配置与控制。
    - `entrypoints/offscreen/*` + `chrome-translator.ts`：在 Offscreen 页面中调用 **Chrome Translation API**，需要 Chrome 专有能力。
    - `entrypoints/main/dom.ts`：遍历并替换网页 DOM，完成“整页翻译”。
    - `entrypoints/main/trans.ts`：翻译流程编排与调度。
    - `entrypoints/utils/translateApi.ts`：统一封装翻译请求，通过 `browser.runtime.sendMessage` 与后台通信。
    - `entrypoints/service/*.ts`：具体翻译引擎实现（如各家云翻译服务）。
  - **结论**：浏览器扩展是当前项目最成熟、功能最完整的一条线，结构清晰，适合继续深度打磨。

- **Android 方向**
  - 路线 A：**Firefox for Android 复用 WebExtension**
    - 通过 `pnpm build:firefox` + `scripts/build-android-firefox.sh` 生成 XPI/ZIP，供 Android 版 Firefox 安装使用。
    - 这条路线基本“0 额外开发成本”，完全复用现有 WebExtension 能力。
  - 路线 B：`android/` 目录下的 **原生 Kotlin + Jetpack Compose App**
    - 有自己的悬浮球服务 `FloatingBubbleService.kt`（系统级 Overlay）。
    - 有抽象的翻译接口 `TranslationEngine`，目前仅提供 `EchoTranslationEngine`（回声示例，不是真实翻译）。
    - 有 `TranslationPreview.kt` 等 UI，用于展示翻译结果。
    - **尚未接入真实翻译引擎逻辑，与 Web 端 TS 代码也尚未共享。**

- **iOS / Safari 方向**
  - `misc/README_SAFARI.md` 描述了使用 `safari-web-extension-converter` 将 Chrome MV3 转为 Safari 扩展的流程。
  - 当前脚本使用 `--macos-only`，仅支持 **macOS Safari**，**尚未覆盖 iOS / iPadOS**。
  - 仓库中尚无 iOS 原生 App 代码，仅有 Safari 相关文档。

- **共享逻辑 & 文档**
  - `docs/config/*`：翻译引擎、配置、使用说明。
  - `entrypoints/utils/option.ts`：引擎 ID / 默认配置等。
  - `entrypoints/utils/constant.ts`：与翻译引擎相关的常量。
  - 当前 Android 原生部分的翻译实现 **没有直接复用** 这套 TypeScript 逻辑。

---

## 二、关键能力与当前设计亮点

- **（亮点 1）浏览器扩展层次清晰、模块划分合理**
  - 背景脚本、内容脚本、Popup、Offscreen 各司其职，便于后续新增功能和调试。
  - 翻译引擎通过 `entrypoints/service/*.ts` 插拔式管理，方便扩展更多服务。

- **（亮点 2）Chrome 专有能力加成（Offscreen + Translation API）**
  - 通过 Offscreen 页面和 `chrome.translation` 实现 **浏览器本地模型翻译**。
  - 适合作为“高质量 / 本地隐私”的增强功能。

- **（亮点 3）Android 已探索两条路线**
  - 一条是 **直接用 WebExtension（Firefox Android）复用现有能力**，投入小见效快。
  - 另一条是 **独立原生 App（Kotlin + Compose）**，为将来做系统级悬浮球、剪贴板翻译、OCR 等能力打基础。

- **（亮点 4）文档与多引擎配置基础较好**
  - `docs/config/translation-engines.md` 等文档能帮助用户理解和配置各翻译引擎。
  - 未来在多端共享“引擎列表 / 语言列表 / 配置项”有良好基础。

---

## 三、目前对移动端不友好的设计点

> 下列内容是后续多端化、原生化时的重点改造对象。

- **1. 强依赖浏览器扩展 API**
  - 典型依赖：
    - `browser.runtime.sendMessage`
    - `browser.tabs`
    - `browser.contextMenus`
    - `browser.runtime.getURL`
  - 主要分布于：
    - `background.ts`
    - `content.ts`
    - 部分 Vue 组件（如 `FloatingBall.vue`、`Footer.vue` 等）
    - `entrypoints/utils/translateApi.ts`
  - **影响**：在 Android / iOS 原生环境中不存在这些 API，只能通过“适配层或重写”方式间接复用。

- **2. Chrome 专有 API 导致的单平台特性**
  - 典型依赖：
    - `chrome.offscreen`
    - `chrome.runtime.getContexts`
    - `chrome.translation`
  - 主要分布于：
    - Offscreen 相关入口与 `chrome-translator.ts`
  - **影响**：
    - 只能在桌面版 Chrome 使用，其他浏览器（包括 Edge / Firefox / 移动端）需自动降级到普通 HTTP 翻译引擎。

- **3. 存储和配置绑定扩展环境**
  - 使用了：
    - `@wxt-dev/storage`、`storage.watch` 等。
  - 主要位于：
    - `config.ts`
    - 某些组件中对配置的监听与持久化。
  - **影响**：
    - 原生端需要用自身的存储方案（Android: SharedPreferences / DataStore；iOS: UserDefaults / CoreData），不能直接沿用。

- **4. 对 DOM / 网页上下文的强依赖**
  - 使用：
    - `document` / `window.location` / `document.title` / `localStorage` 等。
  - 主要位于：
    - `dom.ts`、`trans.ts`、`content.ts`、`cache.ts` 等。
  - **影响**：
    - 这些逻辑非常适合“给当前网页加一层翻译 UI”，但不适合“系统级悬浮球 + 任意文本翻译”的原生场景。

- **5. Android 原生 App 翻译能力仍是 Demo 状态**
  - `TranslationEngine` 目前只有 `EchoTranslationEngine`，尚未接入真实翻译服务。
  - 与 Web 端的多引擎实现（`service/*.ts`）尚未统一抽象。

---

## 四、重点功能规划（带颜色标记）

- <span style="color:#2e7d32;font-weight:bold;">重点功能 A：巩固并优化浏览器扩展主线（Chrome / Edge / Firefox / Firefox Android）</span>
  - 目标：在桌面和支持 WebExtension 的移动浏览器中提供 **稳定、一致、高性能的翻译体验**。
  - 关键点：
    - 对 `chrome.*` 专有能力进行能力检测（feature detection），无支持时自动回落至 HTTP 翻译引擎。
    - 对 `document` / `window.location` 等访问增加防御，避免在特殊页面（PDF、特殊协议）崩溃。
    - 对整页翻译的 DOM 遍历做性能优化（如分批处理、避免频繁 reflow）。

- <span style="color:#1565c0;font-weight:bold;">重点功能 B：抽象“跨平台翻译核心层”</span>
  - 目标：把 **与平台无关的翻译能力** 抽成一套核心接口，多端可共享。
  - 设计方向：
    - 定义统一的翻译接口，例如：
      - 输入：`{ text, fromLang, toLang, context? }`
      - 输出：`{ translatedText, error?, extraInfo? }`
    - 这层逻辑 **不直接使用** `browser.* / chrome.* / document / window / localStorage`。
    - Web 扩展通过适配层调用这套接口：
      - 有 Chrome Translation 时走本地模型；
      - 否则走 HTTP 引擎（现有 `service/*.ts`）。
    - 原生 Android / iOS 将来可以通过自己的实现或 HTTP 后端对接同样的协议。

- <span style="color:#c62828;font-weight:bold;">重点功能 C：Android 原生 App MVP（悬浮球 + 文本翻译）</span>
  - 目标：在 Android 上做出一个“**可用的系统级翻译工具**”，不依赖浏览器。
  - 关键步骤：
    - 在 `TranslationEngine` 中接入一个真实翻译服务（可先选最简单、成本最低的）。
    - 在 `FloatingBubbleService` / `MainActivity` 中接剪贴板 / 分享文本 / 手动输入，将文本转给 `TranslationEngine` 翻译。
    - UI 层展示翻译结果，并提供复制 / 分享等基础操作。

- <span style="color:#6a1b9a;font-weight:bold;">重点功能 D：Safari / iOS 方向探索</span>
  - 短期：完善 `scripts/build-safari.sh` 和 `README_SAFARI.md`，支持更顺畅地生成 macOS Safari 扩展。
  - 中期（如有需求）：尝试去掉 `--macos-only`，让扩展能在 iOS / iPadOS Safari 上使用。
  - 长期（如有精力）：基于抽象好的“翻译核心层”开发 iOS 原生 App，提供系统级翻译能力。

---

## 五、下一步计划（按优先级排序）

> 使用颜色区分优先级：<span style="color:#c62828;">红色 = 高优先级</span>，<span style="color:#1565c0;">蓝色 = 中优先级</span>，<span style="color:#6a1b9a;">紫色 = 视资源情况推进</span>。

1. <span style="color:#c62828;font-weight:bold;">P0：稳定和优化浏览器扩展主线</span>
   - 梳理所有 `chrome.*` 使用点，加上能力检测与 fallback：
     - Chrome 支持时使用 Offscreen + Translation API。
     - 其他浏览器（包括 Edge / Firefox / 移动端 Firefox）默认走 HTTP 翻译引擎。
   - 补充对 DOM / location / storage 的边界判定与错误处理，提高在各类网页上的鲁棒性。
   - 在大页面全文翻译场景下做性能 profiling 和简单优化。

2. <span style="color:#c62828;font-weight:bold;">P0：抽象“翻译核心接口层”</span>
   - 在 TypeScript 侧整理出一个不依赖具体平台的翻译接口。
   - 将现有 `service/*.ts` 的实现用该接口统一起来。
   - 在 Web 扩展中引入一层“平台适配层”，将 `browser.* / chrome.*` 与核心逻辑解耦。

3. <span style="color:#1565c0;font-weight:bold;">P1：Android 原生 App MVP</span>
   - 让 `TranslationEngine` 接入一个真实的 HTTP 翻译服务，完成“文本输入 → 翻译结果”的闭环。
   - 利用 `FloatingBubbleService` 实现：
     - 悬浮球点击 → 打开翻译面板。
     - 读取剪贴板内容 → 自动翻译并展示。
   - 简单打磨 UI 体验（加载态、错误提示、复制结果等）。

4. <span style="color:#1565c0;font-weight:bold;">P1：文档与配置统一</span>
   - 梳理 `docs/config/translation-engines.md` 与 `utils/option.ts` 中的引擎/语言配置。
   - 规划一份可被多端共享的“引擎配置 JSON / 协议”，为后续原生端复用做准备。

5. <span style="color:#6a1b9a;font-weight:bold;">P2：Safari / iOS 方向探索</span>
   - 完善 macOS Safari 扩展的打包与发布流程。
   - 评估 iOS Safari 与原生 App 的需求，如有必要，再逐步推进。

---

## 六、后续建议（高层级）

- **建议 1：优先把浏览器扩展这条线打磨到“非常稳定”**
  - 这是当前代码最成熟的一部分，收益最高，也能为其他平台提供最清晰的“参考实现”。

- **建议 2：在 TypeScript 里先把“翻译核心”和“平台适配”分层做好**
  - 一旦这个分层完成，未来无论是 Android / iOS / 桌面应用，都会更容易接入。

- **建议 3：Android 原生可以先做一个“好用的 MVP”，不急着追求所有 Web 功能同步**
  - 先做到“系统悬浮球 + 剪贴板翻译 + 结果展示”体验顺畅，再逐步往更复杂的场景扩展。

- **建议 4：iOS 留作中长期规划，根据用户反馈和资源再决定投入深度**
  - 如果 macOS Safari 扩展用户多、反馈好，再考虑 iOS / 原生 App，会更稳妥。

---

> 如需后续针对具体任务（例如“实现 TS 侧翻译核心抽象”或“接入 Android 真实翻译服务”）再细化到 TODO 级别，我可以按模块列出更详细的开发步骤与代码改动建议。

