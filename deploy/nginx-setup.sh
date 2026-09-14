#!/usr/bin/env bash
# ==============================================================================
# Doctor Ali — Qabulxona · nginx sozlash
#
#   sudo ./deploy/nginx-setup.sh test
#   sudo ./deploy/nginx-setup.sh prod
#
# Shablonni `config/servers.mjs` dagi qiymatlar bilan to'ldiradi, `nginx -t`
# bilan tekshiradi va faqat tekshiruv o'tgandagina reload qiladi — buzuq
# konfiguratsiya hech qachon ishlab turgan nginx'ga yetib bormaydi.
#
# Bir marta bajariladi. Keyingi relizlar uchun `deploy.sh` yetarli.
# ==============================================================================
set -euo pipefail

# shellcheck source=deploy/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

readonly TEMPLATE="${REPO_ROOT}/deploy/nginx.conf.template"
readonly CONF_DIR="/etc/nginx/conf.d"

readonly ENVIRONMENT="${1:-}"
load_server "$ENVIRONMENT" ||
  { echo "Ishlatilishi: sudo $0 <test|prod>" >&2; exit 2; }

command -v envsubst >/dev/null || die "envsubst yo'q. O'rnating: apt install gettext-base"

readonly CERT="/etc/letsencrypt/live/${SERVER_HOST}/fullchain.pem"
[[ -f "$CERT" ]] || cat >&2 <<WARN
DIQQAT: $CERT yo'q — sertifikatsiz nginx bu konfiguratsiya bilan ko'tarilmaydi.
Avval oling:
  sudo certbot certonly --webroot -w /var/www/certbot -d ${SERVER_HOST}
WARN

readonly TARGET="${CONF_DIR}/qabulxona-${ENVIRONMENT}.conf"
# Faqat quyidagilar almashtiriladi; qolgan $-belgilar nginx'niki va tegilmaydi.
PANEL_HOST="$SERVER_HOST" APP_PORT="$SERVER_PORT" \
API_UPSTREAM="$SERVER_API_UPSTREAM" ENV_NAME="$ENVIRONMENT" \
  envsubst '${PANEL_HOST} ${APP_PORT} ${API_UPSTREAM} ${ENV_NAME}' \
  < "$TEMPLATE" > "${TARGET}.new"

# Eskisini faqat yangi konfiguratsiya butun nginx bilan birga tekshiruvdan
# o'tgach almashtiramiz.
if [[ -f "$TARGET" ]]; then
  cp "$TARGET" "${TARGET}.bak"
fi
mv "${TARGET}.new" "$TARGET"

if ! nginx -t; then
  if [[ -f "${TARGET}.bak" ]]; then
    mv "${TARGET}.bak" "$TARGET"
    echo "Eski konfiguratsiya qaytarildi." >&2
  else
    rm -f "$TARGET"
  fi
  die "nginx konfiguratsiyasi tekshiruvdan o'tmadi — hech narsa o'zgartirilmadi."
fi

rm -f "${TARGET}.bak"
systemctl reload nginx
echo "✓ $TARGET yozildi, nginx qayta yuklandi → ${SERVER_ORIGIN}"
