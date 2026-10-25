function cell(value: unknown) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: (keyof T)[]) {
  const header = columns.map((c) => cell(c)).join(",");
  const body = rows.map((r) => columns.map((c) => cell(r[c])).join(","));
  return [header, ...body].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  // BOM so Excel opens Sinhala/Tamil text correctly
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
