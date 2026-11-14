import type { CupboardItemDao, NewCupboardItemDao, UpdateCupboardItemDao } from '../daos';

export interface ICupboardItemRepository {
	findByHouseholdId(householdId: string): Promise<CupboardItemDao[]>;
	findById(id: string): Promise<CupboardItemDao | null>;
	findByHouseholdAndItem(householdId: string, itemName: string): Promise<CupboardItemDao | null>;
	create(item: NewCupboardItemDao): Promise<CupboardItemDao>;
	update(id: string, data: UpdateCupboardItemDao): Promise<CupboardItemDao>;
	markDepleted(id: string): Promise<CupboardItemDao>;
	delete(id: string): Promise<void>;
	countByHouseholdId(householdId: string): Promise<number>;
}
