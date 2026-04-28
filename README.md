# VerseVibe

> [English](https://github.com/Bistutu/FluentRead/blob/main/misc/README_EN.md) | 中文

Open Immersive Translate 开源的沉浸式翻译。
npm run dev

一款革命性的浏览器开源翻译插件，让所有人都能够拥有母语般的阅读体验。

1. [官方文档（必看）](https://fluent.thinkstu.com/)
2. [B站视频介绍](https://www.bilibili.com/video/BV1ux4y1e73x/)
3. [deepwiki 架构介绍](https://deepwiki.com/Bistutu/FluentRead)

## 🌟 特性

- **智能翻译**：支持 20+ 种翻译引擎，包括传统翻译和 AI 大模型。如：微软翻译、谷歌翻译、DeepL翻译、OpenAI、DeepSeek、Kimi、Ollama、自定义引擎等。
- **双语对照**：支持原文与译文并列显示，让阅读更轻松。
- **划词翻译**：选中任意文本，即可获得即时翻译结果，一键复制译文，提高阅读效率。
- **全文翻译**：通过悬浮球一键翻译整个网页，无需刷新页面即可切换。
- **隐私保护**：所有数据本地存储，代码开源透明。
- **高度定制**：丰富的自定义选项，满足不同场景需求。
- **完全免费**：开源免费，非商业化项目。

<kbd><img src="./misc/sample-git-1.gif" alt="sample-git-1.gif" style="width: 80%; max-width: 100%;border: 1px solid black;"></kbd>

<kbd><img src="./misc/sample-git-4.gif" alt="sample-git-4.gif" style="width: 80%; max-width: 100%;border: 1px solid black;"></kbd>

<kbd><img src="./misc/highlight_trans.png" alt="sample-git-4.gif" style="width: 80%; max-width: 100%;border: 1px solid black;"></kbd>

## 📦 安装

| 浏览器 | 安装方式 |
|-------|---------|
| Chrome | [Chrome 应用商店](https://chromewebstore.google.com/detail/%E6%B5%81%E7%95%85%E9%98%85%E8%AF%BB/djnlaiohfaaifbibleebjggkghlmcpcj?hl=zh-CN&authuser=0) \| [国内镜像](https://www.crxsoso.com/webstore/detail/djnlaiohfaaifbibleebjggkghlmcpcj) |
| Edge | [Edge 应用商店](https://microsoftedge.microsoft.com/addons/detail/%E6%B5%81%E7%95%85%E9%98%85%E8%AF%BB/kakgmllfpjldjhcnkghpplmlbnmcoflp?hl=zh-CN) |
| Firefox | [Firefox 附加组件商店](https://addons.mozilla.org/zh-CN/firefox/addon/%E6%B5%81%E7%95%85%E9%98%85%E8%AF%BB/) |
| Safari | 通过本地构建安装，详见仓库内 `misc/README_SAFARI.md` |
| Android（Firefox） | 使用 Firefox for Android 安装，详见仓库内 `misc/README_ANDROID.md` |

## 📖 使用文档

请直接访问 [灵魂树官方文档](https://fluent.thinkstu.com/) 获取详细的：

**本地开发 / 加载未打包扩展（避免 “Failed to load extension”）：**

1. 构建：`pnpm run build`（开发时可用 `pnpm run dev` 监听变更）
2. 在 Chrome 打开 `chrome://extensions`，开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，**选择项目下的 `dist/chrome-mv3` 文件夹**（该目录内含 `manifest.json` 与 `icon/`，不要选项目根目录，否则会报 Failed to load extension）
4. 安装成功后，**扩展图标会出现在浏览器工具栏**，点击图标可打开设置弹窗；在页面上点击悬浮球上的设置图标可在新标签页打开完整设置页
5. 生成发布包：`pnpm run package:chrome`
6. 产物说明：
   - `dist/versevibe-<版本>-chrome.zip`：用于上传商店，或解压后再通过“加载已解压的扩展程序”安装
   - `dist/versevibe-<版本>.crx`：签名后的 CRX 安装包
7. 注意：**Chrome 官方桌面版通常不允许用户直接安装从网站下载的本地 `.crx` 文件**。如果目标是“用户下载后点一下就装”，推荐发布到 Chrome Web Store；本仓库内置打包更适合开发分发、企业内部分发，或兼容本地 CRX 安装策略的 Chromium 浏览器

**已知问题 / 待处理：**

- macOS 下 `Option/Alt + 字母` 组合键存在系统字符输入干扰，`Alt+A` 可能表现为 `å`，导致悬浮球热键在部分页面或壳层站点（如带嵌套 frame 的页面）触发不稳定。该问题仍待进一步优化；当前建议优先使用 `F9`、`Ctrl+Shift+A` 等非 `Option + 字母` 组合。

顶层结构总览（从“项目主题”和“层次”看）
这个项目是一个 Chrome / Edge 浏览器翻译扩展，核心主题可以理解成：
> “多引擎 + AI 翻译（整页 + 划词）+ Vue 配置界面 + WXT 打包”
从上到下大致分为 5 层：
工程与构建层（项目骨架、打包配置）
浏览器扩展入口层（background / content / popup / offscreen 等）
翻译核心与业务逻辑层（main、service、utils）
UI 组件与样式层（Vue 组件 + CSS 主题）
文档与资产层（VitePress 文档、图标等）
下面按目录分层说明。
一、工程与构建层（项目骨架）
package.json
描述项目依赖与脚本：Vue 3、Element Plus、TypeScript、WXT 等。
体现项目技术栈：Vue + TypeScript + WXT 的扩展工程。
wxt.config.ts
WXT 的主配置文件：相当于传统扩展的 manifest.json 的“生成源”。
定义：
扩展名称、描述、图标
入口（background、content、popup、offscreen）
权限（如 tabs、contextMenus、storage、scripting 等）
tsconfig.json / .gitignore / README.md / misc/README_EN.md
TypeScript 编译配置、忽略规则，以及中文/英文 README。
主要面向开发者，解释如何安装、构建、调试扩展。
> 这一层决定了项目如何构建、打包成真正的浏览器扩展。
二、浏览器扩展入口层（与浏览器交互的“壳”）
入口全部集中在 entrypoints/ 目录，是扩展在不同上下文中的“入口脚本”。
1. Background（后台脚本）
entrypoints/background.ts
运行在扩展后台（service worker）环境。
典型职责：
右键菜单（context menu）集成
统一处理需要跨域、长生命周期的请求
和 content script / popup 通信（message passing）
2. Content Script（内容脚本）
entrypoints/content.ts
注入到网页中执行，直接操作页面 DOM。
结合 entrypoints/main/ 中的 DOM 和翻译逻辑，实现：
整页翻译
选中文字翻译
在页面上挂载浮动球、气泡等 UI。
3. Popup UI（弹出窗口）
entrypoints/popup/
index.html / main.ts：挂载 Vue 应用的入口。
style.css：popup 独立样式。
Vue 主组件通常会在 components/ 内引用（如 Main.vue、Header.vue、Footer.vue）。
> 这一块就是点击浏览器工具栏图标后弹出的“设置/控制面板”。
4. Offscreen Document（隐形页面）
entrypoints/offscreen/index.html
entrypoints/offscreen/main.ts
使用 Chrome offscreen 文档能力，在不可见页面中执行代码。
用于：
走 Chrome 自带翻译接口
或作为某些翻译 API 的“桥接环境”，避免直接注入页面。
5. 公共样式
entrypoints/style.css
全局扩展入口级别的样式，给 content / popup / 浮动组件等提供基础 CSS。
> 这一整层是“与浏览器的集成点”，决定扩展在哪些上下文中出现、如何被加载。
三、翻译核心与业务逻辑层（项目的大脑）
这一层的代码主要在 entrypoints/main/、entrypoints/service/、entrypoints/utils/ 中，是项目的“业务核心”。
1. 主翻译流程（Main）
entrypoints/main/trans.ts
翻译总调度中心，负责：
整页翻译的流程控制
选择使用哪个翻译引擎
调用队列、缓存等工具
把翻译结果回写 DOM 或传给 UI 组件
entrypoints/main/dom.ts
DOM 操作模块，负责：
从页面中提取需翻译的文本节点
保留 HTML 结构（如标签、样式）
将翻译结果按原结构写回页面
entrypoints/main/compat.ts
网站适配层，负责：
对特定网站做兼容处理（如避免破坏某些站点的脚本/样式）
特殊站点上的 DOM 策略、排除规则等。
2. 翻译引擎层（Service）
目录：entrypoints/service/
通用基类 & 共用工具
_service.ts / common.ts
定义统一接口、错误处理、请求封装等。
为所有引擎提供相同调用方式（如 translate(text, from, to, options)）。
传统翻译服务
google.ts、microsoft.ts、deepl.ts、deeplx.ts、youdao.ts、chrome-translator.ts 等。
每个文件封装一个具体服务：
负责拼装请求、处理返回格式、错误重试等。
大模型 / AI 翻译服务
openai.ts、deepseek.ts、claude.ts、gemini.ts、grok.ts、
tongyi.ts、zhipu.ts、yiyan.ts、minimax.ts、xiaoniu.ts、
coze.ts、infini.ts、azure-openai.ts、tencent.ts、hunyuan-translation.ts 等。
负责对接各家 LLM / AI 服务，统一抽象为“翻译引擎”。
自定义 / 代理接口
custom.ts、newapi.ts
给用户配置自建翻译后端 / 第三方代理提供入口。
> 这一层体现“多引擎可插拔”的设计：上层逻辑只关心接口，不关心具体供应商。
3. 工具与支撑逻辑（Utils）
目录：entrypoints/utils/
核心文件职责大致如下（具体命名稍有不同，但语义接近）：
配置与常量
config.ts：用户配置（启用哪些引擎、默认语言、开关等）。
constant.ts：枚举、常量（如语言列表、快捷键默认值等）。
option.ts：选项页/配置项读写，通常和 chrome.storage 打交道。
model.ts：类型定义、数据模型（引擎配置、任务结构等）。
翻译接口与调度
translateApi.ts：提供统一的“调用翻译”的 API（屏蔽 service 层的细节）。
translateQueue.ts（如果存在）：请求队列、并发控制、节流等。
cache.ts：翻译结果缓存，减少重复调用。
功能性模块
selectionTranslator.ts：划词翻译 逻辑（选中文本 → 请求 → 弹出 UI）。
floatingBall.ts：浮动小球 的逻辑（位置、拖拽、点击触发）。
hotkey.ts：快捷键 绑定与处理。
check.ts：环境检测、兼容性检查。
template.ts：一些 HTML 字符串模板，生成插入页面的 DOM。
icon.ts：图标相关的小工具（可能与不同主题或状态图标有关）。
newApi.ts：新式 API 入口/挂载点，便于将来扩展新功能。
common.ts / tip.ts：公共工具函数、提示/通知封装。
> 这一层是“翻译业务的基础设施”：配置、缓存、队列、DOM 挂载、快捷键等都在这里。
四、UI 组件与样式层（用户交互界面）
1. Vue 组件（components/）
这些组件大部分会在 popup 或页面上挂载使用：
Main.vue
主设置界面：选择引擎、开启功能、调整参数等的中枢。
Header.vue / Footer.vue
配置界面的头部、底部，放 logo、标题、操作按钮等。
SelectionTranslator.vue
展示“划词翻译”的结果弹窗或侧边面板，可能有原文/译文切换、复制按钮等。
TranslationStatus.vue
显示当前翻译状态：进行中、成功、失败，错误提示等。
FloatingBall.vue
漂浮小球的 Vue 版本，负责 UI 展现与交互（绑定 floatingBall.ts 的逻辑）。
CustomHotkeyInput.vue
专门给用户录入快捷键用的输入组件，监听键盘组合并可视化显示。
> 这层把“复杂逻辑”封装成“交互友好”的 Vue 组件，既服务 popup，也服务页面内挂载的 UI。
2. 样式
entrypoints/popup/style.css
Popup 相关的特定样式。
entrypoints/style.css
全局扩展样式入口，覆盖内容脚本等。
styles/theme.css
主题相关样式（颜色、暗色模式、间距等），让整体 UI 有统一视觉风格。
五、文档与资产层（面向用户/宣传）
1. 文档站（docs/）
使用 VitePress 搭建文档网站：
docs/index.md：首页。
docs/guide/：使用指南（入门、功能说明、自定义快捷键、FAQ 等）。
docs/config/：配置说明（翻译引擎配置、参数解释）。
.vitepress/config.ts：文档站配置（导航、主题、侧边栏等）。
> 这部分是“产品说明书”，面向终端用户与高级用户（自定义 API / 引擎的人）。
2. 静态资源（public/）
public/icon/
扩展图标资源，多个尺寸（16/32/48/64/128/256/512），当前使用的是 tree 风格图标。
public/debug.html
调试页面：可能用于在浏览器直接调试脚本/样式的行为。
public/favicon.ico
文档站或调试页的 favicon。
六、从“主题”到“层次”的概括
从业务/主题角度，可以把整个项目看成 4 层嵌套：
浏览器扩展外壳
由 wxt.config.ts + entrypoints/ 中的 background/content/popup/offscreen 组成。
定义了扩展如何加载、在哪些环境运行。
翻译核心业务
entrypoints/main/ + entrypoints/service/ + entrypoints/utils/
管理：文本抽取 → 请求调度 → 多引擎调用 → 缓存 → 写回 DOM。
交互与展示
components/ + styles/ + entrypoints/popup/
面向用户的配置界面、状态面板、浮动球、划词弹窗等。
