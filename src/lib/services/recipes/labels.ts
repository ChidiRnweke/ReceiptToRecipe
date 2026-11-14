import type { MyRecipeRow, RecipeSource } from '$lib/models/recipes';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function localDay(date: Date): number {
	return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

/** "made today", "made yesterday", "made Mon" within the last week, then "made before". */
export function madeLabel(madeAt: Date, now: Date): string {
	const daysAgo = localDay(now) - localDay(madeAt);
	if (daysAgo <= 0) return 'made today';
	if (daysAgo === 1) return 'made yesterday';
	if (daysAgo < 7) return `made ${WEEKDAYS[madeAt.getDay()]}`;
	return 'made before';
}

/** Where a recipe came from, in the door's words. */
export function sourceLabel(source: RecipeSource): string {
	switch (source) {
		case 'GENERATED':
			return 'made up for you';
		case 'SNAPPED':
			return 'from your photo';
		case 'RAG':
			return 'from the cookbook';
		case 'USER':
			return 'written by you';
	}
}

/** The meta line under a recipe row, e.g. "made Mon · 35 min" or "from your photo". */
export function recipeMeta(
	row: Pick<MyRecipeRow, 'madeAt' | 'source' | 'totalMinutes'>,
	now: Date
): string {
	const origin = row.madeAt ? madeLabel(row.madeAt, now) : sourceLabel(row.source);
	return row.totalMinutes ? `${origin} · ${row.totalMinutes} min` : origin;
}

/** "spinach", "spinach and feta", "spinach, feta and eggs". */
export function listNames(names: string[]): string {
	if (names.length <= 1) return names.join('');
	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
