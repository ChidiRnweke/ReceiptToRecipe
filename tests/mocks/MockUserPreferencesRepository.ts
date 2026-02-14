import { v4 as uuid } from "uuid";
import type { IUserPreferencesRepository } from "../../src/lib/repositories/interfaces/IUserRepositories";
import type {
  UserPreferencesDao,
  NewUserPreferencesDao,
  UpdateUserPreferencesDao,
} from "../../src/lib/repositories/daos";

export class MockUserPreferencesRepository implements IUserPreferencesRepository {
  private store = new Map<string, UserPreferencesDao>();

  async findByUserId(userId: string): Promise<UserPreferencesDao | null> {
    for (const prefs of this.store.values()) {
      if (prefs.userId === userId) return prefs;
    }
    return null;
  }

  async create(
    preferences: NewUserPreferencesDao,
  ): Promise<UserPreferencesDao> {
    const now = new Date();
    const record: UserPreferencesDao = {
      id: uuid(),
      userId: preferences.userId,
      allergies: preferences.allergies || [],
      dietaryRestrictions: preferences.dietaryRestrictions || [],
      cuisinePreferences: preferences.cuisinePreferences || [],
      excludedIngredients: preferences.excludedIngredients || [],
      caloricGoal: preferences.caloricGoal ?? null,
      defaultServings: preferences.defaultServings ?? 2,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(record.id, record);
    return record;
  }

  async update(
    userId: string,
    preferences: UpdateUserPreferencesDao,
  ): Promise<UserPreferencesDao> {
    const existing = await this.findByUserId(userId);
    if (!existing) throw new Error("Preferences not found");

    const updated: UserPreferencesDao = {
      ...existing,
      ...preferences,
      updatedAt: new Date(),
    };
    this.store.set(existing.id, updated);
    return updated;
  }

  // Test helpers
  clear(): void {
    this.store.clear();
  }
}
