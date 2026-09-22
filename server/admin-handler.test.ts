import assert from 'node:assert/strict';
import test from 'node:test';
import { handleAdminLogin } from './admin-handler.js';

test('login mismatch tells the operator not to copy from Vercel', async () => {
	const prev = process.env.FIELDLOT_ADMIN_SECRET;
	process.env.FIELDLOT_ADMIN_SECRET = 'correct-secret-value';
	try {
		const r = await handleAdminLogin({}, { token: 'wrong-token' }, { clientIp: '203.0.113.50' });
		assert.equal(r.status, 401);
		assert.equal(r.body.error, 'Unauthorized');
		assert.match(String(r.body.hint), /admin-secret\.txt/);
	} finally {
		if (prev === undefined) delete process.env.FIELDLOT_ADMIN_SECRET;
		else process.env.FIELDLOT_ADMIN_SECRET = prev;
	}
});
