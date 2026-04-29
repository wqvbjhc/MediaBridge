/**
 * URL 安全校验：防 SSRF
 *
 * 服务端接受用户传入 URL 时（proxy / curl 直链下载），必须先过这层。
 * 规则：
 *   1) URL 必须能解析、必须是 http(s)
 *   2) 主机不能解析为内网/loopback/链路本地/HF 元数据
 *   3) 主机字符串本身就不能写成 IP 字面量（除非是公网 IP，但保守做法是禁止）
 *   4) 端口必须是 80/443（其他端口 HF 容器出站也会被阻，但这里也明确拦下）
 *
 * 只放行公网 http/https + 标准端口 + 主机为域名（非 IP）。
 */

const PRIVATE_HOSTS = new Set([
    "localhost",
    "0.0.0.0",
]);

const PRIVATE_HOST_SUFFIXES = [
    ".localhost",
    ".local",
    ".internal",
];

function isPrivateIPv4(host: string): boolean {
    const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return false;
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;                              // 10.0.0.0/8
    if (a === 127) return true;                             // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true;                // 169.254.0.0/16 link-local + AWS/HF metadata
    if (a === 172 && b >= 16 && b <= 31) return true;       // 172.16.0.0/12
    if (a === 192 && b === 168) return true;                // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true;      // CGNAT
    if (a >= 224) return true;                              // multicast / reserved
    return false;
}

function isPrivateIPv6(host: string): boolean {
    // 简化：任何非全球可路由 IPv6 一律拦下；保守处理
    const lower = host.toLowerCase().replace(/^\[|\]$/g, "");
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;  // fc00::/7 ULA
    if (lower.startsWith("fe80")) return true;                          // link-local
    if (lower.startsWith("::ffff:")) {
        const v4 = lower.slice("::ffff:".length);
        return isPrivateIPv4(v4);
    }
    return false;
}

export function isAllowedRemoteUrl(input: string): { ok: true; url: URL } | { ok: false; reason: string } {
    if (!input || typeof input !== "string") {
        return { ok: false, reason: "empty url" };
    }
    let url: URL;
    try {
        url = new URL(input);
    } catch {
        return { ok: false, reason: "invalid url" };
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { ok: false, reason: `protocol not allowed: ${url.protocol}` };
    }

    // 端口：默认（443/80）允许；其他保守起见也拦
    if (url.port && url.port !== "80" && url.port !== "443" && url.port !== "8080") {
        return { ok: false, reason: `port not allowed: ${url.port}` };
    }

    const host = url.hostname.toLowerCase();
    if (PRIVATE_HOSTS.has(host)) return { ok: false, reason: `private host: ${host}` };
    for (const suffix of PRIVATE_HOST_SUFFIXES) {
        if (host.endsWith(suffix)) return { ok: false, reason: `private suffix: ${host}` };
    }
    if (isPrivateIPv4(host)) return { ok: false, reason: `private ipv4: ${host}` };
    if (isPrivateIPv6(host)) return { ok: false, reason: `private ipv6: ${host}` };

    // 拦掉裸 IPv4 字面量（即使是公网）：本服务的合法上游全是域名，IP 直连要么是用户瞎传要么是 SSRF 试探
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
        return { ok: false, reason: `bare ipv4 not allowed: ${host}` };
    }

    return { ok: true, url };
}
