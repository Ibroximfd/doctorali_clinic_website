/**
 * Backend serverlari — butun loyiha uchun yagona manba.
 *
 * Bu yerdagi host quyidagilarning hammasini boshqaradi:
 *   • dev va build paytidagi proksi (`next.config.ts` → `API_PROXY_TARGET`);
 *   • brauzerga inline qilinadigan media origin (`NEXT_PUBLIC_MEDIA_ORIGIN`);
 *   • `next/image` ruxsat etgan hostlar;
 *   • nginx konfiguratsiyasi (`deploy/nginx.conf.template` dan generatsiya);
 *   • deploy skriptlari (domen, port, sertifikat yo'li).
 *
 * Oddiy `.mjs` — chunki uni ham Node skriptlari, ham `next.config.ts` o'qiydi.
 */

/**
 * `port` — panelning loopback porti. Bir serverda test va prod yonma-yon tursa
 * to'qnashmasin; tashqariga baribir faqat nginx chiqaradi.
 *
 * `apiUpstream` — nginx `/api/` ni uzatadigan manzil. nginx'ning `upstream`
 * bloki, shuning uchun SXEMASIZ `host:port`.
 */
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

/**
 * ⬇︎ SERVERNI ALMASHTIRISH UCHUN FAQAT SHU QATORNI O'ZGARTIRING.
 *
 * Vaqtincha almashtirish uchun esa `APP_SERVER` yetarli, faylga tegmasdan:
 *   APP_SERVER=test npm run dev
 *   APP_SERVER=test npm run build
 */
export const DEFAULT_SERVER = "prod";

/** Nomi bo'yicha serverni beradi; noto'g'ri nom jimgina o'tib ketmaydi. */
export function resolveServer(name = process.env.APP_SERVER || DEFAULT_SERVER) {
  const server = SERVERS[name];

  if (!server) {
    const known = Object.keys(SERVERS).join(", ");
    throw new Error(`Noma'lum server: "${name}". Mavjudlari: ${known}.`);
  }

  return { name, origin: `https://${server.host}`, ...server };
}
