import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export interface VideoInfo {
    id: string;
    title: string;
    url: string;
    thumbnail?: string;
    duration?: number;
    author?: string;
    extractor: string;
}

export async function getYtdlpInfo(url: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
        // 检查是否存在 cookies 文件
        const cookiesPath = path.join(process.cwd(), "cookies", "cookies.txt");
        const hasCookies = fs.existsSync(cookiesPath);

        const args = [
            "--dump-json",
            "--no-warnings",
            "--no-playlist",
            "--extractor-args", "youtube:player_client=mediaconnect",
        ];

        if (hasCookies) {
            args.push("--cookies", cookiesPath);
        }

        args.push(url);

        const childProcess = spawn("yt-dlp", args);

        let stdoutData = "";
        let stderrData = "";

        childProcess.stdout.on("data", (data) => {
            stdoutData += data.toString();
        });

        childProcess.stderr.on("data", (data) => {
            stderrData += data.toString();
        });

        childProcess.on("close", (code) => {
            if (code !== 0) {
                reject(new Error(`yt-dlp exited with code ${code}\n${stderrData}`));
                return;
            }
            try {
                const parsed = JSON.parse(stdoutData);

                // yt-dlp returns the direct media url in 'url' (or in formats array).
                // 'webpage_url' is just the HTML page. We need the actual video stream URL.

                // If the root has a 'url', it's usually the best pre-merged format or direct link.
                // Otherwise, try to find a format that has both video and audio, or fallback to the first url.
                let mediaUrl = parsed.url;
                if (!mediaUrl && parsed.formats && parsed.formats.length > 0) {
                    // Try to find the best format with both video and audio
                    const bestFormat = parsed.formats.reverse().find((f: any) => f.vcodec !== 'none' && f.acodec !== 'none' && f.url);

                    // If none has both, fallback to best video-only or just the first format
                    mediaUrl = bestFormat?.url || parsed.formats[parsed.formats.length - 1]?.url;
                }

                if (!mediaUrl) mediaUrl = parsed.webpage_url || url;

                resolve({
                    id: parsed.id,
                    title: parsed.title,
                    url: mediaUrl,
                    thumbnail: parsed.thumbnail,
                    duration: parsed.duration,
                    author: parsed.uploader || parsed.author || parsed.creator,
                    extractor: parsed.extractor_key,
                });
            } catch (e) {
                reject(new Error("Failed to parse yt-dlp output"));
            }
        });
    });
}
