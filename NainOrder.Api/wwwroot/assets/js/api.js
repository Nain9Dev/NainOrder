/**
 * Cliente HTTP de la API y motor de dominio interactivo para demo autónoma.
 *
 * Además de hablar con el backend, publica cada llamada en un bus de trazas: la vista
 * de arquitectura las muestra en vivo, de modo que el recorrido de una petición por
 * las capas deja de ser una afirmación del README y pasa a verse en pantalla.
 *
 * En entornos estáticos (GitHub Pages o servidor sin API .NET en ejecución), conmuta
 * de forma transparente al motor de dominio en memoria (mock-backend.js), preservando
 * todas las reglas de Clean Architecture y la persistencia en el navegador.
 */

import { mockDispatch, mockDb } from "./mock-backend.js";

const BASE = "/api";

/** Determina si estamos en un entorno estático sin backend .NET. */
let isStaticHost =
  typeof window !== "undefined" &&
  (window.location.hostname.endsWith("github.io") ||
   window.location.hostname.endsWith("naindev.com") ||
   window.location.protocol === "file:" ||
   Boolean(window.__NAINORDER_FORCE_MOCK__));

export const isDemoMode = () => isStaticHost;

export const resetDemoDatabase = () => {
  mockDb.reset();
};

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

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("nain:telemetry", {
      detail: {
        type: entry.method === "GET" ? "Query" : "Command",
        name: `${entry.method} ${entry.path}`,
        latencyMs: Math.round(entry.ms),
        status: entry.status,
        payload: { path: entry.path, ok: entry.ok, latencyMs: Math.round(entry.ms), runtime: isStaticHost ? "InMemoryDomainEngine" : "DotNet10CleanArch" }
      }
    }));
  }
};

const buildUrl = (path, query) => {
  const url = new URL(`${BASE}${path}`, window.location.origin);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    url.searchParams.set(key, value);
  });

  return url;
};

/**
 * Anonymous visitor identity for drops (Q-005): a random token kept in this browser, sent as
 * `X-Buyer-Token`. It identifies a visitor, never a person.
 */
export const buyerToken = () => {
  try {
    let token = localStorage.getItem("nainorder.buyer");
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem("nainorder.buyer", token);
    }
    return token;
  } catch {
    // Storage blocked: a per-page token still lets this visit work.
    return (buyerToken.fallback ??= crypto.randomUUID());
  }
};

async function request(method, path, { body, query, signal, headers } = {}) {
  const startedAt = performance.now();

  if (isStaticHost) {
    try {
      const result = await mockDispatch(method, path, { body, query, headers });
      const elapsedMs = performance.now() - startedAt;
      const queryStr = query && Object.keys(query).length > 0 ? `?${new URLSearchParams(query).toString()}` : "";
      publishTrace({
        method,
        path: `${BASE}${path}${queryStr}`,
        status: 200,
        ms: elapsedMs,
        ok: true
      });
      return result;
    } catch (err) {
      const elapsedMs = performance.now() - startedAt;
      const status = err.status || 400;
      const queryStr = query && Object.keys(query).length > 0 ? `?${new URLSearchParams(query).toString()}` : "";
      publishTrace({
        method,
        path: `${BASE}${path}${queryStr}`,
        status,
        ms: elapsedMs,
        ok: false
      });
      throw new ApiError(status, err);
    }
  }

  const url = buildUrl(path, query);

  let response;
  try {
    response = await fetch(url, {
      method,
      signal,
      headers: body || headers ? { ...(body ? { "Content-Type": "application/json" } : {}), ...headers } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (networkError) {
    // The device itself has no network (an installed app opened offline): answer honestly. Falling
    // back to the in-browser engine here would show invented units to someone about to buy.
    if (navigator.onLine === false) throw new ApiError(0, { title: "Offline", code: "offline" });

    // Backend unreachable but the device is online: switch gracefully to the in-browser engine.
    isStaticHost = true;
    return request(method, path, { body, query, signal, headers });
  }

  // A 404 with a problem+json body is the API answering about a missing resource; only a 404
  // without it means there is no API behind this host (static hosting), so fall back then.
  if (response.status === 404 && !response.headers.get("content-type")?.includes("problem+json")) {
    isStaticHost = true;
    return request(method, path, { body, query, signal, headers });
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

  drops: {
    list: () => request("GET", "/drops"),
    get: (id) => request("GET", `/drops/${id}`, { headers: { "X-Buyer-Token": buyerToken() } }),
    create: (body) => request("POST", "/drops", { body }),
    take: (id, quantity) =>
      request("POST", `/drops/${id}/holds`, { body: { quantity }, headers: { "X-Buyer-Token": buyerToken() } }),
    confirm: (id, holdId) =>
      request("POST", `/drops/${id}/holds/${holdId}/confirm`, { headers: { "X-Buyer-Token": buyerToken() } }),
    /** Takes as another visitor; used by the crowd simulator. */
    takeAs: (id, token, quantity) =>
      request("POST", `/drops/${id}/holds`, { body: { quantity }, headers: { "X-Buyer-Token": token } })
  },

  demo: {
    simulate: () => request("POST", "/demo/simulate-purchase"),
    stockRace: (buyers, units) => request("POST", "/demo/stock-race", { body: { buyers, units } })
  }
};
