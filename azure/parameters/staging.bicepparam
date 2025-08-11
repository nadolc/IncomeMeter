// Staging environment parameters for IncomeMeter
using '../bicep/main.bicep'

// Environment configuration
param environmentName = 'staging'
param location = 'East US'
param namePrefix = 'incomemeter'

// Container configuration
param containerImage = 'ghcr.io/your-username/incomemeter/incomemeter-api:main'

// URLs configuration
param frontendBaseUrl = 'https://incomemeter-staging.azurewebsites.net'
param apiBaseUrl = 'https://incomemeter-api-staging.azurewebsites.net/api'
param allowedCorsOrigins = '["https://incomemeter-staging.azurewebsites.net"]'

// Secrets (will be provided via Azure CLI or GitHub Actions)
param mongoConnectionString = '' // Will be overridden
param googleClientId = '' // Will be overridden
param googleClientSecret = '' // Will be overridden
param jwtSecret = '' // Will be overridden
param openCageApiKey = '' // Optional - will be overridden if provided
param openRouteServiceApiKey = '' // Optional - will be overridden if provided