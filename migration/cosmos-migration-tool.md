# Azure Cosmos DB Data Migration Tool

## Download and Setup
1. Download from: https://github.com/azure/azure-documentdb-datamigrationtool
2. Extract to local directory
3. Run `dtui.exe` for GUI or `dt.exe` for command line

## GUI Migration Steps

### Step 1: Source Information
- **Source Type**: MongoDB
- **Connection String**: `mongodb://username:password@server:port/database`
- **Collection**: `your-collection-name`
- **Query**: `{}` (empty for all documents)

### Step 2: Target Information
- **Target Type**: DocumentDB - Sequential record import
- **Connection String**: Your Cosmos DB connection string
- **Database**: Target database name
- **Collection**: Target collection name
- **Partition Key**: `/id` or your chosen partition key

### Step 3: Advanced Options
- **Number of parallel requests**: 100
- **Batch Size**: 1000
- **Max Script Size**: 512KB

## Command Line Migration
```bash
dt.exe /s:MongoDB 
/s.ConnectionString:"mongodb://username:password@server:port/database" 
/s.Collection:your-collection 
/t:DocumentDB 
/t.ConnectionString:"AccountEndpoint=https://your-account.documents.azure.com:443/;AccountKey=your-key;Database=your-db" 
/t.Collection:your-collection 
/t.PartitionKey:/id
```

## Bulk Migration Example
```bash
# Multiple collections
dt.exe /s:MongoDB 
/s.ConnectionString:"mongodb://server:27017/sourcedb" 
/s.Collection:users,orders,products 
/t:DocumentDB 
/t.ConnectionString:"AccountEndpoint=https://myaccount.documents.azure.com:443/;AccountKey=mykey;Database=targetdb" 
/t.Collection:users,orders,products 
/t.PartitionKey:/id 
/t.CollectionThroughput:1000
```