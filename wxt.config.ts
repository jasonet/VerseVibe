import { defineConfig } from 'wxt';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import fs from 'fs';


const packageJson = JSON.parse(fs.readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));


// See https://wxt.dev/api/config.html
export default defineConfig({
    outDir: 'dist',
    // 已取消 dev 模式：统一只用 `npm run build` 输出到 dist/chrome-mv3/，
    // 在浏览器扩展页点击 "重新加载" 即可看到变化。
    modules: ['@wxt-dev/webextension-polyfill'],
    hooks: {
        // 移除 options_ui，避免引用已删除的 options.html（设置页已改为未列入 manifest 的 settings.html）
        'build:manifestGenerated': (wxt, manifest) => {
            delete (manifest as Record<string, unknown>).options_ui;
            if (wxt.config.browser === 'safari') {
                delete (manifest as Record<string, unknown>).side_panel;
                if (Array.isArray(manifest.permissions)) {
                    manifest.permissions = manifest.permissions.filter(
                        (p) => !['offscreen', 'sidePanel', 'favicon'].includes(p as string)
                    );
                }
                if (manifest.action) {
                    (manifest.action as Record<string, unknown>).default_popup = 'sidepanel.html';
                }
            }
        },
    },
    imports: {
        addons: {
            vueTemplate: true,
        },
    },
    vite: () => ({
        plugins: [vue() as any],
        define: {
            'process.env.VUE_APP_VERSION': JSON.stringify(packageJson.version),
        }
    }),
    manifest: {
        // 扩展元信息跟随浏览器界面语言（_locales 由 Chrome 按自身 UI 语言解析，
        // 不跟随应用内的语言开关——这是扩展的标准行为）
        default_locale: 'en',
        name: '__MSG_extName__',
        description: '__MSG_extDescription__',
        permissions: ['storage', 'contextMenus', 'offscreen', 'downloads', 'sidePanel', 'alarms', 'favicon', 'geolocation'],
        optional_permissions: ['topSites'],
        host_permissions: ['<all_urls>'],
        icons: {
            "16": "icon/tree-16.png",
            "32": "icon/tree-32.png",
            "48": "icon/tree-48.png",
            "64": "icon/tree-64.png",
            "128": "icon/tree-128.png",
            "256": "icon/tree-256.png",
            "512": "icon/tree-512.png"
        },
        action: {
            default_title: 'VerseVibe',
            default_icon: {
                "16": "icon/tree-16.png",
                "32": "icon/tree-32.png",
                "48": "icon/tree-48.png",
                "64": "icon/tree-64.png",
                "128": "icon/tree-128.png",
                "256": "icon/tree-256.png",
                "512": "icon/tree-512.png"
            }
        },
        commands: {
            "_execute_action": {
                "suggested_key": {
                    "default": "Alt+Q"
                }
            },
            "versevibe-flickr-download-max": {
                "suggested_key": {
                    "default": "Alt+D"
                },
                "description": "__MSG_cmdFlickrDownload__"
            }
        },
        web_accessible_resources: [
            {
                resources: ["icon/*.png", "pdfreader.html", "dashboard-assets/**"],
                matches: ["<all_urls>"]
            }
        ]
    },

});
