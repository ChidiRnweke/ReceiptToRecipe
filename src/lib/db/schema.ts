import {
	pgTable,
	uuid,
	text,
	timestamp,
	integer,
	decimal,
	boolean,
	jsonb,
	pgEnum,
	vector,
	index,
	unique,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const processingStatusEnum = pgEnum('processing_status', [
	'QUEUED',
	'PROCESSING',
	'DONE',
	'FAILED'
]);

export const recipeSourceEnum = pgEnum('recipe_source', ['GENERATED', 'RAG', 'USER']);

export const userRoleEnum = pgEnum('user_role', ['WAITING', 'USER', 'ADMIN']);

export const unitTypeEnum = pgEnum('unit_type', ['WEIGHT', 'VOLUME', 'COUNT']);

export const mealTypeEnum = pgEnum('meal_type', ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'PREP']);

export const plannedMealStatusEnum = pgEnum('planned_meal_status', [
	'PLANNED',
	'COOKED',
	'SKIPPED',
	'EATEN_OUT'
]);

export const kitchenEventKindEnum = pgEnum('kitchen_event_kind', [
	'BOUGHT',
	'COOKED',
	'CORRECTED_GONE',
	'CORRECTED_STILL_GOOD',
	'CORRECTED_QUANTITY',
	'SHOP_DONE'
]);

export const shopMethodEnum = pgEnum('shop_method', ['RECEIPT', 'TICK']);

// Users
export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	email: text('email').notNull().unique(),
	name: text('name').notNull(),
	role: userRoleEnum('role').notNull().default('WAITING'),
	avatarUrl: text('avatar_url'),
	authProvider: text('auth_provider').notNull().default('auth0'),
	authProviderId: text('auth_provider_id').unique(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Households: the shared kitchen that receipts, recipes, cupboard, plan and lists belong to
export const households = pgTable('households', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	timeZone: text('time_zone').notNull().default('Europe/Brussels'), // IANA zone for local days
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const householdMembers = pgTable(
	'household_members',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.unique()
			.references(() => users.id, { onDelete: 'cascade' }),
		displayName: text('display_name').notNull(),
		color: text('color'),
		plans: boolean('plans').notNull().default(true),
		shops: boolean('shops').notNull().default(true),
		cooks: boolean('cooks').notNull().default(true),
		joinedAt: timestamp('joined_at').notNull().defaultNow()
	},
	(t) => [index('household_members_household_id_idx').on(t.householdId)]
);

export const householdInvites = pgTable(
	'household_invites',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique(),
		createdBy: uuid('created_by')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at').notNull(),
		usedAt: timestamp('used_at'),
		usedBy: uuid('used_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').notNull().defaultNow()
	},
	(t) => [index('household_invites_household_id_idx').on(t.householdId)]
);

// Waitlist Users
export const waitlistUsers = pgTable('waitlist_users', {
	id: uuid('id').primaryKey().defaultRandom(),
	email: text('email').notNull().unique(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

// Sessions for mock auth
export const sessions = pgTable('sessions', {
	id: text('id').primaryKey(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at', {
		withTimezone: true,
		mode: 'date'
	}).notNull()
});

// User Preferences
export const userPreferences = pgTable('user_preferences', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.unique()
		.references(() => users.id, { onDelete: 'cascade' }),
	allergies: text('allergies').array().default([]),
	dietaryRestrictions: text('dietary_restrictions').array().default([]),
	cuisinePreferences: text('cuisine_preferences').array().default([]),
	excludedIngredients: text('excluded_ingredients').array().default([]),
	caloricGoal: integer('caloric_goal'),
	defaultServings: integer('default_servings').default(2),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Receipts
export const receipts = pgTable(
	'receipts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		imageUrl: text('image_url').notNull(),
		status: processingStatusEnum('status').notNull().default('QUEUED'),
		rawOcrData: jsonb('raw_ocr_data'),
		storeName: text('store_name'),
		purchaseDate: timestamp('purchase_date'),
		totalAmount: decimal('total_amount', { precision: 10, scale: 2 }),
		currency: text('currency').default('USD'),
		errorMessage: text('error_message'),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(t) => [index('receipts_household_id_idx').on(t.householdId)]
);

// Receipt Items (normalized)
export const receiptItems = pgTable('receipt_items', {
	id: uuid('id').primaryKey().defaultRandom(),
	receiptId: uuid('receipt_id')
		.notNull()
		.references(() => receipts.id, { onDelete: 'cascade' }),
	rawName: text('raw_name').notNull(),
	normalizedName: text('normalized_name').notNull(),
	quantity: decimal('quantity', { precision: 10, scale: 3 }).notNull(),
	unit: text('unit').notNull(), // Normalized: g, ml, count
	unitType: unitTypeEnum('unit_type').notNull(),
	price: decimal('price', { precision: 10, scale: 2 }),
	category: text('category'),
	productGroup: text('product_group'),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

// Recipes
export const recipes = pgTable(
	'recipes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		sourceReceiptId: uuid('source_receipt_id').references(() => receipts.id, {
			onDelete: 'set null'
		}),
		title: text('title').notNull(),
		description: text('description'),
		instructions: text('instructions').notNull(),
		servings: integer('servings').notNull().default(2),
		prepTime: integer('prep_time'), // in minutes
		cookTime: integer('cook_time'), // in minutes
		imageUrl: text('image_url'),
		imageStatus: processingStatusEnum('image_status').default('QUEUED'),
		source: recipeSourceEnum('source').notNull().default('GENERATED'),
		cuisineType: text('cuisine_type'),
		estimatedCalories: integer('estimated_calories'),
		isPublic: boolean('is_public').default(false),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(t) => [index('recipes_household_id_idx').on(t.householdId)]
);

// Recipe Ingredients
export const recipeIngredients = pgTable('recipe_ingredients', {
	id: uuid('id').primaryKey().defaultRandom(),
	recipeId: uuid('recipe_id')
		.notNull()
		.references(() => recipes.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	quantity: decimal('quantity', { precision: 10, scale: 3 }).notNull(),
	unit: text('unit').notNull(),
	unitType: unitTypeEnum('unit_type').notNull(),
	optional: boolean('optional').default(false),
	notes: text('notes'),
	orderIndex: integer('order_index').notNull().default(0)
});

// Shopping Lists
export const shoppingLists = pgTable(
	'shopping_lists',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		isActive: boolean('is_active').default(true),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(t) => [index('shopping_lists_household_id_idx').on(t.householdId)]
);

// Meal Logs (nutrition tracking)
export const mealLogs = pgTable('meal_logs', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	recipeId: uuid('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
	foodName: text('food_name').notNull(),
	calories: integer('calories').notNull(),
	consumedAt: timestamp('consumed_at').notNull().defaultNow(),
	mealType: mealTypeEnum('meal_type').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Planned Meals (meal planning link for nutrition)
export const plannedMeals = pgTable(
	'planned_meals',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		recipeId: uuid('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
		mealName: text('meal_name').notNull(),
		plannedDate: timestamp('planned_date').notNull(),
		plannedCalories: integer('planned_calories').notNull(),
		mealType: mealTypeEnum('meal_type').notNull(),
		status: plannedMealStatusEnum('status').notNull().default('PLANNED'),
		servings: integer('servings'),
		/** Portions cooked on top of the meal, eaten later as leftovers or prepped lunches. */
		extraPortions: integer('extra_portions').notNull().default(0),
		/** The meal this one is the leftover of: tomorrow's lunch from tonight's pot. */
		leftoverOfId: uuid('leftover_of_id').references((): AnyPgColumn => plannedMeals.id, {
			onDelete: 'set null'
		}),
		/** A batch-prep cooking session rather than a meal eaten then. */
		isPrep: boolean('is_prep').notNull().default(false),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(t) => [index('planned_meals_household_id_idx').on(t.householdId)]
);

// Shopping List Items
export const shoppingListItems = pgTable('shopping_list_items', {
	id: uuid('id').primaryKey().defaultRandom(),
	shoppingListId: uuid('shopping_list_id')
		.notNull()
		.references(() => shoppingLists.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	quantity: decimal('quantity', { precision: 10, scale: 3 }),
	unit: text('unit'),
	checked: boolean('checked').default(false),
	fromRecipeId: uuid('from_recipe_id').references(() => recipes.id, {
		onDelete: 'set null'
	}),
	notes: text('notes'),
	orderIndex: integer('order_index').notNull().default(0),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

// Purchase History (for smart suggestions)
export const purchaseHistory = pgTable(
	'purchase_history',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		itemName: text('item_name').notNull(), // normalized name
		lastPurchased: timestamp('last_purchased').notNull(),
		purchaseCount: integer('purchase_count').notNull().default(1),
		avgQuantity: decimal('avg_quantity', { precision: 10, scale: 3 }),
		avgFrequencyDays: integer('avg_frequency_days'),
		estimatedDepleteDate: timestamp('estimated_deplete_date'),
		// User override fields for cupboard
		userOverrideDate: timestamp('user_override_date'), // When user confirmed "I still have this"
		userShelfLifeDays: integer('user_shelf_life_days'), // Custom shelf life override
		userQuantityOverride: decimal('user_quantity_override', { precision: 10, scale: 3 }), // Corrected quantity
		isDepleted: boolean('is_depleted').notNull().default(false), // User marked as "used up"
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(t) => [index('purchase_history_household_id_idx').on(t.householdId)]
);

// Cupboard Items (manually added by user, not from receipts)
export const cupboardItems = pgTable(
	'cupboard_items',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		itemName: text('item_name').notNull(),
		quantity: decimal('quantity', { precision: 10, scale: 3 }),
		unit: text('unit'),
		category: text('category'),
		addedDate: timestamp('added_date').notNull().defaultNow(), // Acts as "purchase date" for confidence
		shelfLifeDays: integer('shelf_life_days'), // User-specified, null = system default
		isDepleted: boolean('is_depleted').notNull().default(false),
		notes: text('notes'),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(t) => [index('cupboard_items_household_id_idx').on(t.householdId)]
);

// Kitchen events: the append-only log of what was bought, cooked and corrected. The kitchen
// picture is projected from it.
export const kitchenEvents = pgTable(
	'kitchen_events',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
		occurredAt: timestamp('occurred_at').notNull(),
		kind: kitchenEventKindEnum('kind').notNull(),
		itemKey: text('item_key'), // lower-case normalized name; null for SHOP_DONE and COOKED
		quantity: decimal('quantity', { precision: 10, scale: 3 }),
		unit: text('unit'),
		expiresAt: timestamp('expires_at'),
		known: boolean('known').notNull().default(true),
		portions: integer('portions'),
		receiptItemId: uuid('receipt_item_id').references(() => receiptItems.id, {
			onDelete: 'set null'
		}),
		plannedMealId: uuid('planned_meal_id').references(() => plannedMeals.id, {
			onDelete: 'set null'
		}),
		recipeId: uuid('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
		// The cupboard row an event was written for, so deleting the row can take back its purchase.
		cupboardItemId: uuid('cupboard_item_id').references(() => cupboardItems.id, {
			onDelete: 'set null'
		}),
		method: shopMethodEnum('method'),
		payload: jsonb('payload'),
		createdAt: timestamp('created_at').notNull().defaultNow()
	},
	(t) => [index('kitchen_events_household_occurred_idx').on(t.householdId, t.occurredAt)]
);

// Answers to habit offers ("You seem to shop on Thursdays"), so an offer is asked once.
export const householdHabitAnswers = pgTable(
	'household_habit_answers',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		key: text('key').notNull(), // e.g. shopDay:4
		answer: text('answer').notNull(), // 'accepted' | 'declined'
		answeredBy: uuid('answered_by').references(() => users.id, { onDelete: 'set null' }),
		answeredAt: timestamp('answered_at').notNull().defaultNow()
	},
	(t) => [unique('household_habit_answers_household_key_unique').on(t.householdId, t.key)]
);

// Category Shelf Life (for stock estimation)
export const categoryShelfLife = pgTable('category_shelf_life', {
	id: uuid('id').primaryKey().defaultRandom(),
	category: text('category').notNull().unique(),
	shelfLifeDays: integer('shelf_life_days').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Cookbook Embeddings (for RAG)
export const cookbookEmbeddings = pgTable('cookbook_embeddings', {
	id: uuid('id').primaryKey().defaultRandom(),
	recipeTitle: text('recipe_title').notNull(),
	contentChunk: text('content_chunk').notNull(),
	embedding: vector('embedding', { dimensions: 768 }), // Gemini text-embedding-004 dimensions
	metadata: jsonb('metadata'),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

// Saved/Favorited Recipes (Social feature)
export const savedRecipes = pgTable('saved_recipes', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	recipeId: uuid('recipe_id')
		.notNull()
		.references(() => recipes.id, { onDelete: 'cascade' }),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

// Taste Profile Tables

export const userDietaryProfiles = pgTable('user_dietary_profiles', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.unique()
		.references(() => users.id, { onDelete: 'cascade' }),
	dietType: text('diet_type'), // 'omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo'
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const userAllergies = pgTable(
	'user_allergies',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		allergen: text('allergen').notNull(),
		severity: text('severity').default('avoid'), // 'avoid', 'severe'
		createdAt: timestamp('created_at').notNull().defaultNow()
	},
	(t) => ({
		uniqueUserAllergen: {
			columns: [t.userId, t.allergen]
		}
	})
);

export const userIngredientPreferences = pgTable(
	'user_ingredient_preferences',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		ingredientName: text('ingredient_name').notNull(),
		preference: text('preference').notNull(), // 'love', 'like', 'neutral', 'dislike', 'avoid'
		createdAt: timestamp('created_at').notNull().defaultNow()
	},
	(t) => ({
		uniqueUserIngredient: {
			columns: [t.userId, t.ingredientName]
		}
	})
);

export const userCuisinePreferences = pgTable(
	'user_cuisine_preferences',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		cuisineType: text('cuisine_type').notNull(),
		preference: text('preference').notNull(), // 'love', 'like', 'neutral', 'dislike'
		createdAt: timestamp('created_at').notNull().defaultNow()
	},
	(t) => ({
		uniqueUserCuisine: {
			columns: [t.userId, t.cuisineType]
		}
	})
);

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
	preferences: one(userPreferences, {
		fields: [users.id],
		references: [userPreferences.userId]
	}),
	dietaryProfile: one(userDietaryProfiles, {
		fields: [users.id],
		references: [userDietaryProfiles.userId]
	}),
	allergies: many(userAllergies),
	ingredientPreferences: many(userIngredientPreferences),
	cuisinePreferences: many(userCuisinePreferences),
	sessions: many(sessions),
	receipts: many(receipts),
	recipes: many(recipes),
	shoppingLists: many(shoppingLists),
	mealLogs: many(mealLogs),
	plannedMeals: many(plannedMeals),
	purchaseHistory: many(purchaseHistory),
	cupboardItems: many(cupboardItems),
	savedRecipes: many(savedRecipes),
	householdMembership: one(householdMembers, {
		fields: [users.id],
		references: [householdMembers.userId]
	})
}));

export const householdsRelations = relations(households, ({ many }) => ({
	members: many(householdMembers),
	invites: many(householdInvites),
	receipts: many(receipts),
	recipes: many(recipes),
	shoppingLists: many(shoppingLists),
	plannedMeals: many(plannedMeals),
	purchaseHistory: many(purchaseHistory),
	cupboardItems: many(cupboardItems),
	kitchenEvents: many(kitchenEvents),
	habitAnswers: many(householdHabitAnswers)
}));

export const kitchenEventsRelations = relations(kitchenEvents, ({ one }) => ({
	household: one(households, {
		fields: [kitchenEvents.householdId],
		references: [households.id]
	})
}));

export const householdHabitAnswersRelations = relations(householdHabitAnswers, ({ one }) => ({
	household: one(households, {
		fields: [householdHabitAnswers.householdId],
		references: [households.id]
	})
}));

export const householdMembersRelations = relations(householdMembers, ({ one }) => ({
	household: one(households, {
		fields: [householdMembers.householdId],
		references: [households.id]
	}),
	user: one(users, {
		fields: [householdMembers.userId],
		references: [users.id]
	})
}));

export const householdInvitesRelations = relations(householdInvites, ({ one }) => ({
	household: one(households, {
		fields: [householdInvites.householdId],
		references: [households.id]
	})
}));

export const userDietaryProfilesRelations = relations(userDietaryProfiles, ({ one }) => ({
	user: one(users, {
		fields: [userDietaryProfiles.userId],
		references: [users.id]
	})
}));

export const userAllergiesRelations = relations(userAllergies, ({ one }) => ({
	user: one(users, {
		fields: [userAllergies.userId],
		references: [users.id]
	})
}));

export const userIngredientPreferencesRelations = relations(
	userIngredientPreferences,
	({ one }) => ({
		user: one(users, {
			fields: [userIngredientPreferences.userId],
			references: [users.id]
		})
	})
);

export const userCuisinePreferencesRelations = relations(userCuisinePreferences, ({ one }) => ({
	user: one(users, {
		fields: [userCuisinePreferences.userId],
		references: [users.id]
	})
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	})
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
	user: one(users, {
		fields: [userPreferences.userId],
		references: [users.id]
	})
}));

export const receiptsRelations = relations(receipts, ({ one, many }) => ({
	household: one(households, {
		fields: [receipts.householdId],
		references: [households.id]
	}),
	user: one(users, {
		fields: [receipts.userId],
		references: [users.id]
	}),
	items: many(receiptItems),
	generatedRecipes: many(recipes)
}));

export const receiptItemsRelations = relations(receiptItems, ({ one }) => ({
	receipt: one(receipts, {
		fields: [receiptItems.receiptId],
		references: [receipts.id]
	})
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
	household: one(households, {
		fields: [recipes.householdId],
		references: [households.id]
	}),
	user: one(users, {
		fields: [recipes.userId],
		references: [users.id]
	}),
	sourceReceipt: one(receipts, {
		fields: [recipes.sourceReceiptId],
		references: [receipts.id]
	}),
	ingredients: many(recipeIngredients),
	mealLogs: many(mealLogs),
	plannedMeals: many(plannedMeals),
	savedBy: many(savedRecipes),
	shoppingListItems: many(shoppingListItems)
}));

export const mealLogsRelations = relations(mealLogs, ({ one }) => ({
	user: one(users, {
		fields: [mealLogs.userId],
		references: [users.id]
	}),
	recipe: one(recipes, {
		fields: [mealLogs.recipeId],
		references: [recipes.id]
	})
}));

export const plannedMealsRelations = relations(plannedMeals, ({ one }) => ({
	household: one(households, {
		fields: [plannedMeals.householdId],
		references: [households.id]
	}),
	user: one(users, {
		fields: [plannedMeals.userId],
		references: [users.id]
	}),
	recipe: one(recipes, {
		fields: [plannedMeals.recipeId],
		references: [recipes.id]
	})
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
	recipe: one(recipes, {
		fields: [recipeIngredients.recipeId],
		references: [recipes.id]
	})
}));

export const shoppingListsRelations = relations(shoppingLists, ({ one, many }) => ({
	household: one(households, {
		fields: [shoppingLists.householdId],
		references: [households.id]
	}),
	user: one(users, {
		fields: [shoppingLists.userId],
		references: [users.id]
	}),
	items: many(shoppingListItems)
}));

export const shoppingListItemsRelations = relations(shoppingListItems, ({ one }) => ({
	shoppingList: one(shoppingLists, {
		fields: [shoppingListItems.shoppingListId],
		references: [shoppingLists.id]
	}),
	fromRecipe: one(recipes, {
		fields: [shoppingListItems.fromRecipeId],
		references: [recipes.id]
	})
}));

export const purchaseHistoryRelations = relations(purchaseHistory, ({ one }) => ({
	household: one(households, {
		fields: [purchaseHistory.householdId],
		references: [households.id]
	}),
	user: one(users, {
		fields: [purchaseHistory.userId],
		references: [users.id]
	})
}));

export const cupboardItemsRelations = relations(cupboardItems, ({ one }) => ({
	household: one(households, {
		fields: [cupboardItems.householdId],
		references: [households.id]
	}),
	user: one(users, {
		fields: [cupboardItems.userId],
		references: [users.id]
	})
}));

export const savedRecipesRelations = relations(savedRecipes, ({ one }) => ({
	user: one(users, {
		fields: [savedRecipes.userId],
		references: [users.id]
	}),
	recipe: one(recipes, {
		fields: [savedRecipes.recipeId],
		references: [recipes.id]
	})
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Household = typeof households.$inferSelect;
export type NewHousehold = typeof households.$inferInsert;
export type HouseholdMember = typeof householdMembers.$inferSelect;
export type NewHouseholdMember = typeof householdMembers.$inferInsert;
export type HouseholdInvite = typeof householdInvites.$inferSelect;
export type NewHouseholdInvite = typeof householdInvites.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;
export type ReceiptItem = typeof receiptItems.$inferSelect;
export type NewReceiptItem = typeof receiptItems.$inferInsert;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type NewRecipeIngredient = typeof recipeIngredients.$inferInsert;
export type ShoppingList = typeof shoppingLists.$inferSelect;
export type NewShoppingList = typeof shoppingLists.$inferInsert;
export type MealLog = typeof mealLogs.$inferSelect;
export type NewMealLog = typeof mealLogs.$inferInsert;
export type PlannedMeal = typeof plannedMeals.$inferSelect;
export type NewPlannedMeal = typeof plannedMeals.$inferInsert;
export type ShoppingListItem = typeof shoppingListItems.$inferSelect;
export type NewShoppingListItem = typeof shoppingListItems.$inferInsert;
export type PurchaseHistory = typeof purchaseHistory.$inferSelect;
export type NewPurchaseHistory = typeof purchaseHistory.$inferInsert;
export type CupboardItem = typeof cupboardItems.$inferSelect;
export type NewCupboardItem = typeof cupboardItems.$inferInsert;
export type KitchenEventRow = typeof kitchenEvents.$inferSelect;
export type NewKitchenEventRow = typeof kitchenEvents.$inferInsert;
export type HouseholdHabitAnswerRow = typeof householdHabitAnswers.$inferSelect;
export type CategoryShelfLife = typeof categoryShelfLife.$inferSelect;
export type NewCategoryShelfLife = typeof categoryShelfLife.$inferInsert;
export type CookbookEmbedding = typeof cookbookEmbeddings.$inferSelect;
export type NewCookbookEmbedding = typeof cookbookEmbeddings.$inferInsert;
export type SavedRecipe = typeof savedRecipes.$inferSelect;
export type NewSavedRecipe = typeof savedRecipes.$inferInsert;
export type UserDietaryProfile = typeof userDietaryProfiles.$inferSelect;
export type NewUserDietaryProfile = typeof userDietaryProfiles.$inferInsert;
export type UserAllergy = typeof userAllergies.$inferSelect;
export type NewUserAllergy = typeof userAllergies.$inferInsert;
export type UserIngredientPreference = typeof userIngredientPreferences.$inferSelect;
export type NewUserIngredientPreference = typeof userIngredientPreferences.$inferInsert;
export type UserCuisinePreference = typeof userCuisinePreferences.$inferSelect;
export type NewUserCuisinePreference = typeof userCuisinePreferences.$inferInsert;
