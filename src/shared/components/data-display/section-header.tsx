import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/** Title, optional subtitle and a trailing action for a content section. */
export function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {Icon && (
        <span className="bg-primary-soft flex rounded-[8px] p-2" aria-hidden>
          <Icon className="text-primary size-[18px]" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-title-lg truncate">{title}</h2>
        {subtitle && (
          <p className="text-caption text-text-secondary mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
