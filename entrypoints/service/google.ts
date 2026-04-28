import { method } from "../utils/constant";
import { config } from "@/entrypoints/utils/config";
import microsoft from "./microsoft";

/**
 * Google Translate (gtx) 是非官方接口，会触发 reCAPTCHA / 429 限流。
 * 策略：
 *  1) 单次请求成功直接返回。
 *  2) 命中限流（429 或返回 captcha HTML）：
 *     - 抛出干净的短错误（避免把整页 HTML 灌进 console / 翻译徽标）
 *     - 自动回落到微软翻译，保证用户体验不中断
 *  3) 网络错误正常向上抛。
 */

const GOOGLE_RATE_LIMITED_FLAG = '__versevibeGoogleRateLimitedUntil';

function isCaptchaBody(body: string): boolean {
    if (!body) return false;
    const lower = body.toLowerCase();
    return (
        lower.includes('recaptcha') ||
        lower.includes('g-recaptcha') ||
        lower.includes('solvesimplechallenge') ||
        lower.includes('captcha-form')
    );
}

function isCurrentlyRateLimited(): boolean {
    const until = (globalThis as any)[GOOGLE_RATE_LIMITED_FLAG] as number | undefined;
    return typeof until === 'number' && until > Date.now();
}

function markRateLimited(ms = 60 * 1000) {
    (globalThis as any)[GOOGLE_RATE_LIMITED_FLAG] = Date.now() + ms;
}

async function callGoogleOnce(origin: string): Promise<string> {
    const params: Record<string, string> = {
        client: 'gtx',
        sl: config.from,
        tl: config.to,
        dt: 't',
        strip: '0',
        nonced: '1',
        q: origin,
        format: 'html',
    };
    const queryString = Object.entries(params)
        .map(([k, v]) => k + '=' + encodeURIComponent(v))
        .join('&');

    const resp = await fetch(
        'https://translate.googleapis.com/translate_a/single?' + queryString,
        { method: method.GET },
    );

    if (resp.ok) {
        const ct = resp.headers.get('content-type') || '';
        // gtx 限流时偶尔会以 200 + HTML 返回 captcha，这里也兜底识别
        if (ct.includes('text/html')) {
            const body = await resp.text();
            if (isCaptchaBody(body)) {
                throw new GoogleRateLimitedError('Google 翻译触发人机验证');
            }
            throw new Error('Google 翻译返回非 JSON 响应');
        }
        const result = await resp.json();
        let sentence = '';
        result[0].forEach((e: any) => (sentence += e[0]));
        return sentence;
    }

    if (resp.status === 429 || resp.status === 503) {
        // 不再把整页 HTML 抛出去，避免污染日志
        throw new GoogleRateLimitedError(
            `Google 翻译被限流 (HTTP ${resp.status})`,
        );
    }

    // 其他错误：截断 body，便于排查但不至于刷屏
    const bodyText = (await resp.text().catch(() => '')).slice(0, 200);
    throw new Error(
        `Google 翻译失败: ${resp.status} ${resp.statusText}` +
            (bodyText ? ` | ${bodyText}` : ''),
    );
}

class GoogleRateLimitedError extends Error {
    readonly isRateLimited = true as const;
    constructor(message: string) {
        super(message);
        this.name = 'GoogleRateLimitedError';
    }
}

async function google(message: any): Promise<string> {
    const origin = typeof message.origin === 'string' ? message.origin : '';
    if (!origin) return '';

    // 已知正在限流的窗口期内：直接走微软兜底，避免无谓的 429 噪音
    if (isCurrentlyRateLimited()) {
        try {
            return await microsoft(message);
        } catch (err) {
            // 微软也失败了，让上层看到真实错误
            throw err;
        }
    }

    try {
        return await callGoogleOnce(origin);
    } catch (err) {
        if (err instanceof GoogleRateLimitedError) {
            // 进入冷却窗口，1 分钟内的后续请求直接走微软
            markRateLimited(60 * 1000);
            console.warn(
                '[VerseVibe] Google 翻译被限流，自动回落到微软翻译（冷却 60s）。',
            );
            try {
                return await microsoft(message);
            } catch (fallbackErr) {
                throw fallbackErr;
            }
        }
        throw err;
    }
}

export default google;
