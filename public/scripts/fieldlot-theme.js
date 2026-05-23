(function() {
	function applyTheme(theme) {
		if (theme === 'dark') {
			document.documentElement.setAttribute('data-theme', 'dark');
		} else {
			document.documentElement.removeAttribute('data-theme');
		}
	}

	function getSavedTheme() {
		try {
			return localStorage.getItem('fieldlot-theme');
		} catch (e) {
			return null;
		}
	}

	function getPrefersDark() {
		return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
	}

	function initTheme() {
		const saved = getSavedTheme();
		if (saved === 'dark' || saved === 'light') {
			applyTheme(saved);
		} else if (getPrefersDark()) {
			applyTheme('dark');
		}
	}

	function toggleTheme() {
		const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
		const next = isDark ? 'light' : 'dark';
		applyTheme(next);
		try {
			localStorage.setItem('fieldlot-theme', next);
		} catch (e) {}
		
		// Dispatch event if other components need to react
		window.dispatchEvent(new CustomEvent('fieldlot-theme-change', { detail: { theme: next } }));
	}

	window.FieldlotTheme = {
		toggleTheme,
		initTheme
	};

	initTheme();
})();
