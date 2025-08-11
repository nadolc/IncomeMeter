// Main Bicep template for IncomeMeter infrastructure
@description('The name of the environment (dev, staging, prod)')
param environmentName string

@description('The location for all resources')
param location string = resourceGroup().location

@description('The name prefix for all resources')
param namePrefix string = 'incomemeter'

@description('The container image to deploy')
param containerImage string

@description('The MongoDB connection string')
@secure()
param mongoConnectionString string

@description('Google OAuth client ID')
@secure()
param googleClientId string

@description('Google OAuth client secret')
@secure()
param googleClientSecret string

@description('JWT signing secret')
@secure()
param jwtSecret string

@description('OpenCage API key for geocoding')
@secure()
param openCageApiKey string = ''

@description('OpenRouteService API key')
@secure()
param openRouteServiceApiKey string = ''

@description('Application Insights connection string')
@secure()
param applicationInsightsConnectionString string = ''

@description('Frontend base URL')
param frontendBaseUrl string

@description('API base URL')
param apiBaseUrl string

@description('Allowed CORS origins (JSON array string)')
param allowedCorsOrigins string

var resourcePrefix = '${namePrefix}-${environmentName}'
var keyVaultName = '${resourcePrefix}-kv'
var containerAppName = '${resourcePrefix}-api'
var containerAppEnvName = '${resourcePrefix}-env'
var logAnalyticsWorkspaceName = '${resourcePrefix}-logs'
var applicationInsightsName = '${resourcePrefix}-ai'

// Log Analytics Workspace
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsWorkspaceName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: environmentName == 'prod' ? 90 : 30
    features: {
      searchVersion: 1
    }
  }
}

// Application Insights
resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// Key Vault for secrets management
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enabledForTemplateDeployment: true
    enablePurgeProtection: true
    softDeleteRetentionInDays: 90
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// Key Vault Secrets
resource mongoConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'MongoConnectionString'
  properties: {
    value: mongoConnectionString
    contentType: 'text/plain'
  }
}

resource googleClientIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'GoogleClientId'
  properties: {
    value: googleClientId
    contentType: 'text/plain'
  }
}

resource googleClientSecretSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'GoogleClientSecret'
  properties: {
    value: googleClientSecret
    contentType: 'text/plain'
  }
}

resource jwtSecretSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'JwtSecret'
  properties: {
    value: jwtSecret
    contentType: 'text/plain'
  }
}

resource openCageApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(openCageApiKey)) {
  parent: keyVault
  name: 'OpenCageApiKey'
  properties: {
    value: openCageApiKey
    contentType: 'text/plain'
  }
}

resource openRouteServiceApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(openRouteServiceApiKey)) {
  parent: keyVault
  name: 'OpenRouteServiceApiKey'
  properties: {
    value: openRouteServiceApiKey
    contentType: 'text/plain'
  }
}

// Container Apps Environment
resource containerAppEnvironment 'Microsoft.App/managedEnvironments@2023-11-02-preview' = {
  name: containerAppEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
    zoneRedundant: environmentName == 'prod'
  }
}

// Managed Identity for Container App
resource containerAppIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${containerAppName}-identity'
  location: location
}

// Key Vault Access Policy for Container App Identity
resource keyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, containerAppIdentity.id, 'Key Vault Secrets User')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: containerAppIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Container App
resource containerApp 'Microsoft.App/containerApps@2023-11-02-preview' = {
  name: containerAppName
  location: location
  dependsOn: [
    keyVaultRoleAssignment
  ]
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${containerAppIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        traffic: [
          {
            weight: 100
            latestRevision: true
          }
        ]
        corsPolicy: {
          allowedOrigins: json(allowedCorsOrigins)
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
          allowCredentials: true
        }
      }
      secrets: [
        {
          name: 'mongo-connection-string'
          keyVaultUrl: mongoConnectionStringSecret.properties.secretUri
          identity: containerAppIdentity.id
        }
        {
          name: 'google-client-id'
          keyVaultUrl: googleClientIdSecret.properties.secretUri
          identity: containerAppIdentity.id
        }
        {
          name: 'google-client-secret'
          keyVaultUrl: googleClientSecretSecret.properties.secretUri
          identity: containerAppIdentity.id
        }
        {
          name: 'jwt-secret'
          keyVaultUrl: jwtSecretSecret.properties.secretUri
          identity: containerAppIdentity.id
        }
        {
          name: 'opencage-api-key'
          keyVaultUrl: !empty(openCageApiKey) ? openCageApiKeySecret.properties.secretUri : ''
          identity: containerAppIdentity.id
        }
        {
          name: 'openrouteservice-api-key'
          keyVaultUrl: !empty(openRouteServiceApiKey) ? openRouteServiceApiKeySecret.properties.secretUri : ''
          identity: containerAppIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'incomemeter-api'
          image: containerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'ASPNETCORE_ENVIRONMENT'
              value: environmentName == 'prod' ? 'Production' : 'Staging'
            }
            {
              name: 'ASPNETCORE_URLS'
              value: 'http://+:8080'
            }
            {
              name: 'KeyVault__VaultUri'
              value: keyVault.properties.vaultUri
            }
            {
              name: 'Development__UseKeyVault'
              value: 'true'
            }
            {
              name: 'MongoConnectionString'
              secretRef: 'mongo-connection-string'
            }
            {
              name: 'GoogleClientId'
              secretRef: 'google-client-id'
            }
            {
              name: 'GoogleClientSecret'
              secretRef: 'google-client-secret'
            }
            {
              name: 'JwtSecret'
              secretRef: 'jwt-secret'
            }
            {
              name: 'OpenCageApiKey'
              secretRef: !empty(openCageApiKey) ? 'opencage-api-key' : ''
            }
            {
              name: 'OpenRouteServiceApiKey'
              secretRef: !empty(openRouteServiceApiKey) ? 'openrouteservice-api-key' : ''
            }
            {
              name: 'FrontendBaseUrl'
              value: frontendBaseUrl
            }
            {
              name: 'ApiBaseUrl'
              value: apiBaseUrl
            }
            {
              name: 'AllowedCorsOrigins'
              value: allowedCorsOrigins
            }
            {
              name: 'ApplicationInsightsConnectionString'
              value: !empty(applicationInsightsConnectionString) ? applicationInsightsConnectionString : applicationInsights.properties.ConnectionString
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/diagnostics/health'
                port: 8080
              }
              initialDelaySeconds: 30
              periodSeconds: 30
              timeoutSeconds: 10
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/diagnostics/health'
                port: 8080
              }
              initialDelaySeconds: 15
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: environmentName == 'prod' ? 2 : 1
        maxReplicas: environmentName == 'prod' ? 10 : 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}

// Outputs
output containerAppUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output keyVaultName string = keyVault.name
output containerAppName string = containerApp.name
output applicationInsightsConnectionString string = applicationInsights.properties.ConnectionString