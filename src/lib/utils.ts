import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency = 'USD'): string {
	const value = typeof amount === 'string' ? parseFloat(amount) : amount;
	if (isNaN(value)) return '0.00';

	try {
		// Handle common currency codes that might come from OCR
		let currencyCode = currency;
		if (currency === '€') currencyCode = 'EUR';
		if (currency === '$') currencyCode = 'USD';
		if (currency === '£') currencyCode = 'GBP';

		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currencyCode
		}).format(value);
	} catch (e) {
		// Fallback if currency code is invalid
		return `${currency} ${value.toFixed(2)}`;
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
	ref?: U | null;
};

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * Returns the current meteorological season based on the month.
 * Northern-hemisphere conventions: spring=Mar–May, summer=Jun–Aug,
 * autumn=Sep–Nov, winter=Dec–Feb.
 */
export function getCurrentSeason(date: Date = new Date()): Season {
	const month = date.getMonth(); // 0-indexed
	if (month >= 2 && month <= 4) return 'spring';
	if (month >= 5 && month <= 7) return 'summer';
	if (month >= 8 && month <= 10) return 'autumn';
	return 'winter';
}
