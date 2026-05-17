const html = await (
	await fetch('https://borsaagro.com/potrebitelski-obqvi', {
		headers: { 'User-Agent': 'Fieldlot/1.0' },
	})
).text();

const cards = [
	...html.matchAll(
		/#(\d+)[\s\S]*?<h5 class="mb-2">[\s\S]*?>([^<]+)<\/a>[\s\S]*?fa-clock[\s\S]*?>([^<]+)<[\s\S]*?fw-semibold fs-5">\s*([\d.,]+)/gi,
	),
];
console.log(
	'cards',
	cards.map((m) => ({ id: m[1], title: m[2].trim(), date: m[3].trim(), price: m[4].trim() })),
);

for (const id of ['44', '62', '76', '81']) {
	const d = await (
		await fetch(`https://borsaagro.com/potrebitelski-obqvi/${id}`, {
			headers: { 'User-Agent': 'Fieldlot/1.0' },
		})
	).text();
	const kv = [...d.matchAll(/<td class="kv-k">([^<]+)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
		(x) => [x[1], x[2].replace(/<[^>]+>/g, '').trim()],
	);
	const h1 = d.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1];
	console.log(id, h1, kv);
}
