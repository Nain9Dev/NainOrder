/**
 * Enrutador por fragmento (#/ruta). Sin dependencias y sin configuración de servidor:
 * cualquier recarga profunda sigue sirviendo el mismo index.html.
 */

const routes = new Map();
let notFound = null;
let current = null;
let onChange = () => {};

export const defineRoute = (path, view) => routes.set(path, view);

export const setNotFound = (view) => {
  notFound = view;
};

export const onRouteChange = (handler) => {
  onChange = handler;
};

export const currentPath = () => window.location.hash.replace(/^#/, "") || "/panel";

export const navigate = (path) => {
  if (currentPath() === path) return;
  window.location.hash = path;
};

const resolve = () => {
  const path = currentPath();
  const view = routes.get(path) ?? notFound;
  return { path, view };
};

export const startRouter = (outlet) => {
  const run = async () => {
    const { path, view } = resolve();
    if (!view) return;

    // Cada vista puede liberar temporizadores o suscripciones antes de desaparecer.
    current?.destroy?.();
    current = view;

    outlet.setAttribute("aria-busy", "true");
    onChange(path, view);

    try {
      await view.render(outlet);
    } finally {
      outlet.removeAttribute("aria-busy");
    }

    outlet.scrollIntoView({ block: "start", behavior: "auto" });
  };

  window.addEventListener("hashchange", run);

  if (!window.location.hash) window.location.hash = "/panel";
  run();

  return run;
};
