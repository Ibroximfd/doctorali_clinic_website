# Deploy — test va prod

Domen, port va backend manzili faqat bitta joyda: **[`config/servers.mjs`](../config/servers.mjs)**.
Bu yerdagi skriptlar ham, `next.config.ts` ham, nginx shabloni ham o'sha fayldan
o'qiydi — hech qayerda takrorlanmaydi.

```js
export const SERVERS = {
  test: {
    host: "imorganic.uz",
    label: "Test",
    port: 3001,
    apiUpstream: "127.0.0.1:8000",
  },
  prod: {
    host: "my.imorganic.uz",
    label: "Production",
    port: 3000,
    apiUpstream: "127.0.0.1:8000",
  },
};

export const DEFAULT_SERVER = "prod"; // ← lokal dev shundan boshlanadi
```

| Muhit    | Domen                     | Panel porti (loopback) | Konteyner        |
| -------- | ------------------------- | ---------------------- | ---------------- |
| **test** | `https://imorganic.uz`    | `127.0.0.1:3001`       | `qabulxona-test` |
| **prod** | `https://my.imorganic.uz` | `127.0.0.1:3000`       | `qabulxona-prod` |

Har bir serverda uch qismli zanjir:

```
brauzer ──HTTPS──▶ nginx ──┬──▶ 127.0.0.1:300x   panel (Docker, Next.js)
                           └──▶ 127.0.0.1:8000   backend (Django, allaqachon ishlayapti)
```

nginx `/api/`, `/admin/`, `/static/`, `/media/` ni backendga, qolgan hamma
narsani panelga uzatadi. Brauzer uchun ikkalasi ham bitta domen — shuning uchun
CORS umuman yo'q.

---

## 1. Bir martalik tayyorgarlik (har bir serverda)

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker

# nginx + certbot + envsubst
sudo apt update && sudo apt install -y nginx certbot gettext-base
sudo mkdir -p /var/www/certbot

# Loyiha
sudo mkdir -p /srv && cd /srv
git clone <repo-url> qabulxona && cd qabulxona
```

DNS: domen (`imorganic.uz` yoki `my.imorganic.uz`) shu serverning IP'siga
qaragan bo'lsin — sertifikat shusiz olinmaydi.

**Sozlash fayli yo'q.** Deploy `config/servers.mjs` dan o'qiydi, shuning uchun
serverda `.env` yaratish shart emas.

### TLS sertifikati

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d my.imorganic.uz
```

> Agar shu domen uchun nginx hali umuman sozlanmagan bo'lsa, `--standalone`
> ishlating va nginx'ni vaqtincha to'xtating.

### nginx

```bash
sudo ./deploy/nginx-setup.sh prod     # test serverida: test
```

Shablonni to'ldiradi, `nginx -t` bilan tekshiradi va faqat o'tgandagina reload
qiladi. Tekshiruv yiqilsa — eski konfiguratsiya joyida qoladi.

---

## 2. Har bir reliz

```bash
cd /srv/qabulxona
git pull
./deploy/deploy.sh prod        # test serverida: ./deploy/deploy.sh test
```

Skript image'ni yig'adi, konteynerni almashtiradi va panel javob berguncha
kutadi. Javob bermasa — oxirgi 50 qator logni ko'rsatib, nol bo'lmagan kod bilan
tugaydi, demak CI'da ham ishlatsa bo'ladi.

Kod o'zgarmagan bo'lsa:

```bash
./deploy/deploy.sh prod --no-build
```

---

## 3. Qaysi qiymat qachon o'qiladi

`APP_SERVER` (ya'ni `deploy.sh` ga bergan `test`/`prod`) **build paytida**
ishlaydi: `next.config.ts` undan `NEXT_PUBLIC_MEDIA_ORIGIN` va
`NEXT_PUBLIC_SITE_URL` ni chiqarib, bundle ichiga yozadi. Bu Next'ning modeli —
serverni almashtirish qayta build talab qiladi, `deploy.sh <boshqa-muhit>` shuni
o'zi qiladi.

Yagona istisno — `API_PROXY_TARGET`: u **runtime'da** o'qiladi va faqat
nginx'siz holat uchun zaxira. Berilmasa `APP_SERVER` dagi serverning o'zi
ishlatiladi.

Vaqtincha override (qayta build bilan):

```bash
NEXT_PUBLIC_API_LOGGING=true ./deploy/deploy.sh prod
```

---

## 4. Tekshirish

```bash
# Panel ko'tarilganmi
curl -I http://127.0.0.1:3000/login

# Tashqaridan
curl -I https://my.imorganic.uz/login

# API bir xil domendan javob beryaptimi (401 — bu to'g'ri javob, token yo'q)
curl -i https://my.imorganic.uz/api/reception/auth/me/

# Loglar
docker logs -f qabulxona-prod
```

Brauzerda: login sahifasi ochilsin, kirish ishlasin, mahsulot rasmlari
ko'rinsin.

---

## 5. Orqaga qaytarish

Har deploy oldingi image'ni o'chirmaydi, shuning uchun qaytish bir buyruq:

```bash
git checkout <oldingi-commit>
./deploy/deploy.sh prod
```

To'xtatish:

```bash
docker stop qabulxona-prod
```

---

## 6. Tez-tez uchraydigan muammolar

| Belgi                                      | Sabab                                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Login sahifasi ochiladi, kirish ishlamaydi | nginx `/api/` bloki backendga yetmayapti — `servers.mjs` dagi `apiUpstream` va Django porti   |
| `502 Bad Gateway`                          | Konteyner ko'tarilmagan — `docker ps`, `docker logs qabulxona-prod`                           |
| Rasmlar ko'rinmaydi                        | Noto'g'ri server bilan build qilingan — `./deploy/deploy.sh <muhit>` ni qayta ishga tushiring |
| Noma'lum server nomi                       | `resolveServer` mavjud nomlarni sanab to'xtatadi — `servers.mjs` ga qarang                    |
| Chek chiqmaydi                             | ESC/POS agent kassada ishlamayapti (`localhost:9110`) — server bilan aloqasi yo'q             |

---

## 7. Fayllar

| Fayl                         | Vazifasi                                                          |
| ---------------------------- | ----------------------------------------------------------------- |
| `config/servers.mjs`         | **Yagona manba**: host, port, backend manzili, `DEFAULT_SERVER`   |
| `deploy/deploy.sh`           | Build + konteynerni almashtirish + tekshirish                     |
| `deploy/nginx-setup.sh`      | nginx conf generatsiyasi (bir marta)                              |
| `deploy/nginx.conf.template` | nginx shabloni; qiymatlar `servers.mjs` dan keladi                |
| `deploy/lib.sh`              | Skriptlar uchun umumiy qism — `servers.mjs` ni Node orqali o'qish |
| `deploy/docker-compose.yml`  | Konteyner ta'rifi                                                 |
