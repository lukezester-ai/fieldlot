/**
 * Smoke test for the Node API.
 *
 * When FIELDLOT_SMOKE_BASE is not provided, the test starts an isolated API
 * process itself. This keeps `npm test` self-contained while still allowing
 * tests against an already-running or deployed API.
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const configuredBase = process.env.FIELDLOT_SMOKE_BASE;
const smokePort = Number(process.env.FIELDLOT_SMOKE_PORT || '18789');
const BASE = configuredBase || `http://127.0.0.1:${smokePort}`;
let apiProcess;

async function waitForApi(timeoutMs = 15_000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (apiProcess?.exitCode != null) {
			throw new Error(`Smoke API exited early with code ${apiProcess.exitCode}`);
		}
		try {
			const response = await fetch(`${BASE}/`);
			if (response.ok) return;
		} catch {
			// The server may still be compiling or binding its port.
		}
		await new Promise((resolve) => setTimeout(resolve, 150));
	}
	throw new Error(`Timed out waiting for smoke API at ${BASE}`);
}

async function stopApi() {
	if (!apiProcess || apiProcess.exitCode != null) return;
	apiProcess.kill();
	await Promise.race([
		once(apiProcess, 'exit'),
		new Promise((resolve) => setTimeout(resolve, 2_000)),
	]);
}

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

try {
	if (!configuredBase) {
		apiProcess = spawn(process.execPath, ['--import', 'tsx', 'server/dev-api.ts'], {
			cwd: process.cwd(),
			env: { ...process.env, FIELDLOT_API_PORT: String(smokePort) },
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		apiProcess.stdout.on('data', (chunk) => process.stdout.write(`[smoke-api server] ${chunk}`));
		apiProcess.stderr.on('data', (chunk) => process.stderr.write(`[smoke-api server] ${chunk}`));
		await waitForApi();
	}

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
} finally {
	await stopApi();
}

if (failed > 0) process.exitCode = 1;
else console.log('smoke-api: OK');
