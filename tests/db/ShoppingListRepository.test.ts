import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTables, teardownTestDb } from '../helpers/testDb';
import { ShoppingListItemRepository, ShoppingListRepository } from '../../src/lib/repositories/ShoppingListRepositories';
import { UserRepository } from '../../src/lib/repositories/UserRepositories';

describe('ShoppingListRepository (DB)', () => {
  let db: any;
  let userRepo: UserRepository;
  let listRepo: ShoppingListRepository;
  let itemRepo: ShoppingListItemRepository;
  let userId: string;

  beforeEach(async () => {
    db = await setupTestDb();
    await cleanTables();
    
    // Repos need the DB instance
    userRepo = new UserRepository(db);
    listRepo = new ShoppingListRepository(db);
    itemRepo = new ShoppingListItemRepository(db);

    // Create a user
    const user = await userRepo.create({
        email: 'test@example.com',
        authProviderId: 'google-123',
        name: 'Test User' // Changed from displayName to name based on UserRepository impl
    });
    userId = user.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('getMaxOrderIndex should return number type, not string', async () => {
    const list = await listRepo.create({ userId, name: 'Test List', isActive: true });
    
    // Add an item manually to ensure DB has data
    await itemRepo.create({
        shoppingListId: list.id,
        name: 'Item 1',
        orderIndex: 0
    });

    const maxOrder = await itemRepo.getMaxOrderIndex(list.id);
    
    expect(typeof maxOrder).toBe('number');
    expect(maxOrder).toBe(0);

    // Test arithmetic consistency
    const nextOrder = maxOrder + 1;
    expect(nextOrder).toBe(1);
    expect(nextOrder).not.toBe("01");
  });

  it('getMaxOrderIndex should return -1 for empty list as number', async () => {
    const list = await listRepo.create({ userId, name: 'Empty List', isActive: true });
    const maxOrder = await itemRepo.getMaxOrderIndex(list.id);
    
    expect(typeof maxOrder).toBe('number');
    expect(maxOrder).toBe(-1);
    expect(maxOrder + 1).toBe(0);
  });
});
