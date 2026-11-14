/// <reference types="@sveltejs/kit" />
/// <reference types="vite-plugin-pwa/info" />
/// <reference types="vite-plugin-pwa/svelte" />

import type { UserDao, SessionDao } from '$lib/repositories/daos';
import type { Actor } from '$lib/models/household';

declare global {
	namespace App {
		interface Locals {
			user: UserDao | null;
			session: SessionDao | null;
			/** Set whenever `user` is: the user acting within their household. */
			actor: Actor | null;
			/** The browser's IANA time zone from the `tz` cookie; Europe/Brussels until it is known. */
			timeZone: string;
		}
		interface PageData {
			user: UserDao | null;
		}
	}
}

export {};
