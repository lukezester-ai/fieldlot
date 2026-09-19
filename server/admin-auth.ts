import { createHmac } from 'node:crypto';
import { timingSafeStringEqual } from './secret-equal.js';

export const ADMIN_COOKIE_NAME = 'fieldlot_admin';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function readAdminSecret(): string {
	return (process.env.FIELDLOT_ADMIN_SECRET ?? '').trim();
}

export function parseCookieHeader(cookieHeader: string | undefined, name: string): string | null {
	if (!cookieHeader) return null;
	for (const part of cookieHeader.split(';')) {
		const idx = part.indexOf('=');
		if (idx < 1) continue;
		const key = part.slice(0, idx).trim();
		if (key !== name) continue;
		return part.slice(idx + 1).trim();
	}
	return null;
}

export function createAdminSessionToken(secret = readAdminSecret()): string | null {
	if (!secret) return null;
	const exp = String(Date.now() + SESSION_TTL_MS);
	const sig = createHmac('sha256', secret).update(exp).digest('hex');
	return `${exp}.${sig}`;
}

export function verifyAdminSessionToken(
	value: string | null | undefined,
	secret = readAdminSecret(),
): boolean {
	if (!secret || !value) return false;
	const dot = value.indexOf('.');
	if (dot < 1) return false;
	const exp = value.slice(0, dot);
	const sig = value.slice(dot + 1);
	if (!/^\d{13,15}$/.test(exp) || !/^[a-f0-9]{64}$/.test(sig)) return false;
	if (Number(exp) < Date.now()) return false;
	const expected = createHmac('sha256', secret).update(exp).digest('hex');
	return timingSafeStringEqual(sig, expected);
}

export function adminSessionCookie(value: string, maxAgeSec = Math.floor(SESSION_TTL_MS / 1000)): string {
	const secure = process.env.VERCEL ? '; Secure' : '';
	return `${ADMIN_COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Lax${secure}`;
}

export function clearAdminSessionCookie(): string {
	const secure = process.env.VERCEL ? '; Secure' : '';
	return `${ADMIN_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}

export function isAdminAuthorized(
	authHeader: string | undefined,
	cookieHeader?: string,
): boolean {
	const secret = readAdminSecret();
	if (!secret) return false;
	if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
		if (timingSafeStringEqual(authHeader, `Bearer ${secret}`)) return true;
	}
	return verifyAdminSessionToken(parseCookieHeader(cookieHeader, ADMIN_COOKIE_NAME), secret);
}

export function isAdminSecretMatch(token: string | undefined): boolean {
	const secret = readAdminSecret();
	if (!secret || typeof token !== 'string' || !token.trim()) return false;
	return timingSafeStringEqual(token.trim(), secret);
}
