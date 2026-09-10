import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AppRoutes } from "@/config/routes";
import { Button } from "@/shared/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="bg-surface-alt flex size-14 items-center justify-center rounded-full">
        <FileQuestion className="text-text-secondary size-7" aria-hidden />
      </span>
      <div>
        <h1 className="text-title-lg">{t("title")}</h1>
        <p className="text-body-sm text-text-secondary mt-1">{t("message")}</p>
      </div>
      <Button asChild>
        <Link href={AppRoutes.dashboard}>{t("toDashboard")}</Link>
      </Button>
    </div>
  );
}
