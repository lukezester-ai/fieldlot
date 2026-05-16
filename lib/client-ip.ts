import type { VercelRequest } from '@vercel/node';

export function clientIpFromVercelRequest(req: VercelRequest): string | null {
	const realIp = req.headers['x-real-ip'];
	if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
	const xf = req.headers['x-forwarded-for'];
	if (typeof xf === 'string' && xf.trim()) {
		const first = xf.split(',')[0]?.trim();
		if (first) return first;
	}
	const rip = (req.socket as { remoteAddress?: string } | undefined)?.remoteAddress;
	return typeof rip === 'string' && rip.trim() ? rip.trim() : null;
}
