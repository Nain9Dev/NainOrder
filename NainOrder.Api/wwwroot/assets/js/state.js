/**
 * Estado compartido mínimo con suscripción. Solo guarda lo que varias vistas
 * necesitan a la vez; el resto de datos se piden a la API cuando hacen falta.
 */

const STORAGE_KEY = "nainorder.state";

const listeners = new Set();

const persisted = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
})();

const state = {
  /** Pedido sobre el que trabaja el usuario; el catálogo añade líneas a este. */
  activeOrder: null,
  activeOrderId: persisted.activeOrderId ?? null,
  customers: [],
  theme: persisted.theme ?? null,
  apiHealthy: true
};

const persist = () => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ activeOrderId: state.activeOrderId, theme: state.theme })
    );
  } catch {
    // El almacenamiento puede estar bloqueado (modo privado): no es un fallo crítico.
  }
};

export const getState = () => state;

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setState = (patch) => {
  Object.assign(state, patch);

  if ("activeOrderId" in patch || "theme" in patch) persist();

  listeners.forEach((listener) => listener(state));
};

/** Fija el pedido activo a partir del DTO completo devuelto por la API. */
export const setActiveOrder = (order) =>
  setState({ activeOrder: order, activeOrderId: order?.id ?? null });

export const clearActiveOrder = () => setState({ activeOrder: null, activeOrderId: null });
