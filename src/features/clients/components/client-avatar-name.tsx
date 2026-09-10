import { Ban, Smartphone, SmartphoneNfc } from "lucide-react";
import type { ReactNode } from "react";

import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { phoneFromApi } from "@/shared/lib/format/phone";
import { cn } from "@/shared/lib/utils";

/**
 * Avatar + name (+ phone), with the app marker beside the name.
 *
 * The identity block every client-bearing list uses, so a person looks the same
 * whether reception is reading the clients table, a debt row or a visit.
 */
export function ClientAvatarName({
  name,
  phone,
  avatarUrl,
  isAppUser = false,
  isBlocked = false,
  showPhone = true,
  size = 34,
  trailing,
  className,
}: {
  name: string;
  /** API phone value `998XXXXXXXXX`. */
  phone: string;
  avatarUrl?: string | null;
  isAppUser?: boolean;
  isBlocked?: boolean;
  showPhone?: boolean;
  size?: number;
  /** Extra marker after the name (a tag chip, a visit count). */
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <AppAvatar name={name} imageUrl={avatarUrl} size={size} />
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              "text-title-sm truncate",
              isBlocked && "text-text-tertiary line-through",
            )}
          >
            {name}
          </span>
          <ClientAppBadge isAppUser={isAppUser} dense />
          {isBlocked && (
            <Ban className="text-danger size-3.5 shrink-0" aria-label="Bloklangan" />
          )}
          {trailing}
        </span>
        {showPhone && (
          <span className="text-caption text-text-tertiary tabular block truncate">
            {phoneFromApi(phone)}
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * "Ilovada bor / yo'q".
 *
 * Not decoration: a client without the app cannot be reminded about a debt or a
 * visit automatically, so reception has to call them. Every list that can lead
 * to a follow-up shows it.
 */
export function ClientAppBadge({
  isAppUser,
  dense = false,
}: {
  isAppUser: boolean;
  /** Icon only, no label — for a tight table cell. */
  dense?: boolean;
}) {
  const Icon = isAppUser ? Smartphone : SmartphoneNfc;
  const title = isAppUser
    ? "Ilovada bor — eslatma avtomatik yuboriladi"
    : "Ilovada yo'q — qo'ng'iroq qilish kerak";

  if (dense) {
    return (
      <Icon
        className={cn(
          "size-3.5 shrink-0",
          isAppUser ? "text-primary" : "text-text-tertiary",
        )}
        aria-label={title}
      />
    );
  }

  return (
    <span
      title={title}
      className={cn(
        "text-label-xs inline-flex items-center gap-1 rounded-full px-2 py-0.5",
        isAppUser
          ? "bg-primary-soft text-primary-dark"
          : "bg-surface-alt text-text-tertiary",
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {isAppUser ? "Ilovada" : "Ilovasiz"}
    </span>
  );
}
