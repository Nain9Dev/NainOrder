/**
 * Cliente HTTP de la API.
 *
 * Además de hablar con el backend, publica cada llamada en un bus de trazas: la vista
 * de arquitectura las muestra en vivo, de modo que el recorrido de una petición por
 * las capas deja de ser una afirmación del README y pasa a verse en pantalla.
 */

const BASE = "/api";

/** Error de negocio devuelto por la API en formato RFC 7807. */
export class ApiError extends Error {
  constructor(status, problem) {
    super(problem?.detail || problem?.title || `Error HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = problem?.code ?? "unknown";
    this.problem = problem ?? {};
  }

  /** Errores de validación del modelo: { campo: [mensajes] }. */
  get validationErrors() {
    return this.problem.errors ?? null;
  }
}

const listeners = new Set();

/** Suscribe un observador a la traza de peticiones. Devuelve la función de baja. */
export const onTrace = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const traceLog = [];
export const traceHistory = () => [...traceLog];

const publishTrace = (entry) => {
  traceLog.push(entry);
  if (traceLog.length > 100) traceLog.shift();
  listeners.forEach((listener) => listener(entry));
};

const buildUrl = (path, query) => {
  const url = new URL(`${BASE}${path}`, window.location.origin);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    url.searchParams.set(key, value);
  });

  return url;
};

async function request(method, path, { body, query, signal } = {}) {
  const url = buildUrl(path, query);
  const startedAt = performance.now();

  let response;
  try {
    response = await fetch(url, {
      method,
      signal,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (networkError) {
    publishTrace({ method, path: url.pathname + url.search, status: 0, ms: performance.now() - startedAt, ok: false });
    throw new ApiError(0, { detail: "No hay conexión con el servidor.", code: "network_error" });
  }

  const elapsedMs = performance.now() - startedAt;
  publishTrace({
    method,
    path: url.pathname + url.search,
    status: response.status,
    ms: elapsedMs,
    ok: response.ok
  });

  if (response.status === 204) return null;

  const payload = response.headers.get("content-type")?.includes("json")
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) throw new ApiError(response.status, payload);

  return payload;
}

export const api = {
  products: {
    list: (query) => request("GET", "/products", { query }),
    get: (id) => request("GET", `/products/${id}`),
    categories: () => request("GET", "/products/categories"),
    create: (body) => request("POST", "/products", { body }),
    update: (id, body) => request("PUT", `/products/${id}`, { body }),
    adjustStock: (id, delta) => request("POST", `/products/${id}/stock`, { body: { delta } })
  },

  orders: {
    list: (query) => request("GET", "/orders", { query }),
    get: (id) => request("GET", `/orders/${id}`),
    create: (customerId) => request("POST", "/orders", { body: { customerId } }),
    addItem: (id, productId, quantity) =>
      request("POST", `/orders/${id}/items`, { body: { productId, quantity } }),
    changeQuantity: (id, productId, quantity) =>
      request("PUT", `/orders/${id}/items/${productId}`, { body: { quantity } }),
    removeItem: (id, productId) => request("DELETE", `/orders/${id}/items/${productId}`),
    transition: (id, action) => request("POST", `/orders/${id}/${action}`)
  },

  customers: {
    list: () => request("GET", "/customers"),
    create: (body) => request("POST", "/customers", { body })
  },

  dashboard: {
    stats: () => request("GET", "/dashboard/stats")
  },

  meta: {
    stateMachine: () => request("GET", "/meta/order-state-machine")
  },

  demo: {
    simulate: () => request("POST", "/demo/simulate-purchase")
  }
};
