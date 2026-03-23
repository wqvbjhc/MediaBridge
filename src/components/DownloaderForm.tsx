"use client";

import { useState } from "react";
import { Copy, Loader2, Download, Scissors, Check, AlertTriangle, ExternalLink } from "lucide-react";

export function DownloaderForm() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [videoInfo, setVideoInfo] = useState<any>(null);
    const [copied, setCopied] = useState(false);

    const handleParse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;

        setLoading(true);
        setError(null);
        setVideoInfo(null);
        setDownloadProgress("");

        try {
            const res = await fetch("/api/video/info", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || "解析器返回错误");
            }

            setVideoInfo(data.data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!videoInfo) return;
        setDownloading(true);
        setDownloadProgress("正在准备下载流...");

        try {
            // 我们通过 POST 发送 URL 和标题，以便后端设置正确的文件名
            const res = await fetch("/api/video/download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: videoInfo.url, // 使用解析出的直链
                    title: videoInfo.title,
                    duration: videoInfo.duration,
                    author: videoInfo.author,
                    requestHeaders: videoInfo.requestHeaders,
                    sourceUrl: videoInfo.sourceUrl
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({ error: "无法连接到下载服务器" }));
                throw new Error(errData.error || "下载失败");
            }

            setDownloadProgress("正在从服务器转发流 (请查看浏览器下载栏)...");

            // 处理流式响应
            const reader = res.body?.getReader();
            if (!reader) throw new Error("无法读取服务器响应流");

            // 虽然我们是在转发流，但浏览器无法通过 fetch 直接弹出保存对话框并展示进度
            // 这里的 hack 是将流转为 Blob，或者是直接使用浏览器的下载功能

            // 注意：如果文件很大，Blob 可能会爆内存。
            // 但对于 200MB 以内的视频通常没问题。
            const chunks: Uint8Array[] = [];
            let receivedLength = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                receivedLength += value.length;
                // 更新 UI 上的进度提示 (MB)
                setDownloadProgress(`已接收: ${(receivedLength / 1024 / 1024).toFixed(1)} MB`);
            }

            const blob = new Blob(chunks as any, { type: "video/mp4" });
            const blobUrl = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = blobUrl;

            // 构造详细文件名
            const authorPart = videoInfo.author ? `[${videoInfo.author}]` : "";
            const titlePart = videoInfo.title || "video";
            let timePart = "";
            if (videoInfo.duration) {
                const mins = Math.floor(videoInfo.duration / 60);
                const secs = Math.floor(videoInfo.duration % 60);
                timePart = `(${mins}m${secs}s)`;
            }
            // 移除所有非法字符，并将空格替换为下划线
            const fullFilename = `${authorPart}${titlePart}${timePart}`
                .replace(/[\\/:"*?<>|]/g, "_")
                .replace(/\s+/g, "_");

            a.download = `${fullFilename}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            setDownloadProgress("下载完成！");
            setTimeout(() => setDownloadProgress(""), 3000);
        } catch (err: any) {
            setError(`下载失败: ${err.message}`);
            setDownloadProgress("");
        } finally {
            setDownloading(false);
        }
    };

    const handleCopy = async () => {
        if (!videoInfo?.url) return;
        await navigator.clipboard.writeText(videoInfo.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="w-full max-w-3xl mx-auto space-y-8">
            {/* Input Form Area */}
            <form onSubmit={handleParse} className="flex flex-col sm:flex-row gap-4">
                <input
                    type="url"
                    required
                    placeholder="粘贴视频链接（抖音、B站、YouTube…）"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1 px-4 py-4 text-lg bg-white border-4 border-black text-black focus:outline-none focus:ring-0 placeholder:text-gray-400 font-bold tracking-tight shadow-[4px_4px_0px_0px_#000]"
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="brutalist-button bg-[#8b5cf6] text-white font-black text-xl px-10 py-4 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <Loader2 className="animate-spin w-6 h-6" />
                            解析中...
                        </>
                    ) : (
                        "解析"
                    )}
                </button>
            </form>

            {/* Error Message */}
            {error && (
                <div className="bg-red-100 text-red-800 font-bold p-6 border-4 border-black shadow-[4px_4px_0px_0px_#000] flex flex-col gap-2">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
                        <div className="whitespace-pre-line text-sm">{error}</div>
                    </div>
                    {error.includes("cookies.txt") && (
                        <div className="mt-4 p-3 bg-red-200 border-2 border-black text-xs leading-relaxed">
                            <p className="font-black mb-1 underline">如何添加 Cookies？</p>
                            1. 浏览器安装 GitHub 上的 "Get cookies.txt LOCALLY" 插件。<br />
                            2. 登录平台，导出为 cookies.txt。<br />
                            3. 将文件放到项目的 <code className="bg-white px-1">cookies/</code> 目录下即可。
                        </div>
                    )}
                </div>
            )}

            {/* Progress Message */}
            {downloadProgress && (
                <div className="bg-yellow-100 text-black font-black p-4 border-4 border-black shadow-[4px_4px_0px_0px_#000] flex items-center gap-3 animate-pulse">
                    <Download className="w-5 h-5 animate-bounce" />
                    {downloadProgress}
                </div>
            )}

            {/* Result Display */}
            {videoInfo && !loading && (
                <div className="brutalist-container bg-white p-6 flex flex-col md:flex-row gap-6">
                    {videoInfo.thumbnail ? (
                        <div className="relative w-full md:w-64 group">
                            <img
                                src={`/api/video/proxy?url=${encodeURIComponent(videoInfo.thumbnail)}`}
                                alt="Video Thumbnail"
                                className="w-full h-auto aspect-video object-cover border-4 border-black shadow-[4px_4px_0px_0px_#000]"
                            />
                            <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-black px-2 py-1 border-2 border-black uppercase">
                                HD Preview
                            </div>
                        </div>
                    ) : (
                        <div className="w-full md:w-64 h-40 bg-gray-200 border-4 border-black flex items-center justify-center font-bold text-gray-400">
                            No Preview
                        </div>
                    )}

                    <div className="flex-1 flex flex-col justify-between space-y-4">
                        <div>
                            <h2 className="text-2xl font-black mb-2 line-clamp-2 text-black leading-tight uppercase">
                                {videoInfo.title || "Untitled Video"}
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                <span className="bg-[#fde047] text-black text-[10px] font-black px-3 py-1 border-2 border-black uppercase tracking-wider">
                                    {videoInfo.extractor}
                                </span>
                                <span className="bg-green-400 text-black text-[10px] font-black px-3 py-1 border-2 border-black uppercase">
                                    1080p/4K Ultra HD
                                </span>
                                {videoInfo.duration > 0 && (
                                    <span className="bg-black text-white text-xs font-black px-3 py-1 border-2 border-black uppercase">
                                        {Math.floor(videoInfo.duration / 60)}:
                                        {String(Math.floor(videoInfo.duration % 60)).padStart(2, "0")}
                                    </span>
                                )}
                                {videoInfo.author && (
                                    <span className="bg-[#60a5fa] text-black text-xs font-black px-3 py-1 border-2 border-black uppercase tracking-wider">
                                        @{videoInfo.author}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={handleDownload}
                                disabled={downloading}
                                className="brutalist-button flex-1 bg-black text-white px-6 py-4 font-black uppercase tracking-widest text-center flex items-center justify-center gap-2 disabled:opacity-60 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]"
                            >
                                {downloading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" /> 下载中...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-5 h-5" /> 下载 MP4
                                    </>
                                )}
                            </button>

                            <button
                                className="brutalist-button bg-white text-black px-6 py-4 font-black uppercase tracking-widest flex items-center justify-center gap-2 border-4 border-black shadow-[4px_4px_0px_0px_#000]"
                                onClick={handleCopy}
                            >
                                {copied ? (
                                    <Check className="w-5 h-5 text-green-600" />
                                ) : (
                                    <Copy className="w-5 h-5" />
                                )}
                                链接
                            </button>
                        </div>

                        <a
                            href={videoInfo.url}
                            target="_blank"
                            className="text-[10px] flex items-center gap-1 font-bold text-gray-400 hover:text-black uppercase"
                        >
                            <ExternalLink className="w-3 h-3" /> 查看原始流地址 (可能带防盗链)
                        </a>
                    </div>
                </div>
            )}

            {/* Editor CTA */}
            {videoInfo && !loading && (
                <div className="mt-8 text-center bg-yellow-300 p-8 border-4 border-black shadow-[8px_8px_0px_0px_#000]">
                    <h3 className="text-2xl font-black uppercase mb-2">需要调整大小或裁剪？</h3>
                    <p className="text-black font-bold mb-6 tracking-wide">
                        无需下载！直接在浏览器中使用 WASM 驱动的 FFmpeg 进行剪辑。
                    </p>
                    <a
                        href="/editor"
                        className="brutalist-button inline-flex bg-black text-white px-10 py-5 font-black uppercase text-xl shadow-[4px_4px_0px_0px_#fff] items-center justify-center gap-3 group"
                    >
                        <Scissors className="w-7 h-7 group-hover:-rotate-45 transition-transform" />{" "}
                        立即剪辑
                    </a>
                </div>
            )}
        </div>
    );
}
