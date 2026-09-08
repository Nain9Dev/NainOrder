/** Panel de control: métricas agregadas del negocio y acceso al escenario guiado. */

import { html, icon, raw, render, $, $$, delegate, countUp } from "../dom.js";
import { api } from "../api.js";
import { areaChart, distributionBars } from "../charts.js";
import { openModal, withBusy } from "../overlay.js";
import { toastError } from "../toast.js";
import { openOrderPanel } from "../order-panel.js";
import {
  fmtMoney, fmtMoneyCompact, fmtNumber, fmtRelative, fmtDuration, statusLabel
} from "../format.js";

const STATUS_COLORS = {
  PendingPayment: "var(--status-pending)",
  Paid: "var(--status-paid)",
  Processing: "var(--status-processing)",
  Shipped: "var(--status-shipped)",
  Cancelled: "var(--status-cancelled)"
};

const skeleton = () => html`
  <div class="grid grid--kpi">
    ${raw(Array.from({ length: 4 }, () => '<div class="skeleton" style="height:118px"></div>').join(""))}
  </div>
  <div class="grid grid--split">
    <div class="skeleton" style="height:330px"></div>
    <div class="skeleton" style="height:330px"></div>
  </div>
`;

const kpiCard = ({ modifier, label, iconName, value, meta, raw: rawValue, format }) => html`
  <article class="kpi ${modifier}">
    <p class="kpi__label">${raw(icon(iconName, { size: 14 }))} ${label}</p>
    <p class="kpi__value" data-count="${rawValue}" data-format="${format}">${value}</p>
    <p class="kpi__meta">${meta}</p>
  </article>
`;

const simulationModal = (result) =>
  openModal({
    title: "Escenario guiado ejecutado",
    subtitle: `${result.steps.length} operaciones en ${fmtDuration(result.elapsedMilliseconds)}`,
    size: 620,
    body: html`
      <p style="font-size:var(--text-sm);color:var(--text-secondary)">${result.message}</p>

      <div class="stack" style="gap:var(--space-2)">
        ${raw(
          result.steps
            .map(
              (step) => html`
                <div class="sim-step" style="--i:${step.order - 1}">
                  <span class="sim-step__num">${step.order}</span>
                  <div style="min-width:0">
                    <p class="sim-step__op">${step.operation}</p>
                    <p class="sim-step__text">${step.explanation}</p>
                  </div>
                  <span class="sim-step__ms">${step.elapsedMilliseconds} ms</span>
                </div>
              `
            )
            .join("")
        )}
      </div>

      <div class="totals">
        <div class="totals__row"><span>Pedido resultante</span><span class="mono">${result.finalOrder.reference}</span></div>
        <div class="totals__row"><span>Estado final</span><span>${statusLabel(result.finalOrder.status)}</span></div>
        <div class="totals__row"><span>Stock restante del producto</span><span>${fmtNumber(result.finalProduct.stockQuantity)} uds.</span></div>
        <div class="totals__row totals__row--grand"><span>Importe</span><span>${fmtMoney(result.finalOrder.totalAmount)}</span></div>
      </div>
    `,
    footer: html`
      <span class="card__hint">Todas las reglas las ha validado el dominio, no el controlador.</span>
      <span class="spacer"></span>
      <button class="btn btn--primary" type="button" data-overlay-close data-autofocus>Entendido</button>
    `
  });

const markup = (stats, orders) => {
  const distribution = stats.statusBreakdown.map((row) => ({
    status: row.status,
    label: statusLabel(row.status),
    value: row.count,
    color: STATUS_COLORS[row.status]
  }));

  const hasOrders = orders.items.length > 0;

  return html`
    <section class="section-head">
      <div>
        <h1 class="section-head__title">Panel de control</h1>
        <p class="section-head__text">
          Métricas agregadas en base de datos sobre importes almacenados en céntimos enteros,
          no calculadas en memoria.
        </p>
      </div>
      <div class="row">
        <button class="btn" type="button" data-action="refresh">
          ${raw(icon("refresh", { size: 15 }))} Actualizar
        </button>
        <button class="btn btn--primary" type="button" data-action="simulate">
          ${raw(icon("play", { size: 15 }))} Ejecutar escenario guiado
        </button>
      </div>
    </section>

    <div class="grid grid--kpi">
      ${raw(
        [
          kpiCard({
            modifier: "kpi--revenue",
            label: "Ingresos confirmados",
            iconName: "euro",
            value: fmtMoneyCompact(stats.confirmedRevenue),
            rawValue: stats.confirmedRevenue,
            format: "money",
            meta: `Ticket medio ${fmtMoney(stats.averageOrderValue)}`
          }),
          kpiCard({
            modifier: "kpi--pending",
            label: "Pendiente de cobro",
            iconName: "clock",
            value: fmtMoneyCompact(stats.pendingRevenue),
            rawValue: stats.pendingRevenue,
            format: "money",
            meta: `${fmtNumber(stats.totalOrders)} pedidos en total`
          }),
          kpiCard({
            modifier: "kpi--orders",
            label: "Clientes",
            iconName: "users",
            value: fmtNumber(stats.totalCustomers),
            rawValue: stats.totalCustomers,
            format: "number",
            meta: `${fmtNumber(stats.totalProducts)} referencias en catálogo`
          }),
          kpiCard({
            modifier: "kpi--stock",
            label: "Unidades en stock",
            iconName: "boxes",
            value: fmtNumber(stats.totalStockUnits),
            rawValue: stats.totalStockUnits,
            format: "number",
            meta: stats.lowStockProducts > 0
              ? `${stats.lowStockProducts} referencias bajo mínimos`
              : "Sin referencias bajo mínimos"
          })
        ].join("")
      )}
    </div>

    <div class="grid grid--split">
      <article class="card">
        <header class="card__header">
          <div>
            <h2 class="card__title">Ingresos confirmados</h2>
            <p class="card__hint">Últimos 14 días · pedidos pagados, en preparación o enviados</p>
          </div>
          <span class="tag">${raw(icon("trending", { size: 13 }))}</span>
        </header>
        ${raw(areaChart(stats.revenueTimeline))}
      </article>

      <article class="card">
        <header class="card__header">
          <div>
            <h2 class="card__title">Distribución por estado</h2>
            <p class="card__hint">Todos los estados de la máquina, incluidos los vacíos</p>
          </div>
        </header>
        ${raw(distributionBars(distribution))}
      </article>
    </div>

    <div class="grid grid--split">
      <article class="card card--flush">
        <header class="card__header" style="padding:var(--space-5) var(--space-5) 0">
          <div>
            <h2 class="card__title">Pedidos recientes</h2>
            <p class="card__hint">Pulsa una fila para abrir el detalle y operar sobre el pedido</p>
          </div>
        </header>

        ${raw(
          hasOrders
            ? html`<div class="table-wrap" style="margin-top:var(--space-4)">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Referencia</th><th>Cliente</th><th>Estado</th>
                      <th class="align-end">Total</th><th class="align-end">Creado</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${raw(
                      orders.items
                        .map(
                          (order) => html`
                            <tr data-clickable data-order="${order.id}" tabindex="0">
                              <td class="mono">${order.reference}</td>
                              <td>${order.customerName ?? "—"}</td>
                              <td><span class="badge" data-status="${order.status}">${statusLabel(order.status)}</span></td>
                              <td class="align-end numeric">${fmtMoney(order.totalAmount)}</td>
                              <td class="align-end" style="color:var(--text-muted)">${fmtRelative(order.createdAt)}</td>
                            </tr>
                          `
                        )
                        .join("")
                    )}
                  </tbody>
                </table>
              </div>`
            : html`<div class="empty">
                <span class="empty__icon">${raw(icon("orders", { size: 22 }))}</span>
                <p class="empty__title">Todavía no hay pedidos</p>
                <p class="empty__text">Ejecuta el escenario guiado o añade productos del catálogo a un pedido nuevo.</p>
              </div>`
        )}
      </article>

      <article class="card">
        <header class="card__header">
          <div>
            <h2 class="card__title">Más vendidos</h2>
            <p class="card__hint">Por unidades, excluyendo pedidos cancelados</p>
          </div>
        </header>

        ${raw(
          stats.topProducts.length
            ? html`<div class="rank">
                ${raw(
                  stats.topProducts
                    .map(
                      (product, index) => html`
                        <div class="rank__row">
                          <span class="rank__pos">${index + 1}</span>
                          <div class="rank__body">
                            <p class="rank__name">${product.name}</p>
                            <p class="rank__meta mono">${product.sku} · ${product.unitsSold} uds.</p>
                          </div>
                          <span class="rank__value">${fmtMoney(product.revenue)}</span>
                        </div>
                      `
                    )
                    .join("")
                )}
              </div>`
            : html`<div class="empty" style="padding:var(--space-6) var(--space-4)">
                <span class="empty__icon">${raw(icon("trending", { size: 22 }))}</span>
                <p class="empty__text">Sin ventas registradas todavía.</p>
              </div>`
        )}
      </article>
    </div>
  `;
};

const animateCounters = (container) => {
  $$("[data-count]", container).forEach((node) => {
    const target = Number(node.dataset.count);
    const format = node.dataset.format === "money" ? fmtMoneyCompact : fmtNumber;
    countUp(node, target, { format });
  });
};

export const dashboardView = {
  title: "Panel de control",
  subtitle: "Estado del motor de pedidos en tiempo real",

  async render(outlet) {
    render(outlet, skeleton());

    let stats;
    let orders;

    try {
      [stats, orders] = await Promise.all([
        api.dashboard.stats(),
        api.orders.list({ page: 1, pageSize: 6 })
      ]);
    } catch (error) {
      toastError(error, "No se pudieron cargar las métricas");
      const errorRoot = render(outlet, html`
        <div class="empty">
          <span class="empty__icon">${raw(icon("alert", { size: 22 }))}</span>
          <p class="empty__title">No hay datos disponibles</p>
          <p class="empty__text">La API no respondió correctamente. Comprueba que el servicio está en marcha.</p>
          <button class="btn" type="button" data-action="refresh">Reintentar</button>
        </div>
      `);
      delegate(errorRoot, "click", '[data-action="refresh"]', () => this.render(outlet));
      return;
    }

    const root = render(outlet, markup(stats, orders));
    animateCounters(root);

    delegate(root, "click", '[data-action="refresh"]', () => this.render(outlet));

    delegate(root, "click", '[data-action="simulate"]', async (event, button) => {
      try {
        const result = await withBusy(button, () => api.demo.simulate());
        simulationModal(result);
        // El escenario altera stock y pedidos: el panel deja de ser válido.
        await this.render(outlet);
      } catch (error) {
        toastError(error, "El escenario guiado falló");
      }
    });

    const openRow = (row) =>
      openOrderPanel(row.dataset.order, { onChange: () => this.render(outlet) });

    delegate(root, "click", "[data-order]", (event, row) => openRow(row));
    delegate(root, "keydown", "[data-order]", (event, row) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openRow(row);
      }
    });
  }
};
