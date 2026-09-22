import assert from 'node:assert/strict';
import test from 'node:test';
import { rebuildFieldlotRagIndex, resetRagIndexCacheForTests } from './fieldlot-semantic-rag.js';

test('rebuild keeps the RAG index when Blob works and disk is read-only', async () => {
	resetRagIndexCacheForTests();
	const r = await rebuildFieldlotRagIndex([], {
		persist: async () => 'blob',
		writeDisk: () => {
			throw new Error('EROFS: read-only file system, open index');
		},
	});
	assert.equal(r.ok, true);
	assert.equal(r.persisted, 'blob');
	assert.ok(r.chunkCount > 0);
});

test('rebuild fails when nothing can be persisted', async () => {
	resetRagIndexCacheForTests();
	const r = await rebuildFieldlotRagIndex([], {
		persist: async () => 'memory',
		writeDisk: () => {
			throw new Error('EROFS');
		},
	});
	assert.equal(r.ok, false);
	assert.match(String(r.error), /EROFS/);
});
