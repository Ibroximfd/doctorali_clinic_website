import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, TIME_ZONE } from "./locales";

/**
 * The request-scoped i18n configuration.
 *
 * The locale is not negotiated: this is an internal panel for one clinic, and a
 * browser set to Russian must still show the desk the same Uzbek wording the
 * backend sends in its `*_display` fields — a half-translated screen is worse
 * than an untranslated one.
 */
export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  timeZone: TIME_ZONE,
  messages: (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default,
}));
