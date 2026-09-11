export function currency(
  amount: string | number | null | undefined,
  currencyCode = "USD",
) {
  if (amount === null || amount === undefined) return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(n);
}

export function percent(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function shortTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function dateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Elapsed-duration helper for the execution trace: renders "+120ms", "+5.5s",
// "+1m 3s" depending on magnitude.
export function formatDuration(ms: number) {
  const safe = Math.max(0, ms);
  if (safe < 1000) return `+${Math.round(safe)}ms`;
  if (safe < 60000) return `+${(safe / 1000).toFixed(1)}s`;
  return `+${Math.floor(safe / 60000)}m ${Math.round((safe % 60000) / 1000)}s`;
}

export function truncate(value: string, max = 140) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}
