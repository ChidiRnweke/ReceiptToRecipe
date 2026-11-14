import { TonightController } from '../../src/lib/controllers/TonightController';
import { HabitService } from '../../src/lib/services/HabitService';
import { KitchenService } from '../../src/lib/services/KitchenService';
import { NutritionService } from '../../src/lib/services/NutritionService';
import { PlanService } from '../../src/lib/services/PlanService';
import type { Actor } from '../../src/lib/models/household';
import type { MealType } from '../../src/lib/models/plan';
import { atLocalHour } from '../../src/lib/services/kitchen';
import {
	MockPurchaseHistoryRepository,
	MockRecipeIngredientRepository,
	MockRecipeRepository,
	MockSavedRecipeRepository,
	MockTasteProfileService,
	MockUserPreferencesRepository
} from '../mocks';
import type { RecipeMaker } from '../../src/lib/services/interfaces/IPlanService';
import { InMemoryHabitAnswerRepository } from './InMemoryHabitAnswerRepository';
import { InMemoryHouseholdRepository } from './InMemoryHouseholdRepository';
import { InMemoryKitchenEventRepository } from './InMemoryKitchenEventRepository';
import { InMemoryMealLogRepository } from './InMemoryMealLogRepository';
import { InMemoryPlannedMealRepository } from './InMemoryPlannedMealRepository';

export const actor: Actor = {
	userId: 'user-1',
	householdId: 'household-1',
	memberId: 'member-1',
	displayName: 'Noor Haddad',
	timeZone: 'UTC',
	roles: { plans: true, shops: true, cooks: true }
};

export interface IngredientSpec {
	name: string;
	quantity: number;
	unit: string;
}

/** The plan, kitchen, habit and nutrition services over in-memory stores, and the controller. */
export function createTonight(recipeMaker: RecipeMaker | null = null) {
	const events = new InMemoryKitchenEventRepository();
	const recipes = new MockRecipeRepository();
	const ingredients = new MockRecipeIngredientRepository();
	recipes.setIngredientRepository(ingredients);
	const saved = new MockSavedRecipeRepository();
	const plannedMeals = new InMemoryPlannedMealRepository();
	const mealLogs = new InMemoryMealLogRepository();
	const preferences = new MockUserPreferencesRepository();

	const households = new InMemoryHouseholdRepository();
	const taste = new MockTasteProfileService();
	const plan = new PlanService(
		plannedMeals,
		recipes,
		ingredients,
		saved,
		events,
		households,
		taste,
		recipeMaker
	);
	const kitchen = new KitchenService(
		events,
		recipes,
		ingredients,
		plannedMeals,
		mealLogs,
		households
	);
	const habits = new HabitService(
		events,
		new InMemoryHabitAnswerRepository(),
		plannedMeals,
		new MockPurchaseHistoryRepository(),
		households
	);
	const nutrition = new NutritionService(mealLogs, plannedMeals, preferences);
	const controller = new TonightController(plan, kitchen, habits, nutrition);

	async function addRecipe(
		title: string,
		items: IngredientSpec[],
		householdId = actor.householdId
	) {
		const recipe = await recipes.create({
			userId: actor.userId,
			householdId,
			title,
			instructions: 'Chop.\nCook.',
			servings: 2,
			estimatedCalories: 600
		});
		await ingredients.createMany(
			items.map((item, orderIndex) => ({
				recipeId: recipe.id,
				name: item.name,
				quantity: String(item.quantity),
				unit: item.unit,
				unitType: 'WEIGHT' as const,
				orderIndex
			}))
		);
		return recipe;
	}

	function planOn(
		recipe: { id: string; title: string },
		day: number,
		mealType: MealType = 'DINNER',
		timeZone = 'UTC'
	) {
		return plannedMeals.create({
			userId: actor.userId,
			householdId: actor.householdId,
			recipeId: recipe.id,
			mealName: recipe.title,
			plannedDate: atLocalHour(day, 12, timeZone),
			plannedCalories: 600,
			mealType
		});
	}

	return {
		events,
		recipes,
		plannedMeals,
		mealLogs,
		preferences,
		households,
		taste,
		habits,
		nutrition,
		plan,
		kitchen,
		controller,
		addRecipe,
		planOn
	};
}
