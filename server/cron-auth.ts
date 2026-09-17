import { timingSafeEqual } from 'node:crypto';

function safeEqual(left: string, right: string): boolean {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);
	if (leftBuffer.length !== rightBuffer.length) return false;
	return timingSafeEqual(leftBuffer, rightBuffer);
}

/** Cron endpoints are disabled until CRON_SECRET is explicitly configured. */
export function isCronAuthorized(
	authorization: string | string[] | undefined,
	secret = process.env.CRON_SECRET,
): boolean {
	const configuredSecret = secret?.trim();
	if (!configuredSecret || typeof authorization !== 'string') return false;
	return safeEqual(authorization, `Bearer ${configuredSecret}`);
}
