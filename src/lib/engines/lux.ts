import { spawn } from "child_process";
import { VideoInfo } from "./yt-dlp";

export async function getLuxInfo(url: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
        // lux -i -j prints the video info as JSON
        const process = spawn("lux", ["-i", "-j", url]);

        let stdoutData = "";
        let stderrData = "";

        process.stdout.on("data", (data) => {
            stdoutData += data.toString();
        });

        process.stderr.on("data", (data) => {
            stderrData += data.toString();
        });

        process.on("close", (code) => {
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
                reject(new Error("Failed to parse lux output"));
            }
        });
    });
}
