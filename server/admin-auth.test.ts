import assert from 'node:assert/strict';
import test from 'node:test';
import {
	createAdminSessionToken,
	isAdminAuthorized,
	isAdminSecretMatch,
	parseCookieHeader,
	verifyAdminSessionToken,
} from './admin-auth.js';

const SECRET = 'unit-test-admin-secret';

test('admin bearer compare is exact and timing-safe', () => {
	const prev = process.env.FIELDLOT_ADMIN_SECRET;
	process.env.FIELDLOT_ADMIN_SECRET = SECRET;
	try {
		assert.equal(isAdminAuthorized(`Bearer ${SECRET}`), true);
		assert.equal(isAdminAuthorized('Bearer wrong-secret'), false);
		assert.equal(isAdminAuthorized(SECRET), false);
		assert.equal(isAdminSecretMatch(SECRET), true);
		assert.equal(isAdminSecretMatch('nope'), false);
	} finally {
		if (prev === undefined) delete process.env.FIELDLOT_ADMIN_SECRET;
		else process.env.FIELDLOT_ADMIN_SECRET = prev;
	}
});

test('admin session cookie is accepted without storing the secret in JS', () => {
	const prev = process.env.FIELDLOT_ADMIN_SECRET;
	process.env.FIELDLOT_ADMIN_SECRET = SECRET;
	try {
		const token = createAdminSessionToken(SECRET);
		assert.ok(token);
		assert.equal(verifyAdminSessionToken(token, SECRET), true);
		assert.equal(verifyAdminSessionToken('1.deadbeef', SECRET), false);
		const cookie = `other=1; fieldlot_admin=${token}; path=/`;
		assert.equal(parseCookieHeader(cookie, 'fieldlot_admin'), token);
		assert.equal(isAdminAuthorized(undefined, cookie), true);
		assert.equal(isAdminAuthorized(undefined, 'fieldlot_admin=nope'), false);
	} finally {
		if (prev === undefined) delete process.env.FIELDLOT_ADMIN_SECRET;
		else process.env.FIELDLOT_ADMIN_SECRET = prev;
	}
});

test('admin is locked when secret is missing', () => {
	const prev = process.env.FIELDLOT_ADMIN_SECRET;
	delete process.env.FIELDLOT_ADMIN_SECRET;
	try {
		assert.equal(isAdminAuthorized('Bearer anything'), false);
		assert.equal(isAdminSecretMatch('anything'), false);
	} finally {
		if (prev === undefined) delete process.env.FIELDLOT_ADMIN_SECRET;
		else process.env.FIELDLOT_ADMIN_SECRET = prev;
	}
});
