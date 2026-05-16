/** Vercel may pass `req.body` as object or string depending on runtime. */
export function vercelJsonBody(body: unknown): unknown | null {
	if (body == null) return body;
	if (typeof body === 'object') return body;
	if (typeof body === 'string') {
		const trimmed = body.trim();
		if (!trimmed) return {};
		try {
			return JSON.parse(trimmed) as unknown;
		} catch {
			return null;
		}
	}
	if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) {
		try {
			const s = body.toString('utf8').trim();
			if (!s) return {};
			return JSON.parse(s) as unknown;
		} catch {
			return null;
		}
	}
	return body;
}
