import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { setupTestDb, cleanTables, teardownTestDb } from "../helpers/testDb";
import {
  UserRepository,
  SessionRepository,
} from "../../src/lib/repositories/UserRepositories";

describe("SessionRepository (DB)", () => {
  let db: any;
  let userRepo: UserRepository;
  let sessionRepo: SessionRepository;
  let userId: string;

  beforeEach(async () => {
    db = await setupTestDb();
    await cleanTables();
    userRepo = new UserRepository(db);
    sessionRepo = new SessionRepository(db);

    const user = await userRepo.create({
      email: "session-test@example.com",
      name: "Session Test User",
      authProviderId: "oauth-session",
    });
    userId = user.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("create", () => {
    it("should create a session with the given ID and expiration", async () => {
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
      const session = await sessionRepo.create({
        id: "test-session-id-123",
        userId,
        expiresAt,
      });

      expect(session.id).toBe("test-session-id-123");
      expect(session.userId).toBe(userId);
      expect(session.expiresAt).toBeInstanceOf(Date);
      // Timestamps may differ slightly due to DB precision
      expect(
        Math.abs(session.expiresAt.getTime() - expiresAt.getTime()),
      ).toBeLessThan(1000);
    });
  });

  describe("findById", () => {
    it("should find an existing session", async () => {
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
      await sessionRepo.create({ id: "find-me-session", userId, expiresAt });

      const found = await sessionRepo.findById("find-me-session");

      expect(found).not.toBeNull();
      expect(found!.id).toBe("find-me-session");
      expect(found!.userId).toBe(userId);
    });

    it("should return null for non-existent session", async () => {
      const found = await sessionRepo.findById("nonexistent-session");
      expect(found).toBeNull();
    });
  });

  describe("findByIdWithUser", () => {
    it("should return session with nested user data", async () => {
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
      await sessionRepo.create({ id: "with-user-session", userId, expiresAt });

      const result = await sessionRepo.findByIdWithUser("with-user-session");

      expect(result).not.toBeNull();
      expect(result!.session.id).toBe("with-user-session");
      expect(result!.session.userId).toBe(userId);
      expect(result!.user.id).toBe(userId);
      expect(result!.user.email).toBe("session-test@example.com");
      expect(result!.user.name).toBe("Session Test User");
      expect(result!.user.role).toBeDefined();
    });

    it("should return null for non-existent session", async () => {
      const result = await sessionRepo.findByIdWithUser("nonexistent");
      expect(result).toBeNull();
    });

    it("should not expose passwordHash in user data", async () => {
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
      await sessionRepo.create({ id: "no-pw-session", userId, expiresAt });

      const result = await sessionRepo.findByIdWithUser("no-pw-session");
      expect(result).not.toBeNull();
      expect("passwordHash" in result!.user).toBe(false);
    });
  });

  describe("delete", () => {
    it("should delete an existing session", async () => {
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
      await sessionRepo.create({ id: "delete-me", userId, expiresAt });

      await sessionRepo.delete("delete-me");

      const found = await sessionRepo.findById("delete-me");
      expect(found).toBeNull();
    });

    it("should not throw when deleting a non-existent session", async () => {
      await expect(sessionRepo.delete("nonexistent")).resolves.not.toThrow();
    });
  });

  describe("updateExpiresAt", () => {
    it("should update the session expiration date", async () => {
      const originalExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24);
      await sessionRepo.create({
        id: "extend-me",
        userId,
        expiresAt: originalExpiry,
      });

      const newExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 60); // 60 days
      await sessionRepo.updateExpiresAt("extend-me", newExpiry);

      const found = await sessionRepo.findById("extend-me");
      expect(found).not.toBeNull();
      expect(
        Math.abs(found!.expiresAt.getTime() - newExpiry.getTime()),
      ).toBeLessThan(1000);
    });
  });
});
