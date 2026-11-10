export interface DateRange {
  from: string;
  to: string;
}

export interface FyRange extends DateRange {
  label: string;
  startYear: number;
}

export interface TaxPeriodPreset extends DateRange {
  id: string;
  label: string;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  date.setDate(date.getDate() + days);
  return iso(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * Business profile stores FY start as MM-DD (form default `01-04`) or `YYYY-YY`.
 * `01-04` is treated as 1 April, the Indian financial-year start.
 */
export function fyStartMonthDay(financialYear: string): { month: number; day: number } {
  const raw = (financialYear ?? "").trim();
  if (/^(19|20)\d{2}[-/]\d{2}$/.test(raw)) return { month: 4, day: 1 };
  const parts = raw.split(/[-/]/).map((part) => Number(part));
  if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    const first = parts[0];
    const second = parts[1];
    if (first === 1 && second === 4) return { month: 4, day: 1 };
    if (first > 12 && second >= 1 && second <= 12) return { month: second, day: first };
    if (first >= 1 && first <= 12 && second >= 1 && second <= 31) return { month: first, day: second };
  }
  return { month: 4, day: 1 };
}

export function fyContaining(isoDate: string, financialYear: string): FyRange {
  const { month, day } = fyStartMonthDay(financialYear);
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  const calendarYear = date.getFullYear();
  const startThisYear = new Date(calendarYear, month - 1, day);
  const startYear = date >= startThisYear ? calendarYear : calendarYear - 1;
  const from = iso(startYear, month, day);
  const to = addDaysIso(iso(startYear + 1, month, day), -1);
  const yy = String(startYear).slice(2);
  const ny = String(startYear + 1).slice(2);
  return { from, to, label: `FY ${yy}-${ny}`, startYear };
}

export function fyOptions(now: Date, financialYear: string, count = 3): FyRange[] {
  const current = fyContaining(now.toISOString().slice(0, 10), financialYear);
  const options: FyRange[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const startYear = current.startYear - offset;
    const sample = iso(startYear, fyStartMonthDay(financialYear).month, fyStartMonthDay(financialYear).day);
    options.push(fyContaining(sample, financialYear));
  }
  return options;
}

function monthLabel(isoDate: string): string {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export function taxPeriodPresets(fy: DateRange): TaxPeriodPreset[] {
  const presets: TaxPeriodPreset[] = [
    { id: "fy", label: "Full financial year", from: fy.from, to: fy.to },
  ];
  const start = new Date(`${fy.from}T00:00:00`);
  for (let quarter = 0; quarter < 4; quarter += 1) {
    const fromDate = new Date(start);
    fromDate.setMonth(start.getMonth() + quarter * 3);
    const toDate = new Date(start);
    toDate.setMonth(start.getMonth() + (quarter + 1) * 3);
    toDate.setDate(toDate.getDate() - 1);
    const from = iso(fromDate.getFullYear(), fromDate.getMonth() + 1, fromDate.getDate());
    const to = iso(toDate.getFullYear(), toDate.getMonth() + 1, toDate.getDate());
    if (from > fy.to) break;
    presets.push({
      id: `q${quarter + 1}`,
      label: `Q${quarter + 1} ${monthLabel(from)} – ${monthLabel(to > fy.to ? fy.to : to)}`,
      from,
      to: to > fy.to ? fy.to : to,
    });
  }
  const cursor = new Date(`${fy.from}T00:00:00`);
  const fyEnd = fy.to;
  while (cursor.toISOString().slice(0, 10) <= fyEnd) {
    const from = iso(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + 1);
    const to = addDaysIso(iso(next.getFullYear(), next.getMonth() + 1, next.getDate()), -1);
    presets.push({
      id: `m-${from.slice(0, 7)}`,
      label: monthLabel(from),
      from,
      to: to > fyEnd ? fyEnd : to,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  presets.push({ id: "custom", label: "Custom dates", from: fy.from, to: fy.to });
  return presets;
}
