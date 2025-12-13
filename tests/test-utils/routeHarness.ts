import { NextRequest } from "next/server";

export type MakeRequestOptions = {
  method?: string;
  url: string;
  json?: unknown;
  body?: BodyInit | null;
  headers?: HeadersInit;
  query?: Record<string, string | number | boolean | null | undefined>;
};

export function makeRequest({
  method = "GET",
  url: rawUrl,
  json,
  body,
  headers,
  query,
}: MakeRequestOptions): NextRequest {
  const url = new URL(rawUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const requestHeaders = new Headers(headers);
  let requestBody = body ?? null;

  if (json !== undefined) {
    requestBody = JSON.stringify(json);
    if (!requestHeaders.has("content-type")) {
      requestHeaders.set("content-type", "application/json");
    }
  }

  const baseRequest = new Request(url.toString(), {
    method,
    headers: requestHeaders,
    body: requestBody,
  });

  return new NextRequest(baseRequest);
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
