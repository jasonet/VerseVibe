import {services} from "../utils/option";
import {config} from "@/entrypoints/utils/config";

// 内存中缓存的 JWT 令牌及当前的刷新 Promise，避免页面并发几十个请求时重复打爆 Microsoft auth 接口
let cachedJwtToken: string | null = null;
let tokenRefreshPromise: Promise<string> | null = null;

// 解析 jwt，返回解析后对象
function parseJwt(token: string) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
}

/**
 * 获取或刷新微软 Edge 翻译 JWT 令牌
 * 1. 内存中已缓存且未过期（提前 120 秒）直接返回
 * 2. 检查持久化配置中的 token 是否有效
 * 3. 多个并发请求复用同一个 Promise，避免重复刷新
 * 4. 获取成功后自动更新缓存
 */
export async function getMicrosoftToken(): Promise<string> {
    const currentTimestamp = Math.floor(Date.now() / 1000);

    // 1. 检查内存中已有的 token 是否依然有效
    if (cachedJwtToken) {
        const decoded = parseJwt(cachedJwtToken);
        if (decoded?.exp && currentTimestamp < (decoded.exp - 120)) {
            return cachedJwtToken;
        }
    }

    // 2. 检查 config.token 中保存的 token 是否依然有效
    const storedToken = config.token?.[services.microsoft];
    if (storedToken && typeof storedToken === 'string' && storedToken.startsWith('eyJ')) {
        const decoded = parseJwt(storedToken);
        if (decoded?.exp && currentTimestamp < (decoded.exp - 120)) {
            cachedJwtToken = storedToken;
            return storedToken;
        }
    }

    // 3. 并发防抖：如果已有正在进行的刷新任务，直接复用该 Promise
    if (tokenRefreshPromise) {
        return tokenRefreshPromise;
    }

    tokenRefreshPromise = (async () => {
        try {
            const resp = await fetch("https://edge.microsoft.com/translate/auth");
            if (resp.ok) {
                const token = await resp.text();
                cachedJwtToken = token;
                if (!config.token) config.token = {};
                config.token[services.microsoft] = token;
                return token;
            } else {
                const errorBody = await resp.text().catch(() => '');
                throw new Error(`获取微软翻译令牌失败 (HTTP ${resp.status} ${resp.statusText}${errorBody ? `: ${errorBody.slice(0, 100)}` : ''})`);
            }
        } catch (err: any) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(msg.startsWith('获取微软翻译令牌失败') ? msg : `微软翻译授权连接失败: ${msg}`);
        } finally {
            tokenRefreshPromise = null;
        }
    })();

    return tokenRefreshPromise;
}

async function microsoft(message: any) {
    const origin = message.origin;
    if (!origin) return '';

    let fromLang = config.from === 'auto' ? '' : config.from;

    const executeTranslate = async (token: string) => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        };

        // 仅在用户填写了自定义的 Azure 密钥（非系统自动获取的 JWT）时传递此头部
        const customKey = config.token?.[services.microsoft];
        if (customKey && typeof customKey === 'string' && !customKey.startsWith('eyJ') && customKey !== token) {
            headers['Ocp-Apim-Subscription-Key'] = customKey;
        }

        return await fetch(`https://api-edge.cognitive.microsofttranslator.com/translate?from=${fromLang}&to=${config.to}&api-version=3.0&includeSentenceLength=true&textType=html`, {
            method: 'POST',
            headers,
            body: JSON.stringify([{Text: origin}])
        });
    };

    let jwtToken = await getMicrosoftToken();
    let resp = await executeTranslate(jwtToken);

    // 若返回 401（可能是 token 被服务端提前注销），清空缓存重新拉取一次并重试
    if (resp.status === 401) {
        cachedJwtToken = null;
        jwtToken = await getMicrosoftToken();
        resp = await executeTranslate(jwtToken);
    }

    if (resp.ok) {
        const result = await resp.json();
        return result[0].translations[0].text;
    } else {
        const errorBody = await resp.text().catch(() => '');
        throw new Error(`微软翻译失败 (HTTP ${resp.status} ${resp.statusText}${errorBody ? ` body: ${errorBody.slice(0, 200)}` : ''})`);
    }
}

export default microsoft;