import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests',
	timeout: 30_000,
	use: {
		baseURL: 'http://127.0.0.1:5174',
		trace: 'on-first-retry',
	},
	webServer: {
		command: 'npm run preview',
		url: 'http://127.0.0.1:5174',
		reuseExistingServer: true,
		timeout: 120_000,
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
