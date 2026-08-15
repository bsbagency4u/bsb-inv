import type { NotificationItem } from "@/types/domain";
import type { NotificationRepository } from "../notification.repository";
import { readStorage, writeStorage } from "./local-data";

const KEY = "demo-notifications";

export class LocalNotificationRepository implements NotificationRepository {
  private read(): NotificationItem[] {
    return readStorage<NotificationItem[]>(KEY, []);
  }
  private save(items: NotificationItem[]): void {
    writeStorage(KEY, items);
  }

  async list(businessId: string, userId: string, limit = 20): Promise<NotificationItem[]> {
    return this.read()
      .filter((n) => n.businessId === businessId && (!n.userId || n.userId === userId))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  async create(input: {
    businessId: string;
    userId?: string | null;
    title: string;
    description?: string | null;
    type?: "info" | "success" | "warning" | "error";
    href?: string | null;
  }): Promise<NotificationItem> {
    const item: NotificationItem = {
      id: `notif-${crypto.randomUUID()}`,
      businessId: input.businessId,
      userId: input.userId ?? null,
      title: input.title,
      description: input.description ?? undefined,
      type: input.type ?? "info",
      href: input.href ?? undefined,
      read: false,
      timestamp: new Date().toISOString(),
    };
    const all = this.read();
    all.push(item);
    this.save(all);
    return item;
  }

  async markRead(businessId: string, userId: string, notificationId: string): Promise<void> {
    const all = this.read();
    const index = all.findIndex(
      (n) =>
        n.businessId === businessId &&
        n.id === notificationId &&
        (!n.userId || n.userId === userId)
    );
    if (index !== -1) all[index] = { ...all[index], read: true };
    this.save(all);
  }

  async markAllRead(businessId: string, userId: string): Promise<void> {
    this.save(
      this.read().map((n) =>
        n.businessId === businessId && (!n.userId || n.userId === userId)
          ? { ...n, read: true }
          : n
      )
    );
  }
}
