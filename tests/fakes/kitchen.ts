import { KitchenService } from '../../src/lib/services/KitchenService';
import { MockRecipeIngredientRepository, MockRecipeRepository } from '../mocks';
import { InMemoryHouseholdRepository } from './InMemoryHouseholdRepository';
import { InMemoryKitchenEventRepository } from './InMemoryKitchenEventRepository';
import { InMemoryMealLogRepository } from './InMemoryMealLogRepository';
import { InMemoryPlannedMealRepository } from './InMemoryPlannedMealRepository';

/** A real KitchenService over in-memory stores, for tests of the flows that record events. */
export function createKitchen() {
	const events = new InMemoryKitchenEventRepository();
	const recipes = new MockRecipeRepository();
	const ingredients = new MockRecipeIngredientRepository();
	const plannedMeals = new InMemoryPlannedMealRepository();
	const mealLogs = new InMemoryMealLogRepository();
	const households = new InMemoryHouseholdRepository();
	const service = new KitchenService(
		events,
		recipes,
		ingredients,
		plannedMeals,
		mealLogs,
		households
	);
	return { service, events, recipes, ingredients, plannedMeals, mealLogs, households };
}
