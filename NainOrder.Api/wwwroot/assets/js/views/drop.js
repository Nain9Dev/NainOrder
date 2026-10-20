/**
 * Drop: a limited sale to a crowd, seen from two sides — the buyer and the organizer.
 * The view draws what the API returns (available, held, sold, status, next expiry) and computes
 * no rule: who may buy, when a hold expires and whether the drop is sold out are decided by the
 * server. With no drop open, a short wordless animation explains the product.
 */

import { html, icon, raw, render, $, delegate } from "../dom.js";
import { api, ApiError, isDemoMode } from "../api.js";
import { toast, toastError } from "../toast.js";
import { withBusy } from "../overlay.js";
import { fmtMoney, fmtNumber } from "../format.js";
import { t } from "../i18n.js";

const LAST_DROP_KEY = "nainorder.drop";
const ROLE_KEY = "nainorder.role";
const POLL_MS = 1000;
const CROWD = 40;
const WINDOW_MS = 60_000;

/** Defaults for a drop started from the landing: nothing to configure to see it work. */
const QUICK_DROP = { totalUnits: 48, perBuyerLimit: 4, holdSeconds: 30, opensInSeconds: 0 };

const MESSAGES = {
  drop_not_live: "msg.drop_not_live",
  buyer_limit_reached: "msg.buyer_limit_reached",
  insufficient_stock: "msg.insufficient_stock",
  concurrency_conflict: "msg.concurrency_conflict",
  hold_expired: "msg.hold_expired"
};

const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value);
    } catch {
      /* Storage may be blocked: only the shortcut to the last drop is lost. */
    }
  }
};

const clock = (milliseconds) => {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/* --------------------------------------------------------------------------
   Landing: a wordless story of what the engine does
   -------------------------------------------------------------------------- */
const COLUMNS = 6;
const ROWS = 4;
const CELL = 30;
const GAP = 8;
const GRID_X = 330;
const GRID_Y = 34;

const story = () => {
  const cells = [];
  const dots = [];
  const crowd = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const index = row * COLUMNS + col;
      const x = GRID_X + col * (CELL + GAP);
      const y = GRID_Y + row * (CELL + GAP);
      // Every third unit is held by someone who never confirms: it comes back, then sells.
      const kind = index % 3 === 0 ? "back" : "sold";
      cells.push(`<rect class="story__cell story__cell--${kind}" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="6"/>`);

      // A buyer starts on the left of the scene and walks to the unit it will hold. A faint
      // copy stays behind so the crowd is still there once its members have walked away.
      const startX = 24 + ((index * 37) % 120);
      const startY = 30 + ((index * 53) % 150);
      crowd.push(`<circle class="story__crowd" r="6" cx="${startX}" cy="${startY}"/>`);
      dots.push(
        `<circle class="story__dot" r="6" cx="${startX}" cy="${startY}" ` +
        `style="--dx:${x + CELL / 2 - startX}px;--dy:${y + CELL / 2 - startY}px;--i:${index}"/>`
      );
    }
  }

  const captions = ["arrive", "hold", "expire", "sold"]
    .map((key, index) => html`<span class="story__caption" style="--n:${index}">${t(`story.${key}`)}</span>`)
    .join("");

  return html`
    <figure class="story" role="img" aria-label="${t("story.label")}">
      <svg viewBox="0 0 620 230" class="story__svg" aria-hidden="true">
        ${raw(crowd.join(""))}
        ${raw(cells.join(""))}
        ${raw(dots.join(""))}
      </svg>
      <figcaption class="story__captions">${raw(captions)}</figcaption>
    </figure>
  `;
};

const landing = (recent) => html`
  <section class="landing">
    <h2 class="landing__title">${t("landing.title")}</h2>
    <p class="landing__sub">${t("landing.sub")}</p>

    ${raw(story())}

    <div class="landing__actions">
      <button class="btn btn--primary btn--lg" type="button" data-start="buyer">
        ${raw(icon("cart", { size: 16 }))} ${t("landing.buyer")}
      </button>
      <button class="btn btn--lg" type="button" data-start="organizer">
        ${raw(icon("dashboard", { size: 16 }))} ${t("landing.organizer")}
      </button>
    </div>

    ${raw(
      recent.length
        ? html`<div class="drop-recent" aria-label="${t("landing.recent")}">${raw(
            recent
              .map(
                (d) => html`<button class="tag drop-recent__item" type="button" data-open="${d.id}">
                  ${d.productName} · ${t(`drop.status.${d.status}`)}
                </button>`
              )
              .join("")
          )}</div>`
        : ""
    )}
  </section>
`;

/* --------------------------------------------------------------------------
   The open drop
   -------------------------------------------------------------------------- */
const stage = (role) => html`
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
      <div class="seg" role="group" aria-label="${t("role.switch")}">
        <button class="seg__btn" type="button" data-role="buyer" aria-pressed="${role === "buyer"}">${t("role.buyer")}</button>
        <button class="seg__btn" type="button" data-role="organizer" aria-pressed="${role === "organizer"}">${t("role.organizer")}</button>
      </div>
    </header>

    <div data-lens></div>
  </article>
`;

const buyerLens = () => html`
  <div class="buyer">
    <div class="buyer__scarcity">
      <span class="buyer__count numeric" data-available></span>
      <small>${t("drop.stat.available")}</small>
      <div class="drop__hold-bar"><i data-scarcity></i></div>
    </div>

    <button class="btn btn--primary btn--xl" type="button" data-action="take">
      ${raw(icon("cart", { size: 18 }))} ${t("drop.take")}
    </button>

    <div class="drop__hold" data-hold hidden>
      <div class="drop__hold-bar"><i data-hold-bar></i></div>
      <span>${t("drop.yourHold")} · <strong class="numeric" data-hold-clock></strong></span>
      <button class="btn btn--primary btn--sm" type="button" data-action="confirm">${t("drop.confirm")}</button>
    </div>
  </div>
`;

const organizerLens = () => html`
  <div class="organizer">
    <div class="drop__grid" data-grid aria-label="${t("drop.grid")}"></div>

    <div class="race__stats" data-stats></div>

    <div class="organizer__pulse">
      <div class="organizer__chart">
        <p class="organizer__label">${t("drop.org.pace")}</p>
        <svg viewBox="0 0 200 48" preserveAspectRatio="none" class="spark" aria-hidden="true">
          <polyline class="spark__area" data-spark-area points=""/>
          <polyline class="spark__line" data-spark-line points=""/>
        </svg>
      </div>
      <div class="organizer__next">
        <p class="organizer__label">${t("drop.org.next")}</p>
        <p class="organizer__value numeric" data-next></p>
      </div>
    </div>

    <div class="drop__actions">
      <button class="btn btn--primary" type="button" data-action="crowd">
        ${raw(icon("users", { size: 15 }))} ${t("drop.crowd", { n: CROWD })}
      </button>
      <button class="btn btn--ghost" type="button" data-action="reset">${t("drop.reset")}</button>
    </div>

    <ul class="race__legend">
      <li><i data-cell="available"></i> ${t("drop.legend.available")}</li>
      <li><i data-cell="held"></i> ${t("drop.legend.held")}</li>
      <li><i data-cell="sold"></i> ${t("drop.legend.sold")}</li>
    </ul>
  </div>
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

/** Plots the sold count the server reported over the last minute. It applies no rule. */
const sparkPoints = (samples, total, now) => {
  const visible = samples.filter((s) => now - s.at <= WINDOW_MS);
  if (visible.length < 2) return { line: "", area: "" };

  const points = visible.map((s) => {
    const x = 200 - ((now - s.at) / WINDOW_MS) * 200;
    const y = 46 - (s.sold / Math.max(total, 1)) * 44;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return { line: points.join(" "), area: `${points[0].split(",")[0]},48 ${points.join(" ")} 200,48` };
};

export const dropView = {
  get title() { return t("drop.title"); },
  get subtitle() { return t("drop.subtitle"); },

  destroy() {
    clearInterval(this._poll);
    clearInterval(this._tick);
    this._poll = this._tick = null;
  },

  async render(outlet) {
    this.destroy();

    // The top bar already names the view; repeating it here would only add text.
    const header = html`
      ${raw(isDemoMode()
        ? html`<div class="demo-banner">
            <span class="demo-banner__mark">${raw(icon("info", { size: 15 }))}</span>
            <p class="demo-banner__text"><strong>${t("drop.demo.title")}</strong> ${t("drop.demo.text")}</p>
          </div>`
        : "")}
    `;

    const root = render(outlet, html`${raw(header)}<div data-body></div>`);
    const body = $("[data-body]", root);

    const showLanding = async () => {
      store.set(LAST_DROP_KEY, null);
      this.destroy();

      let recent = [];
      try {
        recent = await api.drops.list();
      } catch {
        /* The story and the two buttons work without the list of recent drops. */
      }

      body.innerHTML = landing(recent);
    };

    const openDrop = async (id, preferredRole) => {
      let drop;
      try {
        drop = await api.drops.get(id);
      } catch {
        await showLanding();
        return;
      }

      this.destroy();
      store.set(LAST_DROP_KEY, id);

      let role = preferredRole ?? store.get(ROLE_KEY) ?? "buyer";
      body.innerHTML = stage(role);
      const stageNode = $("[data-stage]", body);
      const lens = $("[data-lens]", stageNode);

      let current = drop;
      let skew = Date.parse(drop.serverTime) - Date.now();
      let busy = false;
      const samples = [];

      $("[data-name]", stageNode).textContent = drop.productName;
      $("[data-price]", stageNode).textContent = fmtMoney(drop.unitPrice);

      const now = () => Date.now() + skew;
      const myActiveHold = () => current.myHolds.find((h) => h.state === "Active");

      const paintHeader = () => {
        const badge = $("[data-badge]", stageNode);
        badge.textContent = t(`drop.status.${current.status}`);
        badge.dataset.status = { Scheduled: "PendingPayment", Live: "Paid", SoldOut: "Cancelled" }[current.status];

        $("[data-clock]", stageNode).textContent =
          current.status === "Scheduled" ? t("drop.opensIn", { time: clock(Date.parse(current.opensAt) - now()) }) : "";
      };

      const paintBuyer = () => {
        $("[data-available]", lens).textContent = fmtNumber(current.available);
        $("[data-scarcity]", lens).style.width = `${(current.available / Math.max(current.totalUnits, 1)) * 100}%`;
        $('[data-action="take"]', lens).disabled = busy || current.status !== "Live";

        const mine = myActiveHold();
        const holdNode = $("[data-hold]", lens);
        holdNode.hidden = !mine;
        if (mine) {
          const left = Date.parse(mine.expiresAt) - now();
          $("[data-hold-clock]", lens).textContent = clock(left);
          $("[data-hold-bar]", lens).style.width = `${Math.max(0, Math.min(100, (left / (current.holdSeconds * 1000)) * 100))}%`;
        }
      };

      const paintOrganizer = () => {
        const grid = $("[data-grid]", lens);
        const cell = current.totalUnits <= 48 ? 36 : current.totalUnits <= 200 ? 24 : 14;
        grid.style.setProperty("--cell", `${cell}px`);
        grid.innerHTML = cellsFor(current, myActiveHold()?.quantity ?? 0);

        $("[data-stats]", lens).innerHTML = html`
          <div data-tone="win"><span class="numeric">${fmtNumber(current.available)}</span><small>${t("drop.stat.available")}</small></div>
          <div><span class="numeric">${fmtNumber(current.held)}</span><small>${t("drop.stat.held")}</small></div>
          <div><span class="numeric">${fmtNumber(current.sold)}</span><small>${t("drop.stat.sold")}</small></div>
        `;

        const { line, area } = sparkPoints(samples, current.totalUnits, Date.now());
        $("[data-spark-line]", lens).setAttribute("points", line);
        $("[data-spark-area]", lens).setAttribute("points", area);

        $("[data-next]", lens).textContent = current.nextHoldExpiresAt
          ? clock(Date.parse(current.nextHoldExpiresAt) - now())
          : t("drop.org.none");
      };

      const paint = () => {
        paintHeader();
        if (role === "buyer") paintBuyer();
        else paintOrganizer();
      };

      const showLens = () => {
        lens.innerHTML = role === "buyer" ? buyerLens() : organizerLens();
        stageNode.querySelectorAll("[data-role]").forEach((button) => {
          button.setAttribute("aria-pressed", String(button.dataset.role === role));
        });
        paint();
      };

      const refresh = async () => {
        try {
          current = await api.drops.get(id);
          skew = Date.parse(current.serverTime) - Date.now();
          samples.push({ at: Date.now(), sold: current.sold });
          if (samples.length > 240) samples.shift();
          paint();
        } catch {
          /* A one-off network failure is corrected on the next cycle. */
        }
      };

      const say = (error, fallback) => {
        const code = error instanceof ApiError ? error.code : null;
        if (MESSAGES[code]) toast({ title: t(MESSAGES[code]), variant: "error" });
        else toastError(error, fallback);
      };

      samples.push({ at: Date.now(), sold: current.sold });
      showLens();
      this._poll = setInterval(refresh, POLL_MS);
      this._tick = setInterval(paint, 250);

      delegate(stageNode, "click", "[data-role]", (event, button) => {
        role = button.dataset.role;
        store.set(ROLE_KEY, role);
        showLens();
      });

      delegate(stageNode, "click", '[data-action="take"]', async (event, button) => {
        try {
          busy = true;
          await withBusy(button, () => api.drops.take(id, 1));
        } catch (error) {
          say(error, t("drop.takeFailed"));
        } finally {
          busy = false;
          await refresh();
        }
      });

      delegate(stageNode, "click", '[data-action="confirm"]', async (event, button) => {
        const mine = myActiveHold();
        if (!mine) return;
        try {
          const order = await withBusy(button, () => api.drops.confirm(id, mine.id));
          toast({
            title: t("drop.bought"),
            text: t("drop.boughtText", { reference: order.reference, total: fmtMoney(order.totalAmount) }),
            variant: "success"
          });
        } catch (error) {
          say(error, t("drop.confirmFailed"));
        } finally {
          await refresh();
        }
      });

      delegate(stageNode, "click", '[data-action="crowd"]', async (event, button) => {
        // Every buyer is a different visitor; write collisions are retried as any client would,
        // and whoever is left gets "sold out".
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

      delegate(stageNode, "click", '[data-action="reset"]', showLanding);
    };

    /** Starts a drop for the chosen role with sensible defaults: nothing to configure. */
    const startAs = async (role, button) => {
      try {
        const drop = await withBusy(button, async () => {
          const products = await api.products.list();
          const product = products[Math.floor(Math.random() * products.length)];
          return api.drops.create({ productId: product.id, ...QUICK_DROP });
        });

        store.set(ROLE_KEY, role);
        await openDrop(drop.id, role);
      } catch (error) {
        toastError(error, t("launch.failed"));
      }
    };

    delegate(root, "click", "[data-start]", (event, button) => startAs(button.dataset.start, button));
    delegate(root, "click", "[data-open]", (event, node) => openDrop(node.dataset.open));

    const last = store.get(LAST_DROP_KEY);
    if (last) await openDrop(last);
    else await showLanding();
  }
};
