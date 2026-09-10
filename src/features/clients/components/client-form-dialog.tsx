"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Save, TriangleAlert, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";

import { DateInput } from "@/shared/components/form/date-input";
import { PhoneInput } from "@/shared/components/form/phone-input";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { ApiError } from "@/shared/lib/api/errors";
import {
  addDays,
  nowTashkent,
  startOfDay,
  type TashkentDate,
} from "@/shared/lib/format/date";
import { isPhoneComplete, phoneFromApi, phoneToApi } from "@/shared/lib/format/phone";
import { cn } from "@/shared/lib/utils";

import { useClientSearchQuery } from "../hooks/use-client-search";
import { useUpdateClient, useUpsertClient } from "../hooks/use-clients";
import { clientSchema, type ClientFormValues } from "../schemas/client-schema";
import {
  CLIENT_GENDER_LABEL,
  type ClientGender,
  type ClientRecord,
} from "../types/client-record";
import type { ClientSearchResult } from "../types/client-search";
import { ClientTagsEditor } from "./client-tags-editor";

/** Server field name → form field, for a refused save. */
const FIELD_MAP: Readonly<Record<string, keyof ClientFormValues>> = {
  phone: "phone",
  full_name: "fullName",
  age: "age",
  birth_date: "birthDate",
  address: "address",
  note: "note",
  tags: "tags",
  extra_phones: "extraPhones",
};

/** Nobody in the clinic's records is older than this. */
const OLDEST_YEARS = 100;

/**
 * Creates or edits a client card.
 *
 * What earns this dialog its keep is the live duplicate check: as the number is
 * typed the app asks whether the base already knows it and, if so, says who it
 * is and offers to open their card. Without it the same person accumulates
 * three cards in a month and every history figure quietly becomes wrong.
 */
export function ClientFormDialog({
  open,
  onOpenChange,
  record,
  initialPhone = "",
  initialName = "",
  onSaved,
  onOpenDuplicate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing card; absent means create. */
  record?: ClientRecord | null;
  /** API phone value, pre-filled from a search that found nothing. */
  initialPhone?: string;
  initialName?: string;
  onSaved?: (client: ClientRecord) => void;
  /** Opens the card the typed number already belongs to. */
  onOpenDuplicate?: (client: ClientSearchResult) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <ClientFormBody
          key={record?.id ?? `new:${initialPhone}:${initialName}`}
          record={record ?? null}
          initialPhone={initialPhone}
          initialName={initialName}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
          onOpenDuplicate={onOpenDuplicate}
        />
      )}
    </Dialog>
  );
}

function ClientFormBody({
  record,
  initialPhone,
  initialName,
  onOpenChange,
  onSaved,
  onOpenDuplicate,
}: {
  record: ClientRecord | null;
  initialPhone: string;
  initialName: string;
  onOpenChange: (open: boolean) => void;
  onSaved?: (client: ClientRecord) => void;
  onOpenDuplicate?: (client: ClientSearchResult) => void;
}) {
  const upsert = useUpsertClient();
  const update = useUpdateClient();
  const editing = record?.id != null;
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    register,
    setError,
    setValue,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema({ editing })),
    defaultValues: {
      phone: phoneFromApi(record?.phone ?? initialPhone),
      fullName: record?.fullName ?? initialName,
      gender: record?.gender ?? "unknown",
      birthDate: record?.birthDate ?? null,
      // Only a hand-entered age belongs in this box; one the server derived
      // from a birth date is shown by the date field instead.
      age:
        record && record.birthDate === null && record.age !== null
          ? String(record.age)
          : "",
      address: record?.address ?? "",
      note: record?.note ?? "",
      tags: record ? record.tags.filter((t) => !t.isAuto).map((t) => t.code) : [],
      extraPhones: record
        ? record.extraPhones.map((p) => ({
            phone: phoneFromApi(p.phone),
            label: p.label,
          }))
        : [],
    },
  });

  const extraPhones = useFieldArray({ control, name: "extraPhones" });
  const phone = useWatch({ control, name: "phone" });
  const birthDate = useWatch({ control, name: "birthDate" });

  const duplicate = useDuplicateCheck(editing ? "" : phone);
  const submitting = upsert.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const input = {
      phone: phoneToApi(values.phone),
      fullName: values.fullName,
      gender: values.gender,
      birthDate: (values.birthDate as TashkentDate | null) ?? null,
      // A known birth date always wins; the loose age is only for cards
      // without one, and is never turned into a 1-January birth date — that
      // would greet every such client on New Year's Day.
      age:
        values.birthDate === null && values.age.trim() !== ""
          ? Number(values.age.trim())
          : null,
      address: values.address,
      note: values.note,
      tags: values.tags,
      // Deduplicated by number (the last label wins), and never echoing the
      // main phone back as an "extra".
      extraPhones: dedupeExtras(values.extraPhones, values.phone),
    };

    try {
      const saved =
        record?.id != null
          ? await update.mutateAsync({ id: record.id, input })
          : (await upsert.mutateAsync(input)).client;
      onSaved?.(saved);
      onOpenChange(false);
    } catch (error) {
      if (!ApiError.is(error)) {
        setFormError("Kutilmagan xatolik yuz berdi. Qayta urinib ko'ring.");
        return;
      }
      let matched = false;
      for (const [apiField, messages] of Object.entries(error.fieldErrors)) {
        const field = FIELD_MAP[apiField];
        if (field && messages.length > 0) {
          setError(field, { message: messages[0] });
          matched = true;
        }
      }
      setFormError(matched ? null : error.message);
    }
  });

  const today = startOfDay(nowTashkent());

  return (
    <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto sm:max-w-[560px]">
      <DialogHeader>
        <DialogTitle>{editing ? "Mijozni tahrirlash" : "Yangi mijoz"}</DialogTitle>
        <DialogDescription>
          Telefon raqami kartaning o&rsquo;ziga xosligi — shuning uchun u bir marta
          kiritiladi.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 pt-4">
        <div className="space-y-1.5">
          <Label htmlFor="client-phone">Telefon *</Label>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <PhoneInput
                id="client-phone"
                value={field.value}
                onValueChange={field.onChange}
                disabled={editing}
                autoFocus={!editing && field.value === ""}
                aria-invalid={Boolean(errors.phone)}
                className={cn("h-[46px]", errors.phone && "border-danger")}
              />
            )}
          />
          {editing && (
            <p className="text-caption text-text-tertiary">
              Telefon raqami o&rsquo;zgartirilmaydi.
            </p>
          )}
          <FieldError message={errors.phone?.message} />
          {duplicate && (
            <DuplicateNotice
              duplicate={duplicate}
              onOpen={
                onOpenDuplicate
                  ? () => {
                      onOpenChange(false);
                      onOpenDuplicate(duplicate);
                    }
                  : undefined
              }
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="client-name">Ism familiya *</Label>
          <Input
            id="client-name"
            autoCapitalize="words"
            placeholder="Ism familiya"
            aria-invalid={Boolean(errors.fullName)}
            className={cn("h-[46px]", errors.fullName && "border-danger")}
            {...register("fullName")}
          />
          <FieldError message={errors.fullName?.message} />
        </div>

        <div className="space-y-1.5">
          <Label>Jins</Label>
          <Controller
            control={control}
            name="gender"
            render={({ field }) => (
              <div
                role="radiogroup"
                aria-label="Jins"
                className="border-border bg-surface-alt flex gap-1 rounded-md border p-1"
              >
                {(["unknown", "male", "female"] as ClientGender[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={field.value === option}
                    onClick={() => field.onChange(option)}
                    className={cn(
                      "text-label-sm flex-1 rounded-sm px-2.5 py-2 transition-colors",
                      "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                      field.value === option
                        ? "bg-surface text-text-primary shadow-xs"
                        : "text-text-tertiary hover:text-text-primary",
                    )}
                  >
                    {CLIENT_GENDER_LABEL[option]}
                  </button>
                ))}
              </div>
            )}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
          <div className="space-y-1.5">
            <Label htmlFor="client-birth">Tug&rsquo;ilgan sana</Label>
            <div className="flex gap-2">
              <Controller
                control={control}
                name="birthDate"
                render={({ field }) => (
                  <>
                    <DateInput
                      id="client-birth"
                      value={(field.value as TashkentDate | null) ?? null}
                      onChange={(date) => {
                        field.onChange(date);
                        // A birth date is the better answer; drop the loose age.
                        setValue("age", "");
                      }}
                      fromDate={addDays(today, -OLDEST_YEARS * 365)}
                      toDate={today}
                      placeholder="Sana tanlang"
                      className="h-[46px] flex-1"
                    />
                    {field.value !== null && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Sanani tozalash"
                        className="size-[46px]"
                        onClick={() => field.onChange(null)}
                      >
                        <X className="size-4" aria-hidden />
                      </Button>
                    )}
                  </>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-age">Yosh</Label>
            <Input
              id="client-age"
              inputMode="numeric"
              disabled={birthDate !== null}
              aria-invalid={Boolean(errors.age)}
              className={cn("tabular h-[46px]", errors.age && "border-danger")}
              {...register("age")}
            />
            <FieldError message={errors.age?.message} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="client-address">Manzil</Label>
          <Input id="client-address" className="h-[46px]" {...register("address")} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Qo&rsquo;shimcha raqamlar</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => extraPhones.append({ phone: "", label: "" })}
            >
              <Plus className="size-4" aria-hidden />
              Qo&rsquo;shish
            </Button>
          </div>
          {extraPhones.fields.length === 0 ? (
            <p className="text-caption text-text-tertiary">
              Turmush o&rsquo;rtog&rsquo;i yoki farzandining raqami — qidiruvda ham
              topiladi.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {extraPhones.fields.map((entry, index) => (
                <div key={entry.id} className="space-y-1">
                  <div className="flex gap-2">
                    <Controller
                      control={control}
                      name={`extraPhones.${index}.phone`}
                      render={({ field }) => (
                        <PhoneInput
                          value={field.value}
                          onValueChange={field.onChange}
                          aria-invalid={Boolean(errors.extraPhones?.[index]?.phone)}
                          className={cn(
                            "h-[42px] flex-1",
                            errors.extraPhones?.[index]?.phone && "border-danger",
                          )}
                        />
                      )}
                    />
                    <Input
                      placeholder="Kim?"
                      className="h-[42px] w-[110px]"
                      {...register(`extraPhones.${index}.label`)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Qatorni o'chirish"
                      className="size-[42px]"
                      onClick={() => extraPhones.remove(index)}
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
                  </div>
                  <FieldError message={errors.extraPhones?.[index]?.phone?.message} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Teglar</Label>
          <Controller
            control={control}
            name="tags"
            render={({ field }) => (
              <ClientTagsEditor value={field.value} onChange={field.onChange} />
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="client-note">Izoh</Label>
          <Textarea
            id="client-note"
            rows={2}
            placeholder="Allergiya, ogohlantirish…"
            {...register("note")}
          />
          <FieldError message={errors.note?.message} />
        </div>

        {formError && (
          <p
            role="alert"
            className="bg-danger/10 text-caption text-danger rounded-md p-3"
          >
            {formError}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <span
                className="border-primary-foreground/40 border-t-primary-foreground size-4 animate-spin rounded-full border-2"
                aria-hidden
              />
            ) : editing ? (
              <Save className="size-4" aria-hidden />
            ) : (
              <UserPlus className="size-4" aria-hidden />
            )}
            {editing ? "Saqlash" : "Mijozni qo'shish"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/**
 * Looks the typed number up while it is being typed.
 *
 * Only an exact match counts: the typeahead answers prefixes too, and warning
 * about a different client whose number merely starts the same way would train
 * reception to ignore the notice.
 */
function useDuplicateCheck(maskedPhone: string): ClientSearchResult | null {
  const complete = isPhoneComplete(maskedPhone);
  const { data: results } = useClientSearchQuery(complete ? maskedPhone : "");
  if (!complete) return null;
  const apiPhone = phoneToApi(maskedPhone);
  return results?.find((client) => client.phone === apiPhone) ?? null;
}

function DuplicateNotice({
  duplicate,
  onOpen,
}: {
  duplicate: ClientSearchResult;
  onOpen?: () => void;
}) {
  return (
    <div className="border-warning/30 bg-warning/10 flex items-start gap-2 rounded-md border p-3">
      <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-caption text-text-primary">
          Bu raqam allaqachon bazada:{" "}
          <span className="font-semibold">
            {duplicate.serverDisplayName || duplicate.fullName || "Mijoz"}
          </span>
          {duplicate.visitsCount > 0 && ` · ${duplicate.visitsCount} tashrif`}
        </p>
        {onOpen && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={onOpen}
          >
            Kartasini ochish
          </Button>
        )}
      </div>
    </div>
  );
}

function dedupeExtras(
  entries: readonly { phone: string; label: string }[],
  mainPhone: string,
): { phone: string; label: string }[] {
  const main = phoneToApi(mainPhone);
  const byNumber = new Map<string, string>();
  for (const entry of entries) {
    if (!isPhoneComplete(entry.phone)) continue;
    const api = phoneToApi(entry.phone);
    if (api === main) continue;
    byNumber.set(api, entry.label.trim());
  }
  return [...byNumber].map(([phone, label]) => ({ phone, label }));
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-caption text-danger">
      {message}
    </p>
  );
}
