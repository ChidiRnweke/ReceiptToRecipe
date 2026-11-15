/** A member's answer to one question in "Needs you". */
export interface NeedsYouAnswer {
	householdId: string;
	userId: string;
	key: string;
	answer: string;
	answeredAt: Date;
}

export interface INeedsYouAnswerRepository {
	/** Records the answer, replacing an earlier answer to the same question. */
	save(answer: NeedsYouAnswer): Promise<NeedsYouAnswer>;
	/** The keys of the questions this member answered. */
	listKeys(householdId: string, userId: string): Promise<string[]>;
}
