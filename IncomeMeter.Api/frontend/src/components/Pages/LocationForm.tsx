import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface LocationFormData {
  routeId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
  address?: string;
}

interface Location {
  id?: string;
  routeId: string;
  userId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  address?: string;
  speed?: number;
  accuracy?: number;
  distanceFromLastKm?: number;
  distanceFromLastMi?: number;
}

interface LocationFormProps {
  routeId: string;
  location?: Location;
  onSave: (location: Location) => void;
  onCancel: () => void;
}

const LocationForm: React.FC<LocationFormProps> = ({ routeId, location, onSave, onCancel }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<LocationFormData>({
    routeId: routeId,
    latitude: 0,
    longitude: 0,
    timestamp: new Date().toISOString().slice(0, 16),
    accuracy: undefined,
    speed: undefined,
    address: undefined,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  useEffect(() => {
    if (location) {
      setFormData({
        routeId: location.routeId,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: new Date(location.timestamp).toISOString().slice(0, 16),
        accuracy: location.accuracy,
        speed: location.speed,
        address: location.address,
      });
    }
  }, [location]);

  const getCurrentLocation = () => {
    setIsGettingLocation(true);
    setError(null);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: Number(position.coords.latitude.toFixed(6)),
            longitude: Number(position.coords.longitude.toFixed(6)),
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || undefined,
            timestamp: new Date().toISOString().slice(0, 16),
          }));
          setIsGettingLocation(false);
        },
        (error) => {
          setError(`Location error: ${error.message}`);
          setIsGettingLocation(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      setError('Geolocation is not supported by this browser.');
      setIsGettingLocation(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const url = location 
        ? `/api/locations/${location.id}` 
        : '/api/locations';
      
      const method = location ? 'PUT' : 'POST';
      
      const requestBody = location 
        ? {
            latitude: formData.latitude,
            longitude: formData.longitude,
            timestamp: new Date(formData.timestamp).toISOString(),
            accuracy: formData.accuracy,
            speed: formData.speed,
            address: formData.address,
          }
        : {
            routeId: formData.routeId,
            latitude: formData.latitude,
            longitude: formData.longitude,
            timestamp: new Date(formData.timestamp).toISOString(),
            accuracy: formData.accuracy,
            speed: formData.speed,
          };

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save location');
      }

      const savedLocation = await response.json();
      onSave(savedLocation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'latitude' || name === 'longitude' || name === 'accuracy' || name === 'speed'
        ? value === '' ? undefined : Number(value)
        : value
    }));
  };

  const isEdit = !!location;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 text-center">
            {isEdit ? t('locations.crud.edit.title') : t('locations.crud.create.title')}
          </h3>
          
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={getCurrentLocation}
                disabled={isGettingLocation}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-3 py-1 rounded text-sm"
              >
                {isGettingLocation ? 'Getting...' : 'Use Current Location'}
              </button>
            </div>

            <div>
              <label htmlFor="latitude" className="block text-sm font-medium text-gray-700">
                {t('locations.crud.create.latitude')} *
              </label>
              <input
                type="number"
                id="latitude"
                name="latitude"
                step="0.000001"
                min="-90"
                max="90"
                value={formData.latitude}
                onChange={handleInputChange}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="longitude" className="block text-sm font-medium text-gray-700">
                {t('locations.crud.create.longitude')} *
              </label>
              <input
                type="number"
                id="longitude"
                name="longitude"
                step="0.000001"
                min="-180"
                max="180"
                value={formData.longitude}
                onChange={handleInputChange}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="timestamp" className="block text-sm font-medium text-gray-700">
                {t('locations.crud.create.timestamp')} *
              </label>
              <input
                type="datetime-local"
                id="timestamp"
                name="timestamp"
                value={formData.timestamp}
                onChange={handleInputChange}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="accuracy" className="block text-sm font-medium text-gray-700">
                {t('locations.crud.create.accuracy')}
              </label>
              <input
                type="number"
                id="accuracy"
                name="accuracy"
                step="0.1"
                min="0"
                value={formData.accuracy || ''}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="speed" className="block text-sm font-medium text-gray-700">
                {t('locations.crud.create.speed')}
              </label>
              <input
                type="number"
                id="speed"
                name="speed"
                step="0.1"
                min="0"
                value={formData.speed || ''}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {isEdit && (
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  {t('locations.details.address')}
                </label>
                <textarea
                  id="address"
                  name="address"
                  rows={2}
                  value={formData.address || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md text-sm font-medium"
              >
                {isEdit ? t('locations.crud.edit.cancel') : t('locations.crud.create.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                {loading ? t('common.loading') : (isEdit ? t('locations.crud.edit.submit') : t('locations.crud.create.submit'))}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LocationForm;