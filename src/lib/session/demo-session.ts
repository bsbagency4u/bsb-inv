import { readStorage, removeStorage, writeStorage } from "@/repositories/local/local-data";

const KEY = "demo-session";

export interface DemoSession {
  userId: string;
  email: string;
  signedInAt: string;
}

export function hasDemoSession(): boolean {
  return Boolean(readStorage<DemoSession | null>(KEY, null));
}

export function getDemoSession(): DemoSession | null {
  return readStorage<DemoSession | null>(KEY, null);
}

export function setDemoSession(session: DemoSession): void {
  writeStorage(KEY, session);
}

export function clearDemoSession(): void {
  removeStorage(KEY);
}
