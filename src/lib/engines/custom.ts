import { VideoInfo } from "./yt-dlp";

/**
 * 抖音 (Douyin) 2025 稳定解析方案
 * 使用三方高可用网关进行借道解析，绕过本地 IP 封锁
 */
export async function parseDouyin(url: string): Promise<VideoInfo> {
    const errors: string[] = [];

    // --- 方案 1: 内容树 (Neirongshu) API ---
    try {
        const res = await fetch("https://www.neirongshu.com/api/parse", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://www.neirongshu.com/zh/douyin"
            },
            body: JSON.stringify({ url }),
            signal: AbortSignal.timeout(12000)
        });

        if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
                const item = json.data;
                let directUrl = item.url || item.play_url || item.video_url;

                // 尝试升级分辨率到 1080p (如果是抖音直链)
                if (directUrl && directUrl.includes("ratio=720p")) {
                    directUrl = directUrl.replace("ratio=720p", "ratio=1080p");
                }

                return {
                    id: item.id || `dy_${Date.now()}`,
                    title: item.title || "Douyin_Video",
                    url: directUrl,
                    author: item.author || "抖音用户",
                    thumbnail: item.cover,
                    duration: item.duration || 0,
                    extractor: "douyin-cloud-node-1"
                };
            }
        }
    } catch (e: any) {
        errors.push(`网关 1 (Neirongshu): ${e.message}`);
    }

    // --- 方案 2: TikWM (国际稳定网关) ---
    try {
        const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
            signal: AbortSignal.timeout(10000)
        });
        const json = await res.json();
        if (json?.data) {
            const item = json.data;
            return {
                id: item.id,
                title: item.title || "Douyin_Video",
                url: item.play, // 已经是无水印
                author: item.author?.nickname,
                duration: item.duration,
                thumbnail: item.cover,
                extractor: "douyin-cloud-node-2"
            };
        }
    } catch (e: any) {
        errors.push(`网关 2 (TikWM): ${e.message}`);
    }

    // --- 方案 3: SSR 本地模拟 (最后尝试) ---
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        };
        const res = await fetch(url, { headers, redirect: "follow" });
        const html = await res.text();
        const renderDataMatch = html.match(/<script id="RENDER_DATA" type="application\/json">([\s\S]+?)<\/script>/);
        if (renderDataMatch) {
            const rawJson = decodeURIComponent(renderDataMatch[1]);
            const data = JSON.parse(rawJson);
            const videoData = findVideoInJson(data);
            if (videoData) return videoData;
        }
    } catch (e: any) {
        errors.push(`本地模拟失败: ${e.message}`);
    }

    throw new Error(`抖音全线技术方案均失效:\n${errors.join("\n")}\n\n建议：请确认链接有效。如果所有云端网关都失败，请联系管理员或按照 README 指引添加 cookies.txt。`);
}

function findVideoInJson(obj: any): VideoInfo | null {
    if (!obj || typeof obj !== 'object') return null;
    if (obj.awemeId || obj.aweme_id) {
        const item = obj.awemeDetail || obj;
        let playUrl = (item.video?.play_addr?.url_list?.[0] || "").replace("playwm", "play");
        if (playUrl) {
            return {
                id: item.awemeId || item.aweme_id,
                title: item.desc || "Douyin_Video",
                url: playUrl,
                author: item.author?.nickname,
                duration: (item.duration || 0) / 1000,
                thumbnail: item.video?.cover?.url_list?.[0],
                extractor: "douyin-ssr-fallback"
            };
        }
    }
    for (const key in obj) {
        const found = findVideoInJson(obj[key]);
        if (found) return found;
    }
    return null;
}

/**
 * 今日头条 (Toutiao) 解析
 *
 * 链路（按头条 2025 实际行为）：
 *   Step 0: 从 URL 解析出 item_id（必要时跟随分享跳转）
 *   方案 1 (主路): 调 https://m.toutiao.com/i{item_id}/info/ 获取 play_auth_token_v2，
 *                  再调字节 VOD GetPlayInfo 拿真实 MainPlayUrl
 *   方案 2 (兜底): 解析 m.toutiao.com 页面里的 RENDER_DATA / videoResource（旧版 SSR 视频）
 */
export async function parseToutiao(url: string): Promise<VideoInfo> {
    const errors: string[] = [];

    const itemId = await resolveToutiaoItemId(url);
    if (!itemId) {
        throw new Error("无法从链接中识别头条 item_id（可能是被风控的中间跳转页）");
    }

    const mobileUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const mobileHeaders = {
        "User-Agent": mobileUA,
        "Referer": `https://m.toutiao.com/i${itemId}/`,
        "Accept-Language": "zh-CN,zh;q=0.9",
    };

    // --- 方案 1: mAPI + VOD GetPlayInfo ---
    let info: { title?: string; author?: string; thumbnail?: string; duration?: number; videoId?: string; vodToken?: string } = {};
    try {
        const res = await fetch(`https://m.toutiao.com/i${itemId}/info/`, {
            headers: mobileHeaders,
            signal: AbortSignal.timeout(10000),
        });
        const json: any = await res.json();
        const data = json?.data || {};
        info = {
            title: data.title || data.share_title,
            author: data.source || data.media_user?.screen_name || data.media_name,
            thumbnail: data.poster_url || data.image_url || data.large_image_url,
            duration: data.video_duration || 0,
            vodToken: data.play_auth_token_v2,
        };
        const tokenMatch = (data.content || "").match(/tt-videoid=['"]([^'"]+)['"]/);
        if (tokenMatch) info.videoId = tokenMatch[1];

        if (info.vodToken) {
            const playUrl = await fetchToutiaoVodPlayUrl(info.vodToken);
            if (playUrl) {
                return {
                    id: itemId,
                    title: info.title || "Toutiao_Video",
                    url: playUrl,
                    author: info.author,
                    thumbnail: info.thumbnail,
                    duration: info.duration,
                    extractor: "toutiao-vod",
                };
            }
            errors.push("方案 1 (VOD): GetPlayInfo 未返回 MainPlayUrl");
        } else {
            errors.push("方案 1 (mAPI): 接口未返回 play_auth_token_v2");
        }
    } catch (e: any) {
        errors.push(`方案 1 (mAPI/VOD): ${e.message}`);
    }

    // --- 方案 2: 移动端 SSR HTML 旧版兜底 ---
    try {
        const pageUrl = `https://m.toutiao.com/i${itemId}/`;
        const res = await fetch(pageUrl, {
            headers: { ...mobileHeaders, "User-Agent": mobileUA },
            redirect: "follow",
            signal: AbortSignal.timeout(10000),
        });
        const html = await res.text();
        const ssr = extractToutiaoFromHtml(html, itemId);
        if (ssr) {
            return {
                ...ssr,
                title: ssr.title || info.title || "Toutiao_Video",
                author: ssr.author || info.author,
                thumbnail: ssr.thumbnail || info.thumbnail,
                duration: ssr.duration || info.duration,
            };
        }
        errors.push("方案 2 (H5 SSR): 未在 HTML 中提取到视频资源");
    } catch (e: any) {
        errors.push(`方案 2 (H5 SSR): ${e.message}`);
    }

    throw new Error(`头条全线解析失败:\n${errors.join("\n")}`);
}

/**
 * 用 play_auth_token_v2 调字节 VOD 的 GetPlayInfo 接口拿真实播放地址
 * token 是 base64 包了一份预签名的 query string，直接拼到 vod.bytedanceapi.com 即可
 */
async function fetchToutiaoVodPlayUrl(token: string): Promise<string | null> {
    let qs: string;
    try {
        const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
        qs = (decoded.GetPlayInfoToken || "").replace(/\\u0026/g, "&");
    } catch {
        return null;
    }
    if (!qs) return null;

    const res = await fetch(`https://vod.bytedanceapi.com/?${qs}`, {
        headers: {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            "Referer": "https://m.toutiao.com/",
        },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const list: any[] = json?.Result?.Data?.PlayInfoList || [];
    if (!list.length) return null;
    // 选最高码率
    list.sort((a, b) => (b.Bitrate || 0) - (a.Bitrate || 0));
    return list[0].MainPlayUrl || list[0].BackupPlayUrl || null;
}

async function resolveToutiaoItemId(rawUrl: string): Promise<string | null> {
    const direct = matchToutiaoItemId(rawUrl);
    if (direct) return direct;
    try {
        const res = await fetch(rawUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            },
            redirect: "follow",
            signal: AbortSignal.timeout(8000),
        });
        const finalUrl = res.url;
        const id = matchToutiaoItemId(finalUrl);
        if (id) return id;
        // 中间页可能在 HTML 中露出 item_id
        const html = await res.text();
        const m = html.match(/(?:item_id|group_id|itemId|groupId)["':\s=]+["']?(\d{15,})/);
        return m?.[1] || null;
    } catch {
        return null;
    }
}

function matchToutiaoItemId(url: string): string | null {
    const m = url.match(/(?:toutiao\.com|toutiaoimg\.com)\/(?:video|article|group|i|a|w)\/?i?(\d{15,})/i)
        || url.match(/[?&](?:item_id|group_id)=(\d{15,})/i);
    return m?.[1] || null;
}

function extractToutiaoFromHtml(html: string, itemId: string): VideoInfo | null {
    // 1) 新版 _SSR_HYDRATED_DATA
    const ssrMatch = html.match(/window\._SSR_HYDRATED_DATA\s*=\s*(\{[\s\S]+?\})\s*<\/script>/);
    // 2) 旧版 RENDER_DATA（base64/uri 编码）
    const renderMatch = html.match(/<script id="RENDER_DATA"[^>]*>([\s\S]+?)<\/script>/);
    // 3) 内联 videoResource JSON
    const inlineMatch = html.match(/"videoResource"\s*:\s*(\{[\s\S]+?\})\s*[,}]/);

    const candidates: any[] = [];
    if (ssrMatch) {
        try { candidates.push(JSON.parse(ssrMatch[1].replace(/:undefined/g, ":null"))); } catch { /* ignore */ }
    }
    if (renderMatch) {
        try {
            const raw = decodeURIComponent(renderMatch[1]);
            candidates.push(JSON.parse(raw));
        } catch { /* ignore */ }
    }
    if (inlineMatch) {
        try { candidates.push({ videoResource: JSON.parse(inlineMatch[1]) }); } catch { /* ignore */ }
    }

    for (const data of candidates) {
        const found = findToutiaoVideo(data);
        if (found) {
            return {
                id: itemId,
                title: found.title || "Toutiao_Video",
                url: found.url,
                author: found.author,
                thumbnail: found.thumbnail,
                duration: found.duration || 0,
                extractor: "toutiao-ssr",
            };
        }
    }
    return null;
}

function findToutiaoVideo(obj: any): { url: string; title?: string; author?: string; thumbnail?: string; duration?: number } | null {
    if (!obj || typeof obj !== "object") return null;

    // videoResource 命中
    const vr = obj.videoResource || obj.video_resource;
    if (vr && typeof vr === "object") {
        const playUrl = pickToutiaoPlayUrl(vr);
        if (playUrl) {
            return {
                url: playUrl,
                title: obj.title || obj.share_title,
                author: obj.media_name || obj.user_info?.name || obj.source,
                thumbnail: obj.large_image?.url || obj.image_url || obj.middle_image?.url,
                duration: vr.normal?.video_duration || obj.video_duration,
            };
        }
    }

    for (const key of Object.keys(obj)) {
        const found = findToutiaoVideo(obj[key]);
        if (found) return found;
    }
    return null;
}

function pickToutiaoPlayUrl(node: any): string | null {
    if (!node || typeof node !== "object") return null;
    // 头条/西瓜把直链放在 main_url（base64），有时还有 backup_url
    const buckets = [
        node.normal?.video_list,
        node.dash_120fps?.video_list,
        node.dash?.video_list,
        node.h264_120fps?.video_list,
        node.video_list,
        node,
    ];
    for (const bucket of buckets) {
        if (!bucket) continue;
        const list = Array.isArray(bucket) ? bucket : Object.values(bucket);
        // 优先选最高码率
        const sorted = list
            .filter((v: any) => v && (v.main_url || v.backup_url_1 || v.url))
            .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
        for (const item of sorted as any[]) {
            const raw = item.main_url || item.backup_url_1 || item.url;
            if (!raw) continue;
            try {
                if (/^https?:\/\//i.test(raw)) return raw;
                const decoded = Buffer.from(raw, "base64").toString("utf-8");
                if (/^https?:\/\//i.test(decoded)) return decoded;
            } catch { /* ignore */ }
        }
    }
    return null;
}

/**
 * 小红书 (Xiaohongshu) 解析
 */
export async function parseXiaohongshu(url: string): Promise<VideoInfo> {
    try {
        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36' };
        const res = await fetch(url, { headers, redirect: 'follow' });
        const html = await res.text();
        const match = html.match(/window\.__INITIAL_STATE__=({.+?})<\/script>/);
        if (!match) throw new Error("未能在源码中找到 INITIAL_STATE");

        const state = JSON.parse(match[1].replace(/undefined/g, 'null'));
        if (!state.note?.noteDetailMap) throw new Error("无法读取笔记详情 map");

        const noteId = Object.keys(state.note.noteDetailMap)[0];
        const note = state.note.noteDetailMap[noteId].note;

        if (!note?.video?.media?.stream) throw new Error("该链接不包含视频视频数据");

        const stream = note.video.media.stream;
        const videoUrl = stream.h264?.[0]?.masterUrl || stream.h265?.[0]?.masterUrl;

        return {
            id: noteId,
            title: note.title || note.desc || "XHS_Video",
            url: videoUrl,
            author: note.user?.nickname,
            thumbnail: note.imageList?.[0]?.url,
            extractor: "xhs-ssr"
        };
    } catch (e: any) {
        throw new Error(`小红书解析错误: ${e.message}`);
    }
}
