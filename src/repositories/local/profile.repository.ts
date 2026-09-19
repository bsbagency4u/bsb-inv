import type { SessionUser } from "@/types/domain";
import type { ProfileRepository } from "../profile.repository";
import { DEMO_USER, readStorage, writeStorage } from "./local-data";

const KEY = "demo-profile";
const USERNAMES_KEY = "demo-usernames";

export class LocalProfileRepository implements ProfileRepository {
  private readTaken(): Record<string, string> {
    return readStorage<Record<string, string>>(USERNAMES_KEY, {
      [DEMO_USER.username ?? "demouser"]: DEMO_USER.id,
    });
  }

  private saveTaken(map: Record<string, string>): void {
    writeStorage(USERNAMES_KEY, map);
  }

  async getByUserId(userId: string): Promise<SessionUser | null> {
    const stored = readStorage<SessionUser | null>(KEY, null);
    if (stored && stored.id === userId) return stored;
    return { ...DEMO_USER, id: userId };
  }

  async update(userId: string, input: Partial<SessionUser>): Promise<SessionUser> {
    const current = (await this.getByUserId(userId)) ?? { ...DEMO_USER, id: userId };
    const updated: SessionUser = {
      ...current,
      ...input,
      id: userId,
    };
    writeStorage(KEY, updated);
    if (updated.username) {
      const taken = this.readTaken();
      taken[updated.username.toLowerCase()] = userId;
      this.saveTaken(taken);
    }
    return updated;
  }

  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    const normalized = username.trim().toLowerCase();
    if (!normalized) return false;
    const owner = this.readTaken()[normalized];
    if (!owner) return true;
    return Boolean(excludeUserId && owner === excludeUserId);
  }

  async upsertOwnProfile(
    userId: string,
    input: Partial<SessionUser> & { email?: string }
  ): Promise<SessionUser> {
    return this.update(userId, input);
  }
}
