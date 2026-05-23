import fs from 'node:fs/promises';
import path from 'node:path';

export type ChatCompletionMessage = {
	role: string;
	content?: string | null;
	tool_calls?: any[];
	tool_call_id?: string;
};

const MEMORY_DIR = path.join(process.cwd(), '.local');
const MEMORY_FILE = path.join(MEMORY_DIR, 'chat-memory.json');

type SessionMemory = {
	[sessionId: string]: ChatCompletionMessage[];
};

async function ensureMemoryFile() {
	try {
		await fs.mkdir(MEMORY_DIR, { recursive: true });
		try {
			await fs.access(MEMORY_FILE);
		} catch {
			await fs.writeFile(MEMORY_FILE, JSON.stringify({}), 'utf-8');
		}
	} catch (err) {
		console.error('Error initializing memory file:', err);
	}
}

export async function loadMemory(sessionId: string): Promise<ChatCompletionMessage[]> {
	await ensureMemoryFile();
	try {
		const data = await fs.readFile(MEMORY_FILE, 'utf-8');
		const memory = JSON.parse(data) as SessionMemory;
		return memory[sessionId] || [];
	} catch (err) {
		console.error('Failed to load memory:', err);
		return [];
	}
}

export async function saveMemory(sessionId: string, messages: ChatCompletionMessage[]): Promise<void> {
	await ensureMemoryFile();
	try {
		const data = await fs.readFile(MEMORY_FILE, 'utf-8');
		const memory = JSON.parse(data) as SessionMemory;
		
		// keep only last 20 messages to avoid overflow
		memory[sessionId] = messages.slice(-20);
		
		await fs.writeFile(MEMORY_FILE, JSON.stringify(memory, null, 2), 'utf-8');
	} catch (err) {
		console.error('Failed to save memory:', err);
	}
}
