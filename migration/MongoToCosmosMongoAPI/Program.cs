using MongoDB.Driver;
using MongoDB.Bson;
using System;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace MongoToCosmosMongoAPIMigration
{
    class Program
    {
        // Source MongoDB Configuration
        private static readonly string SourceMongoConnectionString = "mongodb+srv://eggroll:kd2zkf86WFxcnAYX@clustermileage.ujgmrko.mongodb.net/?retryWrites=true&w=majority&appName=ClusterMileage";
        private static readonly string SourceDatabaseName = "ClusterMileage";

        // Target Cosmos DB for MongoDB API Configuration
        
        private static readonly string TargetCosmosConnectionString = "mongodb+srv://eggroll:RKE1VW3xzGuxA6icgY3V@incomemterdev.global.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000";
        private static readonly string TargetDatabaseName = "incomemterdev";
        
        // IMPORTANT: Set this to the Google ID of the user who owns the existing data
        private static readonly string DefaultUserId = "104684678058280672319";
        
        static async Task Main(string[] args)
        {
            if (DefaultUserId == "YOUR_GOOGLE_USER_ID_HERE")
            {
                Console.WriteLine("⚠️  WARNING: You must set the DefaultUserId before running migration!");
                return;
            }
            
            try
            {
                Console.WriteLine($"🚀 Starting MongoDB to Cosmos DB MongoDB API migration...");
                Console.WriteLine($"📋 Default User ID: {DefaultUserId}");
                
                // Connect to source MongoDB
                var sourceClient = new MongoClient(SourceMongoConnectionString);
                var sourceDatabase = sourceClient.GetDatabase(SourceDatabaseName);
                
                // Connect to target Cosmos DB (MongoDB API)
                var targetClient = new MongoClient(TargetCosmosConnectionString);
                var targetDatabase = targetClient.GetDatabase(TargetDatabaseName);
                
                Console.WriteLine("✅ Connected to both databases");
                
                // Collections to migrate
                var collectionsToMigrate = new[]
                {
                    new { 
                        SourceCollection = "locations", 
                        TargetCollection = "locations", 
                        InjectUserId = true   // User documents don't need userId field
                    },
                    new { 
                        SourceCollection = "route", 
                        TargetCollection = "routes", 
                        InjectUserId = true    // Add userId to each route
                    },
                    new { 
                        SourceCollection = "transactions", 
                        TargetCollection = "transactions", 
                        InjectUserId = true    // Add userId to each transaction
                    }
                };
                
                foreach (var collectionInfo in collectionsToMigrate)
                {
                    await MigrateCollection(
                        sourceDatabase,
                        targetDatabase,
                        collectionInfo.SourceCollection,
                        collectionInfo.TargetCollection,
                        collectionInfo.InjectUserId
                    );
                }
                
                Console.WriteLine("✅ Migration completed successfully!");
                Console.WriteLine("\n📝 Next steps:");
                Console.WriteLine("1. Test your application with the migrated data");
                Console.WriteLine("2. Update your API connection string to use Cosmos DB");
                Console.WriteLine("3. Verify all data is accessible through your application");
                
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Migration failed: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
            }
        }
        
        private static async Task MigrateCollection(
            IMongoDatabase sourceDatabase,
            IMongoDatabase targetDatabase,
            string sourceCollectionName,
            string targetCollectionName,
            bool injectUserId)
        {
            Console.WriteLine($"\n🔄 Migrating: {sourceCollectionName} -> {targetCollectionName}");
            Console.WriteLine($"   Inject User ID: {injectUserId}");
            
            var sourceCollection = sourceDatabase.GetCollection<BsonDocument>(sourceCollectionName);
            var targetCollection = targetDatabase.GetCollection<BsonDocument>(targetCollectionName);
            
            // Check if source collection exists
            var filter = new BsonDocument();
            var totalCount = await sourceCollection.CountDocumentsAsync(filter);
            Console.WriteLine($"📊 Total documents: {totalCount}");
            
            if (totalCount == 0)
            {
                Console.WriteLine("ℹ️  No documents to migrate");
                return;
            }
            
            // Create indices on target collection for better performance
            if (injectUserId)
            {
                try
                {
                    await targetCollection.Indexes.CreateOneAsync(
                        new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Ascending("userId"))
                    );
                    Console.WriteLine("📑 Created userId index");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"⚠️  Warning: Could not create index: {ex.Message}");
                }
            }
            
            // Migrate in batches
            const int batchSize = 100;
            var skip = 0;
            var migrated = 0;
            var errors = 0;
            
            while (skip < totalCount)
            {
                try
                {
                    var documents = await sourceCollection
                        .Find(filter)
                        .Skip(skip)
                        .Limit(batchSize)
                        .ToListAsync();
                    
                    var documentsToInsert = new List<BsonDocument>();
                    
                    foreach (var document in documents)
                    {
                        try
                        {
                            var processedDoc = ProcessDocument(document, injectUserId);
                            documentsToInsert.Add(processedDoc);
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"⚠️  Error processing document: {ex.Message}");
                            errors++;
                        }
                    }
                    
                    if (documentsToInsert.Count > 0)
                    {
                        try
                        {
                            // Use insertMany for better performance
                            await targetCollection.InsertManyAsync(documentsToInsert, new InsertManyOptions
                            {
                                IsOrdered = false // Continue on individual document errors
                            });
                            
                            migrated += documentsToInsert.Count;
                        }
                        catch (MongoBulkWriteException bulkEx)
                        {
                            // Handle individual document errors
                            migrated += documentsToInsert.Count - bulkEx.WriteErrors.Count;
                            errors += bulkEx.WriteErrors.Count;
                            
                            foreach (var writeError in bulkEx.WriteErrors)
                            {
                                if (writeError.Code == 11000) // Duplicate key
                                {
                                    Console.WriteLine($"⚠️  Duplicate document skipped");
                                }
                                else
                                {
                                    Console.WriteLine($"⚠️  Write error: {writeError.Message}");
                                }
                            }
                        }
                    }
                    
                    skip += batchSize;
                    Console.WriteLine($"📈 Progress: {migrated}/{totalCount} ({(double)migrated / totalCount * 100:F1}%)");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"❌ Batch error: {ex.Message}");
                    skip += batchSize; // Continue with next batch
                }
            }
            
            Console.WriteLine($"✅ Completed {sourceCollectionName}: {migrated} successful, {errors} errors");
        }
        
        private static BsonDocument ProcessDocument(BsonDocument originalDocument, bool injectUserId)
        {
            var document = originalDocument.DeepClone().AsBsonDocument;
            
            // Inject userId if required (for routes, transactions, etc.)
            if (injectUserId)
            {
                document["userId"] = DefaultUserId;
            }
            
            // Special handling for user documents
            if (!injectUserId)
            {
                // This is likely a user document - ensure it has Google ID fields
                if (!document.Contains("googleId"))
                {
                    document["googleId"] = DefaultUserId;
                }
                
                if (!document.Contains("email") && DefaultUserId.Contains("@"))
                {
                    document["email"] = DefaultUserId;
                }
            }
            
            // Convert dates to proper format
            ConvertDates(document);
            
            return document;
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
                // Keep as DateTime - MongoDB API handles this properly
                // document[key] = document[key].AsDateTime.ToString("O");
            }
        }
    }
}