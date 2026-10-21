/**
 * Architecture view: shows the layers working instead of describing them. Every request the
 * panel makes travels across the request map, with the timings the server measured and, when
 * rejected, the layer the server named (REQ-112). The map draws nothing the server did not state;
 * the order of the layers is the dependency rule that CleanArchitectureTests enforces.
 */

import { html, icon, raw, render, $, delegate } from "../dom.js";
import { api, onTrace, traceHistory, isDemoMode } from "../api.js";
import { toastError } from "../toast.js";
import { fmtDuration, statusLabel } from "../format.js";
import { t } from "../i18n.js";

const LAYERS = [
  {
    key: "api",
    index: "01",
    name: "NainOrder.Api",
    color: "var(--status-shipped)",
    textKey: "arch.layer.api",
    items: ["DropsController", "GlobalExceptionHandler", "ServerTimingMiddleware", "wwwroot"],
    dependsOn: () => "→ Application, Infrastructure"
  },
  {
    key: "application",
    index: "02",
    name: "NainOrder.Application",
    color: "var(--brand-1)",
    textKey: "arch.layer.application",
    items: ["OrderService", "DropService", "IUnitOfWork", "IOrderRepository"],
    dependsOn: () => "→ Domain"
  },
  {
    key: "domain",
    index: "03",
    name: "NainOrder.Domain",
    color: "var(--status-paid)",
    textKey: "arch.layer.domain",
    items: ["Order", "OrderItem", "Product", "Drop", "Hold", "DomainException"],
    dependsOn: () => t("arch.dep.none")
  },
  {
    key: "infrastructure",
    index: "04",
    name: "NainOrder.Infrastructure",
    color: "var(--status-processing)",
    textKey: "arch.layer.infrastructure",
    items: ["NainOrderDbContext", "UnitOfWork", "DropRepository", "DatabaseTimingInterceptor"],
    dependsOn: () => "→ Application, Domain"
  }
];

const DECISIONS = ["money", "concurrency", "uow", "totals", "errors", "holds"];

/* --------------------------------------------------------------------------
   Request map
   -------------------------------------------------------------------------- */
const MAP = { width: 760, height: 150, nodeWidth: 150, nodeHeight: 56, y: 36, gap: 30 };

const nodeX = (index) => 20 + index * (MAP.nodeWidth + MAP.gap);
const nodeCenter = (index) => nodeX(index) + MAP.nodeWidth / 2;

const requestMap = () => html`
  <div class="reqmap" data-reqmap data-state="idle">
    <svg viewBox="0 0 ${MAP.width} ${MAP.height}" class="reqmap__svg" aria-hidden="true">
      ${raw(
        LAYERS.map((layer, index) => html`
          <g class="reqmap__node" data-node="${layer.key}" style="--node-color:${layer.color}">
            <rect x="${nodeX(index)}" y="${MAP.y}" width="${MAP.nodeWidth}" height="${MAP.nodeHeight}" rx="12"/>
            <text x="${nodeCenter(index)}" y="${MAP.y + 24}" class="reqmap__label">${layer.name.replace("NainOrder.", "")}</text>
            <text x="${nodeCenter(index)}" y="${MAP.y + 44}" class="reqmap__metric" data-metric="${layer.key}"></text>
          </g>
          ${index < LAYERS.length - 1
            ? html`<path class="reqmap__edge" d="M${nodeX(index) + MAP.nodeWidth} ${MAP.y + MAP.nodeHeight / 2} h${MAP.gap}"/>`
            : ""}
        `).join("")
      )}
      <circle class="reqmap__dot" data-dot r="7" cx="${nodeCenter(0)}" cy="${MAP.y + MAP.nodeHeight / 2}"/>
      <text x="${MAP.width / 2}" y="${MAP.height - 14}" class="reqmap__caption" data-caption></text>
    </svg>
  </div>
`;

const browserMap = () => html`
  <div class="reqmap reqmap--browser" data-reqmap data-state="idle">
    <svg viewBox="0 0 ${MAP.width} ${MAP.height}" class="reqmap__svg" aria-hidden="true">
      <g class="reqmap__node" data-node="browser" style="--node-color:var(--brand-3)">
        <rect x="${MAP.width / 2 - 130}" y="${MAP.y}" width="260" height="${MAP.nodeHeight}" rx="12"/>
        <text x="${MAP.width / 2}" y="${MAP.y + 24}" class="reqmap__label">${t("arch.map.browser")}</text>
        <text x="${MAP.width / 2}" y="${MAP.y + 44}" class="reqmap__metric" data-metric="browser"></text>
      </g>
      <text x="${MAP.width / 2}" y="${MAP.height - 14}" class="reqmap__caption" data-caption></text>
    </svg>
  </div>
`;

/**
 * Plays one trace on the map. The dot walks the layers in dependency order and comes back; a
 * rejection stops it at the layer the server named and turns it red. Timings shown are the
 * server's; the walk's pace is only a visual aid and is never presented as a measurement.
 */
const playTrace = (map, entry, animate) => {
  const dot = $("[data-dot]", map);
  const caption = $("[data-caption]", map);
  const nodes = [...map.querySelectorAll("[data-node]")];
  const reached = entry.ok ? LAYERS.length - 1 : Math.max(0, LAYERS.findIndex((l) => l.key === entry.layer));

  nodes.forEach((node) => { node.dataset.lit = "false"; node.dataset.rejected = "false"; });
  map.dataset.state = entry.ok ? "ok" : "rejected";

  $('[data-metric="api"]', map).textContent = entry.timing?.app !== undefined ? fmtDuration(entry.timing.app) : "";
  $('[data-metric="infrastructure"]', map).textContent = entry.timing?.db !== undefined
    ? `${fmtDuration(entry.timing.db)} · ${entry.timing.dbCommands ?? "?"} SQL`
    : "";
  $('[data-metric="application"]', map).textContent = "";
  $('[data-metric="domain"]', map).textContent = "";

  caption.textContent = entry.ok
    ? `${entry.method} ${entry.path} · ${entry.status}`
    : `${entry.method} ${entry.path} · ${entry.status} ${entry.code ?? ""} · ${t("arch.map.decidedIn", { layer: t(`arch.map.layer.${entry.layer ?? "api"}`) })}`;

  const centers = LAYERS.map((_, index) => nodeCenter(index));
  const forward = centers.slice(0, reached + 1);
  const route = [...forward, ...forward.slice(0, -1).reverse()];

  if (!animate || !dot.animate) {
    route.slice(0, reached + 1).forEach((_, index) => { nodes[index].dataset.lit = "true"; });
    if (!entry.ok) nodes[reached].dataset.rejected = "true";
    dot.setAttribute("cx", String(centers[0]));
    return;
  }

  dot.getAnimations().forEach((animation) => animation.cancel());
  const stepMs = 160;
  const animation = dot.animate(
    route.map((cx, step) => ({ offset: step / Math.max(route.length - 1, 1), cx: `${cx}px` })),
    { duration: stepMs * route.length, easing: "linear", fill: "forwards" }
  );

  route.forEach((cx, step) => {
    setTimeout(() => {
      if (animation.playState === "idle") return;
      const index = centers.indexOf(cx);
      nodes[index].dataset.lit = "true";
      if (!entry.ok && step === reached) nodes[index].dataset.rejected = "true";
    }, stepMs * step);
  });
};

const playBrowserTrace = (map, entry) => {
  map.dataset.state = entry.ok ? "ok" : "rejected";
  const node = $("[data-node]", map);
  node.dataset.lit = "true";
  node.dataset.rejected = String(!entry.ok);
  $('[data-metric="browser"]', map).textContent = fmtDuration(entry.ms);
  $("[data-caption]", map).textContent = `${entry.method} ${entry.path} · ${entry.status}${entry.ok ? "" : ` ${entry.code ?? ""}`}`;
};

/* --------------------------------------------------------------------------
   View
   -------------------------------------------------------------------------- */
const traceRow = (entry) => html`
  <div class="trace" data-ok="${entry.ok}">
    <span class="trace__method">${entry.method}</span>
    <span class="trace__status">${entry.status || "ERR"}</span>
    <span class="trace__path">${entry.path}</span>
    <span class="trace__time">${fmtDuration(entry.ms)}</span>
  </div>
`;

const markup = (stateMachine) => html`
  <section class="section-head">
    <div>
      <h1 class="section-head__title">${t("arch.title")}</h1>
      <p class="section-head__text">${t("arch.map.text")}</p>
    </div>
    <div class="row">
      <button class="btn btn--ghost btn--sm" type="button" data-action="ping">
        ${raw(icon("spark", { size: 14 }))} ${t("arch.trace.ping")}
      </button>
      <button class="btn btn--ghost btn--sm" type="button" data-action="reject">
        ${raw(icon("ban", { size: 14 }))} ${t("arch.map.reject")}
      </button>
      ${raw(isDemoMode()
        ? html`<a class="btn" href="https://github.com/Nain9Dev/NainOrder" target="_blank" rel="noopener">
            ${raw(icon("book", { size: 15 }))} ${t("arch.github")} ${raw(icon("external", { size: 13 }))}
          </a>`
        : html`<a class="btn" href="/swagger" target="_blank" rel="noopener">
            ${raw(icon("book", { size: 15 }))} ${t("arch.swagger")} ${raw(icon("external", { size: 13 }))}
          </a>`)}
    </div>
  </section>

  <article class="card">
    ${raw(isDemoMode() ? browserMap() : requestMap())}
    <p class="reqmap__legend">${t(isDemoMode() ? "arch.map.legendBrowser" : "arch.map.legend")}</p>
  </article>

  <div class="grid grid--layers">
    ${raw(
      LAYERS.map(
        (layer, index) => html`
          <article class="layer reveal" style="--layer-color:${layer.color};--i:${index}">
            <span class="layer__index">${layer.index}</span>
            <h2 class="layer__name">${layer.name}</h2>
            <p class="layer__text">${t(layer.textKey)}</p>
            <div class="layer__items">
              ${raw(layer.items.map((item) => `<span class="tag mono">${item}</span>`).join(""))}
            </div>
            <p class="layer__dep">${raw(icon("layers", { size: 12 }))} ${layer.dependsOn()}</p>
          </article>
        `
      ).join("")
    )}
  </div>

  <div class="grid grid--split">
    <article class="card">
      <header class="card__header">
        <div>
          <h2 class="card__title">${t("arch.trace.title")}</h2>
          <p class="card__hint">${t("arch.trace.hint")}</p>
        </div>
      </header>

      <div class="console">
        <div class="console__head">
          <span class="console__dots"><i></i><i></i><i></i></span>
          <span class="console__title">nainorder · http trace</span>
        </div>
        <div class="console__body" data-console aria-live="polite"></div>
      </div>
    </article>

    <article class="card">
      <header class="card__header">
        <div>
          <h2 class="card__title">${t("arch.machine.title")}</h2>
          <p class="card__hint">${t("arch.machine.hint")} <code class="mono">/api/meta/order-state-machine</code></p>
        </div>
      </header>

      <div class="state-machine">
        ${raw(
          stateMachine.states
            .map(
              (state) => html`
                <div class="state-node">
                  <span class="badge" data-status="${state.name}">${statusLabel(state.name)}</span>
                  ${raw(
                    state.isTerminal
                      ? html`<span class="state-node__terminal">${t("arch.machine.terminal")}</span>`
                      : html`<span class="state-node__arrow mono">→</span>
                          ${raw(
                            state.transitions
                              .map((next) => `<span class="badge" data-status="${next}">${statusLabel(next)}</span>`)
                              .join("")
                          )}`
                  )}
                </div>
              `
            )
            .join("")
        )}
      </div>
    </article>
  </div>

  <article class="card">
    <header class="card__header">
      <div>
        <h2 class="card__title">${t("arch.decisions.title")}</h2>
        <p class="card__hint">${t("arch.decisions.hint")}</p>
      </div>
    </header>

    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
      ${raw(
        DECISIONS.map(
          (key, index) => html`
            <div class="reveal" style="--i:${index}">
              <p style="font-size:var(--text-sm);font-weight:620;margin-bottom:var(--space-2)">
                ${t(`arch.decision.${key}.title`)}
              </p>
              <p class="layer__text">${t(`arch.decision.${key}.text`)}</p>
            </div>
          `
        ).join("")
      )}
    </div>
  </article>
`;

export const architectureView = {
  get title() { return t("arch.title"); },
  get subtitle() { return t("arch.subtitle"); },

  /** Unsubscribes from the trace when leaving the view, so no subscription stays alive. */
  destroy() {
    this._unsubscribe?.();
    this._unsubscribe = null;
  },

  async render(outlet) {
    if (!outlet.firstChild) {
      render(outlet, html`<div class="skeleton" style="height:460px"></div>`);
    }

    let stateMachine;
    try {
      stateMachine = await api.meta.stateMachine();
    } catch (error) {
      toastError(error, t("arch.failed"));
      return;
    }

    const root = render(outlet, markup(stateMachine));
    const consoleNode = $("[data-console]", root);
    const map = $("[data-reqmap]", root);
    const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onBrowser = (entry) => entry.engine === "browser" || isDemoMode();

    const appendTrace = (entry) => {
      consoleNode.insertAdjacentHTML("beforeend", traceRow(entry));
      // A short window is kept: the console is a monitor, not a historical log.
      while (consoleNode.children.length > 60) consoleNode.firstElementChild.remove();
      consoleNode.scrollTop = consoleNode.scrollHeight;
    };

    const play = (entry, withMotion) => {
      if (onBrowser(entry)) playBrowserTrace(map, entry);
      else playTrace(map, entry, withMotion);
    };

    const history = traceHistory();
    history.slice(-25).forEach(appendTrace);
    if (history.length) play(history.at(-1), false);

    this.destroy();
    this._unsubscribe = onTrace((entry) => {
      appendTrace(entry);
      play(entry, animate);
    });

    delegate(root, "click", '[data-action="ping"]', () => api.dashboard.stats().catch(() => {}));
    // A deliberate rejection, so the map can show where a rule says no: an order that does not exist.
    delegate(root, "click", '[data-action="reject"]', () =>
      api.orders.get("00000000-0000-0000-0000-000000000000").catch(() => {}));
  }
};
