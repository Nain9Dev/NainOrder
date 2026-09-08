/** Listado de pedidos con filtros del servidor, paginación y acceso al detalle. */

import { html, icon, raw, render, delegate } from "../dom.js";
import { api } from "../api.js";
import { toastError, toastSuccess } from "../toast.js";
import { openOrderPanel } from "../order-panel.js";
import { getState, setActiveOrder } from "../state.js";
import { fmtMoney, fmtNumber, fmtRelative, fmtDateTime, statusLabel, STATUS_LABELS } from "../format.js";

const query = { status: "", search: "", customerId: "", page: 1, pageSize: 12 };

const markup = (result, customers) => html`
  <section class="section-head">
    <div>
      <h1 class="section-head__title">Pedidos</h1>
      <p class="section-head__text">
        Los filtros y la paginación se resuelven en base de datos sobre los totales ya
        materializados, sin cargar las líneas de cada pedido.
      </p>
    </div>
    <button class="btn btn--primary" type="button" data-action="new-order">
      ${raw(icon("plus", { size: 15 }))} Abrir pedido
    </button>
  </section>

  <div class="card" style="padding:var(--space-4)">
    <div class="row">
      <label class="search">
        <span class="visually-hidden">Buscar por referencia</span>
        ${raw(icon("search", { size: 16 }))}
        <input class="input mono" type="search" placeholder="Referencia NO-…" value="${query.search}"
               data-filter="search" autocomplete="off">
      </label>

      <label class="field" style="min-width:190px">
        <span class="visually-hidden">Filtrar por estado</span>
        <select class="select" data-filter="status">
          <option value="">Todos los estados</option>
          ${raw(
            Object.entries(STATUS_LABELS)
              .map(([value, label]) =>
                `<option value="${value}" ${query.status === value ? "selected" : ""}>${label}</option>`)
              .join("")
          )}
        </select>
      </label>

      <label class="field" style="min-width:210px">
        <span class="visually-hidden">Filtrar por cliente</span>
        <select class="select" data-filter="customerId">
          <option value="">Todos los clientes</option>
          ${raw(
            customers
              .map((customer) =>
                `<option value="${customer.id}" ${query.customerId === customer.id ? "selected" : ""}>${customer.name}</option>`)
              .join("")
          )}
        </select>
      </label>

      <span class="spacer"></span>
      <span class="tag">${fmtNumber(result.totalCount)} pedidos</span>
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
                    <th>Referencia</th><th>Cliente</th><th>Estado</th>
                    <th class="align-end">Líneas</th><th class="align-end">Unidades</th>
                    <th class="align-end">Total</th><th class="align-end">Creado</th>
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
              <span>Página ${result.page} de ${Math.max(result.totalPages, 1)}</span>
              <span class="spacer"></span>
              <button class="btn btn--sm btn--icon" type="button" data-page="prev"
                      ${result.hasPrevious ? "" : "disabled"} aria-label="Página anterior">
                ${raw(icon("chevronLeft", { size: 15 }))}
              </button>
              <button class="btn btn--sm btn--icon" type="button" data-page="next"
                      ${result.hasNext ? "" : "disabled"} aria-label="Página siguiente">
                ${raw(icon("chevronRight", { size: 15 }))}
              </button>
            </div>
          `
        : html`<div class="empty">
            <span class="empty__icon">${raw(icon("orders", { size: 22 }))}</span>
            <p class="empty__title">No hay pedidos que mostrar</p>
            <p class="empty__text">Ajusta los filtros o abre un pedido nuevo para empezar.</p>
            <button class="btn" type="button" data-action="clear-filters">Quitar filtros</button>
          </div>`
    )}
  </article>
`;

export const ordersView = {
  title: "Pedidos",
  subtitle: "Ciclo de vida completo, del carrito al envío",

  async render(outlet) {
    if (!outlet.firstChild) {
      render(outlet, html`<div class="skeleton" style="height:420px"></div>`);
    }

    let result;
    let customers;

    try {
      [result, customers] = await Promise.all([api.orders.list(query), api.customers.list()]);
    } catch (error) {
      toastError(error, "No se pudieron cargar los pedidos");
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
        toastError(new Error("sin clientes"), "No hay clientes disponibles");
        return;
      }

      try {
        const order = await api.orders.create(customer.id);
        setActiveOrder(order);
        toastSuccess("Pedido abierto", `${order.reference} · ${customer.name}`);
        await reload();
        openOrderPanel(order.id, { onChange: reload });
      } catch (error) {
        toastError(error, "No se pudo abrir el pedido");
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
