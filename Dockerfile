# Multi-stage Dockerfile for IncomeMeter API
# Stage 1: Build .NET API
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build-backend
WORKDIR /src

# Copy solution and project files
COPY IncomeMeter.sln ./
COPY IncomeMeter.Api/IncomeMeter.Api.csproj ./IncomeMeter.Api/
COPY IncomeMeter.Web/IncomeMeter.Web.csproj ./IncomeMeter.Web/

# Restore dependencies
RUN dotnet restore IncomeMeter.sln

# Copy source code
COPY IncomeMeter.Api/ ./IncomeMeter.Api/
COPY IncomeMeter.Web/ ./IncomeMeter.Web/

# Build the API project
RUN dotnet publish IncomeMeter.Api/IncomeMeter.Api.csproj -c Release -o /app/api --no-restore

# Stage 2: Build React Frontend
FROM node:18-alpine AS build-frontend
WORKDIR /app

# Copy package files
COPY IncomeMeter.Api/frontend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy frontend source
COPY IncomeMeter.Api/frontend/ ./

# Set build-time environment variables for production
ENV VITE_API_BASE_URL=/api
ENV NODE_ENV=production

# Build the React app
RUN npm run build

# Stage 3: Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Install ca-certificates for HTTPS calls
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy API build output
COPY --from=build-backend /app/api ./

# Copy React build output to wwwroot for static file serving
COPY --from=build-frontend /app/dist ./wwwroot

# Create logs directory and set permissions
RUN mkdir -p /app/logs && chown -R appuser:appuser /app/logs

# Set ownership of app directory
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/diagnostics/health || exit 1

# Set environment variables
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_LOGGING__CONSOLE__DISABLECOLORS=true

# Start the application
ENTRYPOINT ["dotnet", "IncomeMeter.Api.dll"]