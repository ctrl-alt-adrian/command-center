import { randomBytes } from "crypto";

export function generateId(prefix?: string): string {
  const id = randomBytes(6).toString("hex");
  return prefix ? `${prefix}-${id}` : id;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isoMinusDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}
