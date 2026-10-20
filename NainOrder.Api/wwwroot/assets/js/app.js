/** Application start-up: shell, navigation, theme, language, command palette and global state. */

import { html, icon, raw, $, delegate } from "./dom.js";
import { api, isDemoMode, resetDemoDatabase, onTrace } from "./api.js";
import { defineRoute, onRouteChange, startRouter, navigate, currentPath } from "./router.js";
import { getState, setState, subscribe, setActiveOrder, clearActiveOrder } from "./state.js";
import { openOrderPanel } from "./order-panel.js";
import { toast } from "./toast.js";
import { fmtMoney } from "./format.js";
import { applyStatic, getLocale, loadI18n, locales, setLocale, t } from "./i18n.js";

import { dashboardView } from "./views/dashboard.js";
import { catalogView } from "./views/catalog.js";
import { ordersView } from "./views/orders.js";
import { architectureView } from "./views/architecture.js";
import { raceView } from "./views/race.js";
import { dropView } from "./views/drop.js";

const NAV = [
  { path: "/drop", labelKey: "nav.drop", icon: "ticket", view: dropView },
  { path: "/panel", labelKey: "nav.panel", icon: "dashboard", view: dashboardView },
  { path: "/catalogo", labelKey: "nav.catalog", icon: "catalog", view: catalogView },
  { path: "/pedidos", labelKey: "nav.orders", icon: "orders", view: ordersView },
  { path: "/carrera", labelKey: "nav.race", icon: "race", view: raceView },
  { path: "/arquitectura", labelKey: "nav.arch", icon: "architecture", view: architectureView }
];

/* --------------------------------------------------------------------------
   Theme
   -------------------------------------------------------------------------- */
const systemPrefersLight = () => window.matchMedia("(prefers-color-scheme: light)").matches;

const applyTheme = (theme) => {
  const resolved = theme ?? (systemPrefersLight() ? "light" : "dark");
  document.documentElement.dataset.theme = resolved;

  const button = $("[data-action='theme']");
  if (!button) return;

  button.innerHTML = icon(resolved === "dark" ? "sun" : "moon", { size: 16 });
  button.setAttribute("aria-label", t(resolved === "dark" ? "shell.theme.toLight" : "shell.theme.toDark"));
};

/* --------------------------------------------------------------------------
   Demo-mode notice

   On a static host there is no .NET API behind the panel: it talks to the in-browser domain
   engine. Saying so visibly is part of the demo's contract — whoever evaluates it must know
   what is running before drawing conclusions about the backend.
   -------------------------------------------------------------------------- */
const demoBanner = () => html`
  <div class="demo-banner" data-demo-banner hidden>
    <span class="demo-banner__mark">${raw(icon("info", { size: 15 }))}</span>
    <p class="demo-banner__text">
      <strong data-i18n="banner.title"></strong> <span data-i18n="banner.text"></span>
      <code class="mono">docker run</code>.
    </p>
    <a class="btn btn--sm" href="https://github.com/Nain9Dev/NainOrder#quick-start"
       target="_blank" rel="noopener">
      <span data-i18n="banner.cta"></span> ${raw(icon("external", { size: 12 }))}
    </a>
  </div>
`;

/* --------------------------------------------------------------------------
   Shell
   -------------------------------------------------------------------------- */
const languageSwitch = () => html`
  <div class="lang" role="group" data-i18n-attr="aria-label:shell.language">
    ${raw(
      locales()
        .map(
          (code) => html`<button class="lang__btn" type="button" data-lang="${code}"
                                 aria-pressed="${code === getLocale()}">${code.toUpperCase()}</button>`
        )
        .join("")
    )}
  </div>
`;

const shell = () => html`
  <nain-ecosystem-bar current-project="NainOrder"></nain-ecosystem-bar>
  <a class="skip-link" href="#main-content" data-i18n="shell.skip"></a>

  <div class="app" data-nav-open="false">
    <div class="nav-scrim" data-action="close-nav" aria-hidden="true"></div>

    <aside class="sidebar">
      <a class="brand" href="#/drop">
        <span class="brand__mark">${raw(icon("layers", { size: 21 }))}</span>
        <span>
          <span class="brand__name">NainOrder</span>
          <span class="brand__tag" data-i18n="app.tagline"></span>
        </span>
      </a>

      <nav class="nav" data-i18n-attr="aria-label:nav.label">
        <p class="nav__label" data-i18n="nav.section"></p>
        ${raw(
          NAV.map(
            (item) => html`
              <a class="nav__item" href="#${item.path}" data-nav="${item.path}">
                ${raw(icon(item.icon, { size: 18 }))} <span data-i18n="${item.labelKey}"></span>
              </a>
            `
          ).join("")
        )}
      </nav>

      <div class="sidebar__footer">
        <button class="btn btn--ghost btn--block" type="button" data-action="palette"
                style="justify-content:space-between">
          <span style="display:inline-flex;align-items:center;gap:var(--space-2)">
            ${raw(icon("search", { size: 15 }))} <span data-i18n="shell.search"></span>
          </span>
          <span class="kbd">Ctrl K</span>
        </button>

        <div class="sidebar__status" data-health></div>

        <p class="sidebar__credit">
          <span data-i18n="shell.credit"></span>
          <a href="https://www.naindev.com/" target="_blank" rel="noopener">Aitor Nain</a>
        </p>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <button class="btn btn--ghost btn--icon topbar__menu" type="button" data-action="toggle-nav"
                data-i18n-attr="aria-label:shell.menu">${raw(icon("menu", { size: 18 }))}</button>

        <div class="topbar__titles">
          <p class="topbar__title" data-topbar-title></p>
          <p class="topbar__subtitle" data-topbar-subtitle></p>
        </div>

        <div class="topbar__actions">
          <button class="btn btn--sm" type="button" data-active-order hidden></button>
          ${raw(languageSwitch())}
          <button class="btn btn--ghost btn--icon" type="button" data-action="palette"
                  data-i18n-attr="aria-label:shell.palette">${raw(icon("command", { size: 16 }))}</button>
          <button class="btn btn--ghost btn--icon" type="button" data-action="theme"
                  data-i18n-attr="aria-label:shell.theme"></button>
        </div>
      </header>

      ${raw(demoBanner())}

      <main class="content" id="main-content" tabindex="-1"></main>
    </div>
  </div>
`;

/* --------------------------------------------------------------------------
   Active-order indicator
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
  button.setAttribute("aria-label", t("shell.activeOrder", { reference: activeOrder.reference }));
};

/* --------------------------------------------------------------------------
   Command palette
   -------------------------------------------------------------------------- */
const commands = () => [
  ...NAV.map((item) => ({
    label: t("palette.goto", { name: t(item.labelKey) }),
    icon: item.icon,
    hint: item.path,
    run: () => navigate(item.path)
  })),
  {
    label: t("palette.scenario"),
    icon: "play",
    hint: t("palette.scenario.hint"),
    run: async () => {
      navigate("/panel");
      toast({ title: t("palette.scenario.running"), text: t("palette.scenario.runningText"), variant: "info" });
      try {
        await api.demo.simulate();
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } catch {
        toast({ title: t("palette.scenario.failed"), variant: "error" });
      }
    }
  },
  {
    label: t("palette.reset"),
    icon: "refresh",
    hint: t("palette.reset.hint"),
    run: () => {
      resetDemoDatabase();
      toast({ title: t("palette.reset.done"), text: t("palette.reset.doneText"), variant: "info" });
      setTimeout(() => window.location.reload(), 450);
    }
  },
  {
    label: isDemoMode() ? t("palette.docs.code") : t("palette.docs.swagger"),
    icon: "book",
    hint: isDemoMode() ? t("palette.docs.codeHint") : "/swagger",
    run: () => window.open(isDemoMode() ? "https://github.com/Nain9Dev/NainOrder" : "/swagger", "_blank", "noopener")
  },
  {
    label: t("palette.theme"),
    icon: "sun",
    hint: t("palette.theme.hint"),
    run: () => toggleTheme()
  },
  ...(getState().activeOrder
    ? [{
        label: t("palette.activeOrder", { reference: getState().activeOrder.reference }),
        icon: "cart",
        hint: t("palette.activeOrder.hint"),
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
    <div class="palette" role="dialog" aria-modal="true" aria-label="${t("palette.label")}">
      <input class="palette__input" type="text" placeholder="${t("palette.placeholder")}"
             aria-label="${t("shell.search")}" autocomplete="off">
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
      : html`<p class="palette__item" style="color:var(--text-muted)">${t("palette.empty")}</p>`;
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
   Service health
   -------------------------------------------------------------------------- */
let health = "ok";
const paintHealth = () => {
  const node = $("[data-health]");
  if (!node) return;

  const key = { ok: "shell.health.ok", down: "shell.health.down", browser: "shell.health.browser" }[health];
  node.innerHTML = html`<span class="pulse-dot ${health === "down" ? "pulse-dot--down" : ""}"></span> ${t(key)}`;
};

const monitorHealth = () => {
  const banner = $("[data-demo-banner]");

  // Demo mode can also kick in later, when a request fails and the client falls back to the
  // browser engine. The notice is re-evaluated on every check so it never depends on what was
  // known at first paint.
  const syncBanner = () => { banner.hidden = !isDemoMode(); };

  const check = async () => {
    syncBanner();

    if (isDemoMode()) {
      health = "browser";
      paintHealth();
      setState({ apiHealthy: true });
      return;
    }

    let healthy = true;
    try {
      const response = await fetch("/health", { cache: "no-store" });
      healthy = response.ok;
    } catch {
      healthy = false;
    }

    health = healthy ? "ok" : "down";
    paintHealth();
    setState({ apiHealthy: healthy });
  };

  check();
  // The switch to the browser engine happens inside a request, so the notice is re-evaluated
  // on every trace instead of waiting for the next poll.
  onTrace(syncBanner);
  // A sparse poll is enough for a panel: no point adding noise to the trace.
  setInterval(check, 30_000);
};

/* --------------------------------------------------------------------------
   Start-up
   -------------------------------------------------------------------------- */
const boot = async () => {
  await loadI18n();

  document.body.innerHTML = shell();
  applyTheme(getState().theme);
  applyStatic(document);

  const outlet = $("#main-content");
  const app = $(".app");
  let currentView = null;

  NAV.forEach((item) => defineRoute(item.path, item.view));

  const paintTitles = () => {
    if (!currentView) return;
    $("[data-topbar-title]").textContent = currentView.title;
    $("[data-topbar-subtitle]").textContent = currentView.subtitle ?? "";
    document.title = `${currentView.title} · NainOrder`;
  };

  onRouteChange((path, view) => {
    currentView = view;
    paintTitles();

    document.querySelectorAll("[data-nav]").forEach((link) => {
      if (link.dataset.nav === path) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    app.dataset.navOpen = "false";
  });

  delegate(document.body, "click", '[data-action="theme"]', toggleTheme);
  delegate(document.body, "click", '[data-action="palette"]', openPalette);
  delegate(document.body, "click", '[data-lang]', (event, button) => setLocale(button.dataset.lang));
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

  // A language switch repaints the shell's static text and re-renders the current view.
  window.addEventListener("nain:locale", () => {
    document.querySelectorAll("[data-lang]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.lang === getLocale()));
    });
    applyStatic(document);
    applyTheme(document.documentElement.dataset.theme);
    paintTitles();
    paintHealth();
    renderActiveOrder();
    rerender();
  });

  // Customers load once: the catalogue needs them to open an order.
  try {
    setState({ customers: await api.customers.list() });
  } catch {
    // Without customers the interface stays navigable; the warning arrives when trying to operate.
  }

  // The saved active order may have disappeared (ephemeral database reset) or been paid; in
  // both cases it no longer works as a working basket.
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

// Minimal surface to navigate from the console or from an external deep link.
window.NainOrder = { navigate, currentPath, isDemoMode, resetDemoDatabase };
