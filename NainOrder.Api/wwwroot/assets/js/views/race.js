/**
 * Carrera de stock: la garantía central del proyecto, ejecutada a la vista.
 * N compradores compiten por M unidades a la vez; el panel pinta lo que la API devuelve
 * y no calcula ninguna cifra: el veredicto "cuadra" lo decide el servidor sobre lo persistido.
 */

import { html, icon, raw, render, $, delegate } from "../dom.js";
import { api, isDemoMode } from "../api.js";
import { toastError } from "../toast.js";
import { withBusy } from "../overlay.js";
import { fmtNumber } from "../format.js";

const DEFAULTS = { buyers: 24, units: 5 };

const slider = (name, label, min, max, value) => html`
  <label class="race__control">
    <span class="race__control-label">${label} <strong class="numeric" data-out="${name}">${value}</strong></span>
    <input type="range" name="${name}" min="${min}" max="${max}" value="${value}" data-input="${name}">
  </label>
`;

const tile = (buyer, index, outcome) => html`
  <span class="race__tile" data-outcome="${outcome ?? "idle"}" style="--i:${index}"
        title="${buyer ? `Comprador ${buyer.buyer}` : ""}">
    ${buyer && buyer.attempts > 1 ? raw(`<sup>${buyer.attempts - 1}</sup>`) : ""}
  </span>
`;

const idleGrid = (count) =>
  Array.from({ length: count }, (_, index) => tile(null, index, "idle")).join("");

const resultGrid = (race) => race.results.map((buyer, index) => tile(buyer, index, buyer.outcome)).join("");

const verdict = (race) => {
  const retries = race.results.reduce((sum, buyer) => sum + buyer.attempts - 1, 0);

  return html`
    <div class="race__verdict" data-balanced="${race.balanced}">
      <span class="race__verdict-icon">${raw(icon(race.balanced ? "check" : "alert", { size: 20 }))}</span>
      <div>
        <p class="race__verdict-title">
          ${race.balanced ? "Cuadra al céntimo: ninguna unidad se vendió dos veces" : "El inventario no cuadra"}
        </p>
        <p class="race__verdict-text">
          ${fmtNumber(race.sold)} vendidas + ${fmtNumber(race.remaining)} restantes = ${fmtNumber(race.units)} en stock.
          ${retries > 0
            ? `${fmtNumber(retries)} reintentos tras perder una carrera de escritura.`
            : "Sin colisiones en esta ejecución."}
        </p>
      </div>
    </div>
  `;
};

const stats = (race) => html`
  <div class="race__stats">
    <div><span class="numeric">${fmtNumber(race.buyers)}</span><small>compradores</small></div>
    <div><span class="numeric">${fmtNumber(race.units)}</span><small>unidades</small></div>
    <div data-tone="win"><span class="numeric">${fmtNumber(race.sold)}</span><small>consiguieron una</small></div>
    <div data-tone="lose"><span class="numeric">${fmtNumber(race.rejected)}</span><small>rechazados · 409</small></div>
  </div>
`;

const markup = () => html`
  <section class="section-head">
    <div>
      <h1 class="section-head__title">Carrera de stock</h1>
      <p class="section-head__text">
        Muchos compradores, pocas unidades, el mismo instante. Pulsa y comprueba que nunca se vende de más.
      </p>
    </div>
  </section>

  ${raw(isDemoMode()
    ? html`<div class="demo-banner">
        <span class="demo-banner__mark">${raw(icon("info", { size: 15 }))}</span>
        <p class="demo-banner__text">
          <strong>Aquí corre en secuencia.</strong> El motor del navegador tiene un solo hilo y no puede
          competir de verdad. La carrera real se ve con la API .NET en marcha.
        </p>
      </div>`
    : "")}

  <article class="card race">
    <div class="race__controls">
      ${raw(slider("buyers", "Compradores", 2, 64, DEFAULTS.buyers))}
      ${raw(slider("units", "Unidades en stock", 1, 32, DEFAULTS.units))}
      <button class="btn btn--primary" type="button" data-action="run">
        ${raw(icon("race", { size: 15 }))} Lanzar carrera
      </button>
    </div>

    <div class="race__grid" data-grid aria-label="Un cuadro por comprador">${raw(idleGrid(DEFAULTS.buyers))}</div>

    <div data-result aria-live="polite"></div>

    <ul class="race__legend">
      <li><i data-outcome="won"></i> consiguió una unidad</li>
      <li><i data-outcome="rejected"></i> rechazado por falta de stock</li>
      <li><sup>n</sup> reintentos tras una colisión</li>
    </ul>
  </article>
`;

export const raceView = {
  title: "Carrera de stock",
  subtitle: "La garantía anti-sobreventa, a la vista",

  async render(outlet) {
    const root = render(outlet, markup());
    const grid = $("[data-grid]", root);
    const result = $("[data-result]", root);
    const value = (name) => Number($(`[data-input="${name}"]`, root).value);

    delegate(root, "input", "[data-input]", (event, input) => {
      $(`[data-out="${input.dataset.input}"]`, root).textContent = input.value;
      if (input.dataset.input === "buyers") grid.innerHTML = idleGrid(value("buyers"));
      result.innerHTML = "";
    });

    delegate(root, "click", '[data-action="run"]', async (event, button) => {
      try {
        const race = await withBusy(button, () => api.demo.stockRace(value("buyers"), value("units")));
        grid.innerHTML = resultGrid(race);
        result.innerHTML = stats(race) + verdict(race);
      } catch (error) {
        toastError(error, "La carrera no se pudo ejecutar");
      }
    });
  }
};
