import React, { useMemo, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import type { Location } from '../../types';

// Fix for default markers in React-Leaflet
import 'leaflet/dist/leaflet.css';

// Create custom icons
const createNumberedIcon = (number: number, isStart: boolean = false, isEnd: boolean = false) => {
  let backgroundColor = '#3B82F6'; // Blue for regular points
  if (isStart) backgroundColor = '#10B981'; // Green for start
  if (isEnd) backgroundColor = '#EF4444'; // Red for end

  return L.divIcon({
    html: `<div style="
      background-color: ${backgroundColor};
      color: white;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 12px;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    ">${number}</div>`,
    className: 'custom-numbered-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });
};

interface RouteMapProps {
  locations: Location[];
  className?: string;
}

const RouteMap: React.FC<RouteMapProps> = ({ locations, className = '' }) => {
  const mapRef = useRef<L.Map | null>(null);

  // Calculate bounds for all locations
  const bounds = useMemo(() => {
    if (locations.length === 0) return null;
    
    if (locations.length === 1) {
      const loc = locations[0];
      return L.latLngBounds([
        [loc.latitude - 0.01, loc.longitude - 0.01],
        [loc.latitude + 0.01, loc.longitude + 0.01]
      ]);
    }

    const latitudes = locations.map(loc => loc.latitude);
    const longitudes = locations.map(loc => loc.longitude);
    
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    // Add some padding around the bounds
    const padding = 0.001;
    return L.latLngBounds([
      [minLat - padding, minLng - padding],
      [maxLat + padding, maxLng + padding]
    ]);
  }, [locations]);

  // Create path for polyline
  const pathPositions = useMemo(() => {
    return locations.map(loc => [loc.latitude, loc.longitude] as [number, number]);
  }, [locations]);

  // Calculate center point
  const center = useMemo(() => {
    if (locations.length === 0) return [51.505, -0.09] as [number, number]; // Default London
    if (locations.length === 1) return [locations[0].latitude, locations[0].longitude] as [number, number];
    
    const avgLat = locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length;
    const avgLng = locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length;
    return [avgLat, avgLng] as [number, number];
  }, [locations]);

  // Fit map to bounds when locations change
  useEffect(() => {
    if (mapRef.current && bounds) {
      mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [bounds]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatDistance = (distance: number | undefined | null) => {
    if (!distance || distance <= 0) return '0.0 km';
    return `${distance.toFixed(2)} km`;
  };

  if (locations.length === 0) {
    return (
      <div className={`bg-gray-100 rounded-lg flex items-center justify-center h-96 ${className}`}>
        <div className="text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          <p>No location data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden shadow-sm ${className}`}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '400px', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Route polyline */}
        {locations.length > 1 && (
          <Polyline
            positions={pathPositions}
            pathOptions={{
              color: '#3B82F6',
              weight: 3,
              opacity: 0.7
            }}
          />
        )}
        
        {/* Location markers */}
        {locations.map((location, index) => {
          const isStart = index === 0;
          const isEnd = index === locations.length - 1;
          const number = index + 1;
          
          return (
            <Marker
              key={location.id}
              position={[location.latitude, location.longitude]}
              icon={createNumberedIcon(number, isStart, isEnd)}
            >
              <Popup>
                <div className="p-2 min-w-[200px]">
                  <div className="font-semibold mb-2">
                    {isStart && <span className="text-green-600">Start - </span>}
                    {isEnd && <span className="text-red-600">End - </span>}
                    Point #{number}
                  </div>
                  
                  <div className="space-y-1 text-sm">
                    <div>
                      <strong>Time:</strong> {formatTime(location.timestamp)}
                    </div>
                    
                    {location.address && (
                      <div>
                        <strong>Address:</strong> {location.address}
                      </div>
                    )}
                    
                    <div>
                      <strong>Coordinates:</strong> {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    </div>
                    
                    {location.distanceFromLastKm != null && location.distanceFromLastKm > 0 && (
                      <div>
                        <strong>Distance from previous:</strong> {formatDistance(location.distanceFromLastKm)}
                      </div>
                    )}
                    
                    {location.speed != null && (
                      <div>
                        <strong>Speed:</strong> {location.speed.toFixed(1)} m/s
                      </div>
                    )}
                    
                    {location.accuracy != null && (
                      <div>
                        <strong>GPS Accuracy:</strong> ±{location.accuracy.toFixed(1)}m
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default RouteMap;