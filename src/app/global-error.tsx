"use client";

/**
 * The last-resort boundary: a failure in the root layout itself, where no
 * provider, font or stylesheet is guaranteed to have loaded.
 *
 * It therefore renders its own `<html>`/`<body>` and uses inline styles rather
 * than Tailwind classes or the i18n provider — anything else could be the very
 * thing that just failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="uz">
      <body
        style={{
          display: "flex",
          minHeight: "100dvh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            Dastur ishga tushmadi
          </h1>
          <p style={{ color: "#5A6B5F", marginTop: 8 }}>
            Sahifani qayta yuklang. Xatolik takrorlansa, administratorga murojaat qiling.
          </p>
          {error.digest && (
            <p style={{ color: "#8A9A8F", marginTop: 8, fontSize: 13 }}>
              Kod: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: "#2E9E6B",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Qayta yuklash
          </button>
        </div>
      </body>
    </html>
  );
}
