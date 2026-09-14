# `config/servers.mjs` dan qiymat o'qish — deploy skriptlari uchun umumiy qism.
#
# Host, port va backend manzili faqat o'sha faylda turadi; bu yerda ular
# takrorlanmaydi, shunda server almashtirish bitta qatorlik ish bo'lib qoladi.

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

die() {
  echo "XATO: $*" >&2
  exit 1
}

# Node hostda bo'lmasligi mumkin — deploy uchun Docker baribir shart, shuning
# uchun Node'ni o'sha yerdan olamiz.
run_node() {
  if command -v node >/dev/null; then
    (cd "$REPO_ROOT" && node "$@")
  elif command -v docker >/dev/null; then
    docker run --rm -v "${REPO_ROOT}:/app" -w /app node:22-alpine node "$@"
  else
    die "node ham, docker ham topilmadi."
  fi
}

# Serverning barcha qiymatlarini `KEY=value` qatorlari sifatida chiqaradi;
# chaqiruvchi ularni `eval` bilan o'zgaruvchiga aylantiradi.
server_values() {
  # Nom skriptga argument sifatida boradi, JS matniga qo'shib qo'yilmaydi —
  # tirnoq yoki bo'sh joyli nom skriptni buzmasin.
  # Stack trace bu yerda shovqin: `resolveServer` xabarining o'zi yetarli.
  run_node --input-type=module -e "
    import { resolveServer } from './config/servers.mjs';
    try {
      const s = resolveServer(process.argv[1]);
      process.stdout.write(
        [
          \`SERVER_HOST=\${s.host}\`,
          \`SERVER_ORIGIN=\${s.origin}\`,
          \`SERVER_PORT=\${s.port}\`,
          \`SERVER_API_UPSTREAM=\${s.apiUpstream}\`,
          \`SERVER_LABEL=\${s.label}\`,
        ].join('\n'),
      );
    } catch (error) {
      process.stderr.write(error.message + '\n');
      process.exit(1);
    }
  " -- "$1"
}

# Muhit nomini tekshiradi va SERVER_* o'zgaruvchilarini o'rnatadi.
load_server() {
  local name="${1:-}"
  [[ -n "$name" ]] || return 1
  local values
  values="$(server_values "$name")" || return 1
  eval "$values"
}
