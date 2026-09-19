const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function apiKey(): string {
	return (
		process.env.FIREBASE_API_KEY?.trim() ||
		process.env.VITE_FIREBASE_API_KEY?.trim() ||
		''
	);
}

export async function lookupFirebaseIdToken(
	idToken: string,
): Promise<{ uid: string; email: string } | null> {
	const key = apiKey();
	const token = idToken.trim();
	if (!key || !token || token.length < 20 || token.length > 4096) return null;
	try {
		const res = await fetch(
			`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ idToken: token }),
				signal: AbortSignal.timeout(10_000),
			},
		);
		if (!res.ok) return null;
		const data = (await res.json()) as {
			users?: { localId?: string; email?: string }[];
		};
		const user = data.users?.[0];
		const uid = user?.localId?.trim() || '';
		const email = user?.email?.trim() || '';
		if (!uid || !EMAIL_RE.test(email)) return null;
		return { uid, email };
	} catch {
		return null;
	}
}
