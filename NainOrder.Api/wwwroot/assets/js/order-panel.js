/**
 * Panel de detalle del pedido. Lo comparten el catálogo y el listado, así que vive
 * aparte de ambas vistas: es el único sitio donde se dibuja el ciclo de vida y donde
 * se ejecutan las transiciones de estado.
 */

import { html, icon, raw, delegate, $ } from "./dom.js";
import { api } from "./api.js";
import { openDrawer, confirmAction, withBusy } from "./overlay.js";
import { toast, toastError, toastSuccess } from "./toast.js";
import { setActiveOrder, getState, clearActiveOrder } from "./state.js";
import {
  fmtMoney, fmtDateTime, fmtNumber, statusLabel, STATUS_ICONS, TRANSITION_ACTIONS
} from "./format.js";

/** Orden natural de la vía principal del pedido. Cancelado es una rama aparte. */
const HAPPY_PATH = ["PendingPayment", "Paid", "Processing", "Shipped"];

const STEP_COLORS = {
  PendingPayment: "var(--status-pending)",
  Paid: "var(--status-paid)",
  Processing: "var(--status-processing)",
  Shipped: "var(--status-shipped)",
  Cancelled: "var(--status-cancelled)"
};

const lifecycle = (order) => {
  const cancelled = order.status === "Cancelled";
  const reachedIndex = cancelled ? -1 : HAPPY_PATH.indexOf(order.status);

  const timestamps = {
    PendingPayment: order.createdAt,
    Paid: order.paidAt,
    Processing: order.paidAt && !cancelled && reachedIndex >= 2 ? order.paidAt : null,
    Shipped: order.shippedAt
  };

  const steps = HAPPY_PATH.map((status, index) => {
    const done = !cancelled && index <= reachedIndex;
    return html`
      <li class="lifecycle__step" data-done="${done}" data-current="${status === order.status}"
          style="--step-color:${STEP_COLORS[status]}">
        <span class="lifecycle__marker">${raw(icon(done ? "check" : STATUS_ICONS[status], { size: 12 }))}</span>
        <div>
          <p class="lifecycle__label">${statusLabel(status)}</p>
          <p class="lifecycle__time">${timestamps[status] ? fmtDateTime(timestamps[status]) : "Pendiente"}</p>
        </div>
      </li>
    `;
  });

  if (cancelled) {
    steps.push(html`
      <li class="lifecycle__step" data-done="true" data-current="true"
          style="--step-color:${STEP_COLORS.Cancelled}">
        <span class="lifecycle__marker">${raw(icon("ban", { size: 12 }))}</span>
        <div>
          <p class="lifecycle__label">Cancelado</p>
          <p class="lifecycle__time">${fmtDateTime(order.cancelledAt)}</p>
        </div>
      </li>
    `);
  }

  return html`<ol class="lifecycle" style="list-style:none;padding:0">${raw(steps.join(""))}</ol>`;
};

const itemRow = (item, editable) => html`
  <li class="line-item" data-product="${item.productId}">
    <div class="line-item__body">
      <p class="line-item__name">${item.productName}</p>
      <p class="line-item__meta mono">${item.productSku} · ${fmtMoney(item.unitPrice)} × ${item.quantity}</p>
    </div>
    ${raw(
      editable
        ? html`
            <div class="stepper">
              <button type="button" data-qty="down" aria-label="Reducir cantidad"
                      ${item.quantity <= 1 ? "disabled" : ""}>${raw(icon("minus", { size: 13 }))}</button>
              <span class="stepper__value">${item.quantity}</span>
              <button type="button" data-qty="up" aria-label="Aumentar cantidad">${raw(icon("plus", { size: 13 }))}</button>
            </div>
            <button class="btn btn--ghost btn--icon btn--sm" type="button" data-remove
                    aria-label="Quitar ${item.productName}">${raw(icon("trash", { size: 14 }))}</button>
          `
        : ""
    )}
    <span class="line-item__total">${fmtMoney(item.totalPrice)}</span>
  </li>
`;

const body = (order) => {
  const editable = order.isEditable;

  const transitions = order.nextStates
    .map((state) => TRANSITION_ACTIONS[state])
    .filter(Boolean)
    .map(
      (action) => html`
        <button class="btn ${action.variant ? `btn--${action.variant}` : ""}" type="button"
                data-transition="${action.endpoint}">
          ${raw(icon(action.icon, { size: 15 }))} ${action.label}
        </button>
      `
    )
    .join("");

  return html`
    <section class="stack">
      <div class="row row--between">
        <span class="badge" data-status="${order.status}">${statusLabel(order.status)}</span>
        <span class="mono" style="color:var(--text-muted);font-size:var(--text-xs)">${order.reference}</span>
      </div>

      <div class="card" style="padding:var(--space-4)">
        <p class="card__hint" style="margin-bottom:var(--space-3)">Ciclo de vida</p>
        ${raw(lifecycle(order))}
      </div>
    </section>

    <section class="stack">
      <div class="row row--between">
        <h3 class="card__title">Líneas del pedido</h3>
        <span class="tag">${fmtNumber(order.totalUnits)} unidades</span>
      </div>

      ${raw(
        order.items.length === 0
          ? html`
              <div class="empty" style="padding:var(--space-6) var(--space-4)">
                <span class="empty__icon">${raw(icon("cart", { size: 22 }))}</span>
                <p class="empty__title">Cesta vacía</p>
                <p class="empty__text">Añade productos desde el catálogo para poder cobrar el pedido.</p>
              </div>
            `
          : html`<ul style="list-style:none;padding:0;display:flex;flex-direction:column;gap:var(--space-2)">
              ${raw(order.items.map((item) => itemRow(item, editable)).join(""))}
            </ul>`
      )}

      <div class="totals">
        <div class="totals__row"><span>Líneas</span><span>${order.items.length}</span></div>
        <div class="totals__row"><span>Unidades</span><span>${fmtNumber(order.totalUnits)}</span></div>
        <div class="totals__row totals__row--grand"><span>Total</span><span>${fmtMoney(order.totalAmount)}</span></div>
      </div>
    </section>

    <section class="stack">
      <h3 class="card__title">Cliente</h3>
      <div class="card" style="padding:var(--space-4)">
        <p style="font-weight:600;font-size:var(--text-sm)">${order.customerName ?? "—"}</p>
        <p class="card__hint">${order.customerEmail ?? "Sin email registrado"}</p>
      </div>
    </section>

    ${raw(
      transitions
        ? html`<section class="stack">
            <h3 class="card__title">Acciones disponibles</h3>
            <p class="card__hint">Los botones salen de <code class="mono">nextStates</code>, que publica el
              propio dominio: si una transición no está permitida, aquí no aparece.</p>
            <div class="row">${raw(transitions)}</div>
          </section>`
        : html`<p class="card__hint">Este pedido está en un estado final y no admite más transiciones.</p>`
    )}
  `;
};

/**
 * Abre el panel de un pedido.
 * @param {string} orderId
 * @param {{onChange?: (order:any)=>void}} options callback tras cada mutación
 */
export const openOrderPanel = async (orderId, { onChange } = {}) => {
  let order;

  try {
    order = await api.orders.get(orderId);
  } catch (error) {
    toastError(error, "No se pudo abrir el pedido");
    // Un pedido activo que ya no existe (base efímera reiniciada) deja de estarlo.
    if (error.status === 404 && getState().activeOrderId === orderId) clearActiveOrder();
    return;
  }

  const drawer = openDrawer({
    title: `Pedido ${order.reference}`,
    subtitle: fmtDateTime(order.createdAt),
    body: body(order)
  });

  const refresh = (updated) => {
    order = updated;
    $(".panel__body", drawer.panel).innerHTML = body(order);

    if (getState().activeOrderId === order.id) {
      // Un pedido ya cobrado no admite más líneas: deja de ser la cesta de trabajo,
      // así el catálogo abrirá uno nuevo en lugar de fallar con un 409.
      if (order.isEditable) setActiveOrder(order);
      else clearActiveOrder();
    }

    onChange?.(order);
  };

  const mutate = async (button, action, successMessage) => {
    try {
      const updated = await withBusy(button, action);
      refresh(updated);
      if (successMessage) toastSuccess(successMessage);
    } catch (error) {
      toastError(error);
    }
  };

  delegate(drawer.panel, "click", "[data-transition]", (event, button) => {
    const endpoint = button.dataset.transition;

    const run = () =>
      mutate(button, () => api.orders.transition(order.id, endpoint),
        endpoint === "cancel"
          ? "Pedido cancelado y stock repuesto en el catálogo"
          : "Transición aplicada");

    if (endpoint !== "cancel") return run();

    confirmAction({
      title: "Cancelar el pedido",
      message: "Se devolverán al catálogo todas las unidades reservadas. Esta acción no se puede deshacer.",
      confirmLabel: "Cancelar pedido",
      cancelLabel: "Volver",
      danger: true
    }).then((confirmed) => confirmed && run());
  });

  delegate(drawer.panel, "click", "[data-qty]", (event, button) => {
    const productId = button.closest("[data-product]").dataset.product;
    const item = order.items.find((line) => line.productId === productId);
    if (!item) return;

    const quantity = item.quantity + (button.dataset.qty === "up" ? 1 : -1);
    if (quantity < 1) return;

    mutate(button, () => api.orders.changeQuantity(order.id, productId, quantity));
  });

  delegate(drawer.panel, "click", "[data-remove]", (event, button) => {
    const productId = button.closest("[data-product]").dataset.product;
    mutate(button, () => api.orders.removeItem(order.id, productId), "Línea eliminada y stock repuesto");
  });

  return drawer;
};

/**
 * Añade un producto al pedido activo, creándolo si aún no existe.
 * Devuelve el pedido actualizado o null si la operación no se pudo completar.
 */
export const addProductToActiveOrder = async (product, quantity = 1) => {
  const { activeOrderId, customers } = getState();

  let orderId = activeOrderId;

  if (!orderId) {
    const customer = customers[0];
    if (!customer) {
      toast({ title: "No hay clientes", text: "Crea un cliente antes de abrir un pedido.", variant: "warning" });
      return null;
    }

    const created = await api.orders.create(customer.id);
    orderId = created.id;
    setActiveOrder(created);
  }

  try {
    const updated = await api.orders.addItem(orderId, product.id, quantity);
    setActiveOrder(updated);
    return updated;
  } catch (error) {
    // El pedido activo pudo cobrarse o desaparecer entre dos interacciones.
    if (error.status === 404) clearActiveOrder();
    throw error;
  }
};
