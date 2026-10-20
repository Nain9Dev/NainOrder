/**
 * Architecture view: explains the project's structure and, above all, proves it. The console
 * records every request the interface makes live, so the trip through the layers is seen on
 * screen instead of staying a claim in the README.
 */

import { html, icon, raw, render, $, delegate } from "../dom.js";
import { api, onTrace, traceHistory, isDemoMode } from "../api.js";
import { toastError } from "../toast.js";
import { fmtDuration, statusLabel } from "../format.js";
import { t } from "../i18n.js";

const LAYERS = [
  {
    index: "01",
    name: "NainOrder.Domain",
    color: "var(--status-paid)",
    textKey: "arch.layer.domain",
    items: ["Order", "OrderItem", "Product", "Drop", "Hold", "DomainException"],
    dependsOn: () => t("arch.dep.none")
  },
  {
    index: "02",
    name: "NainOrder.Application",
    color: "var(--brand-1)",
    textKey: "arch.layer.application",
    items: ["OrderService", "DropService", "IUnitOfWork", "IOrderRepository"],
    dependsOn: () => "→ Domain"
  },
  {
    index: "03",
    name: "NainOrder.Infrastructure",
    color: "var(--status-processing)",
    textKey: "arch.layer.infrastructure",
    items: ["NainOrderDbContext", "UnitOfWork", "DropRepository", "MoneyConverter"],
    dependsOn: () => "→ Application, Domain"
  },
  {
    index: "04",
    name: "NainOrder.Api",
    color: "var(--status-shipped)",
    textKey: "arch.layer.api",
    items: ["DropsController", "GlobalExceptionHandler", "HoldExpirySweeper", "wwwroot"],
    dependsOn: () => "→ Application, Infrastructure"
  }
];

const DECISIONS = ["money", "concurrency", "uow", "totals", "errors", "holds"];

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
      <p class="section-head__text">${t("arch.text")}</p>
    </div>
    ${raw(isDemoMode()
      ? html`<a class="btn" href="https://github.com/Nain9Dev/NainOrder" target="_blank" rel="noopener">
          ${raw(icon("book", { size: 15 }))} ${t("arch.github")} ${raw(icon("external", { size: 13 }))}
        </a>`
      : html`<a class="btn" href="/swagger" target="_blank" rel="noopener">
          ${raw(icon("book", { size: 15 }))} ${t("arch.swagger")} ${raw(icon("external", { size: 13 }))}
        </a>`)}
  </section>

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
        <button class="btn btn--ghost btn--sm" type="button" data-action="ping">
          ${raw(icon("spark", { size: 14 }))} ${t("arch.trace.ping")}
        </button>
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

    const appendTrace = (entry) => {
      consoleNode.insertAdjacentHTML("beforeend", traceRow(entry));
      // A short window is kept: the console is a monitor, not a historical log.
      while (consoleNode.children.length > 60) consoleNode.firstElementChild.remove();
      consoleNode.scrollTop = consoleNode.scrollHeight;
    };

    traceHistory().slice(-25).forEach(appendTrace);

    this.destroy();
    this._unsubscribe = onTrace(appendTrace);

    delegate(root, "click", '[data-action="ping"]', () => api.dashboard.stats().catch(() => {}));
  }
};
