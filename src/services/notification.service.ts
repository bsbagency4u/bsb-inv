import type { Repositories } from "@/repositories/types";
import type { NotificationItem } from "@/types/domain";

export interface NotificationCreateInput {
  title: string;
  description?: string | null;
  type?: "info" | "success" | "warning" | "error";
  href?: string | null;
  userId?: string | null;
}

export class NotificationService {
  constructor(private repos: Repositories) {}

  async list(businessId: string, userId: string, limit = 20): Promise<NotificationItem[]> {
    return this.repos.notifications.list(businessId, userId, limit);
  }

  async create(
    businessId: string,
    input: NotificationCreateInput
  ): Promise<NotificationItem> {
    return this.repos.notifications.create({
      businessId,
      userId: input.userId ?? null,
      title: input.title,
      description: input.description ?? null,
      type: input.type ?? "info",
      href: input.href ?? null,
    });
  }

  async markRead(businessId: string, userId: string, notificationId: string): Promise<void> {
    return this.repos.notifications.markRead(businessId, userId, notificationId);
  }

  async markAllRead(businessId: string, userId: string): Promise<void> {
    return this.repos.notifications.markAllRead(businessId, userId);
  }
}
