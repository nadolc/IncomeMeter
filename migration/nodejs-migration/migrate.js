const { MongoClient } = require('mongodb');
const { CosmosClient } = require('@azure/cosmos');
const ProgressBar = require('progress');
require('dotenv').config();

// Configuration
const config = {
  mongodb: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017',
    database: process.env.MONGO_DATABASE || 'sourcedb'
  },
  cosmosdb: {
    endpoint: process.env.COSMOS_ENDPOINT,
    key: process.env.COSMOS_KEY,
    database: process.env.COSMOS_DATABASE || 'targetdb'
  },
  collections: [
    { 
      source: 'users', 
      target: 'users', 
      partitionKey: '/id',
      throughput: 400
    },
    { 
      source: 'routes', 
      target: 'routes', 
      partitionKey: '/userId',
      throughput: 400
    },
    { 
      source: 'transactions', 
      target: 'transactions', 
      partitionKey: '/userId',
      throughput: 400
    }
  ],
  batchSize: 100,
  maxConcurrency: 10
};

class MigrationTool {
  constructor() {
    this.mongoClient = null;
    this.cosmosClient = null;
    this.cosmosDatabase = null;
  }

  async initialize() {
    try {
      // Connect to MongoDB
      this.mongoClient = new MongoClient(config.mongodb.uri);
      await this.mongoClient.connect();
      console.log('✅ Connected to MongoDB');

      // Connect to Cosmos DB
      this.cosmosClient = new CosmosClient({
        endpoint: config.cosmosdb.endpoint,
        key: config.cosmosdb.key
      });

      // Create database if not exists
      const { database } = await this.cosmosClient.databases.createIfNotExists({
        id: config.cosmosdb.database
      });
      this.cosmosDatabase = database;
      console.log('✅ Connected to Cosmos DB');

    } catch (error) {
      console.error('❌ Initialization failed:', error);
      throw error;
    }
  }

  async migrateCollection(collectionConfig) {
    const { source, target, partitionKey, throughput } = collectionConfig;
    
    console.log(`\n🔄 Starting migration: ${source} -> ${target}`);

    try {
      // Get MongoDB collection
      const mongoDb = this.mongoClient.db(config.mongodb.database);
      const mongoCollection = mongoDb.collection(source);

      // Create Cosmos DB container
      const { container } = await this.cosmosDatabase.containers.createIfNotExists({
        id: target,
        partitionKey: { paths: [partitionKey] },
        throughput: throughput
      });

      // Get total document count
      const totalCount = await mongoCollection.countDocuments();
      console.log(`📊 Total documents: ${totalCount}`);

      if (totalCount === 0) {
        console.log('ℹ️ No documents to migrate');
        return;
      }

      // Create progress bar
      const progressBar = new ProgressBar('⏳ [:bar] :rate/bps :percent :etas', {
        complete: '=',
        incomplete: ' ',
        width: 40,
        total: totalCount
      });

      // Migrate in batches
      let skip = 0;
      let migrated = 0;
      let errors = 0;

      while (skip < totalCount) {
        const documents = await mongoCollection
          .find({})
          .skip(skip)
          .limit(config.batchSize)
          .toArray();

        // Process batch with concurrency control
        const promises = documents.map(doc => this.migrateDocument(container, doc, partitionKey));
        const results = await this.executeWithConcurrency(promises, config.maxConcurrency);

        // Count results
        results.forEach(result => {
          if (result.success) {
            migrated++;
          } else {
            errors++;
            console.error(`❌ Migration error: ${result.error}`);
          }
          progressBar.tick();
        });

        skip += config.batchSize;
      }

      console.log(`\n✅ Migration completed for ${target}:`);
      console.log(`   📈 Successful: ${migrated}`);
      console.log(`   ❌ Errors: ${errors}`);

    } catch (error) {
      console.error(`❌ Collection migration failed for ${source}:`, error);
      throw error;
    }
  }

  async migrateDocument(container, mongoDoc, partitionKey) {
    try {
      // Transform document
      const cosmosDoc = this.transformDocument(mongoDoc, partitionKey);
      
      // Insert into Cosmos DB
      await container.items.create(cosmosDoc);
      
      return { success: true };
    } catch (error) {
      if (error.code === 409) {
        // Document already exists - you can choose to update or skip
        return { success: true }; // Treat as success
      }
      return { success: false, error: error.message };
    }
  }

  transformDocument(mongoDoc, partitionKey) {
    const doc = { ...mongoDoc };

    // Convert MongoDB ObjectId to string
    if (doc._id) {
      doc.id = doc._id.toString();
      delete doc._id;
    }

    // Ensure partition key exists
    const partitionKeyField = partitionKey.replace('/', '');
    if (!doc[partitionKeyField]) {
      doc[partitionKeyField] = doc.id || 'default';
    }

    // Convert dates to ISO strings
    Object.keys(doc).forEach(key => {
      if (doc[key] instanceof Date) {
        doc[key] = doc[key].toISOString();
      }
    });

    return doc;
  }

  async executeWithConcurrency(promises, maxConcurrency) {
    const results = [];
    
    for (let i = 0; i < promises.length; i += maxConcurrency) {
      const batch = promises.slice(i, i + maxConcurrency);
      const batchResults = await Promise.allSettled(batch);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({ success: false, error: result.reason.message });
        }
      });
    }
    
    return results;
  }

  async close() {
    if (this.mongoClient) {
      await this.mongoClient.close();
      console.log('✅ MongoDB connection closed');
    }
  }

  async run() {
    try {
      await this.initialize();

      for (const collection of config.collections) {
        await this.migrateCollection(collection);
      }

      console.log('\n🎉 All migrations completed successfully!');

    } catch (error) {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    } finally {
      await this.close();
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  const migrationTool = new MigrationTool();
  migrationTool.run();
}

module.exports = MigrationTool;