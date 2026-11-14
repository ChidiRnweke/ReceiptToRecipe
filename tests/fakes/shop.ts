import { ReceiptController } from '../../src/lib/controllers/ReceiptController';
import { ShopController } from '../../src/lib/controllers/ShopController';
import { HabitService } from '../../src/lib/services/HabitService';
import { KitchenService } from '../../src/lib/services/KitchenService';
import { NormalizationService } from '../../src/lib/services/NormalizationService';
import { PlanService } from '../../src/lib/services/PlanService';
import { ShopService } from '../../src/lib/services/ShopService';
import type { Actor } from '../../src/lib/models/household';
import type { MealType } from '../../src/lib/models/plan';
import { atLocalHour } from '../../src/lib/services/kitchen';
import {
	MockJobQueue,
	MockPantryService,
	MockProductNormalizer,
	MockPurchaseHistoryRepository,
	MockReceiptExtractor,
	MockReceiptItemRepository,
	MockReceiptRepository,
	MockRecipeIngredientRepository,
	MockRecipeRepository,
	MockSavedRecipeRepository,
	MockShoppingListItemRepository,
	MockShoppingListRepository,
	MockStorageService
} from '../mocks';
import { InMemoryHabitAnswerRepository } from './InMemoryHabitAnswerRepository';
import { InMemoryHouseholdRepository } from './InMemoryHouseholdRepository';
import { InMemoryKitchenEventRepository } from './InMemoryKitchenEventRepository';
import { InMemoryMealLogRepository } from './InMemoryMealLogRepository';
import { InMemoryPlannedMealRepository } from './InMemoryPlannedMealRepository';

export const shopper: Actor = {
	userId: 'user-1',
	householdId: 'household-1',
	memberId: 'member-1',
	displayName: 'Noor Haddad',
	roles: { plans: true, shops: true, cooks: true }
};

export const stranger: Actor = {
	userId: 'user-9',
	householdId: 'household-9',
	memberId: 'member-9',
	displayName: 'Someone Else',
	roles: { plans: true, shops: true, cooks: true }
};

export interface IngredientSpec {
	name: string;
	quantity: number;
	unit: string;
}

/**
 * The Shop door over in-memory stores: the real plan, kitchen, habit and shop services, and the
 * real receipt controller with its OCR job run at once by the job queue.
 */
export function createShop() {
	const events = new InMemoryKitchenEventRepository();
	const recipes = new MockRecipeRepository();
	const ingredients = new MockRecipeIngredientRepository();
	recipes.setIngredientRepository(ingredients);
	const plannedMeals = new InMemoryPlannedMealRepository();
	const lists = new MockShoppingListRepository();
	const items = new MockShoppingListItemRepository();
	lists.setItemRepository(items);
	const history = new MockPurchaseHistoryRepository();
	const receipts = new MockReceiptRepository();
	const receiptItems = new MockReceiptItemRepository();
	receipts.setItemRepository(receiptItems);
	const extractor = new MockReceiptExtractor();
	const households = new InMemoryHouseholdRepository();
	const storage = new MockStorageService();

	const plan = new PlanService(
		plannedMeals,
		recipes,
		ingredients,
		new MockSavedRecipeRepository(),
		events
	);
	const kitchen = new KitchenService(
		events,
		recipes,
		ingredients,
		plannedMeals,
		new InMemoryMealLogRepository()
	);
	const habits = new HabitService(
		events,
		new InMemoryHabitAnswerRepository(),
		plannedMeals,
		history,
		households
	);
	const receiptController = new ReceiptController(
		storage,
		extractor,
		new NormalizationService(),
		new MockProductNormalizer(),
		new MockPantryService(),
		receipts,
		receiptItems,
		history,
		kitchen,
		new MockJobQueue()
	);
	const shopService = new ShopService(lists, items, history);
	const controller = new ShopController(shopService, plan, kitchen, habits, receiptController);

	async function addRecipe(title: string, specs: IngredientSpec[]) {
		const recipe = await recipes.create({
			userId: shopper.userId,
			householdId: shopper.householdId,
			title,
			instructions: 'Cook.',
			servings: 2,
			estimatedCalories: 600
		});
		await ingredients.createMany(
			specs.map((spec, orderIndex) => ({
				recipeId: recipe.id,
				name: spec.name,
				quantity: String(spec.quantity),
				unit: spec.unit,
				unitType: 'WEIGHT' as const,
				orderIndex
			}))
		);
		return recipe;
	}

	function planOn(
		recipe: { id: string; title: string },
		day: number,
		mealType: MealType = 'DINNER'
	) {
		return plannedMeals.create({
			userId: shopper.userId,
			householdId: shopper.householdId,
			recipeId: recipe.id,
			mealName: recipe.title,
			plannedDate: atLocalHour(day, 12, 'UTC'),
			plannedCalories: 600,
			mealType
		});
	}

	/** Uploads a receipt whose OCR reads these lines; the job queue runs it at once. */
	async function snap(lines: { name: string; quantity: string }[]) {
		extractor.setDefaultData({
			items: lines.map((line) => ({ name: line.name, quantity: line.quantity, price: '1.00' })),
			storeName: 'Corner Shop',
			total: '5.00'
		});
		const file = new File([new Blob(['photo'], { type: 'image/jpeg' })], 'receipt.jpg', {
			type: 'image/jpeg'
		});
		const { receiptId } = await controller.snapReceipt(shopper, file);
		await new Promise((resolve) => setTimeout(resolve, 0));
		return receiptId;
	}

	return {
		events,
		households,
		kitchen,
		plannedMeals,
		items,
		receipts,
		storage,
		plan,
		shopService,
		receiptController,
		controller,
		addRecipe,
		planOn,
		snap
	};
}
