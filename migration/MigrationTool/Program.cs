using MongoDB.Driver;
using Microsoft.Azure.Cosmos;
using Newtonsoft.Json;
using System;
using System.Threading.Tasks;
using MongoDB.Bson;

namespace MongoToCosmosDBMigration
{
    class Program
    {
        // MongoDB Configuration
        private static readonly string MongoConnectionString = "mongodb://username:password@server:port";
        private static readonly string MongoDatabaseName = "your-mongodb-database";
        
        // Cosmos DB Configuration
        private static readonly string CosmosConnectionString = "AccountEndpoint=https://your-account.documents.azure.com:443/;AccountKey=your-key;";
        private static readonly string CosmosDatabaseName = "your-cosmos-database";
        
        static async Task Main(string[] args)
        {
            try
            {
                Console.WriteLine("Starting MongoDB to Cosmos DB migration...");
                
                // Initialize clients
                var mongoClient = new MongoClient(MongoConnectionString);
                var cosmosClient = new CosmosClient(CosmosConnectionString);
                
                // Get databases
                var mongoDatabase = mongoClient.GetDatabase(MongoDatabaseName);
                var cosmosDatabase = await cosmosClient.CreateDatabaseIfNotExistsAsync(CosmosDatabaseName);
                
                // Define collections to migrate
                var collectionsToMigrate = new[]
                {
                    new { MongoCollection = "users", CosmosContainer = "users", PartitionKey = "/id" },
                    new { MongoCollection = "routes", CosmosContainer = "routes", PartitionKey = "/userId" },
                    new { MongoCollection = "transactions", CosmosContainer = "transactions", PartitionKey = "/userId" }
                };
                
                foreach (var collectionInfo in collectionsToMigrate)
                {
                    await MigrateCollection(
                        mongoDatabase,
                        cosmosDatabase.Database,
                        collectionInfo.MongoCollection,
                        collectionInfo.CosmosContainer,
                        collectionInfo.PartitionKey
                    );
                }
                
                Console.WriteLine("Migration completed successfully!");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Migration failed: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
            }
        }
        
        private static async Task MigrateCollection(
            IMongoDatabase mongoDatabase,
            Database cosmosDatabase,
            string mongoCollectionName,
            string cosmosContainerName,
            string partitionKey)
        {
            Console.WriteLine($"Migrating collection: {mongoCollectionName} -> {cosmosContainerName}");
            
            // Get MongoDB collection
            var mongoCollection = mongoDatabase.GetCollection<BsonDocument>(mongoCollectionName);
            
            // Create Cosmos DB container
            var containerResponse = await cosmosDatabase.CreateContainerIfNotExistsAsync(
                cosmosContainerName,
                partitionKey,
                throughput: 400 // Adjust based on your needs
            );
            var cosmosContainer = containerResponse.Container;
            
            // Get total document count
            var totalCount = await mongoCollection.CountDocumentsAsync(new BsonDocument());
            Console.WriteLine($"Total documents to migrate: {totalCount}");
            
            // Migrate documents in batches
            const int batchSize = 100;
            var skip = 0;
            var migrated = 0;
            
            while (skip < totalCount)
            {
                var documents = await mongoCollection
                    .Find(new BsonDocument())
                    .Skip(skip)
                    .Limit(batchSize)
                    .ToListAsync();
                
                var tasks = new List<Task>();
                
                foreach (var document in documents)
                {
                    tasks.Add(MigrateDocument(cosmosContainer, document, partitionKey));
                }
                
                await Task.WhenAll(tasks);
                
                migrated += documents.Count;
                skip += batchSize;
                
                Console.WriteLine($"Progress: {migrated}/{totalCount} ({(double)migrated / totalCount * 100:F1}%)");
            }
            
            Console.WriteLine($"Completed migrating {mongoCollectionName}: {migrated} documents");
        }
        
        private static async Task MigrateDocument(Container cosmosContainer, BsonDocument mongoDocument, string partitionKey)
        {
            try
            {
                // Convert MongoDB ObjectId to string for Cosmos DB id
                if (mongoDocument.Contains("_id"))
                {
                    var objectId = mongoDocument["_id"].AsObjectId;
                    mongoDocument["id"] = objectId.ToString();
                    mongoDocument.Remove("_id");
                }
                
                // Convert BsonDocument to JSON string and then to dynamic object
                var json = mongoDocument.ToJson();
                var document = JsonConvert.DeserializeObject(json);
                
                // Extract partition key value
                var partitionKeyValue = GetPartitionKeyValue(mongoDocument, partitionKey);
                
                // Insert into Cosmos DB
                await cosmosContainer.CreateItemAsync(document, new PartitionKey(partitionKeyValue));
            }
            catch (CosmosException cosmosEx) when (cosmosEx.StatusCode == System.Net.HttpStatusCode.Conflict)
            {
                // Document already exists, you can choose to update or skip
                Console.WriteLine($"Document already exists, skipping: {cosmosEx.Message}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error migrating document: {ex.Message}");
            }
        }
        
        private static string GetPartitionKeyValue(BsonDocument document, string partitionKeyPath)
        {
            // Remove leading "/" from partition key path
            var keyPath = partitionKeyPath.TrimStart('/');
            
            if (document.Contains(keyPath))
            {
                var value = document[keyPath];
                return value.ToString();
            }
            
            // Default partition key if not found
            return "default";
        }
    }
}