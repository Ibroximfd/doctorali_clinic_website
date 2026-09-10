/**
 * Applies the saved theme **before the first paint**.
 *
 * Without this the page renders light, then flips to dark once React hydrates —
 * a visible flash on every load. The script is tiny, synchronous and runs in
 * `<head>`, matching the Flutter app's synchronous read of `ThemeStorage`.
 */
const SCRIPT = `
try {
  if (localStorage.getItem('theme_mode') === 'dark') {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}
`.trim();

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
