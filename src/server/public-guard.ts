import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { recordAttempt, type AttemptRule } from "@/lib/attempt-budget";
import { createAdminSupabase } from "@/lib/supabase/admin";

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

export function hashRateKey(key: string) {
  return createHash("sha256").update(key.trim().toLowerCase()).digest("hex");
}

function takeMemoryAttempt(bucket: string, key: string, rule: AttemptRule, now: number) {
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

/**
 * Intenta el contador compartido en Supabase.
 * `null` = tabla/RPC ausente o error → usar memoria local.
 */
export async function takeSharedPublicAttempt(
  bucket: string,
  key: string,
  rule: AttemptRule,
): Promise<boolean | null> {
  try {
    const supabase = createAdminSupabase();
    const { data, error } = await supabase.rpc("take_public_rate_attempt", {
      p_bucket: bucket,
      p_key_hash: hashRateKey(`${bucket}:${key}`),
      p_limit: rule.limit,
      p_window_seconds: Math.max(1, Math.ceil(rule.windowMs / 1000)),
    });
    if (error) {
      const message = error.message ?? "";
      if (message.includes("schema cache") || message.includes("does not exist") || message.includes("Could not find the function")) {
        return null;
      }
      return null;
    }
    return data === true;
  } catch {
    return null;
  }
}

export async function takePublicAttempt(bucket: string, key: string, rule: AttemptRule, now = Date.now()) {
  const shared = await takeSharedPublicAttempt(bucket, key, rule);
  if (shared !== null) return shared;
  return takeMemoryAttempt(bucket, key, rule, now);
}

/** Solo tests. */
export function clearPublicAttemptBooks() {
  books.clear();
}
