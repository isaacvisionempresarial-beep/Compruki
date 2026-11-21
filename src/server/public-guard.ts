import { headers } from "next/headers";
import { recordAttempt, type AttemptRule } from "@/lib/attempt-budget";

const books = new Map<string, number[]>();
const MAX_KEYS = 400;

export async function clientAddress() {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const real = headerList.get("x-real-ip")?.trim() ?? "";
  return forwarded || real || "sin-ip";
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
