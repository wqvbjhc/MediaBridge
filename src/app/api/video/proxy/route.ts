import { NextRequest, NextResponse } from "next/server";
import { isAllowedRemoteUrl } from "@/lib/url-guard";

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get("url");
    if (!url) return new NextResponse("Missing URL", { status: 400 });

    const guard = isAllowedRemoteUrl(url);
    if (!guard.ok) {
        return new NextResponse(`URL rejected: ${guard.reason}`, { status: 400 });
    }

    try {
        const res = await fetch(guard.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                'Referer': url.includes("douyin") ? 'https://www.douyin.com/' : 'https://www.xiaohongshu.com/',
            }
        });

        if (!res.ok) throw new Error(`Proxy fetch failed: ${res.status}`);

        // 转发原始响应头，特别是 Content-Type
        return new NextResponse(res.body, {
            headers: {
                "Content-Type": res.headers.get("Content-Type") || "application/octet-stream",
                "Cache-Control": "public, max-age=3600",
            }
        });
    } catch (e: any) {
        return new NextResponse(e.message, { status: 500 });
    }
}
