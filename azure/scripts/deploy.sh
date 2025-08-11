#!/bin/bash
# Bash deployment script for IncomeMeter Azure infrastructure

set -e  # Exit on any error

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    case $color in
        "red") echo -e "\033[31m$message\033[0m" ;;
        "green") echo -e "\033[32m$message\033[0m" ;;
        "yellow") echo -e "\033[33m$message\033[0m" ;;
        "cyan") echo -e "\033[36m$message\033[0m" ;;
        "white") echo -e "\033[37m$message\033[0m" ;;
        *) echo "$message" ;;
    esac
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -e, --environment ENVIRONMENT    Environment (development|staging|production)"
    echo "  -s, --subscription SUBSCRIPTION  Azure subscription ID"
    echo "  -r, --resource-group GROUP       Resource group name"
    echo "  -l, --location LOCATION         Azure region (default: East US)"
    echo "  -i, --image IMAGE               Container image URL"
    echo "  -m, --mongo-connection STRING   MongoDB connection string"
    echo "  -g, --google-client-id ID       Google OAuth client ID"
    echo "  -c, --google-client-secret SEC  Google OAuth client secret"
    echo "  -j, --jwt-secret SECRET         JWT signing secret"
    echo "  -o, --opencage-key KEY          OpenCage API key (optional)"
    echo "  -u, --ors-key KEY               OpenRouteService API key (optional)"
    echo "  -a, --appinsights-conn STRING   Application Insights connection string (optional)"
    echo "  -h, --help                      Show this help message"
}

# Parse command line arguments
ENVIRONMENT=""
SUBSCRIPTION_ID=""
RESOURCE_GROUP_NAME=""
LOCATION="East US"
CONTAINER_IMAGE=""
MONGO_CONNECTION_STRING=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
JWT_SECRET=""
OPENCAGE_API_KEY=""
OPENROUTESERVICE_API_KEY=""
APPLICATIONINSIGHTS_CONNECTION_STRING=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--subscription)
            SUBSCRIPTION_ID="$2"
            shift 2
            ;;
        -r|--resource-group)
            RESOURCE_GROUP_NAME="$2"
            shift 2
            ;;
        -l|--location)
            LOCATION="$2"
            shift 2
            ;;
        -i|--image)
            CONTAINER_IMAGE="$2"
            shift 2
            ;;
        -m|--mongo-connection)
            MONGO_CONNECTION_STRING="$2"
            shift 2
            ;;
        -g|--google-client-id)
            GOOGLE_CLIENT_ID="$2"
            shift 2
            ;;
        -c|--google-client-secret)
            GOOGLE_CLIENT_SECRET="$2"
            shift 2
            ;;
        -j|--jwt-secret)
            JWT_SECRET="$2"
            shift 2
            ;;
        -o|--opencage-key)
            OPENCAGE_API_KEY="$2"
            shift 2
            ;;
        -u|--ors-key)
            OPENROUTESERVICE_API_KEY="$2"
            shift 2
            ;;
        -a|--appinsights-conn)
            APPLICATIONINSIGHTS_CONNECTION_STRING="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$ENVIRONMENT" ]] || [[ -z "$SUBSCRIPTION_ID" ]] || [[ -z "$RESOURCE_GROUP_NAME" ]] || [[ -z "$CONTAINER_IMAGE" ]] || [[ -z "$MONGO_CONNECTION_STRING" ]] || [[ -z "$GOOGLE_CLIENT_ID" ]] || [[ -z "$GOOGLE_CLIENT_SECRET" ]] || [[ -z "$JWT_SECRET" ]]; then
    print_color "red" "Error: Missing required parameters"
    show_usage
    exit 1
fi

# Validate environment
if [[ "$ENVIRONMENT" != "development" ]] && [[ "$ENVIRONMENT" != "staging" ]] && [[ "$ENVIRONMENT" != "production" ]]; then
    print_color "red" "Error: Environment must be development, staging, or production"
    exit 1
fi

print_color "green" "Starting deployment of IncomeMeter to Azure..."
print_color "yellow" "Environment: $ENVIRONMENT"
print_color "yellow" "Subscription: $SUBSCRIPTION_ID"
print_color "yellow" "Resource Group: $RESOURCE_GROUP_NAME"
print_color "yellow" "Location: $LOCATION"

# Set Azure subscription
print_color "cyan" "Setting Azure subscription..."
az account set --subscription "$SUBSCRIPTION_ID"

# Create resource group if it doesn't exist
print_color "cyan" "Creating resource group if it doesn't exist..."
az group create --name "$RESOURCE_GROUP_NAME" --location "$LOCATION" --output none

# Prepare parameters
PARAMETERS_FILE="azure/parameters/$ENVIRONMENT.bicepparam"

if [[ ! -f "$PARAMETERS_FILE" ]]; then
    print_color "red" "Error: Parameters file not found: $PARAMETERS_FILE"
    exit 1
fi

# Build parameter overrides
PARAMETER_OVERRIDES=(
    "containerImage=$CONTAINER_IMAGE"
    "mongoConnectionString=$MONGO_CONNECTION_STRING"
    "googleClientId=$GOOGLE_CLIENT_ID"
    "googleClientSecret=$GOOGLE_CLIENT_SECRET"
    "jwtSecret=$JWT_SECRET"
)

if [[ -n "$OPENCAGE_API_KEY" ]]; then
    PARAMETER_OVERRIDES+=("openCageApiKey=$OPENCAGE_API_KEY")
fi

if [[ -n "$OPENROUTESERVICE_API_KEY" ]]; then
    PARAMETER_OVERRIDES+=("openRouteServiceApiKey=$OPENROUTESERVICE_API_KEY")
fi

if [[ -n "$APPLICATIONINSIGHTS_CONNECTION_STRING" ]]; then
    PARAMETER_OVERRIDES+=("applicationInsightsConnectionString=$APPLICATIONINSIGHTS_CONNECTION_STRING")
fi

# Deploy infrastructure
print_color "cyan" "Deploying Azure infrastructure using Bicep..."

DEPLOYMENT_NAME="incomemeter-$ENVIRONMENT-$(date +%Y%m%d-%H%M%S)"

# Build deployment command
DEPLOY_CMD="az deployment group create"
DEPLOY_CMD+=" --resource-group $RESOURCE_GROUP_NAME"
DEPLOY_CMD+=" --name $DEPLOYMENT_NAME"
DEPLOY_CMD+=" --template-file azure/bicep/main.bicep"
DEPLOY_CMD+=" --parameters @$PARAMETERS_FILE"

# Add parameter overrides
for param in "${PARAMETER_OVERRIDES[@]}"; do
    DEPLOY_CMD+=" --parameters $param"
done

DEPLOY_CMD+=" --output json"

print_color "yellow" "Executing deployment command..."

# Execute deployment and capture output
DEPLOYMENT_OUTPUT=$(eval $DEPLOY_CMD)

if [[ $? -ne 0 ]]; then
    print_color "red" "Deployment failed"
    exit 1
fi

# Parse deployment output
CONTAINER_APP_URL=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.containerAppUrl.value')
KEY_VAULT_NAME=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.keyVaultName.value')
CONTAINER_APP_NAME=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.containerAppName.value')

print_color "green" "Deployment completed successfully!"
print_color "green" "Container App URL: $CONTAINER_APP_URL"
print_color "green" "Key Vault Name: $KEY_VAULT_NAME"
print_color "green" "Container App Name: $CONTAINER_APP_NAME"

# Test health endpoint
print_color "cyan" "Testing application health..."
HEALTH_URL="$CONTAINER_APP_URL/api/diagnostics/health"

MAX_RETRIES=12
RETRY_COUNT=0
HEALTHY=false

while [[ $RETRY_COUNT -lt $MAX_RETRIES ]] && [[ "$HEALTHY" != "true" ]]; do
    if curl -f -s --max-time 30 "$HEALTH_URL" > /dev/null 2>&1; then
        HEALTHY=true
        print_color "green" "Application is healthy!"
    else
        ((RETRY_COUNT++))
        print_color "yellow" "Health check attempt $RETRY_COUNT/$MAX_RETRIES failed, waiting 30 seconds..."
        sleep 30
    fi
done

if [[ "$HEALTHY" != "true" ]]; then
    print_color "red" "Warning: Application health check failed after $MAX_RETRIES attempts"
    print_color "yellow" "Please check the application logs in Azure Container Apps"
fi

# Output deployment summary
print_color "green" ""
print_color "green" "=== DEPLOYMENT SUMMARY ==="
print_color "white" "Environment: $ENVIRONMENT"
print_color "white" "Application URL: $CONTAINER_APP_URL"
print_color "white" "Health Check URL: $HEALTH_URL"
print_color "white" "Resource Group: $RESOURCE_GROUP_NAME"
print_color "white" "Container App: $CONTAINER_APP_NAME"
print_color "white" "Key Vault: $KEY_VAULT_NAME"
print_color "green" "=========================="