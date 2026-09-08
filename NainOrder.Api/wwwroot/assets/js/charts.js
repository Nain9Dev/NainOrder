/**
 * Gráficos en SVG generados a mano. Evitan una librería de terceros para mantener
 * la demo sin dependencias y sin proceso de compilación, y pesan unos pocos KB.
 */

import { html, raw } from "./dom.js";
import { fmtMoney, fmtDateShort } from "./format.js";

const VIEW_WIDTH = 720;
const VIEW_HEIGHT = 220;
const PADDING = { top: 16, right: 8, bottom: 26, left: 8 };

/**
 * Interpolación monótona: suaviza la curva sin inventar máximos ni mínimos que
 * no existen en los datos, algo que sí ocurre con una spline cardinal sin control.
 */
const buildSmoothPath = (points) => {
  if (points.length < 2) return "";

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const controlX = (current.x + next.x) / 2;
    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }

  return path;
};

/**
 * Gráfico de área para la serie de ingresos.
 * @param {{date:string, amount:number, orders:number}[]} series
 */
export const areaChart = (series) => {
  if (!series?.length) {
    return html`<svg class="chart" viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" role="img"
      aria-label="Sin datos de ingresos">
      <text class="chart__empty" x="${VIEW_WIDTH / 2}" y="${VIEW_HEIGHT / 2}"
        text-anchor="middle">Sin actividad registrada todavía</text>
    </svg>`;
  }

  const innerWidth = VIEW_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = VIEW_HEIGHT - PADDING.top - PADDING.bottom;

  const maxAmount = Math.max(...series.map((point) => point.amount), 1);
  const stepX = series.length > 1 ? innerWidth / (series.length - 1) : 0;

  const points = series.map((point, index) => ({
    ...point,
    x: PADDING.left + index * stepX,
    y: PADDING.top + innerHeight - (point.amount / maxAmount) * innerHeight
  }));

  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${points.at(-1).x} ${PADDING.top + innerHeight} L ${points[0].x} ${PADDING.top + innerHeight} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = PADDING.top + innerHeight * ratio;
      return `<line class="chart__grid" x1="${PADDING.left}" y1="${y}" x2="${VIEW_WIDTH - PADDING.right}" y2="${y}"/>`;
    })
    .join("");

  // Solo se etiquetan algunos días para que el eje no se sature en pantallas pequeñas.
  const labelStride = Math.max(1, Math.ceil(series.length / 7));
  const labels = points
    .map((point, index) =>
      index % labelStride === 0 || index === points.length - 1
        ? `<text class="chart__axis-label" x="${point.x}" y="${VIEW_HEIGHT - 6}" text-anchor="middle">${fmtDateShort(point.date)}</text>`
        : ""
    )
    .join("");

  const hitWidth = stepX || innerWidth;
  const markers = points
    .map((point) => {
      const tooltip = `${fmtDateShort(point.date)} · ${fmtMoney(point.amount)} · ${point.orders} pedido${point.orders === 1 ? "" : "s"}`;
      return `
        <rect class="chart__hit" x="${point.x - hitWidth / 2}" y="${PADDING.top}"
              width="${hitWidth}" height="${innerHeight}" tabindex="0" role="img"
              aria-label="${tooltip}"><title>${tooltip}</title></rect>
        <circle class="chart__dot" cx="${point.x}" cy="${point.y}" r="4"/>`;
    })
    .join("");

  return html`
    <svg class="chart" viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}"
         role="group" aria-label="Ingresos confirmados por día">
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--brand-1)" stop-opacity="0.34"/>
          <stop offset="100%" stop-color="var(--brand-1)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${raw(gridLines)}
      <path class="chart__area" d="${areaPath}"/>
      <path class="chart__line" d="${linePath}"/>
      ${raw(labels)}
      ${raw(markers)}
    </svg>
  `;
};

/**
 * Barras horizontales para la distribución por estado.
 * @param {{label:string, value:number, amount:number, color:string}[]} rows
 */
export const distributionBars = (rows) => {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return html`
    <div class="distribution">
      ${raw(
        rows
          .map(
            (row, index) => html`
              <div class="distribution__row">
                <span class="badge" data-status="${row.status}">${row.label}</span>
                <span class="distribution__track">
                  <span class="distribution__fill" style="--i:${index};--bar-color:${row.color};width:${(row.value / max) * 100}%"></span>
                </span>
                <span class="distribution__value">${row.value}</span>
              </div>
            `
          )
          .join("")
      )}
    </div>
  `;
};
