# Azure Data Factory Migration Setup

## Prerequisites
- Azure subscription with Data Factory service
- Source MongoDB connection details
- Target Cosmos DB account created

## Step 1: Create Data Factory
```bash
az datafactory create \
  --resource-group myResourceGroup \
  --name myDataFactory \
  --location "East US"
```

## Step 2: Create Linked Services

### MongoDB Source
```json
{
  "name": "MongoDBLinkedService",
  "type": "Microsoft.DataFactory/factories/linkedservices",
  "properties": {
    "type": "MongoDb",
    "typeProperties": {
      "server": "your-mongodb-server.com",
      "port": 27017,
      "databaseName": "your-database",
      "authenticationType": "Basic",
      "username": "your-username",
      "password": {
        "type": "SecureString",
        "value": "your-password"
      }
    }
  }
}
```

### Cosmos DB Target
```json
{
  "name": "CosmosDBLinkedService",
  "type": "Microsoft.DataFactory/factories/linkedservices",
  "properties": {
    "type": "CosmosDb",
    "typeProperties": {
      "connectionString": "AccountEndpoint=https://your-cosmos.documents.azure.com:443/;AccountKey=your-key;Database=your-db"
    }
  }
}
```

## Step 3: Create Datasets

### Source Dataset (MongoDB)
```json
{
  "name": "MongoDBDataset",
  "properties": {
    "type": "MongoDbCollection",
    "linkedServiceName": {
      "referenceName": "MongoDBLinkedService",
      "type": "LinkedServiceReference"
    },
    "typeProperties": {
      "collectionName": "your-collection"
    }
  }
}
```

### Target Dataset (Cosmos DB)
```json
{
  "name": "CosmosDBDataset",
  "properties": {
    "type": "CosmosDbSqlApiCollection",
    "linkedServiceName": {
      "referenceName": "CosmosDBLinkedService",
      "type": "LinkedServiceReference"
    },
    "typeProperties": {
      "collectionName": "your-collection"
    }
  }
}
```

## Step 4: Create Pipeline
```json
{
  "name": "MongoToCosmosPipeline",
  "properties": {
    "activities": [
      {
        "name": "CopyData",
        "type": "Copy",
        "inputs": [
          {
            "referenceName": "MongoDBDataset",
            "type": "DatasetReference"
          }
        ],
        "outputs": [
          {
            "referenceName": "CosmosDBDataset",
            "type": "DatasetReference"
          }
        ],
        "typeProperties": {
          "source": {
            "type": "MongoDbSource"
          },
          "sink": {
            "type": "CosmosDbSqlApiSink",
            "writeBehavior": "upsert"
          }
        }
      }
    ]
  }
}
```