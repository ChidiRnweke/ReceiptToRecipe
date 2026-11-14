/** The message of a failed remote call: an HttpError's body message, or a fallback. */
export function failureMessage(cause: unknown, fallback: string): string {
	if (typeof cause === 'object' && cause !== null && 'body' in cause) {
		const body = (cause as { body?: { message?: unknown } }).body;
		if (typeof body?.message === 'string' && body.message.length > 0) return body.message;
	}
	return fallback;
}
