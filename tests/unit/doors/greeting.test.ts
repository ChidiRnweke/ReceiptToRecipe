import { describe, it, expect } from 'vitest';
import { greetingFor } from '../../../src/lib/services/doors/greeting';

describe('greetingFor', () => {
	it('says good morning before noon', () => {
		expect(greetingFor(9, 'Noor')).toBe('Good morning, Noor');
	});

	it('says good afternoon from noon', () => {
		expect(greetingFor(12, 'Noor')).toBe('Good afternoon, Noor');
	});

	it('says good afternoon until five', () => {
		expect(greetingFor(16, 'Noor')).toBe('Good afternoon, Noor');
	});

	it('says good evening from five', () => {
		expect(greetingFor(17, 'Noor')).toBe('Good evening, Noor');
	});

	it('says good evening late at night', () => {
		expect(greetingFor(23, 'Sam')).toBe('Good evening, Sam');
	});
});
