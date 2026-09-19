import { timingSafeStringEqual } from './secret-equal.js';

/** Cron endpoints are disabled until CRON_SECRET is explicitly configured. */
export function isCronAuthorized(
	authorization: string | string[] | undefined,
	secret = process.env.CRON_SECRET,
): boolean {
	const configuredSecret = secret?.trim();
	if (!configuredSecret || typeof authorization !== 'string') return false;
	return timingSafeStringEqual(authorization, `Bearer ${configuredSecret}`);
}
