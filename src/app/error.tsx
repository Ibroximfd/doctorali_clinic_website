"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { AppRoutes } from "@/config/routes";
import { Button } from "@/shared/components/ui/button";

/**
 * The route-level error boundary.
 *
 * A failed render must not leave reception on a blank screen mid-shift: the
 * page says what happened, offers to retry the segment (`reset`, which does not
 * reload the app or lose the New Order draft), and always leaves a way back to
 * the dashboard.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="bg-danger/12 flex size-14 items-center justify-center rounded-full">
        <TriangleAlert className="text-danger size-7" aria-hidden />
      </span>
      <div>
        <h1 className="text-title-lg">{t("title")}</h1>
        <p className="text-body-sm text-text-secondary mt-1">{t("message")}</p>
        {/* The digest is what the server log is searchable by — it is the one
            piece of a production error that is actually actionable. */}
        {error.digest && (
          <p className="text-caption text-text-tertiary tabular mt-2">
            Kod: {error.digest}
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw className="size-4" aria-hidden />
          {t("reload")}
        </Button>
        <Button asChild variant="outline">
          <Link href={AppRoutes.dashboard}>{t("toDashboard")}</Link>
        </Button>
      </div>
    </div>
  );
}
