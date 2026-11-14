export interface MarkedPart {
	text: string;
	marked: boolean;
}

/**
 * Splits a heading such as "What's for *dinner*?" into plain and marked parts.
 * A lone asterisk without a partner stays as text.
 */
export function splitMarked(source: string): MarkedPart[] {
	const parts: MarkedPart[] = [];
	const pattern = /\*([^*]+)\*/g;
	let cursor = 0;
	for (const match of source.matchAll(pattern)) {
		if (match.index > cursor)
			parts.push({ text: source.slice(cursor, match.index), marked: false });
		parts.push({ text: match[1], marked: true });
		cursor = match.index + match[0].length;
	}
	if (cursor < source.length) parts.push({ text: source.slice(cursor), marked: false });
	return parts;
}
