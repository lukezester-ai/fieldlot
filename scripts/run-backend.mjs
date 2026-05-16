import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendDir = path.join(root, 'backend');
const port = process.env.FIELDLOT_BACKEND_PORT || '8000';

const seedOnly = process.argv.includes('--seed-only');

if (seedOnly) {
	const p = spawn('python', ['-c', 'from app.seed import seed_if_empty; from app.database import init_db; init_db(); seed_if_empty()'], {
		cwd: backendDir,
		stdio: 'inherit',
		shell: true,
	});
	p.on('exit', (code) => process.exit(code ?? 1));
} else {
	const p = spawn(
		'python',
		['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', String(port)],
		{ cwd: backendDir, stdio: 'inherit', shell: true },
	);
	p.on('exit', (code) => process.exit(code ?? 1));
}
