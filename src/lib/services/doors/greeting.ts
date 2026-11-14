/** "Good morning, Noor" for hours 0–11, afternoon for 12–16, evening from 17. */
export function greetingFor(hour: number, name: string): string {
	const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
	return `Good ${part}, ${name}`;
}
