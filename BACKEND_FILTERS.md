# Backend uchun filtr so'rovlari

Qabulxona paneli (Next.js) endi har bir bo'limda sana va qo'shimcha filtrlar
bilan ishlaydi. Quyidagi ro'yxat — **frontend nima yuborayotgani** va **backendda
nima yetishmayotgani**.

Belgilar:

| Belgi | Ma'nosi                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------ |
| ✅    | Hujjatlashtirilgan, ishlayapti                                                                                           |
| ❓    | Frontend yuboryapti, lekin API hujjatida yo'q — **tasdiqlash kerak** (ishlasa — hujjatga qo'shing; ishlamasa — qo'shing) |
| ➕    | **Yangi so'rov** — hozir yo'q, qo'shilishi kerak                                                                         |

Umumiy qoidalar (hammasiga tegishli):

- `date_from` / `date_to` — `YYYY-MM-DD`, **`date_to` inklyuziv**.
- Noma'lum query parametri **400 bermasin**, e'tiborsiz qoldirilsin (eski
  frontend versiyalari buzilmasligi uchun).
- Har bir ro'yxat `ordering` va `page` ni qabul qilsin, javobda `count` bo'lsin.
- ➕ `page_size=` (maks. 100) — stolda 50 qatorli ro'yxat ko'rish uchun.

---

## 1. `GET orders/` — Buyurtmalar

| Parametr                                                     | Holat | Izoh                                                                                                                                      |
| ------------------------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `page`, `ordering`, `search`                                 | ✅    |                                                                                                                                           |
| `date_from`, `date_to`                                       | ✅    |                                                                                                                                           |
| `doctor_id`                                                  | ✅    |                                                                                                                                           |
| `payment_type`                                               | ✅    | `cash\|card\|terminal`                                                                                                                    |
| `order_type`                                                 | ✅    | `clinic\|delivery`                                                                                                                        |
| `has_debt`, `debt_status`, `due_from`, `due_to`, `client_id` | ✅    |                                                                                                                                           |
| `ordering=-total_amount` / `total_amount`                    | ❓    | UI'da "Katta summa / Kichik summa" saralash bor. `created_at`, `-created_at` ishlayapti; `total_amount` bo'yicha saralash ham ochilsinmi? |
| `buyer_type=client\|staff`                                   | ➕    | Xodimga sotilgan buyurtmalarni ajratish. Hozir UI'da faqat belgi (badge) ko'rinadi, filtrlab bo'lmaydi.                                   |
| `status=completed\|cancelled`                                | ➕    | Bekor qilingan buyurtmalarni alohida ko'rish — hozircha butun tarixni varaqlash kerak.                                                    |
| `has_gift=true\|false`                                       | ➕    | Sadoqat sovg'asi berilgan sotuvlar.                                                                                                       |
| `is_edited=true\|false`                                      | ➕    | Tahrirlangan buyurtmalar — audit uchun.                                                                                                   |
| `created_by=<user_id>`                                       | ➕    | Qaysi operator rasmiylashtirgan. Smena hisobi uchun kerak.                                                                                |
| `min_total=`, `max_total=`                                   | ➕    | Katta summali sotuvlarni tez topish.                                                                                                      |

### ➕ `GET orders/summary/` (yangi endpoint)

`orders/` bilan **bir xil filtr parametrlarini** qabul qilsin va faqat
yig'indini qaytarsin:

```json
{
  "count": 24,
  "total_amount": 18600000,
  "paid_amount": 12600000,
  "debt_amount": 6000000,
  "item_count": 143
}
```

Sabab: ro'yxat sarlavhasida hozir faqat `count` ko'rsatiladi. "Bugun qancha
sotildi?" degan savolga javob berish uchun operator statistikaga o'tishi kerak,
u yerdagi filtr esa boshqacha. `treatments/summary/` va `expenses/summary/` bor
— buyurtmalarda yo'q.

### PATCH `orders/{id}/` — null semantikasi (tasdiqlash)

| Maydon              | Kutilayotgan xatti-harakat                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `"doctor_id": null` | Shifokorni **olib tashlaydi** (frontend endi shunday yuboradi)                                                                                                                             |
| `"debt": null`      | Qarzni **bekor qiladi**. ❓ Hozir frontend qarz o'chirilganda kalitni umuman yubormaydi va eski qarz order'da qolib ketadi. `debt: null` qabul qilinsa — frontendda bir qatorlik tuzatish. |

---

## 2. `GET treatments/` — Muolajalar

API hujjatida parametrlar umuman yozilmagan. Frontend quyidagilarni yuboradi:

| Parametr                                     | Holat |
| -------------------------------------------- | ----- |
| `date_from`, `date_to`, `search`, `ordering` | ❓    |
| `doctor_id`                                  | ❓    |
| `kind=treatment\|consultation`               | ❓    |
| `status=completed\|cancelled`                | ❓    |
| `payment_type`                               | ❓    |
| `has_debt=true\|false`                       | ❓    |
| `client_id`                                  | ❓    |
| `min_amount=`, `max_amount=`                 | ➕    |

`treatments/summary/` ham shu filtrlarni qabul qilishi kerak (hozir ro'yxat va
yig'indi bir xil filtr bilan chaqirilyapti).

---

## 3. `GET debts/` — Qarzlar

| Parametr                                                                         | Holat                                       |
| -------------------------------------------------------------------------------- | ------------------------------------------- |
| `status=active\|overdue\|paid`                                                   | ❓                                          |
| `search`, `ordering`                                                             | ❓                                          |
| `due_from`, `due_to`                                                             | ❓                                          |
| `doctor_id`                                                                      | ❓ Qaysi shifokorning sotuvidan qarz qolgan |
| `source=order\|treatment`                                                        | ❓                                          |
| `client_id`                                                                      | ❓                                          |
| `ordering=due_date\|-due_date\|-remaining_amount\|remaining_amount\|-created_at` | ❓ Shu beshtasi kerak                       |
| `overdue_days_min=`                                                              | ➕ "30 kundan ortiq kechikkanlar"           |
| `amount_min=`                                                                    | ➕ Katta qarzlarni ajratish                 |

---

## 4. `GET payouts/` — To'lovlar (shifokor komissiyalari)

Bu bo'limda **umuman filtr yo'q edi**, endi UI qo'shildi:

| Parametr                                          | Holat |
| ------------------------------------------------- | ----- |
| `doctor_id`                                       | ❓    |
| `date_from`, `date_to` (`week_start` bo'yicha)    | ❓    |
| `status=paid\|cancelled`                          | ❓    |
| `ordering=-week_start\|week_start\|-total_amount` | ➕    |
| `page`                                            | ❓    |

`payouts/outstanding/?doctor_id=` — ✅ (ishlatilyapti).

➕ `payouts/outstanding/?date_from=&date_to=` — to'lanmagan haftalarni davr
bo'yicha cheklash.

---

## 5. `GET appointments/` — Tashriflar

| Parametr                                                   | Holat                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| `date=` (bitta kun)                                        | ❓                                                                   |
| `date_from`, `date_to` (**oraliq**)                        | ❓ Endi UI'da "shu hafta kim keladi?" degan savol bor — oraliq shart |
| `status`                                                   | ❓                                                                   |
| `doctor_id`                                                | ❓                                                                   |
| `purpose=product\|treatment\|consultation\|checkup\|other` | ❓                                                                   |
| `visit_type=walk_in\|scheduled`                            | ❓                                                                   |
| `search`, `client_id`, `ordering`                          | ❓                                                                   |

---

## 6. `GET statistics/*` — Statistika

| Endpoint                   | Parametr                                               | Holat                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `statistics/dashboard/`    | `period=daily\|weekly\|monthly\|yearly`                | ✅                                                                                                                                                                                                |
| `statistics/dashboard/`    | `date_from=&date_to=` (ixtiyoriy davr)                 | ❓ **Muhim** — panel endi istalgan kun/oraliqni yuboradi (masalan faqat 3-sentabr). `period` o'rniga shu ikkisi kelsa, server o'sha oraliqni hisoblasin va grafikni o'zi mos qadam bilan bo'lsin. |
| `statistics/doctors/`      | `date_from=&date_to=`, `search=`, `ordering=`, `page=` | ❓ Shifokorlar bo'limida endi ixtiyoriy davr tanlanadi                                                                                                                                            |
| `statistics/products/`     | `date_from=&date_to=`, `search=`, `ordering=`, `page=` | ❓                                                                                                                                                                                                |
| `statistics/doctors/{id}/` | `date_from=&date_to=`                                  | ❓                                                                                                                                                                                                |
| `statistics/payment-type/` | `date_from=&date_to=&type=`                            | ❓                                                                                                                                                                                                |
| barchasi                   | `doctor_id=` bo'yicha kesish                           | ➕ "Faqat shu shifokorning statistikasi"                                                                                                                                                          |

---

## 7. `GET clients/` — Mijozlar

| Parametr                                                                                  | Holat                                                                                                           |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `search`, `tag`, `has_debt`, `debt_status`, `is_app_user`, `gender`, `source`, `ordering` | ✅                                                                                                              |
| `created_from=`, `created_to=`                                                            | ➕ **Ro'yxatdan o'tgan sana** bo'yicha filtr — "shu oy nechta yangi mijoz keldi" degan savolga hozir javob yo'q |
| `last_order_from=`, `last_order_to=`                                                      | ➕ Oxirgi xarid sanasi bo'yicha                                                                                 |
| `orders_min=`, `visits_min=`                                                              | ➕ Faol mijozlarni ajratish                                                                                     |
| `doctor_id=`                                                                              | ➕ Qaysi shifokorga biriktirilgan / kimdan xarid qilgan                                                         |

---

## 8. `GET expenses/` — Xarajatlar

| Parametr                                                         | Holat                                       |
| ---------------------------------------------------------------- | ------------------------------------------- |
| `date`, `date_from`, `date_to`, `category`, `search`, `ordering` | ❓                                          |
| `payment_type`                                                   | ❓ Endi UI'da bor — qaysi kassadan chiqqani |
| `amount_min=`, `amount_max=`                                     | ➕                                          |
| `created_by=`                                                    | ➕                                          |

---

## 9. `GET warehouse/movements/` — Ombor harakatlari

| Parametr                         | Holat                                   |
| -------------------------------- | --------------------------------------- |
| `product_id`, `type`, `order_id` | ❓                                      |
| `date_from`, `date_to`           | ❓ Endi UI'da sana filtri bor           |
| `document_id=`                   | ➕ Bitta hujjat (kirim/chiqim) bo'yicha |

`warehouse/stock/`: `category=` ❓ (frontend yuboradi), ➕ `low_stock=true`,
`out_of_stock=true` (hozir frontend `low_stock_only`/`out_of_stock_only` deb
yuboryapti — nom aniqlashtirilsin).

---

## 9b. Ombor hujjatlari — `warehouse/receipts/`, `write-offs/`, `counts/`

Bu uchta ro'yxatda hozir **umuman filtr yo'q** (faqat `page`). Frontend API
qatlamida ham hech qanday filtr maydoni yo'q, shuning uchun UI qo'shilmadi —
quyidagilar backendda paydo bo'lishi bilan bir kunda ulanadi:

| Parametr                               | Holat                                                        |
| -------------------------------------- | ------------------------------------------------------------ |
| `date_from=`, `date_to=`               | ➕ Hujjat sanasi bo'yicha                                    |
| `status=draft\|confirmed\|cancelled`   | ➕ "Tasdiqlanmagan kirimlar" — eng ko'p so'raladigan ro'yxat |
| `search=` (hujjat raqami, ta'minotchi) | ➕                                                           |
| `created_by=`                          | ➕                                                           |
| `product_id=`                          | ➕ Bitta mahsulot qatnashgan hujjatlar                       |

## 9c. ➕ `GET products/categories/`

Turkumlar ro'yxati (`[{"name": "...", "count": 12}]`). Hozir turkum mahsulot
ichida oddiy matn maydoni — shuning uchun ombor va mahsulotlar bo'limida
"turkum bo'yicha filtr" qilib bo'lmayapti (ro'yxatni faqat ochilgan sahifadan
yig'ish mumkin, bu esa noto'liq).

---

## 10. `GET followups/` — Eslatmalar

| Parametr                                                         | Holat                                            |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| `period`, `days_from`, `days_to`, `status`, `search`, `ordering` | ❓                                               |
| `doctor_id`                                                      | ❓ Endi UI'da bor — "shu shifokorning mijozlari" |

---

## 11. `GET attendance/` va `attendance/statistics/`

| Parametr                          | Holat                             |
| --------------------------------- | --------------------------------- |
| `date=`, `date_from=`, `date_to=` | ❓                                |
| `employee_id=`                    | ➕ Bitta xodimning davomat tarixi |

---

## Ustuvorlik

1. **Yuqori** — `orders/summary/`, `orders/?status=&buyer_type=`,
   `statistics/*?date_from=&date_to=`, `PATCH orders/{id}/ {"debt": null}`.
2. **O'rta** — `payouts/`, `debts/`, `appointments/` filtrlarini tasdiqlash va
   hujjatlashtirish (❓ belgililar).
3. **Past** — `clients/` sana filtrlari, `min/max` summa filtrlari,
   `created_by`.

❓ belgili parametrlarning har biri uchun **ishlaydi/ishlamaydi** deb javob
qaytarsangiz kifoya — ishlamaydiganlarini frontenddan olib tashlayman yoki
backendga qo'shilgach yoqaman.
