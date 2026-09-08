/** Catálogo: alta y edición de productos, ajuste de stock y añadido al pedido activo. */

import { html, icon, raw, render, $, delegate, hueFrom, initials } from "../dom.js";
import { api, ApiError } from "../api.js";
import { openModal, withBusy } from "../overlay.js";
import { toastError, toastSuccess, toast } from "../toast.js";
import { addProductToActiveOrder, openOrderPanel } from "../order-panel.js";
import { getState } from "../state.js";
import { fmtMoney, fmtNumber, stockLabel } from "../format.js";

const filters = { search: "", category: "" };

const productCard = (product, index) => html`
  <article class="product reveal" style="--i:${index}" data-product="${product.id}">
    <div class="product__top">
      <span class="product__glyph" style="--glyph-hue:${hueFrom(product.sku)}" aria-hidden="true">
        ${initials(product.name)}
      </span>
      <div style="min-width:0;flex:1">
        <h3 class="product__name">${product.name}</h3>
        <p class="product__sku mono">${product.sku}</p>
      </div>
      <span class="badge" data-stock="${product.stockStatus}">${fmtNumber(product.stockQuantity)}</span>
    </div>

    <p class="product__desc">${product.description || "Sin descripción."}</p>

    <div class="row" style="gap:var(--space-2)">
      <span class="tag">${product.category}</span>
      <span class="tag">${stockLabel(product.stockStatus)}</span>
    </div>

    <div class="product__foot">
      <span class="product__price">${fmtMoney(product.price)}</span>
      <div class="product__actions">
        <button class="btn btn--ghost btn--icon btn--sm" type="button" data-edit
                aria-label="Editar ${product.name}">${raw(icon("cog", { size: 14 }))}</button>
        <button class="btn btn--ghost btn--icon btn--sm" type="button" data-restock
                aria-label="Reponer stock de ${product.name}">${raw(icon("plus", { size: 14 }))}</button>
        <button class="btn btn--sm" type="button" data-add
                ${product.stockQuantity < 1 ? "disabled" : ""}>
          ${raw(icon("cart", { size: 14 }))} Añadir
        </button>
      </div>
    </div>
  </article>
`;

const markup = (products, categories) => html`
  <section class="section-head">
    <div>
      <h1 class="section-head__title">Catálogo</h1>
      <p class="section-head__text">
        El stock lo gobierna la entidad <code class="mono">Product</code>: ninguna capa superior
        puede dejarlo en negativo, ni siquiera saltándose el servicio.
      </p>
    </div>
    <button class="btn btn--primary" type="button" data-action="create">
      ${raw(icon("plus", { size: 15 }))} Nuevo producto
    </button>
  </section>

  <div class="card" style="padding:var(--space-4)">
    <div class="row">
      <label class="search">
        <span class="visually-hidden">Buscar en el catálogo</span>
        ${raw(icon("search", { size: 16 }))}
        <input class="input" type="search" name="search" placeholder="Buscar por nombre o SKU…"
               value="${filters.search}" data-filter="search" autocomplete="off">
      </label>

      <div class="row" style="gap:var(--space-2)">
        <button class="chip" type="button" data-category=""
                aria-pressed="${filters.category === ""}">Todas</button>
        ${raw(
          categories
            .map(
              (category) => html`
                <button class="chip" type="button" data-category="${category}"
                        aria-pressed="${filters.category === category}">${category}</button>
              `
            )
            .join("")
        )}
      </div>

      <span class="spacer"></span>
      <span class="tag">${fmtNumber(products.length)} referencias</span>
    </div>
  </div>

  ${raw(
    products.length
      ? html`<div class="grid grid--catalog">
          ${raw(products.map(productCard).join(""))}
        </div>`
      : html`<div class="empty">
          <span class="empty__icon">${raw(icon("catalog", { size: 22 }))}</span>
          <p class="empty__title">Sin resultados</p>
          <p class="empty__text">Ningún producto coincide con el filtro aplicado.</p>
          <button class="btn" type="button" data-action="clear-filters">Quitar filtros</button>
        </div>`
  )}
`;

const productForm = (product) => html`
  <form class="stack" id="product-form" novalidate>
    ${raw(
      product
        ? ""
        : html`<label class="field">
            <span class="field__label">SKU</span>
            <input class="input mono" name="sku" required minlength="2" maxlength="50"
                   placeholder="NO-CAT-001" data-autofocus autocomplete="off">
            <span class="field__hint">Identificador único. Se normaliza a mayúsculas.</span>
          </label>`
    )}

    <label class="field">
      <span class="field__label">Nombre</span>
      <input class="input" name="name" required minlength="2" maxlength="200"
             value="${product?.name ?? ""}" ${product ? "data-autofocus" : ""} autocomplete="off">
    </label>

    <div class="row" style="gap:var(--space-3);align-items:flex-start">
      <label class="field" style="flex:1">
        <span class="field__label">Precio (€)</span>
        <input class="input numeric" name="price" type="number" min="0" max="1000000" step="0.01"
               required value="${product?.price ?? ""}">
      </label>

      ${raw(
        product
          ? ""
          : html`<label class="field" style="flex:1">
              <span class="field__label">Stock inicial</span>
              <input class="input numeric" name="initialStock" type="number" min="0" max="1000000"
                     step="1" required value="0">
            </label>`
      )}

      <label class="field" style="flex:1">
        <span class="field__label">Categoría</span>
        <input class="input" name="category" maxlength="60" list="category-options"
               value="${product?.category ?? ""}" placeholder="General" autocomplete="off">
      </label>
    </div>

    <label class="field">
      <span class="field__label">Descripción</span>
      <textarea class="textarea" name="description" maxlength="500"
                placeholder="Detalle visible en el catálogo">${product?.description ?? ""}</textarea>
    </label>

    <p class="field__error" data-form-error hidden></p>
  </form>
`;

const readForm = (form) => {
  const data = Object.fromEntries(new FormData(form));
  return {
    ...data,
    price: Number(data.price),
    ...(("initialStock" in data) ? { initialStock: Number(data.initialStock) } : {})
  };
};

const openProductModal = ({ product, categories, onSaved }) => {
  const isEdit = Boolean(product);

  openModal({
    title: isEdit ? "Editar producto" : "Nuevo producto",
    subtitle: isEdit ? product.sku : "Alta en el catálogo",
    body: html`
      ${raw(productForm(product))}
      <datalist id="category-options">
        ${raw(categories.map((category) => `<option value="${category}"></option>`).join(""))}
      </datalist>
    `,
    footer: html`
      <button class="btn" type="button" data-overlay-close>Cancelar</button>
      <span class="spacer"></span>
      <button class="btn btn--primary" type="submit" form="product-form">
        ${isEdit ? "Guardar cambios" : "Crear producto"}
      </button>
    `,
    onMount: ({ panel, close }) => {
      const form = $("#product-form", panel);
      const errorNode = $("[data-form-error]", panel);
      const submit = $('[type="submit"]', panel);

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        errorNode.hidden = true;

        if (!form.reportValidity()) return;

        try {
          const payload = readForm(form);
          const saved = await withBusy(submit, () =>
            isEdit ? api.products.update(product.id, payload) : api.products.create(payload));

          toastSuccess(isEdit ? "Producto actualizado" : "Producto creado", saved.sku);
          close();
          onSaved();
        } catch (error) {
          // Los errores de negocio se muestran junto al formulario, no solo como aviso.
          errorNode.textContent =
            error instanceof ApiError
              ? Object.values(error.validationErrors ?? {}).flat().join(" ") || error.message
              : "Error inesperado al guardar.";
          errorNode.hidden = false;
        }
      });
    }
  });
};

const openRestockModal = ({ product, onSaved }) =>
  openModal({
    title: "Ajustar stock",
    subtitle: `${product.name} · ${fmtNumber(product.stockQuantity)} unidades actuales`,
    size: 440,
    body: html`
      <form class="stack" id="stock-form" novalidate>
        <label class="field">
          <span class="field__label">Variación de unidades</span>
          <input class="input numeric" name="delta" type="number" step="1" value="10" required
                 data-autofocus>
          <span class="field__hint">
            Un valor negativo retira unidades. El dominio rechaza dejar el stock por debajo de cero.
          </span>
        </label>
        <p class="field__error" data-form-error hidden></p>
      </form>
    `,
    footer: html`
      <button class="btn" type="button" data-overlay-close>Cancelar</button>
      <span class="spacer"></span>
      <button class="btn btn--primary" type="submit" form="stock-form">Aplicar</button>
    `,
    onMount: ({ panel, close }) => {
      const form = $("#stock-form", panel);
      const errorNode = $("[data-form-error]", panel);
      const submit = $('[type="submit"]', panel);

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        errorNode.hidden = true;

        const delta = Number(new FormData(form).get("delta"));
        if (!Number.isFinite(delta) || delta === 0) {
          errorNode.textContent = "Introduce una variación distinta de cero.";
          errorNode.hidden = false;
          return;
        }

        try {
          const saved = await withBusy(submit, () => api.products.adjustStock(product.id, delta));
          toastSuccess("Stock actualizado", `${saved.name}: ${fmtNumber(saved.stockQuantity)} unidades`);
          close();
          onSaved();
        } catch (error) {
          errorNode.textContent = error instanceof ApiError ? error.message : "Error inesperado.";
          errorNode.hidden = false;
        }
      });
    }
  });

export const catalogView = {
  title: "Catálogo",
  subtitle: "Referencias, precios y stock disponible",

  async render(outlet) {
    if (!outlet.firstChild) {
      render(outlet, html`<div class="grid grid--catalog">
        ${raw(Array.from({ length: 6 }, () => '<div class="skeleton" style="height:216px"></div>').join(""))}
      </div>`);
    }

    let products;
    let categories;

    try {
      [products, categories] = await Promise.all([
        api.products.list({ search: filters.search, category: filters.category }),
        api.products.categories()
      ]);
    } catch (error) {
      toastError(error, "No se pudo cargar el catálogo");
      return;
    }

    const root = render(outlet, markup(products, categories));
    const reload = () => this.render(outlet);
    const findProduct = (node) => products.find((p) => p.id === node.closest("[data-product]").dataset.product);

    // La búsqueda espera a que el usuario deje de teclear para no lanzar una petición por letra.
    let debounce;
    delegate(root, "input", '[data-filter="search"]', (event, input) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        filters.search = input.value.trim();
        reload();
      }, 280);
    });

    delegate(root, "click", "[data-category]", (event, chip) => {
      filters.category = chip.dataset.category;
      reload();
    });

    delegate(root, "click", '[data-action="clear-filters"]', () => {
      filters.search = "";
      filters.category = "";
      reload();
    });

    delegate(root, "click", '[data-action="create"]', () =>
      openProductModal({ product: null, categories, onSaved: reload }));

    delegate(root, "click", "[data-edit]", (event, button) =>
      openProductModal({ product: findProduct(button), categories, onSaved: reload }));

    delegate(root, "click", "[data-restock]", (event, button) =>
      openRestockModal({ product: findProduct(button), onSaved: reload }));

    delegate(root, "click", "[data-add]", async (event, button) => {
      const product = findProduct(button);

      try {
        const order = await withBusy(button, () => addProductToActiveOrder(product));
        if (!order) return;

        toast({
          title: "Añadido al pedido",
          text: `${product.name} · ${order.reference} · ${fmtMoney(order.totalAmount)}`,
          variant: "success"
        });

        reload();
      } catch (error) {
        // Duplicar una línea es una regla del dominio, no un fallo: se sugiere la alternativa.
        if (error instanceof ApiError && error.code === "duplicate_order_item") {
          toast({
            title: "Ya está en el pedido",
            text: "Ajusta la cantidad desde el detalle del pedido.",
            variant: "warning"
          });
          openOrderPanel(getState().activeOrderId, { onChange: reload });
          return;
        }

        toastError(error, "No se pudo añadir al pedido");
        reload();
      }
    });
  }
};
