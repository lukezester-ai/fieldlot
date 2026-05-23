/**
 * Smoke test — пусни след `npm run dev` (Vite 5174 + API 8789).
 * Ако API не слуша на FIELDLOT_SMOKE_BASE, излиза с 0 (само предупреждение), за да минава `npm test` офлайн.
 * За строг режим: FIELDLOT_SMOKE_STRICT=1
 */
const BASE = process.env.FIELDLOT_SMOKE_BASE || 'http://127.0.0.1:8789';
const STRICT = process.env.FIELDLOT_SMOKE_STRICT === '1';
const SMOKE_MS = Math.min(Math.max(Number(process.env.FIELDLOT_SMOKE_TIMEOUT_MS) || 5000, 1000), 30_000);
const openedAt = Date.now() - 5000;

function signal() {
	return AbortSignal.timeout(SMOKE_MS);
}

async function post(path, body) {
	const res = await fetch(`${BASE}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal: signal(),
	});
	const data = await res.json().catch(() => ({}));
	return { status: res.status, data };
}

async function get(path) {
	const res = await fetch(`${BASE}${path}`, { signal: signal() });
	const data = await res.json().catch(() => ({}));
	return { status: res.status, data };
}

function isUnreachable(err) {
	const code = err?.cause?.code ?? err?.code;
	const name = err?.name;
	return (
		code === 'ECONNREFUSED' ||
		code === 'ENOTFOUND' ||
		code === 'ETIMEDOUT' ||
		name === 'AbortError' ||
		name === 'TimeoutError'
	);
}

let failed = 0;

try {
	const chatGet = await get('/api/fieldlot-chat');
	if (chatGet.status !== 200) {
		console.error('FAIL GET /api/fieldlot-chat', chatGet.status);
		failed++;
	} else {
		console.log('OK GET /api/fieldlot-chat', chatGet.data.llmConfigured ? 'llm' : 'no-llm');
	}

	const lead = await post('/api/register-interest', {
		fullName: 'Smoke Test',
		businessEmail: `smoke-${Date.now()}@example.com`,
		companyName: 'Fieldlot QA',
		phone: '',
		marketFocus: 'smoke',
		subscribeAlerts: false,
		hpCompanyWebsite: '',
		formOpenedAt: openedAt,
	});

	if (lead.status !== 200 || !lead.data.ok) {
		console.error('FAIL POST /api/register-interest', lead.status, lead.data);
		failed++;
	} else {
		console.log('OK POST /api/register-interest', lead.data.mailDelivery);
	}
} catch (err) {
	if (isUnreachable(err)) {
		console.warn(
			`smoke-api: API не е достъпен (${BASE}). Пусни \`npm run dev\` за пълен smoke, или FIELDLOT_SMOKE_STRICT=1 за fail при липса на сървър.`,
		);
		if (STRICT) process.exit(1);
		process.exit(0);
	}
	throw err;
}

if (failed > 0) process.exit(1);
console.log('smoke-api: OK');
