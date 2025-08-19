import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import type { Route } from '../../types';
import { getDisplayDistance } from '../../utils/distance';
import { getRouteById, getLocationsByRouteId } from '../../utils/api';

interface Location {
  id: string;
  routeId: string;
  userId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number;
  speed?: number;
  distanceFromLastKm?: number;
}

interface RouteWithLocations extends Route {
  locations?: Location[];
}

const RouteDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatCurrency, settings } = useSettings();
  const { t } = useLanguage();
  const [route, setRoute] = useState<RouteWithLocations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRouteDetails = useCallback(async (routeId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch route details from API
      const routeData = await getRouteById(routeId);
      
      // Fetch locations for this route
      const locationsData = await getLocationsByRouteId(routeId);
      
      // Transform API data with proper date conversion
      const processedRoute: RouteWithLocations = {
        ...routeData,
        scheduleStart: new Date(routeData.scheduleStart),
        scheduleEnd: new Date(routeData.scheduleEnd),
        actualStartTime: routeData.actualStartTime ? new Date(routeData.actualStartTime) : undefined,
        actualEndTime: routeData.actualEndTime ? new Date(routeData.actualEndTime) : undefined,
        locations: locationsData || [],
      };

      setRoute(processedRoute);
    } catch (err) {
      setError(t('routes.details.error.message'));
      console.error('Error loading route details:', err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (id) {
      loadRouteDetails(id);
    }
  }, [id, loadRouteDetails]);

  const getStatusColor = (status: string = 'unknown') => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-500';
      case 'in_progress':
        return 'bg-orange-500';
      case 'scheduled':
        return 'bg-blue-500';
      case 'cancelled':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string = 'unknown') => {
    switch (status.toLowerCase()) {
      case 'completed':
        return t('routes.status.completed');
      case 'in_progress':
        return t('routes.status.inProgress');
      case 'scheduled':
        return t('routes.status.scheduled');
      case 'cancelled':
        return t('routes.status.cancelled');
      default:
        return t('common.unknown');
    }
  };

  const formatDateTime = (date: Date | string | undefined) => {
    if (!date) return t('common.noDate');
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatTime = (date: Date | string | undefined) => {
    if (!date) return t('common.noTime');
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('routes.details.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !route) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {error ? t('routes.details.error.title') : t('routes.details.notFound.title')}
        </h2>
        <p className="text-gray-600 mb-4">
          {error || t('routes.details.notFound.message')}
        </p>
        <div className="space-x-4">
          <button
            onClick={() => navigate('/routes/manage')}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            {t('common.back')}
          </button>
          {error && (
            <button
              onClick={() => id && loadRouteDetails(id)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {t('common.retry')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={() => navigate('/routes/manage')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{t('routes.details.title')}</h1>
            <p className="text-gray-600 mt-1">{route.workType || 'Route'}</p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(route.status)}`}>
            {getStatusText(route.status)}
          </span>
        </div>
      </div>

      {/* Route Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Route Overview</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="text-sm text-gray-600">{t('routes.details.date')}</p>
                <p className="font-medium">{route.scheduleStart.toLocaleDateString()}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-gray-600">{t('routes.details.scheduleTime')}</p>
                <p className="font-medium">
                  {formatTime(route.scheduleStart)} - {formatTime(route.scheduleEnd)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-gray-600">{t('routes.details.actualTime')}</p>
                <p className="font-medium">
                  {formatTime(route.actualStartTime)} - {formatTime(route.actualEndTime)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <div>
                <p className="text-sm text-gray-600">Distance</p>
                <p className="font-medium">{getDisplayDistance(route.distance, 'km', settings.mileageUnit).formatted}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              <div>
                <p className="text-sm text-gray-600">{t('routes.details.totalIncome')}</p>
                <p className="font-medium text-green-600 text-lg">{formatCurrency(route.totalIncome || route.estimatedIncome || 0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Work Type Details */}
        <div className="border-t pt-4">
          <p className="text-sm text-gray-600 mb-1">Work Type</p>
          <p className="text-gray-900">{route.workType || 'Not specified'}</p>
        </div>
      </div>

      {/* Income Breakdown */}
      {route.incomes && route.incomes.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Income Breakdown</h2>
          <div className="space-y-3">
            {route.incomes.map((income, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <span className="text-gray-700">{income.source}</span>
                <span className="font-medium">{formatCurrency(income.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-2 font-semibold text-lg border-t-2">
              <span className="text-gray-900">Total</span>
              <span className="text-green-600">{formatCurrency(route.totalIncome || route.estimatedIncome || 0)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Route Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('routes.details.routeInfo')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">{t('routes.details.routeId')}</span>
            <span className="font-medium">{route.id}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">{t('routes.details.userId')}</span>
            <span className="font-medium">{route.userId}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">{t('routes.details.created')}</span>
            <span className="font-medium">{formatDateTime(route.createdAt)}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">{t('routes.details.updated')}</span>
            <span className="font-medium">{formatDateTime(route.updatedAt || route.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Locations */}
      {route.locations && route.locations.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('routes.details.locations.title')}</h2>
            <span className="text-sm text-gray-600">{route.locations.length} locations</span>
          </div>

          {/* Odometer Information */}
          {(route.startMile || route.endMile) && (
            <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">{t('routes.details.locations.startMile')}</p>
                <p className="font-medium">{getDisplayDistance(route.startMile || 0, 'mi', settings.mileageUnit).formatted}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{t('routes.details.locations.endMile')}</p>
                <p className="font-medium">{getDisplayDistance(route.endMile || 0, 'mi', settings.mileageUnit).formatted}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {route.locations.map((location, index) => (
              <div key={location.id} className="flex items-start space-x-4 p-4 border rounded-lg">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{new Date(location.timestamp).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: false 
                    })}</p>
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      <span className="text-sm text-gray-600">
                        {getDisplayDistance(location.distanceFromLastKm || 0, 'km', settings.mileageUnit).formatted}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">
                    {location.address || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`}
                  </p>
                  {(location.accuracy || location.speed) && (
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      {location.accuracy && <span>Accuracy: {location.accuracy.toFixed(1)}m</span>}
                      {location.speed && <span>Speed: {location.speed.toFixed(1)} m/s</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteDetails;