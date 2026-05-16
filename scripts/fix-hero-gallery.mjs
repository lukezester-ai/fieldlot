import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('public/scripts/ecosystem-home.js');
let s = fs.readFileSync(file, 'utf8');

const start = s.indexOf('\tfunction initHero()');
const end = s.indexOf('\n\tfunction initCategories()');
if (start < 0 || end < 0) {
	console.error('markers not found', start, end);
	process.exit(1);
}

const d = 'div';
const newFn = `
	function initHero() {
		if (!IMG) return;
		const bg = document.querySelector('.hero-eco-bg');
		if (bg && IMG.hero) {
			bg.style.setProperty('--hero-bg', \`url("\${IMG.hero}")\`);
			bg.style.backgroundImage = \`linear-gradient(105deg, rgba(15, 51, 38, 0.52) 0%, rgba(26, 77, 58, 0.38) 45%, rgba(15, 26, 20, 0.35) 100%), url("\${IMG.hero}")\`;
		}
		const gallery = document.getElementById('hero-gallery');
		const g = IMG.heroGallery;
		if (!gallery || !g?.fresh) return;
		const setSlot = (sel, src, alt) => {
			const slot = gallery.querySelector(sel);
			if (!slot || !src) return;
			slot.style.backgroundImage = \`url("\${src}")\`;
			slot.style.backgroundSize = 'cover';
			slot.style.backgroundPosition = 'center';
			slot.innerHTML = IMG.imgTag(src, alt, 'fl-photo');
		};
		gallery.innerHTML =
			'<${d} class="hero-gallery-main" data-fl-photo="fresh"></${d}>' +
			'<${d} class="hero-gallery-side">' +
			'<${d} data-fl-photo="tomatoes"></${d}>' +
			'<${d} data-fl-photo="farm"></${d}></${d}>';
		setSlot('[data-fl-photo="fresh"]', g.fresh, 'Свежа продукция');
		setSlot('[data-fl-photo="tomatoes"]', g.tomatoes, 'Домати');
		setSlot('[data-fl-photo="farm"]', g.farm, 'Стопанство');
	}`;

s = s.slice(0, start) + newFn + s.slice(end);
fs.writeFileSync(file, s);
console.log('replaced initHero');
