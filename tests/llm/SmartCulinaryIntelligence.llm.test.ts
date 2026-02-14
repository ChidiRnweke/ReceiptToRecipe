/// <reference types="vitest/globals" />
import {
  describeLLM,
  OPENROUTER_API_KEY,
  CHEAP_CHAT_MODEL,
  withRetry,
} from "./setup";
import { SmartCulinaryIntelligence } from "../../src/lib/services/SmartCulinaryIntelligence";
import type {
  GeneratedRecipe,
  RecipeContext,
} from "../../src/lib/services/interfaces/ICulinaryIntelligence";

describeLLM("SmartCulinaryIntelligence (LLM Integration)", () => {
  let service: SmartCulinaryIntelligence;

  beforeAll(() => {
    service = new SmartCulinaryIntelligence(
      OPENROUTER_API_KEY,
      CHEAP_CHAT_MODEL,
    );
  });

  describe("chat", () => {
    it("should return a non-empty string response", async () => {
      const result = await withRetry(() =>
        service.chat([
          { role: "user", content: "Reply with exactly one word: hello" },
        ]),
      );

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should respect a system prompt", async () => {
      const result = await withRetry(() =>
        service.chat(
          [{ role: "user", content: "What language do you speak?" }],
          "You are a French-only assistant. Always respond in French.",
        ),
      );

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      // The model should respond in French - look for common French words
      const lowerResult = result.toLowerCase();
      const hasFrench = [
        "je",
        "le",
        "la",
        "les",
        "un",
        "une",
        "de",
        "du",
        "français",
        "bonjour",
        "parle",
      ].some((word) => lowerResult.includes(word));
      expect(hasFrench).toBe(true);
    });

    it("should handle multi-turn conversation", async () => {
      const result = await withRetry(() =>
        service.chat([
          { role: "user", content: "My name is TestBot." },
          { role: "assistant", content: "Nice to meet you, TestBot!" },
          { role: "user", content: "What is my name?" },
        ]),
      );

      expect(result.toLowerCase()).toContain("testbot");
    });
  });

  describe("normalizeIngredient", () => {
    it("should parse a weight-based ingredient", async () => {
      const result = await withRetry(() =>
        service.normalizeIngredient("1lb chicken breast"),
      );

      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("quantity");
      expect(result).toHaveProperty("unit");
      expect(result).toHaveProperty("unitType");

      expect(typeof result.name).toBe("string");
      expect(result.name.toLowerCase()).toContain("chicken");
      expect(typeof result.quantity).toBe("number");
      expect(result.quantity).toBeGreaterThan(0);
      // Should be converted to grams (1lb ~ 453g)
      expect(result.unit).toBe("g");
      expect(result.unitType).toBe("WEIGHT");
    });

    it("should parse a volume-based ingredient", async () => {
      const result = await withRetry(() =>
        service.normalizeIngredient("2 cups flour"),
      );

      expect(result.name.toLowerCase()).toContain("flour");
      expect(result.quantity).toBeGreaterThan(0);
      expect(result.unit).toBe("ml");
      expect(result.unitType).toBe("VOLUME");
    });

    it("should parse a count-based ingredient", async () => {
      const result = await withRetry(() =>
        service.normalizeIngredient("3 eggs"),
      );

      expect(result.name.toLowerCase()).toContain("egg");
      expect(result.quantity).toBe(3);
      expect(result.unit).toBe("count");
      expect(result.unitType).toBe("COUNT");
    });

    it("should handle fractional quantities", async () => {
      const result = await withRetry(() =>
        service.normalizeIngredient("1/2 cup sugar"),
      );

      expect(result.name.toLowerCase()).toContain("sugar");
      expect(result.quantity).toBeGreaterThan(0);
      expect(result.unitType).toBe("VOLUME");
    });
  });

  describe("embed", () => {
    it("should return a numeric array embedding", async () => {
      const result = await withRetry(() =>
        service.embed("chicken parmesan recipe"),
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      // text-embedding-3-small returns 1536 dimensions
      expect(result.length).toBe(1536);
      expect(typeof result[0]).toBe("number");
    });

    it("should return different embeddings for different inputs", async () => {
      const [embedding1, embedding2] = await Promise.all([
        withRetry(() => service.embed("spaghetti bolognese")),
        withRetry(() => service.embed("quantum physics textbook")),
      ]);

      expect(embedding1.length).toBe(embedding2.length);

      // Calculate cosine similarity - should be low for unrelated texts
      let dot = 0,
        norm1 = 0,
        norm2 = 0;
      for (let i = 0; i < embedding1.length; i++) {
        dot += embedding1[i] * embedding2[i];
        norm1 += embedding1[i] ** 2;
        norm2 += embedding2[i] ** 2;
      }
      const similarity = dot / (Math.sqrt(norm1) * Math.sqrt(norm2));

      // Unrelated texts should have low-ish similarity (< 0.7)
      expect(similarity).toBeLessThan(0.7);
    });

    it("should return similar embeddings for related inputs", async () => {
      const [embedding1, embedding2] = await Promise.all([
        withRetry(() => service.embed("pasta with tomato sauce")),
        withRetry(() => service.embed("spaghetti marinara")),
      ]);

      let dot = 0,
        norm1 = 0,
        norm2 = 0;
      for (let i = 0; i < embedding1.length; i++) {
        dot += embedding1[i] * embedding2[i];
        norm1 += embedding1[i] ** 2;
        norm2 += embedding2[i] ** 2;
      }
      const similarity = dot / (Math.sqrt(norm1) * Math.sqrt(norm2));

      // Related texts should have higher similarity (> 0.5)
      expect(similarity).toBeGreaterThan(0.5);
    });
  });

  describe("generateRecipe", () => {
    it("should generate a valid recipe from ingredients", async () => {
      const context: RecipeContext = {
        availableIngredients: [
          "chicken breast",
          "rice",
          "garlic",
          "soy sauce",
          "broccoli",
        ],
        preferences: {},
        servings: 2,
      };

      const recipe = await withRetry(() => service.generateRecipe(context));

      // Validate structure
      expect(recipe).toHaveProperty("title");
      expect(recipe).toHaveProperty("instructions");
      expect(recipe).toHaveProperty("servings");
      expect(recipe).toHaveProperty("ingredients");

      expect(typeof recipe.title).toBe("string");
      expect(recipe.title.length).toBeGreaterThan(0);
      expect(typeof recipe.instructions).toBe("string");
      expect(recipe.instructions.length).toBeGreaterThan(0);
      expect(recipe.servings).toBe(2);
      expect(Array.isArray(recipe.ingredients)).toBe(true);
      expect(recipe.ingredients.length).toBeGreaterThan(0);

      // Each ingredient should have proper structure
      for (const ing of recipe.ingredients) {
        expect(ing).toHaveProperty("name");
        expect(ing).toHaveProperty("quantity");
        expect(ing).toHaveProperty("unit");
        expect(typeof ing.name).toBe("string");
        expect(typeof ing.quantity).toBe("number");
      }
    });

    it("should respect cuisine hint", async () => {
      const context: RecipeContext = {
        availableIngredients: ["chicken", "rice", "onion", "tomato"],
        preferences: {},
        cuisineHint: "Indian",
      };

      const recipe = await withRetry(() => service.generateRecipe(context));

      // The recipe should have some Indian characteristics
      const recipeText =
        `${recipe.title} ${recipe.description} ${recipe.instructions}`.toLowerCase();
      const indianIndicators = [
        "indian",
        "curry",
        "masala",
        "spice",
        "turmeric",
        "cumin",
        "garam",
        "tikka",
        "biryani",
        "tandoori",
        "naan",
      ];
      const hasIndianElement = indianIndicators.some((word) =>
        recipeText.includes(word),
      );
      expect(hasIndianElement).toBe(true);
    });

    it("should respect allergy constraints via taste profile", async () => {
      const context: RecipeContext = {
        availableIngredients: ["tofu", "rice", "vegetables", "soy sauce"],
        preferences: {},
        tasteProfile: {
          dietType: "vegan",
          allergies: [{ allergen: "Peanuts", severity: "severe" as const }],
          ingredientPreferences: [],
          cuisinePreferences: [],
        },
      };

      const recipe = await withRetry(() => service.generateRecipe(context));

      // Peanuts should not appear in ingredients
      const ingredientNames = recipe.ingredients.map((i) =>
        i.name.toLowerCase(),
      );
      expect(ingredientNames.every((name) => !name.includes("peanut"))).toBe(
        true,
      );
    });
  });

  describe("adjustRecipe", () => {
    const baseRecipe: GeneratedRecipe = {
      title: "Chicken Stir Fry",
      description: "A quick chicken stir fry with vegetables",
      instructions:
        "Step 1: Cut chicken.\nStep 2: Stir fry with vegetables.\nStep 3: Add sauce.",
      servings: 2,
      prepTime: 10,
      cookTime: 15,
      cuisineType: "Asian",
      estimatedCalories: 450,
      ingredients: [
        { name: "chicken breast", quantity: 300, unit: "g", optional: false },
        { name: "broccoli", quantity: 200, unit: "g", optional: false },
        { name: "soy sauce", quantity: 30, unit: "ml", optional: false },
      ],
    };

    it("should modify a recipe based on instruction", async () => {
      const adjusted = await withRetry(() =>
        service.adjustRecipe(
          baseRecipe,
          "Make it vegetarian by replacing chicken with tofu",
        ),
      );

      expect(adjusted).toHaveProperty("title");
      expect(adjusted).toHaveProperty("ingredients");
      expect(Array.isArray(adjusted.ingredients)).toBe(true);

      // Should have replaced chicken
      const ingredientNames = adjusted.ingredients.map((i) =>
        i.name.toLowerCase(),
      );
      const hasTofu = ingredientNames.some((name) => name.includes("tofu"));
      const hasChicken = ingredientNames.some((name) =>
        name.includes("chicken"),
      );

      expect(hasTofu).toBe(true);
      expect(hasChicken).toBe(false);
    });

    it("should preserve recipe structure after adjustment", async () => {
      const adjusted = await withRetry(() =>
        service.adjustRecipe(baseRecipe, "Double the servings"),
      );

      expect(adjusted).toHaveProperty("title");
      expect(adjusted).toHaveProperty("instructions");
      expect(adjusted).toHaveProperty("servings");
      expect(adjusted).toHaveProperty("ingredients");
      expect(typeof adjusted.title).toBe("string");
      expect(typeof adjusted.instructions).toBe("string");
      expect(typeof adjusted.servings).toBe("number");
      expect(Array.isArray(adjusted.ingredients)).toBe(true);
    });
  });

  describe("suggestModifications", () => {
    it("should return an array of short suggestion strings", async () => {
      const recipe: GeneratedRecipe = {
        title: "Grilled Chicken Salad",
        description: "A healthy grilled chicken salad",
        instructions: "Grill chicken, chop vegetables, toss together.",
        servings: 2,
        prepTime: 15,
        cookTime: 20,
        cuisineType: "American",
        estimatedCalories: 350,
        ingredients: [
          { name: "chicken breast", quantity: 200, unit: "g", optional: false },
          { name: "mixed greens", quantity: 100, unit: "g", optional: false },
          { name: "tomato", quantity: 1, unit: "count", optional: false },
        ],
      };

      const suggestions = await withRetry(() =>
        service.suggestModifications(recipe),
      );

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThanOrEqual(2);
      expect(suggestions.length).toBeLessThanOrEqual(4);

      for (const suggestion of suggestions) {
        expect(typeof suggestion).toBe("string");
        expect(suggestion.length).toBeGreaterThan(0);
        // Each suggestion should be concise (max ~10 words)
        expect(suggestion.split(" ").length).toBeLessThanOrEqual(10);
      }
    });
  });
});
