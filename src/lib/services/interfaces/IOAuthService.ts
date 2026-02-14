import type { UserDao, SessionDao } from '$repositories';

export interface Auth0Tokens {
	access_token: string;
	token_type: string;
	expires_in: number;
	id_token?: string;
}

export interface Auth0UserInfo {
	sub: string; // Auth0 user ID
	email: string;
	email_verified: boolean;
	name?: string;
	picture?: string;
	nickname?: string;
}

export interface PKCEChallenge {
	codeChallenge: string;
	codeVerifier: string;
	state: string;
}

export interface OAuthResult {
	user: UserDao;
	session: SessionDao;
}

export interface IOAuthService {
	// Generate PKCE challenge for OAuth flow (async to generate code challenge from verifier)
	generatePKCE(): Promise<PKCEChallenge>;

	// Build Auth0 authorization URL
	getAuthorizationUrl(state: string, codeChallenge: string): Promise<string>;

	// Exchange authorization code for tokens (server-side only)
	exchangeCodeForTokens(code: string, codeVerifier: string): Promise<Auth0Tokens>;

	// Get user info from Auth0
	getUserInfo(accessToken: string): Promise<Auth0UserInfo>;

	// Find existing user by Auth0 ID or email, create if not exists
	findOrCreateUser(userInfo: Auth0UserInfo): Promise<UserDao>;

	// Create session for user (uses existing session system)
	createSession(userId: string): Promise<SessionDao>;

	// Validate session by ID
	validateSession(sessionId: string): Promise<{ user: UserDao; session: SessionDao } | null>;

	// Logout - delete session
	logout(sessionId: string): Promise<void>;

	// Complete OAuth flow helper - combines token exchange, user lookup, and session creation
	completeOAuthFlow(code: string, codeVerifier: string): Promise<OAuthResult>;
}
