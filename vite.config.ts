import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig, loadEnv } from 'vite';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export default defineConfig(({ mode }) => {
	const loaded = loadEnv(mode, process.cwd(), '');
	const raw = loaded.FIELDLOT_API_PORT || process.env.FIELDLOT_API_PORT || '8789';
	const n = Number(String(raw).trim());
	const apiPort = Number.isFinite(n) && n > 0 ? n : 8789;
	const backendPort = Number(loaded.FIELDLOT_BACKEND_PORT || process.env.FIELDLOT_BACKEND_PORT || '8000');

	return {
		root: '.',
		appType: 'mpa',
		build: {
			rollupOptions: {
				input: {
					main: path.resolve(process.cwd(), 'index.html'),
					catalog: path.resolve(process.cwd(), 'catalog.html'),
					dashboard: path.resolve(process.cwd(), 'dashboard.html'),
					admin: path.resolve(process.cwd(), 'admin.html'),
					logistics: path.resolve(process.cwd(), 'logistics.html'),
				},
			},
		},
		server: {
			port: 5174,
			strictPort: true,
			open: true,
			host: true,
			proxy: {
				'/api/v1': {
					target: `http://127.0.0.1:${backendPort}`,
					changeOrigin: true,
				},
				'/api': {
					target: `http://127.0.0.1:${apiPort}`,
					changeOrigin: true,
				},
			},
		},
		preview: {
			port: 5174,
			strictPort: true,
			host: true,
			proxy: {
				'/api/v1': {
					target: `http://127.0.0.1:${backendPort}`,
					changeOrigin: true,
				},
				'/api': {
					target: `http://127.0.0.1:${apiPort}`,
					changeOrigin: true,
				},
			},
		},
	};
});
