import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { AppFactory } from '$lib/factories';
import { setPKCECookie } from '$lib/services';

export const load: PageServerLoad = async ({ cookies, locals }) => {
	// If already logged in, redirect to home
	if (locals.user) {
		throw redirect(302, '/');
	}

	// Generate PKCE challenge
	const oauthService = AppFactory.getOAuthService();
	const pkce = await oauthService.generatePKCE();

	// Store PKCE data in cookie for callback
	setPKCECookie(cookies, pkce.state, pkce.codeVerifier);

	// Get Auth0 authorization URL
	const authUrl = await oauthService.getAuthorizationUrl(pkce.state, pkce.codeChallenge);

	// Redirect to Auth0
	throw redirect(302, authUrl);
};
