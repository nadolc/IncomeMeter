import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';

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

interface LocationListProps {
  routeId: string;
}

const LocationList: React.FC<LocationListProps> = ({ routeId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    fetchLocations();
  }, [routeId]);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/locations?routeId=${routeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }

      const data = await response.json();
      setLocations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/locations/${locationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete location');
      }

      setLocations(locations.filter(loc => loc.id !== locationId));
      setShowDeleteModal(false);
      setSelectedLocation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete location');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatCoordinates = (lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">{t('locations.list.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              {t('locations.list.error.title')}
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={fetchLocations}
                className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-md text-sm font-medium"
              >
                {t('common.retry')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">{t('locations.list.title')}</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          {t('locations.list.add')}
        </button>
      </div>

      {locations.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">{t('locations.list.empty.title')}</div>
          <p className="text-gray-400 mt-2">{t('locations.list.empty.message')}</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {locations.map((location) => (
              <li key={location.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {t('locations.details.coordinates')}: {formatCoordinates(location.latitude, location.longitude)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {t('locations.details.timestamp')}: {formatTimestamp(location.timestamp)}
                        </p>
                        {location.address && (
                          <p className="text-sm text-gray-500">
                            {t('locations.details.address')}: {location.address}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      {location.speed && (
                        <span>{t('locations.details.speed')}: {location.speed.toFixed(1)} km/h</span>
                      )}
                      {location.accuracy && (
                        <span>{t('locations.details.accuracy')}: {location.accuracy.toFixed(1)}m</span>
                      )}
                      {location.distanceFromLastKm && (
                        <span>{t('locations.details.distanceKm')}: {location.distanceFromLastKm}km</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSelectedLocation(location)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      {t('locations.actions.edit')}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedLocation(location);
                        setShowDeleteModal(true);
                      }}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      {t('locations.actions.delete')}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedLocation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg font-medium text-gray-900">{t('locations.crud.delete.title')}</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">{t('locations.crud.delete.message')}</p>
              </div>
              <div className="flex justify-center space-x-4 mt-4">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedLocation(null);
                  }}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md text-sm font-medium"
                >
                  {t('locations.crud.delete.cancel')}
                </button>
                <button
                  onClick={() => handleDeleteLocation(selectedLocation.id!)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  {t('locations.crud.delete.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationList;