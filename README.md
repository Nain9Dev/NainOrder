# NainOrder - Motor E-Commerce 🛒

**NainOrder** es una API REST desarrollada en **.NET 10** que funciona como el core financiero y logístico para un sistema de comercio electrónico. 

Este proyecto nace con el objetivo de demostrar la aplicación práctica de **Clean Architecture**, el patrón **CQRS** (a nivel de servicios), y la separación estricta de responsabilidades entre el modelo de negocio y la infraestructura de base de datos.

---

## 🏗️ Arquitectura y Diseño

El código está estructurado para que el Dominio (la lógica pura) sea la única fuente de verdad, aislando completamente las dependencias externas (bases de datos, frameworks web, etc).

- **`NainOrder.Domain`**: Contiene las entidades principales (`Order`, `OrderItem`, `Product`, `Customer`). Aquí reside toda la validación y el encapsulamiento. Por ejemplo, el stock se comprueba y deduce directamente mediante métodos de negocio (`RemoveStock()`), y los estados de los pedidos (`PendingPayment`, `Paid`, `Shipped`) controlan qué acciones están permitidas.
- **`NainOrder.Application`**: Define los Casos de Uso (servicios orquestadores) y los **DTOs** (Data Transfer Objects). Evita que las entidades de base de datos se expongan directamente a la web.
- **`NainOrder.Infrastructure`**: Implementa el acceso a datos. Utiliza **Entity Framework Core** con **SQLite in-memory** y **Fluent API** para mantener el dominio completamente limpio de anotaciones SQL.
- **`NainOrder.Api`**: La capa de presentación REST. Provee los controladores y sirve la interfaz Swagger para probar los endpoints.

---

## 🚀 Cómo probar la Demo en Local

Para facilitar su revisión y testeo, la aplicación utiliza SQLite, por lo que **no necesitas instalar ningún servidor SQL** ni Docker para hacerla funcionar. El archivo `.db` se genera y autoconfigura al vuelo.

1. **Clona el repositorio**
   ```bash
   git clone https://github.com/Nain9Dev/NainOrder.git
   cd NainOrder
   ```

2. **Compila y ejecuta la API**
   ```bash
   cd NainOrder.Api
   dotnet run
   ```

3. **Interactúa con la API**
   Al ejecutar el comando, tu navegador debería abrirse automáticamente en `http://localhost:5283` (o la ruta que indique tu terminal). Verás la interfaz gráfica de **Swagger** desde la cual podrás:
   - Añadir productos al catálogo.
   - Crear un pedido para un cliente.
   - Añadir productos al pedido (verificando la reducción de stock).
   - Realizar el pago del pedido (transición de estados).

---

## 🛠️ Tecnologías Utilizadas

- **C# / .NET 10**
- **ASP.NET Core Web API**
- **Entity Framework Core (SQLite)**
- **Swagger / OpenAPI**
- **Clean Architecture & SOLID Principles**

---
*Desarrollado por [Aitor Nain](https://www.naindev.com/) | Desarrollador Backend .NET centrado en lógica de negocio y datos.*
