export const CORS_METHODS = 'GET,POST,OPTIONS';
export const CORS_HEADERS = 'Content-Type,Authorization';

export function allowedCorsOrigin(): string {
	return (process.env.FIELDLOT_ALLOWED_ORIGINS ?? '*').trim() || '*';
}

export function applyCorsHeaders(res: { setHeader(name: string, value: string): unknown }): void {
	res.setHeader('Access-Control-Allow-Origin', allowedCorsOrigin());
	res.setHeader('Access-Control-Allow-Methods', CORS_METHODS);
	res.setHeader('Access-Control-Allow-Headers', CORS_HEADERS);
}

export function isCorsPreflight(method: string | undefined): boolean {
	return method === 'OPTIONS';
}
