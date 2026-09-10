# MIGRATION_AUDIT.md — `doctor_ali_clinic` (Flutter Web) → `doctor_ali_clinic_next` (Next.js 15)

**Audit sanasi:** 2026-09-09
**Manba loyiha:** `/Users/macbook/Documents/development/projects/doctor_ali_clinic`
**Hajmi:** 516 `.dart` fayl · 74 212 qator
**Maqsad loyiha:** `/Users/macbook/Documents/development/projects/doctor_ali_clinic_next`

---

## 0. Eng muhim topilma — loyihaning haqiqiy tabiati

Topshiriqda "mijozlar uchun ochiq sayt (katalog, ro'yxatga olish, SEO muhim)" deb taxmin qilingan.
**Audit buni tasdiqlamadi.** `doctor_ali_clinic` — bu:

> **Klinika qabulxonasi (reception) uchun ichki admin panel.** `pubspec.yaml`:
> `description: "Doctor Ali Reception — clinic reception admin panel (Flutter Web)."`

Dalillar:

| Belgi                                 | Holat                                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ochiq (auth talab qilmaydigan) sahifa | **Faqat `/login` va `/splash`.** Boshqa 14 ta route to'liq himoyalangan                                                                                 |
| Mijoz ro'yxatdan o'tishi              | **Yo'q.** `reception-client-register-removed`: register/reset endpointlari 2026-09-01 dan 404. Mijozlar mobil ilovada phone+OTP bilan o'zlari kiradilar |
| Katalog / marketing sahifalari        | **Yo'q.** `/products` — bu ichki savdo statistikasi jadvali                                                                                             |
| Login turi                            | `username` (telefon yoki uid) + `parol`, **`is_reception=true` majburiy**                                                                               |
| Ma'lumot tabiati                      | Mijoz shaxsiy ma'lumotlari, qarzlar, kassa, xodim maoshi, ombor — **SEO qat'iyan zararli**                                                              |
| `robots` ehtiyoji                     | `Disallow: /` — indekslash **taqiqlanishi kerak**                                                                                                       |

### Rendering strategiyasi bo'yicha qaror (1-bosqichga asos)

**Qaror: SSR/dinamik Next.js (Docker + `next start`), lekin barcha ma'lumot CSR (React Query) orqali. SSG/ISR ishlatilmaydi.**

Asoslar:

1. **Indekslanadigan kontent umuman yo'q.** ISR/SSG — bu jamoat kontentini keshlash mexanizmi; bu yerda keshlanadigan jamoat kontenti nol.
2. **Auth — `Bearer` token, `localStorage`/xotirada.** Backend `httpOnly` cookie bermaydi (`auth/login/` → `{access, refresh, user}`). Demak server komponent foydalanuvchi tokenini ko'ra olmaydi → server-side data fetching mumkin emas.
3. **CORS + backend joylashuvi.** Backend `https://my.imorganic.uz/api/reception/` — alohida origin. Ma'lumotni browserdan olish allaqachon ishlaydi (CORS ochiq); serverdan olish yangi tarmoq yo'lini va token uzatishni talab qiladi — foydasiz murakkablik.
4. **"Meni eslab qolish" semantikasi.** `remember=false` da tokenlar **faqat xotirada** yashaydi (tab yopilsa yo'qoladi). Bu server-side sessiya bilan takrorlab bo'lmaydi.
5. **Nega baribir `output: "export"` emas:** `middleware.ts` bilan himoyalangan route'larni yo'naltirish, `next/image` optimizatsiyasi, `Dockerfile`+`next start` (CRM/logist panellari bilan bir xil deploy uslubi) — bularning hammasi static export'da yo'qoladi.

**Amalda:** App Router + `export const dynamic = 'force-dynamic'` (yoki oddiy client-component sahifalar), `next/image` `unoptimized: false` + `remotePatterns`, `middleware.ts` — auth cookie sentinel'i orqali. `metadata` har sahifada bor, lekin `robots: { index: false, follow: false }`.

---

## 1. Sahifalar / ekranlar ro'yxati

### 1.1 Marshrutlar (`lib/core/router/routes.dart` + `app_router.dart`)

| #   | Route                                     | Ekran                               | Sidebar bo'limi | State (Bloc)                                                           |
| --- | ----------------------------------------- | ----------------------------------- | --------------- | ---------------------------------------------------------------------- |
| —   | `/splash`                                 | `SplashPage`                        | —               | `AuthBloc`                                                             |
| —   | `/login`                                  | `LoginPage`                         | —               | `AuthBloc`                                                             |
| 1   | `/`                                       | `DashboardPage` — "Statistika"      | Asosiy          | `DashboardBloc`                                                        |
| 2   | `/new-order`                              | `NewOrderPage` — "Yangi buyurtma"   | Asosiy          | `NewOrderBloc` (**app-scoped**, `getIt`)                               |
| 3   | `/appointments`                           | `AppointmentsPage` — "Tashriflar"   | Asosiy          | `AppointmentsListBloc`, `TodayAppointmentsBloc`, `AppointmentFormBloc` |
| 4   | `/clients`                                | `ClientsPage` — "Mijozlar"          | Asosiy          | `ClientsBloc`                                                          |
| 4a  | `/clients/:id`                            | `ClientProfilePage`                 | (sub-route)     | `ClientProfileBloc`, `ClientTimelineBloc`                              |
| 4b  | `/clients/phone/:phone`                   | `ClientProfilePage`                 | (sub-route)     | ⌃                                                                      |
| 5   | `/orders?period=&from=&to=&payment_type=` | `OrdersPage` — "Buyurtmalar"        | Moliya          | `OrdersBloc`, `OrderDetailBloc`                                        |
| 6   | `/treatments`                             | `TreatmentsPage` — "Muolajalar"     | Moliya          | `TreatmentsBloc`, `TreatmentFormBloc`                                  |
| 7   | `/debts`                                  | `DebtsPage` — "Qarzlar"             | Moliya          | `DebtsBloc`                                                            |
| 8   | `/warehouse?filter=low`                   | `WarehousePage` — "Sklad"           | Moliya          | `StockBloc`                                                            |
| 9   | `/payouts`                                | `PayoutsPage` — "To'lovlar"         | Boshqaruv       | `PayoutsBloc`, `WeekDetailBloc`, `PayoutDetailBloc`                    |
| 10  | `/expenses`                               | `ExpensesPage` — "Xarajatlar"       | Boshqaruv       | `ExpensesBloc`                                                         |
| 11  | `/attendance`                             | `AttendancePage` — "Yo'qlama"       | Boshqaruv       | `AttendanceBloc`, `AttendanceStatsBloc`, `EmployeesBloc`               |
| 12  | `/followups`                              | `FollowupsPage` — "Eslatmalar"      | Boshqaruv       | `FollowupsBloc`, `FollowupHistoryBloc`                                 |
| 13  | `/doctors`                                | `DoctorsPage` — "Shifokorlar"       | Boshqaruv       | `DoctorsBloc`                                                          |
| 13a | `/doctors/:id`                            | `DoctorDetailPage`                  | (sub-route)     | `DoctorDetailBloc`                                                     |
| 14  | `/products`                               | `ProductsPage` — "Mahsulotlar"      | Boshqaruv       | `ProductsBloc`                                                         |
| —   | `/client-accounts`                        | **Legacy** → `/clients` ga redirect | —               | —                                                                      |

Sidebar guruhlari **qabulxonaning ish kuni tartibi** bo'yicha (`sidebar.dart`):
`Asosiy` (dashboard, new-order, appointments, clients) → `Moliya` (orders, treatments, debts, warehouse) → `Boshqaruv` (payouts, expenses, attendance, followups, doctors, products).

### 1.2 Shell (`lib/shell/presentation/`)

- `ShellScaffold` — desktop: doimiy sidebar + kontent; mobile: `Drawer`. `ReceiptPrintBloc` shu yerda `BlocProvider.value` bilan barcha sahifalarga beriladi + `ReceiptPrintListener` (global snackbar).
- `Sidebar` (248px kengaygan / 76px yig'ilgan, 240ms animatsiya), `SidebarItem` (hover + selected pill + accent nuqta), `SidebarLogo`, `SidebarUserFooter` (avatar, ism, ThemeToggle, Chiqish).
- `TopBar` (72px) — sahifa sarlavhasi + subtitle + bugungi sana chip + faqat dashboard'da "Yangi buyurtma" tugmasi.

### 1.3 Modal/dialog inventarizatsiyasi (32 ta)

`appointment_form_dialog`, `arrived_dialog`, `appointment_detail_sheet`, `attendance_note_dialog`, `employee_form_dialog`, `client_form_dialog`, `client_import_dialog`, `client_merge_dialog`, `data_quality_dialog`, `client_admin_confirm_dialogs`, `client_profile_dialog`, `daily_closing_dialog` (1060 qator!), `payment_type_income_dialog` (654), `debt_extend_dialog`, `debt_pay_dialog`, `expense_detail_dialog`, `expense_form_dialog`, `followup_contact_sheet`, `followup_custom_range_dialog`, `followup_history_dialog`, `order_edit_dialog`, `total_override_dialog`, `order_detail_dialog` (1057), `payout_detail_dialog`, `week_detail_dialog`, `treatment_edit_dialog`, `treatment_form_dialog`, `receipt_form_dialog`, `stock_detail_sheet` (772), `write_off_form_dialog`, `confirm_dialog`, `pin_confirm_dialog`.

### 1.4 Umumiy (core) widget'lar — 41 ta, `lib/core/widgets/`

`active_filters_bar`, `animated_counter`, `app_avatar`, `app_button`, `app_card`, `app_date_range_picker` (611), `app_image_shimmer`, `app_network_image`, `app_scrollbar`, `catalog_picker_sheet`, `chart_empty_state`, `chart_skeleton`, `client_chip`, `client_search_field` (404), `confirm_dialog`, `confirm_pin_gate`, `debt_editor` (393), `due_date_badge`, `empty_state`, `entity_timeline_tile`, `kpi_period_caption`, `list_reveal`, `loading_indicator`, `mini_stat`, `payment_split_editor` (403), `payment_type_filter_button`, `period_selector`, `pin_confirm_dialog`, `product_thumb`, `quantity_input`, `quantity_stepper`, `quick_date_chips`, `responsive`, `scroll_edge_fade`, `scroll_to_top_button`, `search_field`, `section_header`, `showroom_only_badge`, `stat_kpi_card`, `stat_line_chart`, `stats_filter_header`, `time_series_chart_view`.

---

## 2. API integratsiyasi

**Base URL:** `https://my.imorganic.uz/api/reception/` (`ApiConstants.baseUrl`, trailing slash **majburiy**).
**Media origin:** `https://my.imorganic.uz` (`resolveMediaUrl` — nisbiy `image_url` shu origin'ga nisbatan hal qilinadi, `/api/reception/` sub-path'ga emas).

### 2.1 Autentifikatsiya oqimi

```
POST auth/login/      { username, password } → { access, refresh, user }
GET  auth/me/         → AuthUser (sessiyani validatsiya qiladi)
POST auth/refresh/    { refresh } → { access, refresh? }
POST auth/verify-pin/ { pin } → 200 | 400/401/403 (noto'g'ri) | 429 (bloklangan)
```

- **Header:** `Authorization: Bearer <access>` — `authFree` ro'yxatidagilardan (`auth/login/`, `auth/refresh/`) tashqari barchasiga.
- **401 → refresh → retry:** `QueuedInterceptor` (single-flight). Parallel 401'lar navbatga tushadi; birinchisi refresh qiladi, qolganlari yangi token bilan qayta yuboriladi (ishlatilgan token ≠ joriy token solishtiruvi orqali aniqlanadi). `__retried` flagi cheksiz siklni to'xtatadi. Refresh muvaffaqiyatsiz → storage tozalanadi → `onUnauthorized()` → `AuthSessionExpired` → `/login`.
- **Timeout:** connect 15s, receive 20s. Startup `auth/me/` uchun alohida 8s timeout (splash osilib qolmasligi uchun).
- **Offline tolerantlik:** `AuthCheckRequested` da tarmoq xatosi + keshdagi user bo'lsa → **authenticated qoladi** (ish davom etadi).
- **`validateStatus`:** `< 400` (xato konvertlarini o'zimiz map qilamiz).

### 2.2 Xato konverti (barcha endpointlar uchun yagona)

```json
{
  "error": {
    "code": "validation_error",
    "message": "O'zbekcha xabar",
    "fields": {
      "client_phone": ["..."],
      "items": [{ "product_id": 12, "available": 3, "requested": 5 }]
    }
  }
}
```

`ApiException` → `code`, `message` (foydalanuvchiga to'g'ridan-to'g'ri ko'rsatiladi), `fieldErrors`, `stockIssues` (strukturaviy `insufficient_stock`), `statusCode`, `isNetwork`.

Status → kod/xabar fallback:

| Status     | code               | message                                           |
| ---------- | ------------------ | ------------------------------------------------- |
| 400        | `validation_error` | `Kiritilgan ma'lumot noto'g'ri`                   |
| 401        | `unauthorized`     | `Avtorizatsiya talab qilinadi`                    |
| 403        | `forbidden`        | `Ruxsat yo'q`                                     |
| 404        | `not_found`        | `Ma'lumot topilmadi`                              |
| javob yo'q | `network`          | `Internet bilan aloqa yo'q. Qayta urinib ko'ring` |
| boshqa     | `server_error`     | `Serverda xatolik yuz berdi`                      |

### 2.3 To'liq endpoint katalogi (`ApiConstants`)

<details><summary><b>Auth</b></summary>

`auth/login/` · `auth/refresh/` · `auth/me/` · `auth/verify-pin/`
</details>

<details><summary><b>Katalog</b></summary>

`clients/` (`?phone=` — legacy lookup, **paginatsiyasiz** `{results:[]}`) · `doctors/` (`?search=&page=`) · `products/` (`?search=&page=&ordering=`)
</details>

<details><summary><b>Clients (CRM)</b></summary>

`clients/` (GET list `?page=&search=&tag=&has_debt=&debt_status=&is_app_user=&gender=&source=&ordering=`; POST upsert)
`clients/{id}/` (GET/PATCH) · `clients/search/?q=&limit=` · `clients/profile/?phone=` · `clients/duplicates/` · `clients/merge/` · `clients/tags/` · `clients/export/` · `clients/import/`
`clients/{id}/timeline/` `?page=&kind[]=&date_from=&date_to=` · `/orders/` · `/visits/` · `/treatments/` · `/debts/` · `/notes/` · `/tags/` · `/block/` · `/unblock/` · `/anonymize/` · `/recompute/`
</details>

<details><summary><b>Orders</b></summary>

`orders/` (GET `?page=&ordering=&date_from=&date_to=&doctor_id=&search=&payment_type=&order_type=&has_debt=&debt_status=&due_from=&due_to=&client_id=`; POST create)
`orders/{id}/` (GET / PATCH edit / **DELETE** — body: `{reason}`) · `orders/preview/` (POST) · `orders/{id}/cancel/` · `orders/{id}/receipt/`
</details>

<details><summary><b>Treatments</b></summary>

`treatments/` (GET/POST) · `treatments/{id}/` (GET/PATCH/DELETE) · `treatments/preview/` · `treatments/summary/` · `treatments/types/` · `treatments/{id}/cancel/`
</details>

<details><summary><b>Debts</b></summary>

`debts/` · `debts/summary/` · `debts/export/` · `debts/{id}/` (GET/PATCH) · `debts/{id}/pay/` · `debts/{id}/cancel/`
</details>

<details><summary><b>Appointments</b></summary>

`appointments/` (GET/POST) · `appointments/today/?date=` · `appointments/{id}/` (PATCH) · `/arrived/` · `/cancel/`
</details>

<details><summary><b>Warehouse (sklad)</b></summary>

`warehouse/stock/` · `warehouse/stock/{productId}/` (GET/PATCH) · `warehouse/movements/` · `warehouse/summary/` · `warehouse/export/`
`warehouse/receipts/` (+ `/{id}/`, `/{id}/confirm/`, `/{id}/cancel/`)
`warehouse/write-offs/` (+ `/{id}/`, `/{id}/confirm/`, `/{id}/cancel/`)
`warehouse/counts/` (+ `/{id}/`, `/{id}/confirm/`)
</details>

<details><summary><b>Statistics</b></summary>

`statistics/dashboard/` · `statistics/products/` · `statistics/doctors/` · `statistics/doctors/{id}/` · `statistics/payment-type/?type=` · `statistics/clients/` · `statistics/services/` · `statistics/cashflow/` · `statistics/export/` (binary `.xlsx`)
</details>

<details><summary><b>Payouts / Expenses / Attendance / Alerts / Followups</b></summary>

`payouts/outstanding/` · `payouts/week/?doctor_id=&week_start=` · `payouts/pay/` · `payouts/` · `payouts/{id}/` · `payouts/{id}/cancel/`
`expenses/` · `expenses/{id}/` · `expenses/summary/`
`employees/` · `employees/{id}/` · `attendance/` (GET/POST) · `attendance/statistics/`
`alerts/` · `alerts/daily/?date=` · `alerts/daily/close/` · `alerts/daily/export/?format=pdf|xlsx` · `alerts/data-quality/` · `notifications/logs/?client_id=`
`followups/` · `followups/{clientId}/contact/` · `followups/{clientId}/history/`
</details>

### 2.4 Kesib o'tuvchi API qoidalari (BULAR PORTDA SAQLANISHI SHART)

| Qoida                    | Tafsilot                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Paginatsiya**          | DRF: `{count, next, previous, results}`. Istisno: `clients/?phone=` va `appointments/today/` — konvertsiz                                                                                                                                                                                                                       |
| **Idempotency-Key**      | `POST orders/`, `POST treatments/`, `POST appointments/`, `POST debts/{id}/pay/`, `POST warehouse/receipts/`, `POST warehouse/write-offs/` — UUID v4, **bitta submission uchun bitta kalit, har retry'da bir xil**. `confirm` endpointlarida **yo'q** (server o'zi idempotent; static kalit 24 soat eskirgan javobni qaytaradi) |
| **`X-Confirm-Pin`**      | Bugundan boshqa kunga tegadigan **har qanday** yozuv: backdate order/treatment, edit, cancel, DELETE, kunni qayta yopish. Avval `auth/verify-pin/`, keyin header bilan yozuv                                                                                                                                                    |
| **Sana formati**         | `date`: `YYYY-MM-DD`. Timestamp: `YYYY-MM-DDTHH:mm:ss+05:00` (Asia/Tashkent, **fiksirlangan UTC+5, DST yo'q**)                                                                                                                                                                                                                  |
| **`date_to` inklyuziv**  | Ilova ichida `DateRange.end` **eksklyuziv** → so'rovda `end - 1 kun` yuboriladi                                                                                                                                                                                                                                                 |
| **Telefon**              | API: `998XXXXXXXXX` (12 raqam, `+` **yo'q**). UI: `+998 (90) 123-45-67`                                                                                                                                                                                                                                                         |
| **Pul**                  | Butun so'm (`int`), kasr yo'q. Format: `1 250 000 so'm` (bo'sh joy ajratkich)                                                                                                                                                                                                                                                   |
| **Foiz**                 | **Yaxlitlanmaydi**: `10.0 → "10%"`, `12.5 → "12.5%"`, `33.333 → "33.333%"`                                                                                                                                                                                                                                                      |
| **Server matni ustuvor** | `status_display`, `kind_display`, `source_display`, `display_name`, `payment_type_display` — server yuborsa **aynan shu ko'rsatiladi**, lokal label faqat fallback                                                                                                                                                              |
| **Noma'lum enum**        | `unknown` a'zosi bilan yutiladi (`ClientSource`, `ClientEventKind`, `StockMovementType`, `ReceptionAlertKind`, `PayoutSource`) — yangi backend qiymati **hech qachon crash qilmasligi kerak**                                                                                                                                   |
| **Pul hisobi = backend** | `orders/preview/`, `treatments/preview/` — ilova hech qachon o'zi hisoblamaydi. Lokal `OrderTotals` faqat preview yetib kelmaguncha "taxminiy" sifatida                                                                                                                                                                         |
| **Eksport**              | `responseType: bytes`, fayl nomi `Content-Disposition` dan, `FileSaver` → Blob + `<a download>`                                                                                                                                                                                                                                 |

---

## 3. State management

### 3.1 Arxitektura

**flutter_bloc (faqat Bloc, Cubit yo'q)** + **get_it** service locator. Har feature: `Bloc` + `Event` (sealed) + `State` (yagona immutable klass, `Equatable`, `copyWith`, `DataStatus` enum).

`DataStatus`: `initial | loading | success | failure` — barcha ma'lumot bloc'larida umumiy.

### 3.2 Global (app-scoped) state

| Nima                     | Qayerda                                   | Umri                                                                                                                |
| ------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **`AuthBloc`**           | `main.dart`, `MultiBlocProvider`          | App umri. `go_router.refreshListenable` shunga ulangan                                                              |
| **`ThemeBloc`**          | `main.dart`                               | App umri. `ThemeStorage` (localStorage `theme_mode`) dan **sinxron** o'qiladi → birinchi kadr to'g'ri temada        |
| **`NewOrderBloc`**       | `getIt` lazy singleton                    | App umri — **sahifalar orasida yo'qolmaydi** + `NewOrderDraftStorage` orqali **browser reload'dan ham omon qoladi** |
| **`ReceiptPrintBloc`**   | `getIt` lazy singleton                    | App umri — chek chop etish saqlashdan keyin ham davom etadi                                                         |
| **`ClientProfileCache`** | `getIt` lazy singleton                    | LRU, 5 ta karta, **persist qilinmaydi** (qarz/tashrif soni kun davomida o'zgaradi)                                  |
| **`CatalogSignal`**      | `getIt` lazy singleton (`ChangeNotifier`) | Warehouse mahsulot paketini o'zgartirsa → New Order picker eshitadi va qayta yuklaydi                               |
| **`TokenStorage`**       | `getIt` singleton                         | 2 rejim (pastga qarang)                                                                                             |

### 3.3 Token saqlash — ikki rejim (`TokenStorage`)

| "Meni eslab qolish"      | Qayerda                                                                                                 | Omon qolishi                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------ |
| ✅ belgilangan (default) | `shared_preferences` = **localStorage** kalitlari: `auth_access`, `auth_refresh`, `auth_user`           | Browser qayta ishga tushsa ham |
| ❌ belgilanmagan         | **Faqat xotirada** (`_memAccess`, `_memRefresh`, `_memUser`). localStorage'ga **hech narsa yozilmaydi** | Tab yopilsa yo'qoladi          |

Xom parol **hech qachon** saqlanmaydi. Refresh rotatsiyasi joriy rejimga yoziladi.

### 3.4 New Order draft (localStorage)

`new_order_draft_v1` + `new_order_draft_saved_at_v1`. **12 soatdan eski draft tashlab yuboriladi** (oldingi smenaga tegishli). Yozuv `250ms` throttle bilan (tez yozuvchi → chorak sekundiga 1 yozuv). Muvaffaqiyatli saqlashdan **darhol keyin** draft o'chiriladi (reload dublikat yaratmasligi uchun).

Draft'ga kirmaydigan maydonlar: qidiruv natijalari, submit status, validatsiya xatolari, `orderDate` (ertaga tiklangan forma kechagi sanani saqlab qolmasligi kerak).

### 3.5 Boshqa persist qilinadigan holatlar

| Kalit                        | Nima                                                     |
| ---------------------------- | -------------------------------------------------------- |
| `theme_mode`                 | `light` \| `dark`                                        |
| `receipt_print_attempted_v1` | Chek chop etishga urinilgan order id'lar (max 500, FIFO) |

---

## 4. Marshrutlash (routing)

### 4.1 Guard mantiqi (`AppRouter.create` → `redirect`)

```
status == unknown         → /splash?from=<encoded original URL>
status == unauthenticated → /login?from=<encoded original URL>
status == authenticated && (at /login || at /splash) → restore(from) yoki /
legacy /client-accounts*  → /clients
```

`?from=` — **browser reload'da foydalanuvchi turgan sahifaga qaytish** mexanizmi (masalan `/doctors` da F5 → `/doctors`).

### 4.2 Query/path parametrlar

| Route                   | Parametrlar                                                                                                               | Semantika                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/orders`               | `period` (`daily\|weekly\|monthly\|yearly\|custom`), `from`, `to` (`YYYY-MM-DD`), `payment_type` (`cash\|card\|terminal`) | Dashboard karta → "Barchasi" — filtr sakrashda saqlanadi. Flutter'da `ValueKey('orders-${query}')` sahifani qayta quradi |
| `/warehouse`            | `filter=low`                                                                                                              | Dashboard stock alert → to'g'ridan-to'g'ri kam qolgan mahsulotlar                                                        |
| `/clients/:id`          | `id` (int)                                                                                                                | 360° mijoz kartasi                                                                                                       |
| `/clients/phone/:phone` | `phone` (`998…`)                                                                                                          | Faqat raqam ma'lum bo'lgan oqim                                                                                          |
| `/doctors/:id`          | `id`                                                                                                                      | Shifokor statistikasi                                                                                                    |

### 4.3 Sahifa o'tishlari

`CustomTransitionPage` — 260ms fade + 2% pastdan slide, `Curves.easeOutCubic`.

---

## 5. Formalar va validatsiya

**Muhim:** Validatsiya `TextFormField.validator` da EMAS — u **bloc state'ining getter'lari** ichida yashaydi (`showValidation` flagi bilan). Faqat login sahifasida klassik validator bor.

### 5.1 Login

| Maydon     | Qoida                    | Xabar               |
| ---------- | ------------------------ | ------------------- |
| `username` | bo'sh emas               | `Login kiriting`    |
| `password` | bo'sh emas               | `Parol kiriting`    |
| `remember` | checkbox, default `true` | `Meni eslab qolish` |

Browser `AutofillGroup` + `TextInput.finishAutofillContext(shouldSave: true/false)` — muvaffaqiyatda saqlashni taklif qiladi, xatoda yo'q.

### 5.2 New Order (`NewOrderState`) — eng murakkab forma

| Tekshiruv        | Shart                                                                                                                                                                           | Xabar                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `clientValid`    | Klinika: `selectedClient != null`. Dastavka: `guestName.trim()` bo'sh emas **va** `guestPhone.length == 12`. **Edit rejimida — har doim `true`** (mijoz PATCH kontraktida yo'q) | `Mijozni tanlang` / `Mijoz ismini kiriting` / `Telefon raqamini to'liq kiriting`               |
| `cart`           | bo'sh emas                                                                                                                                                                      | `Kamida bitta mahsulot qo'shing` (blocker: `Savatga mahsulot qo'shing`)                        |
| `doctorRequired` | `!isDelivery && buyerType == client`                                                                                                                                            | `Shifokorni tanlang`                                                                           |
| `debtValid`      | `!debtEnabled` **yoki** (`debtAmount > 0` **va** `debtAmount <= payableTotal` **va** `debtDueDate != null`)                                                                     | `Qarz summasini kiriting` / `Qarz buyurtma summasidan katta` / `Qaytarish muddatini belgilang` |
| `paymentType`    | `nothingPayable` bo'lsa **talab qilinmaydi**; aks holda `!= null`                                                                                                               | `To'lov turini tanlang`                                                                        |
| `splitValid`     | `splitAssigned == paidNow` **va** kamida 1 qism > 0                                                                                                                             | `To'lov summalarini kiriting` / `Yana N so'm taqsimlang` / `To'lovlar N so'm ortiqcha`         |
| `totalOverride`  | `>= 0`, `subtotal > 0` bo'lganda                                                                                                                                                | Savat o'zgarsa avtomatik bekor: `Qo'lda kiritilgan jami summa bekor qilindi`                   |

**Avtomatik korreksiyalar (bloc ichida):**

- Miqdor **omborga clamp** qilinadi + `saleStep` ga snap (package-only mahsulot butun karobka bilan) → `Omborda faqat 1 karobka + 6 dona`
- Savat kichrayganda qarz **avtomatik trim**: `Qarz summasi buyurtma summasiga moslashtirildi`
- `insufficient_stock` xatosi kelsa — server balanslari savatga qaytariladi, miqdorlar avtomatik tushiriladi (keyingi submit o'tadi)

### 5.3 Treatment form (`TreatmentFormState`)

| Maydon                | Qoida                                                                 | Xabar                              |
| --------------------- | --------------------------------------------------------------------- | ---------------------------------- |
| `clientPhone`         | 9 milliy raqam to'liq                                                 | `Telefon raqamini to'liq kiriting` |
| `clientName`          | bo'sh emas                                                            | `Mijoz ismini kiriting`            |
| `doctor`              | `!= null` (**har doim majburiy** — komissiya kimgadir tushishi kerak) | `Shifokorni tanlang`               |
| `amount`              | `> 0`                                                                 | `Summani kiriting`                 |
| `debt`                | New Order bilan **bir xil qoidalar**, faqat `amount` ga nisbatan      | `Qarz summa summadan katta`        |
| `paymentType` / split | New Order bilan **bir xil**                                           | ⌃                                  |

### 5.4 Boshqa forma qoidalari

| Forma                | Muhim qoidalar                                                                                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Appointment**      | `arriveNow` (walk-in) → `scheduled_at` **umuman yuborilmaydi**; `scheduled` → kelajakdagi vaqt majburiy. Arrived bo'lgandan keyin faqat `purpose`/`doctor_id`/`note` tahrirlanadi (`partial: true`)                                          |
| **Client upsert**    | Faqat to'ldirilgan maydonlar yuboriladi (bo'sh qiymat mavjudini o'chirib yubormaydi). `note` va `extra_phones` **har doim** yuboriladi (tozalash — ataylab qilingan tahrir). `birth_date` bo'lsa `age` yuborilmaydi. Avto-teglar filtrlanadi |
| **Expense**          | `amount > 0`, `category`, `payment_type` (forma har doim yuboradi). `canEdit` — faqat bugungi yozuv                                                                                                                                          |
| **Debt pay**         | `amount > 0` va `<= remaining`, `payment_type` majburiy                                                                                                                                                                                      |
| **Debt extend**      | Faqat **oldinga**, max 3 marta (`due_date_changed_count` / `due_date_extend_limit`)                                                                                                                                                          |
| **Write-off**        | `reason == other` → `note` **majburiy**                                                                                                                                                                                                      |
| **Stock receipt**    | `packages` + `quantity` **bitta map'da** (ikkita alohida entry → 400 duplicate). `unit_cost == 0` = "mavjud tannarxni saqla"                                                                                                                 |
| **Stock count**      | `countedQty` **nullable** — sanalmagan qator ≠ nol sanalgan qator. Tasdiqda sanalmaganlar o'tkazib yuboriladi                                                                                                                                |
| **Packaging update** | Tri-state: yo'q / qiymat / aniq `null`. **Tegilmagan `unit_price` yuborilmasligi shart** (mahsulotni "karobka narxi" rejimiga o'tkazib yuboradi)                                                                                             |
| **Daily closing**    | `counted_cash` majburiy; qayta yopish → `X-Confirm-Pin`                                                                                                                                                                                      |

### 5.5 Input formatterlar

| Formatter               | Vazifa                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `UzPhoneInputFormatter` | `+998 (##) ###-##-##` maskasi, ichida 9 milliy raqam. `apiValue()` → `998XXXXXXXXX`                           |
| `MoneyInputFormatter`   | Yozayotganda `200000` → `200 000`. Max 12 raqam. Karet pozitsiyasi o'ngdagi raqamlar bo'yicha anchor qilinadi |

---

## 6. Media va assetlar

| Asset                                                                | Ishlatilishi                                                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `assets/images/doctor_ali_logo.png`                                  | Sidebar logo, splash, login brand (fallback: `Icons.health_and_safety_rounded`)                                                      |
| `assets/images/receipt_logo.png`                                     | Chek (endi print-agent'da)                                                                                                           |
| `assets/images/mehrigiyo_logo.png`                                   | Legacy                                                                                                                               |
| `assets/fonts/Roboto-Regular.ttf`, `Roboto-Bold.ttf`                 | **Faqat lokal PDF fallback uchun** (`daily_closing_pdf.dart`) — o'rnatilgan PDF shriftlari Latin-1, o'zbekcha `'` va kirillni buzadi |
| `web/favicon.png`, `web/icons/Icon-{192,512}.png`, `Icon-maskable-*` | PWA                                                                                                                                  |

**Shrift:** `Plus Jakarta Sans` — `google_fonts` orqali **runtime'da tarmoqdan** yuklanadi (ilk yuklashda FOUT). → Next.js'da `next/font/google` bilan **self-host** qilinadi (muammo yo'qoladi).

**Ikonkalar:** Material Icons (`Icons.*_rounded`). Domenda 100+ ikonka ishlatiladi (`AppRoute.icon`, `AttendanceStatus.icon`, `PaymentType.icon`, `ClientEventKind.icon`, `StockMovementType.icon`, ...). → `lucide-react` ga xaritalanadi.

**Rasm yuklash:** `AppNetworkImage` + `resolveMediaUrl()` — barcha API rasmlari shu orqali. Nisbiy URL → `https://my.imorganic.uz/<path>`. `AppImageShimmer` — skeleton.

**Grafiklar:** `fl_chart` (revenue bar chart, commission line chart, attendance day chart). **Animatsiyalar:** `flutter_animate` (`ListReveal`, `AnimatedCounter`).

---

## 7. Lokalizatsiya

> **Tanqidiy topilma: i18n kutubxonasi umuman ishlatilmagan.**

- **Bitta til: o'zbek (lotin).** Barcha matn Dart kodida hardcode (`labelUz`, `captionUz`, `explanationUz` konventsiyasi).
- `intl` paketi **faqat** `DateFormat('dd.MM.yyyy')` uchun. Oy/hafta nomlari qo'lda massivda (`_monthsUz`, `_weekdaysUz`).
- **RTL yo'q.** Arab/rus/ingliz **yo'q**.
- Server ham o'zbekcha matn qaytaradi (`message`, `*_display`, timeline `title`) — bular **aynan** ko'rsatiladi.

**Port qarori:** `next-intl` **`uz` yagona locale bilan** o'rnatiladi. Sabab: (a) matn kod ichida tarqalib ketmasligi, (b) kelajakda `ru` qo'shish bir fayl masalasi. URL prefiksi **yo'q** (`localePrefix: 'never'`) — mavjud route'lar 1:1 saqlanadi. Server matni hech qachon tarjima lug'atiga tushmaydi.

---

## 8. Uchinchi tomon integratsiyalari

| Nima                               | Holat                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Payme / Click / to'lov shlyuzi** | ❌ **Yo'q.** To'lov — bu qabulxonada qo'lda belgilanadigan `payment_type` (`cash`/`card`/`terminal`), pul harakati emas                                                                                                                                                                                                                                                                     |
| **Push / FCM**                     | ❌ Ilovada yo'q. Bildirishnomalarni **backend** yuboradi (`notifications/logs/` — faqat o'qish uchun tarix)                                                                                                                                                                                                                                                                                 |
| **Analytics (GA/Sentry)**          | ❌ Yo'q. Faqat `LoggingInterceptor` → browser konsoli                                                                                                                                                                                                                                                                                                                                       |
| **Xarita**                         | ❌ Yo'q                                                                                                                                                                                                                                                                                                                                                                                     |
| **Video/chat**                     | ❌ Yo'q                                                                                                                                                                                                                                                                                                                                                                                     |
| **Chek printeri**                  | ✅ **Lokal print-agent** — `POST http://localhost:9110/print` `{receipt}` → ESC/POS → `/dev/usb/lp0`. `GET /health` — tayyorlik. **Alohida bare HTTP klient** (app'ning auth'li klienti EMAS). Payload **o'zgartirilmasdan** uzatiladi (layout agent'da yashaydi). `pdf`/`printing` paketlari olib tashlangan (Ubuntu kassa CUPS Generic Text-Only drayveri `application/pdf` ni rad etadi) |
| **PDF**                            | `pdf` paketi — faqat kun yopish hisobotining **lokal fallback**'i uchun. Asosiy yo'l: server `alerts/daily/export/?format=pdf`                                                                                                                                                                                                                                                              |
| **Excel eksport**                  | Server tomonda (`*/export/` endpointlari), browser'da Blob download                                                                                                                                                                                                                                                                                                                         |
| **Telefon qilish**                 | `tel:` URI → `window.open(uri, '_self')`                                                                                                                                                                                                                                                                                                                                                    |

---

## 9. Responsive / adaptiv talablar

### 9.1 Breakpointlar (`AppSpacing`)

```
mobile   : < 640px
tablet   : 640–1023px
desktop  : >= 1024px
maxContentWidth : 1360px
sidebarExpanded : 248px    sidebarCollapsed : 76px
```

### 9.2 Adaptatsiya qoidalari

| Element     | Mobile                                                    | Tablet         | Desktop                                                 |
| ----------- | --------------------------------------------------------- | -------------- | ------------------------------------------------------- |
| Navigatsiya | `Drawer` (burger)                                         | Doimiy sidebar | Doimiy sidebar + yig'ish tugmasi                        |
| Ro'yxatlar  | Kartalar (`*_card.dart`)                                  | Kartalar       | **Jadval** (`*_table_row.dart` + `*_table_header.dart`) |
| KPI grid    | 1 ustun                                                   | 2 ustun        | `max` (odatda 4)                                        |
| TopBar      | Subtitle va sana chip **yashiriladi**; tugma faqat ikonka | To'liq         | To'liq                                                  |
| New Order   | Vertikal stack                                            | Stack          | 2 ustun: forma + yopishqoq `OrderSummaryPanel`          |

`Responsive.typeOf(context)` / `ResponsiveBuilder` — markazlashgan.
**Har ro'yxat sahifasida ikki xil render** bor (card + table) — bu portda ham saqlanishi kerak.

### 9.3 UI zichligi

> Xotira: **"compact reception UI — o'lchamlarni emas, layoutni tuzat"**. Qabulxona ekranida iloji boricha ko'p ma'lumot ko'rinishi kerak. Shrift/padding kichraytirish **emas**, layoutni qayta tuzish yo'li bilan.

---

## 10. Joriy performance muammolari (portda hal qilinadigan)

| #   | Muammo                                                                                                                 | Ta'sir                                     | Next.js'dagi yechim                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| 1   | **Flutter Web bundle** — `main.dart.js` + CanvasKit WASM ~3–5 MB, birinchi yuklash 4–8s                                | LCP juda yomon                             | React SSR shell + route-level code splitting. Maqsad: initial JS < 200 KB gzip |
| 2   | **`google_fonts` runtime fetch**                                                                                       | FOUT + tashqi bog'liqlik                   | `next/font/google` — self-host, `display: swap`, preload                       |
| 3   | **Semantic HTML yo'q** (canvas render)                                                                                 | Accessibility ~0, screen reader ishlamaydi | Haqiqiy HTML + ARIA                                                            |
| 4   | **Keshsiz** — har sahifa navigatsiyasi to'liq qayta so'rov                                                             | Ortiqcha trafik, sekin his                 | React Query `staleTime` + `gcTime`, `keepPreviousData`                         |
| 5   | **`RemoteDoctorRepository.getDoctor`** — id bo'yicha topish uchun **butun ro'yxatni sahifalab aylanadi**               | N ta so'rov                                | Bir marta `useDoctorsQuery` keshi + `select`                                   |
| 6   | **`getProductsByIds`** — max **40 sahifa** aylanadi (order edit uchun)                                                 | Sekin edit ochilishi                       | React Query kesh + `products` ro'yxatini bir marta yuklab olish                |
| 7   | **Dashboard `top_products` image join** — `image_url` yo'qligi sababli `statistics/products/` ga **qo'shimcha so'rov** | Har dashboard yuklashda +1 request         | React Query bilan keshlanadi; parallel `useQueries`                            |
| 8   | `daily_closing_pdf.dart` (568 qator) — lokal PDF generatsiya                                                           | Katta bundle                               | Server PDF asosiy; lokal fallback `next/dynamic` bilan lazy                    |
| 9   | `ClientProfileCache` qo'lda LRU                                                                                        | Qayta ixtiro                               | React Query o'zi bajaradi                                                      |
| 10  | Katta ro'yxatlar `ListView.builder` bilan, lekin jadval yuzlab qatorli bo'lishi mumkin                                 | Scroll jank                                | `@tanstack/react-virtual` (agar > 100 qator)                                   |

### 10.1 Portda saqlanishi shart bo'lgan performance yechimlari

- **Preview debounce 300ms** + `restartable` semantikasi (eskirgan javob ekranni bosib ketmasligi) → React Query `AbortSignal` + debounced key
- **Draft yozuvi 250ms throttle**
- **Dashboard `_generation` guard** — period tez almashtirilganda eskirgan javob rad etiladi → React Query o'zi hal qiladi
- **`droppable` chek chop etish** — bir vaqtda bitta print job
- **`buildWhen` / `BlocSelector`** scoped rebuild → `useMemo` / `React.memo` / selector hooks

---

## 11. Dizayn tizimi (aynan ko'chiriladi)

### 11.1 Rang palitrasi

**Light:**

```
primary #2E9E6B   primaryDark #1F7C52   primarySoft #E6F5EE   onPrimary #FFFFFF   accent #E8A33D
background #F5F7F6   surface #FFFFFF   surfaceAlt #F0F3F1   surfaceHover #EAF4EE
border #E4E8E4   borderStrong #CBD3CD
textPrimary #1B241F   textSecondary #566056   textTertiary #8A938A
success #2E9E6B   warning #E0A020   danger #D9534F   info #3E7CB1
chart1 #2E9E6B  chart2 #4CAF9A  chart3 #E8A33D  chart4 #6C8AE4  chart5 #C65D7B
shadow rgba(34,58,44,0.07)
```

**Dark:**

```
primary #3DBB84   primaryDark #2E9E6B   primarySoft #17352A   onPrimary #07120D   accent #F0B75E
background #10150F   surface #181F17   surfaceAlt #20281E   surfaceHover #243020
border #2C3628   borderStrong #3B4736
textPrimary #EDF1EA   textSecondary #AFB8AC   textTertiary #7C857A
success #3DBB84   warning #F0B75E   danger #E57373   info #6FA8DC
chart1 #3DBB84  chart2 #5FCFB0  chart3 #F0B75E  chart4 #8AA4F0  chart5 #E07C97
shadow rgba(0,0,0,0.20)
```

> Muhim: fon **hech qachon sof oq emas** (`#F5F7F6`). Temalar orasidagi o'tish `AppColorScheme.lerp` bilan animatsiyalanadi.

### 11.2 Tipografika (Plus Jakarta Sans)

| Token          | px   | weight | line-height | letter-spacing   |
| -------------- | ---- | ------ | ----------- | ---------------- |
| displayLarge   | 40   | 700    | 1.1         | −0.5             |
| displayMedium  | 32   | 700    | 1.15        | −0.4             |
| displaySmall   | 28   | 700    | 1.2         | −0.3             |
| headlineMedium | 24   | 700    | 1.25        | −0.2             |
| headlineSmall  | 20   | 600    | 1.3         | —                |
| titleLarge     | 18   | 600    | 1.3         | —                |
| titleMedium    | 16   | 600    | 1.35        | —                |
| titleSmall     | 14   | 600    | 1.4         | —                |
| bodyLarge      | 16   | 400    | 1.5         | —                |
| bodyMedium     | 14   | 400    | 1.5         | (secondary rang) |
| bodySmall      | 12.5 | 400    | 1.45        | (secondary rang) |
| labelLarge     | 14   | 600    | 1.2         | —                |
| labelMedium    | 12.5 | 600    | 1.2         | —                |
| labelSmall     | 11.5 | 600    | 1.2         | +0.3             |

### 11.3 Spacing / radius / shadow

```
spacing : xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · xxxl 32 · huge 48 · giant 64
radius  : xs 6 · sm 10 · md 14 · lg 18 · xl 24 · pill 999
shadow  : sm  0 2px 8px            shadow
          md  0 8px 20px -4px      shadow
          lg  0 16px 32px -6px     shadow
```

### 11.4 Komponent uslublari (`AppTheme`)

- **Input:** filled `surface`, radius `md` (14), border `border`, focus `primary` 1.6px, padding 14/14
- **Chip:** `StadiumBorder`, tanlanganda `primarySoft` fon + `primaryDark` matn 700, checkmark **yo'q**, padding 12/8
- **FilledButton:** `primary`, radius `md`, padding 18/12
- **Dialog:** radius `xl` (24), `surface`, surfaceTint yo'q
- **SnackBar:** floating, `textPrimary` fon, `surface` matn, radius `md`
- **Scrollbar:** thumb `borderStrong`, qalinlik 6, pill radius
- **DatePicker:** `primary` header, doira kunlar, radius `xl`

---

## 12. Migratsiya xavflari va e'tibor talab qiladigan joylar

| #   | Xavf                                                       | Nima uchun jiddiy                                                                                | Yechim                                                                                             |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 1   | **Pul arifmetikasi**                                       | Bir so'm farq → `payments_mismatch` → saqlash muvaffaqiyatsiz                                    | `orders/preview/` javobini **manba** deb olish. Lokal hisob faqat "taxminiy" belgisi bilan         |
| 2   | **`payments[]` `paid_now` ga teng bo'lishi** (total emas!) | Eng ko'p uchraydigan xato                                                                        | `splitTarget = paidNow = payable − debt`                                                           |
| 3   | **`payment_type: "none"`**                                 | Hech narsa kassaga tushmasa (to'liq qarz / 0 so'm sovg'a) — `payments[]` **umuman yuborilmaydi** | `orderPaymentBody()` mantiqini 1:1 ko'chirish                                                      |
| 4   | **Sovg'a qatorlari**                                       | Qisman sovg'a qilingan qator **ikkita** API entry: paid + `is_gift`                              | `orderItemsBody()` 1:1                                                                             |
| 5   | **Timezone**                                               | Fiksirlangan UTC+5, browser zonasi ahamiyatsiz                                                   | `tashkentFromApi` / `toApiIso` ni aynan port qilish. **`Date` ni to'g'ridan-to'g'ri ishlatmaslik** |
| 6   | **`X-Confirm-Pin` oqimi**                                  | Yo'qolsa — kechagi yozuvlarni tahrirlab bo'lmaydi                                                | `verify-pin` → PIN gate dialog → header                                                            |
| 7   | **Idempotency-Key**                                        | Yo'qolsa — uzilgan aloqada dublikat buyurtma                                                     | `POST` mutatsiyalarida kalitni **retry'lar orasida saqlash**                                       |
| 8   | **`confirm` endpointlarida Idempotency-Key BO'LMASLIGI**   | Static kalit 24 soat eskirgan javobni qaytaradi                                                  | Ataylab qo'shmaslik                                                                                |
| 9   | **Package-only mahsulotlar**                               | `saleStep = packageSize`; qisman karobka **taqiqlanadi**                                         | `_allowedQuantity` snap mantiqi                                                                    |
| 10  | **`PackagingUpdate` tri-state**                            | Tegilmagan `unit_price` yuborilsa mahsulot pricing rejimi buziladi                               | Faqat o'zgargan kalitlar                                                                           |
| 11  | **`countedQty` nullable**                                  | `null` ≠ `0`; aralashtirilsa butun javon hisobdan chiqariladi                                    | `number \| null` tipini saqlash                                                                    |
| 12  | **`Doctor.percentFor()` `null` qaytarishi**                | `commissionPercent` (mahsulot foizi) bilan almashtirilsa — noto'g'ri raqam shifokorga aytiladi   | `null` ni **saqlab qolish**, server hisoblasin                                                     |
| 13  | **Server matni ustuvorligi**                               | `*_display` bo'lsa lokal label ishlatilmaydi                                                     | Har modelda `xxxLabel` getter'lari                                                                 |
| 14  | **`unknown` enum a'zolari**                                | Yangi backend qiymati crash qilmasligi kerak                                                     | `zod` da `.catch()` yoki union + fallback                                                          |
| 15  | **`reception_only`**                                       | Faqat backend filtri; reception hammasini ko'radi + 🏪 badge                                     | Client tomonda filtr **qo'shmaslik**                                                               |
| 16  | **Print-agent CORS/mixed content**                         | HTTPS sayt → HTTP localhost                                                                      | `http://localhost` — potentially-trustworthy. Alohida `fetch` (auth header'siz)                    |
| 17  | **`remember=false` xotira rejimi**                         | localStorage'ga yozmaslik shart                                                                  | Zustand store'da xotira-only tarmoq                                                                |
| 18  | **Kesh invalidatsiyasi**                                   | Warehouse paketni o'zgartirsa New Order picker eski ko'rsatadi                                   | `CatalogSignal` → React Query `invalidateQueries(['products'])`                                    |

---

## 13. Feature bo'yicha hajm xaritasi (migratsiya rejalashtirish uchun)

| Feature                   | Fayl |  Qator | Murakkablik                            |
| ------------------------- | ---: | -----: | -------------------------------------- |
| `clients_crm`             |   58 |  9 601 | 🔴 Juda yuqori                         |
| `new_order`               |   26 |  7 283 | 🔴 Juda yuqori (bloc 1029 + state 811) |
| `warehouse`               |   26 |  5 695 | 🔴 Yuqori (3 hujjat turi)              |
| `appointments`            |   49 |  5 376 | 🟠 Yuqori (3 bloc)                     |
| `attendance`              |   32 |  5 244 | 🟠 Yuqori                              |
| `orders`                  |   38 |  5 222 | 🟠 Yuqori (detail dialog 1057)         |
| `dashboard`               |   20 |  4 648 | 🟠 Yuqori (daily closing 1060)         |
| `treatments`              |   22 |  4 206 | 🟠 O'rta-yuqori                        |
| `payouts`                 |   26 |  3 386 | 🟡 O'rta                               |
| `followups`               |   24 |  3 123 | 🟡 O'rta                               |
| `debts`                   |   18 |  2 656 | 🟡 O'rta                               |
| `expenses`                |   19 |  2 591 | 🟡 O'rta                               |
| `doctors`                 |   15 |  1 512 | 🟢 Past                                |
| `products`                |   10 |    911 | 🟢 Past                                |
| `statistics` (domain)     |    7 |    981 | 🟢 Past                                |
| `auth`                    |   11 |    880 | 🟢 Past                                |
| `receipt`                 |   10 |    548 | 🟢 Past                                |
| `clients` (legacy lookup) |    3 |    129 | 🟢 Past                                |
| `theme`                   |    4 |    127 | 🟢 Past                                |
| `core` + `shell`          |  ~96 | ~7 000 | 🟠 Poydevor                            |

---

## 14. Migratsiya tartibi (4-bosqich uchun tavsiya)

```
A. Poydevor    : theme tokenlari → http klient → auth → store → query provider → middleware
B. Shell       : sidebar, topbar, responsive layout, theme toggle
C. Oddiy       : products, doctors (+detail), expenses
D. O'rta       : debts, followups, payouts, attendance
E. Murakkab    : orders (+detail dialog), treatments, appointments, warehouse
F. Eng og'ir   : clients_crm (360° profil), dashboard (+ kun yopish), new_order (+ edit + chek)
```

Har bosqichda majburiy: `loading` (skeleton) · `error` (retry bilan) · `empty` holatlari — Flutter versiyada ba'zi joylarda yo'q, portda **hamma joyda bo'lishi shart**.

---

## 15. Xulosa

`doctor_ali_clinic` — bu **74k qatorli, 20 feature'li, 90+ endpointli ichki biznes-panel**, unda pul, ombor va shaxsiy ma'lumotlar bilan ishlaydigan juda aniq biznes qoidalar bor. Kod juda yaxshi hujjatlashtirilgan (har qoida sababi bilan izohlangan) — bu portni aniq bajarish imkonini beradi.

**Portning eng katta qiymati:** bundle hajmi (~3–5 MB → ~200 KB), semantik HTML + accessibility, React Query keshi, va SSR shell orqali sezilarli tezlik.

**Portning eng katta xavfi:** pul/ombor arifmetikasining nozik qoidalarini yo'qotish. Shu sababli 12-bo'limdagi 18 ta xavf har feature migratsiyasida checklist sifatida tekshiriladi.
