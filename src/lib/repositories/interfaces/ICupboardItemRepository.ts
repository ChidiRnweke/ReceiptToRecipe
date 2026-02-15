import type { CupboardItemDao, NewCupboardItemDao, UpdateCupboardItemDao } from '../daos';

export interface ICupboardItemRepository {
	findByUserId(userId: string): Promise<CupboardItemDao[]>;
	findById(id: string): Promise<CupboardItemDao | null>;
	findByUserAndItem(userId: string, itemName: string): Promise<CupboardItemDao | null>;
	create(item: NewCupboardItemDao): Promise<CupboardItemDao>;
	update(id: string, data: UpdateCupboardItemDao): Promise<CupboardItemDao>;
	markDepleted(id: string): Promise<CupboardItemDao>;
	delete(id: string): Promise<void>;
	countByUserId(userId: string): Promise<number>;
}
