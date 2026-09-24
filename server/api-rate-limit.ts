const hitBuckets = new Map<string, number[]>();

export type RateLimitDenied = {
	ok: false;
	status: 429;
	error: string;
	hint: string;
};

export type RateLimitOk = { ok: true };

function pruneHits(key: string, now: number, windowMs: number): number[] {
	const arr = hitBuckets.get(key) ?? [];
	const pruned = arr.filter((t) => now - t < windowMs);
	if (pruned.length === 0) hitBuckets.delete(key);
	else hitBuckets.set(key, pruned);
	return pruned;
}

function maybeSweep(now: number, windowMs: number): void {
	if (Math.random() >= 0.05) return;
	for (const [key, hits] of hitBuckets.entries()) {
		if (!hits.some((t) => now - t < windowMs)) hitBuckets.delete(key);
	}
}

export function assertIpRateLimit(opts: {
	clientIp: string | null;
	bucket: string;
	max: number;
	windowMs: number;
	error?: string;
	hint?: string;
}): RateLimitOk | RateLimitDenied {
	const ip = (opts.clientIp && opts.clientIp.trim()) || 'unknown';
	const now = Date.now();
	maybeSweep(now, opts.windowMs);
	const key = `${opts.bucket}:${ip}`;
	const bucket = pruneHits(key, now, opts.windowMs);
	if (bucket.length >= opts.max) {
		return {
			ok: false,
			status: 429,
			error: opts.error ?? 'Твърде много заявки',
			hint: opts.hint ?? 'Опитай отново след няколко минути.',
		};
	}
	bucket.push(now);
	hitBuckets.set(key, bucket);
	return { ok: true };
}

/** Chat / vision / listing-draft share one expensive-LLM budget per IP. */
export function assertLlmRouteRateLimit(
	clientIp: string | null,
	route: 'chat' | 'classify' | 'draft',
): RateLimitOk | RateLimitDenied {
	const limits = {
		chat: { max: 20, windowMs: 15 * 60 * 1000 },
		classify: { max: 8, windowMs: 15 * 60 * 1000 },
		draft: { max: 12, windowMs: 15 * 60 * 1000 },
	} as const;
	const cfg = limits[route];
	return assertIpRateLimit({
		clientIp,
		bucket: `llm:${route}`,
		max: cfg.max,
		windowMs: cfg.windowMs,
	});
}

export function assertPublicGetRateLimit(clientIp: string | null): RateLimitOk | RateLimitDenied {
  const max = Number(process.env.FIELDLOT_PUBLIC_GET_RATE_LIMIT_MAX ?? '20');
  const windowMs = Number(process.env.FIELDLOT_PUBLIC_GET_RATE_LIMIT_WINDOW_MS ?? '60000');
  return assertIpRateLimit({
    clientIp,
    bucket: 'public-get',
    max,
    windowMs,
    error: 'Твърде много заявки към публичен ресурс',
    hint: 'Опитай по-късно',
  });
}

export function assertRegisterInterestRateLimit(clientIp: string | null): RateLimitOk | RateLimitDenied {
  const max = Number(process.env.FIELDLOT_REGISTER_INTEREST_RATE_LIMIT_MAX ?? '5');
  const windowMs = Number(process.env.FIELDLOT_REGISTER_INTEREST_RATE_LIMIT_WINDOW_MS ?? '60000');
  return assertIpRateLimit({
    clientIp,
    bucket: 'register-interest',
    max,
    windowMs,
    error: 'Твърде много заявки за интерес',
    hint: 'Опитай след минута',
  });
}

export function jsonRateLimitHeaders(): Record<string, string> {
  // Fallback Retry-After header (seconds). Adjust if needed.
  return { 'Retry-After': '60' };
}




