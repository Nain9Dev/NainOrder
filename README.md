# NainOrder

[![ci](https://github.com/Nain9Dev/NainOrder/actions/workflows/ci.yml/badge.svg)](https://github.com/Nain9Dev/NainOrder/actions/workflows/ci.yml)
![.NET 10](https://img.shields.io/badge/.NET-10-512BD4)
![Tests](https://img.shields.io/badge/tests-40%20verdes-2ea44f)
![Dependencias del cliente](https://img.shields.io/badge/dependencias%20del%20cliente-0-22d3ee)

Motor de pedidos para comercio electrónico construido en **.NET 10** con Clean Architecture,
DDD táctico y CQRS en el lado de lectura. Incluye un **panel de cliente propio** servido por
la misma aplicación, sin proceso de compilación ni dependencias de Node.

Un único `dotnet run` levanta la API, la documentación y la interfaz.

> El objetivo del repositorio no es que confíes en lo que afirma, sino que puedas comprobarlo:
> las reglas críticas están respaldadas por pruebas que las ejercitan, y cada decisión de diseño
> tiene su ADR con las alternativas que se descartaron y por qué.

---

## Compruébalo tú mismo

Ninguna de estas afirmaciones se sostiene sola. Cada una tiene detrás una prueba que puedes ejecutar:

| Afirmación | Cómo se demuestra |
| :--- | :--- |
| El stock no se puede sobrevender, ni siquiera con peticiones simultáneas | `ConcurrencyTests` lanza 16 reservas a la vez contra 6 unidades y comprueba que lo concedido más lo restante cuadra exactamente |
| El stock nunca queda negativo con ninguna secuencia de operaciones | `DomainInvariantProperties` genera cientos de casos por ejecución buscando el contraejemplo |
| Una reserva rechazada no toca el inventario | Los tests de error comparan el stock antes y después del rechazo |
| Cancelar un pedido devuelve cada unidad al catálogo | `Cancelling_an_order_puts_the_reserved_stock_back` |
| Un fallo de negocio es 4xx y uno técnico sigue siendo 500 | El contrato de error se comprueba en cada camino de fallo |
| El artefacto que se despliega funciona | CI construye la imagen y la interroga en marcha: arranque, panel, OpenAPI, 404 de API y usuario no root |

```bash
dotnet test NainOrder.slnx -c Release
```

La correspondencia completa entre cada requisito y la prueba que lo cubre está en
[`docs/50-traceability.md`](docs/50-traceability.md) — **incluidos los cinco huecos que aún no
están cubiertos**, declarados como tales en lugar de asignados a un test que no los demuestra.

---

## Qué resuelve

El dominio gobierna un ciclo de vida de pedido con reserva de inventario real:

```
PendingPayment ──▶ Paid ──▶ Processing ──▶ Shipped
      │             │            │
      └─────────────┴────────────┴──▶ Cancelled  (repone el stock reservado)
```

- Añadir una línea **reserva stock** en el mismo instante y dentro de la misma transacción.
- Cambiar la cantidad ajusta el inventario **por la diferencia exacta**, en ambos sentidos.
- Cancelar **devuelve al catálogo** todas las unidades reservadas.
- Un pedido cobrado **congela su cesta**; un pedido enviado es un estado final.

Las transiciones permitidas las publica el propio dominio en
`GET /api/meta/order-state-machine`, y el panel dibuja sus botones a partir de esa respuesta:
una regla nueva en el dominio se refleja en la interfaz sin tocar el front.

---

## Arquitectura

Cuatro proyectos con las dependencias apuntando siempre hacia dentro:

| Proyecto | Responsabilidad | Depende de |
|---|---|---|
| `NainOrder.Domain` | Entidades, invariantes y máquina de estados | *nada* |
| `NainOrder.Application` | Casos de uso, DTOs, contratos de persistencia | Domain |
| `NainOrder.Infrastructure` | EF Core, SQLite, Fluent API, consultas de lectura | Application, Domain |
| `NainOrder.Api` | Controladores REST, contrato de errores, panel web | Application, Infrastructure |

`NainOrder.Domain` no referencia ningún paquete: ni EF Core, ni ASP.NET, ni inyección de
dependencias. Esa restricción es lo que mantiene el modelo de negocio verificable de forma
aislada, y es la que comprueban los tests de dominio.

### Decisiones que merecen explicación

**El dinero se persiste en céntimos enteros.** SQLite no tiene tipo `decimal`: EF Core lo
almacenaría como texto, con lo que `ORDER BY` y `SUM` operarían sobre cadenas y devolverían
resultados incorrectos. Un `ValueConverter` a `INTEGER` hace exactas la ordenación y la
agregación, y elimina el error de coma flotante en el redondeo de importes.

**Concurrencia optimista sobre el stock.** `Product` lleva un token de versión declarado como
`IsConcurrencyToken()`. Si dos peticiones simultáneas intentan reservar la última unidad, la
segunda falla en el `UPDATE` y recibe un `409`, en lugar de sobrevender.

**Unidad de trabajo explícita.** Los repositorios ya no confirman por su cuenta. Añadir una
línea toca dos agregados —pedido y producto— y ambos se persisten dentro de la misma
transacción, o ninguno.

**Los totales del pedido se materializan.** Se recalculan en cada cambio de la cesta en lugar
de derivarse al leer, de modo que listados y métricas agregan en base de datos sin cargar las
líneas de cada pedido.

**Errores como contrato, no como texto.** Un único `IExceptionHandler` traduce cada excepción
a `ProblemDetails` (RFC 7807) con un código estable y legible por máquina. Un fallo de negocio
es `4xx`; un fallo técnico sigue siendo `500` y queda registrado con su traza.

```jsonc
// POST /api/orders/{id}/items  ->  409 Conflict
{
  "type": "https://httpstatuses.io/409",
  "title": "Insufficient stock",
  "status": 409,
  "detail": "Insufficient stock: 99 requested but only 3 available.",
  "code": "insufficient_stock",
  "requested": 99,
  "available": 3,
  "traceId": "0HNO2OBO3BIE3:00000001"
}
```

---

## El panel de cliente

Vive en `NainOrder.Api/wwwroot` y se sirve desde el mismo origen que la API: sin CORS, sin
`npm install` y sin paso de compilación en el despliegue. Está escrito con módulos ES nativos
y CSS con variables, sin ninguna librería de terceros.

- **Panel** — ingresos confirmados y pendientes, serie temporal, distribución por estado y
  ranking de productos, todo agregado en base de datos.
- **Catálogo** — alta y edición de referencias, ajuste de stock y añadido al pedido en curso.
- **Pedidos** — listado paginado con filtros de servidor y panel de detalle con el ciclo de
  vida, la cesta editable y las transiciones que el dominio permite en ese momento.
- **Arquitectura** — las capas, la máquina de estados leída de la API y una **consola con la
  traza en vivo** de cada petición que hace la interfaz, con su latencia real.

Tema claro y oscuro, diseño adaptable, paleta de comandos (`Ctrl` + `K`), navegación por
teclado, contraste AA y respeto por `prefers-reduced-motion`.

---

## Puesta en marcha

No hace falta instalar ningún servidor de base de datos: SQLite genera el fichero al arrancar
y la aplicación aplica migraciones y siembra el catálogo de demostración por sí sola.

```bash
git clone https://github.com/Nain9Dev/NainOrder.git
cd NainOrder/NainOrder.Api
dotnet run
```

| Ruta | Contenido |
|---|---|
| `/` | Panel de cliente |
| `/swagger` | Documentación interactiva de la API |
| `/health` | Comprobación de estado |

### Tests

```bash
dotnet test
```

37 pruebas repartidas en tres niveles:

- **Ejemplo** — la máquina de estados, incluidas todas las transiciones que debe impedir.
- **Propiedad** (FsCheck) — las invariantes aritméticas se comprueban contra cientos de casos
  generados: el stock nunca queda negativo, una reserva rechazada no altera el inventario y el
  total del pedido siempre coincide con la suma de sus líneas.
- **Integración** — la aplicación real, con sus migraciones y su middleware, atacada por HTTP:
  flujo completo de compra, caminos de error y entrega del panel y de Swagger.

### Contenedor

```bash
docker build -t nainorder . && docker run -p 8080:8080 nainorder
```

La imagen se ejecuta con un usuario sin privilegios y escribe la base de datos en `/app/data`.

---

## API

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/products` | Catálogo, con filtro por texto y categoría |
| `POST` | `/api/products` | Alta de producto (SKU único) |
| `PUT` | `/api/products/{id}` | Actualiza nombre, precio, categoría y descripción |
| `POST` | `/api/products/{id}/stock` | Ajusta el stock por un delta con signo |
| `GET` | `/api/orders` | Listado paginado con filtros de estado, cliente y referencia |
| `POST` | `/api/orders` | Abre un pedido en `PendingPayment` |
| `POST` | `/api/orders/{id}/items` | Añade línea y reserva stock |
| `PUT` | `/api/orders/{id}/items/{productId}` | Cambia la cantidad ajustando el inventario |
| `DELETE` | `/api/orders/{id}/items/{productId}` | Quita la línea y repone stock |
| `POST` | `/api/orders/{id}/{pay\|process\|ship\|cancel}` | Transiciones de estado |
| `GET` | `/api/dashboard/stats` | Métricas agregadas del negocio |
| `GET` | `/api/meta/order-state-machine` | Máquina de estados publicada por el dominio |
| `POST` | `/api/demo/simulate-purchase` | Escenario guiado con traza paso a paso |

La API pública está limitada a 120 peticiones por minuto y dirección IP.

---

## Documentación

El repositorio sigue un flujo dirigido por especificación. La verdad estable del producto vive en
[`docs/`](docs/README.md):

| Documento | Contenido |
|---|---|
| [`00-charter.md`](docs/00-charter.md) | Objetivo, alcance y **no-objetivos** (lo que falta, falta a propósito) |
| [`10-requirements.md`](docs/10-requirements.md) | Requisitos `REQ-###` en notación EARS |
| [`20-architecture.md`](docs/20-architecture.md) | Capas y recorrido de una petición, con diagramas Mermaid |
| [`21-data-model.md`](docs/21-data-model.md) | Entidades, invariantes y restricciones del motor |
| [`30-decisions/`](docs/30-decisions/) | Seis ADR con las alternativas descartadas y su porqué |
| [`50-traceability.md`](docs/50-traceability.md) | Cada requisito y la prueba que lo demuestra |
| [`60-runbook.md`](docs/60-runbook.md) | Arranque, configuración, límites conocidos y recuperación |

Las decisiones que más condicionan el diseño:

- **[ADR-0001](docs/30-decisions/ADR-0001-money-as-integer-cents.md)** — el dinero se guarda en
  céntimos enteros: SQLite no tiene `decimal` y ordenar o sumar sobre texto daba resultados falsos.
- **[ADR-0002](docs/30-decisions/ADR-0002-optimistic-concurrency-on-stock.md)** — concurrencia
  optimista sobre el stock, para que dos peticiones no puedan vender la misma unidad.
- **[ADR-0003](docs/30-decisions/ADR-0003-unit-of-work-owns-the-transaction.md)** — la frontera
  transaccional pertenece al caso de uso, no al repositorio.

---

## Stack

C# / .NET 10 · ASP.NET Core · Entity Framework Core (SQLite) · Swagger/OpenAPI ·
xUnit · FsCheck · JavaScript (módulos ES) · CSS con variables

---

*Desarrollado por [Aitor Nain](https://www.naindev.com/) — Arquitecto backend .NET. Diseño
infraestructura determinista donde la integridad del dato no es negociable.*
