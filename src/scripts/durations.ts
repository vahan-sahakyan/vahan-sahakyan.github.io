// durations.ts - live "x yrs y mos" for ongoing roles, and the footer year

export function formatSince(since: string, now = new Date()) {
  const start = new Date(since);
  return format((now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1);
}

function format(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years ? `${years} ${years === 1 ? "yr" : "yrs"}` : "";
  const m = rest ? `${rest} ${rest === 1 ? "mo" : "mos"}` : "";
  return [y, m].filter(Boolean).join(" ") || "1 mo";
}

export function initDurations() {
  const now = new Date();
  for (const el of document.querySelectorAll<HTMLElement>("[data-since]")) {
    if (el.dataset.since) el.textContent = formatSince(el.dataset.since, now);
  }
  for (const el of document.querySelectorAll("[data-year]")) el.textContent = String(now.getFullYear());
}
