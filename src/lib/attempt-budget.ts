export type AttemptRule = {
  limit: number;
  windowMs: number;
};

export function recordAttempt(stamps: readonly number[], now: number, rule: AttemptRule) {
  const recent = stamps.filter((at) => now - at >= 0 && now - at < rule.windowMs);
  if (recent.length >= rule.limit) return { allowed: false, stamps: recent };
  return { allowed: true, stamps: [...recent, now] };
}
