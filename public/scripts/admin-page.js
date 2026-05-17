const TOKEN_KEY = 'fieldlot-admin-token';

function authHeaders() {
	const token = localStorage.getItem(TOKEN_KEY) || '';
	return {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json',
	};
}

async function apiGet(action) {
	const res = await fetch(`/api/admin/${action}`, { headers: authHeaders() });
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error || res.statusText);
	return data;
}

async function apiPost(action, body) {
	const res = await fetch(`/api/admin/${action}`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify(body ?? {}),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error || data.hint || res.statusText);
	return data;
}

function showAdmin() {
	document.getElementById('login-view').hidden = true;
	document.getElementById('admin-view').hidden = false;
}

async function loadStatus() {
	const pre = document.getElementById('status-pre');
	pre.textContent = 'Зареждане…';
	try {
		const data = await apiGet('status');
		pre.textContent = JSON.stringify(data, null, 2);
	} catch (e) {
		pre.textContent = e instanceof Error ? e.message : String(e);
	}
}

async function loadKnowledge() {
	const data = await apiGet('knowledge');
	document.getElementById('knowledge-json').value = JSON.stringify(data.chunks ?? data, null, 2);
}

async function loadSources() {
	const data = await apiGet('status');
	document.getElementById('sources-json').value = JSON.stringify(
		{ sources: data.sources ?? [] },
		null,
		2,
	);
}

document.getElementById('login-btn')?.addEventListener('click', async () => {
	const token = document.getElementById('admin-token').value.trim();
	const err = document.getElementById('login-err');
	err.textContent = '';
	if (!token) return;
	localStorage.setItem(TOKEN_KEY, token);
	try {
		await apiGet('status');
		showAdmin();
		await Promise.all([loadStatus(), loadKnowledge(), loadSources()]);
	} catch (e) {
		localStorage.removeItem(TOKEN_KEY);
		err.textContent = e instanceof Error ? e.message : 'Грешен токен';
	}
});

if (localStorage.getItem(TOKEN_KEY)) {
	showAdmin();
	Promise.all([loadStatus(), loadKnowledge(), loadSources()]).catch(() => {
		localStorage.removeItem(TOKEN_KEY);
		location.reload();
	});
}

document.getElementById('refresh-status')?.addEventListener('click', () => void loadStatus());

document.getElementById('sync-listings')?.addEventListener('click', async () => {
	const log = document.getElementById('sync-log');
	const btn = document.getElementById('sync-listings');
	btn.disabled = true;
	log.textContent = 'Sync…';
	try {
		const data = await apiPost('sync-listings', {});
		log.textContent = JSON.stringify(data, null, 2);
		await loadStatus();
	} catch (e) {
		log.textContent = e instanceof Error ? e.message : String(e);
	} finally {
		btn.disabled = false;
	}
});

document.getElementById('sync-images')?.addEventListener('click', async () => {
	const log = document.getElementById('sync-log');
	try {
		const data = await apiPost('sync-images', {});
		log.textContent = JSON.stringify(data, null, 2);
	} catch (e) {
		log.textContent = e instanceof Error ? e.message : String(e);
	}
});

document.getElementById('save-knowledge')?.addEventListener('click', async () => {
	try {
		const chunks = JSON.parse(document.getElementById('knowledge-json').value);
		const data = await apiPost('save-knowledge', { chunks });
		alert(`Запазено: ${data.saved ?? chunks.length} chunks`);
	} catch (e) {
		alert(e instanceof Error ? e.message : String(e));
	}
});

document.getElementById('save-sources')?.addEventListener('click', async () => {
	try {
		const parsed = JSON.parse(document.getElementById('sources-json').value);
		await apiPost('save-sources', parsed);
		alert('Източниците са запазени. Пуснете Sync обяви.');
		await loadSources();
	} catch (e) {
		alert(e instanceof Error ? e.message : String(e));
	}
});
