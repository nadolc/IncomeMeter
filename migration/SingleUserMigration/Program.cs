using MongoDB.Driver;
using Microsoft.Azure.Cosmos;
using Newtonsoft.Json;
using System;
using System.Threading.Tasks;
using MongoDB.Bson;
using System.Collections.Generic;


namespace SingleUserToCosmosDBMigration
{
    class Program
    {
        // Configuration
        private static readonly string MongoConnectionString = "mongodb+srv://eggroll:kd2zkf86WFxcnAYX@clustermileage.ujgmrko.mongodb.net/?retryWrites=true&w=majority&appName=ClusterMileage";
        private static readonly string MongoDatabaseName = "ClusterMileage";
        private static readonly string CosmosConnectionString = "AccountEndpoint=mongodb+srv://eggroll:RKE1VW3xzGuxA6icgY3V@incometer.global.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000;";
        private static readonly string CosmosDatabaseName = "incomemterdev";
        
        // IMPORTANT: Set this to the Google ID of the user who owns the existing data
        // You can get this from your current user table or from Google OAuth login
        private static readonly string DefaultUserId = "104684678058280672319"; // e.g., "108765432109876543210"
        
        // Alternative: Use email as user identifier (if you prefer)
        // private static readonly string DefaultUserId = "user@gmail.com";
        
        static async Task Main(string[] args)
        {
            if (DefaultUserId == "YOUR_GOOGLE_USER_ID_HERE")
            {
                Console.WriteLine("⚠️  WARNING: You must set the DefaultUserId before running migration!");
                Console.WriteLine("Options:");
                Console.WriteLine("1. Use Google ID from your OAuth user (recommended)");
                Console.WriteLine("2. Use the user's email address");
                Console.WriteLine("3. Use a custom identifier");
                Console.WriteLine("\nUpdate the DefaultUserId variable in Program.cs and run again.");
                return;
            }
            
            try
            {
                Console.WriteLine($"🚀 Starting single-user to multi-user migration...");
                Console.WriteLine($"📋 Default User ID: {DefaultUserId}");
                
                var mongoClient = new MongoClient(MongoConnectionString);
                var cosmosClient = new CosmosClient(CosmosConnectionString);
                
                var mongoDatabase = mongoClient.GetDatabase(MongoDatabaseName);
                var cosmosDatabase = await cosmosClient.CreateDatabaseIfNotExistsAsync(CosmosDatabaseName);
                
                // Migrate collections with userId injection
                var collectionsToMigrate = new[]
                {
                    new { 
                        MongoCollection = "users", 
                        CosmosContainer = "users", 
                        PartitionKey = "/id",  // User documents use their own ID
                        InjectUserId = false   // User documents don't need userId field
                    },
                    new { 
                        MongoCollection = "routes", 
                        CosmosContainer = "routes", 
                        PartitionKey = "/userId",  // Routes grouped by user
                        InjectUserId = true    // Add userId to each route
                    },
                    new { 
                        MongoCollection = "transactions", 
                        CosmosContainer = "transactions", 
                        PartitionKey = "/userId",  // Transactions grouped by user
                        InjectUserId = true    // Add userId to each transaction
                    }
                };
                
                foreach (var collectionInfo in collectionsToMigrate)
                {
                    await MigrateCollection(
                        mongoDatabase,
                        cosmosDatabase.Database,
                        collectionInfo.MongoCollection,
                        collectionInfo.CosmosContainer,
                        collectionInfo.PartitionKey,
                        collectionInfo.InjectUserId
                    );
                }
                
                Console.WriteLine("✅ Migration completed successfully!");
                Console.WriteLine("\n📝 Next steps:");
                Console.WriteLine("1. Test your application with the migrated data");
                Console.WriteLine("2. Update your API to handle multi-user scenarios");
                Console.WriteLine("3. Verify all data is accessible through your application");
                
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Migration failed: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
            }
        }
        
        private static async Task MigrateCollection(
            IMongoDatabase mongoDatabase,
            Database cosmosDatabase,
            string mongoCollectionName,
            string cosmosContainerName,
            string partitionKey,
            bool injectUserId)
        {
            Console.WriteLine($"\n🔄 Migrating: {mongoCollectionName} -> {cosmosContainerName}");
            Console.WriteLine($"   Partition Key: {partitionKey}");
            Console.WriteLine($"   Inject User ID: {injectUserId}");
            
            var mongoCollection = mongoDatabase.GetCollection<BsonDocument>(mongoCollectionName);
            
            // Create Cosmos DB container with appropriate throughput
            var containerResponse = await cosmosDatabase.CreateContainerIfNotExistsAsync(
                cosmosContainerName,
                partitionKey,
                throughput: 400
            );
            var cosmosContainer = containerResponse.Container;
            
            var totalCount = await mongoCollection.CountDocumentsAsync(new BsonDocument());
            Console.WriteLine($"📊 Total documents: {totalCount}");
            
            if (totalCount == 0)
            {
                Console.WriteLine("ℹ️  No documents to migrate");
                return;
            }
            
            // Migrate in batches
            const int batchSize = 100;
            var skip = 0;
            var migrated = 0;
            var errors = 0;
            
            while (skip < totalCount)
            {
                var documents = await mongoCollection
                    .Find(new BsonDocument())
                    .Skip(skip)
                    .Limit(batchSize)
                    .ToListAsync();
                
                var tasks = new List<Task<MigrationResult>>();
                
                foreach (var document in documents)
                {
                    tasks.Add(MigrateDocument(cosmosContainer, document, partitionKey, injectUserId));
                }
                
                var results = await Task.WhenAll(tasks);
                
                foreach (var result in results)
                {
                    if (result.Success)
                    {
                        migrated++;
                    }
                    else
                    {
                        errors++;
                        Console.WriteLine($"⚠️  Error: {result.ErrorMessage}");
                    }
                }
                
                skip += batchSize;
                Console.WriteLine($"📈 Progress: {migrated}/{totalCount} ({(double)migrated / totalCount * 100:F1}%)");
            }
            
            Console.WriteLine($"✅ Completed {mongoCollectionName}: {migrated} successful, {errors} errors");
        }
        
        private static async Task<MigrationResult> MigrateDocument(
            Container cosmosContainer, 
            BsonDocument mongoDocument, 
            string partitionKey, 
            bool injectUserId)
        {
            try
            {
                // Convert MongoDB ObjectId to Cosmos DB id
                if (mongoDocument.Contains("_id"))
                {
                    var objectId = mongoDocument["_id"].AsObjectId;
                    mongoDocument["id"] = objectId.ToString();
                    mongoDocument.Remove("_id");
                }
                
                // Inject userId if required (for routes, transactions, etc.)
                if (injectUserId)
                {
                    mongoDocument["userId"] = DefaultUserId;
                    Console.WriteLine($"🔗 Added userId '{DefaultUserId}' to document");
                }
                
                // Special handling for user documents
                if (!injectUserId && partitionKey == "/id")
                {
                    // This is likely a user document - ensure it has Google ID fields
                    if (!mongoDocument.Contains("googleId"))
                    {
                        mongoDocument["googleId"] = DefaultUserId;
                        Console.WriteLine($"🔗 Added googleId '{DefaultUserId}' to user document");
                    }
                    
                    if (!mongoDocument.Contains("email") && DefaultUserId.Contains("@"))
                    {
                        mongoDocument["email"] = DefaultUserId;
                    }
                }
                
                // Convert dates to ISO strings
                ConvertDates(mongoDocument);
                
                // Convert to JSON and then to dynamic object
                var json = mongoDocument.ToJson();
                var document = JsonConvert.DeserializeObject(json);
                
                // Get partition key value
                var partitionKeyValue = GetPartitionKeyValue(mongoDocument, partitionKey);
                
                // Insert into Cosmos DB
                await cosmosContainer.CreateItemAsync(document, new PartitionKey(partitionKeyValue));
                
                return new MigrationResult { Success = true };
            }
            catch (CosmosException cosmosEx) when (cosmosEx.StatusCode == System.Net.HttpStatusCode.Conflict)
            {
                // Document already exists - treat as success
                return new MigrationResult { Success = true };
            }
            catch (Exception ex)
            {
                return new MigrationResult 
                { 
                    Success = false, 
                    ErrorMessage = $"Document migration failed: {ex.Message}" 
                };
            }
        }
        
        private static void ConvertDates(BsonDocument document)
        {
            var keysToUpdate = new List<string>();
            
            foreach (var element in document)
            {
                if (element.Value.IsDateTime)
                {
                    keysToUpdate.Add(element.Name);
                }
                else if (element.Value.IsBsonDocument)
                {
                    ConvertDates(element.Value.AsBsonDocument);
                }
            }
            
            foreach (var key in keysToUpdate)
            {
                document[key] = document[key].AsDateTime.ToString("O"); // ISO 8601 format
            }
        }
        
        private static string GetPartitionKeyValue(BsonDocument document, string partitionKeyPath)
        {
            var keyPath = partitionKeyPath.TrimStart('/');
            
            if (document.Contains(keyPath))
            {
                var value = document[keyPath];
                return value.ToString();
            }
            
            // For partition key "/userId", use the default user ID
            if (keyPath == "userId")
            {
                return DefaultUserId;
            }
            
            // Fallback
            return "default";
        }
    }
    
    public class MigrationResult
    {
        public bool Success { get; set; }
        public string ErrorMessage { get; set; } = string.Empty;
    }
}