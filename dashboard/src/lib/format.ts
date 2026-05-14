/** Format an ISO date (YYYY-MM-DD or full ISO) as MM/DD/YYYY. */
export function formatDate(raw: string | undefined | null): string {
  if (!raw) return "";
  const ymd = raw.slice(0, 10); // tolerate "2026-05-13" or "2026-05-13T..."
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return raw;
  return `${m}/${d}/${y}`;
}

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function fmtClock(h: number, m: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const mm = String(m).padStart(2, "0");
  return `${h12}:${mm} ${period}`;
}

/**
 * Translate a 5-field cron expression ("min hour dom month dow") into a
 * human-readable phrase. Falls back to the raw expression if it can't parse.
 */
export function formatCron(expr: string | undefined | null): string {
  if (!expr) return "";
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return expr;
  const [minute, hour, dom, month, dow] = fields;

  // every N minutes
  const stepMin = minute.match(/^\*\/(\d+)$/);
  if (stepMin && hour === "*" && dom === "*" && month === "*" && dow === "*") {
    return `Every ${stepMin[1]} minutes`;
  }
  // every minute
  if (minute === "*" && hour === "*" && dom === "*" && month === "*" && dow === "*") {
    return "Every minute";
  }
  // every N hours at :MM
  const stepHr = hour.match(/^\*\/(\d+)$/);
  if (/^\d+$/.test(minute) && stepHr && dom === "*" && month === "*" && dow === "*") {
    return `Every ${stepHr[1]} hours at :${minute.padStart(2, "0")}`;
  }
  if (/^\d+$/.test(minute) && hour === "*" && dom === "*" && month === "*" && dow === "*") {
    return `Every hour at :${minute.padStart(2, "0")}`;
  }

  // Fixed minute + hour
  if (/^\d+$/.test(minute) && /^\d+$/.test(hour)) {
    const time = fmtClock(Number(hour), Number(minute));

    if (dom === "*" && month === "*" && /^\d+$/.test(dow)) {
      return `Every ${DOW[Number(dow) % 7]} at ${time}`;
    }
    if (dom === "*" && month === "*" && dow === "*") {
      return `Daily at ${time}`;
    }
    if (/^\d+$/.test(dom) && month === "*" && dow === "*") {
      return `Monthly on day ${dom} at ${time}`;
    }
    if (/^\d+$/.test(dom) && /^\d+$/.test(month) && dow === "*") {
      return `${MONTHS[(Number(month) - 1 + 12) % 12]} ${dom} at ${time}`;
    }
  }

  return expr;
}
