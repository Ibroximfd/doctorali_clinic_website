# CHANGES

What is different in the Next.js panel compared with the Flutter Web build it
replaces. Everything the Flutter app did is here; this file is about the
**deltas** — improvements, deliberate deviations, and the two things that could
not be carried over as they were.

---

## 1. Architecture

|              | Flutter                                                                     | Next.js                                                                         |
| ------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Rendering    | Single-page CanvasKit bundle                                                | App Router: SSR shell + client-side data                                        |
| Server state | BLoC per screen, hand-rolled generation counters to discard stale responses | TanStack React Query (caching, dedupe, out-of-order guard for free)             |
| Client state | BLoC                                                                        | Zustand, and only where a screen has real client state (New Order, auth, theme) |
| Forms        | Manual controllers + `_validate()`                                          | react-hook-form + zod, with the Flutter messages copied verbatim                |
| HTTP         | Dio + interceptors                                                          | `ky` with the same 401 → refresh → retry, single-flight                         |
| Routing      | go_router                                                                   | File routes + `middleware.ts` for the pre-paint redirect                        |

**Rendering decision.** The brief assumed a public site (SSG/ISR for content,
CSR for user data). The audit found the opposite: this is an internal panel
behind a login, where every figure is per-session and must never be cached or
indexed. So there is no SSG and no ISR — pages server-render their shell and
fetch through React Query. `MIGRATION_AUDIT.md` §0 has the full reasoning.

## 2. What got better

**Bookmarkable URLs.** The Flutter build opened the 360° client card as a
dialog; a shift handover meant "search for her again". Here it is
`/clients/12`, and `/clients/phone/998901234567` for the flow where only the
number is known.

**Loading, error and empty states everywhere.** The brief made these mandatory
even where Flutter had none. Every list has a skeleton, an error state with a
retry, and an empty state that offers the action the user actually wants
("Mijoz topilmadi" → "Yangi mijoz").

**The New Order screen was rebuilt around the two things reception does most:**

- _Picking products_ — the whole card is the add button, `/` focuses the search
  from anywhere, ↑/↓ + Enter adds without touching the mouse, and a product
  already in the basket shows a stepper in place instead of a second dialog.
  The basket stays on screen while the catalogue scrolls, so nothing is added
  blind.
- _Changing a price_ — one popover with **Dona narxi** and **Qator summasi**
  linked live, quick −5/−10/−15/−20% buttons and a "Tiklash". The typed SUM is
  what travels to the server as `line_total`, so 100 000 across 3 units bills
  100 000 and not 99 999. The old form could only edit the unit price.

**Draft survival.** The New Order basket is persisted as you type (throttled),
so a closed tab or a reload no longer loses a half-built order.

**Stock counts save as you go.** Counted quantities are posted per line, so an
afternoon of counting survives a closed browser.

**A few numbers that were derivable are now shown**, because the data was
already in the payload and the answer was the point: per-doctor queue counts on
today's visits, days-of-stock cover on a stock card, and the merged-card preview
before a client merge.

**Today's visits moved up the dashboard**, outside the statistics gate: the
queue is what reception acts on, and it should not wait for a period's figures
to load.

## 3. Deliberate deviations

**One locale, wired for more.** The Flutter app was Uzbek-only with no
localisation library, no language switch and no RTL. `next-intl` is configured
with `uz` as the single locale (`src/i18n/`), so adding a second language is a
file plus one list entry — but no strings were invented for languages the
original never had.

**`robots.txt` disallows everything and the sitemap lists only `/login`.**
Both files exist as the brief asked; publishing the shape of an internal system
would be the wrong way to satisfy it. This is also why Lighthouse's SEO score
sits at 63 and cannot go higher: the only failing audit is `is-crawlable`,
which is failing on purpose.

**No local PDF fallback for the daily closing sheet.** Flutter rendered one
client-side when the server's PDF failed. Here `alerts/daily/export/` is the
single source of that document — two renderers meant two layouts that drifted,
and the sheet is signed.

**Receipt printing is unchanged** and deliberately so: the browser posts the
backend's opaque `receipt` payload to the local ESC/POS agent on
`localhost:9110` with a plain `fetch`, never through the authenticated client.

## 4. The palette was retuned

The Flutter colours were carried over first and then deliberately changed,
because the original set failed WCAG AA almost everywhere colour carried
meaning: an overdue-debt figure sat at 2.1:1 against its own chip, a "kam
qoldi" warning at 2.3:1, and white on the brand green at 3.4:1. Those are the
exact figures reception is meant to spot from across a desk.

The hues are the same family — emerald brand, amber warning, red danger, blue
info, gold loyalty — deepened until each one clears 4.5:1 **as text inside its
own tinted chip**, which is how every badge in the panel is built:

| Token                     | Was       | Now       | Contrast in its chip |
| ------------------------- | --------- | --------- | -------------------- |
| `--primary` / `--success` | `#2E9E6B` | `#237952` | 2.96 → **4.55**      |
| `--warning`               | `#E0A020` | `#9A5B12` | 2.08 → **4.59**      |
| `--danger`                | `#D9534F` | `#C0362F` | 3.40 → **4.60**      |
| `--info`                  | `#3E7CB1` | `#2B6CB0` | 3.83 → **4.60**      |
| `--gold`                  | `#E8A33D` | `#8F5D18` | 1.98 → **4.77**      |
| `--text-tertiary`         | `#8A938A` | `#666E66` | 3.17 → **4.53**      |

Two structural changes came with it:

- **`--danger-foreground`** — what goes on a solid red fill. White works in the
  light theme; the dark theme's pale red needs dark text, and hard-coding
  `text-white` was the reason that combination sat at 3:1.
- **`--primary-dark` is lighter than `--primary` in the dark theme.** On a dark
  ground the _stronger_ variant of a colour is the brighter one, and this
  token's job is text on a tinted chip either way.

Chart series stay vivid: they are areas, not text.

`npm run check:contrast` re-runs the audit — it checks body text on all three
surfaces, every solid fill against its foreground token, and every status
colour inside its own 12% tint. It is part of `npm run verify`, so the palette
cannot silently regress.

**One more scanning fix while the colours were open:** an overdue debt now
marks its own row with a red left edge and a faint tint, the way an
out-of-stock shelf and a due visit already did. The page exists to find those
rows, not to read every date.

## 5. Two screens for one order

Choosing products moved to a route of its own, `/new-order/products`. It is the
longest part of an order and it now gets the full width — several columns of
cards instead of the two it had while sharing the page with the client form and
the money panel — and because it is a route rather than an overlay the sidebar
stays put, the browser's Back button works, and a mis-click cannot lose the
basket.

The basket appears on BOTH screens, editable on both: same component, same
store. Quantities, gifts and prices can be corrected while browsing the
catalogue without going back first, and the order page shows the same basket
above the money panel.

**Responsiveness was rebuilt on container queries, not viewport breakpoints.**
That was the actual bug behind the cramped screens: the basket row and the debt
fields used `sm:`, which is true on a wide window even when the box they sit in
is 400px — so the stepper, the gift control and the price were squeezed into a
narrow column and the date picker was cut off. They now respond to their own
container, so the same component lays itself out correctly in a 400px column
and across the full page.

**Escape leaves the catalogue** and returns to the order with the basket
intact — the page is a step in a flow, so it closes like one, and nothing can
be lost by closing it because the basket lives in the store rather than on that
screen.

**The price editor** gained what it was missing: Enter applies, Escape closes,
the live discount is spelled out (`−15% chegirma · 22 500 / dona`), and the
second field only appears when there is more than one unit — with a single unit
the two figures are the same number by definition, and showing both only invited
the question of which one was being edited.

## 6. Made for a desk, not a demo

Four things reception reported after using it, and what each turned out to be:

**The buttons were too small to hit.** shadcn's stock scale starts at 32px,
which is fine for something you read and small for something you use hundreds
of times a shift. The scale is now 40px for `default` and 48px for `lg`, which
clears the 44px touch guideline on the primary actions.

**Scrolling the catalogue moved the page a little and stopped.** The picker's
root had no `flex-1`, so its own scroll area never got a bounded height and the
page scrolled instead of the list. The next page now also loads itself as you
reach the bottom (`useInfiniteScroll`) — a catalogue is browsed by scrolling,
and a "load more" button in the middle of that is a stop sign. The button stays
as the keyboard-reachable fallback.

**"The screen goes dark sometimes."** Lists dimmed to 60% while `isFetching`
was true — which includes the automatic refetch when the tab regains focus. So
switching to another app and back dimmed the whole list for no reason the user
could connect to anything they did. They now dim on `isPlaceholderData`, which
is true only while the PREVIOUS page's rows are still on screen — a page or
filter the user actually changed. A background refresh is now invisible, as it
should be.

**Splitting a payment meant doing arithmetic.** Typing 200 000 into cash left
the desk to work out the rest. Every row now has a `+` that drops the remainder
into it, and there is a one-tap `Qolgan 350 000 → Karta` under the totals. This
is also where the `payments_mismatch` refusals came from: the parts must sum
exactly to what reaches the till, and hand-subtraction is where that broke.

## 7. The order detail

Product pictures and the doctor's face were parsed but never rendered — the
dialog printed names only. Now:

- every line carries its **product thumbnail** (a rounded square, not a circle:
  a bottle cropped into a circle loses the label that identifies it);
- the **client and the doctor each get a card** with their photo, the doctor's
  with the commission percentage the sale actually carries;
- **the payment is shown per till, with its icon and its amount** — "Aralash"
  on its own tells the desk nothing, and the split is the first thing anyone
  asks about when a day's cash does not balance;
- the dialog is 900px instead of 680px, which is what let the above fit without
  crowding.

The doctor's photo is **joined from the doctors list** when the order payload
does not carry one — the same trick the dashboard uses for product images, and
cheap because that list is already cached. `parseDoctorRef` also accepts
`photo` / `image_url` / `image`, which the client ref had always tolerated and
the doctor ref had not.

**A sale opens where you clicked it.** The client card's Buyurtmalar tab used to
navigate to the orders page with a search term, which lost the client you were
reading. It now opens the same detail dialog in place.

**A row opens on any click, not just on the order number.** Reception aims at
the client's name far more often than at the number; the client link inside
still goes to the client card. The same applies to the clients list.

One layout bug came out with it: the badges (`Qarz`, `Sovg'a`, `Dastavka`) sat
in a `shrink-0` box beside the name, so an order with two of them squeezed the
name to nothing and spilled the badges over the doctor column. They now wrap
under the phone and can never be wider than their cell.

## 8. The price is the server's

A box of Alatoo costs 1 370 000 — not nine pieces at 160 000, which is
1 440 000. The basket used to show the second figure while the order was billed
at the first, and the cause was structural: **the server was asked to price the
basket on the order page only.** The catalogue page shows the same basket, had
no preview, and fell back to adding the lines up itself.

`orders/preview/` now runs from `useNewOrderSession`, the hook both pages
already call, so one basket has one price wherever it is shown. Where a figure
still has to stand in — the first moments before the server answers, or a failed
call — it is marked: `≈` on the line, `(taxminiy)` on the sum. Reception is
never shown a computed number that looks like a quoted one.

The product card follows the same rule. It now carries **two buy buttons**:

    ＋ 1 dona                   160 000
    ▣ 1 karobka · 9 dona      1 370 000

Each price is a field the backend sent (`price`, `package_price`). A box the
backend priced no differently shows **no price at all** rather than nine unit
prices multiplied together, and the old "−7% cheaper by the box" badge is gone
with it: it was computed from the same invented number. A row stock can no
longer cover goes flat and says why on hover; a package-only product shows the
box row alone.

## 9. The lists open on today

"Buyurtmalar" and "Muolajalar" opened on the entire history, so the first thing
reception did on every visit was narrow it to today. Both now open on today, the
period chip says which day it is showing (`Bugun · 10 sentabr 2026`), and its ✕
opens the whole history again. A dashboard drill-down still wins — those links
arrive with the period they were filtered by. The period picker gained
**Bugun** and **Kecha** as its first presets.

## 10. What the port had lost

The Flutter app was re-read screen by screen against this one — every
repository method, every page, every dialog. Five things had not made it across,
and all five are back.

**Editing an order was a trip to "Yangi buyurtma".** It is a window of its own
again (`OrderEditDialog`), opened over the list the desk was looking at, closing
back onto it with the filters and scroll position intact. Three things that were
wrong with the old route are fixed with it:

- the edit ran on the app-wide order store, so opening one **took over the
  half-typed new order** waiting on the other page — and saving it wiped that
  order for good. Each form now owns its store (`createNewOrderStore`), and the
  edit's has draft storage switched off: an abandoned edit leaves nothing behind.
- the catalogue lives **inside** the window, so adding a product to an existing
  order no longer means leaving it.
- closing asks first, and a past-day order asks for the PIN — before the save
  from `selectNeedsConfirmPin`, and again if the SERVER counts the day
  differently (`pin_required`), which is the case at midnight and the one the
  app cannot judge for itself. The identical request then goes back out with the
  code.

**The date field read as today on every edit.** Flutter's `order_date_field`
had not been ported as such — the Next field showed the raw `orderDate`, which an
edit deliberately leaves empty, so every order ever opened for editing looked
like it belonged to today. It now opens on the order's own day, and two rules
from the Flutter original came with it: picking another day **keeps the time of
day** (the calendar hands back midnight; a sale rung up at 16:40 would have
jumped to 00:00 and landed at the top of that day's list), and leaving the field
alone sends no `created_at` at all, so an untouched edit keeps the exact
timestamp the server already has. The field also carries "Asl sanaga qaytarish",
the amber backdate styling, and the order's original moment printed underneath.

**The loyalty gift had no UI at all.** The store carried `giftProduct`, the
preview and the save both sent it — but nothing on screen could pick it. The
"Sovg'a (ixtiyoriy)" card is back, shown only for a client the backend says has
earned one, and skippable.

**A recorded service could not be corrected.** `PATCH treatments/{id}/` and its
DELETE were implemented and unreachable. "Tahrirlash" now opens the service's
description, amount, doctor and day; "O'chirish" removes a record that should
never have existed, audited by reason and gated by the PIN. Both ask for the PIN
whenever the day isn't today's, and both retry once on the server's own
`pin_required`.

**A debt could not be written off.** `POST debts/{id}/cancel/` was reachable
from nowhere. It sits under the row's ⋯ menu — one click deeper than paying,
because it cannot be undone — and the reason is required.

**A payout, once made, could not be opened.** The week could be inspected
day → order → product before it was cashed out, and became a single figure the
moment it was paid — which is exactly when a doctor asks where it came from. The
same drill-down now opens from any row of the payout history, with who paid it,
when, and the note; the breakdown itself is one shared component, as it is in
the Flutter app.

## 11. Measured

Lighthouse against the production build:

|                | Desktop          | Mobile preset |
| -------------- | ---------------- | ------------- |
| Performance    | **100**          | 81–91         |
| Accessibility  | **100**          | **100**       |
| Best Practices | **100**          | **100**       |
| SEO            | 63               | 63            |
| LCP            | **0.7 s**        | 3.4–3.8 s     |
| CLS / TBT      | **0** / **0 ms** | 0 / 70–190 ms |

Desktop is the number that describes this product: it is a desk tool on a wired
LAN. The mobile preset throttles the CPU 4× and the link to slow 4G, which no
one running this panel is on; FCP stays at 1.1 s and CLS at 0 even there.

SEO is capped at 63 by exactly one audit, `is-crawlable`, which fails on
purpose — see §3.

Login-page JS is ~280 KB gzipped; the whole app's stylesheet is 32 KB gzipped.

## 12. Nothing was dropped

Every screen, endpoint and rule from `MIGRATION_AUDIT.md` is implemented,
including the subtle backend contracts that are easy to lose in a rewrite:

- split payments must sum to `paid_now`, not to the total;
- `payment_type: "none"` when nothing reaches the till;
- a gift travels as a second `is_gift` line for the same product;
- `Idempotency-Key` on every create, reused across retries — and never on a
  `confirm`;
- `X-Confirm-Pin` for any write outside today;
- a stock balance is never edited by hand, only by a confirmed document;
- an uncounted stock-count line is not a line counted as zero;
- server display text (`*_display`) always wins over a local label.

## 13. The basket's money, fixed where it moved

Reception reported three things after a week on the new panel, and a
screen-by-screen re-read against the Flutter app found what the port had lost
in the warehouse. All of it is in this pass.

**A changed price froze the line.** "3 dona = 100 000" was stored as the typed
sum and sent as `line_total`; adding a fourth unit kept the sum, so the line
showed — and the server billed — 100 000 for four. `resizeLine` now drops the
typed sum the moment the PAID count changes (a quantity step, a gift, a stock
correction) and the per-unit price it produced carries on: 3 → 4 units bills
4 × 33 333, and the figure on screen moves with the stepper again.

**The price editor's ceiling is the natural total.** It used to check the unit
price against the catalog price only, which let a boxed line be priced above
its box price and refused by the server. The ceiling is now
`naturalLineTotal` (the auto-boxed sum when the product sells by the box), the
quick discounts are taken from it, typing it back restores the original price,
and the spread unit price never rounds up to the catalog price — the rule the
Flutter editor already had.

**"Sovg'a" gives the whole line away**, as it did in Flutter, with a split
control underneath for the rarer "one of the nine is free". A boxed line gets
`−1 karobka` / `+1 karobka` in that control and a `+1 karobka` chip beside the
stepper, so a box is one tap in every direction. The quantity itself is
typeable — click the number, type 15 — the keypad every POS puts under its
cart. `Shift+Enter` in the catalogue adds a box; `Ctrl/⌘+Enter` saves the order
from anywhere on the form; the save button carries the amount being taken.

Two counting mistakes went with it: the basket header added gift units on top
of the quantity they are part of, and the "Savatdagi sovg'a" row was printed
with a minus although the products line already excludes it.

**The stock card got its history back.** `warehouse/stock/{id}/` has always
returned the product's recent movements; the card now shows them, with "Barcha
harakatlar" opening the ledger tab already narrowed to that product — and the
ledger's own filter bar can narrow by product too. The card also opens a
goods-in or a write-off on its own product. The write-off form itself is
entered in BOXES and pieces for a boxed product ("2 karobka + 3 dona", with
the conversion spelled out), prints the shelf balance on every line and turns
red before the server can refuse `stock_would_go_negative`, and asks once more
before the balance moves — as the Flutter form did. Its packaging block carries
the piece price (`unit_price`, sent only when touched) with the box-price
check and the two server codes worded for the desk. The Excel export asks for
the period first, as the Flutter app did, instead of silently taking this
month.
