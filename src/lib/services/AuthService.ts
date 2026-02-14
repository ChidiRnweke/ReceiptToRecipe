import type { Cookies } from "@sveltejs/kit";
import type { ISessionRepository, UserDao, SessionDao } from "$repositories";

export interface AuthResult {
  user: UserDao;
  session: SessionDao;
}

export interface IAuthService {
  logout(sessionId: string): Promise<void>;
  validateSession(
    sessionId: string,
  ): Promise<{ user: UserDao; session: SessionDao } | null>;
  createSession(userId: string): Promise<SessionDao>;
}

function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class AuthService implements IAuthService {
  constructor(private sessionRepo: ISessionRepository) {}

  async logout(sessionId: string): Promise<void> {
    await this.sessionRepo.delete(sessionId);
  }

  async validateSession(
    sessionId: string,
  ): Promise<{ user: UserDao; session: SessionDao } | null> {
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
      expiresAt,
    });
  }
}

// Helper to get user from session cookie
export function getSessionCookie(cookies: {
  get: (name: string) => string | undefined;
}): string | null {
  return cookies.get("session") || null;
}

export function setSessionCookie(cookies: Cookies, sessionId: string): void {
  cookies.set("session", sessionId, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export function deleteSessionCookie(cookies: Cookies): void {
  cookies.delete("session", { path: "/" });
}
