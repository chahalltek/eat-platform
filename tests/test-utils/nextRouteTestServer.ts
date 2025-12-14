import http from "node:http";
import { NextRequest } from "next/server";

export type NextHandler = (req: NextRequest, context?: any) => Promise<Response> | Response;

async function readBody(req: http.IncomingMessage): Promise<Uint8Array | null> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (!chunks.length) return null;

  return Buffer.concat(chunks);
}

export function createNextRouteTestServer(
  handler: NextHandler,
  options?: {
    buildContext?: (req: http.IncomingMessage) => any;
  }
) {
  return http.createServer(async (req, res) => {
    const body = await readBody(req);
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (!value) continue;

      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else {
        headers.set(key, value);
      }
    }

    const requestBody =
      body !== null
        ? new Blob([body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer])
        : null;

    const request = new Request(`http://localhost${req.url ?? ""}`, {
      method: req.method,
      headers,
      body: requestBody,
    });

    const nextRequest = new NextRequest(request);
    const context = options?.buildContext?.(req);
    const response = await handler(nextRequest, context);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));

    const responseBody = Buffer.from(await response.arrayBuffer());
    res.end(responseBody);
  });
}
