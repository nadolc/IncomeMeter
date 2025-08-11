// MongoDB script to fix location coordinates
// Run this in MongoDB shell or MongoDB Compass

// Connect to your database
use incomemterdev;

// Function to safely convert and round coordinates
function safeCoordinateConvert(value) {
    if (value === null || value === undefined) return null;
    
    let num;
    if (typeof value === 'string') {
        num = parseFloat(value);
    } else if (typeof value === 'number') {
        num = value;
    } else {
        return null;
    }
    
    // Check for invalid numbers (NaN, Infinity, -Infinity)
    if (!isFinite(num)) {
        console.log(`Invalid coordinate value: ${value}`);
        return null;
    }
    
    // Round to 6 decimal places for GPS precision
    return Math.round(num * 1000000) / 1000000;
}

// Update all location documents
db.locations.find({}).forEach(function(location) {
    let needsUpdate = false;
    let updateDoc = {};
    
    // Check and fix latitude
    if (typeof location.latitude === 'string' || !isFinite(location.latitude)) {
        let newLat = safeCoordinateConvert(location.latitude);
        if (newLat !== null && newLat !== location.latitude) {
            updateDoc.latitude = newLat;
            needsUpdate = true;
            print(`Updating latitude for ${location._id}: ${location.latitude} -> ${newLat}`);
        }
    }
    
    // Check and fix longitude
    if (typeof location.longitude === 'string' || !isFinite(location.longitude)) {
        let newLng = safeCoordinateConvert(location.longitude);
        if (newLng !== null && newLng !== location.longitude) {
            updateDoc.longitude = newLng;
            needsUpdate = true;
            print(`Updating longitude for ${location._id}: ${location.longitude} -> ${newLng}`);
        }
    }
    
    // Round existing number coordinates to 6 decimal places
    if (typeof location.latitude === 'number' && isFinite(location.latitude)) {
        let rounded = Math.round(location.latitude * 1000000) / 1000000;
        if (rounded !== location.latitude) {
            updateDoc.latitude = rounded;
            needsUpdate = true;
            print(`Rounding latitude for ${location._id}: ${location.latitude} -> ${rounded}`);
        }
    }
    
    if (typeof location.longitude === 'number' && isFinite(location.longitude)) {
        let rounded = Math.round(location.longitude * 1000000) / 1000000;
        if (rounded !== location.longitude) {
            updateDoc.longitude = rounded;
            needsUpdate = true;
            print(`Rounding longitude for ${location._id}: ${location.longitude} -> ${rounded}`);
        }
    }
    
    // Apply updates if needed
    if (needsUpdate) {
        db.locations.updateOne(
            { _id: location._id },
            { $set: updateDoc }
        );
    }
});

print("Migration completed. Checking for any remaining issues...");

// Verify results
let invalidCount = db.locations.countDocuments({
    $or: [
        { latitude: { $type: "string" } },
        { longitude: { $type: "string" } },
        { latitude: { $in: [Infinity, -Infinity, NaN] } },
        { longitude: { $in: [Infinity, -Infinity, NaN] } }
    ]
});

print(`Found ${invalidCount} locations with coordinate issues after migration.`);

// Show sample of fixed data
print("Sample of updated locations:");
db.locations.find({}).limit(3).forEach(function(loc) {
    print(`ID: ${loc._id}, Lat: ${loc.latitude} (${typeof loc.latitude}), Lng: ${loc.longitude} (${typeof loc.longitude})`);
});