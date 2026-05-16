/**
 * Smoke test — пусни след `npm run dev` (Vite 5174 + API 8789).
 */
const BASE = process.env.FIELDLOT_SMOKE_BASE || 'http://127.0.0.1:8789';
const openedAt = Date.now() - 5000;

async function post(path, body) {
	const res = await fetch(`${BASE}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	const data = await res.json().catch(() => ({}));
	return { status: res.status, data };
}

async function get(path) {
	const res = await fetch(`${BASE}${path}`);
	const data = await res.json().catch(() => ({}));
	return { status: res.status, data };
}

let failed = 0;

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

if (failed > 0) process.exit(1);
console.log('smoke-api: OK');
