import { Ban, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { shortDate } from "@/shared/lib/format/date";
import { phoneFromApi } from "@/shared/lib/format/phone";
import { cn } from "@/shared/lib/utils";

import { genderLabel, recordName, type ClientRecord } from "../types/client-record";
import { ClientAppBadge } from "./client-avatar-name";
import { ClientTagChip } from "./client-tag-chip";

/**
 * Who this is, how to reach them, and the two things that change how they must
 * be handled: a warning note (allergies) and a block.
 */
export function ClientProfileHeader({ client }: { client: ClientRecord }) {
  const subtitle = [
    // "~" marks an age typed by hand rather than derived from a birth date —
    // the difference matters when the number is read back to the client.
    client.age !== null ? `${client.ageIsEstimated ? "~" : ""}${client.age} yosh` : null,
    client.gender !== "unknown" ? genderLabel(client) : null,
    client.address !== "" ? client.address : null,
    client.firstSeenAt ? `Bazada: ${shortDate(client.firstSeenAt)} dan` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <AppAvatar name={recordName(client)} imageUrl={client.avatarUrl} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-title-lg">{recordName(client)}</h1>
            <ClientAppBadge isAppUser={client.isAppUser} />
            {client.tags.map((tag) => (
              <ClientTagChip key={tag.code} tag={tag} />
            ))}
          </div>
          <p className="text-body text-text-secondary tabular mt-0.5 select-text">
            {phoneFromApi(client.phone)}
          </p>
          {subtitle !== "" && (
            <p className="text-caption text-text-tertiary mt-0.5">{subtitle}</p>
          )}
          {client.extraPhones.map((extra) => (
            <p key={extra.phone} className="text-caption text-text-tertiary tabular">
              {phoneFromApi(extra.phone)}
              {extra.label !== "" && ` · ${extra.label}`}
            </p>
          ))}
        </div>
      </div>

      {client.isBlocked && (
        <Banner
          icon={Ban}
          tone="danger"
          text={
            client.blockReason === ""
              ? "Mijoz bloklangan"
              : `Mijoz bloklangan: ${client.blockReason}`
          }
        />
      )}

      {client.note.trim() !== "" && (
        <Banner icon={TriangleAlert} tone="warning" text={client.note.trim()} />
      )}
    </div>
  );
}

/** Full-width notice — the block reason and the card note. */
function Banner({
  icon: Icon,
  tone,
  text,
}: {
  icon: LucideIcon;
  tone: "danger" | "warning";
  text: string;
}) {
  return (
    <p
      className={cn(
        "text-caption flex items-start gap-2 rounded-sm border p-3",
        tone === "danger"
          ? "border-danger/30 bg-danger/10 text-danger"
          : "border-warning/30 bg-warning/10 text-warning",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      {text}
    </p>
  );
}
