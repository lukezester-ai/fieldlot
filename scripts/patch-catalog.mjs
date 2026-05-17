import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const catalogPath = path.join(root, 'catalog.html');
let catalog = fs.readFileSync(catalogPath, 'utf8');

catalog = catalog.replace(
	/<button type="button" class="btn btn-secondary" id="detail-close-2" data-i18n="nav.close">Затвори<\/button>/,
	`<button type="button" class="btn btn-secondary" id="detail-pdf" data-i18n="catalog.downloadPdf">Изтегли PDF</button>
			<button type="button" class="btn btn-secondary" id="detail-close-2" data-i18n="nav.close">Затвори</button>`,
);

const start = catalog.indexOf('\t<script src="/scripts/fieldlot-api-status.js">');
const end = catalog.indexOf('\t<script src="/scripts/fieldlot-mobile.js">');
if (start >= 0 && end > start) {
	const block = `\t<script src="/scripts/fieldlot-i18n-messages.js"></script>
\t<script src="/scripts/fieldlot-i18n.js"></script>
\t<script src="/scripts/fieldlot-api-status.js"></script>
\t<script src="/scripts/fieldlot-images.js"></script>
\t<script src="/scripts/fieldlot-pdf.js"></script>
\t<script src="/scripts/catalog-page.js"></script>
`;
	catalog = catalog.slice(0, start) + block + catalog.slice(end);
}

fs.writeFileSync(catalogPath, catalog);
console.log('catalog patched');
