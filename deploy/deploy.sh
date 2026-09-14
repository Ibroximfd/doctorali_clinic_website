#!/usr/bin/env bash
# ==============================================================================
# Doctor Ali — Qabulxona · deploy
#
#   ./deploy/deploy.sh test      imorganic.uz
#   ./deploy/deploy.sh prod      my.imorganic.uz
#
# Serverning o'zida ishlatiladi. Domen, port va backend manzili `config/servers.mjs`
# dan o'qiladi — bu yerda hech narsa takrorlanmaydi.
#
# Image'ni yig'adi, konteynerni almashtiradi va panel ko'tarilganiga ishonch
# hosil qilmaguncha tugamaydi.
#
# nginx alohida va bir marta: `./deploy/nginx-setup.sh <muhit>`.
# ==============================================================================
set -euo pipefail

# shellcheck source=deploy/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

readonly COMPOSE_FILE="${REPO_ROOT}/deploy/docker-compose.yml"
# Konteyner tayyor bo'lishini shuncha kutamiz: sovuq start + birinchi SSR.
readonly HEALTH_TIMEOUT_SECONDS=90

usage() {
  echo "Ishlatilishi: $0 <test|prod> [--no-build]" >&2
  exit 2
}

# --- Argumentlar --------------------------------------------------------------
[[ $# -ge 1 ]] || usage
ENVIRONMENT="$1"
shift
readonly ENVIRONMENT

build_flag="--build"
while [[ $# -gt 0 ]]; do
  case "$1" in
    # Kod o'zgarmagan, faqat qiymat almashgan holat: qayta yig'ish shart emas.
    --no-build) build_flag="" ;;
    *) usage ;;
  esac
  shift
done

# --- Muhit --------------------------------------------------------------------
# Noma'lum nom shu yerda to'xtaydi: `resolveServer` mavjud nomlarni sanab beradi.
load_server "$ENVIRONMENT" || usage

# --- Kerakli vositalar --------------------------------------------------------
command -v docker >/dev/null || die "docker o'rnatilmagan."
docker compose version >/dev/null 2>&1 || die "docker compose (v2) topilmadi."
command -v curl >/dev/null || die "curl o'rnatilmagan — deploy natijasini tekshirib bo'lmaydi."

# Compose shu qiymatlarni o'qiydi. `APP_SERVER` ham build paytida (NEXT_PUBLIC_*
# qiymatlari shundan kelib chiqadi), ham runtime'da (proksi zaxirasi) kerak.
export APP_SERVER="$ENVIRONMENT"
export APP_PORT="$SERVER_PORT"
export CONTAINER_NAME="qabulxona-${ENVIRONMENT}"
export COMPOSE_PROJECT_NAME="qabulxona-${ENVIRONMENT}"

echo "▸ Muhit  : ${ENVIRONMENT} (${SERVER_LABEL})"
echo "▸ Domen  : ${SERVER_ORIGIN}"
echo "▸ Port   : 127.0.0.1:${SERVER_PORT}"
echo "▸ Backend: ${SERVER_API_UPSTREAM} (nginx /api/ ni shu yerga uzatadi)"
echo

# --- Yig'ish va ko'tarish ------------------------------------------------------
docker compose -f "$COMPOSE_FILE" up -d $build_flag

# --- Ko'tarilganini tekshirish -------------------------------------------------
# /login autentifikatsiyasiz javob beradigan yagona sahifa — Dockerfile'dagi
# HEALTHCHECK ham aynan shuni so'raydi.
echo -n "▸ Kutilyapti"
deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
until curl -fsS -o /dev/null "http://127.0.0.1:${SERVER_PORT}/login"; do
  if ((SECONDS >= deadline)); then
    echo
    echo "Oxirgi loglar:" >&2
    docker compose -f "$COMPOSE_FILE" logs --tail 50 >&2
    die "panel ${HEALTH_TIMEOUT_SECONDS}s ichida javob bermadi."
  fi
  echo -n "."
  sleep 2
done

echo
echo "✓ ${ENVIRONMENT} tayyor → ${SERVER_ORIGIN}"
