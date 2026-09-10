/**
 * Hands an in-memory file to the browser.
 *
 * Exports are fetched in-app with the Bearer token, so a plain `<a href>` would
 * drop the header and get a 401 — the bytes have to be turned into an object
 * URL and clicked. Ported from Flutter's `WebFileSaver`.
 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Free the object URL once the download has been kicked off.
  URL.revokeObjectURL(url);
}

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Opens a file picker and reads the chosen file as bytes (spreadsheet import). */
export function pickFile(
  accept = "",
): Promise<{ name: string; bytes: Uint8Array } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    // Never attached to the document: `click()` works on a detached element, and
    // a cancelled picker fires no event at all, so nothing is left behind.
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const buffer = reader.result;
        resolve(
          buffer instanceof ArrayBuffer
            ? { name: file.name, bytes: new Uint8Array(buffer) }
            : null,
        );
      };
      reader.onerror = () => resolve(null);
      reader.readAsArrayBuffer(file);
    });
    input.click();
  });
}
