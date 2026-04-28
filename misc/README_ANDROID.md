## Android 版 FluentRead 使用说明（基于 Firefox for Android）

> **逻辑完全复用现有 WebExtension 代码**：Android 版本不单独改业务逻辑，而是通过 Firefox for Android 加载同一套扩展，实现手机和平板上的沉浸式翻译体验。

---

## 一、整体思路

- FluentRead 已经支持 **Firefox 浏览器扩展**。
- Firefox for Android/平板 使用的扩展包与桌面版 Firefox 相同（同一个 XPI/ZIP 包）。
- 因此：
  - **开发/构建逻辑不变**：继续用 WXT 为 Firefox 构建扩展。
  - **Android 端安装**：通过 Firefox for Android 安装同一个扩展（线上商店或本地调试包）。
  - **平板适配**：Popup 和设置界面采用响应式布局，在大屏/横屏下自动放大宽度、优化排版（已在 CSS 中适配）。

---

## 二、构建 Firefox 版本扩展（Android 也使用这份包）

在项目根目录执行：

```bash
pnpm install
pnpm build:firefox
```

说明：

- 使用 `wxt -b firefox` 为 Firefox 目标构建扩展。
- 构建产物会被输出到 `wxt.config.ts` 中配置的 `outDir` 目录下，当前为：
  - **主输出目录**：`dist/`
  - Firefox 相关的构建目录通常为：`dist/firefox-*`（具体子目录由 WXT 管理）。

如需直接生成可分发的压缩包（ZIP/XPI）：

```bash
pnpm zip:firefox
```

- WXT 会在 `dist/` 目录下生成一个或多个 **ZIP 扩展包文件**：
  - 文件名通常包含扩展名、版本号以及 `firefox` 标记。
  - 终端输出会打印出所有生成的 ZIP 文件路径。

> 这些 ZIP 文件就是 **Firefox（桌面 + Android）共用的安装包 / 发布包**。

---

## 三、在 Android 手机上安装（最终用户视角）

### 方式 A：通过 Firefox 附加组件商店安装（推荐）

1. 在 Android 手机上/平板上安装 **Firefox 浏览器**（官网或应用商店）。
2. 在 Firefox 内打开 FluentRead 的附加组件页面（README 已提供链接）：  
   - `addons.mozilla.org` 上的 FluentRead 扩展页  
3. 按页面提示点击“添加到 Firefox”，完成安装。

> 一旦扩展在 Firefox 附加组件后台标记支持 Android，该链接会同时支持桌面和 Android（包含平板）。

### 方式 B：通过本地 ZIP/XPI 包调试安装

适用于开发者在 Android 设备上调试最新版扩展：

1. 按上文运行 `pnpm zip:firefox`，在 `dist/` 目录下找到最新的 Firefox ZIP 扩展包。
2. 将该文件传到 Android 设备（通过 USB、云盘等）。
3. 使用 Firefox 开发者文档提供的 **“通过 about:debugging 安装临时扩展”** 流程，在 Android Firefox 中加载该包：
   - 在桌面端 Firefox 打开 `about:debugging`
   - 连接 Android 设备的 Firefox
   - 选择“临时加载扩展”，指向你传输到设备上的 ZIP/XPI 文件

> 具体步骤可参考 Mozilla 官方文档，流程会随 Firefox 版本略有变动，因此不在此重复细节。

---

## 四、平板场景适配说明

为适配 Android 平板 / 大屏场景，本项目在 Popup 和设置界面样式上做了响应式优化：

- 在较宽屏幕（如平板横屏、DeX 模式等）下：
  - Popup 根容器的最小宽度会增加，适合更宽的设置页布局。
  - 文本字号略微增大，阅读更舒适。
  - 保持与桌面端视觉风格一致。
- 上述适配主要通过：
  - `entrypoints/popup/style.css` 中的 `@media (min-width: 768px)` 等媒体查询完成。

这些改动不会影响核心翻译逻辑，仅优化界面在大屏设备上的表现。

---

## 五、你关心的两个位置：安装包 & 发布包

### 1. 安装包（用于上传或本地安装）

执行：

```bash
pnpm zip:firefox
```

之后：

- **安装包所在目录**：`dist/`
- **安装包文件**：终端输出中带有 `firefox` 标记的 `.zip` 文件（或 `.xpi`，取决于工具版本）
  - 这是可直接上传到 Firefox 附加组件后台 或 用于临时加载的扩展包。

### 2. 发布包（线上分发给 Android 用户）

- 发布给用户的 **正式发布包** 本质上就是上一步生成并上传到 Firefox 附加组件商店的 ZIP/XPI 文件。
- 一旦该版本在商店审核通过并标记支持 Android：
  - Android 用户（包含平板）通过 README 中的 Firefox 商店链接安装的，就是这份 **发布包**。
  - 不需要单独区分“桌面包”和“Android 包”。

---

## 六、快速脚本（可选）

如果你希望进一步简化命令，可以使用根目录下的脚本（见 `scripts/build-android-firefox.sh`，如存在）：

```bash
bash scripts/build-android-firefox.sh
```

该脚本通常会：

1. 安装依赖并构建 Firefox 扩展（`pnpm install && pnpm build:firefox`）
2. 调用 `pnpm zip:firefox` 生成 ZIP/XPI 安装包
3. 在终端中打印出所有生成的安装包具体路径

> 你只需要从 `dist/` 中选择对应版本的 ZIP/XPI，即可作为 **Android + 桌面 Firefox 共用的安装/发布包**。

