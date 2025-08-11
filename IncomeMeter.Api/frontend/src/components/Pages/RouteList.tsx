import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import type { Route } from '../../types';
import { getDisplayDistance } from '../../utils/distance';
import { getRoutes } from '../../utils/api';

const RouteList: React.FC = () => {
  const navigate = useNavigate();
  const { formatCurrency, settings } = useSettings();
  const { t } = useLanguage();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoutes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch routes from API
      const routesData = await getRoutes();
      
      // Convert date strings to Date objects if needed
      const processedRoutes: Route[] = routesData.map(route => ({
        ...route,
        scheduleStart: new Date(route.scheduleStart),
        scheduleEnd: new Date(route.scheduleEnd),
        actualStartTime: route.actualStartTime ? new Date(route.actualStartTime) : undefined,
        actualEndTime: route.actualEndTime ? new Date(route.actualEndTime) : undefined,
      }));
      
      setRoutes(processedRoutes);
    } catch (err) {
      setError(t('routes.list.error.message'));
      console.error('Error loading routes:', err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

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

  const handleRouteClick = (routeId: string) => {
    navigate(`/routes/${routeId}`);
  };

  const handleAddRoute = () => {
    // Placeholder for add route functionality
    alert(t('routes.list.add'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('routes.list.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('routes.list.error.title')}</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={loadRoutes}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('routes.list.title')}</h1>
            <p className="text-gray-600 mt-1">{routes.length} {t('routes.title').toLowerCase()}</p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              onClick={handleAddRoute}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {t('routes.list.add')}
            </button>
          </div>
        </div>
      </div>

      {/* Route List */}
      {routes.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('routes.list.empty.title')}</h2>
          <p className="text-gray-600">{t('routes.list.empty.message')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {routes.map((route) => (
            <div
              key={route.id}
              onClick={() => handleRouteClick(route.id)}
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow cursor-pointer"
            >
              {/* Route Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6.5" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{route.workType || 'Route'}</h3>
                    <p className="text-sm text-gray-600">{route.status}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(route.status)}`}>
                  {getStatusText(route.status)}
                </span>
              </div>

              {/* Schedule */}
              <div className="flex items-center space-x-2 mb-4">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-600">
                  {route.scheduleStart.toLocaleDateString()} {' '}
                  {route.scheduleStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} - {' '}
                  {route.scheduleEnd.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </span>
              </div>

              {/* Mileage */}
              {(route.startMile || route.endMile) && (
                <div className="flex items-center space-x-2 mb-4">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-sm text-gray-600">
                    {route.startMile && `${route.startMile} mi`} 
                    {route.startMile && route.endMile && ' → '}
                    {route.endMile && `${route.endMile} mi`}
                  </span>
                </div>
              )}

              {/* Income and Distance */}
              <div className="flex items-center justify-between">
                <div className="flex space-x-6">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{t('routes.list.totalIncome')}</p>
                    <p className="text-lg font-semibold text-green-600">{formatCurrency(route.totalIncome || route.estimatedIncome || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Distance</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {(() => {
                        const calculatedDistance = (route.endMile && route.startMile) 
                          ? Math.abs(route.endMile - route.startMile)
                          : route.distance;
                        return getDisplayDistance(calculatedDistance, 'mi', settings.mileageUnit).formatted;
                      })()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RouteList;