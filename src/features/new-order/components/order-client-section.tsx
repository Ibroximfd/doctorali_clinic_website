"use client";

import { Gift, Smartphone, TriangleAlert, X } from "lucide-react";

import { ClientSearchField } from "@/features/clients/components/client-search-field";
import { searchResultName } from "@/features/clients/types/client-search";
import { DoctorPicker } from "@/features/doctors/components/doctor-picker";
import { DateInput } from "@/shared/components/form/date-input";
import { PhoneInput } from "@/shared/components/form/phone-input";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { BUYER_TYPE_LABEL, ORDER_TYPE_LABEL } from "@/shared/domain/order-type";
import { money } from "@/shared/lib/format/money";
import { nowTashkent, startOfDay } from "@/shared/lib/format/date";
import { phoneFromApi, phoneToApi, formatPhoneInput } from "@/shared/lib/format/phone";
import { cn } from "@/shared/lib/utils";

import {
  selectClientValid,
  selectDoctorRequired,
  selectIsDelivery,
  selectIsEditing,
  selectNeedsConfirmPin,
  useNewOrderStore,
} from "../store/new-order-store";

/** "Kim uchun" — order type, buyer, client, doctor and the sale's date. */
export function OrderClientSection() {
  const state = useNewOrderStore();
  const {
    orderType,
    setOrderType,
    buyerType,
    setBuyerType,
    client,
    selectClient,
    guestName,
    setGuestName,
    guestPhone,
    setGuestPhone,
    doctor,
    setDoctor,
    orderDate,
    setOrderDate,
    showValidation,
    fieldErrors,
  } = state;

  const isDelivery = selectIsDelivery(state);
  const isEditing = selectIsEditing(state);
  const doctorRequired = selectDoctorRequired(state);
  const clientInvalid = showValidation && !selectClientValid(state);

  return (
    <div className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-5 shadow-sm">
      {!isEditing && (
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Buyurtma turi"
            value={orderType}
            options={[
              { value: "clinic", label: ORDER_TYPE_LABEL.clinic },
              { value: "delivery", label: ORDER_TYPE_LABEL.delivery },
            ]}
            onChange={(value) => setOrderType(value as typeof orderType)}
          />
          <div className="flex-1" />
          <Segmented
            label="Kim uchun"
            value={buyerType}
            options={[
              { value: "client", label: BUYER_TYPE_LABEL.client },
              { value: "staff", label: BUYER_TYPE_LABEL.staff },
            ]}
            onChange={(value) => setBuyerType(value as typeof buyerType)}
          />
        </div>
      )}

      {isEditing ? (
        <EditingClientCard
          name={state.editingOrder?.clientName || "Mijoz"}
          phone={state.editingOrder?.clientPhone ?? ""}
        />
      ) : isDelivery ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="guest-name">Mijoz ismi</Label>
            <Input
              id="guest-name"
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              placeholder="Ism familiya"
              aria-invalid={showValidation && guestName.trim() === ""}
              className="h-[46px]"
            />
            {(fieldErrors.client_name?.[0] ??
              (showValidation && guestName.trim() === ""
                ? "Mijoz ismini kiriting"
                : null)) && (
              <p role="alert" className="text-caption text-danger">
                {fieldErrors.client_name?.[0] ?? "Mijoz ismini kiriting"}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guest-phone">Telefon</Label>
            <PhoneInput
              id="guest-phone"
              value={formatPhoneInput(guestPhone)}
              onValueChange={(masked) => setGuestPhone(phoneToApi(masked))}
              aria-invalid={showValidation && guestPhone.length !== 12}
              className="h-[46px]"
            />
            {(fieldErrors.client_phone?.[0] ??
              (showValidation && guestPhone.length !== 12
                ? "Telefon raqamini to'liq kiriting"
                : null)) && (
              <p role="alert" className="text-caption text-danger">
                {fieldErrors.client_phone?.[0] ?? "Telefon raqamini to'liq kiriting"}
              </p>
            )}
          </div>
        </div>
      ) : client ? (
        <SelectedClientCard client={client} onClear={() => selectClient(null)} />
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="client-search">Mijoz</Label>
          <ClientSearchField
            id="client-search"
            onSelect={selectClient}
            error={
              clientInvalid ? "Mijozni tanlang" : (fieldErrors.client_phone?.[0] ?? null)
            }
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="order-doctor">
            Shifokor{" "}
            {!doctorRequired && (
              <span className="text-text-tertiary font-normal">(ixtiyoriy)</span>
            )}
          </Label>
          <DoctorPicker
            id="order-doctor"
            value={doctor}
            onChange={setDoctor}
            onClear={() => setDoctor(null)}
            error={
              fieldErrors.doctor_id?.[0] ??
              (showValidation && doctorRequired && doctor === null
                ? "Shifokorni tanlang"
                : null)
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="order-date">Buyurtma sanasi</Label>
          <DateInput
            id="order-date"
            value={orderDate}
            onChange={setOrderDate}
            placeholder="Bugun"
            toDate={startOfDay(nowTashkent())}
          />
          {selectNeedsConfirmPin(state) && (
            <p className="text-caption text-warning flex items-center gap-1.5">
              <TriangleAlert className="size-3.5" aria-hidden />
              Boshqa kunga yozish uchun PIN-kod so&rsquo;raladi
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SelectedClientCard({
  client,
  onClear,
}: {
  client: NonNullable<ReturnType<typeof useNewOrderStore.getState>["client"]>;
  onClear: () => void;
}) {
  return (
    <div className="border-primary bg-surface flex items-center gap-3 rounded-md border p-3">
      <AppAvatar name={searchResultName(client)} imageUrl={client.avatarUrl} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-title truncate">{searchResultName(client)}</span>
          {client.isAppUser && (
            <span className="bg-info/12 text-info inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold">
              <Smartphone className="size-2.5" aria-hidden />
              Ilovada
            </span>
          )}
          {client.giftStatus?.giftAvailable && (
            <span className="bg-gold/15 text-gold inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold">
              <Gift className="size-2.5" aria-hidden />
              Sovg&rsquo;a tayyor
            </span>
          )}
          {client.openDebt > 0 && (
            <span className="bg-warning/15 text-warning tabular rounded-full px-1.5 py-0.5 text-[10.5px] font-bold">
              Qarz {money.plain(client.openDebt)}
            </span>
          )}
        </div>
        <p className="text-caption text-text-secondary tabular mt-0.5 truncate">
          {phoneFromApi(client.phone)} · {client.visitsCount} tashrif ·{" "}
          {client.ordersCount} buyurtma
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClear}
        aria-label="Mijozni almashtirish"
        className="text-text-tertiary shrink-0"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}

/**
 * The client of an order being edited is fixed — `PATCH orders/{id}/` has no
 * client field at all, because the debt, the gift count and the CRM card all
 * hang off it. Changing who bought something means cancelling and ringing up a
 * new sale.
 */
function EditingClientCard({ name, phone }: { name: string; phone: string }) {
  return (
    <div className="border-border bg-surface-alt/60 flex items-center gap-3 rounded-md border p-3">
      <AppAvatar name={name} size={40} />
      <div className="min-w-0 flex-1">
        <p className="text-title truncate">{name}</p>
        <p className="text-caption text-text-secondary tabular truncate">
          {phoneFromApi(phone)}
        </p>
      </div>
      <span className="text-caption text-text-tertiary shrink-0">
        Tahrirda o&rsquo;zgarmaydi
      </span>
    </div>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="bg-surface-alt inline-flex gap-1 rounded-full p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "text-label-sm rounded-full px-4 py-1.5 transition-colors",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            value === option.value
              ? "bg-surface text-primary-dark shadow-xs"
              : "text-text-secondary hover:text-text-primary",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
