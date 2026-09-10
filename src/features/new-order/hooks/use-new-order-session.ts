"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { startDraftPersistence, useNewOrderStore } from "../store/new-order-store";
import { useOrderPreview } from "./use-order-preview";

/**
 * Keeps the order draft alive — and priced — for whichever screen of the flow
 * is open.
 *
 * The order is built across two pages — the basket on one, the catalogue on the
 * other — and the same draft has to survive both the navigation between them
 * and a browser reload. Both pages call this; the store itself is app-scoped,
 * so nothing is handed over.
 *
 * **The pricing belongs here, not on one page.** The basket is shown on both
 * screens, so asking the server what it costs on only one of them left the
 * catalogue adding the lines up itself — which bills nine pieces at nine unit
 * prices, while the server bills the box price. Two screens, one figure.
 */
export function useNewOrderSession(): {
  /** The server is pricing a basket it hasn't priced before. */
  readonly previewPending: boolean;
  /** The pricing call failed — the figures on screen are the local estimate. */
  readonly previewFailed: boolean;
} {
  const hydrate = useNewOrderStore((s) => s.hydrate);
  const notice = useNewOrderStore((s) => s.notice);
  const clearNotice = useNewOrderStore((s) => s.clearNotice);

  useEffect(() => {
    hydrate();
    return startDraftPersistence();
  }, [hydrate]);

  // One-shot notices ("Omborda faqat 2 dona") are events, not state.
  useEffect(() => {
    if (!notice) return;
    toast.info(notice);
    clearNotice();
  }, [notice, clearNotice]);

  const preview = useOrderPreview();
  return { previewPending: preview.isPending, previewFailed: preview.failed };
}
