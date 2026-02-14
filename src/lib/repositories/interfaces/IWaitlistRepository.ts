import type { WaitlistUserDao, NewWaitlistUserDao } from '$repositories/daos';

export interface IWaitlistRepository {
	create(user: NewWaitlistUserDao): Promise<WaitlistUserDao>;
	findByEmail(email: string): Promise<WaitlistUserDao | null>;
	exists(email: string): Promise<boolean>;
}
