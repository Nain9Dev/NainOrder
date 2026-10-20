/** Listado de pedidos con filtros del servidor, paginación y acceso al detalle. */

import { html, icon, raw, render, delegate } from "../dom.js";
import { api } from "../api.js";
import { toastError, toastSuccess } from "../toast.js";
import { openOrderPanel } from "../order-panel.js";
import { getState, setActiveOrder } from "../state.js";
import { t } from "../i18n.js";
import { fmtMoney, fmtNumber, fmtRelative, fmtDateTime, statusLabel, STATUS_LABELS } from "../format.js";

const query = { status: "", search: "", customerId: "", page: 1, pageSize: 12 };

const markup = (result, customers) => html`
  <section class="section-head">
    <div>
      <h1 class="section-head__title">${t("orders.title")}</h1>
      <p class="section-head__text">
        ${t("orders.intro")}
      </p>
    </div>
    <button class="btn btn--primary" type="button" data-action="new-order">
      ${raw(icon("plus", { size: 15 }))} ${t("orders.open")}
    </button>
  </section>

  <div class="card" style="padding:var(--space-4)">
    <div class="row">
      <label class="search">
        <span class="visually-hidden">${t("orders.searchLabel")}</span>
        ${raw(icon("search", { size: 16 }))}
        <input class="input mono" type="search" placeholder="${t("orders.searchPlaceholder")}" value="${query.search}"
               data-filter="search" autocomplete="off">
      </label>

      <label class="field" style="min-width:190px">
        <span class="visually-hidden">${t("orders.filter.status")}</span>
        <select class="select" data-filter="status">
          <option value="">${t("orders.filter.allStatuses")}</option>
          ${raw(
            Object.entries(STATUS_LABELS)
              .map(([value, label]) =>
                `<option value="${value}" ${query.status === value ? "selected" : ""}>${label}</option>`)
              .join("")
          )}
        </select>
      </label>

      <label class="field" style="min-width:210px">
        <span class="visually-hidden">${t("orders.filter.customer")}</span>
        <select class="select" data-filter="customerId">
          <option value="">${t("orders.filter.allCustomers")}</option>
          ${raw(
            customers
              .map((customer) =>
                `<option value="${customer.id}" ${query.customerId === customer.id ? "selected" : ""}>${customer.name}</option>`)
              .join("")
          )}
        </select>
      </label>

      <span class="spacer"></span>
      <span class="tag">${t("orders.count", { count: fmtNumber(result.totalCount) })}</span>
    </div>
  </div>

  <article class="card card--flush">
    ${raw(
      result.items.length
        ? html`
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>${t("orders.col.reference")}</th><th>${t("orders.col.customer")}</th><th>${t("orders.col.status")}</th>
                    <th class="align-end">${t("orders.col.lines")}</th><th class="align-end">${t("orders.col.units")}</th>
                    <th class="align-end">${t("orders.col.total")}</th><th class="align-end">${t("orders.col.created")}</th>
                  </tr>
                </thead>
                <tbody>
                  ${raw(
                    result.items
                      .map(
                        (order, index) => html`
                          <tr data-clickable data-order="${order.id}" tabindex="0" class="reveal"
                              style="--i:${index}">
                            <td class="mono">${order.reference}</td>
                            <td>${order.customerName ?? "—"}</td>
                            <td><span class="badge" data-status="${order.status}">${statusLabel(order.status)}</span></td>
                            <td class="align-end numeric">${order.lineCount}</td>
                            <td class="align-end numeric">${fmtNumber(order.totalUnits)}</td>
                            <td class="align-end numeric">${fmtMoney(order.totalAmount)}</td>
                            <td class="align-end" style="color:var(--text-muted)"
                                title="${fmtDateTime(order.createdAt)}">${fmtRelative(order.createdAt)}</td>
                          </tr>
                        `
                      )
                      .join("")
                  )}
                </tbody>
              </table>
            </div>

            <div class="pagination">
              <span>${t("orders.page", { page: result.page, total: Math.max(result.totalPages, 1) })}</span>
              <span class="spacer"></span>
              <button class="btn btn--sm btn--icon" type="button" data-page="prev"
                      ${result.hasPrevious ? "" : "disabled"} aria-label="${t("orders.prevPage")}">
                ${raw(icon("chevronLeft", { size: 15 }))}
              </button>
              <button class="btn btn--sm btn--icon" type="button" data-page="next"
                      ${result.hasNext ? "" : "disabled"} aria-label="${t("orders.nextPage")}">
                ${raw(icon("chevronRight", { size: 15 }))}
              </button>
            </div>
          `
        : html`<div class="empty">
            <span class="empty__icon">${raw(icon("orders", { size: 22 }))}</span>
            <p class="empty__title">${t("orders.empty.title")}</p>
            <p class="empty__text">${t("orders.empty.text")}</p>
            <button class="btn" type="button" data-action="clear-filters">${t("orders.empty.clear")}</button>
          </div>`
    )}
  </article>
`;

export const ordersView = {
  get title() { return t("orders.title"); },
  get subtitle() { return t("orders.subtitle"); },

  async render(outlet) {
    if (!outlet.firstChild) {
      render(outlet, html`<div class="skeleton" style="height:420px"></div>`);
    }

    let result;
    let customers;

    try {
      [result, customers] = await Promise.all([api.orders.list(query), api.customers.list()]);
    } catch (error) {
      toastError(error, t("orders.loadFailed"));
      return;
    }

    const root = render(outlet, markup(result, customers));
    const reload = () => this.render(outlet);

    let debounce;
    delegate(root, "input", '[data-filter="search"]', (event, input) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        query.search = input.value.trim();
        query.page = 1;
        reload();
      }, 280);
    });

    delegate(root, "change", "[data-filter]", (event, control) => {
      if (control.dataset.filter === "search") return;
      query[control.dataset.filter] = control.value;
      query.page = 1;
      reload();
    });

    delegate(root, "click", '[data-action="clear-filters"]', () => {
      Object.assign(query, { status: "", search: "", customerId: "", page: 1 });
      reload();
    });

    delegate(root, "click", "[data-page]", (event, button) => {
      query.page += button.dataset.page === "next" ? 1 : -1;
      reload();
    });

    delegate(root, "click", '[data-action="new-order"]', async () => {
      const customer = getState().customers[0] ?? customers[0];
      if (!customer) {
        toastError(new Error("sin clientes"), t("orders.noCustomers"));
        return;
      }

      try {
        const order = await api.orders.create(customer.id);
        setActiveOrder(order);
        toastSuccess(t("orders.opened"), `${order.reference} · ${customer.name}`);
        await reload();
        openOrderPanel(order.id, { onChange: reload });
      } catch (error) {
        toastError(error, t("orders.openFailed"));
      }
    });

    const openRow = (row) => openOrderPanel(row.dataset.order, { onChange: reload });
    delegate(root, "click", "[data-order]", (event, row) => openRow(row));
    delegate(root, "keydown", "[data-order]", (event, row) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openRow(row);
      }
    });
  }
};
