# MongoDB to Cosmos DB Migration Script
param(
    [Parameter(Mandatory=$true)]
    [string]$MongoConnectionString,
    
    [Parameter(Mandatory=$true)]
    [string]$CosmosConnectionString,
    
    [Parameter(Mandatory=$true)]
    [string]$SourceDatabase,
    
    [Parameter(Mandatory=$true)]
    [string]$TargetDatabase
)

# Install required modules if not already installed
if (!(Get-Module -ListAvailable -Name "CosmosDB")) {
    Install-Module -Name CosmosDB -Force -Scope CurrentUser
}

# Connect to Cosmos DB
$cosmosDbContext = New-CosmosDbContext -ConnectionString $CosmosConnectionString

# Function to migrate a collection
function Migrate-Collection {
    param(
        [string]$CollectionName,
        [string]$PartitionKey,
        [int]$Throughput = 400
    )
    
    Write-Host "Starting migration of collection: $CollectionName"
    
    # Export from MongoDB to JSON
    $exportPath = ".\temp_$CollectionName.json"
    $mongoExportCmd = "mongoexport --uri `"$MongoConnectionString/$SourceDatabase`" --collection $CollectionName --out `"$exportPath`""
    Invoke-Expression $mongoExportCmd
    
    if (!(Test-Path $exportPath)) {
        Write-Error "Failed to export collection $CollectionName"
        return
    }
    
    # Create Cosmos DB collection
    try {
        New-CosmosDbCollection -Context $cosmosDbContext -Database $TargetDatabase -Id $CollectionName -PartitionKey $PartitionKey -OfferThroughput $Throughput -ErrorAction SilentlyContinue
        Write-Host "Created collection: $CollectionName"
    }
    catch {
        Write-Host "Collection $CollectionName already exists or creation failed: $_"
    }
    
    # Import to Cosmos DB
    $documents = Get-Content $exportPath | ConvertFrom-Json
    $totalDocs = $documents.Count
    $processed = 0
    
    foreach ($document in $documents) {
        try {
            # Convert MongoDB _id to Cosmos DB id
            if ($document._id -and $document._id.'$oid') {
                $document | Add-Member -MemberType NoteProperty -Name "id" -Value $document._id.'$oid' -Force
                $document.PSObject.Properties.Remove('_id')
            }
            elseif ($document._id) {
                $document | Add-Member -MemberType NoteProperty -Name "id" -Value $document._id -Force
                $document.PSObject.Properties.Remove('_id')
            }
            
            # Get partition key value
            $partitionKeyValue = $document.($PartitionKey.TrimStart('/'))
            if (!$partitionKeyValue) {
                $partitionKeyValue = "default"
            }
            
            # Insert document
            New-CosmosDbDocument -Context $cosmosDbContext -Database $TargetDatabase -CollectionId $CollectionName -DocumentBody ($document | ConvertTo-Json -Depth 100) -PartitionKey $partitionKeyValue
            
            $processed++
            if ($processed % 100 -eq 0) {
                Write-Host "Progress: $processed/$totalDocs ($(($processed/$totalDocs*100).ToString('F1'))%)"
            }
        }
        catch {
            Write-Warning "Failed to insert document: $_"
        }
    }
    
    # Cleanup temp file
    Remove-Item $exportPath -Force
    Write-Host "Completed migration of collection: $CollectionName ($processed/$totalDocs documents)"
}

# Migration configuration
$collections = @(
    @{ Name = "users"; PartitionKey = "/id"; Throughput = 400 },
    @{ Name = "routes"; PartitionKey = "/userId"; Throughput = 400 },
    @{ Name = "transactions"; PartitionKey = "/userId"; Throughput = 400 }
)

# Create target database
try {
    New-CosmosDbDatabase -Context $cosmosDbContext -Id $TargetDatabase -ErrorAction SilentlyContinue
    Write-Host "Created database: $TargetDatabase"
}
catch {
    Write-Host "Database $TargetDatabase already exists: $_"
}

# Migrate each collection
foreach ($collection in $collections) {
    Migrate-Collection -CollectionName $collection.Name -PartitionKey $collection.PartitionKey -Throughput $collection.Throughput
}

Write-Host "Migration completed!"

# Usage example:
# .\migration-script.ps1 -MongoConnectionString "mongodb://user:pass@server:27017" -CosmosConnectionString "AccountEndpoint=https://account.documents.azure.com:443/;AccountKey=key;" -SourceDatabase "sourcedb" -TargetDatabase "targetdb"