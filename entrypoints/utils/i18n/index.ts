import { ref, type Ref } from 'vue';
import { storage } from '@wxt-dev/storage';
import zhHans from './locales/zh-Hans';
import zhHant from './locales/zh-Hant';
import en from './locales/en';
import ja from './locales/ja';

export type Locale = 'zh-Hans' | 'zh-Hant' | 'en' | 'ja';
export type LangPref = 'auto' | Locale;

export const LOCALE_VALUES: Locale[] = ['zh-Hans', 'zh-Hant', 'en', 'ja'];

export type Messages = Record<string, string>;

const messages: Record<Locale, Messages> = {
    'zh-Hans': zhHans,
    'zh-Hant': zhHant,
    en,
    ja,
};

/**
 * 按浏览器界面语言推断默认语言。
 * 英文环境落入英文（en），繁体环境识别 zh-Hant，其余简体与未知语言分别归入 zh-Hans / en。
 */
export function detectLocale(): Locale {
    let raw = '';
    try {
        raw = (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage?.()) || '';
    } catch {
        // 无 chrome.i18n（普通网页 / Firefox）时回退 navigator
    }
    if (!raw) {
        try {
            raw = typeof navigator !== 'undefined' ? navigator.language || '' : '';
        } catch {
            raw = '';
        }
    }
    const tag = raw.toLowerCase();
    if (tag.startsWith('zh')) {
        return /hant|tw|hk|mo/.test(tag) ? 'zh-Hant' : 'zh-Hans';
    }
    if (tag.startsWith('ja')) return 'ja';
    return 'en';
}

export const locale: Ref<Locale> = ref(detectLocale());
export const langPref: Ref<LangPref> = ref('auto');

/**
 * 取词条。查找链为「当前语言 → 英文 → key 本身」，缺词不会抛错。
 * 读取 locale ref，因此 Vue 模板 / computed 中使用会自动建立响应式依赖。
 */
export function t(key: string, params?: Record<string, string | number>): string {
    const dict = messages[locale.value] || messages.en;
    let text = dict[key];
    if (text === undefined) text = messages.en[key];
    if (text === undefined) return key;
    if (params) {
        for (const name of Object.keys(params)) {
            text = text.split(`{${name}}`).join(String(params[name]));
        }
    }
    return text;
}

export function isLocale(value: unknown): value is Locale {
    return typeof value === 'string' && (LOCALE_VALUES as string[]).includes(value);
}

/**
 * 切换语言。persist 为 true 时把 lang 合并写回 local:config，
 * 让设置页 / 侧边栏 / 内容脚本跨页面保持一致。
 */
export function setLangPref(pref: LangPref, persist = true): void {
    const next: LangPref = pref === 'auto' || isLocale(pref) ? pref : 'auto';
    langPref.value = next;
    locale.value = next === 'auto' ? detectLocale() : next;
    if (persist) void persistLang(next);
}

async function persistLang(pref: LangPref): Promise<void> {
    try {
        const raw = await storage.getItem('local:config');
        let cfg: Record<string, any> = {};
        if (typeof raw === 'string' && raw) {
            try {
                cfg = JSON.parse(raw);
            } catch {
                cfg = {};
            }
        }
        cfg.lang = pref;
        await storage.setItem('local:config', JSON.stringify(cfg));
    } catch {
        // 无扩展存储上下文（如普通网页预览）时忽略，内存中的语言已切换
    }
}

function applyFromConfig(raw: unknown): void {
    if (typeof raw !== 'string' || !raw) return;
    try {
        const cfg = JSON.parse(raw);
        const pref = cfg?.lang;
        if (pref === undefined || pref === null) return;
        const next: LangPref = pref === 'auto' || isLocale(pref) ? pref : 'auto';
        if (next === langPref.value) return;
        langPref.value = next;
        locale.value = next === 'auto' ? detectLocale() : next;
    } catch {
        // 配置解析失败时保留当前语言
    }
}

let initialized = false;

/** 从 storage 读取语言偏好并监听后续变化。幂等，可安全重复调用。 */
export function initI18n(): void {
    if (initialized) return;
    initialized = true;
    storage
        .getItem('local:config')
        .then(applyFromConfig)
        .catch(() => {
            // 无扩展存储上下文时忽略，沿用浏览器语言推断结果
        });
    try {
        storage.watch('local:config', applyFromConfig);
    } catch {
        // 不支持 watch 的环境忽略
    }
}

// 模块加载即同步确定初始语言（浏览器语言，无 IO），再异步用已保存的偏好覆盖，
// 避免首帧渲染出错误语言。
initI18n();
