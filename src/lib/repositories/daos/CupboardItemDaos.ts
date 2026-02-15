export interface CupboardItemDao {
	id: string;
	userId: string;
	itemName: string;
	quantity: string | null;
	unit: string | null;
	category: string | null;
	addedDate: Date;
	shelfLifeDays: number | null;
	isDepleted: boolean;
	notes: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewCupboardItemDao {
	userId: string;
	itemName: string;
	quantity?: string | null;
	unit?: string | null;
	category?: string | null;
	addedDate?: Date;
	shelfLifeDays?: number | null;
	notes?: string | null;
}

export interface UpdateCupboardItemDao {
	itemName?: string;
	quantity?: string | null;
	unit?: string | null;
	category?: string | null;
	shelfLifeDays?: number | null;
	isDepleted?: boolean;
	notes?: string | null;
}
