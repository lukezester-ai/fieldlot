const BASE = process.env.FIELDLOT_BACKEND_URL || 'http://127.0.0.1:8000';

async function req(method, path, body, token) {
	const headers = { 'Content-Type': 'application/json' };
	if (token) headers.Authorization = `Bearer ${token}`;
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});
	const data = await res.json().catch(() => ({}));
	return { res, data };
}

let failed = 0;

async function check(name, fn) {
	try {
		await fn();
		console.log('OK', name);
	} catch (e) {
		failed += 1;
		console.error('FAIL', name, e instanceof Error ? e.message : e);
	}
}

await check('GET /health', async () => {
	const { res, data } = await req('GET', '/health');
	if (!res.ok || !data.ok) throw new Error(JSON.stringify(data));
});

let token = '';
await check('POST /api/v1/auth/login demo farmer', async () => {
	const { res, data } = await req('POST', '/api/v1/auth/login', {
		email: 'farmer@fieldlot.demo',
		password: 'FieldlotDemo1!',
	});
	if (!res.ok) throw new Error(JSON.stringify(data));
	token = data.access_token;
});

await check('GET /api/v1/products', async () => {
	const { res, data } = await req('GET', '/api/v1/products');
	if (!res.ok || !Array.isArray(data)) throw new Error('not array');
	if (data.length < 1) throw new Error('no products');
});

await check('GET /api/v1/market/prices', async () => {
	const { res, data } = await req('GET', '/api/v1/market/prices');
	if (!res.ok || !data.items?.length) throw new Error(JSON.stringify(data));
});

await check('GET /api/v1/ai/price-forecast/пшеница', async () => {
	const { res, data } = await req('GET', '/api/v1/ai/price-forecast/%D0%BF%D1%88%D0%B5%D0%BD%D0%B8%D1%86%D0%B0?months=2');
	if (!res.ok || !data.forecast_price) throw new Error(JSON.stringify(data));
});

await check('GET /api/v1/export/markets', async () => {
	const { res, data } = await req('GET', '/api/v1/export/markets');
	if (!res.ok || !data.markets?.length) throw new Error(JSON.stringify(data));
});

await check('POST /api/v1/calculators/profit', async () => {
	const { res, data } = await req('POST', '/api/v1/calculators/profit', {
		revenue: 100000,
		seed_cost: 12000,
		fuel_cost: 8000,
	});
	if (!res.ok || data.profit == null) throw new Error(JSON.stringify(data));
});

if (failed) {
	console.error(`smoke-backend: ${failed} failed`);
	process.exit(1);
}
console.log('smoke-backend: OK');
