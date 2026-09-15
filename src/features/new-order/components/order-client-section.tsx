"use client";

import { Gift, Smartphone, X } from "lucide-react";
import { useState } from "react";

import { ClientFormDialog } from "@/features/clients/components/client-form-dialog";
import { ClientSearchField } from "@/features/clients/components/client-search-field";
import { searchResultFromRecord } from "@/features/clients/types/client-record";
import { searchResultName } from "@/features/clients/types/client-search";
import { orderDisplayClientName } from "@/features/orders/types/order";
import { DoctorPicker } from "@/features/doctors/components/doctor-picker";
import { PhoneInput } from "@/shared/components/form/phone-input";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { BUYER_TYPE_LABEL, ORDER_TYPE_LABEL } from "@/shared/domain/order-type";
import { money } from "@/shared/lib/format/money";
import { phoneFromApi, phoneToApi, formatPhoneInput } from "@/shared/lib/format/phone";
import { cn } from "@/shared/lib/utils";

import {
  selectClientValid,
  selectDoctorRequired,
  selectIsDelivery,
  selectIsEditing,
  useNewOrderStore,
  type NewOrderState,
} from "../store/new-order-store";
import { OrderDateField } from "./order-date-field";

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
    showValidation,
    fieldErrors,
  } = state;

  const isDelivery = selectIsDelivery(state);
  const isEditing = selectIsEditing(state);
  const doctorRequired = selectDoctorRequired(state);
  const clientInvalid = showValidation && !selectClientValid(state);

  /*
   * "Not found" is never a dead end: the empty state offers to create the card
   * right here, over the order, with whatever was typed carried over, and the
   * new client is selected the moment it is saved. Leaving for the clients
   * page mid-order was the single most common interruption at the desk.
   */
  const [newClient, setNewClient] = useState<{ phone: string; name: string } | null>(
    null,
  );

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
          /*
           * The sale-time snapshot first, then the client card, then the last
           * four digits — the same fallback the orders list uses. Reading
           * `clientName` alone left every order whose snapshot is empty (an
           * older sale, a client added later) showing a bare "Mijoz" while the
           * name sat right there on the order's client.
           */
          name={state.editingOrder ? orderDisplayClientName(state.editingOrder) : "Mijoz"}
          phone={
            state.editingOrder?.clientPhone || state.editingOrder?.client.phone || ""
          }
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
            hint="Ism, telefon yoki raqamning bir qismi — qo'shimcha raqamlar ham topiladi"
            error={
              clientInvalid ? "Mijozni tanlang" : (fieldErrors.client_phone?.[0] ?? null)
            }
            emptyAction={{
              label: "Yangi mijoz qo'shish",
              onSelect: (query) => {
                const digits = query.replace(/\D/g, "");
                setNewClient(
                  digits.length >= 7
                    ? { phone: phoneToApi(query), name: "" }
                    : { phone: "", name: query },
                );
              },
            }}
          />
        </div>
      )}

      <ClientFormDialog
        open={newClient !== null}
        onOpenChange={(open) => !open && setNewClient(null)}
        initialPhone={newClient?.phone ?? ""}
        initialName={newClient?.name ?? ""}
        onSaved={(record) => {
          selectClient(searchResultFromRecord(record));
          setNewClient(null);
        }}
        // The number already belongs to someone: that someone is the client.
        onOpenDuplicate={(client) => {
          selectClient(client);
          setNewClient(null);
        }}
      />

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

        <OrderDateField />
      </div>
    </div>
  );
}

function SelectedClientCard({
  client,
  onClear,
}: {
  client: NonNullable<NewOrderState["client"]>;
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
