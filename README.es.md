<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/banner-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/banner-light.svg">
  <img alt="NainOrder" src="docs/assets/banner-dark.svg" width="100%">
</picture>

# NainOrder

**Vende un lanzamiento limitado (*drop*) a una multitud: exactamente N unidades, nunca sobrevendidas y sin inventario bloqueado en carritos abandonados.**

[![Language: English](https://img.shields.io/badge/Language-English-blue.svg)](README.md)
[![Versión en Español](https://img.shields.io/badge/Versión-Español-red.svg)](#)
[![ci](https://github.com/Nain9Dev/NainOrder/actions/workflows/ci.yml/badge.svg)](https://github.com/Nain9Dev/NainOrder/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Nain9Dev/NainOrder/actions/workflows/codeql.yml/badge.svg)](https://github.com/Nain9Dev/NainOrder/actions/workflows/codeql.yml)
![.NET 10](https://img.shields.io/badge/.NET-10-512BD4)
![Pruebas](https://img.shields.io/badge/tests-130%20.NET%20%2B%2029%20browser-2ea44f)
![Dependencias de cliente](https://img.shields.io/badge/client%20dependencies-0-22d3ee)
[![Demostración en vivo](https://img.shields.io/badge/live%20demo-order.naindev.com-8b5cf6)](https://order.naindev.com/)

<p align="center">
  <img src="docs/assets/drop-story.gif" alt="Animación: llega una multitud, cada unidad se reserva, las reservas no confirmadas vuelven al lote y todo se vende exactamente una vez" width="72%">
</p>

<p align="center">
  <img src="docs/assets/drop-live.png" alt="Vista de organizador de un lanzamiento en vivo: 48 unidades, 3 vendidas, 40 reservadas por 40 compradores simultáneos y 5 aún disponibles" width="92%">
</p>

> **48 unidades. 40 compradores liberados a la vez.** Cada unidad está *disponible*, *reservada temporalmente* por 30 segundos o *vendida*.
> Si se reserva pero no se confirma a tiempo: regresa a la multitud. Pruébalo como **comprador** o como **organizador**, en
> español o inglés: abre la aplicación y pulsa **Liberar 40 compradores**.

---

## Uso real: un lanzamiento pop-up en cinco minutos

El organizador inicia el lanzamiento en un portátil y proyecta un **código QR**. La audiencia lo escanea y accede a la página
de compra: un solo botón, una cuenta atrás y nada que instalar o registrar. Es instalable como PWA,
funciona en dispositivos móviles y notifica cuando no hay conexión.

<p align="center">
  <img src="docs/assets/phone-buyer.png" alt="Página de comprador en móvil: 47 unidades disponibles, un botón, reserva de 30 segundos" width="26%">
</p>

[Paso a paso, con el significado de cada garantía para el vendedor →](docs/case-study.md)

---

## El problema que resuelve

Los lanzamientos de edición limitada fallan habitualmente de la misma forma: una multitud masiva concurre en el mismo segundo y la tienda o bien **sobrevende** o bien **bloquea stock en carritos abandonados**. NainOrder es el motor determinista que previene ambos problemas.

```mermaid
flowchart LR
    A([Tomar unidad]) --> B[Reserva temporal<br/>30–3600 s]
    B -->|Confirmar a tiempo| C([Pedido pagado])
    B -->|Expiración de ventana| D([Unidad devuelta al drop])
    D -.-> A
```

| Garantía | Cómo se impone |
| :--- | :--- |
| Jamás hay más unidades reservadas + vendidas que el total del lote | Un único agregado con token de concurrencia optimista |
| Ningún comprador puede acaparar el lanzamiento | Límite estricto por comprador entre reservas y pedidos |
| Las reservas abandonadas se liberan solas | Expiración evaluada en cada lectura y barrido automático por segundo |
| Precisión monetaria exacta | Céntimos enteros en enteros sin coma flotante |

---

## Arquitectura en vivo

<p align="center">
  <img src="docs/assets/request-map.png" alt="Mapa de peticiones: trazabilidad entre Api, Application, Domain e Infrastructure con tiempos de servidor y base de datos" width="92%">
</p>

<p align="center">
  <img src="docs/assets/request-map-rejected.png" alt="El mismo mapa para una petición rechazada: el punto se detiene en Application, identificada por el servidor como la capa que rechazó" width="92%">
</p>

Cada petición del panel recorre las cuatro capas en pantalla de forma determinista: el servidor envía sus métricas (`Server-Timing`) y, en caso de rechazo, la **capa exacta que emitió el rechazo** (`layer` en la respuesta de error). Las reglas de dependencia se validan en tiempo de compilación con `NetArchTest`.

<details>
<summary>Las cuatro capas estáticas</summary>
<p align="center">
  <img src="docs/assets/architecture.svg" alt="Cuatro capas concéntricas: Api, Infrastructure, Application y Domain. Las dependencias apuntan hacia el interior." width="92%">
</p>
</details>

<p align="center">
  <img src="docs/assets/panel-race.png" alt="Carrera de stock: 24 compradores compiten por 5 unidades; 5 ganan, 19 son rechazados" width="46%">
  <img src="docs/assets/panel-dashboard.png" alt="Panel de control con ingresos, estados de pedidos y productos más vendidos" width="46%">
</p>

El panel está compuesto por módulos ES puros servidos directamente por la API: sin npm, sin paso de compilación y sin CORS. Incluye además un simulador de **carrera de stock** en concurrencia real y la gestión completa de pedidos.

---

## Verificación determinista

| Requisito verificado | Prueba |
| :--- | :--- |
| La multitud jamás reserva ni compra más unidades que el lote | `DropFlowTests` (40 compradores concurrentes), `DropTests` (property-based) |
| Las reservas expiran sin esperas artificiales en tests | `DropTests`, `DropFlowTests` con reloj inyectado |
| El stock nunca se sobrevende en carreras de alta concurrencia | `StockRaceTests`, `ConcurrencyTests` |
| Dos actualizaciones concurrentes sobre el mismo pedido nunca provocan pérdida de datos | `OrderAggregateConcurrencyProbe` |
| El dominio tiene cero dependencias externas | `CleanArchitectureTests` |
| El código QR enlaza al comprador, la shell funciona sin conexión y el diseño móvil encaja | `e2e/` — 29 pruebas de navegador (Playwright) sobre la app real |
| El mapa de peticiones muestra métricas reales medidas, nunca estimadas | `RequestObservabilityTests`: `Server-Timing` y la propiedad `layer` en rechazos |
| El contenedor Docker se compila y ejecuta correctamente | Workflow de CI compila la imagen y valida sondas de salud |

Trazabilidad completa en [`docs/50-traceability.md`](docs/50-traceability.md).

---

## Inicio rápido

```bash
git clone https://github.com/Nain9Dev/NainOrder.git
cd NainOrder/NainOrder.Api && dotnet run
```

Abre <http://localhost:8170> → **Probar como comprador** o **Probar como organizador**. Disponibles también: [`/swagger`](http://localhost:8170/swagger) y `/health`. No requiere instalar base de datos externa: SQLite se auto-inicializa en modo WAL.

```bash
dotnet test NainOrder.slnx -c Release          # 130 pruebas
cd e2e && npm ci && npx playwright test        # 29 pruebas de navegador Playwright
docker build -t nainorder . && docker run -p 8080:8080 nainorder
```

> **Sobre la demostración en vivo.** [order.naindev.com](https://order.naindev.com/) es una página estática, por lo que el panel funciona mediante un motor en el navegador para ilustrar la mecánica. Las garantías de concurrencia multinúcleo se ejecutan contra la API de .NET en local o contenedor.

---

## Documentación detallada

[Charter](docs/00-charter.md) · [Requisitos](docs/10-requirements.md) · [Arquitectura](docs/20-architecture.md) ·
[Modelo de datos](docs/21-data-model.md) · [9 ADRs](docs/30-decisions/) · [Modelo de amenazas](docs/22-threat-model.md) ·
[Matriz de trazabilidad](docs/50-traceability.md) · [OpenAPI](docs/openapi.json) · [Especificación de Drops](specs/002-drops/spec.md)

**Stack** — C# 13 · .NET 10 · ASP.NET Core · EF Core · SQLite (WAL) · xUnit · FsCheck · Módulos ES

---

*Por [Aitor Nain](https://www.naindev.com/) — arquitecto backend. Sistemas donde la integridad de los datos no es negociable.*
