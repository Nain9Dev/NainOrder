/**
 * Utilidades de DOM: plantillas seguras, delegación de eventos e iconografía.
 * Se evita a propósito cualquier framework: la aplicación se sirve tal cual,
 * sin proceso de compilación ni dependencias externas.
 */

const RAW = Symbol("raw");

/** Marca una cadena como HTML ya confiable para que `html` no la escape. */
export const raw = (value) => ({ [RAW]: String(value ?? "") });

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const interpolate = (value) => {
  if (value === null || value === undefined || value === false) return "";
  if (Array.isArray(value)) return value.map(interpolate).join("");
  if (typeof value === "object" && RAW in value) return value[RAW];
  return escapeHtml(value);
};

/**
 * Plantilla que escapa por defecto todo lo interpolado.
 * Todo dato procedente de la API pasa por aquí, así que no puede inyectar marcado.
 */
export const html = (strings, ...values) =>
  strings.reduce((out, chunk, i) => out + chunk + interpolate(values[i]), "");

export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/**
 * Pinta una vista dentro del contenedor y devuelve su raíz.
 *
 * Cada repintado crea un nodo raíz nuevo y descarta el anterior: los manejadores
 * delegados se registran sobre esa raíz, así que desaparecen con ella y no se
 * acumulan al volver a pintar.
 */
export const render = (outlet, markup) => {
  const root = document.createElement("div");
  root.className = "stack";
  root.innerHTML = markup;
  outlet.replaceChildren(root);
  return root;
};

/** Delegación de eventos: sobrevive a los repintados completos de una vista. */
export const delegate = (root, type, selector, handler) => {
  root.addEventListener(type, (event) => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  });
};

/** Devuelve un tono estable a partir de un texto, para colorear sin guardar el color. */
export const hueFrom = (text) => {
  let hash = 0;
  for (const char of String(text)) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
};

/** Iniciales para el distintivo visual de un producto. */
export const initials = (text) =>
  String(text)
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

const ICON_PATHS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  catalog: '<path d="m3.3 7 8.7 4.6L20.7 7"/><path d="M12 11.6V21"/><path d="M20.5 7.3v9.4a1 1 0 0 1-.5.9l-7.5 4a1 1 0 0 1-1 0l-7.5-4a1 1 0 0 1-.5-.9V7.3a1 1 0 0 1 .5-.9l7.5-4a1 1 0 0 1 1 0l7.5 4a1 1 0 0 1 .5.9Z"/>',
  orders: '<path d="M8 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>',
  architecture: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="m4 12.5 5 5L20 6.5"/>',
  alert: '<path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  play: '<path d="M7 4.5v15l13-7.5-13-7.5Z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-1.7 6"/><path d="M20 5v6h-6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M9 7V4h6v3"/>',
  euro: '<path d="M17 5.5A6.5 6.5 0 0 0 7.2 9M17 18.5A6.5 6.5 0 0 1 7.2 15"/><path d="M4 10.5h9M4 13.5h9"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18 20a6.4 6.4 0 0 0-2-4.6"/>',
  boxes: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  trending: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  command: '<path d="M6 3a3 3 0 1 1-3 3h12a3 3 0 1 1 3-3v12a3 3 0 1 1-3 3H6a3 3 0 1 1-3-3Z"/>',
  chevronLeft: '<path d="m14 6-6 6 6 6"/>',
  chevronRight: '<path d="m10 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.2l2.4 12.2a1.5 1.5 0 0 0 1.5 1.2h8.8a1.5 1.5 0 0 0 1.5-1.2L21 7H6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.4 2"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/>',
  truck: '<path d="M2.5 7.5h11v9h-11z"/><path d="M13.5 11h4l3 3v2.5h-7z"/><circle cx="7" cy="18.5" r="1.6"/><circle cx="17" cy="18.5" r="1.6"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 4.4V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.4Z"/>',
  external: '<path d="M13 5h6v6"/><path d="M19 5 10 14"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5Z"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M12 8.5 13.4 11 16 12l-2.6 1-1.4 2.5L10.6 13 8 12l2.6-1Z"/>',
  layers: '<path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z"/><path d="m4 12 8 4.5 8-4.5"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>'
};

/**
 * Devuelve el marcado de un icono. Todos comparten trazo y rejilla de 24px para
 * que la iconografía se lea como un único conjunto.
 */
export const icon = (name, { size = 20 } = {}) => {
  const path = ICON_PATHS[name];
  if (!path) return "";

  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
};

/** Anima un valor numérico desde cero, para que las métricas "aterricen". */
export const countUp = (node, target, { duration = 900, format = (v) => v } = {}) => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    node.textContent = format(target);
    return;
  }

  const start = performance.now();
  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    // Curva de salida: rápido al principio, asentamiento suave al final.
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = format(target * eased);
    if (progress < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
};
