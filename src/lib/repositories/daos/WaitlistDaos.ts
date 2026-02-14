export interface WaitlistUserDao {
	id: string;
	email: string;
	createdAt: Date;
}

export interface NewWaitlistUserDao {
	email: string;
}
