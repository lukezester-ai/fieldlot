import assert from 'node:assert/strict';
import test from 'node:test';
import { allowedCorsOrigin, applyCorsHeaders, CORS_HEADERS, CORS_METHODS } from './api-cors.js';

test('CORS origin defaults to wildcard when unset', () => {
	const prev = process.env.FIELDLOT_ALLOWED_ORIGINS;
	delete process.env.FIELDLOT_ALLOWED_ORIGINS;
	try {
		assert.equal(allowedCorsOrigin(), '*');
	} finally {
		if (prev === undefined) delete process.env.FIELDLOT_ALLOWED_ORIGINS;
		else process.env.FIELDLOT_ALLOWED_ORIGINS = prev;
	}
});

test('CORS origin uses FIELDLOT_ALLOWED_ORIGINS', () => {
	const prev = process.env.FIELDLOT_ALLOWED_ORIGINS;
	process.env.FIELDLOT_ALLOWED_ORIGINS = 'https://www.fieldlot.io';
	try {
		assert.equal(allowedCorsOrigin(), 'https://www.fieldlot.io');
	} finally {
		if (prev === undefined) delete process.env.FIELDLOT_ALLOWED_ORIGINS;
		else process.env.FIELDLOT_ALLOWED_ORIGINS = prev;
	}
});

test('applyCorsHeaders sets origin, methods, and headers', () => {
	const headers = new Map<string, string>();
	applyCorsHeaders({
		setHeader(name: string, value: string) {
			headers.set(name, value);
		},
	});
	assert.equal(headers.get('Access-Control-Allow-Methods'), CORS_METHODS);
	assert.equal(headers.get('Access-Control-Allow-Headers'), CORS_HEADERS);
	assert.ok(headers.get('Access-Control-Allow-Origin'));
});
