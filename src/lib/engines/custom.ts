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
