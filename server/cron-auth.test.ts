import assert from 'node:assert/strict';
import test from 'node:test';
import { isCronAuthorized } from './cron-auth.js';

test('cron access is denied when CRON_SECRET is missing', () => {
	assert.equal(isCronAuthorized(undefined, undefined), false);
	assert.equal(isCronAuthorized('Bearer anything', ''), false);
});

test('cron access requires an exact bearer token', () => {
	assert.equal(isCronAuthorized('Bearer correct-secret', 'correct-secret'), true);
	assert.equal(isCronAuthorized('Bearer wrong-secret', 'correct-secret'), false);
	assert.equal(isCronAuthorized('correct-secret', 'correct-secret'), false);
	assert.equal(isCronAuthorized(['Bearer correct-secret'], 'correct-secret'), false);
});
