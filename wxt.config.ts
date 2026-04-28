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
        'build:manifestGenerated': (_wxt, manifest) => {
            delete (manifest as Record<string, unknown>).options_ui;
        },
    },
    imports: {
        addons: {
            vueTemplate: true,
        },
    },
    vite: () => ({
        plugins: [vue()],
        define: {
            'process.env.VUE_APP_VERSION': JSON.stringify(packageJson.version),
        }
    }),
    manifest: {
        permissions: ['storage', 'contextMenus', 'offscreen', 'downloads', 'sidePanel'],
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
                "description": "下载当前 Flickr 页面的最大尺寸图片"
            }
        },
        web_accessible_resources: [
            {
                resources: ["icon/*.png"],
                matches: ["<all_urls>"]
            }
        ]
    },

});
