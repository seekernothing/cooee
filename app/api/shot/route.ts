import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Next caches fetches inside route handlers by default, which would pin the
// first (unfinished) mShots response and defeat the polling below.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

/**
 * Last-resort tier: a static screenshot for stores that resist both direct
 * framing and the HTML proxy (Cloudflare, heavy SPAs).
 *
 * Deliberately no Playwright/Chromium — we proxy a hosted service instead.
 * Cached hard because a storefront hero does not change minute to minute.
 */
const SHOT_TTL_SECONDS = 60 * 60 * 24;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Worst case must stay inside maxDuration (Vercel Hobby caps at 60s):
 * 6 x (8s fetch + 3s wait) = 66s upper bound, and in practice mShots answers
 * in well under a second once the shot is cached, so this only bites on a
 * genuinely cold render.
 */
const SHOT_MAX_ATTEMPTS = 6;
const SHOT_POLL_DELAY_MS = 3000;
const SHOT_FETCH_TIMEOUT_MS = 8000;
/** Leaves headroom under maxDuration to still write a response. */
const SHOT_DEADLINE_MS = 45_000;
/**
 * mShots answers in three phases while it renders: a ~5 byte stub, then a
 * ~18KB grey "still working" placeholder, then the real screenshot (100KB+
 * for a typical storefront). Measured on mokobara.com: 5 → 18425 → 213725.
 */
const SHOT_PLACEHOLDER_MAX_BYTES = 30_000;

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "::1" || host === "0.0.0.0") return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  }

  if (/^f[cd][0-9a-f]{2}:/i.test(host) || /^fe80:/i.test(host)) return true;
  return false;
}

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "Missing url parameter." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url parameter." }, { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json(
      { error: "Only http and https are supported." },
      { status: 400 },
    );
  }

  if (isBlockedHost(parsed.hostname)) {
    return NextResponse.json({ error: "That host isn't allowed." }, { status: 403 });
  }

  // WordPress mShots: keyless, widely available, returns a JPEG/PNG.
  //
  // Use origin, not toString(): URL normalisation appends a trailing slash
  // ("https://x.com" -> "https://x.com/"), and mShots treats that as a
  // different target with its own render queue — so the slashed variant kept
  // returning the grey placeholder while the bare one was already cached.
  const shotTarget = parsed.pathname === "/" ? parsed.origin : parsed.toString();
  const shotUrl = `https://s0.wp.com/mshots/v1/${encodeURIComponent(
    shotTarget,
  )}?w=1280&h=800`;

  try {
    // mShots queues the shot on first request and serves a grey placeholder
    // until it's rendered, so poll until a real image comes back. It also
    // 403s without a browser User-Agent.
    let body: ArrayBuffer | null = null;
    let contentType = "image/jpeg";

    // Hard deadline so we always return something before the platform kills
    // the function — a placeholder beats a 504.
    const deadline = Date.now() + SHOT_DEADLINE_MS;

    for (let attempt = 0; attempt < SHOT_MAX_ATTEMPTS; attempt++) {
      if (Date.now() > deadline) break;

      const upstream = await fetch(shotUrl, {
        signal: AbortSignal.timeout(SHOT_FETCH_TIMEOUT_MS),
        redirect: "follow",
        headers: { "User-Agent": BROWSER_UA, Accept: "image/*" },
        // Each poll must hit mShots for real; a cached placeholder would
        // make every attempt return the same unfinished image.
        cache: "no-store",
      });

      if (upstream.ok) {
        const buffer = await upstream.arrayBuffer();
        contentType = upstream.headers.get("content-type") ?? "image/jpeg";

        // The "still rendering" placeholder is a tiny near-empty JPEG.
        // A real storefront screenshot is comfortably larger.
        if (buffer.byteLength > SHOT_PLACEHOLDER_MAX_BYTES) {
          body = buffer;
          break;
        }
        body = buffer; // keep the last one as a fallback
      }

      if (attempt < SHOT_MAX_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, SHOT_POLL_DELAY_MS));
      }
    }

    if (!body) {
      return NextResponse.json(
        { error: "Screenshot service is unavailable." },
        { status: 502 },
      );
    }

    // Only cache a finished screenshot. Caching the grey placeholder for a
    // day would pin a half-rendered image long after the real one is ready.
    const isReal = body.byteLength > SHOT_PLACEHOLDER_MAX_BYTES;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": isReal
          ? `public, max-age=${SHOT_TTL_SECONDS}, s-maxage=${SHOT_TTL_SECONDS}, immutable`
          : "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Screenshot request timed out." },
      { status: 502 },
    );
  }
}
