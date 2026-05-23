function renderFlags(str) {
	if (!str) return '';
	return str.replace(/([\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF])/g, (match) => {
		const c1 = match.charCodeAt(1) - 0xDDE6 + 97;
		const c2 = match.charCodeAt(3) - 0xDDE6 + 97;
		const cc = String.fromCharCode(c1) + String.fromCharCode(c2);
		return `<img src="https://flagcdn.com/w20/${cc}.png" alt="${match}" class="flag-icon" />`;
	});
}
console.log(renderFlags('🇧🇬 България · 🇩🇪 Germany'));
