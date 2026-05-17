import fs from 'node:fs';

const p = 'catalog.html';
let h = fs.readFileSync(p, 'utf8');

const start = h.indexOf('\t<script src="/scripts/fieldlot-api-status.js"></script>');
const end = h.indexOf('\t<script src="/scripts/fieldlot-mobile.js"></script>');
const replacement = `\t<script src="/scripts/fieldlot-i18n-messages.js"></script>
\t<script src="/scripts/fieldlot-i18n.js"></script>
\t<script src="/scripts/fieldlot-api-status.js"></script>
\t<script src="/scripts/fieldlot-images.js"></script>
\t<script src="/scripts/fieldlot-pdf.js" type="module"></script>
\t<script src="/scripts/catalog-page.js"></script>
\t`;
h = h.slice(0, start) + replacement + h.slice(end);

h = h.replace(
	'<strong>Жълти страници · демо</strong> — обявите са в жълт стил като класическия каталог. Реалните оферти идват след старт на платформата.',
	'<strong>Жив каталог</strong> — обяви от borsaagro.com, сортирани по дата. Снимките са по култура; оригиналът е на източника.',
);
h = h.replace(
	'Прегледай демо партиди по култура, регион и тип (продажба или търсене). Филтрирай и отвори детайли — в пълната версия тук ще изпращаш директно запитване.',
	'Прегледай реални обяви по култура, регион и тип (продажба или търсене). Филтрирай, отвори детайли и виж линк към оригинала.',
);
h = h.replace('Сортиране: най-нови (демо)', 'Сортиране: най-нови');
h = h.replace('© Fieldlot · Демо каталог', '© Fieldlot · Каталог');
h = h.replace('Демо каталог с агро оферти', 'Каталог с агро обяви от borsaagro.com');

if (!h.includes('id="detail-pdf"')) {
	h = h.replace(
		'<button type="button" class="btn btn-secondary" id="detail-close-2"',
		'<button type="button" class="btn btn-secondary" id="detail-pdf" data-i18n="catalog.downloadPdf">Изтегли PDF</button>\n\t\t\t<button type="button" class="btn btn-secondary" id="detail-close-2"',
	);
}

fs.writeFileSync(p, h);
console.log('[patch-catalog-live] done');
