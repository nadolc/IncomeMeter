// Development environment parameters for IncomeMeter
using '../bicep/main.bicep'

// Environment configuration
param environmentName = 'dev'
param location = 'East US'
param namePrefix = 'incomemeter'

// Container configuration
param containerImage = 'ghcr.io/your-username/incomemeter/incomemeter-api:develop'

// URLs configuration
param frontendBaseUrl = 'https://incomemeter-dev.azurewebsites.net'
param apiBaseUrl = 'https://incomemeter-api-dev.azurewebsites.net/api'
param allowedCorsOrigins = '["https://incomemeter-dev.azurewebsites.net","http://localhost:3000","http://localhost:5173"]'

// Secrets (will be provided via Azure CLI or GitHub Actions)
// These parameters are marked as @secure() in the main template
// Values should be provided via:
// - Azure CLI: --parameters @parameters/development.bicepparam mongoConnectionString="..." 
// - GitHub Actions: Using secrets and environment variables
param mongoConnectionString = '' // Will be overridden
param googleClientId = '' // Will be overridden
param googleClientSecret = '' // Will be overridden
param jwtSecret = '' // Will be overridden
param openCageApiKey = '' // Optional - will be overridden if provided
param openRouteServiceApiKey = '' // Optional - will be overridden if provided