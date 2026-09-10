import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/**
 * The surface every screen is built from: 18px radius, a hairline border and a
 * two-layer resting shadow, so a card reads as sitting ON the page rather than
 * being drawn onto it.
 *
 * Interactive cards lift on hover. The lift is small on purpose — this is a
 * dense working tool, and a card that jumps is a card that is hard to click.
 */
export function AppCard({
  children,
  className,
  padded = true,
  interactive = false,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  /** Off for cards that own their own padding (tables, tab strips). */
  padded?: boolean;
  interactive?: boolean;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag
      className={cn(
        "border-border bg-surface rounded-lg border shadow-sm",
        padded && "p-5",
        interactive &&
          "hover:border-primary/30 cursor-pointer transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
