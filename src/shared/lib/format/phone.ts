/**
 * Uzbek phone handling — ported from Flutter's `UzPhoneInputFormatter`.
 *
 * Two representations, and mixing them up is the classic bug:
 *   • API value  — `998901234567` (12 digits, NO plus). Everything sent or
 *     received over the wire is this.
 *   • Display    — `+998 (90) 123-45-67`. Everything a human sees is this.
 *
 * Internally only the 9 national digits are kept; both forms are derived.
 */

const PREFIX = "+998 ";

/** The 9 national digits from any masked, raw or API string (may be shorter). */
export function nationalDigits(text: string): string {
  let digits = text.replace(/\D/g, "");
  if (digits.startsWith("998")) digits = digits.slice(3);
  return digits.slice(0, 9);
}

/** Builds `+998 (90) 123-45-67` from up to 9 national digits. */
export function maskFromDigits(digits: string): string {
  let out = PREFIX;
  for (let i = 0; i < digits.length; i++) {
    if (i === 0) out += "(";
    else if (i === 2) out += ") ";
    else if (i === 5) out += "-";
    else if (i === 7) out += "-";
    out += digits[i];
  }
  return out;
}

/** Applies the mask to whatever the user just typed. */
export function formatPhoneInput(raw: string): string {
  return maskFromDigits(nationalDigits(raw));
}

/** The value the API expects: `998XXXXXXXXX`. */
export function phoneToApi(text: string): string {
  return `998${nationalDigits(text)}`;
}

/** `998901234567` → `+998 (90) 123-45-67`. Empty input yields an empty string. */
export function phoneFromApi(apiPhone: string): string {
  if (!apiPhone) return "";
  return maskFromDigits(nationalDigits(apiPhone));
}

/** True once a complete 9-digit national number is present. */
export function isPhoneComplete(text: string): boolean {
  return nationalDigits(text).length === 9;
}

/** A `tel:` URI for the desk's click-to-call. */
export function telUri(apiPhone: string): string {
  return `tel:+${apiPhone.replace(/\D/g, "")}`;
}
