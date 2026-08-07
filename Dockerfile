FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080
ENV DOTNET_USE_POLLING_FILE_WATCHER=1

# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["NainOrder.Api/NainOrder.Api.csproj", "NainOrder.Api/"]
COPY ["NainOrder.Application/NainOrder.Application.csproj", "NainOrder.Application/"]
COPY ["NainOrder.Domain/NainOrder.Domain.csproj", "NainOrder.Domain/"]
COPY ["NainOrder.Infrastructure/NainOrder.Infrastructure.csproj", "NainOrder.Infrastructure/"]
RUN dotnet restore "NainOrder.Api/NainOrder.Api.csproj"
COPY . .
WORKDIR "/src/NainOrder.Api"
RUN dotnet build "NainOrder.Api.csproj" -c Release -o /app/build

# Publish stage
FROM build AS publish
RUN dotnet publish "NainOrder.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Final stage/image
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Para SQLite necesitamos un directorio con permisos de escritura
# Como en Render se ejecuta en /app y es efímero, funcionará bien por defecto
ENTRYPOINT ["dotnet", "NainOrder.Api.dll"]
