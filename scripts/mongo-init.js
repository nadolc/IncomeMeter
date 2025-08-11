// MongoDB initialization script
// This script runs when MongoDB container starts for the first time

// Switch to the application database
db = db.getSiblingDB('incomemeter');

// Create application user with read/write permissions
db.createUser({
  user: 'appuser',
  pwd: 'apppassword123',
  roles: [
    {
      role: 'readWrite',
      db: 'incomemeter'
    }
  ]
});

// Create collections and indexes
db.createCollection('users');
db.createCollection('routes');
db.createCollection('locations');
db.createCollection('transactions');

// Create indexes for better performance

// Users collection indexes
db.users.createIndex({ "googleId": 1 }, { unique: true });
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "createdAt": 1 });

// Routes collection indexes
db.routes.createIndex({ "userId": 1 });
db.routes.createIndex({ "date": 1 });
db.routes.createIndex({ "userId": 1, "date": -1 });
db.routes.createIndex({ "status": 1 });

// Locations collection indexes
db.locations.createIndex({ "userId": 1 });
db.locations.createIndex({ "routeId": 1 });
db.locations.createIndex({ "timestamp": 1 });
db.locations.createIndex({ "userId": 1, "timestamp": -1 });
db.locations.createIndex({ "coordinates": "2dsphere" }); // Geospatial index

// Transactions collection indexes
db.transactions.createIndex({ "userId": 1 });
db.transactions.createIndex({ "routeId": 1 });
db.transactions.createIndex({ "date": 1 });
db.transactions.createIndex({ "userId": 1, "date": -1 });
db.transactions.createIndex({ "type": 1 });

// Print initialization status
print('MongoDB initialization completed successfully');
print('Database: incomemeter');
print('Collections created: users, routes, locations, transactions');
print('Indexes created for optimal performance');
print('Application user created: appuser');