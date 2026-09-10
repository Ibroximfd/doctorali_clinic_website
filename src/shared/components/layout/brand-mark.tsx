"use client";

import { HeartPulse } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "@/shared/lib/utils";

/**
 * The Doctor Ali lockup mark: the logo on the brand gradient, falling back to a
 * monogram icon if the asset is ever missing — the same graceful degradation
 * the Flutter build had via `Image.asset(errorBuilder:)`.
 */
export function BrandMark({
  size = 40,
  radius = "rounded-md",
  className,
}: {
  size?: number;
  radius?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden",
        "from-primary to-primary-dark bg-gradient-to-br",
        radius,
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {failed ? (
        <HeartPulse
          className="text-primary-foreground"
          style={{ width: size * 0.5, height: size * 0.5 }}
        />
      ) : (
        <Image
          src="/images/doctor-ali-logo.png"
          alt=""
          width={size}
          height={size}
          priority
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
