import assert from 'node:assert/strict';
import test from 'node:test';
import { getAllListingsSync, getStaticListingsSnapshot, isSyntheticListing } from './listings-data.js';

test('static catalog always provides a safe non-empty RAG fallback', () => {
	const listings = getAllListingsSync();
	const snapshot = getStaticListingsSnapshot();
	assert.ok(listings.length > 0);
	assert.equal(snapshot.count, snapshot.listings.length);
	assert.ok(snapshot.count > 0);
});

test('synthetic Global Feed listings are excluded from the catalog', () => {
	assert.equal(
		isSyntheticListing({
			id: 'gf-abc123',
			title: 'Selling Wheat',
			subtitle: '🇩🇪 Hamburg, DE · Global Feed',
			source: 'GlobalFeed',
		} as never),
		true,
	);
	for (const row of getAllListingsSync()) {
		assert.equal(isSyntheticListing(row), false);
	}
});
