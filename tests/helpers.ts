import type { Express } from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";

export async function request(app: Express, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, body: json, text };
  } finally {
    server.close();
  }
}
