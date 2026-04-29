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
    sourceUrl?: string;
    requestHeaders?: Record<string, string>;
}

export async function getYtdlpInfo(url: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
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

        // 60s 兜底 kill；router.ts 外层还有 withTimeout(30s) 包装，会先 reject Promise，
        // 但子进程会孤儿化吃 CPU，必须显式 kill。
        const killTimer = setTimeout(() => {
            console.warn(`[yt-dlp info] timeout, killing pid=${childProcess.pid}`);
            try { childProcess.kill("SIGTERM"); } catch { /* ignore */ }
            setTimeout(() => {
                try { childProcess.kill("SIGKILL"); } catch { /* ignore */ }
            }, 5000);
        }, 60_000);
        childProcess.once("close", () => clearTimeout(killTimer));
        childProcess.once("error", () => clearTimeout(killTimer));

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

                let mediaUrl = parsed.url;
                if (!mediaUrl && parsed.formats && parsed.formats.length > 0) {
                    const formats = [...parsed.formats];
                    const bestMuxedFormat = formats.reverse().find(
                        (format: any) => format.vcodec !== "none" && format.acodec !== "none" && format.url,
                    );

                    mediaUrl = bestMuxedFormat?.url || parsed.formats[parsed.formats.length - 1]?.url;
                }

                if (!mediaUrl) {
                    mediaUrl = parsed.webpage_url || url;
                }

                resolve({
                    id: parsed.id,
                    title: parsed.title,
                    url: mediaUrl,
                    thumbnail: parsed.thumbnail,
                    duration: parsed.duration,
                    author: parsed.uploader || parsed.author || parsed.creator,
                    extractor: parsed.extractor_key,
                    sourceUrl: parsed.webpage_url || parsed.original_url || url,
                    requestHeaders: parsed.http_headers,
                });
            } catch {
                reject(new Error("Failed to parse yt-dlp output"));
            }
        });
    });
}
