/**
 * Stock race: the project's central guarantee, run in plain sight.
 * N buyers compete for M units at once; the panel draws what the API returns and computes no
 * figure itself: the "balanced" verdict is decided by the server over what was persisted.
 */

import { html, icon, raw, render, $, delegate } from "../dom.js";
import { api, isDemoMode } from "../api.js";
import { toastError } from "../toast.js";
import { withBusy } from "../overlay.js";
import { fmtNumber } from "../format.js";
import { t } from "../i18n.js";

const DEFAULTS = { buyers: 24, units: 5 };

const slider = (name, label, min, max, value) => html`
  <label class="race__control">
    <span class="race__control-label">${label} <strong class="numeric" data-out="${name}">${value}</strong></span>
    <input type="range" name="${name}" min="${min}" max="${max}" value="${value}" data-input="${name}">
  </label>
`;

const tile = (buyer, index, outcome) => html`
  <span class="race__tile" data-outcome="${outcome ?? "idle"}" style="--i:${index}"
        title="${buyer ? `#${buyer.buyer}` : ""}">
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
        <p class="race__verdict-title">${t(race.balanced ? "race.verdict.ok" : "race.verdict.bad")}</p>
        <p class="race__verdict-text">
          ${t("race.verdict.text", {
            sold: fmtNumber(race.sold), remaining: fmtNumber(race.remaining), units: fmtNumber(race.units)
          })}
          ${retries > 0 ? t("race.verdict.retries", { n: fmtNumber(retries) }) : t("race.verdict.noRetries")}
        </p>
      </div>
    </div>
  `;
};

const stats = (race) => html`
  <div class="race__stats">
    <div><span class="numeric">${fmtNumber(race.buyers)}</span><small>${t("race.stat.buyers")}</small></div>
    <div><span class="numeric">${fmtNumber(race.units)}</span><small>${t("race.stat.units")}</small></div>
    <div data-tone="win"><span class="numeric">${fmtNumber(race.sold)}</span><small>${t("race.stat.won")}</small></div>
    <div data-tone="lose"><span class="numeric">${fmtNumber(race.rejected)}</span><small>${t("race.stat.rejected")}</small></div>
  </div>
`;

const markup = () => html`
  <section class="section-head">
    <div>
      <h1 class="section-head__title">${t("race.title")}</h1>
      <p class="section-head__text">${t("race.text")}</p>
    </div>
  </section>

  ${raw(isDemoMode()
    ? html`<div class="demo-banner">
        <span class="demo-banner__mark">${raw(icon("info", { size: 15 }))}</span>
        <p class="demo-banner__text"><strong>${t("race.demo.title")}</strong> ${t("race.demo.text")}</p>
      </div>`
    : "")}

  <article class="card race">
    <div class="race__controls">
      ${raw(slider("buyers", t("race.buyers"), 2, 64, DEFAULTS.buyers))}
      ${raw(slider("units", t("race.units"), 1, 32, DEFAULTS.units))}
      <button class="btn btn--primary" type="button" data-action="run">
        ${raw(icon("race", { size: 15 }))} ${t("race.run")}
      </button>
    </div>

    <div class="race__grid" data-grid aria-label="${t("race.grid")}">${raw(idleGrid(DEFAULTS.buyers))}</div>

    <div data-result aria-live="polite"></div>

    <ul class="race__legend">
      <li><i data-outcome="won"></i> ${t("race.legend.won")}</li>
      <li><i data-outcome="rejected"></i> ${t("race.legend.rejected")}</li>
      <li><sup>n</sup> ${t("race.legend.retries")}</li>
    </ul>
  </article>
`;

export const raceView = {
  get title() { return t("race.title"); },
  get subtitle() { return t("race.subtitle"); },

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
        toastError(error, t("race.failed"));
      }
    });
  }
};
