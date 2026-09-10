"use client";

import { LogOut } from "lucide-react";

import { useAuthStore } from "@/features/auth/store/auth-store";
import { ThemeToggle } from "@/features/theme/components/theme-toggle";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { Button } from "@/shared/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

/** Signed-in user, theme switch and logout, at the foot of the sidebar. */
export function SidebarUserFooter({ collapsed }: { collapsed: boolean }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const name = user?.fullName || "Foydalanuvchi";

  const logoutButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={logout}
          aria-label="Chiqish"
          className="text-text-secondary"
        >
          <LogOut className="size-[18px]" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side={collapsed ? "right" : "top"}>Chiqish</TooltipContent>
    </Tooltip>
  );

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 px-3">
        <AppAvatar name={name} imageUrl={user?.avatarUrl} size={36} />
        <ThemeToggle className="text-text-secondary" />
        {logoutButton}
      </div>
    );
  }

  return (
    <div className="px-3">
      <div
        className={cn(
          "border-border bg-surface-alt flex items-center gap-2 rounded-md border p-2",
        )}
      >
        <AppAvatar name={name} imageUrl={user?.avatarUrl} size={34} />
        <div className="min-w-0 flex-1">
          <p className="text-title-sm truncate">{name}</p>
          <p className="text-caption text-text-tertiary truncate">
            {user?.isAdmin ? "Administrator" : "Qabulxona"}
          </p>
        </div>
        <ThemeToggle className="text-text-secondary" />
        {logoutButton}
      </div>
    </div>
  );
}
