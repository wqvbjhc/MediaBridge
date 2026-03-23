import { NextResponse } from "next/server";
import { parseVideoUrl } from "@/lib/engines/router";

export async function POST(req: Request) {
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json(
                { success: false, error: "请提供视频链接" },
                { status: 400 }
            );
        }

        const info = await parseVideoUrl(url);

        return NextResponse.json({
            success: true,
            data: info,
        });
    } catch (error: any) {
        console.error("Video Parsing Error:", error.message);
        return NextResponse.json(
            {
                success: false,
                error: error.message || "解析失败，请检查链接是否正确",
            },
            { status: 200 } // 返回 200 让前端能正常读取 JSON
        );
    }
}
