import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url", { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      // Important: don't forward cookies
      credentials: "omit",
      // Some CDNs behave better with a UA
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return new NextResponse("Upstream fetch failed", { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await upstream.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        // Helps repeat exports
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    return new NextResponse("Proxy error", { status: 500 });
  }
}