// api/locations.js
const express = require('express');
const connectToDatabase = require('../src/db');
const authMiddleware = require('../src/middleware/auth');
const session = require('express-session');
const passport = require('passport');
const passportConfig = require('../src/passport');
const { ObjectId } = require('mongodb');
const Route = require('../src/models/Route'); // To check if the route belongs to the user
const { getDistance } = require('geolib'); // Library for calculating geodesic distances
const { t, formatApiDistance } = require('../src/utils/localization'); // Import localization utilities

// Load environment variables if not in production
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Initialize Passport configuration
passportConfig();

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
});

const app = express();
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

// --- Configuration Constants ---
// Maximum allowed distance in Kilometers between two consecutive location points
// Adjust this value based on your application's typical use case (e.g., 50km for driving, 5km for walking)
const MAX_DISTANCE_BETWEEN_LOCATIONS_KM = 50; 

// --- Helper Functions (placeholders for your external services) ---

// Placeholder for reverse geocoding service (e.g., OpenStreetMap Nominatim, Google Maps API)
async function reverseGeocode(latitude, longitude, lang) {
    const fetch = require('node-fetch');
    const apiKey = process.env.OPENCAGE_API_KEY; // Get API key from environment variables
    // Correct URL for OpenCage Data: q parameter uses "lat,lng" format
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${apiKey}`;
    
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'WorkTracker/1.0' } // IMPORTANT: A valid user-agent is required
        });
        if (!response.ok) {
            console.error('Reverse Geocode failed:', response.statusText);
            // Use localized message for error
            return t('address_not_found', lang);
        }
        const data = await response.json();
        // OpenCage Data returns results in data.results array, and formatted_address is the full address
        if (data.results && data.results.length > 0) {
            return data.results[0].formatted || t('address_not_found', lang);
        }
        return t('address_not_found', lang);
    } catch (error) {
        console.error('Error in reverseGeocode:', error);
        return t('address_not_found', lang);
    }
}

// Placeholder for calculating driving distance using a service (e.g., OpenRouteService)
// For this example, we'll use a simple geodesic distance library (geolib)
// and return in kilometers. In a real application, you'd integrate with ORS API here.
async function calculateORSDrivingDistance(origin, destination) {
    try {
        // geolib's getDistance returns meters by default
        const distanceMeters = getDistance(
            { latitude: origin.lat, longitude: origin.lon },
            { latitude: destination.lat, longitude: destination.lon }
        );
        return distanceMeters / 1000; // Return distance in kilometers
    } catch (error) {
        console.error('Error calculating driving distance:', error);
        return null;
    }
}


// --- API Routes ---

// GET /api/locations?routeId=:id - Get all locations for a specific route
app.get('/api/locations', authMiddleware(async (req, res) => {
  const lang = req.user.settings.localization.language;
  try {
    const { routeId } = req.query;

    if (!routeId || !ObjectId.isValid(routeId)) {
      return res.status(400).json({ message: t('error_invalid_route_id', lang) });
    }

    await connectToDatabase();
    const db = await connectToDatabase();
    const locationsCollection = db.collection('locations');

    // 1. First, verify the route exists and belongs to the authenticated user
    const route = await Route.findOne({ _id: routeId, userId: req.user._id });
    if (!route) {
        return res.status(404).json({ message: t('error_route_not_found_or_unauthorized', lang) });
    }

    // 2. Fetch locations for the validated route, sorted by timestamp
    const locations = await locationsCollection
      .find({ routeId: routeId })
      .sort({ timestamp: 1 })
      .toArray();

    // Format locations for response
    const formattedLocations = locations.map(loc => ({
        ...loc,
        distanceFromLastKm: loc.distanceFromLastKm ? formatApiDistance(loc.distanceFromLastKm, req.user.settings) : null,
        distanceFromLastMi: loc.distanceFromLastMi ? formatApiDistance(loc.distanceFromLastMi, req.user.settings) : null,
        // You might want to format timestamp here too, but often frontend handles specific date/time display
        // timestamp: formatApiDate(loc.timestamp, req.user.settings),
    }));


    res.status(200).json(formattedLocations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ message: t('error_internal_server_error', lang), error: error.message });
  }
}));

// POST /api/locations - Add a new location to a route
app.post('/api/locations', authMiddleware(async (req, res) => {
  const lang = req.user.settings.localization.language;
  try {
    const { routeId, latitude, longitude, timestamp, accuracy, speed } = req.body;

    if (!routeId || !ObjectId.isValid(routeId) || !latitude || !longitude || !timestamp) {
      return res.status(400).json({ message: t('error_missing_location_data', lang) });
    }
    
    await connectToDatabase();
    const db = await connectToDatabase();
    const locationsCollection = db.collection('locations');

    // 1. Verify the route exists and belongs to the authenticated user
    const route = await Route.findOne({ _id: routeId, userId: req.user._id });
    if (!route) {
        return res.status(404).json({ message: t('error_route_not_found_or_unauthorized', lang) });
    }

    const now = new Date();
    const newLocation = {
        routeId: routeId,
        latitude,
        longitude,
        timestamp: new Date(timestamp),
        accuracy,
        speed,
        address: await reverseGeocode(latitude, longitude, lang), // Pass lang to reverseGeocode
        createdAt: now
    };

    // 2. Find the previous location to calculate distance
    const lastLocation = await locationsCollection
      .find({ routeId: routeId })
      .sort({ timestamp: -1 }) // Sort by latest timestamp
      .limit(1)
      .toArray();

    if (lastLocation.length > 0) {
        const prev = lastLocation[0];
        const distanceKm = await calculateORSDrivingDistance(
            { lat: prev.latitude, lon: prev.longitude },
            { lat: newLocation.latitude, lon: newLocation.longitude }
        );

        if (distanceKm !== null) {
            // --- Distance Validation ---
            if (distanceKm > MAX_DISTANCE_BETWEEN_LOCATIONS_KM) {
                return res.status(400).json({ 
                    message: t('error_location_too_far', lang, { 
                        distance: distanceKm.toFixed(2), 
                        maxDistance: MAX_DISTANCE_BETWEEN_LOCATIONS_KM 
                    })
                });
            }
            // --- End Distance Validation ---

            newLocation.distanceFromLastKm = parseFloat(distanceKm.toFixed(2));
            // You might want to store distanceFromLastMi only if user's default is miles,
            // or calculate it on the fly when fetching. For now, storing both.
            newLocation.distanceFromLastMi = parseFloat((distanceKm * 0.621371).toFixed(2)); 
        }
    }
    
    // 3. Insert the new location
    const result = await locationsCollection.insertOne(newLocation);

    res.status(201).json({ _id: result.insertedId, ...newLocation });
  } catch (error) {
    console.error('Error adding location:', error);
    res.status(500).json({ message: t('error_internal_server_error', lang), error: error.message });
  }
}));

// Vercel's entry point
module.exports = (req, res) => app(req, res);
