import { timingSafeEqual } from 'node:crypto';

/** Compare UTF-8 strings in constant time when lengths match. */
export function timingSafeStringEqual(left: string, right: string): boolean {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);
	if (leftBuffer.length !== rightBuffer.length) return false;
	return timingSafeEqual(leftBuffer, rightBuffer);
}
