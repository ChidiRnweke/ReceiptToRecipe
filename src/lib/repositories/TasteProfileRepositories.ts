import { eq, and } from "drizzle-orm";
import type { Database } from "$db/client";
import * as schema from "$db/schema";
import type {
  IUserDietaryProfileRepository,
  IUserAllergyRepository,
  IUserIngredientPreferenceRepository,
  IUserCuisinePreferenceRepository,
} from "./interfaces";
import type {
  UserDietaryProfileDao,
  NewUserDietaryProfileDao,
  UpdateUserDietaryProfileDao,
  UserAllergyDao,
  NewUserAllergyDao,
  UserIngredientPreferenceDao,
  NewUserIngredientPreferenceDao,
  UserCuisinePreferenceDao,
  NewUserCuisinePreferenceDao,
} from "./daos";

export class UserDietaryProfileRepository implements IUserDietaryProfileRepository {
  constructor(private db: Database) {}

  async findByUserId(userId: string): Promise<UserDietaryProfileDao | null> {
    const profile = await this.db.query.userDietaryProfiles.findFirst({
      where: eq(schema.userDietaryProfiles.userId, userId),
    });
    return profile ? this.toDao(profile) : null;
  }

  async create(
    profile: NewUserDietaryProfileDao,
  ): Promise<UserDietaryProfileDao> {
    const [created] = await this.db
      .insert(schema.userDietaryProfiles)
      .values({
        userId: profile.userId,
        dietType: profile.dietType ?? null,
      })
      .returning();
    return this.toDao(created);
  }

  async update(
    userId: string,
    profile: UpdateUserDietaryProfileDao,
  ): Promise<UserDietaryProfileDao> {
    const [updated] = await this.db
      .update(schema.userDietaryProfiles)
      .set({
        dietType: profile.dietType ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.userDietaryProfiles.userId, userId))
      .returning();
    return this.toDao(updated);
  }

  async delete(userId: string): Promise<void> {
    await this.db
      .delete(schema.userDietaryProfiles)
      .where(eq(schema.userDietaryProfiles.userId, userId));
  }

  private toDao(
    profile: typeof schema.userDietaryProfiles.$inferSelect,
  ): UserDietaryProfileDao {
    return {
      id: profile.id,
      userId: profile.userId,
      dietType: profile.dietType,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}

export class UserAllergyRepository implements IUserAllergyRepository {
  constructor(private db: Database) {}

  async findByUserId(userId: string): Promise<UserAllergyDao[]> {
    const allergies = await this.db.query.userAllergies.findMany({
      where: eq(schema.userAllergies.userId, userId),
    });
    return allergies.map((a) => this.toDao(a));
  }

  async findByUserAndAllergen(
    userId: string,
    allergen: string,
  ): Promise<UserAllergyDao | null> {
    const allergy = await this.db.query.userAllergies.findFirst({
      where: and(
        eq(schema.userAllergies.userId, userId),
        eq(schema.userAllergies.allergen, allergen),
      ),
    });
    return allergy ? this.toDao(allergy) : null;
  }

  async create(allergy: NewUserAllergyDao): Promise<UserAllergyDao> {
    const [created] = await this.db
      .insert(schema.userAllergies)
      .values({
        userId: allergy.userId,
        allergen: allergy.allergen,
        severity: allergy.severity ?? "avoid",
      })
      .onConflictDoUpdate({
        target: [schema.userAllergies.userId, schema.userAllergies.allergen],
        set: { severity: allergy.severity ?? "avoid" },
      })
      .returning();
    return this.toDao(created);
  }

  async update(
    userId: string,
    allergen: string,
    severity: string,
  ): Promise<UserAllergyDao> {
    const [updated] = await this.db
      .update(schema.userAllergies)
      .set({ severity })
      .where(
        and(
          eq(schema.userAllergies.userId, userId),
          eq(schema.userAllergies.allergen, allergen),
        ),
      )
      .returning();
    return this.toDao(updated);
  }

  async delete(userId: string, allergen: string): Promise<void> {
    await this.db
      .delete(schema.userAllergies)
      .where(
        and(
          eq(schema.userAllergies.userId, userId),
          eq(schema.userAllergies.allergen, allergen),
        ),
      );
  }

  private toDao(
    allergy: typeof schema.userAllergies.$inferSelect,
  ): UserAllergyDao {
    return {
      id: allergy.id,
      userId: allergy.userId,
      allergen: allergy.allergen,
      severity: allergy.severity ?? "avoid",
      createdAt: allergy.createdAt,
    };
  }
}

export class UserIngredientPreferenceRepository implements IUserIngredientPreferenceRepository {
  constructor(private db: Database) {}

  async findByUserId(userId: string): Promise<UserIngredientPreferenceDao[]> {
    const preferences = await this.db.query.userIngredientPreferences.findMany({
      where: eq(schema.userIngredientPreferences.userId, userId),
    });
    return preferences.map((p) => this.toDao(p));
  }

  async findByUserAndIngredient(
    userId: string,
    ingredientName: string,
  ): Promise<UserIngredientPreferenceDao | null> {
    const preference = await this.db.query.userIngredientPreferences.findFirst({
      where: and(
        eq(schema.userIngredientPreferences.userId, userId),
        eq(schema.userIngredientPreferences.ingredientName, ingredientName),
      ),
    });
    return preference ? this.toDao(preference) : null;
  }

  async create(
    preference: NewUserIngredientPreferenceDao,
  ): Promise<UserIngredientPreferenceDao> {
    const [created] = await this.db
      .insert(schema.userIngredientPreferences)
      .values({
        userId: preference.userId,
        ingredientName: preference.ingredientName,
        preference: preference.preference,
      })
      .onConflictDoUpdate({
        target: [
          schema.userIngredientPreferences.userId,
          schema.userIngredientPreferences.ingredientName,
        ],
        set: { preference: preference.preference },
      })
      .returning();
    return this.toDao(created);
  }

  async update(
    userId: string,
    ingredientName: string,
    preference: string,
  ): Promise<UserIngredientPreferenceDao> {
    const [updated] = await this.db
      .update(schema.userIngredientPreferences)
      .set({ preference })
      .where(
        and(
          eq(schema.userIngredientPreferences.userId, userId),
          eq(schema.userIngredientPreferences.ingredientName, ingredientName),
        ),
      )
      .returning();
    return this.toDao(updated);
  }

  async delete(userId: string, ingredientName: string): Promise<void> {
    await this.db
      .delete(schema.userIngredientPreferences)
      .where(
        and(
          eq(schema.userIngredientPreferences.userId, userId),
          eq(schema.userIngredientPreferences.ingredientName, ingredientName),
        ),
      );
  }

  private toDao(
    preference: typeof schema.userIngredientPreferences.$inferSelect,
  ): UserIngredientPreferenceDao {
    return {
      id: preference.id,
      userId: preference.userId,
      ingredientName: preference.ingredientName,
      preference: preference.preference,
      createdAt: preference.createdAt,
    };
  }
}

export class UserCuisinePreferenceRepository implements IUserCuisinePreferenceRepository {
  constructor(private db: Database) {}

  async findByUserId(userId: string): Promise<UserCuisinePreferenceDao[]> {
    const preferences = await this.db.query.userCuisinePreferences.findMany({
      where: eq(schema.userCuisinePreferences.userId, userId),
    });
    return preferences.map((p) => this.toDao(p));
  }

  async findByUserAndCuisine(
    userId: string,
    cuisineType: string,
  ): Promise<UserCuisinePreferenceDao | null> {
    const preference = await this.db.query.userCuisinePreferences.findFirst({
      where: and(
        eq(schema.userCuisinePreferences.userId, userId),
        eq(schema.userCuisinePreferences.cuisineType, cuisineType),
      ),
    });
    return preference ? this.toDao(preference) : null;
  }

  async create(
    preference: NewUserCuisinePreferenceDao,
  ): Promise<UserCuisinePreferenceDao> {
    const [created] = await this.db
      .insert(schema.userCuisinePreferences)
      .values({
        userId: preference.userId,
        cuisineType: preference.cuisineType,
        preference: preference.preference,
      })
      .onConflictDoUpdate({
        target: [
          schema.userCuisinePreferences.userId,
          schema.userCuisinePreferences.cuisineType,
        ],
        set: { preference: preference.preference },
      })
      .returning();
    return this.toDao(created);
  }

  async update(
    userId: string,
    cuisineType: string,
    preference: string,
  ): Promise<UserCuisinePreferenceDao> {
    const [updated] = await this.db
      .update(schema.userCuisinePreferences)
      .set({ preference })
      .where(
        and(
          eq(schema.userCuisinePreferences.userId, userId),
          eq(schema.userCuisinePreferences.cuisineType, cuisineType),
        ),
      )
      .returning();
    return this.toDao(updated);
  }

  async delete(userId: string, cuisineType: string): Promise<void> {
    await this.db
      .delete(schema.userCuisinePreferences)
      .where(
        and(
          eq(schema.userCuisinePreferences.userId, userId),
          eq(schema.userCuisinePreferences.cuisineType, cuisineType),
        ),
      );
  }

  private toDao(
    preference: typeof schema.userCuisinePreferences.$inferSelect,
  ): UserCuisinePreferenceDao {
    return {
      id: preference.id,
      userId: preference.userId,
      cuisineType: preference.cuisineType,
      preference: preference.preference,
      createdAt: preference.createdAt,
    };
  }
}
