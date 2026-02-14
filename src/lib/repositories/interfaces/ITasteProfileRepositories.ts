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
  TasteProfileDao,
} from "../daos";

export interface IUserDietaryProfileRepository {
  findByUserId(userId: string): Promise<UserDietaryProfileDao | null>;
  create(profile: NewUserDietaryProfileDao): Promise<UserDietaryProfileDao>;
  update(
    userId: string,
    profile: UpdateUserDietaryProfileDao,
  ): Promise<UserDietaryProfileDao>;
  delete(userId: string): Promise<void>;
}

export interface IUserAllergyRepository {
  findByUserId(userId: string): Promise<UserAllergyDao[]>;
  findByUserAndAllergen(
    userId: string,
    allergen: string,
  ): Promise<UserAllergyDao | null>;
  create(allergy: NewUserAllergyDao): Promise<UserAllergyDao>;
  update(
    userId: string,
    allergen: string,
    severity: string,
  ): Promise<UserAllergyDao>;
  delete(userId: string, allergen: string): Promise<void>;
}

export interface IUserIngredientPreferenceRepository {
  findByUserId(userId: string): Promise<UserIngredientPreferenceDao[]>;
  findByUserAndIngredient(
    userId: string,
    ingredientName: string,
  ): Promise<UserIngredientPreferenceDao | null>;
  create(
    preference: NewUserIngredientPreferenceDao,
  ): Promise<UserIngredientPreferenceDao>;
  update(
    userId: string,
    ingredientName: string,
    preference: string,
  ): Promise<UserIngredientPreferenceDao>;
  delete(userId: string, ingredientName: string): Promise<void>;
}

export interface IUserCuisinePreferenceRepository {
  findByUserId(userId: string): Promise<UserCuisinePreferenceDao[]>;
  findByUserAndCuisine(
    userId: string,
    cuisineType: string,
  ): Promise<UserCuisinePreferenceDao | null>;
  create(
    preference: NewUserCuisinePreferenceDao,
  ): Promise<UserCuisinePreferenceDao>;
  update(
    userId: string,
    cuisineType: string,
    preference: string,
  ): Promise<UserCuisinePreferenceDao>;
  delete(userId: string, cuisineType: string): Promise<void>;
}
