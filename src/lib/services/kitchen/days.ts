import type { Weekday } from '$lib/models/kitchen';

const DAY_MS = 24 * 60 * 60 * 1000;

interface LocalParts {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
	let formatter = formatters.get(timeZone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		});
		formatters.set(timeZone, formatter);
	}
	return formatter;
}

function localParts(date: Date, timeZone: string): LocalParts {
	const parts: Record<string, number> = {};
	for (const part of formatterFor(timeZone).formatToParts(date)) {
		if (part.type !== 'literal') parts[part.type] = Number(part.value);
	}
	return {
		year: parts.year,
		month: parts.month,
		day: parts.day,
		hour: parts.hour,
		minute: parts.minute
	};
}

/** The local calendar day of `date` in `timeZone`, counted from 1970-01-01. */
export function dayNumber(date: Date, timeZone: string): number {
	const { year, month, day } = localParts(date, timeZone);
	return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** The weekday of a day number: 0 = Monday … 6 = Sunday. 1970-01-01 was a Thursday. */
export function weekdayOfDay(day: number): Weekday {
	return ((((day + 3) % 7) + 7) % 7) as Weekday;
}

export function weekdayOf(date: Date, timeZone: string): Weekday {
	return weekdayOfDay(dayNumber(date, timeZone));
}

/** The local time of day in hours, e.g. 18.5 for 18:30. */
export function localHour(date: Date, timeZone: string): number {
	const { hour, minute } = localParts(date, timeZone);
	return hour + minute / 60;
}

/** The moment local day `day` reaches `hour` (e.g. 12 for noon) in `timeZone`. */
export function atLocalHour(day: number, hour: number, timeZone: string): Date {
	const target = day * DAY_MS + hour * 60 * 60 * 1000;
	let guess = target;
	// Two corrections settle any offset, including the hour a DST change moves.
	for (let i = 0; i < 2; i++) {
		const date = new Date(guess);
		const seen = dayNumber(date, timeZone) * DAY_MS + localHour(date, timeZone) * 60 * 60 * 1000;
		guess += target - seen;
	}
	return new Date(guess);
}
