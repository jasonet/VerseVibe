import { storage } from '@wxt-dev/storage';

/**
 * 自建「检测新版本」机制（开发模式 / 非插件市场发版）。
 *
 * 思路：插件代码托管在 GitHub 私密仓库（不公开），但私密仓库无法被插件匿名读取，
 * 因此「版本清单 + 安装包」改由公网静态服务器 qdaa.com 托管：
 *   - 版本清单：https://qdaa.com/version.json
 *   - 安装包：  https://qdaa.com/ext/VerseVibe.zip
 *
 * version.json 结构：
 *   {
 *     "version": "0.9.3",
 *     "zip": "https://qdaa.com/downloads/chrome-extensions/VerseVibe.zip",
 *     "notes": "本次更新说明（可选）",
 *     "date": "2026-06-22"
 *   }
 *
 * background 在启动时与每隔数小时（alarms）拉取一次，与当前 manifest 版本比较；
 * 若服务器版本更高，则写入 storage（local:updateInfo）并在工具栏图标上打 "NEW" 角标，
 * 设置页读取该信息后展示「发现新版本 → 下载升级」横幅。
 */

export const UPDATE_VERSION_URL = 'https://qdaa.com/version.json';
export const UPDATE_FALLBACK_ZIP = 'https://qdaa.com/ext/VerseVibe.zip';
export const UPDATE_INFO_KEY = 'local:updateInfo';
const UPDATE_ALARM_NAME = 'versevibe-update-check';
const UPDATE_PERIOD_MINUTES = 360; // 每 6 小时检查一次

export interface UpdateInfo {
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    zip: string;
    notes: string;
    date: string;
    checkedAt: number;
    error?: string;
}

/** 读取当前已安装插件版本（以 manifest 为准，最可靠）。 */
export function getCurrentVersion(): string {
    try {
        return browser.runtime.getManifest().version || (process.env.VUE_APP_VERSION ?? '0.0.0');
    } catch {
        return process.env.VUE_APP_VERSION ?? '0.0.0';
    }
}

/**
 * 比较两个版本号（点分十进制，如 0.9.3 / 1.0.0）。
 * 返回 1 表示 a>b，-1 表示 a<b，0 表示相等。
 * 非数字段按 0 处理，多余的段也参与比较（1.0 < 1.0.1）。
 */
export function compareVersions(a: string, b: string): number {
    const pa = String(a).split('.').map((x) => parseInt(x, 10) || 0);
    const pb = String(b).split('.').map((x) => parseInt(x, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const da = pa[i] ?? 0;
        const db = pb[i] ?? 0;
        if (da > db) return 1;
        if (da < db) return -1;
    }
    return 0;
}

/** 拉取远端版本清单并与当前版本比较，结果写入 storage 并更新角标。 */
export async function checkForUpdate(): Promise<UpdateInfo> {
    const currentVersion = getCurrentVersion();
    try {
        const resp = await fetch(`${UPDATE_VERSION_URL}?t=${Date.now()}`, {
            method: 'GET',
            cache: 'no-store',
            credentials: 'omit',
        });
        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
        }
        const data = await resp.json();
        const latestVersion = String(data?.version ?? '').trim() || currentVersion;
        const zip = String(data?.zip ?? '').trim() || UPDATE_FALLBACK_ZIP;
        const notes = String(data?.notes ?? '').trim();
        const date = String(data?.date ?? '').trim();
        const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;

        const info: UpdateInfo = {
            currentVersion,
            latestVersion,
            updateAvailable,
            zip,
            notes,
            date,
            checkedAt: Date.now(),
        };

        await storage.setItem(UPDATE_INFO_KEY, info);
        await applyBadge(updateAvailable);
        return info;
    } catch (error) {
        const info: UpdateInfo = {
            currentVersion,
            latestVersion: currentVersion,
            updateAvailable: false,
            zip: UPDATE_FALLBACK_ZIP,
            notes: '',
            date: '',
            checkedAt: Date.now(),
            error: error instanceof Error ? error.message : String(error),
        };
        // 拉取失败时保留上一次成功结果，仅记录错误，不清除角标
        try {
            const prev = await storage.getItem<UpdateInfo>(UPDATE_INFO_KEY);
            if (prev && typeof prev === 'object') {
                await storage.setItem(UPDATE_INFO_KEY, { ...prev, checkedAt: Date.now(), error: info.error });
                return prev;
            }
        } catch {
            // ignore
        }
        await storage.setItem(UPDATE_INFO_KEY, info);
        return info;
    }
}

/** 在工具栏图标上设置 / 清除 "NEW" 角标。 */
async function applyBadge(show: boolean): Promise<void> {
    try {
        const action = (browser as any).action || (chrome as any).action;
        if (!action?.setBadgeText) return;
        await action.setBadgeText({ text: show ? 'NEW' : '' });
        if (show && action.setBadgeBackgroundColor) {
            await action.setBadgeBackgroundColor({ color: '#e11d48' });
        }
    } catch {
        // 某些环境（如 Firefox 旧版）无 action API，忽略
    }
}

/** 在 background 启动时调用：立即检查一次，并设置周期性 alarm。 */
export function setupUpdateCheck(): void {
    // 启动即查一次（延迟几秒避免和初始化抢资源）
    setTimeout(() => {
        void checkForUpdate();
    }, 4000);

    try {
        const alarms = (browser as any).alarms || (chrome as any).alarms;
        if (alarms?.create) {
            alarms.create(UPDATE_ALARM_NAME, { periodInMinutes: UPDATE_PERIOD_MINUTES });
            alarms.onAlarm?.addListener((alarm: { name: string }) => {
                if (alarm?.name === UPDATE_ALARM_NAME) {
                    void checkForUpdate();
                }
            });
        }
    } catch (error) {
        console.warn('[VerseVibe] 设置更新检查 alarm 失败:', error);
    }
}
