/**
 * Vista de arquitectura: explica la estructura del proyecto y, sobre todo, la demuestra.
 * La consola registra en vivo cada petición que hace la interfaz, así que el recorrido
 * por las capas se ve en pantalla en lugar de quedarse en una afirmación del README.
 */

import { html, icon, raw, render, $, delegate } from "../dom.js";
import { api, onTrace, traceHistory } from "../api.js";
import { toastError } from "../toast.js";
import { fmtDuration, statusLabel } from "../format.js";

const LAYERS = [
  {
    index: "01",
    name: "NainOrder.Domain",
    color: "var(--status-paid)",
    text: "Entidades, invariantes y máquina de estados. No referencia ningún paquete externo: " +
          "ni EF Core, ni ASP.NET, ni siquiera inyección de dependencias.",
    items: ["Order", "OrderItem", "Product", "Customer", "DomainException"],
    dependsOn: "Sin dependencias"
  },
  {
    index: "02",
    name: "NainOrder.Application",
    color: "var(--brand-1)",
    text: "Casos de uso, DTOs y contratos de persistencia. Orquesta agregados y decide la " +
          "frontera transaccional, pero no sabe qué motor hay debajo.",
    items: ["OrderService", "ProductService", "IUnitOfWork", "IOrderRepository"],
    dependsOn: "→ Domain"
  },
  {
    index: "03",
    name: "NainOrder.Infrastructure",
    color: "var(--status-processing)",
    text: "EF Core, SQLite, configuración Fluent API y consultas de lectura. Implementa las " +
          "interfaces que declara Application: la dependencia apunta hacia dentro.",
    items: ["NainOrderDbContext", "UnitOfWork", "AnalyticsRepository", "MoneyConverter"],
    dependsOn: "→ Application, Domain"
  },
  {
    index: "04",
    name: "NainOrder.Api",
    color: "var(--status-shipped)",
    text: "Controladores REST, contrato de errores RFC 7807, limitación de tráfico y esta " +
          "misma interfaz servida como estáticos desde el mismo origen.",
    items: ["OrdersController", "GlobalExceptionHandler", "wwwroot"],
    dependsOn: "→ Application, Infrastructure"
  }
];

const DECISIONS = [
  {
    title: "El dinero se guarda en céntimos enteros",
    text: "SQLite no tiene tipo decimal y EF Core lo persistiría como texto, con lo que " +
          "ORDER BY y SUM operarían sobre cadenas. Un conversor a INTEGER hace exactas la " +
          "ordenación y la agregación, y elimina el error de coma flotante en importes."
  },
  {
    title: "Concurrencia optimista sobre el stock",
    text: "Product lleva un token de versión. Si dos peticiones intentan reservar la última " +
          "unidad a la vez, la segunda falla en el UPDATE y recibe un 409 en lugar de sobrevender."
  },
  {
    title: "Unidad de trabajo explícita",
    text: "Los repositorios ya no confirman por su cuenta. Añadir una línea toca dos agregados " +
          "—pedido y producto— y ambos se persisten dentro de la misma transacción o ninguno."
  },
  {
    title: "Los totales del pedido se materializan",
    text: "Se recalculan en cada cambio de la cesta en lugar de derivarse al leer, de modo que " +
          "listados y métricas agregan en base de datos sin cargar las líneas de cada pedido."
  },
  {
    title: "Errores como contrato, no como texto",
    text: "Un único manejador traduce cada excepción a ProblemDetails con un código estable. " +
          "Un fallo de negocio es 4xx y un fallo técnico sigue siendo 500, nunca al revés."
  }
];

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
      <h1 class="section-head__title">Arquitectura</h1>
      <p class="section-head__text">
        Cuatro proyectos con dependencias que apuntan siempre hacia el dominio. Debajo, la
        traza real de las llamadas que esta interfaz hace contra la API.
      </p>
    </div>
    <a class="btn" href="/swagger" target="_blank" rel="noopener">
      ${raw(icon("book", { size: 15 }))} Abrir Swagger ${raw(icon("external", { size: 13 }))}
    </a>
  </section>

  <div class="grid grid--layers">
    ${raw(
      LAYERS.map(
        (layer, index) => html`
          <article class="layer reveal" style="--layer-color:${layer.color};--i:${index}">
            <span class="layer__index">${layer.index}</span>
            <h2 class="layer__name">${layer.name}</h2>
            <p class="layer__text">${layer.text}</p>
            <div class="layer__items">
              ${raw(layer.items.map((item) => `<span class="tag mono">${item}</span>`).join(""))}
            </div>
            <p class="layer__dep">${raw(icon("layers", { size: 12 }))} ${layer.dependsOn}</p>
          </article>
        `
      ).join("")
    )}
  </div>

  <div class="grid grid--split">
    <article class="card">
      <header class="card__header">
        <div>
          <h2 class="card__title">Traza de red en vivo</h2>
          <p class="card__hint">Cada llamada que sale de esta interfaz, con su latencia real</p>
        </div>
        <button class="btn btn--ghost btn--sm" type="button" data-action="ping">
          ${raw(icon("spark", { size: 14 }))} Lanzar petición
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
          <h2 class="card__title">Máquina de estados</h2>
          <p class="card__hint">Servida por <code class="mono">/api/meta/order-state-machine</code></p>
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
                      ? html`<span class="state-node__terminal">estado final</span>`
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
        <h2 class="card__title">Decisiones técnicas</h2>
        <p class="card__hint">Por qué el código es como es, no solo qué hace</p>
      </div>
    </header>

    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
      ${raw(
        DECISIONS.map(
          (decision, index) => html`
            <div class="reveal" style="--i:${index}">
              <p style="font-size:var(--text-sm);font-weight:620;margin-bottom:var(--space-2)">
                ${decision.title}
              </p>
              <p class="layer__text">${decision.text}</p>
            </div>
          `
        ).join("")
      )}
    </div>
  </article>
`;

export const architectureView = {
  title: "Arquitectura",
  subtitle: "Clean Architecture verificable, no declarativa",

  /** Baja de la traza al abandonar la vista, para no dejar suscripciones vivas. */
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
      toastError(error, "No se pudo leer la máquina de estados");
      return;
    }

    const root = render(outlet, markup(stateMachine));
    const consoleNode = $("[data-console]", root);

    const appendTrace = (entry) => {
      consoleNode.insertAdjacentHTML("beforeend", traceRow(entry));
      // Se conserva una ventana corta: la consola es un monitor, no un registro histórico.
      while (consoleNode.children.length > 60) consoleNode.firstElementChild.remove();
      consoleNode.scrollTop = consoleNode.scrollHeight;
    };

    traceHistory().slice(-25).forEach(appendTrace);

    this.destroy();
    this._unsubscribe = onTrace(appendTrace);

    delegate(root, "click", '[data-action="ping"]', () => api.dashboard.stats().catch(() => {}));
  }
};
