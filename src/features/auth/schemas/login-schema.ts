import { z } from "zod";

/**
 * Login validation — the two messages ported verbatim from the Flutter form.
 *
 * Nothing more is checked client-side on purpose: the username may be a phone
 * (`998XXXXXXXXX`) or a uid, and only the server knows which accounts have
 * `is_reception=true`. Guessing here would reject valid logins.
 */
export const loginSchema = z.object({
  username: z.string().trim().min(1, "Login kiriting"),
  password: z.string().min(1, "Parol kiriting"),
  /** "Meni eslab qolish" — true persists the session across browser restarts. */
  remember: z.boolean(),
});

export type LoginValues = z.infer<typeof loginSchema>;
