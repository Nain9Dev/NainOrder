/**
 * Formato de presentación. El idioma de la interfaz es español y la moneda el euro,
 * de acuerdo con el ámbito del producto; los datos siguen viajando neutros desde la API.
 */

const LOCALE = "es-ES";

const currency = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const currencyCompact = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1
});

const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

const dateTime = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

const dateShort = new Intl.DateTimeFormat(LOCALE, { day: "2-digit", month: "short" });

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

export const fmtMoney = (value) => currency.format(Number(value) || 0);

/** Versión compacta para métricas grandes: 1,2 M € en lugar de 1.234.567,00 €. */
export const fmtMoneyCompact = (value) => {
  const amount = Number(value) || 0;
  return Math.abs(amount) >= 10_000 ? currencyCompact.format(amount) : currency.format(amount);
};

export const fmtNumber = (value) => integer.format(Number(value) || 0);

export const fmtDateTime = (value) => (value ? dateTime.format(new Date(value)) : "—");

export const fmtDateShort = (value) => (value ? dateShort.format(new Date(value)) : "—");

/** "hace 3 minutos", "ayer"... Cae a fecha absoluta cuando ya no aporta. */
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

  return relative.format(-Math.round(elapsedMs / ms), unit);
};

export const fmtDuration = (milliseconds) =>
  milliseconds < 1000 ? `${Math.round(milliseconds)} ms` : `${(milliseconds / 1000).toFixed(2)} s`;

/** Etiquetas en español de los estados que la API publica en inglés. */
export const STATUS_LABELS = {
  PendingPayment: "Pendiente de pago",
  Paid: "Pagado",
  Processing: "En preparación",
  Shipped: "Enviado",
  Cancelled: "Cancelado"
};

export const STATUS_ICONS = {
  PendingPayment: "clock",
  Paid: "card",
  Processing: "cog",
  Shipped: "truck",
  Cancelled: "ban"
};

export const statusLabel = (status) => STATUS_LABELS[status] ?? status;

export const STOCK_LABELS = {
  in_stock: "En stock",
  low_stock: "Stock bajo",
  out_of_stock: "Sin stock"
};

export const stockLabel = (status) => STOCK_LABELS[status] ?? status;

/** Acciones de transición disponibles, alineadas con los endpoints de la API. */
export const TRANSITION_ACTIONS = {
  Paid: { endpoint: "pay", label: "Cobrar pedido", icon: "card", variant: "primary" },
  Processing: { endpoint: "process", label: "Enviar a preparación", icon: "cog", variant: "" },
  Shipped: { endpoint: "ship", label: "Marcar como enviado", icon: "truck", variant: "" },
  Cancelled: { endpoint: "cancel", label: "Cancelar pedido", icon: "ban", variant: "danger" }
};
