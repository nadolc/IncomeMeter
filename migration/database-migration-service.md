# Azure Database Migration Service Setup

## Prerequisites
- Azure subscription
- Source MongoDB accessible from Azure
- Target Cosmos DB account created
- Database Migration Service instance

## Step 1: Create Migration Service
```bash
# Create resource group
az group create --name myMigrationRG --location "East US"

# Create Database Migration Service
az dms create \
  --resource-group myMigrationRG \
  --name myDMS \
  --location "East US" \
  --sku-name Standard_4vCores
```

## Step 2: Create Migration Project
```bash
az dms project create \
  --resource-group myMigrationRG \
  --service-name myDMS \
  --name MongoToCosmosProject \
  --source-platform MongoDB \
  --target-platform CosmosDB
```

## Step 3: Migration Configuration

### Source Configuration
```json
{
  "connectionString": "mongodb://username:password@server:port/database",
  "databases": [
    {
      "name": "sourceDatabase",
      "collections": [
        {
          "name": "users",
          "targetCollection": "users"
        },
        {
          "name": "routes", 
          "targetCollection": "routes"
        },
        {
          "name": "transactions",
          "targetCollection": "transactions"
        }
      ]
    }
  ]
}
```

### Target Configuration
```json
{
  "connectionString": "AccountEndpoint=https://your-account.documents.azure.com:443/;AccountKey=your-key;",
  "database": "targetDatabase",
  "throughputSettings": {
    "type": "Shared",
    "throughput": 1000
  },
  "collections": [
    {
      "name": "users",
      "partitionKey": {
        "path": "/id",
        "kind": "Hash"
      }
    },
    {
      "name": "routes",
      "partitionKey": {
        "path": "/userId",
        "kind": "Hash"
      }
    },
    {
      "name": "transactions",
      "partitionKey": {
        "path": "/userId",
        "kind": "Hash"
      }
    }
  ]
}
```

## Step 4: Start Migration Task
```bash
az dms task create \
  --resource-group myMigrationRG \
  --service-name myDMS \
  --project-name MongoToCosmosProject \
  --name MigrationTask \
  --source-connection-json source-config.json \
  --target-connection-json target-config.json \
  --database-options-json migration-options.json
```

## Migration Options
```json
{
  "replication": {
    "mode": "OneTime"
  },
  "validation": {
    "enabled": true,
    "consistencyCheck": true,
    "dataIntegrityCheck": true
  },
  "migrationSettings": {
    "boostRUs": 10000,
    "writeThrottleRatio": 0.8
  }
}
```