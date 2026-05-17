export function readAdminSecret(): string {
	return (process.env.FIELDLOT_ADMIN_SECRET ?? '').trim();
}

export function isAdminAuthorized(authHeader: string | undefined): boolean {
	const secret = readAdminSecret();
	if (!secret) return false;
	if (!authHeader?.startsWith('Bearer ')) return false;
	return authHeader.slice(7).trim() === secret;
}
