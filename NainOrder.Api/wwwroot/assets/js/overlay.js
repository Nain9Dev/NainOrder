/**
 * Superposiciones accesibles: modal, panel lateral y confirmación.
 * Comparten cierre por Escape, cierre por fondo, retención del foco y devolución
 * del foco al elemento que las abrió.
 */

import { html, icon, raw, $$ } from "./dom.js";

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

const openOverlay = (kind, { title, subtitle, body = "", footer = "", onMount, size } = {}) => {
  const previouslyFocused = document.activeElement;

  const overlay = document.createElement("div");
  overlay.className = `overlay overlay--${kind}`;

  const panelClass = kind === "drawer" ? "drawer" : "modal";
  overlay.innerHTML = html`
    <section class="${panelClass}" role="dialog" aria-modal="true" aria-label="${title}"
             ${raw(size ? `style="width:min(${size}px,100%)"` : "")}>
      <header class="panel__header">
        <div>
          <h2 class="panel__title">${title}</h2>
          ${subtitle ? raw(html`<p class="panel__subtitle">${subtitle}</p>`) : ""}
        </div>
        <button class="btn btn--ghost btn--icon btn--sm panel__close" type="button" data-overlay-close
                aria-label="Cerrar">${raw(icon("close", { size: 16 }))}</button>
      </header>
      <div class="panel__body">${raw(body)}</div>
      ${footer ? raw(html`<footer class="panel__footer">${raw(footer)}</footer>`) : ""}
    </section>
  `;

  const close = () => {
    if (overlay.dataset.leaving) return;
    overlay.dataset.leaving = "true";
    document.removeEventListener("keydown", onKeyDown, true);

    const remove = () => {
      if (!overlay.isConnected) return;
      overlay.remove();
      previouslyFocused?.focus?.();
    };

    overlay.addEventListener("animationend", remove, { once: true });

    // Red de seguridad: si la animación no llega a emitir su evento —pestaña en
    // segundo plano, motion reducido, entorno sin composición— el diálogo debe
    // desaparecer igualmente en lugar de quedarse retenido en el DOM.
    setTimeout(remove, 400);
  };

  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }

    // Retención del foco dentro del diálogo mientras está abierto.
    if (event.key !== "Tab") return;

    const focusables = $$(FOCUSABLE, overlay).filter((node) => node.offsetParent !== null);
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables.at(-1);

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-overlay-close]")) close();
  });

  document.addEventListener("keydown", onKeyDown, true);
  document.body.append(overlay);

  const panel = overlay.querySelector(`.${panelClass}`);
  onMount?.({ panel, close });

  // El primer control con sentido recibe el foco; si no hay ninguno, lo toma el panel.
  const target = panel.querySelector("[data-autofocus]") ?? panel.querySelector(FOCUSABLE);
  (target ?? panel).focus?.();

  return { close, panel, overlay };
};

export const openModal = (options) => openOverlay("modal", options);

export const openDrawer = (options) => openOverlay("drawer", options);

/** Confirmación para acciones no triviales. Resuelve a true/false. */
export const confirmAction = ({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false
}) =>
  new Promise((resolve) => {
    let settled = false;

    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const { overlay } = openOverlay("modal", {
      title,
      size: 440,
      body: html`<p style="color:var(--text-secondary);font-size:var(--text-sm)">${message}</p>`,
      footer: html`
        <button class="btn" type="button" data-overlay-close>${cancelLabel}</button>
        <span class="spacer"></span>
        <button class="btn ${danger ? "btn--danger" : "btn--primary"}" type="button" data-confirm
                data-autofocus>${confirmLabel}</button>
      `,
      onMount: ({ panel, close: closePanel }) => {
        panel.querySelector("[data-confirm]").addEventListener("click", () => {
          settle(true);
          closePanel();
        });
      }
    });

    // Cualquier otra vía de cierre (Escape, fondo, botón cancelar) equivale a cancelar.
    const observer = new MutationObserver(() => {
      if (document.body.contains(overlay)) return;
      observer.disconnect();
      settle(false);
    });

    observer.observe(document.body, { childList: true });
  });

/** Marca un botón como ocupado mientras dura una promesa. */
export const withBusy = async (button, action) => {
  if (!button) return action();

  button.dataset.loading = "true";
  try {
    return await action();
  } finally {
    delete button.dataset.loading;
  }
};
