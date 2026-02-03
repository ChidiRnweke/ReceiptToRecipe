import type {
	UserDao,
	NewUserDao,
	SessionDao,
	NewSessionDao,
	UserPreferencesDao,
	NewUserPreferencesDao,
	UpdateUserPreferencesDao
} from '../daos';

export interface IUserRepository {
	findById(id: string): Promise<UserDao | null>;
	findByEmail(email: string): Promise<UserDao | null>;
	findByEmailWithPassword(email: string): Promise<(UserDao & { passwordHash: string | null }) | null>;
	findByAuthProviderId(authProviderId: string): Promise<UserDao | null>;
	create(user: NewUserDao): Promise<UserDao>;
	exists(email: string): Promise<boolean>;
	updateAuthProviderId(userId: string, authProviderId: string): Promise<void>;
}

export interface ISessionRepository {
	findById(id: string): Promise<SessionDao | null>;
	findByIdWithUser(id: string): Promise<{ session: SessionDao; user: UserDao } | null>;
	create(session: NewSessionDao): Promise<SessionDao>;
	delete(id: string): Promise<void>;
	updateExpiresAt(id: string, expiresAt: Date): Promise<void>;
}

export interface IUserPreferencesRepository {
	findByUserId(userId: string): Promise<UserPreferencesDao | null>;
	create(preferences: NewUserPreferencesDao): Promise<UserPreferencesDao>;
	update(userId: string, preferences: UpdateUserPreferencesDao): Promise<UserPreferencesDao>;
}
