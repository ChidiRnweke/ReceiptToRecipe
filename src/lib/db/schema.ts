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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const processingStatusEnum = pgEnum("processing_status", [
  "QUEUED",
  "PROCESSING",
  "DONE",
  "FAILED",
]);

export const recipeSourceEnum = pgEnum("recipe_source", [
  "GENERATED",
  "RAG",
  "USER",
]);

export const unitTypeEnum = pgEnum("unit_type", ["WEIGHT", "VOLUME", "COUNT"]);

// Users
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Sessions for mock auth
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

// User Preferences
export const userPreferences = pgTable("user_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  allergies: text("allergies").array().default([]),
  dietaryRestrictions: text("dietary_restrictions").array().default([]),
  cuisinePreferences: text("cuisine_preferences").array().default([]),
  excludedIngredients: text("excluded_ingredients").array().default([]),
  caloricGoal: integer("caloric_goal"),
  defaultServings: integer("default_servings").default(2),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Receipts
export const receipts = pgTable("receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  status: processingStatusEnum("status").notNull().default("QUEUED"),
  rawOcrData: jsonb("raw_ocr_data"),
  storeName: text("store_name"),
  purchaseDate: timestamp("purchase_date"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Receipt Items (normalized)
export const receiptItems = pgTable("receipt_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  receiptId: uuid("receipt_id")
    .notNull()
    .references(() => receipts.id, { onDelete: "cascade" }),
  rawName: text("raw_name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit").notNull(), // Normalized: g, ml, count
  unitType: unitTypeEnum("unit_type").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }),
  category: text("category"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Recipes
export const recipes = pgTable("recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  instructions: text("instructions").notNull(),
  servings: integer("servings").notNull().default(2),
  prepTime: integer("prep_time"), // in minutes
  cookTime: integer("cook_time"), // in minutes
  imageUrl: text("image_url"),
  imageStatus: processingStatusEnum("image_status").default("QUEUED"),
  source: recipeSourceEnum("source").notNull().default("GENERATED"),
  cuisineType: text("cuisine_type"),
  estimatedCalories: integer("estimated_calories"),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Recipe Ingredients
export const recipeIngredients = pgTable("recipe_ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  unitType: unitTypeEnum("unit_type").notNull(),
  optional: boolean("optional").default(false),
  notes: text("notes"),
  orderIndex: integer("order_index").notNull().default(0),
});

// Shopping Lists
export const shoppingLists = pgTable("shopping_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Shopping List Items
export const shoppingListItems = pgTable("shopping_list_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  shoppingListId: uuid("shopping_list_id")
    .notNull()
    .references(() => shoppingLists.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }),
  unit: text("unit"),
  checked: boolean("checked").default(false),
  fromRecipeId: uuid("from_recipe_id").references(() => recipes.id, {
    onDelete: "set null",
  }),
  notes: text("notes"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Purchase History (for smart suggestions)
export const purchaseHistory = pgTable("purchase_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  itemName: text("item_name").notNull(), // normalized name
  lastPurchased: timestamp("last_purchased").notNull(),
  purchaseCount: integer("purchase_count").notNull().default(1),
  avgQuantity: decimal("avg_quantity", { precision: 10, scale: 3 }),
  avgFrequencyDays: integer("avg_frequency_days"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Cookbook Embeddings (for RAG)
export const cookbookEmbeddings = pgTable("cookbook_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipeTitle: text("recipe_title").notNull(),
  contentChunk: text("content_chunk").notNull(),
  // embedding: vector('embedding', { dimensions: 768 }), // Gemini text-embedding-004 dimensions
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Saved/Favorited Recipes (Social feature)
export const savedRecipes = pgTable("saved_recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  preferences: one(userPreferences, {
    fields: [users.id],
    references: [userPreferences.userId],
  }),
  sessions: many(sessions),
  receipts: many(receipts),
  recipes: many(recipes),
  shoppingLists: many(shoppingLists),
  purchaseHistory: many(purchaseHistory),
  savedRecipes: many(savedRecipes),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const userPreferencesRelations = relations(
  userPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [userPreferences.userId],
      references: [users.id],
    }),
  })
);

export const receiptsRelations = relations(receipts, ({ one, many }) => ({
  user: one(users, {
    fields: [receipts.userId],
    references: [users.id],
  }),
  items: many(receiptItems),
}));

export const receiptItemsRelations = relations(receiptItems, ({ one }) => ({
  receipt: one(receipts, {
    fields: [receiptItems.receiptId],
    references: [receipts.id],
  }),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  user: one(users, {
    fields: [recipes.userId],
    references: [users.id],
  }),
  ingredients: many(recipeIngredients),
  savedBy: many(savedRecipes),
  shoppingListItems: many(shoppingListItems),
}));

export const recipeIngredientsRelations = relations(
  recipeIngredients,
  ({ one }) => ({
    recipe: one(recipes, {
      fields: [recipeIngredients.recipeId],
      references: [recipes.id],
    }),
  })
);

export const shoppingListsRelations = relations(
  shoppingLists,
  ({ one, many }) => ({
    user: one(users, {
      fields: [shoppingLists.userId],
      references: [users.id],
    }),
    items: many(shoppingListItems),
  })
);

export const shoppingListItemsRelations = relations(
  shoppingListItems,
  ({ one }) => ({
    shoppingList: one(shoppingLists, {
      fields: [shoppingListItems.shoppingListId],
      references: [shoppingLists.id],
    }),
    fromRecipe: one(recipes, {
      fields: [shoppingListItems.fromRecipeId],
      references: [recipes.id],
    }),
  })
);

export const purchaseHistoryRelations = relations(
  purchaseHistory,
  ({ one }) => ({
    user: one(users, {
      fields: [purchaseHistory.userId],
      references: [users.id],
    }),
  })
);

export const savedRecipesRelations = relations(savedRecipes, ({ one }) => ({
  user: one(users, {
    fields: [savedRecipes.userId],
    references: [users.id],
  }),
  recipe: one(recipes, {
    fields: [savedRecipes.recipeId],
    references: [recipes.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
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
export type ShoppingListItem = typeof shoppingListItems.$inferSelect;
export type NewShoppingListItem = typeof shoppingListItems.$inferInsert;
export type PurchaseHistory = typeof purchaseHistory.$inferSelect;
export type NewPurchaseHistory = typeof purchaseHistory.$inferInsert;
export type CookbookEmbedding = typeof cookbookEmbeddings.$inferSelect;
export type NewCookbookEmbedding = typeof cookbookEmbeddings.$inferInsert;
export type SavedRecipe = typeof savedRecipes.$inferSelect;
export type NewSavedRecipe = typeof savedRecipes.$inferInsert;
