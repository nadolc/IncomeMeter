// Production environment parameters for IncomeMeter
using '../bicep/main.bicep'

// Environment configuration
param environmentName = 'prod'
param location = 'East US'
param namePrefix = 'incomemeter'

// Container configuration
param containerImage = 'ghcr.io/your-username/incomemeter/incomemeter-api:latest'

// URLs configuration
param frontendBaseUrl = 'https://incomemeter.com'
param apiBaseUrl = 'https://api.incomemeter.com'
param allowedCorsOrigins = '["https://incomemeter.com","https://www.incomemeter.com"]'

// Secrets (will be provided via Azure CLI or GitHub Actions)
param mongoConnectionString = '' // Will be overridden
param googleClientId = '' // Will be overridden
param googleClientSecret = '' // Will be overridden
param jwtSecret = '' // Will be overridden
param openCageApiKey = '' // Optional - will be overridden if provided
param openRouteServiceApiKey = '' // Optional - will be overridden if provided