# The edge image for the Raspberry Pi. It only copies: the Pi never runs a .NET build. scripts/deploy.sh pi
# stages the folder this file is built from:
#   app/     the published edge (dotnet publish -r linux-arm64 --self-contained false)
#   sites/   one folder per site key of contracts/sites.json (the Angular output, or the placeholders)
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY app/ /app/
COPY sites/ /app/sites/
# The app binds HTTP_PORT (the LAN listener) and TUNNEL_PORT (cloudflared's) itself; the image's own default only
# logs an override warning. Forwarded headers stay off: the edge decides the client address, never the framework.
ENV ASPNETCORE_HTTP_PORTS= ASPNETCORE_FORWARDEDHEADERS_ENABLED=false HTTP_PORT=8080 TUNNEL_PORT=8081 DOTNET_CLI_TELEMETRY_OPTOUT=1
# Never root.
USER $APP_UID
ENTRYPOINT ["dotnet", "/app/ActionJackson.Edge.dll"]
