/**
 * Drop: venta de unidades limitadas a una multitud. La vista pinta lo que devuelve la API
 * (disponibles, reservadas, vendidas, estado) y no calcula ninguna regla: quién puede comprar,
 * cuándo caduca una reserva y si el drop está agotado lo decide el servidor.
 */

import { html, icon, raw, render, $, delegate } from "../dom.js";
import { api, ApiError, isDemoMode } from "../api.js";
import { toast, toastError } from "../toast.js";
import { withBusy } from "../overlay.js";
import { fmtMoney, fmtNumber } from "../format.js";

const LAST_DROP_KEY = "nainorder.drop";
const POLL_MS = 1000;
const CROWD = 40;

const STATUS_LABEL = { Scheduled: "Programado", Live: "En vivo", SoldOut: "Agotado" };

const MESSAGES = {
  drop_not_live: "El drop aún no ha abierto",
  buyer_limit_reached: "Ya tienes el máximo permitido",
  insufficient_stock: "Agotado: otra persona fue más rápida",
  concurrency_conflict: "Mucha demanda, inténtalo otra vez",
  hold_expired: "Tu reserva caducó"
};

const remember = (id) => {
  try {
    id ? localStorage.setItem(LAST_DROP_KEY, id) : localStorage.removeItem(LAST_DROP_KEY);
  } catch {
    /* El almacenamiento puede estar bloqueado: se pierde solo el atajo. */
  }
};

const lastDropId = () => {
  try {
    return localStorage.getItem(LAST_DROP_KEY);
  } catch {
    return null;
  }
};

const clock = (milliseconds) => {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

const slider = (name, label, min, max, value, unit = "") => html`
  <label class="race__control">
    <span class="race__control-label">${label} <strong class="numeric" data-out="${name}">${value}</strong>${unit}</span>
    <input type="range" name="${name}" min="${min}" max="${max}" value="${value}" data-input="${name}">
  </label>
`;

const launcher = (products, recent) => html`
  <article class="card race">
    <div class="race__controls">
      <label class="race__control">
        <span class="race__control-label">Producto</span>
        <select class="select" data-input="product">
          ${raw(products.map((p) => html`<option value="${p.id}">${p.name} · ${fmtMoney(p.price)}</option>`).join(""))}
        </select>
      </label>
      ${raw(slider("units", "Unidades", 1, 200, 24))}
      ${raw(slider("perBuyer", "Máximo por persona", 1, 10, 2))}
      ${raw(slider("hold", "Reserva", 10, 120, 30, " s"))}
      <button class="btn btn--primary" type="button" data-action="launch">
        ${raw(icon("ticket", { size: 15 }))} Lanzar drop
      </button>
    </div>
    ${raw(
      recent.length
        ? html`<div class="drop-recent">${raw(
            recent
              .map(
                (d) => html`<button class="tag drop-recent__item" type="button" data-open="${d.id}">
                  ${d.productName} · ${STATUS_LABEL[d.status] ?? d.status}
                </button>`
              )
              .join("")
          )}</div>`
        : ""
    )}
  </article>
`;

const stage = () => html`
  <article class="card drop" data-stage>
    <header class="drop__head">
      <div>
        <h2 class="drop__name" data-name></h2>
        <p class="drop__price numeric" data-price></p>
      </div>
      <div class="drop__state">
        <span class="badge" data-badge></span>
        <span class="drop__clock numeric" data-clock></span>
      </div>
    </header>

    <div class="drop__grid" data-grid aria-label="Una celda por unidad"></div>

    <div class="race__stats" data-stats></div>

    <div class="drop__actions">
      <button class="btn btn--primary" type="button" data-action="take">
        ${raw(icon("cart", { size: 15 }))} Conseguir una unidad
      </button>
      <button class="btn" type="button" data-action="crowd">
        ${raw(icon("users", { size: 15 }))} Soltar ${CROWD} compradores
      </button>
      <button class="btn btn--ghost" type="button" data-action="reset">Otro drop</button>
    </div>

    <div class="drop__hold" data-hold hidden>
      <div class="drop__hold-bar"><i data-hold-bar></i></div>
      <span>Tu reserva · <strong class="numeric" data-hold-clock></strong></span>
      <button class="btn btn--primary btn--sm" type="button" data-action="confirm">Confirmar compra</button>
    </div>

    <ul class="race__legend">
      <li><i data-cell="available"></i> disponible</li>
      <li><i data-cell="held"></i> reservada</li>
      <li><i data-cell="sold"></i> vendida</li>
    </ul>
  </article>
`;

const cellsFor = (drop, mine) => {
  const states = [
    ...Array(drop.sold).fill("sold"),
    ...Array(drop.held).fill("held"),
    ...Array(drop.available).fill("available")
  ];
  let owned = mine;
  return states
    .map((state, index) => {
      const own = state === "held" && owned-- > 0;
      return `<span class="drop__cell" data-cell="${state}"${own ? " data-mine" : ""} style="--i:${index}"></span>`;
    })
    .join("");
};

export const dropView = {
  title: "Drop",
  subtitle: "Unidades limitadas, una multitud, cero sobreventa",

  destroy() {
    clearInterval(this._poll);
    clearInterval(this._tick);
    this._poll = this._tick = null;
  },

  async render(outlet) {
    this.destroy();

    const header = html`
      <section class="section-head">
        <div>
          <h1 class="section-head__title">Drop</h1>
          <p class="section-head__text">Lanza una venta limitada y suelta una multitud sobre ella.</p>
        </div>
      </section>
      ${raw(isDemoMode()
        ? html`<div class="demo-banner">
            <span class="demo-banner__mark">${raw(icon("info", { size: 15 }))}</span>
            <p class="demo-banner__text"><strong>Aquí corre en el navegador.</strong> Las colisiones reales
            entre compradores simultáneos se ven con la API .NET en marcha.</p>
          </div>`
        : "")}
    `;

    const root = render(outlet, html`${raw(header)}<div data-body></div>`);
    const body = $("[data-body]", root);

    const showLauncher = async () => {
      remember(null);
      this.destroy();

      let products = [];
      let recent = [];
      try {
        [products, recent] = await Promise.all([api.products.list(), api.drops.list()]);
      } catch (error) {
        toastError(error, "No se pudo cargar el catálogo");
        return;
      }

      body.innerHTML = launcher(products, recent);
    };

    const openDrop = async (id) => {
      let drop;
      try {
        drop = await api.drops.get(id);
      } catch {
        await showLauncher();
        return;
      }

      remember(id);
      body.innerHTML = stage();
      const stageNode = $("[data-stage]", body);
      let current = drop;
      let skew = Date.parse(drop.serverTime) - Date.now();
      let busy = false;

      const cell = drop.totalUnits <= 48 ? 44 : drop.totalUnits <= 200 ? 26 : 14;
      $("[data-grid]", stageNode).style.setProperty("--cell", `${cell}px`);
      $("[data-name]", stageNode).textContent = drop.productName;
      $("[data-price]", stageNode).textContent = fmtMoney(drop.unitPrice);

      const paint = () => {
        const mine = current.myHolds.find((h) => h.state === "Active");
        const now = Date.now() + skew;

        $("[data-grid]", stageNode).innerHTML = cellsFor(current, mine?.quantity ?? 0);

        const badge = $("[data-badge]", stageNode);
        badge.textContent = STATUS_LABEL[current.status] ?? current.status;
        badge.dataset.status = { Scheduled: "PendingPayment", Live: "Paid", SoldOut: "Cancelled" }[current.status];

        $("[data-stats]", stageNode).innerHTML = html`
          <div data-tone="win"><span class="numeric">${fmtNumber(current.available)}</span><small>disponibles</small></div>
          <div><span class="numeric">${fmtNumber(current.held)}</span><small>reservadas</small></div>
          <div><span class="numeric">${fmtNumber(current.sold)}</span><small>vendidas</small></div>
        `;

        $('[data-action="take"]', stageNode).disabled = busy || current.status !== "Live";

        const holdNode = $("[data-hold]", stageNode);
        holdNode.hidden = !mine;
        if (mine) {
          const left = Date.parse(mine.expiresAt) - now;
          $("[data-hold-clock]", stageNode).textContent = clock(left);
          $("[data-hold-bar]", stageNode).style.width = `${Math.max(0, Math.min(100, (left / (current.holdSeconds * 1000)) * 100))}%`;
        }

        const clockNode = $("[data-clock]", stageNode);
        clockNode.textContent = current.status === "Scheduled" ? `Abre en ${clock(Date.parse(current.opensAt) - now)}` : "";
      };

      const refresh = async () => {
        try {
          current = await api.drops.get(id);
          skew = Date.parse(current.serverTime) - Date.now();
          paint();
        } catch {
          /* Un fallo puntual de red se corrige en el siguiente ciclo. */
        }
      };

      const say = (error, fallback) => {
        const code = error instanceof ApiError ? error.code : null;
        if (MESSAGES[code]) toast({ title: MESSAGES[code], variant: "error" });
        else toastError(error, fallback);
      };

      paint();
      this._poll = setInterval(refresh, POLL_MS);
      this._tick = setInterval(paint, 250);

      delegate(stageNode, "click", '[data-action="take"]', async (event, button) => {
        try {
          busy = true;
          await withBusy(button, () => api.drops.take(id, 1));
        } catch (error) {
          say(error, "No se pudo reservar");
        } finally {
          busy = false;
          await refresh();
        }
      });

      delegate(stageNode, "click", '[data-action="confirm"]', async (event, button) => {
        const mine = current.myHolds.find((h) => h.state === "Active");
        if (!mine) return;
        try {
          const order = await withBusy(button, () => api.drops.confirm(id, mine.id));
          toast({ title: "Compra confirmada", text: `Pedido ${order.reference} · ${fmtMoney(order.totalAmount)}`, variant: "success" });
        } catch (error) {
          say(error, "No se pudo confirmar");
        } finally {
          await refresh();
        }
      });

      delegate(stageNode, "click", '[data-action="crowd"]', async (event, button) => {
        // Cada comprador es un visitante distinto; las colisiones de escritura se reintentan
        // como haría cualquier cliente, y lo que sobra recibe "agotado".
        const burst = setInterval(refresh, 150);
        try {
          await withBusy(button, () =>
            Promise.all(
              Array.from({ length: CROWD }, async () => {
                const visitor = crypto.randomUUID();
                for (let attempt = 0; attempt < 40; attempt++) {
                  try {
                    await api.drops.takeAs(id, visitor, 1);
                    return;
                  } catch (error) {
                    if (!(error instanceof ApiError) || error.code !== "concurrency_conflict") return;
                  }
                }
              })
            )
          );
        } finally {
          clearInterval(burst);
          await refresh();
        }
      });

      delegate(stageNode, "click", '[data-action="reset"]', showLauncher);
    };

    delegate(root, "input", "[data-input]", (event, input) => {
      const out = $(`[data-out="${input.dataset.input}"]`, root);
      if (out) out.textContent = input.value;
      if (input.name === "units") {
        const per = $('[data-input="perBuyer"]', root);
        per.max = Math.min(10, Number(input.value));
        if (Number(per.value) > Number(per.max)) {
          per.value = per.max;
          $('[data-out="perBuyer"]', root).textContent = per.max;
        }
      }
    });

    delegate(root, "click", '[data-action="launch"]', async (event, button) => {
      const value = (name) => $(`[data-input="${name}"]`, root).value;
      try {
        const drop = await withBusy(button, () =>
          api.drops.create({
            productId: value("product"),
            totalUnits: Number(value("units")),
            perBuyerLimit: Number(value("perBuyer")),
            holdSeconds: Number(value("hold")),
            opensInSeconds: 0
          })
        );
        await openDrop(drop.id);
      } catch (error) {
        toastError(error, "No se pudo lanzar el drop");
      }
    });

    delegate(root, "click", "[data-open]", (event, node) => openDrop(node.dataset.open));

    const last = lastDropId();
    if (last) await openDrop(last);
    else await showLauncher();
  }
};
