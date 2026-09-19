import assert from 'node:assert/strict';
import test from 'node:test';
import { addListingReport, dismissReport, hideListingId, getHiddenListingIds } from './moderation-store.js';

test('reports can hide a listing id for the public catalog', async () => {
	const report = await addListingReport({
		listingId: 'ba-test-hide',
		reason: 'Подозрителна обява за тест',
		reporterId: 'uid-reporter-test',
	});
	assert.equal(report.status, 'open');
	const hidden = await hideListingId(report.listingId, report.id);
	assert.equal(hidden.hiddenIds.includes('ba-test-hide'), true);
	assert.equal((await getHiddenListingIds()).includes('ba-test-hide'), true);
	const dismissed = await dismissReport(report.id);
	assert.ok(dismissed.reports.some((row) => row.id === report.id && row.status === 'dismissed'));
});
