import { expect, test } from '@playwright/test';

test('home shows catalog and article series', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('a[href="/catalog.html"], a[href="/catalog"]').first()).toBeVisible();
});

test('catalog page renders', async ({ page }) => {
	await page.goto('/catalog.html');
	await expect(page.locator('#catalog-grid')).toBeVisible();
});

test('logistics shows demo notice or listings', async ({ page }) => {
	await page.goto('/logistics.html');
	await expect(page.locator('#logistics-grid, #logistics-demo-banner').first()).toBeVisible();
});

test('article page loads wheat analysis', async ({ page }) => {
	await page.goto('/article.html?part=1');
	await expect(page.locator('#article-root h1')).toBeVisible({ timeout: 15_000 });
});

test('admin login field is visible text so autofill cannot hide a wrong token', async ({
	page,
}) => {
	await page.goto('/admin.html');
	const token = page.locator('#admin-token');
	await expect(token).toBeVisible();
	await expect(token).toHaveAttribute('type', 'text');
	await expect(token).toHaveAttribute('autocomplete', 'off');
});
