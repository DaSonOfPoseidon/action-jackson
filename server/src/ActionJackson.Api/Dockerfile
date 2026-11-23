# The API image. The build context is the repo root, because the Core project embeds contracts/
# (the option lists the Angular forms import too):
#   docker build -f server/src/ActionJackson.Api/Dockerfile .

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
# The layout of the repo is kept, so Core's ../../../contracts include finds /repo/contracts.
WORKDIR /repo/server
# Restore first, from the project files alone, so a source-only change reuses the package layer.
COPY server/global.json server/Directory.Build.props ./
COPY server/src/ActionJackson.Api/ActionJackson.Api.csproj src/ActionJackson.Api/
COPY server/src/ActionJackson.Data/ActionJackson.Data.csproj src/ActionJackson.Data/
COPY server/src/ActionJackson.Core/ActionJackson.Core.csproj src/ActionJackson.Core/
RUN dotnet restore src/ActionJackson.Api/ActionJackson.Api.csproj
COPY server/src ./src
COPY contracts /repo/contracts
RUN dotnet publish src/ActionJackson.Api/ActionJackson.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app ./
# The app binds HTTP_PORT itself (UseUrls); the image's own default only logs an override warning.
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 ASPNETCORE_HTTP_PORTS= HTTP_PORT=8080
# Never root.
USER $APP_UID
ENTRYPOINT ["dotnet", "/app/ActionJackson.Api.dll"]
