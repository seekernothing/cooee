import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * This endpoint fetches a caller-supplied URL from the server, so without a
 * host check it is an SSRF hole into the private network and cloud metadata.
 * Only public http(s) hosts are allowed.
 */
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "::1" || host === "0.0.0.0") return true;
  // .local / .internal mDNS and private cluster names
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;

  // IPv4 literals — block loopback, link-local, and RFC1918 ranges.
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true; // includes 169.254.169.254 metadata
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  }

  // IPv6 unique-local / link-local.
  if (/^f[cd][0-9a-f]{2}:/i.test(host) || /^fe80:/i.test(host)) return true;

  return false;
}

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) {
    return new NextResponse("Missing url parameter.", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new NextResponse("Invalid url parameter.", { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return new NextResponse("Only http and https are supported.", {
      status: 400,
    });
  }

  if (isBlockedHost(parsed.hostname)) {
    return new NextResponse("That host isn't allowed.", { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
  } catch {
    // Non-200 so the client falls through to the screenshot tier.
    return new NextResponse("Upstream fetch failed.", { status: 502 });
  }

  if (!upstream.ok) {
    return new NextResponse(`Upstream returned ${upstream.status}.`, {
      status: 502,
    });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) {
    return new NextResponse("Upstream did not return HTML.", { status: 502 });
  }

  const html = await upstream.text();
  const origin = new URL(upstream.url || parsed.toString()).origin;

  return new NextResponse(rewriteHtml(html, origin), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Deliberately omit x-frame-options / CSP so the result can be framed.
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}

function rewriteHtml(html: string, origin: string): string {
  let out = html;

  // Drop any meta-tag CSP the page sets on itself; the header version is
  // already gone because we build a fresh response. Attribute order varies
  // (content= can precede http-equiv=), so match the tag then filter.
  out = out.replace(/<meta\b[^>]*>/gi, (tag) =>
    /http-equiv\s*=\s*["']?content-security-policy/i.test(tag) ? "" : tag,
  );

  // Resolve relative assets. <base> handles most of it; explicit rewriting
  // of root-relative URLs covers attributes that ignore <base>.
  out = out.replace(
    /\b(href|src)=["']\/(?!\/)([^"']*)["']/gi,
    (_m, attr, path) => `${attr}="${origin}/${path}"`,
  );
  out = out.replace(
    /\b(href|src)=["']\/\/([^"']*)["']/gi,
    (_m, attr, rest) => `${attr}="https://${rest}"`,
  );

  const baseTag = `<base href="${origin}/">`;
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  } else {
    out = `${baseTag}${out}`;
  }

  return out;
}
