import type { SessionUser } from "@/types/domain";
import type { ProfileRepository } from "../profile.repository";
import { DEMO_USER, readStorage, writeStorage } from "./local-data";

const KEY = "demo-profile";

export class LocalProfileRepository implements ProfileRepository {
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
    return updated;
  }
}
