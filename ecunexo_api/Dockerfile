# syntax=docker/dockerfile:1
# Build context = raíz del repo Ecunexo_cliente

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ecunexo_api/global.json ./ecunexo_api/
COPY ecunexo_api/Directory.Build.props ./ecunexo_api/
COPY ecunexo_api/Directory.Packages.props ./ecunexo_api/
COPY ecunexo_api/.editorconfig ./ecunexo_api/
COPY ecunexo_api/EcuNexo.slnx ./ecunexo_api/
COPY ecunexo_api/src/ ./ecunexo_api/src/

WORKDIR /src/ecunexo_api
RUN dotnet restore src/EcuNexo.Api/EcuNexo.Api.csproj
RUN dotnet publish src/EcuNexo.Api/EcuNexo.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
COPY --from=build /app/publish .
# Montar en runtime: /keys/license-public.pem (solo lectura)
RUN mkdir -p /keys && chmod 755 /keys
ENTRYPOINT ["dotnet", "EcuNexo.Api.dll"]
