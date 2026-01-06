import { hash, verify } from '@node-rs/argon2';
import { db } from '$db/client';
import { sessions, users, userPreferences } from '$db/schema';
import { eq } from 'drizzle-orm';
import type { User, Session, NewUser } from '$db/schema';

export interface AuthResult {
	user: User;
	session: Session;
}

export interface IAuthService {
	createUser(email: string, password: string, name: string): Promise<User>;
	login(email: string, password: string): Promise<AuthResult>;
	logout(sessionId: string): Promise<void>;
	validateSession(sessionId: string): Promise<{ user: User; session: Session } | null>;
	createSession(userId: string): Promise<Session>;
}

function generateSessionId(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export class AuthService implements IAuthService {
	async createUser(email: string, password: string, name: string): Promise<User> {
		// Check if user exists
		const existing = await db.query.users.findFirst({
			where: eq(users.email, email)
		});

		if (existing) {
			throw new Error('User with this email already exists');
		}

		// Hash password
		const passwordHash = await hash(password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});

		// Create user
		const [user] = await db
			.insert(users)
			.values({
				email,
				name,
				passwordHash
			})
			.returning();

		// Create default preferences
		await db.insert(userPreferences).values({
			userId: user.id,
			defaultServings: 2
		});

		return user;
	}

	async login(email: string, password: string): Promise<AuthResult> {
		const user = await db.query.users.findFirst({
			where: eq(users.email, email)
		});

		if (!user || !user.passwordHash) {
			throw new Error('Invalid email or password');
		}

		const validPassword = await verify(user.passwordHash, password);
		if (!validPassword) {
			throw new Error('Invalid email or password');
		}

		const session = await this.createSession(user.id);

		return { user, session };
	}

	async logout(sessionId: string): Promise<void> {
		await db.delete(sessions).where(eq(sessions.id, sessionId));
	}

	async validateSession(sessionId: string): Promise<{ user: User; session: Session } | null> {
		const session = await db.query.sessions.findFirst({
			where: eq(sessions.id, sessionId),
			with: {
				user: true
			}
		});

		if (!session) {
			return null;
		}

		// Check expiration
		if (Date.now() >= session.expiresAt.getTime()) {
			await db.delete(sessions).where(eq(sessions.id, sessionId));
			return null;
		}

		// Extend session if close to expiring (within 15 days)
		const fifteenDays = 1000 * 60 * 60 * 24 * 15;
		if (Date.now() >= session.expiresAt.getTime() - fifteenDays) {
			const newExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days
			await db.update(sessions).set({ expiresAt: newExpiresAt }).where(eq(sessions.id, sessionId));
			session.expiresAt = newExpiresAt;
		}

		return {
			user: session.user,
			session: {
				id: session.id,
				userId: session.userId,
				expiresAt: session.expiresAt
			}
		};
	}

	async createSession(userId: string): Promise<Session> {
		const sessionId = generateSessionId();
		const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

		const [session] = await db
			.insert(sessions)
			.values({
				id: sessionId,
				userId,
				expiresAt
			})
			.returning();

		return session;
	}
}

// Helper to get user from session cookie
export function getSessionCookie(cookies: { get: (name: string) => string | undefined }): string | null {
	return cookies.get('session') || null;
}

export function setSessionCookie(
	cookies: {
		set: (name: string, value: string, options: Record<string, unknown>) => void;
	},
	sessionId: string
): void {
	cookies.set('session', sessionId, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 30 // 30 days
	});
}

export function deleteSessionCookie(cookies: { delete: (name: string, options: Record<string, unknown>) => void }): void {
	cookies.delete('session', { path: '/' });
}
