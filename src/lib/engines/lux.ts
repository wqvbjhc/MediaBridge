import { spawn } from "child_process";
import { VideoInfo } from "./yt-dlp";

export async function getLuxInfo(url: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
        // lux -i -j prints the video info as JSON
        const child = spawn("lux", ["-i", "-j", url]);

        // 60s 兜底 kill，避免 lux 卡住时孤儿进程吃 CPU
        const killTimer = setTimeout(() => {
            console.warn(`[lux] timeout, killing pid=${child.pid}`);
            try { child.kill("SIGTERM"); } catch { /* ignore */ }
            setTimeout(() => {
                try { child.kill("SIGKILL"); } catch { /* ignore */ }
            }, 5000);
        }, 60_000);
        child.once("close", () => clearTimeout(killTimer));
        child.once("error", () => clearTimeout(killTimer));

        let stdoutData = "";
        let stderrData = "";

        child.stdout.on("data", (data) => {
            stdoutData += data.toString();
        });

        child.stderr.on("data", (data) => {
            stderrData += data.toString();
        });

        child.on("close", (code) => {
            if (code !== 0) {
                reject(new Error(`lux exited with code ${code}\n${stderrData}`));
                return;
            }
            try {
                const parsedList = JSON.parse(stdoutData);
                if (!parsedList || parsedList.length === 0) {
                    reject(new Error("No video info found by Lux"));
                    return;
                }

                const parsed = parsedList[0];

                resolve({
                    id: parsed.url, // Lux might use URL as ID
                    title: parsed.title,
                    url: parsed.url,
                    extractor: "lux",
                    duration: 0 // Lux typically doesn't directly expose duration in root, but you can adapt this
                });
            } catch (e) {
                console.error("[lux] parse failed:", e);
                reject(new Error("Failed to parse lux output"));
            }
        });
    });
}
