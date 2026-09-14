import { NextRequest } from "next/server";

const GCS_BASE =
  "https://storage.googleapis.com/flyem-male-cns/v1.0/segmentation";

interface RouteContext {
  readonly params: Promise<{
    readonly path: string[];
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;

  const upstreamPath = path.join("/");
  const upstreamUrl = `${GCS_BASE}/${upstreamPath}`;

  const range = request.headers.get("range");
  const requestHeaders = new Headers();

  if (range !== null) {
    requestHeaders.set("Range", range);
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    headers: requestHeaders,
    cache: "no-store",
  });

  if (!upstreamResponse.ok) {
    return new Response(
      `Male CNS upstream request failed: ${upstreamResponse.status}`,
      {
        status: upstreamResponse.status,
      },
    );
  }

  const responseHeaders = new Headers();

  const contentType = upstreamResponse.headers.get("content-type");
  const contentRange = upstreamResponse.headers.get("content-range");
  const acceptRanges = upstreamResponse.headers.get("accept-ranges");

  if (contentType !== null) {
    responseHeaders.set("Content-Type", contentType);
  }

  if (contentRange !== null) {
    responseHeaders.set("Content-Range", contentRange);
  }

  if (acceptRanges !== null) {
    responseHeaders.set("Accept-Ranges", acceptRanges);
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}
