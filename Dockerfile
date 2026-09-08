# syntax=docker/dockerfile:1

# --- Imagen de ejecución -----------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

ENV ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_USE_POLLING_FILE_WATCHER=1 \
    ConnectionStrings__DefaultConnection="Data Source=/app/data/nainorder.db"

# El proceso corre sin privilegios, así que el directorio de datos debe existir y
# pertenecerle antes de cambiar de usuario: SQLite necesita escribir ahí.
RUN mkdir -p /app/data && chown -R $APP_UID:$APP_UID /app

# --- Compilación y publicación ----------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Los .csproj se copian primero para que la capa de restore se reutilice mientras
# no cambien las dependencias, aunque cambie el código.
COPY ["NainOrder.Api/NainOrder.Api.csproj", "NainOrder.Api/"]
COPY ["NainOrder.Application/NainOrder.Application.csproj", "NainOrder.Application/"]
COPY ["NainOrder.Domain/NainOrder.Domain.csproj", "NainOrder.Domain/"]
COPY ["NainOrder.Infrastructure/NainOrder.Infrastructure.csproj", "NainOrder.Infrastructure/"]
RUN dotnet restore "NainOrder.Api/NainOrder.Api.csproj"

COPY . .
RUN dotnet publish "NainOrder.Api/NainOrder.Api.csproj" \
    -c Release -o /app/publish --no-restore /p:UseAppHost=false

# --- Imagen final ------------------------------------------------------------
FROM base AS final
WORKDIR /app
COPY --from=build --chown=$APP_UID:$APP_UID /app/publish .

USER $APP_UID

ENTRYPOINT ["dotnet", "NainOrder.Api.dll"]
