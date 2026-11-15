import type { INeedsYouAnswerRepository } from '$repositories';
import type { Actor } from '$lib/models/household';
import type { INeedsYouService } from './interfaces/INeedsYouService';

export class NeedsYouService implements INeedsYouService {
	constructor(private needsYouAnswerRepository: INeedsYouAnswerRepository) {}

	async answeredKeys(actor: Actor): Promise<Set<string>> {
		return new Set(await this.needsYouAnswerRepository.listKeys(actor.householdId, actor.userId));
	}

	async recordAnswer(actor: Actor, key: string, answer: string, at: Date): Promise<void> {
		await this.needsYouAnswerRepository.save({
			householdId: actor.householdId,
			userId: actor.userId,
			key,
			answer,
			answeredAt: at
		});
	}
}
