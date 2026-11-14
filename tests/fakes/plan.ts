import { PlanController } from '../../src/lib/controllers/PlanController';
import type { Actor } from '../../src/lib/models/household';
import type { RecipeMaker } from '../../src/lib/services/interfaces/IPlanService';
import { actor, createTonight } from './tonight';

/** Records what it was asked to make; makes nothing. */
export class RecordingRecipeMaker implements RecipeMaker {
	made: { ingredients: string[]; hint: string }[] = [];

	async makeRecipe(_actor: Actor, ingredients: string[], hint: string): Promise<void> {
		this.made.push({ ingredients, hint });
	}
}

/** The services behind the Plan door over in-memory stores, and its controller. */
export function createPlan() {
	const maker = new RecordingRecipeMaker();
	const t = createTonight(maker);
	const planController = new PlanController(t.plan, t.kitchen, t.habits, t.nutrition);

	/** Adds a second member to the actor's household. */
	async function addMember(userId: string, displayName: string) {
		return t.households.createMember({ householdId: actor.householdId, userId, displayName });
	}

	return { ...t, maker, planController, addMember };
}
