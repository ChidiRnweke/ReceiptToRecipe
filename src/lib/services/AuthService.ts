import { hash, verify } from '@node-rs/argon2';
import type { Cookies } from '@sveltejs/kit';
import type { IUserRepository, ISessionRepository, IUserPreferencesRepository, UserDao, SessionDao } from '$repositories';

export interface AuthResult {
	user: UserDao;
	session: SessionDao;
}

export interface IAuthService {
	createUser(email: string, password: string, name: string): Promise<UserDao>;
	login(email: string, password: string): Promise<AuthResult>;
	logout(sessionId: string): Promise<void>;
	validateSession(sessionId: string): Promise<{ user: UserDao; session: SessionDao } | null>;
	createSession(userId: string): Promise<SessionDao>;
}

function generateSessionId(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export class AuthService implements IAuthService {
	constructor(
		private userRepo: IUserRepository,
		private sessionRepo: ISessionRepository,
		private prefsRepo: IUserPreferencesRepository
	) {}

	async createUser(email: string, password: string, name: string): Promise<UserDao> {
		// Check if user exists
		const existing = await this.userRepo.findByEmail(email);

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
		const user = await this.userRepo.create({
			email,
			name,
			passwordHash
		});

		// Create default preferences
		await this.prefsRepo.create({
			userId: user.id,
			defaultServings: 2
		});

		return user;
	}

	async login(email: string, password: string): Promise<AuthResult> {
		const user = await this.userRepo.findByEmailWithPassword(email);

		if (!user || !user.passwordHash) {
			throw new Error('Invalid email or password');
		}

		const validPassword = await verify(user.passwordHash, password);
		if (!validPassword) {
			throw new Error('Invalid email or password');
		}

		const session = await this.createSession(user.id);

		// Return user without passwordHash
		const { passwordHash: _, ...userWithoutPassword } = user;

		return { user: userWithoutPassword, session };
	}

	async logout(sessionId: string): Promise<void> {
		await this.sessionRepo.delete(sessionId);
	}

	async validateSession(sessionId: string): Promise<{ user: UserDao; session: SessionDao } | null> {
		const result = await this.sessionRepo.findByIdWithUser(sessionId);

		if (!result) {
			return null;
		}

		// Check expiration
		if (Date.now() >= result.session.expiresAt.getTime()) {
			await this.sessionRepo.delete(sessionId);
			return null;
		}

		// Extend session if close to expiring (within 15 days)
		const fifteenDays = 1000 * 60 * 60 * 24 * 15;
		if (Date.now() >= result.session.expiresAt.getTime() - fifteenDays) {
			const newExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days
			await this.sessionRepo.updateExpiresAt(sessionId, newExpiresAt);
			result.session = { ...result.session, expiresAt: newExpiresAt };
		}

		return result;
	}

	async createSession(userId: string): Promise<SessionDao> {
		const sessionId = generateSessionId();
		const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

		return await this.sessionRepo.create({
			id: sessionId,
			userId,
			expiresAt
		});
	}
}

// Helper to get user from session cookie
export function getSessionCookie(cookies: { get: (name: string) => string | undefined }): string | null {
	return cookies.get('session') || null;
}

export function setSessionCookie(
	cookies: Cookies,
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

export function deleteSessionCookie(cookies: Cookies): void {
	cookies.delete('session', { path: '/' });
}
