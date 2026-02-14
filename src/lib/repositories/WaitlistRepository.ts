import { eq } from 'drizzle-orm';
import type { Database } from '$db/client';
import * as schema from '$db/schema';
import type { IWaitlistRepository } from './interfaces';
import type { WaitlistUserDao, NewWaitlistUserDao } from './daos';

export class WaitlistRepository implements IWaitlistRepository {
	constructor(private db: Database) {}

	async create(user: NewWaitlistUserDao): Promise<WaitlistUserDao> {
		const [created] = await this.db.insert(schema.waitlistUsers).values({
			email: user.email
		}).returning();
		return this.toDao(created);
	}

	async findByEmail(email: string): Promise<WaitlistUserDao | null> {
		const user = await this.db.query.waitlistUsers.findFirst({
			where: eq(schema.waitlistUsers.email, email)
		});
		return user ? this.toDao(user) : null;
	}

	async exists(email: string): Promise<boolean> {
		const user = await this.findByEmail(email);
		return user !== null;
	}

	private toDao(user: typeof schema.waitlistUsers.$inferSelect): WaitlistUserDao {
		return {
			id: user.id,
			email: user.email,
			createdAt: user.createdAt
		};
	}
}
