# PowerShell deployment script for IncomeMeter Azure infrastructure
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("development", "staging", "production")]
    [string]$Environment,
    
    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId,
    
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "East US",
    
    [Parameter(Mandatory=$true)]
    [string]$ContainerImage,
    
    [Parameter(Mandatory=$true)]
    [string]$MongoConnectionString,
    
    [Parameter(Mandatory=$true)]
    [string]$GoogleClientId,
    
    [Parameter(Mandatory=$true)]
    [string]$GoogleClientSecret,
    
    [Parameter(Mandatory=$true)]
    [string]$JwtSecret,
    
    [Parameter(Mandatory=$false)]
    [string]$OpenCageApiKey = "",
    
    [Parameter(Mandatory=$false)]
    [string]$OpenRouteServiceApiKey = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ApplicationInsightsConnectionString = ""
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Function to write colored output
function Write-ColorOutput($ForegroundColor, $Message) {
    Write-Host $Message -ForegroundColor $ForegroundColor
}

try {
    Write-ColorOutput Green "Starting deployment of IncomeMeter to Azure..."
    Write-ColorOutput Yellow "Environment: $Environment"
    Write-ColorOutput Yellow "Subscription: $SubscriptionId"
    Write-ColorOutput Yellow "Resource Group: $ResourceGroupName"
    Write-ColorOutput Yellow "Location: $Location"

    # Set Azure subscription
    Write-ColorOutput Cyan "Setting Azure subscription..."
    az account set --subscription $SubscriptionId
    if ($LASTEXITCODE -ne 0) { throw "Failed to set subscription" }

    # Create resource group if it doesn't exist
    Write-ColorOutput Cyan "Creating resource group if it doesn't exist..."
    az group create --name $ResourceGroupName --location $Location --output none
    if ($LASTEXITCODE -ne 0) { throw "Failed to create resource group" }

    # Prepare parameters based on environment
    $parametersFile = "azure/parameters/$Environment.bicepparam"
    
    if (!(Test-Path $parametersFile)) {
        throw "Parameters file not found: $parametersFile"
    }

    # Build parameter overrides
    $parameterOverrides = @(
        "containerImage=$ContainerImage",
        "mongoConnectionString=$MongoConnectionString",
        "googleClientId=$GoogleClientId",
        "googleClientSecret=$GoogleClientSecret",
        "jwtSecret=$JwtSecret"
    )

    if ($OpenCageApiKey) {
        $parameterOverrides += "openCageApiKey=$OpenCageApiKey"
    }

    if ($OpenRouteServiceApiKey) {
        $parameterOverrides += "openRouteServiceApiKey=$OpenRouteServiceApiKey"
    }

    if ($ApplicationInsightsConnectionString) {
        $parameterOverrides += "applicationInsightsConnectionString=$ApplicationInsightsConnectionString"
    }

    # Deploy infrastructure
    Write-ColorOutput Cyan "Deploying Azure infrastructure using Bicep..."
    
    $deploymentName = "incomemeter-$Environment-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    
    $deployCommand = @(
        "az", "deployment", "group", "create",
        "--resource-group", $ResourceGroupName,
        "--name", $deploymentName,
        "--template-file", "azure/bicep/main.bicep",
        "--parameters", "@$parametersFile"
    )

    # Add parameter overrides
    foreach ($param in $parameterOverrides) {
        $deployCommand += "--parameters"
        $deployCommand += $param
    }

    $deployCommand += "--output"
    $deployCommand += "json"

    Write-ColorOutput Yellow "Executing deployment command..."
    $deploymentResult = & $deployCommand[0] $deployCommand[1..($deployCommand.Length-1)]
    
    if ($LASTEXITCODE -ne 0) {
        throw "Deployment failed with exit code $LASTEXITCODE"
    }

    # Parse deployment output
    $deploymentOutput = $deploymentResult | ConvertFrom-Json

    # Extract outputs
    $containerAppUrl = $deploymentOutput.properties.outputs.containerAppUrl.value
    $keyVaultName = $deploymentOutput.properties.outputs.keyVaultName.value
    $containerAppName = $deploymentOutput.properties.outputs.containerAppName.value

    Write-ColorOutput Green "Deployment completed successfully!"
    Write-ColorOutput Green "Container App URL: $containerAppUrl"
    Write-ColorOutput Green "Key Vault Name: $keyVaultName"
    Write-ColorOutput Green "Container App Name: $containerAppName"

    # Test health endpoint
    Write-ColorOutput Cyan "Testing application health..."
    $healthUrl = "$containerAppUrl/api/diagnostics/health"
    
    $maxRetries = 12
    $retryCount = 0
    $healthy = $false

    while ($retryCount -lt $maxRetries -and !$healthy) {
        try {
            $response = Invoke-WebRequest -Uri $healthUrl -Method GET -TimeoutSec 30
            if ($response.StatusCode -eq 200) {
                $healthy = $true
                Write-ColorOutput Green "Application is healthy!"
            }
        } catch {
            $retryCount++
            Write-ColorOutput Yellow "Health check attempt $retryCount/$maxRetries failed, waiting 30 seconds..."
            Start-Sleep -Seconds 30
        }
    }

    if (!$healthy) {
        Write-ColorOutput Red "Warning: Application health check failed after $maxRetries attempts"
        Write-ColorOutput Yellow "Please check the application logs in Azure Container Apps"
    }

    # Output deployment summary
    Write-ColorOutput Green "`n=== DEPLOYMENT SUMMARY ==="
    Write-ColorOutput White "Environment: $Environment"
    Write-ColorOutput White "Application URL: $containerAppUrl"
    Write-ColorOutput White "Health Check URL: $healthUrl"
    Write-ColorOutput White "Resource Group: $ResourceGroupName"
    Write-ColorOutput White "Container App: $containerAppName"
    Write-ColorOutput White "Key Vault: $keyVaultName"
    Write-ColorOutput Green "=========================="

} catch {
    Write-ColorOutput Red "Deployment failed: $($_.Exception.Message)"
    Write-ColorOutput Red "Error details: $($_.Exception.ToString())"
    exit 1
}