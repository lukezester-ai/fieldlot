import assert from 'node:assert/strict';
import test from 'node:test';
import { getAllListingsSync, getStaticListingsSnapshot } from './listings-data.js';

test('static catalog always provides a safe non-empty RAG fallback', () => {
	const listings = getAllListingsSync();
	const snapshot = getStaticListingsSnapshot();
	assert.ok(listings.length > 0);
	assert.equal(snapshot.count, snapshot.listings.length);
	assert.ok(snapshot.count > 0);
});
