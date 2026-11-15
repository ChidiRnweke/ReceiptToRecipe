import { NeedsYouController } from '../../src/lib/controllers/NeedsYouController';
import { UseItUpController } from '../../src/lib/controllers/UseItUpController';
import { HouseholdEventService } from '../../src/lib/services/HouseholdEventService';
import { HouseholdService } from '../../src/lib/services/HouseholdService';
import { NeedsYouService } from '../../src/lib/services/NeedsYouService';
import { createShop, shopper } from './shop';
import { InMemoryNeedsYouAnswerRepository } from './InMemoryNeedsYouAnswerRepository';

/**
 * The Use it up and Needs you controllers over the same in-memory stores as the Shop door, so
 * "Got everything" from Needs you runs the Shop door's own command.
 */
export function createNeedsYou() {
	const shop = createShop();
	const answers = new InMemoryNeedsYouAnswerRepository();
	const householdEventService = new HouseholdEventService(shop.householdEvents);
	const needsYou = new NeedsYouController(
		shop.kitchen,
		shop.habits,
		shop.plan,
		new HouseholdService(shop.households),
		householdEventService,
		new NeedsYouService(answers),
		shop.shopService,
		shop.controller
	);
	const useItUp = new UseItUpController(shop.kitchen, shop.plan);

	/** Puts the shopper in a household of its own, as `resolveActor` would. */
	async function seatShopper(displayName = 'Noor Haddad') {
		return shop.households.createMember({
			householdId: shopper.householdId,
			userId: shopper.userId,
			displayName
		});
	}

	return { ...shop, answers, householdEventService, needsYou, useItUp, seatShopper };
}
