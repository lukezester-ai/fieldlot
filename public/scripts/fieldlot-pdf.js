/**
 * Fieldlot — PDF за демо оферта (кирилица via Noto).
 */
(function initFieldlotPdf(global) {
	let pdfLibPromise = null;
	let fontBytesPromise = null;

	function loadPdfLib() {
		if (!pdfLibPromise) {
			pdfLibPromise = import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
		}
		return pdfLibPromise;
	}

	function isValidFontBuffer(buf) {
		if (!buf || buf.byteLength < 1000) return false;
		const u8 = new Uint8Array(buf);
		if (u8[0] === 0x3c) return false;
		return u8[0] === 0x00 && u8[1] === 0x01 && u8[2] === 0x00 && u8[3] === 0x00;
	}

	async function loadFontBytes() {
		if (fontBytesPromise) return fontBytesPromise;
		fontBytesPromise = (async () => {
			const urls = [
				'/fonts/NotoSans-Regular.ttf',
				'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
			];
			for (const url of urls) {
				try {
					const res = await fetch(url);
					if (!res.ok) continue;
					const buf = await res.arrayBuffer();
					if (isValidFontBuffer(buf)) return buf;
				} catch {
					/* next */
				}
			}
			throw new Error('font_load_failed');
		})();
		return fontBytesPromise;
	}

	function downloadBytes(data, filename) {
		const copy = Uint8Array.from(data);
		const blob = new Blob([copy], { type: 'application/pdf' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.rel = 'noopener';
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 2000);
	}

	function wrapLines(text, font, size, maxWidth) {
		const words = String(text).split(/\s+/).filter(Boolean);
		const lines = [];
		let line = '';
		for (const w of words) {
			const test = line ? `${line} ${w}` : w;
			if (font.widthOfTextAtSize(test, size) <= maxWidth) {
				line = test;
			} else {
				if (line) lines.push(line);
				line = w;
			}
		}
		if (line) lines.push(line);
		return lines.length ? lines : ['—'];
	}

	/**
	 * @param {Record<string, unknown>} item listing fields
	 */
	async function buildListingPdf(item) {
		const { PDFDocument, rgb } = await loadPdfLib();
		const fontBytes = await loadFontBytes();
		const doc = await PDFDocument.create();
		const font = await doc.embedFont(fontBytes);
		const page = doc.addPage([595.28, 841.89]);
		const margin = 48;
		let y = 800;
		const lineH = 16;
		const maxW = 500;

		const draw = (text, size, bold) => {
			const lines = wrapLines(text, font, size, maxW);
			for (const ln of lines) {
				if (y < 60) break;
				page.drawText(ln, {
					x: margin,
					y,
					size,
					font,
					color: bold ? rgb(0.1, 0.3, 0.22) : rgb(0.15, 0.15, 0.15),
				});
				y -= lineH + (size > 12 ? 4 : 0);
			}
		};

		draw('FIELDLOT · демо оферта', 11, false);
		y -= 8;
		draw(String(item.title || 'Оферта'), 20, true);
		y -= 6;
		draw(`${item.subtitle || ''} · ${item.qty || ''}`, 12, false);
		y -= 10;
		draw(`Цена: ${item.price || '—'} ${item.priceUnit || ''}`, 13, true);
		draw(`Условие: ${item.incoterm || '—'}`, 12, false);
		draw(`Реколта: ${item.harvest || '—'}`, 12, false);
		y -= 6;
		draw(`Качество: ${item.quality || '—'}`, 12, false);
		draw(`Контакт: ${item.contact || '—'}`, 12, false);
		y -= 12;
		draw(
			'Демо документ · не е договор. За запитване: fieldlot-two.vercel.app',
			10,
			false,
		);

		return doc.save();
	}

	async function downloadListing(item) {
		const id = String(item.id || 'offer').replace(/[^\w-]+/g, '-');
		const bytes = await buildListingPdf(item);
		downloadBytes(bytes, `fieldlot-${id}.pdf`);
	}

	global.FieldlotPdf = { downloadListing, buildListingPdf };
})(window);
