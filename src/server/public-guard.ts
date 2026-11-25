import { headers } from "next/headers";
import { recordAttempt, type AttemptRule } from "@/lib/attempt-budget";

const books = new Map<string, number[]>();
const MAX_KEYS = 400;

/** IPv4 o IPv6 simple; rechaza basura inyectada en cabeceras. */
export function isPlausibleIp(value: string) {
  const text = value.trim();
  if (!text || text.length > 45) return false;
  if (text.includes(" ")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(text)) {
    return text.split(".").every((part) => {
      const n = Number(part);
      return Number.isInteger(n) && n >= 0 && n <= 255;
    });
  }
  // IPv6 comprimido o completo (sin zona).
  if (text.includes(":") && /^[0-9a-fA-F:]+$/.test(text)) return true;
  return false;
}

/**
 * IP del cliente para rate limit.
 * Prefiere x-real-ip (suele fijarlo el edge) y, si no, el último hop de
 * x-forwarded-for (el que añade el proxy cercano). El primer valor es spoofable.
 */
export function resolveClientAddress(forwardedFor: string | null, realIp: string | null) {
  const real = realIp?.trim() ?? "";
  if (real && isPlausibleIp(real)) return real;

  const parts = (forwardedFor ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const candidate = parts[i]!;
    if (isPlausibleIp(candidate)) return candidate;
  }
  return "sin-ip";
}

export async function clientAddress() {
  const headerList = await headers();
  return resolveClientAddress(headerList.get("x-forwarded-for"), headerList.get("x-real-ip"));
}

export function takePublicAttempt(bucket: string, key: string, rule: AttemptRule, now = Date.now()) {
  const id = `${bucket}\n${key}`;
  const result = recordAttempt(books.get(id) ?? [], now, rule);
  books.set(id, result.stamps);
  if (books.size > MAX_KEYS) {
    for (const [entry, stamps] of books) {
      const fresh = stamps.filter((at) => now - at >= 0 && now - at < 60 * 60 * 1000);
      if (fresh.length === 0) books.delete(entry);
      else books.set(entry, fresh);
    }
  }
  return result.allowed;
}

/** Solo tests. */
export function clearPublicAttemptBooks() {
  books.clear();
}
