/**
 * The environments this panel can be pointed at.
 *
 * Kept as data rather than scattered string literals so switching a build
 * between dev / test / prod is one `NEXT_PUBLIC_API_BASE_URL` value, and so the
 * README can list the real URLs in one place.
 */
export interface ServerConfig {
  readonly key: "dev" | "test" | "prod";
  readonly label: string;
  readonly apiBaseUrl: string;
}

export const servers: readonly ServerConfig[] = [
  {
    key: "dev",
    label: "Lokal backend",
    apiBaseUrl: "http://localhost:8000/api/reception/",
  },
  {
    key: "test",
    label: "Test serveri",
    apiBaseUrl: "https://test.imorganic.uz/api/reception/",
  },
  {
    key: "prod",
    label: "Ishlab chiqarish",
    apiBaseUrl: "https://my.imorganic.uz/api/reception/",
  },
] as const;

export function serverFor(key: ServerConfig["key"]): ServerConfig {
  const found = servers.find((s) => s.key === key);
  if (!found) throw new Error(`Unknown server key: ${key}`);
  return found;
}
