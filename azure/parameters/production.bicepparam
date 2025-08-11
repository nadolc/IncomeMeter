// Production environment parameters for IncomeMeter
using '../bicep/main.bicep'

// Environment configuration
param environmentName = 'prod'
param location = 'UK South '
param namePrefix = 'incomemeter'

// Container configuration
param containerImage = 'ghcr.io/nadolc/incomemeter/incomemeter-api:latest'

// URLs configuration
param frontendBaseUrl = 'https://incomemeter-api-app-cbf9hubqdhcjh7e5.uksouth-01.azurewebsites.net'
param apiBaseUrl = 'https://incomemeter-api-app-cbf9hubqdhcjh7e5.uksouth-01.azurewebsites.net'
param allowedCorsOrigins = '["https://incomemeter-api-app-cbf9hubqdhcjh7e5.uksouth-01.azurewebsites.net"]'

// Secrets (will be provided via Azure CLI or GitHub Actions)
param mongoConnectionString = '' // Will be overridden
param googleClientId = '' // Will be overridden
param googleClientSecret = '' // Will be overridden
param jwtSecret = '' // Will be overridden
param openCageApiKey = '' // Optional - will be overridden if provided
param openRouteServiceApiKey = '' // Optional - will be overridden if provided