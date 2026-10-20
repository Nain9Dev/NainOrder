/** Panel de control: métricas agregadas del negocio y acceso al escenario guiado. */

import { html, icon, raw, render, $, $$, delegate, countUp } from "../dom.js";
import { api, isDemoMode } from "../api.js";
import { areaChart, distributionBars } from "../charts.js";
import { openModal, withBusy } from "../overlay.js";
import { toastError } from "../toast.js";
import { openOrderPanel } from "../order-panel.js";
import { t } from "../i18n.js";
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

const kpiCard = ({ modifier, label, iconName, value, meta, rawValue, format }) => html`
  <article class="kpi ${modifier}">
    <p class="kpi__label">${raw(icon(iconName, { size: 14 }))} ${label}</p>
    <p class="kpi__value" data-count="${rawValue}" data-format="${format}">${value}</p>
    <p class="kpi__meta">${meta}</p>
  </article>
`;

const simulationModal = (result) =>
  openModal({
    title: t("dash.sim.title"),
    subtitle: t("dash.sim.subtitle", {
      count: result.steps.length,
      duration: fmtDuration(result.elapsedMilliseconds)
    }),
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
        <div class="totals__row"><span>${t("dash.sim.order")}</span><span class="mono">${result.finalOrder.reference}</span></div>
        <div class="totals__row"><span>${t("dash.sim.status")}</span><span>${statusLabel(result.finalOrder.status)}</span></div>
        <div class="totals__row"><span>${t("dash.sim.stock")}</span><span>${t("dash.units", { count: fmtNumber(result.finalProduct.stockQuantity) })}</span></div>
        <div class="totals__row totals__row--grand"><span>${t("dash.sim.amount")}</span><span>${fmtMoney(result.finalOrder.totalAmount)}</span></div>
      </div>
    `,
    footer: html`
      <span class="card__hint">${t("dash.sim.hint")}</span>
      <span class="spacer"></span>
      <button class="btn btn--primary" type="button" data-overlay-close data-autofocus>${t("dash.sim.ok")}</button>
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
        <h1 class="section-head__title">${t("dash.title")}</h1>
        <p class="section-head__text">
          ${isDemoMode() ? t("dash.intro.demo") : t("dash.intro.live")}
        </p>
      </div>
      <div class="row">
        <button class="btn" type="button" data-action="refresh">
          ${raw(icon("refresh", { size: 15 }))} ${t("dash.refresh")}
        </button>
        <button class="btn btn--primary" type="button" data-action="simulate">
          ${raw(icon("play", { size: 15 }))} ${t("palette.scenario")}
        </button>
      </div>
    </section>

    <div class="grid grid--kpi">
      ${raw(
        [
          kpiCard({
            modifier: "kpi--revenue",
            label: t("dash.kpi.revenue"),
            iconName: "euro",
            value: fmtMoneyCompact(stats.confirmedRevenue),
            rawValue: stats.confirmedRevenue,
            format: "money",
            meta: t("dash.kpi.average", { amount: fmtMoney(stats.averageOrderValue) })
          }),
          kpiCard({
            modifier: "kpi--pending",
            label: t("dash.kpi.pending"),
            iconName: "clock",
            value: fmtMoneyCompact(stats.pendingRevenue),
            rawValue: stats.pendingRevenue,
            format: "money",
            meta: t("dash.kpi.orders", { count: fmtNumber(stats.totalOrders) })
          }),
          kpiCard({
            modifier: "kpi--orders",
            label: t("dash.kpi.customers"),
            iconName: "users",
            value: fmtNumber(stats.totalCustomers),
            rawValue: stats.totalCustomers,
            format: "number",
            meta: t("dash.kpi.products", { count: fmtNumber(stats.totalProducts) })
          }),
          kpiCard({
            modifier: "kpi--stock",
            label: t("dash.kpi.stock"),
            iconName: "boxes",
            value: fmtNumber(stats.totalStockUnits),
            rawValue: stats.totalStockUnits,
            format: "number",
            meta: stats.lowStockProducts > 0
              ? t("dash.kpi.low", { count: stats.lowStockProducts })
              : t("dash.kpi.noLow")
          })
        ].join("")
      )}
    </div>

    <div class="grid grid--split">
      <article class="card">
        <header class="card__header">
          <div>
            <h2 class="card__title">${t("dash.kpi.revenue")}</h2>
            <p class="card__hint">${t("dash.revenue.hint")}</p>
          </div>
          <span class="tag">${raw(icon("trending", { size: 13 }))}</span>
        </header>
        ${raw(areaChart(stats.revenueTimeline))}
      </article>

      <article class="card">
        <header class="card__header">
          <div>
            <h2 class="card__title">${t("dash.dist.title")}</h2>
            <p class="card__hint">${t("dash.dist.hint")}</p>
          </div>
        </header>
        ${raw(distributionBars(distribution))}
      </article>
    </div>

    <div class="grid grid--split">
      <article class="card card--flush">
        <header class="card__header" style="padding:var(--space-5) var(--space-5) 0">
          <div>
            <h2 class="card__title">${t("dash.recent.title")}</h2>
            <p class="card__hint">${t("dash.recent.hint")}</p>
          </div>
        </header>

        ${raw(
          hasOrders
            ? html`<div class="table-wrap" style="margin-top:var(--space-4)">
                <table class="table">
                  <thead>
                    <tr>
                      <th>${t("dash.col.reference")}</th><th>${t("dash.col.customer")}</th><th>${t("dash.col.status")}</th>
                      <th class="align-end">${t("dash.col.total")}</th><th class="align-end">${t("dash.col.created")}</th>
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
                <p class="empty__title">${t("dash.empty.title")}</p>
                <p class="empty__text">${t("dash.empty.text")}</p>
              </div>`
        )}
      </article>

      <article class="card">
        <header class="card__header">
          <div>
            <h2 class="card__title">${t("dash.top.title")}</h2>
            <p class="card__hint">${t("dash.top.hint")}</p>
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
                            <p class="rank__meta mono">${product.sku} · ${t("dash.units", { count: product.unitsSold })}</p>
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
                <p class="empty__text">${t("dash.top.empty")}</p>
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
  get title() { return t("dash.title"); },
  get subtitle() { return t("dash.subtitle"); },

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
      toastError(error, t("dash.loadFailed"));
      const errorRoot = render(outlet, html`
        <div class="empty">
          <span class="empty__icon">${raw(icon("alert", { size: 22 }))}</span>
          <p class="empty__title">${t("dash.noData.title")}</p>
          <p class="empty__text">${t("dash.noData.text")}</p>
          <button class="btn" type="button" data-action="refresh">${t("dash.retry")}</button>
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
        toastError(error, t("dash.simFailed"));
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
