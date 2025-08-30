import React, { useMemo, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import type { Location } from '../../types';

// Fix for default markers in React-Leaflet
import 'leaflet/dist/leaflet.css';

// Create custom icons
const createNumberedIcon = (number: number, isStart: boolean = false, isEnd: boolean = false) => {
  let color = '#3b82f6'; // blue
  if (isStart) color = '#10b981'; // green
  if (isEnd) color = '#ef4444'; // red

  return new L.DivIcon({
    html: `
      <div style="
        background-color: ${color};
        color: white;
        border-radius: 50%;
        width: 25px;
        height: 25px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        ${isStart ? 'S' : isEnd ? 'E' : number}
      </div>
    `,
    className: 'custom-div-icon',
    iconSize: [25, 25],
    iconAnchor: [12.5, 12.5],
  });
};

interface RouteMapProps {
  locations: Location[];
  height?: string;
  showRoute?: boolean;
  onLocationClick?: (location: Location) => void;
  className?: string;
}

const RouteMap: React.FC<RouteMapProps> = ({ 
  locations, 
  height = '400px', 
  showRoute = true, 
  onLocationClick,
  className = '' 
}) => {
  const mapRef = useRef<L.Map | null>(null);

  // Calculate bounds and center
  const { center, bounds, polylinePositions } = useMemo(() => {
    if (!locations || locations.length === 0) {
      return {
        center: [51.505, -0.09] as [number, number], // Default to London
        bounds: null,
        polylinePositions: []
      };
    }

    const positions: [number, number][] = locations.map(loc => [loc.latitude, loc.longitude]);
    const latLngs = positions.map(([lat, lng]) => L.latLng(lat, lng));
    const boundsObj = L.latLngBounds(latLngs);

    return {
      center: [locations[0].latitude, locations[0].longitude] as [number, number],
      bounds: boundsObj,
      polylinePositions: positions
    };
  }, [locations]);

  // Fit bounds when locations change
  useEffect(() => {
    if (mapRef.current && bounds && locations.length > 1) {
      setTimeout(() => {
        mapRef.current?.fitBounds(bounds, { padding: [20, 20] });
      }, 100);
    }
  }, [bounds, locations]);

  if (!locations || locations.length === 0) {
    return (
      <div 
        className={`bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-center text-gray-600">
          <div className="text-lg font-semibold mb-2">Route Map</div>
          <div className="text-sm">No locations to display</div>
        </div>
      </div>
    );
  }

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className={className} style={{ height, position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Draw route line if enabled */}
        {showRoute && polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{ 
              color: '#3b82f6', 
              weight: 3, 
              opacity: 0.8,
              dashArray: '5, 5'
            }}
          />
        )}

        {/* Location markers */}
        {locations.map((location, index) => {
          const isStart = index === 0;
          const isEnd = index === locations.length - 1;
          const icon = createNumberedIcon(index + 1, isStart, isEnd);

          return (
            <Marker
              key={`${location.id || index}-${location.timestamp}`}
              position={[location.latitude, location.longitude]}
              icon={icon}
              eventHandlers={{
                click: () => onLocationClick?.(location)
              }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold mb-2">
                    {isStart ? '🟢 Start Point' : isEnd ? '🔴 End Point' : `📍 Point ${index + 1}`}
                  </div>
                  
                  <div className="space-y-1">
                    <div><strong>Time:</strong> {formatTimestamp(location.timestamp)}</div>
                    <div><strong>Coordinates:</strong> {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</div>
                    
                    {location.address && (
                      <div><strong>Address:</strong> {location.address}</div>
                    )}
                    
                    {location.speed !== null && location.speed !== undefined && (
                      <div><strong>Speed:</strong> {location.speed.toFixed(1)} km/h</div>
                    )}
                    
                    {location.accuracy !== null && location.accuracy !== undefined && (
                      <div><strong>GPS Accuracy:</strong> {location.accuracy.toFixed(0)}m</div>
                    )}

                    {location.distanceFromLastKm !== null && location.distanceFromLastKm !== undefined && index > 0 && (
                      <div><strong>Distance from previous:</strong> {location.distanceFromLastKm.toFixed(2)} km</div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map legend */}
      <div className="absolute top-2 right-2 bg-white rounded-lg shadow-md p-2 text-xs z-[1000]">
        <div className="font-semibold mb-1">Legend</div>
        <div className="flex items-center mb-1">
          <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
          <span>Start</span>
        </div>
        <div className="flex items-center mb-1">
          <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
          <span>End</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
          <span>Waypoints</span>
        </div>
      </div>

      {/* Map info */}
      <div className="absolute bottom-2 left-2 bg-white rounded-lg shadow-md p-2 text-xs z-[1000]">
        <div className="font-semibold">{locations.length} location{locations.length === 1 ? '' : 's'}</div>
        {locations.length > 1 && showRoute && (
          <div>Route displayed</div>
        )}
      </div>
    </div>
  );
};

export default RouteMap;