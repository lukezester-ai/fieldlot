/** Honeypot field name — must stay empty (common bot trap). */
export const LEAD_FORM_HP_FIELD = 'hpCompanyWebsite' as const;
export const LEAD_FORM_OPENED_AT_FIELD = 'formOpenedAt' as const;

const MIN_FORM_MS = 2000;
const MAX_FORM_MS = 2 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_PER_WINDOW = 12;

const hitBuckets = new Map<string, number[]>();

function pruneHits(ip: string, now: number): number[] {
	const arr = hitBuckets.get(ip) ?? [];
	const pruned = arr.filter((t) => now - t < RATE_WINDOW_MS);
	if (pruned.length === 0) {
		hitBuckets.delete(ip);
	} else {
		hitBuckets.set(ip, pruned);
	}
	return pruned;
}

export function assertLeadFormAntiBot(
	raw: Record<string, unknown>,
	opts: { clientIp: string | null },
): { ok: false; status: number; error: string; hint?: string } | { ok: true } {
	const ip = (opts.clientIp && opts.clientIp.trim()) || 'unknown';
	const now = Date.now();

	// Вероятностно почистване (5% шанс при всяка заявка) на стари IP записи (memory leak protection)
	if (Math.random() < 0.05) {
		for (const [key, hits] of hitBuckets.entries()) {
			if (!hits.some((t) => now - t < RATE_WINDOW_MS)) {
				hitBuckets.delete(key);
			}
		}
	}

	const bucket = pruneHits(ip, now);
	if (bucket.length >= RATE_MAX_PER_WINDOW) {
		return {
			ok: false,
			status: 429,
			error: 'Твърде много заявки',
			hint: 'Опитай отново след няколко минути.',
		};
	}

	const hpRaw = raw[LEAD_FORM_HP_FIELD];
	if (hpRaw != null && typeof hpRaw !== 'string') {
		return { ok: false, status: 400, error: 'Заявката не мина проверката' };
	}
	if (typeof hpRaw === 'string' && hpRaw.trim().length > 0) {
		return { ok: false, status: 400, error: 'Заявката не мина проверката' };
	}

	const opened = raw[LEAD_FORM_OPENED_AT_FIELD];
	const t =
		typeof opened === 'number' && Number.isFinite(opened)
			? opened
			: typeof opened === 'string' && /^\d{10,15}$/.test(opened.trim())
				? Number(opened.trim())
				: NaN;
	if (!Number.isFinite(t) || t < 1_600_000_000_000 || t > 10_000_000_000_000) {
		return { ok: false, status: 400, error: 'Заявката не мина проверката' };
	}
	if (t > now + 120_000) {
		return { ok: false, status: 400, error: 'Заявката не мина проверката' };
	}
	const elapsed = now - t;
	if (elapsed < MIN_FORM_MS) {
		return {
			ok: false,
			status: 429,
			error: 'Твърде бързо',
			hint: 'Изчакай 2 секунди след зареждане и опитай пак.',
		};
	}
	if (elapsed > MAX_FORM_MS) {
		return {
			ok: false,
			status: 400,
			error: 'Сесията изтече',
			hint: 'Презареди страницата и попълни формата отново.',
		};
	}

	bucket.push(now);
	hitBuckets.set(ip, bucket);
	return { ok: true };
}
