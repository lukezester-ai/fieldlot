/**
 * Форма „ранен достъп“ — offline-aware за Lovable / static preview.
 */
(function initFieldlotLeadForm() {
	const form = document.getElementById('lead-form');
	const submit = document.getElementById('lead-submit');
	const status = document.getElementById('lead-status');
	if (!form || !submit || !status) return;

	const PHONE_OK = /^\+[1-9]\d{7,14}$/;
	const openedAt = Date.now();
	let formReady = false;
	let apiOnline = false;

	const errMap = {
		'Too fast': 'Изчакай 2 секунди.',
		'Too many requests': 'Твърде много заявки.',
		'Valid business email required': 'Невалиден имейл.',
		'Valid phone required': 'Телефон +359… или празно.',
	};

	function leadErr(e, h) {
		return (e && errMap[e]) || e || h || 'Грешка.';
	}

	function setOfflineUi() {
		apiOnline = false;
		status.className = 'form-status warn';
		status.textContent =
			'Offline — API не е достъпен в този преглед. Пиши на info@agrinexus.eu или пусни локално/Vercel.';
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

	if (window.__fieldlotApi?.checked) {
		if (window.__fieldlotApi.chat) setOnlineUi();
		else setOfflineUi();
	}

	submit.disabled = true;
	setTimeout(() => {
		formReady = true;
		submit.textContent = 'Изпрати заявка';
		upd();
	}, 2100);

	form.addEventListener('input', upd);

	form.addEventListener('submit', async (ev) => {
		ev.preventDefault();
		if (!apiOnline) {
			status.className = 'form-status warn';
			status.textContent =
				'Формата е offline в preview. Имейл: info@agrinexus.eu';
			return;
		}
		if (Date.now() - openedAt < 2000) {
			status.className = 'form-status err';
			status.textContent = 'Изчакай 2 сек.';
			return;
		}
		let phone = document.getElementById('phone').value.trim();
		if (phone) {
			phone = '+' + phone.replace(/\D/g, '');
			if (!PHONE_OK.test(phone)) {
				status.className = 'form-status err';
				status.textContent = errMap['Valid phone required'];
				return;
			}
		}
		status.textContent = 'Изпращане…';
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
				data.mailDelivery === 'sent' ? 'Готово — изпратихме известие.' : 'Заявката е записана.';
			form.reset();
		} catch (e) {
			status.className = 'form-status err';
			const msg = e instanceof Error ? e.message : 'Грешка.';
			if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
				status.className = 'form-status warn';
				status.textContent = 'Offline — API недостъпен. info@agrinexus.eu';
			} else {
				status.textContent = msg;
			}
		} finally {
			upd();
		}
	});
})();
