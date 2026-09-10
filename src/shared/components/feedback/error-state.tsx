"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";

import { ApiError } from "@/shared/lib/api/errors";
import { Button } from "@/shared/components/ui/button";

/**
 * What a failed load looks like.
 *
 * The server's own Uzbek `message` is shown verbatim — it is written for the
 * desk and is more useful than anything the app could compose. Retry is always
 * offered: most failures here are a flaky link, not a broken screen.
 */
export function ErrorState({
  error,
  onRetry,
  title = "Ma'lumotni yuklab bo'lmadi",
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const message = ApiError.is(error) ? error.message : "Kutilmagan xatolik yuz berdi.";

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center px-6 py-14 text-center"
    >
      <span
        className="bg-danger/10 flex size-[72px] items-center justify-center rounded-full"
        aria-hidden
      >
        <TriangleAlert className="text-danger size-8" />
      </span>
      <p className="text-title mt-4">{title}</p>
      <p className="text-caption text-text-secondary mt-1 max-w-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden />
          Qayta urinish
        </Button>
      )}
    </div>
  );
}
