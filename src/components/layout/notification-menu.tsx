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
import { Spinner } from "@/components/ui/spinner";
import { getClientServices } from "@/services";
import { useSession } from "@/components/providers/session-provider";
import type { NotificationItem } from "@/types/domain";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";

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
  const { user, business } = useSession();
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    if (!user || !business) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getClientServices().notifications.list(business.id, user.id);
        if (active) setNotifications(data);
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [user, business]);

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
          {loading ? (
            <div className="flex items-center justify-center px-3 py-6">
              <Spinner className="size-5 text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="px-3 py-6 text-center text-sm text-destructive">{error}</p>
          ) : notifications.length === 0 ? (
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
