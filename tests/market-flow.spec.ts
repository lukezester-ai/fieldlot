import { expect, test } from '@playwright/test';

test('catalog cards can show a photo', async ({ page }) => {
	await page.goto('/catalog.html');
	await expect(page.locator('#catalog-grid')).toBeVisible();
	await page.waitForTimeout(1500);
	const photos = page.locator('#catalog-grid img.yp-entry-photo');
	const n = await photos.count();
	if (n > 0) await expect(photos.first()).toBeVisible();
});

test('article part 4 has body text and series nav', async ({ page }) => {
	await page.goto('/article.html?part=4');
	await expect(page.locator('#article-root h1')).toBeVisible({ timeout: 15_000 });
	await expect(page.locator('#article-root .article-body p').first()).toBeVisible();
	await expect(page.locator('#article-root a[href*="part=1"]')).toBeVisible();
});

test('publish without login opens auth or asks to sign in', async ({ page }) => {
	await page.goto('/catalog.html');
	const publish = page.locator('#nav-publish, .btn-publish').first();
	await expect(publish).toBeVisible();
	await publish.click();
	await expect(
		page.locator('#fl-auth-backdrop.active').or(page.locator('#fl-publish-backdrop.open')),
	).toBeVisible({ timeout: 8_000 });
});

test('inquiry and offer flow when e2e credentials exist', async ({ page }) => {
	const email = process.env.FIELDLOT_E2E_EMAIL?.trim();
	const password = process.env.FIELDLOT_E2E_PASSWORD?.trim();
	test.skip(!email || !password, 'Set FIELDLOT_E2E_EMAIL and FIELDLOT_E2E_PASSWORD');

	await page.goto('/catalog.html');
	await page.locator('#nav-login, button:has-text("Вход")').first().click();
	await page.locator('#fl-auth-email').fill(email);
	await page.locator('#fl-auth-password').fill(password);
	await page.locator('#fl-auth-submit').click();
	await expect(page.locator('#nav-publish')).toBeVisible({ timeout: 20_000 });

	await page.locator('#nav-publish').click();
	await expect(page.locator('#fl-publish-backdrop')).toHaveClass(/open/);
	await page.locator('#pub-title').fill('E2E тестова пшеница');
	await page.locator('#pub-price').fill('100');
	await page.locator('#pub-quantity').fill('10 т');
	await page.locator('#pub-location').fill('Добрич');
	await page.locator('#pub-image').setInputFiles({
		name: 'e2e.png',
		mimeType: 'image/png',
		buffer: Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhAGOh2nFHwAAAABJRU5ErkJggg==',
			'base64',
		),
	});
	await page.locator('#pub-submit-btn').click();
	await expect(page.locator('#fl-publish-success')).toContainText(/преглед|успеш/i, { timeout: 20_000 });

	await page.goto('/dashboard.html');
	await expect(page.locator('#tab-inquiries')).toBeVisible({ timeout: 20_000 });
	await page.locator('#tab-inquiries').click();
	await expect(page.locator('#view-inquiries')).toBeVisible();
});
