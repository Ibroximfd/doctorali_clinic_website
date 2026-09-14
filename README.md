# Doctor Ali — Qabulxona

The clinic's reception panel: visits, sales, services, debts, the stock room and
the client base, in one screen per job. It is the Next.js port of the Flutter
Web build that ran the desk before it — see [`MIGRATION_AUDIT.md`](./MIGRATION_AUDIT.md)
for what the old app did and [`CHANGES.md`](./CHANGES.md) for what is different
here.

This is an **internal tool behind a login**. It is not indexed, not public, and
holds client records, till figures and staff data.

---

## Running it

```bash
npm install
cp .env.example .env.local
npm run dev                  # http://localhost:3000
```

**Which backend it talks to is one line**, in
[`config/servers.mjs`](./config/servers.mjs):

```js
export const DEFAULT_SERVER = "prod"; // "test" | "prod"
```

That file is the single source of truth — the dev proxy, the media origin,
`next/image`'s allowed hosts, the nginx config and the deploy scripts all read
it, so a host appears in exactly one place. To switch without editing it:

```bash
APP_SERVER=test npm run dev
APP_SERVER=test npm run build
```

An unknown name fails loudly (`resolveServer` lists the valid ones) rather than
silently falling back to production.

`.env.local` is only for the things a server cannot know, plus overrides:

| Variable                      | What it is                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`    | Where the browser sends API calls. Leave it as the path `/api/reception/`              |
| `NEXT_PUBLIC_PRINT_AGENT_URL` | The ESC/POS print agent on the kassa (default `http://localhost:9110`)                 |
| `NEXT_PUBLIC_API_LOGGING`     | `true` keeps the boxed request/response console log on in a production build           |
| `API_PROXY_TARGET`            | **Override** — a backend origin other than the selected server's (e.g. a local Django) |
| `NEXT_PUBLIC_MEDIA_ORIGIN`    | **Override** — where uploaded images come from                                         |
| `NEXT_PUBLIC_SITE_URL`        | **Override** — this panel's own origin, used by `robots.txt` / `sitemap.xml`           |

**Why a path and not the backend's URL.** The browser calls the panel's own
origin and the panel forwards it to the backend, so no request is ever
cross-origin. That means a `npm run dev` on `localhost:3000` can sign in
against production without anyone adding `localhost` to the backend's
`CORS_ALLOWED_ORIGINS` — which is exactly what used to fail at the login
screen. nginx does the same forwarding in production, so the two environments
speak to the API through the same shape.

Pointing the browser straight at the backend still works
(`NEXT_PUBLIC_API_BASE_URL=https://my.imorganic.uz/api/reception/`), but then
the backend has to allow this origin.

## Scripts

| Command                       | What it does                                 |
| ----------------------------- | -------------------------------------------- |
| `npm run dev`                 | Development server                           |
| `npm run build` / `npm start` | Production build and server                  |
| `npm run typecheck`           | `tsc --noEmit`                               |
| `npm run lint`                | ESLint, **zero warnings allowed**            |
| `npm run format`              | Prettier over `src`                          |
| `npm run verify`              | typecheck → lint → build; what CI should run |
| `npm run analyze`             | Build with the bundle treemap                |

A pre-commit hook (husky + lint-staged) lints and formats staged files, so a
commit cannot introduce a warning.

## How it is laid out

```
src/
  app/                     routes only — each page is a thin wrapper around a feature view
    (app)/                 everything behind the login
    (auth)/login           the one route without a session
  features/<name>/
    api/                   endpoint calls and request/response shapes
    components/            the screens and their pieces
    hooks/                 React Query hooks
    schemas/               zod forms
    store/                 Zustand, only where a screen has real client state
    types/                 domain models + tolerant parsers
  shared/
    components/ui/         shadcn primitives
    components/…           app-wide layout, form and feedback components
    lib/api/               the ky client, errors, pagination
    lib/format/            money, dates, phones
    domain/                cross-feature vocabulary (payment types, packaging)
  config/                  routes, env, servers
```

Three rules the code follows throughout, because breaking them is what made the
old build hard to change:

1. **The server owns the money.** Totals, commissions and till splits come from
   the API; the panel prints them. The one place the app does arithmetic is a
   preview that the server then overrides.
2. **Every payload is parsed from `unknown`.** `any` is an ESLint error. An
   unknown enum member degrades to a neutral value instead of breaking a list.
3. **A forbidden action is hidden, not disabled.** Permissions come from
   `auth/me/`; a button nobody may press does not exist on their screen.
4. **Colour carries meaning, so it has to be readable.** Every token clears
   WCAG AA as text inside its own tinted chip — `npm run check:contrast`
   enforces it and runs as part of `npm run verify`.

## Deploying

Two environments, one command each — full walkthrough in
[`deploy/README.md`](./deploy/README.md). Hosts and ports come from
`config/servers.mjs`, so there is no `.env` file to create on the server.

| Environment | Domain                    | Panel port       |
| ----------- | ------------------------- | ---------------- |
| test        | `https://imorganic.uz`    | `127.0.0.1:3001` |
| prod        | `https://my.imorganic.uz` | `127.0.0.1:3000` |

```bash
# Once per server: TLS, then nginx.
sudo certbot certonly --webroot -w /var/www/certbot -d my.imorganic.uz
sudo ./deploy/nginx-setup.sh prod

# Every release.
git pull && ./deploy/deploy.sh prod
```

`deploy.sh` builds the image, replaces the container and waits until the panel
answers — it fails loudly with the last 50 log lines rather than returning a
green shell over a dead deployment. `nginx-setup.sh` renders the template and
only reloads if `nginx -t` passes, so a broken config never reaches a running
server.

nginx terminates TLS, serves `/_next/static` from the immutable cache, and
proxies `/api` to the backend **on the same origin** — which is what keeps the
browser out of CORS entirely.

`NEXT_PUBLIC_*` values are inlined at build time — that is Next's model, so
pointing a deployment at another backend is a rebuild, which is exactly what
`./deploy/deploy.sh <env>` does. `API_PROXY_TARGET` is read at runtime and is
only the fallback for a deployment without nginx in front.

## Printing receipts

Receipts go to a local ESC/POS agent on the kassa (`localhost:9110`), not
through the API client: the browser posts the backend's `receipt` payload
untouched and the agent owns the layout. If the agent is not running, the order
is still saved — printing is a separate, retryable step.
