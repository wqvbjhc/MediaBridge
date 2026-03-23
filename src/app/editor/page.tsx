"use client";

import { useState, useRef, useEffect } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { Loader2, Video, Scissors, Download, Upload } from "lucide-react";

export default function EditorPage() {
    const [loaded, setLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState("Load ffmpeg-core.js");

    const ffmpegRef = useRef<FFmpeg | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const messageRef = useRef<HTMLParagraphElement>(null);

    useEffect(() => {
        ffmpegRef.current = new FFmpeg();
    }, []);

    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoUrl, setVideoUrl] = useState<string>("");
    const [isProcessing, setIsProcessing] = useState(false);

    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(10); // Default clip length
    const [duration, setDuration] = useState(0);

    const load = async () => {
        setIsLoading(true);
        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
        const ffmpeg = ffmpegRef.current;
        if (!ffmpeg) return;

        ffmpeg.on("log", ({ message }) => {
            setMessage(message);
        });

        // To solve COEP issues on some setups, it's safer to load via BLOB URL
        try {
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
            });
            setLoaded(true);
            setMessage("Engine Ready");
        } catch (e: any) {
            setMessage(`Failed to load: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setVideoFile(file);
            setVideoUrl(URL.createObjectURL(file));
            setStartTime(0);
            setMessage("Video Loaded");
        }
    };

    const handleVideoLoaded = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
            setEndTime(videoRef.current.duration); // Select whole video by default
        }
    };

    const trimVideo = async () => {
        if (!videoFile || !loaded) return;
        setIsProcessing(true);
        setMessage("Processing Video...");
        const ffmpeg = ffmpegRef.current;
        if (!ffmpeg) return;

        try {
            await ffmpeg.writeFile("input.mp4", await fetchFile(videoFile));

            const durationStr = (endTime - startTime).toFixed(2);

            // -ss start_time, -t duration, -c copy (stream copy if possible, else re-encode)
            // For precise local browser trimming we usually re-encode to ensure accuracy without keyframe jumping
            await ffmpeg.exec([
                "-i", "input.mp4",
                "-ss", startTime.toString(),
                "-t", durationStr,
                "-c:v", "libx264",
                "-c:a", "aac",
                "-preset", "ultrafast",
                "output.mp4"
            ]);

            const data = await ffmpeg.readFile("output.mp4");

            // Free some memory
            ffmpeg.deleteFile("input.mp4");
            ffmpeg.deleteFile("output.mp4");

            // @ts-ignore: ffmpeg output types mismatch with DOM Blob due to SharedArrayBuffer
            const blob = new Blob([data as any], { type: "video/mp4" });
            const url = URL.createObjectURL(blob);

            // Create download trigger
            const a = document.createElement("a");
            a.href = url;
            a.download = "trimmed_video.mp4";
            a.click();
            URL.revokeObjectURL(url);

            setMessage("Video Trimmed & Downloaded Successfully");
        } catch (e: any) {
            setMessage(`Trimming Failed: ${e.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <main className="min-h-screen py-20 px-4 md:px-8">
            <div className="max-w-4xl mx-auto flex flex-col items-center justify-center space-y-12">
                <header className="text-center space-y-4">
                    <h1 className="text-4xl md:text-6xl font-black uppercase text-black dark:text-white tracking-widest px-8 py-4 border-b-8 border-black dark:border-white inline-block shadow-[6px_6px_0px_0px_rgba(255,100,100,1)] bg-white dark:bg-black">
                        Neo<span className="text-primary">-</span>Editor
                    </h1>
                    <p className="mt-8 text-xl font-bold bg-black text-white px-4 py-2 uppercase tracking-widest inline-block shadow-[4px_4px_0px_0px_rgba(139,92,246,1)]">
                        In-Browser Secure Video Trimming
                    </p>
                </header>

                <section className="w-full brutalist-container bg-white dark:bg-card p-8 flex flex-col gap-8">
                    {/* Status Bar */}
                    <div className="flex items-center justify-between border-4 border-black dark:border-white p-4 bg-muted">
                        <p ref={messageRef} className="font-bold text-muted-foreground uppercase truncate flex-1">
                            {message}
                        </p>
                        {!loaded && (
                            <button
                                onClick={load}
                                className="brutalist-button bg-primary text-white font-bold px-6 py-2 ml-4 flex items-center shrink-0 uppercase"
                                disabled={isLoading}
                            >
                                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Init Engine
                            </button>
                        )}
                    </div>

                    {/* Engine is ready */}
                    {loaded && (
                        <div className="flex flex-col gap-6">
                            {!videoFile ? (
                                // File upload area
                                <div className="border-4 border-dashed border-black dark:border-white p-12 text-center relative cursor-pointer hover:bg-muted transition-colors">
                                    <input
                                        type="file"
                                        accept="video/*"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                    <Upload className="w-16 h-16 mx-auto mb-4" strokeWidth={1.5} />
                                    <p className="font-black text-2xl uppercase">Select a video to edit</p>
                                    <p className="font-bold text-gray-500 mt-2 uppercase text-sm">Or drag and drop a local file (All processing is strictly offline)</p>
                                </div>
                            ) : (
                                // Video editor area
                                <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
                                    <div className="border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-black overflow-hidden relative">
                                        <video
                                            ref={videoRef}
                                            src={videoUrl}
                                            controls
                                            className="w-full max-h-[50vh] object-contain block mx-auto"
                                            onLoadedMetadata={handleVideoLoaded}
                                        />
                                    </div>

                                    {/* Timeline Controls */}
                                    <div className="border-4 border-black dark:border-white p-6 bg-secondary space-y-4">
                                        <h3 className="font-black text-xl uppercase tracking-widest text-black">Timeline Control</h3>
                                        <div className="flex flex-col gap-4">
                                            <label className="font-bold flex justify-between">
                                                <span className="text-black uppercase">Start Time (sec):</span>
                                                <span className="bg-white border-2 border-black px-2">{startTime.toFixed(1)}</span>
                                            </label>
                                            <input
                                                type="range"
                                                min={0}
                                                max={duration}
                                                step={0.1}
                                                value={startTime}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    if (val < endTime) setStartTime(val);
                                                }}
                                                className="w-full cursor-pointer accent-black"
                                            />

                                            <label className="font-bold flex justify-between mt-2">
                                                <span className="text-black uppercase">End Time (sec):</span>
                                                <span className="bg-white border-2 border-black px-2">{endTime.toFixed(1)}</span>
                                            </label>
                                            <input
                                                type="range"
                                                min={0}
                                                max={duration}
                                                step={0.1}
                                                value={endTime}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    if (val > startTime) setEndTime(val);
                                                }}
                                                className="w-full cursor-pointer accent-black"
                                            />
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setVideoFile(null)}
                                            className="brutalist-button bg-white text-black font-black flex-1 py-4 uppercase border-4 border-black"
                                            disabled={isProcessing}
                                        >
                                            Choose Another
                                        </button>
                                        <button
                                            onClick={trimVideo}
                                            className="brutalist-button bg-primary text-white font-black flex-[2] py-4 uppercase text-lg flex items-center justify-center gap-2"
                                            disabled={isProcessing}
                                        >
                                            {isProcessing ? (
                                                <><Loader2 className="w-6 h-6 animate-spin" /> Rendering... ({message})</>
                                            ) : (
                                                <><Scissors /> Export Clip</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
