import type { Actor } from '$lib/models/household';

/** Which questions in "Needs you" a member has answered, so none is asked twice. */
export interface INeedsYouService {
	answeredKeys(actor: Actor): Promise<Set<string>>;
	recordAnswer(actor: Actor, key: string, answer: string, at: Date): Promise<void>;
}
