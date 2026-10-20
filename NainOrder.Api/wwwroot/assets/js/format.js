/**
 * Presentation formatting. Numbers, dates and labels follow the active language (Spanish or
 * English); the currency is the euro, per the product's scope. Data keeps travelling neutral
 * from the API.
 */

import { intlLocale, t } from "./i18n.js";

const cache = new Map();

/** Formatters are built once per language and reused. */
const formatter = (kind, create) => {
  const key = `${kind}:${intlLocale()}`;
  if (!cache.has(key)) cache.set(key, create(intlLocale()));
  return cache.get(key);
};

const currency = () =>
  formatter("currency", (l) => new Intl.NumberFormat(l, {
    style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2
  }));

const currencyCompact = () =>
  formatter("compact", (l) => new Intl.NumberFormat(l, {
    style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1
  }));

const integer = () => formatter("integer", (l) => new Intl.NumberFormat(l, { maximumFractionDigits: 0 }));

const dateTime = () =>
  formatter("dateTime", (l) => new Intl.DateTimeFormat(l, {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  }));

const dateShort = () => formatter("dateShort", (l) => new Intl.DateTimeFormat(l, { day: "2-digit", month: "short" }));

const relative = () => formatter("relative", (l) => new Intl.RelativeTimeFormat(l, { numeric: "auto" }));

export const fmtMoney = (value) => currency().format(Number(value) || 0);

/** Compact version for large metrics: 1.2M € instead of 1,234,567.00 €. */
export const fmtMoneyCompact = (value) => {
  const amount = Number(value) || 0;
  return Math.abs(amount) >= 10_000 ? currencyCompact().format(amount) : currency().format(amount);
};

export const fmtNumber = (value) => integer().format(Number(value) || 0);

export const fmtDateTime = (value) => (value ? dateTime().format(new Date(value)) : "—");

export const fmtDateShort = (value) => (value ? dateShort().format(new Date(value)) : "—");

/** "3 minutes ago", "yesterday"... Falls back to an absolute date once it stops helping. */
export const fmtRelative = (value) => {
  if (!value) return "—";

  const elapsedMs = Date.now() - new Date(value).getTime();
  const units = [
    ["second", 1000],
    ["minute", 60_000],
    ["hour", 3_600_000],
    ["day", 86_400_000]
  ];

  if (elapsedMs > 7 * 86_400_000) return fmtDateShort(value);

  let [unit, ms] = units[0];
  for (const [candidateUnit, candidateMs] of units) {
    if (Math.abs(elapsedMs) >= candidateMs) [unit, ms] = [candidateUnit, candidateMs];
  }

  return relative().format(-Math.round(elapsedMs / ms), unit);
};

export const fmtDuration = (milliseconds) =>
  milliseconds < 1000 ? `${Math.round(milliseconds)} ms` : `${(milliseconds / 1000).toFixed(2)} s`;

/** An object whose enumerable properties are translated on every read, so a language switch shows at once. */
const labels = (prefix, keys) => {
  const result = {};
  keys.forEach((key) => Object.defineProperty(result, key, { enumerable: true, get: () => t(`${prefix}.${key}`) }));
  return result;
};

/** Labels for the order states the API publishes in English. */
export const STATUS_LABELS = labels("status", ["PendingPayment", "Paid", "Processing", "Shipped", "Cancelled"]);

export const STATUS_ICONS = {
  PendingPayment: "clock",
  Paid: "card",
  Processing: "cog",
  Shipped: "truck",
  Cancelled: "ban"
};

export const statusLabel = (status) => (status in STATUS_LABELS ? STATUS_LABELS[status] : status);

export const STOCK_LABELS = labels("stock", ["in_stock", "low_stock", "out_of_stock"]);

export const stockLabel = (status) => (status in STOCK_LABELS ? STOCK_LABELS[status] : status);

/** Available transition actions, aligned with the API endpoints. */
const transition = (endpoint, key, icon, variant) => ({
  endpoint,
  get label() { return t(`transition.${key}`); },
  icon,
  variant
});

export const TRANSITION_ACTIONS = {
  Paid: transition("pay", "pay", "card", "primary"),
  Processing: transition("process", "process", "cog", ""),
  Shipped: transition("ship", "ship", "truck", ""),
  Cancelled: transition("cancel", "cancel", "ban", "danger")
};
