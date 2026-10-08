/** إزالة رموز HTML من النصوص المُدخلة (الواجهة تهرّب عند العرض أيضًا) */
export function sanitizeText(s: unknown): string {
  return typeof s === 'string' ? s.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim() : '';
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '\uFEFF';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // منع حقن الصيغ في Excel
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}
