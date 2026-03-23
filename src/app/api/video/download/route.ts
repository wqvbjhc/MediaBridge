import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

function isDirectMediaUrl(url: string) {
    return (
        url.includes("snssdk.com") ||
        url.includes("douyinvod.com") ||
        url.includes("toutiaovod.com") ||
        url.includes("toutiaoimg.com") ||
        url.includes("byteimg.com") ||
        url.includes("sns-video") ||
        url.includes("tikwm.com") ||
        url.includes("social-downloader.com") ||
        url.includes("tenet.ink") ||
        url.includes("mime_type=video_mp4") ||
        url.includes("mime_type=audio_") ||
        url.includes(".mp4") ||
        url.includes(".m4a")
    );
}

function buildForwardHeaders(url: string, requestHeaders?: Record<string, string>, sourceUrl?: string) {
    const curlHeaders = [
        "-H", "Accept: */*",
        "-H", "Range: bytes=0-",
    ];

    const forwardedHeaders = new Map<string, string>();
    if (requestHeaders) {
        for (const [key, value] of Object.entries(requestHeaders)) {
            if (!value) continue;
            const normalized = key.toLowerCase();
            if (["user-agent", "accept", "accept-language", "referer", "origin", "cookie"].includes(normalized)) {
                forwardedHeaders.set(normalized, value);
            }
        }
    }

    if (!forwardedHeaders.has("user-agent")) {
        forwardedHeaders.set(
            "user-agent",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        );
    }

    if (!forwardedHeaders.has("referer")) {
        if (sourceUrl) {
            forwardedHeaders.set("referer", sourceUrl);
        } else if (url.includes("toutiaovod.com") || url.includes("toutiaoimg.com")) {
            forwardedHeaders.set("referer", "https://www.toutiao.com/");
        }
    }

    for (const [key, value] of forwardedHeaders.entries()) {
        curlHeaders.push("-H", `${key}: ${value}`);
    }

    return curlHeaders;
}

export async function POST(req: NextRequest) {
    try {
        const { url, title, duration, author, requestHeaders, sourceUrl } = await req.json();
        if (!url) {
            return NextResponse.json({ error: "请提供视频链接" }, { status: 400 });
        }

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

        console.log("[Download] Processing URL:", url);

        if (isDirectMediaUrl(url)) {
            console.log("[Download] Using curl proxy for direct media URL:", url);

            const curlArgs = [
                "-L",
                ...buildForwardHeaders(url, requestHeaders, sourceUrl),
                url,
            ];

            const curlProcess = spawn("curl.exe", curlArgs);

            const proxyStream = new ReadableStream({
                start(controller) {
                    curlProcess.stdout.on("data", (chunk) => controller.enqueue(chunk));
                    curlProcess.stderr.on("data", () => {
                        // curl progress is written to stderr; keep it out of the response stream.
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
            url,
        ];

        if (hasCookies) args.push("--cookies", cookiesPath);

        const child = spawn("yt-dlp", args);

        const stream = new ReadableStream({
            start(controller) {
                child.stdout.on("data", (chunk) => controller.enqueue(chunk));
                child.stderr.on("data", (data) => {
                    const message = data.toString();
                    if (message.includes("ERROR")) console.error("[yt-dlp error]", message);
                });
                child.on("close", (code) => {
                    if (code !== 0) controller.error(`yt-dlp closed with ${code}`);
                    else controller.close();
                });
                child.on("error", (err) => controller.error(err));
            },
            cancel() {
                child.kill();
            }
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
