/**
 * Форма „ранен достъп“ — offline-aware за Lovable / static preview.
 */
(function initFieldlotLeadForm() {
	const form = document.getElementById('lead-form');
	const submit = document.getElementById('lead-submit');
	const status = document.getElementById('lead-status');
	if (!form || !submit || !status) return;

	const t = (k, fb) => (window.FieldlotI18n ? FieldlotI18n.t(k, fb) : fb || k);

	const PHONE_OK = /^\+[1-9]\d{7,14}$/;
	const openedAt = Date.now();
	let formReady = false;
	let apiOnline = false;

	function leadErr(e, h) {
		const errMap = {
			'Too fast': t('lead.wait'),
			'Too many requests': t('lead.rate'),
			'Valid business email required': t('lead.email'),
			'Valid phone required': t('lead.phone'),
		};
		return (e && errMap[e]) || e || h || t('lead.err');
	}

	function setOfflineUi() {
		apiOnline = false;
		status.className = 'form-status warn';
		status.textContent = t('lead.offline');
	}

	function setOnlineUi() {
		apiOnline = true;
		if (status.classList.contains('warn')) {
			status.textContent = '';
			status.className = 'form-status';
		}
	}

	function upd() {
		const valid =
			formReady &&
			apiOnline &&
			document.getElementById('businessEmail').value.trim() &&
			document.getElementById('fullName').value.trim().length >= 2;
		submit.disabled = !valid;
	}

	document.addEventListener('fieldlot-api-status', (e) => {
		const d = e.detail;
		if (d?.chat) setOnlineUi();
		else setOfflineUi();
		upd();
	});

	document.addEventListener('fieldlot-lang-change', () => {
		submit.textContent = t('form.submit');
		if (!apiOnline) setOfflineUi();
	});

	if (window.__fieldlotApi?.checked) {
		if (window.__fieldlotApi.chat) setOnlineUi();
		else setOfflineUi();
	}

	submit.disabled = true;
	setTimeout(() => {
		formReady = true;
		submit.textContent = t('form.submit');
		upd();
	}, 2100);

	form.addEventListener('input', upd);

	form.addEventListener('submit', async (ev) => {
		ev.preventDefault();
		if (!apiOnline) {
			status.className = 'form-status warn';
			status.textContent = t('lead.preview');
			return;
		}
		if (Date.now() - openedAt < 2000) {
			status.className = 'form-status err';
			status.textContent = t('lead.waitShort');
			return;
		}
		let phone = document.getElementById('phone').value.trim();
		if (phone) {
			phone = '+' + phone.replace(/\D/g, '');
			if (!PHONE_OK.test(phone)) {
				status.className = 'form-status err';
				status.textContent = t('lead.phone');
				return;
			}
		}
		status.textContent = t('lead.sending');
		submit.disabled = true;
		try {
			const res = await fetch('/api/register-interest', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fullName: document.getElementById('fullName').value.trim(),
					businessEmail: document.getElementById('businessEmail').value.trim(),
					companyName: document.getElementById('companyName').value.trim(),
					phone,
					marketFocus: document.getElementById('marketFocus').value.trim(),
					subscribeAlerts: document.getElementById('subscribeAlerts').checked,
					hpCompanyWebsite: document.getElementById('hpCompanyWebsite').value,
					formOpenedAt: openedAt,
				}),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok || data.ok === false) throw new Error(leadErr(data.error, data.hint));
			status.className = 'form-status ok';
			status.textContent =
				data.mailDelivery === 'sent' ? t('lead.okMail') : t('lead.ok');
			form.reset();
		} catch (e) {
			status.className = 'form-status err';
			const msg = e instanceof Error ? e.message : t('lead.err');
			if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
				status.className = 'form-status warn';
				status.textContent = t('lead.offlineApi');
			} else {
				status.textContent = msg;
			}
		} finally {
			upd();
		}
	});
})();
