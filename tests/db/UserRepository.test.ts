import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTables, teardownTestDb } from '../helpers/testDb';
import { UserRepository } from '../../src/lib/repositories/UserRepositories';

describe('UserRepository (DB)', () => {
  let db: any;
  let userRepo: UserRepository;

  beforeEach(async () => {
    db = await setupTestDb();
    await cleanTables();
    userRepo = new UserRepository(db);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('create', () => {
    it('should create a user with default role WAITING', async () => {
      const user = await userRepo.create({
        email: 'test@example.com',
        name: 'Test User',
        authProviderId: 'oauth-123',
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
      expect(user.role).toBe('WAITING');
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a user with a specified role', async () => {
      const user = await userRepo.create({
        email: 'admin@example.com',
        name: 'Admin',
        role: 'ADMIN',
        authProviderId: 'oauth-admin',
      });

      expect(user.role).toBe('ADMIN');
    });

    it('should create a user with an avatar URL', async () => {
      const user = await userRepo.create({
        email: 'avatar@example.com',
        name: 'Avatar User',
        avatarUrl: 'https://example.com/avatar.jpg',
        authProviderId: 'oauth-avatar',
      });

      expect(user.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should reject duplicate emails', async () => {
      await userRepo.create({
        email: 'dupe@example.com',
        name: 'First',
        authProviderId: 'oauth-first',
      });

      await expect(
        userRepo.create({
          email: 'dupe@example.com',
          name: 'Second',
          authProviderId: 'oauth-second',
        })
      ).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find an existing user by ID', async () => {
      const created = await userRepo.create({
        email: 'findme@example.com',
        name: 'Find Me',
        authProviderId: 'oauth-findme',
      });

      const found = await userRepo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.email).toBe('findme@example.com');
    });

    it('should return null for a non-existent ID', async () => {
      const found = await userRepo.findById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });

    it('should not expose passwordHash in the returned DAO', async () => {
      const user = await userRepo.create({
        email: 'nopw@example.com',
        name: 'No Password',
        authProviderId: 'oauth-nopw',
      });

      const found = await userRepo.findById(user.id);
      expect(found).not.toBeNull();
      // The DAO should not have passwordHash
      expect('passwordHash' in found!).toBe(false);
    });
  });

  describe('findByEmail', () => {
    it('should find a user by email', async () => {
      await userRepo.create({
        email: 'email@example.com',
        name: 'Email User',
        authProviderId: 'oauth-email',
      });

      const found = await userRepo.findByEmail('email@example.com');

      expect(found).not.toBeNull();
      expect(found!.email).toBe('email@example.com');
    });

    it('should return null for a non-existent email', async () => {
      const found = await userRepo.findByEmail('nonexistent@example.com');
      expect(found).toBeNull();
    });
  });

  describe('findByAuthProviderId', () => {
    it('should find a user by auth provider ID', async () => {
      await userRepo.create({
        email: 'oauth@example.com',
        name: 'OAuth User',
        authProviderId: 'auth0|12345',
      });

      const found = await userRepo.findByAuthProviderId('auth0|12345');

      expect(found).not.toBeNull();
      expect(found!.email).toBe('oauth@example.com');
    });

    it('should return null for non-existent provider ID', async () => {
      const found = await userRepo.findByAuthProviderId('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true for an existing email', async () => {
      await userRepo.create({
        email: 'exists@example.com',
        name: 'Exists',
        authProviderId: 'oauth-exists',
      });

      expect(await userRepo.exists('exists@example.com')).toBe(true);
    });

    it('should return false for a non-existing email', async () => {
      expect(await userRepo.exists('nope@example.com')).toBe(false);
    });
  });

  describe('updateAuthProviderId', () => {
    it('should update the auth provider ID for a user', async () => {
      const user = await userRepo.create({
        email: 'update@example.com',
        name: 'Update User',
      });

      await userRepo.updateAuthProviderId(user.id, 'auth0|new-id');

      const found = await userRepo.findByAuthProviderId('auth0|new-id');
      expect(found).not.toBeNull();
      expect(found!.id).toBe(user.id);
    });
  });

  describe('findWaitingUsers', () => {
    it('should return only users with WAITING role', async () => {
      await userRepo.create({ email: 'waiting1@example.com', name: 'W1', authProviderId: 'w1' });
      await userRepo.create({ email: 'waiting2@example.com', name: 'W2', authProviderId: 'w2' });
      const active = await userRepo.create({ email: 'active@example.com', name: 'Active', role: 'USER', authProviderId: 'a1' });

      const waiting = await userRepo.findWaitingUsers();

      expect(waiting.length).toBe(2);
      expect(waiting.every(u => u.role === 'WAITING')).toBe(true);
      expect(waiting.some(u => u.id === active.id)).toBe(false);
    });

    it('should return empty array when no waiting users', async () => {
      await userRepo.create({ email: 'admin@example.com', name: 'Admin', role: 'ADMIN', authProviderId: 'admin1' });

      const waiting = await userRepo.findWaitingUsers();
      expect(waiting).toEqual([]);
    });

    it('should return waiting users sorted by createdAt descending', async () => {
      const first = await userRepo.create({ email: 'first@example.com', name: 'First', authProviderId: 'f1' });
      const second = await userRepo.create({ email: 'second@example.com', name: 'Second', authProviderId: 'f2' });

      const waiting = await userRepo.findWaitingUsers();

      // Most recent first
      expect(waiting[0].id).toBe(second.id);
      expect(waiting[1].id).toBe(first.id);
    });
  });

  describe('updateRole', () => {
    it('should update a user role', async () => {
      const user = await userRepo.create({
        email: 'role@example.com',
        name: 'Role User',
        authProviderId: 'oauth-role',
      });

      const updated = await userRepo.updateRole(user.id, 'USER');

      expect(updated.role).toBe('USER');
      expect(updated.id).toBe(user.id);
    });

    it('should throw when user not found', async () => {
      await expect(
        userRepo.updateRole('00000000-0000-0000-0000-000000000000', 'USER')
      ).rejects.toThrow('User not found');
    });
  });
});
