import { NextRequest } from "next/server";

const BACKEND_URL =
  process.env.FLY_BRAIN_API_URL ??
  process.env.NEXT_PUBLIC_FLY_BRAIN_API_URL ??
  "http://127.0.0.1:8000";

interface RouteContext {
  readonly params: Promise<{
    readonly path: string[];
  }>;
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const backendUrl = new URL(`/${path.join("/")}`, `${BACKEND_URL}/`);
  backendUrl.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.delete("host");

  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await request.arrayBuffer();

  try {
    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });

    const responseHeaders = new Headers();
    const contentType = response.headers.get("content-type");

    if (contentType) {
      responseHeaders.set("content-type", contentType);
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { detail: "The simulation API is unavailable." },
      { status: 503 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
