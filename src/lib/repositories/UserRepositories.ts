import { eq } from 'drizzle-orm';
import type { Database } from '$db/client';
import * as schema from '$db/schema';
import type { IUserRepository, ISessionRepository, IUserPreferencesRepository } from './interfaces';
import type { UserDao, NewUserDao, SessionDao, NewSessionDao, UserPreferencesDao, NewUserPreferencesDao, UpdateUserPreferencesDao } from './daos';

export class UserRepository implements IUserRepository {
	constructor(private db: Database) {}

	async findById(id: string): Promise<UserDao | null> {
		const user = await this.db.query.users.findFirst({
			where: eq(schema.users.id, id)
		});
		return user ? this.toDao(user) : null;
	}

	async findByEmail(email: string): Promise<UserDao | null> {
		const user = await this.db.query.users.findFirst({
			where: eq(schema.users.email, email)
		});
		return user ? this.toDao(user) : null;
	}

	async findByAuthProviderId(authProviderId: string): Promise<UserDao | null> {
		const user = await this.db.query.users.findFirst({
			where: eq(schema.users.authProviderId, authProviderId)
		});
		return user ? this.toDao(user) : null;
	}

	async create(user: NewUserDao): Promise<UserDao> {
		const [created] = await this.db.insert(schema.users).values({
			email: user.email,
			name: user.name,
			role: user.role || 'WAITING',
			avatarUrl: user.avatarUrl || null,
			authProvider: user.authProvider || 'auth0',
			authProviderId: user.authProviderId || null
		}).returning({
			id: schema.users.id,
			email: schema.users.email,
			name: schema.users.name,
			role: schema.users.role,
			avatarUrl: schema.users.avatarUrl,
			createdAt: schema.users.createdAt,
			updatedAt: schema.users.updatedAt
		});
		return created;
	}

	async exists(email: string): Promise<boolean> {
		const user = await this.findByEmail(email);
		return user !== null;
	}

	async updateAuthProviderId(userId: string, authProviderId: string): Promise<void> {
		await this.db.update(schema.users)
			.set({ 
				authProviderId,
				authProvider: 'auth0',
				updatedAt: new Date()
			})
			.where(eq(schema.users.id, userId));
	}

	async findWaitingUsers(): Promise<UserDao[]> {
		const users = await this.db.query.users.findMany({
			where: eq(schema.users.role, 'WAITING'),
			orderBy: (users, { desc }) => [desc(users.createdAt)]
		});
		return users.map(u => this.toDao(u));
	}

	async updateRole(userId: string, role: 'WAITING' | 'USER' | 'ADMIN'): Promise<UserDao> {
		const [updated] = await this.db.update(schema.users)
			.set({ role, updatedAt: new Date() })
			.where(eq(schema.users.id, userId))
			.returning();
			
		if (!updated) throw new Error('User not found');
		
		return this.toDao(updated);
	}

	private toDao(user: typeof schema.users.$inferSelect): UserDao {
		return {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			avatarUrl: user.avatarUrl,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt
		};
	}
}

export class SessionRepository implements ISessionRepository {
	constructor(private db: Database) {}

	async findById(id: string): Promise<SessionDao | null> {
		const session = await this.db.query.sessions.findFirst({
			where: eq(schema.sessions.id, id)
		});
		return session ? this.toDao(session) : null;
	}

	async findByIdWithUser(id: string): Promise<{ session: SessionDao; user: UserDao } | null> {
		const result = await this.db.query.sessions.findFirst({
			where: eq(schema.sessions.id, id),
			with: { user: true }
		});

		if (!result) return null;

		return {
			session: this.toDao(result),
			user: {
				id: result.user.id,
				email: result.user.email,
				name: result.user.name,
				role: result.user.role,
				avatarUrl: result.user.avatarUrl,
				createdAt: result.user.createdAt,
				updatedAt: result.user.updatedAt
			}
		};
	}

	async create(session: NewSessionDao): Promise<SessionDao> {
		const [created] = await this.db.insert(schema.sessions).values({
			id: session.id,
			userId: session.userId,
			expiresAt: session.expiresAt
		}).returning();
		return this.toDao(created);
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(schema.sessions).where(eq(schema.sessions.id, id));
	}

	async updateExpiresAt(id: string, expiresAt: Date): Promise<void> {
		await this.db.update(schema.sessions)
			.set({ expiresAt })
			.where(eq(schema.sessions.id, id));
	}

	private toDao(session: typeof schema.sessions.$inferSelect): SessionDao {
		return {
			id: session.id,
			userId: session.userId,
			expiresAt: session.expiresAt
		};
	}
}

export class UserPreferencesRepository implements IUserPreferencesRepository {
	constructor(private db: Database) {}

	async findByUserId(userId: string): Promise<UserPreferencesDao | null> {
		const prefs = await this.db.query.userPreferences.findFirst({
			where: eq(schema.userPreferences.userId, userId)
		});
		return prefs ? this.toDao(prefs) : null;
	}

	async create(preferences: NewUserPreferencesDao): Promise<UserPreferencesDao> {
		const [created] = await this.db.insert(schema.userPreferences).values({
			userId: preferences.userId,
			allergies: preferences.allergies || [],
			dietaryRestrictions: preferences.dietaryRestrictions || [],
			cuisinePreferences: preferences.cuisinePreferences || [],
			excludedIngredients: preferences.excludedIngredients || [],
			caloricGoal: preferences.caloricGoal ?? null,
			defaultServings: preferences.defaultServings ?? 2
		}).returning();
		return this.toDao(created);
	}

	async update(userId: string, preferences: UpdateUserPreferencesDao): Promise<UserPreferencesDao> {
		const [updated] = await this.db.update(schema.userPreferences)
			.set({
				...preferences,
				updatedAt: new Date()
			})
			.where(eq(schema.userPreferences.userId, userId))
			.returning();
		return this.toDao(updated);
	}

	private toDao(prefs: typeof schema.userPreferences.$inferSelect): UserPreferencesDao {
		return {
			id: prefs.id,
			userId: prefs.userId,
			allergies: prefs.allergies || [],
			dietaryRestrictions: prefs.dietaryRestrictions || [],
			cuisinePreferences: prefs.cuisinePreferences || [],
			excludedIngredients: prefs.excludedIngredients || [],
			caloricGoal: prefs.caloricGoal,
			defaultServings: prefs.defaultServings ?? 2,
			createdAt: prefs.createdAt,
			updatedAt: prefs.updatedAt
		};
	}
}
