import { v4 as uuid } from "uuid";
import type {
  IUserDietaryProfileRepository,
  IUserAllergyRepository,
  IUserIngredientPreferenceRepository,
  IUserCuisinePreferenceRepository,
} from "../../src/lib/repositories/interfaces/ITasteProfileRepositories";
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
} from "../../src/lib/repositories/daos";

export class MockUserDietaryProfileRepository implements IUserDietaryProfileRepository {
  private store = new Map<string, UserDietaryProfileDao>();

  async findByUserId(userId: string): Promise<UserDietaryProfileDao | null> {
    for (const profile of this.store.values()) {
      if (profile.userId === userId) return profile;
    }
    return null;
  }

  async create(
    profile: NewUserDietaryProfileDao,
  ): Promise<UserDietaryProfileDao> {
    const now = new Date();
    const record: UserDietaryProfileDao = {
      id: uuid(),
      userId: profile.userId,
      dietType: profile.dietType ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(record.id, record);
    return record;
  }

  async update(
    userId: string,
    profile: UpdateUserDietaryProfileDao,
  ): Promise<UserDietaryProfileDao> {
    const existing = await this.findByUserId(userId);
    if (!existing) throw new Error("Dietary profile not found");

    const updated: UserDietaryProfileDao = {
      ...existing,
      ...profile,
      updatedAt: new Date(),
    };
    this.store.set(existing.id, updated);
    return updated;
  }

  async delete(userId: string): Promise<void> {
    for (const [id, profile] of this.store.entries()) {
      if (profile.userId === userId) {
        this.store.delete(id);
        return;
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}

export class MockUserAllergyRepository implements IUserAllergyRepository {
  private store = new Map<string, UserAllergyDao>();

  async findByUserId(userId: string): Promise<UserAllergyDao[]> {
    return [...this.store.values()].filter((a) => a.userId === userId);
  }

  async findByUserAndAllergen(
    userId: string,
    allergen: string,
  ): Promise<UserAllergyDao | null> {
    for (const allergy of this.store.values()) {
      if (allergy.userId === userId && allergy.allergen === allergen) {
        return allergy;
      }
    }
    return null;
  }

  async create(allergy: NewUserAllergyDao): Promise<UserAllergyDao> {
    const record: UserAllergyDao = {
      id: uuid(),
      userId: allergy.userId,
      allergen: allergy.allergen,
      severity: allergy.severity || "avoid",
      createdAt: new Date(),
    };
    this.store.set(record.id, record);
    return record;
  }

  async update(
    userId: string,
    allergen: string,
    severity: string,
  ): Promise<UserAllergyDao> {
    const existing = await this.findByUserAndAllergen(userId, allergen);
    if (!existing) throw new Error("Allergy not found");

    const updated: UserAllergyDao = { ...existing, severity };
    this.store.set(existing.id, updated);
    return updated;
  }

  async delete(userId: string, allergen: string): Promise<void> {
    for (const [id, allergy] of this.store.entries()) {
      if (allergy.userId === userId && allergy.allergen === allergen) {
        this.store.delete(id);
        return;
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}

export class MockUserIngredientPreferenceRepository implements IUserIngredientPreferenceRepository {
  private store = new Map<string, UserIngredientPreferenceDao>();

  async findByUserId(userId: string): Promise<UserIngredientPreferenceDao[]> {
    return [...this.store.values()].filter((p) => p.userId === userId);
  }

  async findByUserAndIngredient(
    userId: string,
    ingredientName: string,
  ): Promise<UserIngredientPreferenceDao | null> {
    for (const pref of this.store.values()) {
      if (pref.userId === userId && pref.ingredientName === ingredientName) {
        return pref;
      }
    }
    return null;
  }

  async create(
    preference: NewUserIngredientPreferenceDao,
  ): Promise<UserIngredientPreferenceDao> {
    const record: UserIngredientPreferenceDao = {
      id: uuid(),
      userId: preference.userId,
      ingredientName: preference.ingredientName,
      preference: preference.preference,
      createdAt: new Date(),
    };
    this.store.set(record.id, record);
    return record;
  }

  async update(
    userId: string,
    ingredientName: string,
    preference: string,
  ): Promise<UserIngredientPreferenceDao> {
    const existing = await this.findByUserAndIngredient(userId, ingredientName);
    if (!existing) throw new Error("Ingredient preference not found");

    const updated: UserIngredientPreferenceDao = { ...existing, preference };
    this.store.set(existing.id, updated);
    return updated;
  }

  async delete(userId: string, ingredientName: string): Promise<void> {
    for (const [id, pref] of this.store.entries()) {
      if (pref.userId === userId && pref.ingredientName === ingredientName) {
        this.store.delete(id);
        return;
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}

export class MockUserCuisinePreferenceRepository implements IUserCuisinePreferenceRepository {
  private store = new Map<string, UserCuisinePreferenceDao>();

  async findByUserId(userId: string): Promise<UserCuisinePreferenceDao[]> {
    return [...this.store.values()].filter((p) => p.userId === userId);
  }

  async findByUserAndCuisine(
    userId: string,
    cuisineType: string,
  ): Promise<UserCuisinePreferenceDao | null> {
    for (const pref of this.store.values()) {
      if (pref.userId === userId && pref.cuisineType === cuisineType) {
        return pref;
      }
    }
    return null;
  }

  async create(
    preference: NewUserCuisinePreferenceDao,
  ): Promise<UserCuisinePreferenceDao> {
    const record: UserCuisinePreferenceDao = {
      id: uuid(),
      userId: preference.userId,
      cuisineType: preference.cuisineType,
      preference: preference.preference,
      createdAt: new Date(),
    };
    this.store.set(record.id, record);
    return record;
  }

  async update(
    userId: string,
    cuisineType: string,
    preference: string,
  ): Promise<UserCuisinePreferenceDao> {
    const existing = await this.findByUserAndCuisine(userId, cuisineType);
    if (!existing) throw new Error("Cuisine preference not found");

    const updated: UserCuisinePreferenceDao = { ...existing, preference };
    this.store.set(existing.id, updated);
    return updated;
  }

  async delete(userId: string, cuisineType: string): Promise<void> {
    for (const [id, pref] of this.store.entries()) {
      if (pref.userId === userId && pref.cuisineType === cuisineType) {
        this.store.delete(id);
        return;
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}
