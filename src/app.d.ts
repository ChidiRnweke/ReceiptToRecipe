import type { User, Session } from '$lib/db/schema';

declare global {
	namespace App {
		interface Locals {
			user: User | null;
			session: Session | null;
		}
		interface PageData {
			user: User | null;
		}
	}
}

export {};
