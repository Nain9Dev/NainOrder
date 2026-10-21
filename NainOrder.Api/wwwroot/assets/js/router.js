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

export const currentPath = () => window.location.hash.replace(/^#/, "") || "/drop";

export const navigate = (path) => {
  if (currentPath() === path) return;
  window.location.hash = path;
};

/**
 * Exact paths win. A route registered as `/d/*` also matches `/d/<id>` and hands the view the
 * segment as `params.id`: the buyer link of a drop, which must work from a QR code.
 */
const resolve = () => {
  const path = currentPath();
  const exact = routes.get(path);
  if (exact) return { path, view: exact, params: {} };

  const [, head, id] = path.split("/");
  const parametrised = id ? routes.get(`/${head}/*`) : undefined;
  if (parametrised) return { path: `/${head}/*`, view: parametrised, params: { id } };

  return { path, view: notFound, params: {} };
};

export const startRouter = (outlet) => {
  const run = async () => {
    const { path, view, params } = resolve();
    if (!view) return;

    // Cada vista puede liberar temporizadores o suscripciones antes de desaparecer.
    current?.destroy?.();
    current = view;

    outlet.setAttribute("aria-busy", "true");
    onChange(path, view);

    try {
      await view.render(outlet, { params });
    } finally {
      outlet.removeAttribute("aria-busy");
    }

    outlet.scrollIntoView({ block: "start", behavior: "auto" });
  };

  window.addEventListener("hashchange", run);

  if (!window.location.hash) window.location.hash = "/drop";
  run();

  return run;
};
