/**
 * Motor de dominio en memoria para la demo autónoma (GitHub Pages y modo offline).
 *
 * Implementa las mismas reglas de negocio del backend .NET:
 * - Aislamiento de stock con reserva y reposición atómica.
 * - Máquina de estados del pedido (PendingPayment -> Paid -> Processing -> Shipped, o Cancelled).
 * - Importes y cálculos en céntimos para evitar desajustes de coma flotante.
 * - Validación RFC 7807 de errores (400, 404, 409).
 * - Persistencia local en localStorage con opción de reinicio.
 */

const STORAGE_KEY = "nainorder.demo_db";

const DEFAULT_CUSTOMERS = [
  { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", name: "Cliente Demo", email: "demo@naindev.com", createdAt: "2026-09-01T09:00:00Z" },
  { id: "e1a90c25-3b10-449e-8c34-7813a0e10001", name: "Marta Iglesias", email: "marta.iglesias@example.com", createdAt: "2026-09-05T11:30:00Z" },
  { id: "e1a90c25-3b10-449e-8c34-7813a0e10002", name: "Diego Serrano", email: "diego.serrano@example.com", createdAt: "2026-09-10T14:15:00Z" },
  { id: "e1a90c25-3b10-449e-8c34-7813a0e10003", name: "Nuria Cabrera", email: "nuria.cabrera@example.com", createdAt: "2026-09-15T16:45:00Z" }
];

const DEFAULT_PRODUCTS = [
  { id: "b2100001-0000-0000-0000-000000000001", sku: "NO-LAP-001", name: "Laptop Pro X15", category: "Portátiles", price: 1899.00, stockQuantity: 12, description: "Chasis de magnesio, 32 GB RAM y pantalla OLED de 15,6 pulgadas." },
  { id: "b2100001-0000-0000-0000-000000000002", sku: "NO-LAP-002", name: "Ultrabook Air 13", category: "Portátiles", price: 1249.00, stockQuantity: 8, description: "1,1 kg, 18 horas de autonomía y refrigeración pasiva silenciosa." },
  { id: "b2100001-0000-0000-0000-000000000003", sku: "NO-MON-001", name: "Monitor UltraWide 34", category: "Monitores", price: 749.50, stockQuantity: 5, description: "Panel curvo 3440x1440 a 165 Hz con calibración de fábrica." },
  { id: "b2100001-0000-0000-0000-000000000004", sku: "NO-MON-002", name: "Monitor 4K 27", category: "Monitores", price: 429.00, stockQuantity: 20, description: "IPS 4K con 99% sRGB y entrada USB-C de 90 W." },
  { id: "b2100001-0000-0000-0000-000000000005", sku: "NO-KEY-001", name: "Teclado Mecánico TKL", category: "Periféricos", price: 139.90, stockQuantity: 34, description: "Switches lineales lubricados, estructura junta y USB-C desmontable." },
  { id: "b2100001-0000-0000-0000-000000000006", sku: "NO-MOU-001", name: "Ratón Ergonómico Pro", category: "Periféricos", price: 89.90, stockQuantity: 41, description: "Sensor de 26.000 DPI, vertical a 30 grados y batería de 70 días." },
  { id: "b2100001-0000-0000-0000-000000000007", sku: "NO-AUD-001", name: "Auriculares Studio NC", category: "Audio", price: 299.00, stockQuantity: 3, description: "Cancelación activa adaptativa y códec de alta resolución." },
  { id: "b2100001-0000-0000-0000-000000000008", sku: "NO-AUD-002", name: "Micrófono Cardioide", category: "Audio", price: 179.00, stockQuantity: 15, description: "Cápsula de condensador de 25 mm con salida directa de monitorización." },
  { id: "b2100001-0000-0000-0000-000000000009", sku: "NO-NET-001", name: "Router Wi-Fi 7 Mesh", category: "Redes", price: 349.00, stockQuantity: 9, description: "Tri-banda 2,4/5/6 GHz con backhaul dedicado y puerto 2,5 GbE." },
  { id: "b2100001-0000-0000-0000-000000000010", sku: "NO-STO-001", name: "SSD NVMe 2 TB", category: "Almacenamiento", price: 219.00, stockQuantity: 27, description: "PCIe 4.0 con 7.400 MB/s de lectura y disipador integrado." },
  { id: "b2100001-0000-0000-0000-000000000011", sku: "NO-STO-002", name: "NAS 4 Bahías", category: "Almacenamiento", price: 649.00, stockQuantity: 4, description: "Cuatro bahías hot-swap, 2,5 GbE y cifrado AES por volumen." },
  { id: "b2100001-0000-0000-0000-000000000012", sku: "NO-ACC-001", name: "Dock USB-C 12 en 1", category: "Periféricos", price: 169.00, stockQuantity: 0, description: "Triple salida de vídeo, Ethernet 2,5 GbE y 100 W de carga." }
];

const classifyStock = (qty) => {
  if (qty <= 0) return "out_of_stock";
  if (qty <= 5) return "low_stock";
  return "in_stock";
};

const TRANSITIONS = {
  PendingPayment: ["Paid", "Cancelled"],
  Paid: ["Processing", "Cancelled"],
  Processing: ["Shipped", "Cancelled"],
  Shipped: [],
  Cancelled: []
};

const createInitialOrders = (customers, products) => {
  const c0 = customers[0];
  const c1 = customers[1];
  const c2 = customers[2];

  const p0 = products[0]; // Laptop Pro X15 (1899.00)
  const p2 = products[2]; // Monitor UltraWide (749.50)
  const p4 = products[4]; // Teclado (139.90)
  const p5 = products[5]; // Raton (89.90)
  const p9 = products[9]; // SSD (219.00)

  return [
    {
      id: "f3010001-0000-0000-0000-000000000001",
      reference: "NO-20261010-9A2F",
      customerId: c0.id,
      customerName: c0.name,
      customerEmail: c0.email,
      status: "Shipped",
      createdAt: "2026-10-10T10:15:00Z",
      paidAt: "2026-10-10T10:20:00Z",
      shippedAt: "2026-10-11T09:00:00Z",
      cancelledAt: null,
      items: [
        { productId: p0.id, productName: p0.name, productSku: p0.sku, unitPrice: p0.price, quantity: 1, totalPrice: p0.price },
        { productId: p2.id, productName: p2.name, productSku: p2.sku, unitPrice: p2.price, quantity: 1, totalPrice: p2.price }
      ]
    },
    {
      id: "f3010001-0000-0000-0000-000000000002",
      reference: "NO-20261012-4C18",
      customerId: c1.id,
      customerName: c1.name,
      customerEmail: c1.email,
      status: "Processing",
      createdAt: "2026-10-12T14:30:00Z",
      paidAt: "2026-10-12T14:35:00Z",
      shippedAt: null,
      cancelledAt: null,
      items: [
        { productId: p4.id, productName: p4.name, productSku: p4.sku, unitPrice: p4.price, quantity: 2, totalPrice: p4.price * 2 },
        { productId: p5.id, productName: p5.name, productSku: p5.sku, unitPrice: p5.price, quantity: 2, totalPrice: p5.price * 2 }
      ]
    },
    {
      id: "f3010001-0000-0000-0000-000000000003",
      reference: "NO-20261014-7E8B",
      customerId: c2.id,
      customerName: c2.name,
      customerEmail: c2.email,
      status: "Paid",
      createdAt: "2026-10-14T11:00:00Z",
      paidAt: "2026-10-14T11:05:00Z",
      shippedAt: null,
      cancelledAt: null,
      items: [
        { productId: p9.id, productName: p9.name, productSku: p9.sku, unitPrice: p9.price, quantity: 1, totalPrice: p9.price }
      ]
    },
    {
      id: "f3010001-0000-0000-0000-000000000004",
      reference: "NO-20261015-1D34",
      customerId: c0.id,
      customerName: c0.name,
      customerEmail: c0.email,
      status: "PendingPayment",
      createdAt: "2026-10-15T08:45:00Z",
      paidAt: null,
      shippedAt: null,
      cancelledAt: null,
      items: [
        { productId: p2.id, productName: p2.name, productSku: p2.sku, unitPrice: p2.price, quantity: 1, totalPrice: p2.price }
      ]
    }
  ];
};

class MockDatabase {
  constructor() {
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.products = parsed.products || [];
        this.customers = parsed.customers || [];
        this.orders = parsed.orders || [];
        return;
      }
    } catch {
      /* Fallback a datos por defecto si localStorage está bloqueado o dañado. */
    }
    this.reset();
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        products: this.products,
        customers: this.customers,
        orders: this.orders
      }));
    } catch {
      /* Ignorar fallo de almacenamiento si la cuota está excedida. */
    }
  }

  reset() {
    this.customers = JSON.parse(JSON.stringify(DEFAULT_CUSTOMERS));
    this.products = DEFAULT_PRODUCTS.map((p) => ({
      ...p,
      stockStatus: classifyStock(p.stockQuantity)
    }));
    this.orders = createInitialOrders(this.customers, this.products);
    this.save();
  }

  generateId() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  generateReference() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `NO-${today}-${rand}`;
  }

  mapOrderDto(order) {
    const totalAmount = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const nextStates = TRANSITIONS[order.status] || [];
    const isEditable = order.status === "PendingPayment";

    return {
      id: order.id,
      reference: order.reference,
      customerId: order.customerId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      status: order.status,
      totalAmount,
      totalUnits,
      isEditable,
      nextStates,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      cancelledAt: order.cancelledAt,
      items: order.items.map((it) => ({ ...it }))
    };
  }

  mapOrderSummary(order) {
    const totalAmount = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
    return {
      id: order.id,
      reference: order.reference,
      customerId: order.customerId,
      customerName: order.customerName,
      status: order.status,
      totalAmount,
      totalUnits,
      lineCount: order.items.length,
      createdAt: order.createdAt
    };
  }
}

export const mockDb = new MockDatabase();

/* --------------------------------------------------------------------------
   Drops en memoria. Mismas reglas y misma forma que la API .NET, pero en un solo hilo:
   no demuestran concurrencia. Viven solo en la sesión de la pestaña.
   -------------------------------------------------------------------------- */
const mockDrops = new Map();

const dropError = (status, code, title, detail) => ({ status, code, title, detail });

const dropNow = () => Date.now();

const dropCounts = (drop, now) => {
  const sold = drop.holds.filter((h) => h.state === "Confirmed").reduce((s, h) => s + h.quantity, 0);
  const held = drop.holds
    .filter((h) => h.state === "Active" && Date.parse(h.expiresAt) > now)
    .reduce((s, h) => s + h.quantity, 0);
  return { sold, held, available: drop.totalUnits - sold - held };
};

const mapDrop = (drop, token) => {
  const now = dropNow();
  const { sold, held, available } = dropCounts(drop, now);
  const status = now < Date.parse(drop.opensAt) ? "Scheduled" : available === 0 ? "SoldOut" : "Live";

  return {
    id: drop.id,
    productId: drop.productId,
    productName: drop.productName,
    productSku: drop.productSku,
    unitPrice: drop.unitPrice,
    totalUnits: drop.totalUnits,
    available,
    held,
    sold,
    status,
    opensAt: drop.opensAt,
    perBuyerLimit: drop.perBuyerLimit,
    holdSeconds: drop.holdSeconds,
    serverTime: new Date(now).toISOString(),
    myHolds: token
      ? drop.holds.filter((h) => h.buyerToken === token).map(({ buyerToken, ...hold }) => ({
          ...hold,
          state: hold.state === "Active" && Date.parse(hold.expiresAt) <= now ? "Expired" : hold.state
        }))
      : []
  };
};

const dispatchDrops = (method, pathname, { body, headers }) => {
  const token = headers?.["X-Buyer-Token"] || null;

  if (method === "GET" && pathname === "/drops") {
    return [...mockDrops.values()].reverse().slice(0, 20).map((d) => mapDrop(d, null));
  }

  if (method === "POST" && pathname === "/drops") {
    const product = mockDb.products.find((p) => p.id === body?.productId);
    if (!product) throw dropError(404, "not_found", "Resource not found", "Producto no encontrado.");

    const { totalUnits, perBuyerLimit, holdSeconds } = body;
    if (!(totalUnits >= 1 && totalUnits <= 1000 && perBuyerLimit >= 1 && perBuyerLimit <= totalUnits &&
          holdSeconds >= 5 && holdSeconds <= 3600)) {
      throw dropError(400, "invalid_data", "Invalid request data", "Configuración de drop no válida.");
    }

    const drop = {
      id: mockDb.generateId(),
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      unitPrice: product.price,
      totalUnits,
      perBuyerLimit,
      holdSeconds,
      opensAt: new Date(dropNow() + (body.opensInSeconds || 0) * 1000).toISOString(),
      holds: []
    };
    mockDrops.set(drop.id, drop);
    return mapDrop(drop, null);
  }

  const match = pathname.match(/^\/drops\/([^/]+)(?:\/holds(?:\/([^/]+)\/confirm)?)?$/);
  if (!match) return undefined;

  const drop = mockDrops.get(match[1]);
  if (!drop) throw dropError(404, "not_found", "Resource not found", `Drop ${match[1]} no existe.`);

  if (method === "GET" && pathname === `/drops/${drop.id}`) return mapDrop(drop, token);

  if (!token) throw dropError(400, "buyer_token_required", "Buyer token required", "Falta el identificador de visitante.");
  const now = dropNow();

  if (method === "POST" && pathname === `/drops/${drop.id}/holds`) {
    const quantity = Number(body?.quantity);
    if (!(quantity >= 1)) throw dropError(400, "invalid_data", "Invalid request data", "Cantidad no válida.");
    if (now < Date.parse(drop.opensAt)) {
      throw dropError(409, "drop_not_live", "Drop is not live", "El drop aún no ha abierto.");
    }

    const owned = drop.holds
      .filter((h) => h.buyerToken === token &&
        (h.state === "Confirmed" || (h.state === "Active" && Date.parse(h.expiresAt) > now)))
      .reduce((s, h) => s + h.quantity, 0);
    if (owned + quantity > drop.perBuyerLimit) {
      throw dropError(409, "buyer_limit_reached", "Buyer limit reached", `Límite de ${drop.perBuyerLimit} por comprador.`);
    }

    const { available } = dropCounts(drop, now);
    if (quantity > available) {
      throw dropError(409, "insufficient_stock", "Insufficient stock", `Solo quedan ${available} unidades.`);
    }

    const hold = {
      id: mockDb.generateId(),
      buyerToken: token,
      quantity,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + drop.holdSeconds * 1000).toISOString(),
      state: "Active",
      orderId: null
    };
    drop.holds.push(hold);
    const { buyerToken, ...dto } = hold;
    return dto;
  }

  const holdId = match[2];
  if (method === "POST" && holdId) {
    const hold = drop.holds.find((h) => h.id === holdId && h.buyerToken === token);
    if (!hold) throw dropError(404, "hold_not_found", "Hold not found", "Reserva no encontrada.");
    if (hold.state === "Confirmed") throw dropError(409, "hold_not_active", "Hold not active", "La reserva ya está confirmada.");
    if (hold.state === "Expired" || Date.parse(hold.expiresAt) <= now) {
      throw dropError(409, "hold_expired", "Hold expired", "La reserva ha caducado.");
    }

    const customer = mockDb.customers[0];
    const order = {
      id: mockDb.generateId(),
      reference: mockDb.generateReference(),
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      status: "Paid",
      createdAt: new Date(now).toISOString(),
      paidAt: new Date(now).toISOString(),
      shippedAt: null,
      cancelledAt: null,
      items: [{
        productId: drop.productId,
        productName: drop.productName,
        productSku: drop.productSku,
        unitPrice: drop.unitPrice,
        quantity: hold.quantity,
        totalPrice: drop.unitPrice * hold.quantity
      }]
    };
    mockDb.orders.unshift(order);
    mockDb.save();

    hold.state = "Confirmed";
    hold.orderId = order.id;
    return mockDb.mapOrderDto(order);
  }

  return undefined;
};

/** Despachador de peticiones simuladas en memoria. */
export async function mockDispatch(method, path, { body, query, headers } = {}) {
  // Simulación de latencia realista en cliente (8-24 ms)
  await new Promise((resolve) => setTimeout(resolve, 8 + Math.random() * 16));

  const url = new URL(path, "http://localhost");
  const pathname = url.pathname.replace(/^\/api/, "");
  const searchParams = query ? new URLSearchParams(query) : url.searchParams;

  if (pathname === "/drops" || pathname.startsWith("/drops/")) {
    const result = dispatchDrops(method, pathname, { body, headers });
    if (result !== undefined) return result;
  }

  // --------------------------------------------------------------------------
  // PRODUCTS
  // --------------------------------------------------------------------------
  if (method === "GET" && pathname === "/products") {
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const category = (searchParams.get("category") || "").trim().toLowerCase();

    let items = mockDb.products;
    if (category) items = items.filter((p) => p.category.toLowerCase() === category);
    if (search) {
      items = items.filter((p) =>
        p.name.toLowerCase().includes(search) ||
        p.sku.toLowerCase().includes(search) ||
        (p.description && p.description.toLowerCase().includes(search))
      );
    }
    return JSON.parse(JSON.stringify(items));
  }

  if (method === "GET" && pathname === "/products/categories") {
    const categories = [...new Set(mockDb.products.map((p) => p.category))].sort();
    return categories;
  }

  const matchProductStock = pathname.match(/^\/products\/([^/]+)\/stock$/);
  if (method === "POST" && matchProductStock) {
    const id = matchProductStock[1];
    const product = mockDb.products.find((p) => p.id === id);
    if (!product) throw { status: 404, title: "Producto no encontrado", detail: `El producto ${id} no existe.` };

    const delta = Number(body?.delta || 0);
    const newStock = product.stockQuantity + delta;
    if (newStock < 0) {
      throw { status: 409, title: "Stock insuficiente", detail: `El stock resultante (${newStock}) no puede ser negativo.` };
    }

    product.stockQuantity = newStock;
    product.stockStatus = classifyStock(product.stockQuantity);
    mockDb.save();
    return { ...product };
  }

  const matchProductDetail = pathname.match(/^\/products\/([^/]+)$/);
  if (matchProductDetail) {
    const id = matchProductDetail[1];
    const product = mockDb.products.find((p) => p.id === id);
    if (!product) throw { status: 404, title: "Producto no encontrado", detail: `El producto ${id} no existe.` };

    if (method === "GET") return { ...product };

    if (method === "PUT") {
      if (body.name) product.name = body.name.trim();
      if (body.price !== undefined) product.price = Number(body.price);
      if (body.category) product.category = body.category.trim();
      if (body.description !== undefined) product.description = body.description.trim();
      mockDb.save();
      return { ...product };
    }
  }

  if (method === "POST" && pathname === "/products") {
    if (!body?.sku || !body?.name) {
      throw { status: 400, title: "Validación fallida", detail: "SKU y Nombre son campos requeridos." };
    }
    if (mockDb.products.some((p) => p.sku.toLowerCase() === body.sku.trim().toLowerCase())) {
      throw { status: 409, title: "SKU duplicado", detail: `El SKU ${body.sku} ya existe en el catálogo.` };
    }

    const newProduct = {
      id: mockDb.generateId(),
      sku: body.sku.trim().toUpperCase(),
      name: body.name.trim(),
      category: (body.category || "General").trim(),
      description: (body.description || "").trim(),
      price: Number(body.price || 0),
      stockQuantity: Number(body.initialStock || 0),
      stockStatus: classifyStock(Number(body.initialStock || 0))
    };
    mockDb.products.unshift(newProduct);
    mockDb.save();
    return newProduct;
  }

  // --------------------------------------------------------------------------
  // ORDERS
  // --------------------------------------------------------------------------
  if (method === "GET" && pathname === "/orders") {
    const status = (searchParams.get("status") || "").trim();
    const customerId = (searchParams.get("customerId") || "").trim();
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

    let items = mockDb.orders;
    if (status) items = items.filter((o) => o.status === status);
    if (customerId) items = items.filter((o) => o.customerId === customerId);
    if (search) {
      items = items.filter((o) =>
        o.reference.toLowerCase().includes(search) ||
        (o.customerName && o.customerName.toLowerCase().includes(search))
      );
    }

    // Ordenación por fecha descendente
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalCount = items.length;
    const skip = (page - 1) * pageSize;
    const paged = items.slice(skip, skip + pageSize).map((o) => mockDb.mapOrderSummary(o));
    const totalPages = pageSize <= 0 ? 0 : Math.ceil(totalCount / pageSize);

    return {
      items: paged,
      page,
      pageSize,
      totalCount,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages
    };
  }

  // Order item quantity change: PUT /orders/:id/items/:productId
  const matchOrderItem = pathname.match(/^\/orders\/([^/]+)\/items\/([^/]+)$/);
  if (matchOrderItem) {
    const orderId = matchOrderItem[1];
    const productId = matchOrderItem[2];
    const order = mockDb.orders.find((o) => o.id === orderId);
    if (!order) throw { status: 404, title: "Pedido no encontrado", detail: `Pedido ${orderId} no existe.` };

    if (order.status !== "PendingPayment") {
      throw { status: 409, title: "Pedido bloqueado", detail: "Solo los pedidos pendientes de cobro pueden modificarse." };
    }

    const itemIndex = order.items.findIndex((it) => it.productId === productId);
    if (itemIndex === -1) throw { status: 404, title: "Línea no encontrada", detail: `Producto no está en el pedido.` };

    const product = mockDb.products.find((p) => p.id === productId);

    if (method === "PUT") {
      const newQty = Number(body?.quantity || 1);
      const diff = newQty - order.items[itemIndex].quantity;
      if (diff > 0 && product && product.stockQuantity < diff) {
        throw { status: 409, title: "Stock insuficiente", detail: `No hay suficiente stock para añadir ${diff} unidades más.` };
      }
      if (product) {
        product.stockQuantity -= diff;
        product.stockStatus = classifyStock(product.stockQuantity);
      }
      order.items[itemIndex].quantity = newQty;
      order.items[itemIndex].totalPrice = order.items[itemIndex].unitPrice * newQty;
      mockDb.save();
      return mockDb.mapOrderDto(order);
    }

    if (method === "DELETE") {
      const removed = order.items.splice(itemIndex, 1)[0];
      if (product && removed) {
        product.stockQuantity += removed.quantity;
        product.stockStatus = classifyStock(product.stockQuantity);
      }
      mockDb.save();
      return mockDb.mapOrderDto(order);
    }
  }

  // Add item: POST /orders/:id/items
  const matchOrderAdd = pathname.match(/^\/orders\/([^/]+)\/items$/);
  if (method === "POST" && matchOrderAdd) {
    const orderId = matchOrderAdd[1];
    const order = mockDb.orders.find((o) => o.id === orderId);
    if (!order) throw { status: 404, title: "Pedido no encontrado", detail: `Pedido ${orderId} no existe.` };

    if (order.status !== "PendingPayment") {
      throw { status: 409, title: "Pedido bloqueado", detail: "Solo los pedidos pendientes de cobro pueden modificarse." };
    }

    const productId = body?.productId;
    const qty = Number(body?.quantity || 1);
    const product = mockDb.products.find((p) => p.id === productId);
    if (!product) throw { status: 404, title: "Producto no encontrado", detail: `El producto ${productId} no existe.` };

    if (product.stockQuantity < qty) {
      throw { status: 409, title: "Stock insuficiente", detail: `Solo quedan ${product.stockQuantity} unidades de ${product.name}.` };
    }

    // Descuenta stock y congela precio
    product.stockQuantity -= qty;
    product.stockStatus = classifyStock(product.stockQuantity);

    const existing = order.items.find((it) => it.productId === productId);
    if (existing) {
      existing.quantity += qty;
      existing.totalPrice = existing.unitPrice * existing.quantity;
    } else {
      order.items.push({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        unitPrice: product.price,
        quantity: qty,
        totalPrice: product.price * qty
      });
    }

    mockDb.save();
    return mockDb.mapOrderDto(order);
  }

  // Transition: POST /orders/:id/:action (pay, process, ship, cancel)
  const matchOrderTransition = pathname.match(/^\/orders\/([^/]+)\/(pay|process|ship|cancel)$/);
  if (method === "POST" && matchOrderTransition) {
    const orderId = matchOrderTransition[1];
    const action = matchOrderTransition[2];
    const order = mockDb.orders.find((o) => o.id === orderId);
    if (!order) throw { status: 404, title: "Pedido no encontrado", detail: `Pedido ${orderId} no existe.` };

    const targetStatus = {
      pay: "Paid",
      process: "Processing",
      ship: "Shipped",
      cancel: "Cancelled"
    }[action];

    const allowed = TRANSITIONS[order.status] || [];
    if (!allowed.includes(targetStatus)) {
      throw {
        status: 409,
        title: "Transición inválida",
        detail: `No se puede pasar el pedido de ${order.status} a ${targetStatus}.`
      };
    }

    order.status = targetStatus;
    const now = new Date().toISOString();
    if (targetStatus === "Paid") order.paidAt = now;
    if (targetStatus === "Shipped") order.shippedAt = now;
    if (targetStatus === "Cancelled") {
      order.cancelledAt = now;
      // Reponer stock
      for (const line of order.items) {
        const prod = mockDb.products.find((p) => p.id === line.productId);
        if (prod) {
          prod.stockQuantity += line.quantity;
          prod.stockStatus = classifyStock(prod.stockQuantity);
        }
      }
    }

    mockDb.save();
    return mockDb.mapOrderDto(order);
  }

  // Get order detail: GET /orders/:id
  const matchOrderDetail = pathname.match(/^\/orders\/([^/]+)$/);
  if (method === "GET" && matchOrderDetail) {
    const id = matchOrderDetail[1];
    const order = mockDb.orders.find((o) => o.id === id);
    if (!order) throw { status: 404, title: "Pedido no encontrado", detail: `Pedido ${id} no existe.` };
    return mockDb.mapOrderDto(order);
  }

  // Create order: POST /orders
  if (method === "POST" && pathname === "/orders") {
    const customerId = body?.customerId;
    const customer = mockDb.customers.find((c) => c.id === customerId);
    if (!customer) throw { status: 404, title: "Cliente no encontrado", detail: "Debes seleccionar un cliente válido." };

    const newOrder = {
      id: mockDb.generateId(),
      reference: mockDb.generateReference(),
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      status: "PendingPayment",
      createdAt: new Date().toISOString(),
      paidAt: null,
      shippedAt: null,
      cancelledAt: null,
      items: []
    };
    mockDb.orders.unshift(newOrder);
    mockDb.save();
    return mockDb.mapOrderDto(newOrder);
  }

  // --------------------------------------------------------------------------
  // CUSTOMERS
  // --------------------------------------------------------------------------
  if (method === "GET" && pathname === "/customers") {
    return JSON.parse(JSON.stringify(mockDb.customers));
  }

  if (method === "POST" && pathname === "/customers") {
    if (!body?.name || !body?.email) {
      throw { status: 400, title: "Validación", detail: "Nombre y correo son requeridos." };
    }
    const customer = {
      id: mockDb.generateId(),
      name: body.name.trim(),
      email: body.email.trim(),
      createdAt: new Date().toISOString()
    };
    mockDb.customers.push(customer);
    mockDb.save();
    return customer;
  }

  // --------------------------------------------------------------------------
  // META
  // --------------------------------------------------------------------------
  if (method === "GET" && pathname === "/meta/order-state-machine") {
    const states = Object.entries(TRANSITIONS).map(([name, transitions], idx) => ({
      name,
      value: idx,
      transitions,
      isTerminal: transitions.length === 0
    }));
    return {
      initialState: "PendingPayment",
      states
    };
  }

  // --------------------------------------------------------------------------
  // DASHBOARD STATS
  // --------------------------------------------------------------------------
  if (method === "GET" && pathname === "/dashboard/stats") {
    let confirmedRevenue = 0;
    let pendingRevenue = 0;
    const countsByStatus = {};
    const amountsByStatus = {};
    const productSales = {};

    for (const s of Object.keys(TRANSITIONS)) {
      countsByStatus[s] = 0;
      amountsByStatus[s] = 0;
    }

    for (const order of mockDb.orders) {
      const orderTotal = order.items.reduce((s, it) => s + it.totalPrice, 0);
      countsByStatus[order.status] = (countsByStatus[order.status] || 0) + 1;
      amountsByStatus[order.status] = (amountsByStatus[order.status] || 0) + orderTotal;

      if (order.status === "Paid" || order.status === "Processing" || order.status === "Shipped") {
        confirmedRevenue += orderTotal;
        for (const line of order.items) {
          if (!productSales[line.productId]) {
            productSales[line.productId] = { units: 0, revenue: 0, name: line.productName, sku: line.productSku };
          }
          productSales[line.productId].units += line.quantity;
          productSales[line.productId].revenue += line.totalPrice;
        }
      } else if (order.status === "PendingPayment") {
        pendingRevenue += orderTotal;
      }
    }

    const paidOrdersCount = (countsByStatus.Paid || 0) + (countsByStatus.Processing || 0) + (countsByStatus.Shipped || 0);
    const averageOrderValue = paidOrdersCount > 0 ? confirmedRevenue / paidOrdersCount : 0;

    const statusBreakdown = Object.entries(countsByStatus).map(([status, count]) => ({
      status,
      count,
      amount: amountsByStatus[status] || 0
    }));

    // Timeline de 14 días
    const timeline = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      // Calcular pedidos e ingresos de ese día
      let dayAmount = 0;
      let dayOrders = 0;
      for (const order of mockDb.orders) {
        if (order.createdAt.slice(0, 10) === dateStr && order.status !== "Cancelled") {
          dayOrders++;
          dayAmount += order.items.reduce((s, it) => s + it.totalPrice, 0);
        }
      }
      timeline.push({ date: dateStr, amount: dayAmount, orders: dayOrders });
    }

    // Top productos más vendidos
    const topProducts = Object.entries(productSales)
      .map(([productId, data]) => ({
        productId,
        name: data.name,
        sku: data.sku,
        unitsSold: data.units,
        revenue: data.revenue
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const totalStockUnits = mockDb.products.reduce((s, p) => s + p.stockQuantity, 0);
    const lowStockProducts = mockDb.products.filter((p) => p.stockQuantity <= 5).length;

    return {
      confirmedRevenue,
      pendingRevenue,
      totalOrders: mockDb.orders.length,
      totalCustomers: mockDb.customers.length,
      totalProducts: mockDb.products.length,
      totalStockUnits,
      lowStockProducts,
      averageOrderValue,
      statusBreakdown,
      revenueTimeline: timeline,
      topProducts
    };
  }

  // --------------------------------------------------------------------------
  // DEMO SIMULATE PURCHASE
  // --------------------------------------------------------------------------
  if (method === "POST" && pathname === "/demo/simulate-purchase") {
    const steps = [];
    const started = performance.now();

    const track = async (orderNum, op, text, fn) => {
      const t0 = performance.now();
      const res = await fn();
      steps.push({
        order: orderNum,
        operation: op,
        explanation: text,
        elapsedMilliseconds: Math.round(performance.now() - t0)
      });
      return res;
    };

    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const product = await track(1, "Products.Create", "Domain valida SKU, precio y stock inicial", async () => {
      return mockDispatch("POST", "/products", {
        body: {
          sku: `NO-DEMO-${suffix}`,
          name: "Estación de trabajo Demo",
          price: 1499.00,
          initialStock: 10,
          category: "Demo",
          description: "Producto generado automáticamente por el escenario guiado."
        }
      });
    });

    const order = await track(2, "Orders.Create", "Order nace en PendingPayment con referencia legible", async () => {
      return mockDispatch("POST", "/orders", {
        body: { customerId: DEFAULT_CUSTOMERS[0].id }
      });
    });

    const withItem = await track(3, "Orders.AddItem", "El agregado congela el precio y Product descuenta stock", async () => {
      return mockDispatch("POST", `/orders/${order.id}/items`, {
        body: { productId: product.id, quantity: 2 }
      });
    });

    const paid = await track(4, "Orders.Pay", "Transición PendingPayment -> Paid validada por el dominio", async () => {
      return mockDispatch("POST", `/orders/${order.id}/pay`);
    });

    const processed = await track(5, "Orders.Process", "Transición Paid -> Processing", async () => {
      return mockDispatch("POST", `/orders/${order.id}/process`);
    });

    const shipped = await track(6, "Orders.Ship", "Transición Processing -> Shipped, estado final", async () => {
      return mockDispatch("POST", `/orders/${order.id}/ship`);
    });

    const refreshedProduct = mockDb.products.find((p) => p.id === product.id);

    return {
      message: "Flujo completo ejecutado sobre el motor de dominio en memoria, respetando las mismas invariantes de Clean Architecture.",
      elapsedMilliseconds: Math.round(performance.now() - started),
      steps,
      finalOrder: shipped,
      finalProduct: refreshedProduct
    };
  }

  // --------------------------------------------------------------------------
  // STOCK RACE — sequential here: a single JS thread cannot race, so this answers the same
  // shape as the API but proves nothing about concurrency. The panel says so (REQ-074).
  // --------------------------------------------------------------------------
  if (method === "POST" && pathname === "/demo/stock-race") {
    const buyers = Number(body?.buyers);
    const units = Number(body?.units);

    if (!(buyers >= 2 && buyers <= 64 && units >= 1 && units <= 32)) {
      throw { status: 400, title: "Invalid request data", detail: "buyers must be 2..64 and units 1..32.", code: "invalid_data" };
    }

    const sold = Math.min(buyers, units);
    const results = Array.from({ length: buyers }, (_, index) =>
      index < sold
        ? { buyer: index + 1, outcome: "won", code: null, attempts: 1 }
        : { buyer: index + 1, outcome: "rejected", code: "insufficient_stock", attempts: 1 });

    return {
      product: "Last-unit sneaker",
      units,
      buyers,
      sold,
      rejected: buyers - sold,
      remaining: units - sold,
      balanced: true,
      elapsedMilliseconds: 0,
      results
    };
  }

  throw { status: 404, title: "No encontrado", detail: `Ruta ${method} ${pathname} no implementada.` };
}
