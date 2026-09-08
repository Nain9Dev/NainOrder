/** Notificaciones efímeras. Se anuncian por región viva para lectores de pantalla. */

import { html, icon, raw } from "./dom.js";
import { ApiError } from "./api.js";

const VARIANT_ICONS = {
  success: "check",
  error: "alert",
  warning: "alert",
  info: "info"
};

let container;

const ensureContainer = () => {
  if (container) return container;

  container = document.createElement("div");
  container.className = "toasts";
  container.setAttribute("role", "status");
  container.setAttribute("aria-live", "polite");
  document.body.append(container);

  return container;
};

export const toast = ({ title, text = "", variant = "info", duration = 4600 }) => {
  const node = document.createElement("div");
  node.className = "toast";
  node.dataset.variant = variant;
  node.innerHTML = html`
    <span class="toast__icon">${raw(icon(VARIANT_ICONS[variant] ?? "info", { size: 12 }))}</span>
    <div class="toast__body">
      <p class="toast__title">${title}</p>
      ${text ? raw(html`<p class="toast__text">${text}</p>`) : ""}
    </div>
    <button class="toast__close" type="button" aria-label="Cerrar aviso">
      ${raw(icon("close", { size: 13 }))}
    </button>
  `;

  const dismiss = () => {
    if (node.dataset.leaving) return;
    node.dataset.leaving = "true";

    const remove = () => node.remove();
    node.addEventListener("animationend", remove, { once: true });

    // Igual que en los diálogos: la salida no puede depender de que la animación corra.
    setTimeout(remove, 400);
  };

  node.querySelector(".toast__close").addEventListener("click", dismiss);
  ensureContainer().append(node);

  if (duration > 0) setTimeout(dismiss, duration);

  return dismiss;
};

export const toastSuccess = (title, text) => toast({ title, text, variant: "success" });

/**
 * Traduce un fallo a un aviso legible. Los errores de negocio de la API ya llegan con
 * un mensaje pensado para el usuario; el resto se reduce a un texto genérico.
 */
export const toastError = (error, fallbackTitle = "No se pudo completar la operación") => {
  if (error instanceof ApiError) {
    const validation = error.validationErrors;
    const detail = validation
      ? Object.values(validation).flat().join(" ")
      : error.message;

    return toast({ title: fallbackTitle, text: detail, variant: "error", duration: 6500 });
  }

  console.error(error);
  return toast({ title: fallbackTitle, text: "Error inesperado en el cliente.", variant: "error" });
};
