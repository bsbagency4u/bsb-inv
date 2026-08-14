"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";

export function UserMenu() {
  const { user, isDemo } = useSession();
  const router = useRouter();

  const handleSignOut = async () => {
    const services = getClientServices();
    await services.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        className="flex h-9 items-center gap-2 rounded-md px-2 transition-colors hover:bg-accent"
      >
        <button type="button" aria-label="User menu">
          <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
          <span className="hidden min-w-0 max-w-[10rem] text-left lg:block">
            <span className="block truncate text-sm font-medium text-foreground">
              {user.fullName}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {user.isOwner ? "Owner" : "Member"}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-semibold text-foreground">{user.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          {isDemo ? (
            <Badge variant="warning" className="mt-1.5">
              Demo session
            </Badge>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => undefined} icon={<UserRound className="size-4" />}>
          <Link href="/profile" className="flex w-full">
            My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => undefined} icon={<Settings className="size-4" />}>
          <Link href="/settings" className="flex w-full">
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          onSelect={handleSignOut}
          icon={<LogOut className="size-4" />}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
