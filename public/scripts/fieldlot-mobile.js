/**
 * Fieldlot — мобилно меню и UX на телефон
 */
(function initFieldlotMobile() {
	function bindMenu(toggleId, panelSelector) {
		const btn = document.getElementById(toggleId);
		const panel = document.querySelector(panelSelector);
		if (!btn || !panel) return;

		const close = () => {
			panel.classList.remove('is-open');
			btn.setAttribute('aria-expanded', 'false');
			document.body.classList.remove('nav-open');
		};

		btn.addEventListener('click', () => {
			const open = !panel.classList.contains('is-open');
			if (open) {
				panel.classList.add('is-open');
				btn.setAttribute('aria-expanded', 'true');
				document.body.classList.add('nav-open');
			} else {
				close();
			}
		});

		panel.querySelectorAll('a').forEach((link) => {
			link.addEventListener('click', () => close());
		});

		window.addEventListener('resize', () => {
			if (window.innerWidth > 900) close();
		});
	}

	bindMenu('header-menu-toggle', '#site-header-nav');
	bindMenu('catalog-menu-toggle', '.site-header .nav-links');
})();
