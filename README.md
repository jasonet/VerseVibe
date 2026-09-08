# VerseVibe

> **网页内容在不同语言间自然共振，创造力来自生命树的灵性。**
> 
> Open Immersive Translate 开源沉浸式双语翻译浏览器扩展。

一款专为深度阅读与多语言工作者打造的现代化浏览器开源翻译插件，融合传统翻译与前沿大模型，提供丝滑的母语级双语对照与 PDF 沉浸式阅读体验。

---

## 🌟 核心特性

- 📄 **PDF 沉浸式翻译（全新混合架构）**
  - **在线 PDF 自动接管**：访问任意在线 PDF 自动跳转沉浸式阅读器（`pdfreader.html`），左侧高清原页 Canvas 预览，右侧对照与状态流。
  - **双语 PDF 导出**：结合本地 Python 翻译服务（`server/`），自动完成版面提取、大模型翻译、智能排版与单页紧凑压缩，一键导出**左英右中、原貌保真**的高质量双语对照 PDF。
  - **本地文件拖拽即读**：支持本地 PDF 文件直接拖拽或选取解析。

<kbd><img src="./misc/pdf-reader-preview.png" alt="VerseVibe PDF 沉浸式翻译与双语阅读器" style="width: 90%; max-width: 100%; border-radius: 8px; border: 1px solid #333; margin: 12px 0;"></kbd>

- 🤖 **本地 TranslateGemma / 纯翻译大模型深度优化**
  - 自动适配 Google TranslateGemma 官方标记协议（`<<<source>>>...<<<target>>>...<<<text>>>...`），杜绝大模型翻译指令本身的缺陷。
  - 多重输出清洗：剥除拼音、选项列表、发音标注、模型解释废话，仅保留第一种最精准译法。
  - 停止序列兜底与异常自动恢复。
- ⚡ **智能布局分析与整页调度（页面即开即翻）**
  - **无需等待多媒体加载**：DOM 解析完成即触发翻译，不等待图片/视频等全量资源加载。
  - **正文主干优先**：智能识别 `<article>`、`[role="main"]` 与主体分栏，优先翻译中央正文，再翻译侧栏、页头、页尾。
  - **SPA 客户端渲染兜底**：挂载 `MutationObserver`，React / Vue 动态渲染的内容亦能无缝补翻。
- 🎯 **就近配置与极简交互**
  - 划词即译、悬浮球一键全页翻译、快捷键定制。
  - 私密 AI 与本地接口就近配置，AI 风格预设一键切换。
  - 翻译失败友好提示、失败原因可追溯并支持一键点按重试。
- 🌐 **20+ 种主流翻译服务 & AI 大模型**
  - **AI 大模型**：DeepSeek、OpenAI (ChatGPT)、Claude、Gemini、Grok、通义千问、智谱清言、文心一言、MiniMax、Ollama、自建 / 代理接口等。
  - **传统翻译**：微软翻译、谷歌翻译、DeepL / DeepLX、有道翻译、Chrome 原生内置翻译等。
- 🔒 **隐私至上 & 完全开源**
  - 所有配置与历史数据本地存储，代码完全开源透明。

---

## 📸 界面与核心功能预览

### 1. PDF 沉浸式阅读与双语对照导出
<kbd><img src="./misc/pdf-reader-preview.png" alt="VerseVibe PDF 沉浸式翻译与双语对照" style="width: 88%; max-width: 100%; border-radius: 8px; border: 1px solid #333;"></kbd>

### 2. 功能强大的控制面板与模型就近配置
<kbd><img src="./misc/settings-preview.png" alt="VerseVibe 强大设置面板与模型配置" style="width: 50%; max-width: 100%; border-radius: 8px; border: 1px solid #333;"></kbd>

### 3. 网页双语对照与即时划词
<kbd><img src="./misc/sample-git-1.gif" alt="整页双语对照翻译" style="width: 80%; max-width: 100%; border: 1px solid #333; margin-bottom: 8px;"></kbd>
<kbd><img src="./misc/sample-git-4.gif" alt="划词翻译与交互" style="width: 80%; max-width: 100%; border: 1px solid #333; margin-bottom: 8px;"></kbd>
<kbd><img src="./misc/highlight_trans.png" alt="高亮翻译效果" style="width: 80%; max-width: 100%; border: 1px solid #333;"></kbd>

---

## 📦 Chrome / Edge 插件下载安装（开发者模式）

**[下载 VerseVibe 0.9.18 开发者模式 ZIP 包](https://github.com/jasonet/VerseVibe/raw/refs/heads/main/downloads/versevibe-0.9.18-chrome-edge.zip)**

该 ZIP 包包含已编译的插件加载目录，专用于通过 Chrome / Edge 的「开发者模式」加载扩展程序。无需安装 Node.js、下载源码或自行编译。下载后必须先解压，不能直接选择 ZIP 文件。

### 安装步骤

1. 下载上面的 ZIP 包，解压到一个固定位置（例如「文档/VerseVibe」）。解压后得到 `chrome-mv3` 文件夹，其中包含 `manifest.json`。
2. 打开浏览器扩展管理页：Chrome 在地址栏输入 `chrome://extensions`；Edge 输入 `edge://extensions`，然后回车。
3. 开启扩展管理页中的 **「开发者模式」**。
4. 点击 **「加载已解压的扩展程序」**（Edge 中也可能显示为「加载解压缩的扩展」）。
5. 选择解压得到的 **`chrome-mv3` 文件夹**，即直接包含 `manifest.json` 的目录；不要选择它的上级目录。
6. 扩展列表出现 **VerseVibe** 后安装完成。可在浏览器工具栏的扩展菜单中将其固定，打开插件设置并配置翻译服务，然后刷新需要翻译的网页。

**安装后请保留该文件夹，不要移动或删除**，浏览器会持续从该目录读取插件。更新时，将新版解压文件覆盖到原来的 `chrome-mv3` 目录，在扩展管理页点击 VerseVibe 的「重新加载」按钮，再刷新网页。

如果提示找不到清单文件，请检查所选目录下是否直接存在 `manifest.json`，并确认 ZIP 已完整解压。

另提供 **[CRX 签名包（0.9.18）](https://github.com/jasonet/VerseVibe/raw/refs/heads/main/downloads/versevibe-0.9.18.crx)**。上面的开发者模式安装步骤使用 ZIP 解压目录。

---

## 🛠️ 本地开发与构建打包

### 1. 环境准备

- Node.js >= 18
- pnpm >= 9 (`npm i -g pnpm`)
- Python 3.10+（若使用 PDF 导出服务）

### 2. 安装依赖

```bash
pnpm install
```

### 3. 开发调试

```bash
pnpm run build
```

在 Chromium 浏览器（Chrome / Edge / Brave 等）打开 `chrome://extensions`：
1. 开启右上角 **「开发者模式」**。
2. 点击 **「加载已解压的扩展程序」**。
3. 选择项目根目录下的 **`dist/chrome-mv3`** 文件夹。

> ⚠️ **注意**：必须选择 `dist/chrome-mv3` 目录，不要选项目根目录，否则会报 `Failed to load extension`。

### 4. 生产构建与打包发布

```bash
# 1. 编译 Chrome MV3 产物
pnpm run build

# 2. 生成未签名分发包 ZIP
pnpm run zip

# 3. 生成完整打包产物（ZIP + CRX 签名包）
pnpm run package:chrome
```

**产物说明：**
- `dist/chrome-mv3/`：已解压的扩展程序目录（用于本地调试加载）。
- `dist/versevibe-<版本>-chrome.zip`：用于上传 Chrome Web Store、Edge Add-ons，或解压后直接加载。
- `dist/versevibe-<版本>.crx`：签名后的 CRX 安装包（适用于支持本地安装的 Chromium 分发渠道）。

---

## 📑 PDF 沉浸式翻译本地服务（混合架构）

VerseVibe 提供高质量的「左原文截图 / 右中文译文」双语 PDF 生成能力，依赖本地轻量 Python 服务：

### 1. 启动服务

```bash
cd server
pip install -r requirements.txt
python server.py
# 或在 macOS 下直接双击 start.command
```
默认服务监听在 `http://127.0.0.1:8765`。

### 2. 在插件中配置

1. 打开插件设置页 -> **PDF沉浸式翻译**。
2. 确认服务地址为 `http://127.0.0.1:8765`。
3. 点击 **「测试连接」**，显示 `✓ 连接成功` 即可。
4. 打开任意网页 PDF，或在侧边栏点击 PDF 图标，即可在阅读器中直接点击 **「翻译并导出双语 PDF」**。

---

## 🧩 项目工程架构

从层次上看，整个项目分为 5 大模块：

```
VerseVibe/
├── entrypoints/                  # 浏览器扩展入口层 (WXT 驱动)
│   ├── background.ts             # Service Worker: 消息中转、跨域 fetch、CORS 绕过、Tab 控制
│   ├── content.ts                # Content Script: 页面 DOM 注入、PDF 自动接管、浮动球挂载
│   ├── pdfreader/                # PDF 沉浸式阅读器页面 (pdfreader.html / main.ts / pdf.js)
│   ├── popup/                    # 浏览器工具栏弹窗 UI
│   ├── sidepanel/                # 侧边栏面板 UI
│   ├── offscreen/                # Chrome Offscreen 隐形文档 (用于原生翻译桥接等)
│   ├── main/                     # 核心翻译调度与 DOM 处理
│   │   ├── trans.ts              # 翻译总调度中心、并发队列、状态流
│   │   ├── dom.ts                # DOM 提取、布局分析与正文优先级划分
│   │   └── compat.ts             # 复杂/特殊站点兼容适配
│   ├── service/                  # 20+ 翻译引擎与 LLM 服务实现
│   └── utils/                    # 配置、存储、缓存、快捷键、提示封装
├── components/                   # Vue 3 交互组件 (Main.vue, Header.vue, FloatingBall.vue 等)
├── server/                       # PDF 双语翻译与排版本地服务 (Python + PyMuPDF + ReportLab)
│   ├── server.py                 # FastAPI / HTTP 接口与 TranslateGemma pipeline
│   ├── pdf_bilingual.py          # PDF 页面解析、段落坐标对齐与单页紧凑排版生成
│   └── start.command             # macOS 一键启动快捷脚本
├── scripts/                      # 构建与打包脚本 (build-chrome.sh 等)
├── wxt.config.ts                 # WXT 与 Manifest V3 构建配置
└── package.json
```

---

## 🤝 开源与贡献

欢迎提交 Issue 与 Pull Request 共同改进 VerseVibe！

- 仓库地址：[https://github.com/jasonet/VerseVibe](https://github.com/jasonet/VerseVibe)

---

## 📄 License

[Apache-2.0 License](./LICENSE)
