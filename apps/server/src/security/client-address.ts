import type { IncomingMessage } from "node:http";
import { normalizeIP } from "@fastify/rate-limit";
import proxyaddr from "proxy-addr";

export type TrustProxy = (address: string, hop: number) => boolean;

export function compileTrustProxy(entries: string[]): TrustProxy {
  const normalized = entries.map((entry) => entry.toLowerCase());
  if (normalized.includes("false") || normalized.includes("none")) return () => false;
  if (normalized.includes("true") || normalized.includes("all")) return () => true;
  const hops = normalized.length === 1 ? Number(normalized[0]) : Number.NaN;
  if (Number.isInteger(hops) && hops >= 0) return (_address, hop) => hop < hops;
  const compiled = proxyaddr.compile(entries);
  return (address, hop) => compiled(address, hop);
}

export function clientAddress(request: IncomingMessage, trust: TrustProxy): string {
  if (!request.socket.remoteAddress) return "unknown";
  return normalizeIP(proxyaddr(request, trust));
}

export function clientKey(address: string): string {
  return normalizeIP(address);
}
