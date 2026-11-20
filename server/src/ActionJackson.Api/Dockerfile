# The API image. The build context is server/:
#   docker build -f src/ActionJackson.Api/Dockerfile server/

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
# Restore first, from the project files alone, so a source-only change reuses the package layer.
COPY global.json Directory.Build.props ./
COPY src/ActionJackson.Api/ActionJackson.Api.csproj src/ActionJackson.Api/
COPY src/ActionJackson.Data/ActionJackson.Data.csproj src/ActionJackson.Data/
COPY src/ActionJackson.Core/ActionJackson.Core.csproj src/ActionJackson.Core/
RUN dotnet restore src/ActionJackson.Api/ActionJackson.Api.csproj
COPY src ./src
RUN dotnet publish src/ActionJackson.Api/ActionJackson.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app ./
# The app binds HTTP_PORT itself (UseUrls); the image's own default only logs an override warning.
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 ASPNETCORE_HTTP_PORTS= HTTP_PORT=8080
# Never root.
USER $APP_UID
ENTRYPOINT ["dotnet", "/app/ActionJackson.Api.dll"]
