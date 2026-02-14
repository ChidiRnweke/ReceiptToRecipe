import type {
  IReceiptRepository,
  IReceiptItemRepository,
} from "../../src/lib/repositories/interfaces/IReceiptRepositories";
import type {
  ReceiptDao,
  NewReceiptDao,
  UpdateReceiptDao,
  ReceiptWithItemsDao,
  ReceiptStatusDao,
  ReceiptItemDao,
  NewReceiptItemDao,
  UpdateReceiptItemDao,
} from "../../src/lib/repositories/daos";
import { v4 as uuidv4 } from "uuid";

/**
 * Mock implementation of IReceiptRepository for testing
 */
export class MockReceiptRepository implements IReceiptRepository {
  private receipts = new Map<string, ReceiptDao>();
  private itemRepo?: IReceiptItemRepository;

  setItemRepository(itemRepo: IReceiptItemRepository): void {
    this.itemRepo = itemRepo;
  }

  async findById(id: string): Promise<ReceiptDao | null> {
    return this.receipts.get(id) || null;
  }

  async findByIdWithItems(id: string): Promise<ReceiptWithItemsDao | null> {
    const receipt = this.receipts.get(id);
    if (!receipt) return null;

    let items: ReceiptItemDao[] = [];
    if (this.itemRepo) {
      items = await this.itemRepo.findByReceiptId(id);
    }
    return { ...receipt, items };
  }

  async findByUserId(userId: string, limit?: number): Promise<ReceiptDao[]> {
    const results = Array.from(this.receipts.values())
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return limit ? results.slice(0, limit) : results;
  }

  async findByUserIdWithItems(
    userId: string,
    limit?: number,
  ): Promise<ReceiptWithItemsDao[]> {
    const receipts = await this.findByUserId(userId, limit);
    const results: ReceiptWithItemsDao[] = [];
    for (const r of receipts) {
      let items: ReceiptItemDao[] = [];
      if (this.itemRepo) {
        items = await this.itemRepo.findByReceiptId(r.id);
      }
      results.push({ ...r, items });
    }
    return results;
  }

  async create(receipt: NewReceiptDao): Promise<ReceiptDao> {
    const now = new Date();
    const created: ReceiptDao = {
      id: uuidv4(),
      userId: receipt.userId,
      imageUrl: receipt.imageUrl,
      status: receipt.status || "QUEUED",
      rawOcrData: null,
      storeName: receipt.storeName || null,
      purchaseDate: receipt.purchaseDate || null,
      totalAmount: receipt.totalAmount || null,
      currency: receipt.currency || "USD",
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };
    this.receipts.set(created.id, created);
    return created;
  }

  async update(id: string, receipt: UpdateReceiptDao): Promise<ReceiptDao> {
    const existing = this.receipts.get(id);
    if (!existing) throw new Error(`Receipt ${id} not found`);

    const updated: ReceiptDao = {
      ...existing,
      ...receipt,
      id: existing.id,
      userId: existing.userId,
      imageUrl: existing.imageUrl,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.receipts.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.receipts.delete(id);
  }

  async getStatus(id: string): Promise<ReceiptStatusDao | null> {
    const receipt = this.receipts.get(id);
    if (!receipt) return null;
    return {
      status: receipt.status,
      errorMessage: receipt.errorMessage,
    };
  }

  async countByUserId(userId: string): Promise<number> {
    return Array.from(this.receipts.values()).filter((r) => r.userId === userId)
      .length;
  }

  // Test helpers
  getStored(id: string): ReceiptDao | undefined {
    return this.receipts.get(id);
  }

  getAllStored(): ReceiptDao[] {
    return Array.from(this.receipts.values());
  }

  clear(): void {
    this.receipts.clear();
  }
}

/**
 * Mock implementation of IReceiptItemRepository for testing
 */
export class MockReceiptItemRepository implements IReceiptItemRepository {
  private items = new Map<string, ReceiptItemDao>();

  async findById(id: string): Promise<ReceiptItemDao | null> {
    return this.items.get(id) || null;
  }

  async findByReceiptId(receiptId: string): Promise<ReceiptItemDao[]> {
    return Array.from(this.items.values())
      .filter((i) => i.receiptId === receiptId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async create(item: NewReceiptItemDao): Promise<ReceiptItemDao> {
    const created: ReceiptItemDao = {
      id: uuidv4(),
      receiptId: item.receiptId,
      rawName: item.rawName,
      normalizedName: item.normalizedName,
      quantity: item.quantity,
      unit: item.unit,
      unitType: item.unitType,
      price: item.price || null,
      category: item.category || null,
      productGroup: item.productGroup || null,
      createdAt: new Date(),
    };
    this.items.set(created.id, created);
    return created;
  }

  async createMany(items: NewReceiptItemDao[]): Promise<ReceiptItemDao[]> {
    const created: ReceiptItemDao[] = [];
    for (const item of items) {
      created.push(await this.create(item));
    }
    return created;
  }

  async update(
    id: string,
    item: UpdateReceiptItemDao,
  ): Promise<ReceiptItemDao> {
    const existing = this.items.get(id);
    if (!existing) throw new Error(`Item ${id} not found`);

    const updated: ReceiptItemDao = {
      ...existing,
      ...item,
      id: existing.id,
      receiptId: existing.receiptId,
      createdAt: existing.createdAt,
    };
    this.items.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }

  async findLatestByNormalizedName(
    userId: string,
    normalizedName: string,
  ): Promise<
    (ReceiptItemDao & { storeName: string | null; receiptId: string }) | null
  > {
    // This would need user info from receipts in real implementation
    // For mock, search by normalized name and add mock storeName
    const items = Array.from(this.items.values())
      .filter(
        (i) => i.normalizedName.toLowerCase() === normalizedName.toLowerCase(),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (items.length === 0) return null;

    return {
      ...items[0],
      storeName: "Mock Store",
      receiptId: items[0].receiptId,
    };
  }

  // Test helpers
  getStored(id: string): ReceiptItemDao | undefined {
    return this.items.get(id);
  }

  getAllStored(): ReceiptItemDao[] {
    return Array.from(this.items.values());
  }

  clear(): void {
    this.items.clear();
  }
}
