import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

export class UnsafePreviewUrlError extends Error {}

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (isIP(address) === 6) {
    // Only global unicast. Reject mapped/translated IPv4, local, multicast,
    // documentation and transition ranges instead of trying to unwrap them.
    const first = parseInt(address.split(":")[0], 16);
    const second = parseInt(address.split(":")[1] || "0", 16);
    return first >= 0x2000 && first <= 0x3fff &&
      !(first === 0x2001 && (second < 0x200 || second === 0xdb8)) &&
      first !== 0x2002 && first !== 0x3fff;
  }
  return false;
}

export function parsePublicPreviewUrl(input: string): URL {
  let url: URL;
  try { url = new URL(input); } catch { throw new UnsafePreviewUrlError("Invalid preview URL"); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
      (url.port && !["80", "443"].includes(url.port))) {
    throw new UnsafePreviewUrlError("Only public HTTP(S) preview URLs are allowed");
  }
  return url;
}

export async function resolvePublicPreviewUrl(input: string) {
  const url = parsePublicPreviewUrl(input);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await Promise.race([
    lookup(host, { all: true, verbatim: true }),
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Preview DNS lookup timed out")), 5000);
    }),
  ]).finally(() => { if (timer) clearTimeout(timer); });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new UnsafePreviewUrlError("Private or reserved preview destinations are not allowed");
  }
  return { url, address: addresses[0].address, family: addresses[0].family };
}

// Validate and pin DNS on every hop. A second DNS lookup cannot redirect the
// socket to a private host. Response limits apply before buffering/parsing.
export async function safePreviewFetch(input: string, init: RequestInit = {}): Promise<Response> {
  let target = input;
  const headers = new Headers(init.headers);
  headers.set("accept-encoding", "identity");
  const deadline = Date.now() + 20_000;
  for (let hop = 0; hop <= 4; hop++) {
    init.signal?.throwIfAborted();
    const { url, address, family } = await resolvePublicPreviewUrl(target);
    init.signal?.throwIfAborted();
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Preview request timed out");
    const response = await new Promise<Response>((resolve, reject) => {
      const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
        method: "GET",
        agent: false,
        family,
        headers: Object.fromEntries(headers.entries()),
        lookup: (_host, _options, callback) => callback(null, address, family),
      }, (res) => {
        const responseHeaders = new Headers();
        for (const [name, value] of Object.entries(res.headers)) {
          if (value) responseHeaders.set(name, Array.isArray(value) ? value.join(", ") : value);
        }
        const status = res.statusCode || 502;
        if ([301, 302, 303, 307, 308].includes(status)) {
          res.destroy();
          resolve(new Response(null, { status, headers: responseHeaders }));
          return;
        }
        let bytes = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 2 * 1024 * 1024) {
            request.destroy(new Error("Preview response exceeds 2 MB"));
          } else chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () => resolve(new Response(
          [204, 205, 304].includes(status) ? null : Buffer.concat(chunks),
          { status, headers: responseHeaders },
        )));
      });
      const timer = setTimeout(() => request.destroy(new Error("Preview request timed out")), remaining);
      const abort = () => request.destroy(new Error("Preview request aborted"));
      init.signal?.addEventListener("abort", abort, { once: true });
      request.on("error", reject);
      request.on("close", () => {
        clearTimeout(timer);
        init.signal?.removeEventListener("abort", abort);
      });
      request.end();
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    const next = new URL(location, target);
    if (next.origin !== new URL(target).origin) {
      headers.delete("authorization");
      headers.delete("cookie");
      headers.delete("x-api-key");
    }
    target = next.href;
  }
  throw new Error("Too many preview redirects");
}
