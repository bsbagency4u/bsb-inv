"use client";

import * as React from "react";
import { Bell, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { NotificationItem } from "@/types/domain";
import { cn, formatDateTime } from "@/lib/utils";

const DEMO_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n-1",
    title: "Low stock: Cotton T-Shirt (White)",
    description: "Only 4 units remaining. Restock soon.",
    type: "warning",
    timestamp: new Date().toISOString(),
    read: false,
  },
  {
    id: "n-2",
    title: "Business profile incomplete",
    description: "Add your GSTIN to finish Phase 1 setup.",
    type: "info",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    read: false,
  },
  {
    id: "n-3",
    title: "Welcome to BSB StockFlow",
    description: "Your workspace is ready.",
    type: "success",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    read: true,
  },
];

const TYPE_STYLES: Record<NotificationItem["type"], string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  error: "text-destructive",
};

const TYPE_ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: TriangleAlert,
};

export function NotificationMenu() {
  const [notifications] = React.useState<NotificationItem[]>(DEMO_NOTIFICATIONS);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        >
          <Bell className="size-4.5" />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
              {unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            notifications.map((notification) => {
              const Icon = TYPE_ICONS[notification.type];
              return (
                <div
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-2.5 rounded-md px-2.5 py-2.5",
                    !notification.read && "bg-primary-muted/50"
                  )}
                >
                  <Icon className={cn("mt-0.5 size-4 shrink-0", TYPE_STYLES[notification.type])} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {notification.title}
                      </p>
                      {!notification.read ? (
                        <Badge variant="info" className="shrink-0">
                          New
                        </Badge>
                      ) : null}
                    </div>
                    {notification.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {notification.description}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDateTime(notification.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
