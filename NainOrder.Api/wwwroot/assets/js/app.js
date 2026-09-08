/** Arranque de la aplicación: shell, navegación, tema, paleta de comandos y estado global. */

import { html, icon, raw, $, delegate } from "./dom.js";
import { api } from "./api.js";
import { defineRoute, onRouteChange, startRouter, navigate, currentPath } from "./router.js";
import { getState, setState, subscribe, setActiveOrder, clearActiveOrder } from "./state.js";
import { openOrderPanel } from "./order-panel.js";
import { toast } from "./toast.js";
import { fmtMoney } from "./format.js";

import { dashboardView } from "./views/dashboard.js";
import { catalogView } from "./views/catalog.js";
import { ordersView } from "./views/orders.js";
import { architectureView } from "./views/architecture.js";

const NAV = [
  { path: "/panel", label: "Panel", icon: "dashboard", view: dashboardView },
  { path: "/catalogo", label: "Catálogo", icon: "catalog", view: catalogView },
  { path: "/pedidos", label: "Pedidos", icon: "orders", view: ordersView },
  { path: "/arquitectura", label: "Arquitectura", icon: "architecture", view: architectureView }
];

/* --------------------------------------------------------------------------
   Tema
   -------------------------------------------------------------------------- */
const systemPrefersLight = () => window.matchMedia("(prefers-color-scheme: light)").matches;

const applyTheme = (theme) => {
  const resolved = theme ?? (systemPrefersLight() ? "light" : "dark");
  document.documentElement.dataset.theme = resolved;

  const button = $("[data-action='theme']");
  if (!button) return;

  button.innerHTML = icon(resolved === "dark" ? "sun" : "moon", { size: 16 });
  button.setAttribute("aria-label", resolved === "dark" ? "Activar tema claro" : "Activar tema oscuro");
};

/* --------------------------------------------------------------------------
   Shell
   -------------------------------------------------------------------------- */
const shell = () => html`
  <a class="skip-link" href="#main-content">Saltar al contenido</a>

  <div class="app" data-nav-open="false">
    <div class="nav-scrim" data-action="close-nav" aria-hidden="true"></div>

    <aside class="sidebar">
      <a class="brand" href="#/panel">
        <span class="brand__mark">${raw(icon("layers", { size: 21 }))}</span>
        <span>
          <span class="brand__name">NainOrder</span>
          <span class="brand__tag">Motor de pedidos</span>
        </span>
      </a>

      <nav class="nav" aria-label="Secciones">
        <p class="nav__label">Operación</p>
        ${raw(
          NAV.map(
            (item) => html`
              <a class="nav__item" href="#${item.path}" data-nav="${item.path}">
                ${raw(icon(item.icon, { size: 18 }))} ${item.label}
              </a>
            `
          ).join("")
        )}
      </nav>

      <div class="sidebar__footer">
        <button class="btn btn--ghost btn--block" type="button" data-action="palette"
                style="justify-content:space-between">
          <span style="display:inline-flex;align-items:center;gap:var(--space-2)">
            ${raw(icon("search", { size: 15 }))} Buscar acción
          </span>
          <span class="kbd">Ctrl K</span>
        </button>

        <div class="sidebar__status" data-health>
          <span class="pulse-dot"></span> API operativa
        </div>

        <p class="sidebar__credit">
          Desarrollado por <a href="https://www.naindev.com/" target="_blank" rel="noopener">Aitor Nain</a>
        </p>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <button class="btn btn--ghost btn--icon topbar__menu" type="button" data-action="toggle-nav"
                aria-label="Abrir navegación">${raw(icon("menu", { size: 18 }))}</button>

        <div class="topbar__titles">
          <p class="topbar__title" data-topbar-title>Panel de control</p>
          <p class="topbar__subtitle" data-topbar-subtitle></p>
        </div>

        <div class="topbar__actions">
          <button class="btn btn--sm" type="button" data-active-order hidden></button>
          <button class="btn btn--ghost btn--icon" type="button" data-action="palette"
                  aria-label="Abrir paleta de comandos">${raw(icon("command", { size: 16 }))}</button>
          <button class="btn btn--ghost btn--icon" type="button" data-action="theme"
                  aria-label="Cambiar tema"></button>
        </div>
      </header>

      <main class="content" id="main-content" tabindex="-1"></main>
    </div>
  </div>
`;

/* --------------------------------------------------------------------------
   Indicador del pedido activo
   -------------------------------------------------------------------------- */
const renderActiveOrder = () => {
  const button = $("[data-active-order]");
  const { activeOrder } = getState();

  if (!activeOrder) {
    button.hidden = true;
    return;
  }

  button.hidden = false;
  button.innerHTML = html`
    ${raw(icon("cart", { size: 14 }))}
    <span class="mono">${activeOrder.reference}</span>
    <span class="numeric">${fmtMoney(activeOrder.totalAmount)}</span>
  `;
  button.setAttribute("aria-label", `Abrir pedido activo ${activeOrder.reference}`);
};

/* --------------------------------------------------------------------------
   Paleta de comandos
   -------------------------------------------------------------------------- */
const commands = () => [
  ...NAV.map((item) => ({
    label: `Ir a ${item.label}`,
    icon: item.icon,
    hint: item.path,
    run: () => navigate(item.path)
  })),
  {
    label: "Ejecutar escenario guiado",
    icon: "play",
    hint: "Flujo completo de compra",
    run: async () => {
      navigate("/panel");
      toast({ title: "Ejecutando escenario…", text: "Se está recorriendo el flujo completo.", variant: "info" });
      try {
        await api.demo.simulate();
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } catch {
        toast({ title: "El escenario falló", variant: "error" });
      }
    }
  },
  {
    label: "Abrir documentación Swagger",
    icon: "book",
    hint: "/swagger",
    run: () => window.open("/swagger", "_blank", "noopener")
  },
  {
    label: "Cambiar tema",
    icon: "sun",
    hint: "Claro / oscuro",
    run: () => toggleTheme()
  },
  ...(getState().activeOrder
    ? [{
        label: `Abrir pedido activo ${getState().activeOrder.reference}`,
        icon: "cart",
        hint: "Detalle y transiciones",
        run: () => openOrderPanel(getState().activeOrderId)
      }]
    : [])
];

let paletteOpen = false;

const openPalette = () => {
  if (paletteOpen) return;
  paletteOpen = true;

  const all = commands();

  const overlay = document.createElement("div");
  overlay.className = "overlay overlay--palette";
  overlay.innerHTML = html`
    <div class="palette" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
      <input class="palette__input" type="text" placeholder="Escribe una acción…"
             aria-label="Buscar acción" autocomplete="off">
      <div class="palette__list" role="listbox"></div>
    </div>
  `;

  const input = $(".palette__input", overlay);
  const list = $(".palette__list", overlay);
  let matches = all;
  let cursor = 0;

  const paint = () => {
    list.innerHTML = matches.length
      ? matches
          .map(
            (command, index) => html`
              <button class="palette__item" type="button" role="option" data-index="${index}"
                      data-active="${index === cursor}" aria-selected="${index === cursor}">
                ${raw(icon(command.icon, { size: 16 }))} ${command.label}
                <small>${command.hint}</small>
              </button>
            `
          )
          .join("")
      : html`<p class="palette__item" style="color:var(--text-muted)">Sin coincidencias</p>`;
  };

  const close = () => {
    paletteOpen = false;
    document.removeEventListener("keydown", onKey, true);
    overlay.remove();
  };

  const run = (index) => {
    const command = matches[index];
    if (!command) return;
    close();
    command.run();
  };

  function onKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      cursor = (cursor + delta + matches.length) % Math.max(matches.length, 1);
      paint();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      run(cursor);
    }
  }

  input.addEventListener("input", () => {
    const term = input.value.trim().toLowerCase();
    matches = all.filter((command) => command.label.toLowerCase().includes(term));
    cursor = 0;
    paint();
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) return close();
    const item = event.target.closest("[data-index]");
    if (item) run(Number(item.dataset.index));
  });

  document.addEventListener("keydown", onKey, true);
  document.body.append(overlay);
  paint();
  input.focus();
};

const toggleTheme = () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setState({ theme: next });
  applyTheme(next);
};

/* --------------------------------------------------------------------------
   Salud del servicio
   -------------------------------------------------------------------------- */
const monitorHealth = () => {
  const node = $("[data-health]");

  const check = async () => {
    let healthy = true;
    try {
      const response = await fetch("/health", { cache: "no-store" });
      healthy = response.ok;
    } catch {
      healthy = false;
    }

    if (healthy === getState().apiHealthy && node.dataset.painted) return;

    setState({ apiHealthy: healthy });
    node.dataset.painted = "true";
    node.innerHTML = html`
      <span class="pulse-dot ${healthy ? "" : "pulse-dot--down"}"></span>
      ${healthy ? "API operativa" : "API no disponible"}
    `;
  };

  check();
  // Un sondeo espaciado basta para un panel: no conviene añadir ruido a la traza.
  setInterval(check, 30_000);
};

/* --------------------------------------------------------------------------
   Arranque
   -------------------------------------------------------------------------- */
const boot = async () => {
  document.body.innerHTML = shell();
  applyTheme(getState().theme);

  const outlet = $("#main-content");
  const app = $(".app");

  NAV.forEach((item) => defineRoute(item.path, item.view));

  onRouteChange((path, view) => {
    $("[data-topbar-title]").textContent = view.title;
    $("[data-topbar-subtitle]").textContent = view.subtitle ?? "";
    document.title = `${view.title} · NainOrder`;

    document.querySelectorAll("[data-nav]").forEach((link) => {
      if (link.dataset.nav === path) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    app.dataset.navOpen = "false";
  });

  delegate(document.body, "click", '[data-action="theme"]', toggleTheme);
  delegate(document.body, "click", '[data-action="palette"]', openPalette);
  delegate(document.body, "click", '[data-action="toggle-nav"]', () => {
    app.dataset.navOpen = app.dataset.navOpen === "true" ? "false" : "true";
  });
  delegate(document.body, "click", '[data-action="close-nav"]', () => {
    app.dataset.navOpen = "false";
  });

  delegate(document.body, "click", "[data-active-order]", () => {
    const { activeOrderId } = getState();
    if (activeOrderId) openOrderPanel(activeOrderId, { onChange: () => rerender() });
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openPalette();
    }
  });

  subscribe(renderActiveOrder);
  renderActiveOrder();
  monitorHealth();

  const rerender = startRouter(outlet);

  // Los clientes se cargan una vez: el catálogo los necesita para abrir un pedido.
  try {
    setState({ customers: await api.customers.list() });
  } catch {
    // Sin clientes la interfaz sigue siendo navegable; el aviso llega al intentar operar.
  }

  // El pedido activo guardado puede haber desaparecido —base efímera reiniciada— o
  // haberse cobrado; en ambos casos deja de servir como cesta de trabajo.
  const { activeOrderId } = getState();
  if (activeOrderId) {
    try {
      const order = await api.orders.get(activeOrderId);
      if (order.isEditable) setActiveOrder(order);
      else clearActiveOrder();
    } catch {
      clearActiveOrder();
    }
  }
};

boot();

// Superficie mínima para navegar por consola o desde un enlace profundo externo.
window.NainOrder = { navigate, currentPath };
