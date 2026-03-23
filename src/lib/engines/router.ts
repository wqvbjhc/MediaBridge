import { VideoInfo, getYtdlpInfo } from "./yt-dlp";
import { parseDouyin, parseXiaohongshu } from "./custom";

// 超时包装器：限制每个解析器的最大执行时间
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`[${label}] Timed out after ${ms}ms`));
        }, ms);
        promise
            .then((val) => { clearTimeout(timer); resolve(val); })
            .catch((err) => { clearTimeout(timer); reject(err); });
    });
}

export async function parseVideoUrl(url: string): Promise<VideoInfo> {
    const isDouyin = url.includes("douyin.com") || url.includes("iesdouyin.com");
    const isXiaohongshu = url.includes("xiaohongshu.com") || url.includes("xhslink.com");
    const isTiktok = url.includes("tiktok.com");

    // Fallback 策略执行器（串行尝试，每个都有超时保护）
    const runWithFallback = async (parsers: { label: string; fn: () => Promise<VideoInfo>; timeoutMs: number }[]) => {
        const errors: string[] = [];
        for (const { label, fn, timeoutMs } of parsers) {
            try {
                return await withTimeout(fn(), timeoutMs, label);
            } catch (e: any) {
                const msg = e.message || "Unknown error";
                console.warn(`[Fallback] ${label} failed: ${msg}`);
                errors.push(`${label}: ${msg}`);
            }
        }
        throw new Error(`所有解析引擎均失败:\n${errors.join("\n")}`);
    };

    // 针对平台组织解析管线（只用已安装的引擎，不调 lux）
    if (isDouyin) {
        return runWithFallback([
            { label: "抖音智能解析", fn: () => parseDouyin(url), timeoutMs: 40000 },
        ]);
    }

    if (isTiktok) {
        return runWithFallback([
            { label: "yt-dlp", fn: () => getYtdlpInfo(url), timeoutMs: 30000 },
        ]);
    }

    if (isXiaohongshu) {
        return runWithFallback([
            { label: "小红书专用解析", fn: () => parseXiaohongshu(url), timeoutMs: 8000 },
            { label: "yt-dlp", fn: () => getYtdlpInfo(url), timeoutMs: 30000 },
        ]);
    }

    // 通用站点（YouTube, Bilibili, Twitter, etc.）
    return runWithFallback([
        { label: "yt-dlp", fn: () => getYtdlpInfo(url), timeoutMs: 30000 },
    ]);
}
