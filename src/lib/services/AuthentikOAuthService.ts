import type { Cookies } from "@sveltejs/kit";
import type {
  IUserRepository,
  ISessionRepository,
  IUserPreferencesRepository,
  UserDao,
  SessionDao,
} from "$repositories";
import type {
  IOAuthService,
  Auth0Tokens,
  Auth0UserInfo,
  PKCEChallenge,
} from "./interfaces";

export interface OAuthResult {
  user: UserDao;
  session: SessionDao;
}

function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64URLEncode(str: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array.buffer);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64URLEncode(digest);
}

export class AuthentikOAuthService implements IOAuthService {
  private domain: string;
  private clientId: string;
  private clientSecret: string;
  private callbackUrl: string;
  private slug: string;

  constructor(
    private userRepo: IUserRepository,
    private sessionRepo: ISessionRepository,
    private prefsRepo: IUserPreferencesRepository,
    config: {
      domain: string;
      clientId: string;
      clientSecret: string;
      callbackUrl: string;
      slug?: string;
    },
  ) {
    this.domain = config.domain;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.callbackUrl = config.callbackUrl;
    this.slug = config.slug || "receipt2recipe";
  }

  // Authentik endpoints
  private get authorizeUrl(): string {
    return `https://${this.domain}/application/o/authorize/`;
  }

  private get tokenUrl(): string {
    return `https://${this.domain}/application/o/token/`;
  }

  private get userInfoUrl(): string {
    return `https://${this.domain}/application/o/userinfo/`;
  }

  async generatePKCE(): Promise<PKCEChallenge> {
    const codeVerifier = generateCodeVerifier();
    const state = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    return {
      codeChallenge,
      codeVerifier,
      state,
    };
  }

  async getAuthorizationUrl(
    state: string,
    codeChallenge: string,
  ): Promise<string> {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      scope: "openid profile email",
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    return `${this.authorizeUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
  ): Promise<Auth0Tokens> {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: code,
      redirect_uri: this.callbackUrl,
      code_verifier: codeVerifier,
    });

    const response = await fetch(this.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    return response.json();
  }

  async getUserInfo(accessToken: string): Promise<Auth0UserInfo> {
    const response = await fetch(this.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch user info: ${error}`);
    }

    return response.json();
  }

  async findOrCreateUser(userInfo: Auth0UserInfo): Promise<UserDao> {
    // Authentik returns 'sub' as usual
    const existingByProviderId = await this.userRepo.findByAuthProviderId(
      userInfo.sub,
    );
    if (existingByProviderId) {
      return existingByProviderId;
    }

    // Try to find by email
    const existingByEmail = await this.userRepo.findByEmail(userInfo.email);
    if (existingByEmail) {
      await this.userRepo.updateAuthProviderId(
        existingByEmail.id,
        userInfo.sub,
      );
      return existingByEmail;
    }

    // Create new user
    const newUser = await this.userRepo.create({
      email: userInfo.email,
      name: userInfo.name || userInfo.nickname || userInfo.email.split("@")[0],
      avatarUrl: userInfo.picture || null,
      authProvider: "authentik", // Updated provider name
      authProviderId: userInfo.sub,
    });

    // Create default preferences
    await this.prefsRepo.create({
      userId: newUser.id,
      defaultServings: 2,
    });

    return newUser;
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

  async logout(sessionId: string): Promise<void> {
    await this.sessionRepo.delete(sessionId);
  }

  async completeOAuthFlow(
    code: string,
    codeVerifier: string,
  ): Promise<OAuthResult> {
    const tokens = await this.exchangeCodeForTokens(code, codeVerifier);
    const userInfo = await this.getUserInfo(tokens.access_token);
    const user = await this.findOrCreateUser(userInfo);
    const session = await this.createSession(user.id);
    return { user, session };
  }
}

// Helper to get PKCE data from cookie
export function getPKCECookie(
  cookies: { get: (name: string) => string | undefined },
  state: string,
): { codeVerifier: string; state: string } | null {
  const data = cookies.get(`oauth_${state}`);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setPKCECookie(
  cookies: Cookies,
  state: string,
  codeVerifier: string,
): void {
  cookies.set(`oauth_${state}`, JSON.stringify({ codeVerifier, state }), {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
  });
}

export function deletePKCECookie(cookies: Cookies, state: string): void {
  cookies.delete(`oauth_${state}`, { path: "/" });
}

export {
  getSessionCookie,
  setSessionCookie,
  deleteSessionCookie,
} from "./AuthService";
