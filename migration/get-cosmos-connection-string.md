# How to Get Cosmos DB SQL API Connection String

## Azure Portal Method

### Step 1: Go to Azure Portal
1. Navigate to https://portal.azure.com
2. Find your Cosmos DB account: "incometer"

### Step 2: Get Connection String
1. Click on your Cosmos DB account
2. In the left menu, click **"Keys"**
3. Look for **"Primary Connection String"** or **"Secondary Connection String"**

### Expected Format
The SQL API connection string should look like:
```
AccountEndpoint=https://incometer.documents.azure.com:443/;AccountKey=your-long-account-key-here;
```

**NOT** like your current MongoDB format:
```
mongodb+srv://username:password@server.com/...
```

### Step 3: Update Migration Code
Replace the connection string in your migration:
```csharp
private static readonly string CosmosConnectionString = "AccountEndpoint=https://incometer.documents.azure.com:443/;AccountKey=your-actual-key-here;";
```

## Azure CLI Method

```bash
# List Cosmos DB accounts
az cosmosdb list --query "[].{Name:name, ResourceGroup:resourceGroup}"

# Get keys for your account
az cosmosdb keys list --name incometer --resource-group your-resource-group

# Get connection strings
az cosmosdb keys list --name incometer --resource-group your-resource-group --type connection-strings
```

## PowerShell Method

```powershell
# Get Cosmos DB account details
Get-AzCosmosDBAccount -ResourceGroupName "your-resource-group" -Name "incometer"

# Get connection strings
Get-AzCosmosDBAccountKey -ResourceGroupName "your-resource-group" -Name "incometer"
```

## Important Notes

1. **API Type**: Your current connection string suggests you're using **Cosmos DB for MongoDB API**
2. **Migration Options**:
   - **Option A**: Use the MongoDB API migration (recommended - simpler)
   - **Option B**: Get SQL API connection string and use original migration

## Which Should You Choose?

### Use MongoDB API Migration (Recommended)
- ✅ Your connection string is already MongoDB API
- ✅ No need to change connection strings
- ✅ Familiar MongoDB syntax
- ✅ Easier migration

### Use SQL API Migration
- ✅ More flexible querying
- ✅ Better integration with .NET Cosmos SDK
- ❌ Need different connection string
- ❌ More complex migration