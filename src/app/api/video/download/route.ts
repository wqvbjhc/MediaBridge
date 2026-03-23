import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export async function POST(req: NextRequest) {
    try {
        const { url, title, duration, author } = await req.json();
        if (!url) {
            return NextResponse.json({ error: "请提供视频链接" }, { status: 400 });
        }

        // 构造文件名: [作者]标题(时长).mp4
        const authorPart = author ? `[${author}]` : "";
        const titlePart = title || "video";
        let timePart = "";
        if (duration) {
            const mins = Math.floor(duration / 60);
            const secs = Math.floor(duration % 60);
            timePart = `(${mins}m${secs}s)`;
        }
        const fullFilename = `${authorPart}${titlePart}${timePart}`
            .replace(/[\\/:"*?<>|]/g, "_")
            .replace(/\s+/g, "_");
        const filename = `${fullFilename}.mp4`;

        // --- 核心逻辑：智能分流 ---
        console.log("[Download] Processing URL:", url);
        // 如果链接包含 aweme.snssdk.com (抖音直链) 或 sns-video-bd (小红书直链) 或已经是 mp4 文件
        // 我们直接进行流转发，由于这些地址已经被“借道”解析好了，不需要再经过 yt-dlp
        const isDirectLink =
            url.includes("snssdk.com") ||
            url.includes("douyinvod.com") ||
            url.includes("sns-video") ||
            url.includes("tikwm.com") ||
            url.includes("social-downloader.com") ||
            url.includes("tenet.ink") ||
            url.includes(".mp4") ||
            url.includes(".m4a");

        if (isDirectLink) {
            console.log("[Download] Using Curl Proxy for:", url);

            // 使用 curl.exe 转发流，它比 JS fetch 往往更稳定，且能绕过一些解析限制
            const curlArgs = [
                "-L", // 跟随重定向
                "-A", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
                "-H", "Accept: */*",
                "-H", "Range: bytes=0-",
                url
            ];

            const curlProcess = spawn("curl.exe", curlArgs);

            const proxyStream = new ReadableStream({
                start(controller) {
                    curlProcess.stdout.on("data", (chunk) => controller.enqueue(chunk));
                    curlProcess.stderr.on("data", (data) => {
                        // curl 的进度信息在 stderr
                        // console.log("[curl log]", data.toString());
                    });
                    curlProcess.on("close", (code) => {
                        if (code !== 0) controller.error(`curl exited with ${code}`);
                        else controller.close();
                    });
                    curlProcess.on("error", (err) => controller.error(err));
                },
                cancel() {
                    curlProcess.kill();
                }
            });

            return new NextResponse(proxyStream, {
                status: 200,
                headers: {
                    "Content-Type": "video/mp4",
                    "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
                    "Transfer-Encoding": "chunked",
                },
            });
        }

        // --- 否则：继续使用 yt-dlp (针对 YouTube 等需要合并音视频的平台) ---
        console.log("[Download] Using yt-dlp for:", url);
        const cookiesDir = path.join(process.cwd(), "cookies");
        if (!fs.existsSync(cookiesDir)) fs.mkdirSync(cookiesDir, { recursive: true });
        const cookiesPath = path.join(cookiesDir, "cookies.txt");
        const hasCookies = fs.existsSync(cookiesPath);

        const args = [
            "-f", "bestvideo+bestaudio/best",
            "--merge-output-format", "mp4",
            "--no-playlist",
            "--no-warnings",
            "--extractor-args", "youtube:player_client=mediaconnect",
            "-o", "-",
            url
        ];

        if (hasCookies) args.push("--cookies", cookiesPath);

        const child = spawn("yt-dlp", args);

        const stream = new ReadableStream({
            start(controller) {
                child.stdout.on("data", (chunk) => controller.enqueue(chunk));
                child.stderr.on("data", (data) => {
                    const msg = data.toString();
                    if (msg.includes("ERROR")) console.error("[yt-dlp error]", msg);
                });
                child.on("close", (code) => {
                    if (code !== 0) controller.error(`yt-dlp closed with ${code}`);
                    else controller.close();
                });
                child.on("error", (err) => controller.error(err));
            },
            cancel() { child.kill(); }
        });

        return new NextResponse(stream, {
            status: 200,
            headers: {
                "Content-Type": "video/mp4",
                "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
                "Transfer-Encoding": "chunked",
            },
        });

    } catch (error: any) {
        console.error("Download Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export const maxDuration = 600;
