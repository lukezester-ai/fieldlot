const SESSION_FLAG = 'fieldlot-admin-ok';

function authHeaders() {
	return { 'Content-Type': 'application/json' };
}

async function apiGet(action) {
	const res = await fetch(`/api/admin/${action}`, {
		headers: authHeaders(),
		credentials: 'include',
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error || res.statusText);
	return data;
}

async function apiPost(action, body) {
	const res = await fetch(`/api/admin/${action}`, {
		method: 'POST',
		headers: authHeaders(),
		credentials: 'include',
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

function showLogin() {
	sessionStorage.removeItem(SESSION_FLAG);
	document.getElementById('login-view').hidden = false;
	document.getElementById('admin-view').hidden = true;
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

async function enterAdmin() {
	showAdmin();
	await Promise.all([loadStatus(), loadKnowledge(), loadSources()]);
}

document.getElementById('login-btn')?.addEventListener('click', async () => {
	const token = document.getElementById('admin-token').value.trim();
	const err = document.getElementById('login-err');
	err.textContent = '';
	if (!token) return;
	try {
		await apiPost('login', { token });
		document.getElementById('admin-token').value = '';
		sessionStorage.setItem(SESSION_FLAG, '1');
		await enterAdmin();
	} catch (e) {
		showLogin();
		err.textContent = e instanceof Error ? e.message : 'Грешен токен';
	}
});

document.getElementById('logout-btn')?.addEventListener('click', async () => {
	try {
		await apiPost('logout', {});
	} catch {
		// Cookie is cleared server-side when possible; still hide the panel.
	}
	showLogin();
});

if (sessionStorage.getItem(SESSION_FLAG)) {
	showAdmin();
	Promise.all([loadStatus(), loadKnowledge(), loadSources()]).catch(() => {
		showLogin();
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

document.getElementById('curate-images')?.addEventListener('click', async () => {
	const log = document.getElementById('sync-log');
	const btn = document.getElementById('curate-images');
	btn.disabled = true;
	log.textContent = 'AI Curation... (this may take a minute)';
	try {
		const data = await apiPost('curate-images', {});
		log.textContent = JSON.stringify(data, null, 2);
	} catch (e) {
		log.textContent = e instanceof Error ? e.message : String(e);
	} finally {
		btn.disabled = false;
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
