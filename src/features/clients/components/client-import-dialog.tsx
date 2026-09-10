"use client";

import { FileSpreadsheet, TriangleAlert, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { cn } from "@/shared/lib/utils";

import { useImportClients } from "../hooks/use-clients";
import { affectedRows, type ClientImportReport } from "../types/client-admin";

/**
 * Imports a client base from a spreadsheet (admin only).
 *
 * Always two passes. The first is a dry run that writes nothing and returns
 * exactly what would happen — created, updated, skipped, and every bad row with
 * its line number. Only after the admin has read that does the same file go up
 * again for real: importing a few hundred clients is not something anyone
 * should discover the result of afterwards.
 */
export function ClientImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const importClients = useImportClients();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ClientImportReport | null>(null);

  /** True once a dry run has produced a report for the selected file. */
  const previewed = report !== null && report.dryRun;

  async function run(selected: File, dryRun: boolean) {
    const result = await importClients.mutateAsync({ file: selected, dryRun });
    setReport(result);
    if (!dryRun) onOpenChange(false);
  }

  function reset() {
    setFile(null);
    setReport(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Mijozlarni import qilish</DialogTitle>
          <DialogDescription>
            Avval fayl tekshiriladi va natija ko&rsquo;rsatiladi — hech narsa yozilmaydi.
            Yozish faqat siz tasdiqlaganingizdan keyin bo&rsquo;ladi.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                setReport(null);
                if (selected) void run(selected, true);
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="h-[46px] w-full justify-start"
              onClick={() => inputRef.current?.click()}
              disabled={importClients.isPending}
            >
              <FileSpreadsheet className="size-4" aria-hidden />
              {file ? file.name : "Faylni tanlang (.xlsx)"}
            </Button>
          </div>

          {importClients.isPending && (
            <p className="text-caption text-text-tertiary">Fayl tekshirilmoqda…</p>
          )}

          {report && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Figure label="Jami" value={report.total} />
                <Figure label="Yangi" value={report.created} tone="text-success" />
                <Figure label="Yangilanadi" value={report.updated} tone="text-info" />
                <Figure label="O'tkazildi" value={report.skipped} />
              </div>

              {report.errors.length > 0 && (
                <div className="border-danger/30 bg-danger/8 rounded-md border p-3">
                  <p className="text-caption text-danger mb-1.5 flex items-center gap-1.5">
                    <TriangleAlert className="size-4" aria-hidden />
                    {report.errors.length} ta qator qabul qilinmadi
                  </p>
                  <ul className="flex max-h-[160px] flex-col gap-1 overflow-y-auto">
                    {report.errors.map((entry) => (
                      <li key={`${entry.row}:${entry.message}`} className="text-caption">
                        <span className="text-text-tertiary tabular">
                          {entry.row}-qator:
                        </span>{" "}
                        {entry.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {previewed && affectedRows(report) === 0 && (
                <p className="text-caption text-text-tertiary">
                  Bu fayl hech narsani o&rsquo;zgartirmaydi.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button
            type="button"
            disabled={
              file === null ||
              !previewed ||
              affectedRows(report) === 0 ||
              importClients.isPending
            }
            onClick={() => file && void run(file, false)}
          >
            <Upload className="size-4" aria-hidden />
            {previewed ? `${affectedRows(report)} ta qatorni yozish` : "Import qilish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Figure({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="border-border bg-surface-alt rounded-md border p-3">
      <p className={cn("text-title-lg tabular", tone)}>{value}</p>
      <p className="text-caption text-text-tertiary">{label}</p>
    </div>
  );
}
