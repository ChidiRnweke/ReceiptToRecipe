import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb } from '$db/client';
import { WaitlistRepository } from '$repositories/WaitlistRepository';
import { waitlistUsers } from '$db/schema';
import { eq } from 'drizzle-orm';
import type { Database } from '$db/client';

describe('WaitlistRepository Integration', () => {
    let repository: WaitlistRepository;
    let db: Database;

    beforeEach(async () => {
        db = getDb();
        repository = new WaitlistRepository(db);
        // Clean up waitlist table before each test
        await db.delete(waitlistUsers);
    });

    afterEach(async () => {
        // Clean up waitlist table after each test
        await db.delete(waitlistUsers);
    });

    it('should create a new waitlist user', async () => {
        const email = 'test@example.com';
        const user = await repository.create({ email });

        expect(user).toBeDefined();
        expect(user.email).toBe(email);
        expect(user.id).toBeDefined();
        expect(user.createdAt).toBeDefined();

        // Verify in DB
        const storedUser = await repository.findByEmail(email);
        expect(storedUser).toBeDefined();
        expect(storedUser?.email).toBe(email);
    });

    it('should prevent duplicate emails (handled by DB constraint)', async () => {
        const email = 'duplicate@example.com';
        await repository.create({ email });

        await expect(repository.create({ email })).rejects.toThrow();
    });

    it('should check if user exists', async () => {
        const email = 'exists@example.com';
        
        const existsBefore = await repository.exists(email);
        expect(existsBefore).toBe(false);

        await repository.create({ email });

        const existsAfter = await repository.exists(email);
        expect(existsAfter).toBe(true);
    });

    it('should retrieve a user by email', async () => {
        const email = 'retrieve@example.com';
        await repository.create({ email });

        const retrieved = await repository.findByEmail(email);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.email).toBe(email);
    });

    it('should return null for non-existent user', async () => {
        const retrieved = await repository.findByEmail('nonexistent@example.com');
        expect(retrieved).toBeNull();
    });
});
