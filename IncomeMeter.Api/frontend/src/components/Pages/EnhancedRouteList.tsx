import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';
import RouteForm from './RouteForm';
import { getRoutes, getRoutesByStatus, getRoutesByDateRange, deleteRoute } from '../../utils/api';
import { getDisplayDistance } from '../../utils/distance';
import type { Route } from '../../types';


const EnhancedRouteList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency, settings } = useSettings();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [deletingRoute, setDeletingRoute] = useState<Route | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let data: Route[] = [];
      
      console.log('Fetching routes with filters:', { filterStatus, dateRange });
      
      // Apply filters using centralized API functions
      if (filterStatus !== 'all') {
        console.log(`Fetching routes by status: ${filterStatus}`);
        data = await getRoutesByStatus(filterStatus);
      } else if (dateRange.start && dateRange.end) {
        console.log(`Fetching routes by date range: ${dateRange.start} to ${dateRange.end}`);
        data = await getRoutesByDateRange(dateRange.start, dateRange.end);
      } else {
        console.log('Fetching all routes');
        data = await getRoutes();
      }

      console.log('Raw API response:', data);

      const processedRoutes: Route[] = data.map((route: any) => ({
        ...route,
        scheduleStart: new Date(route.scheduleStart),
        scheduleEnd: new Date(route.scheduleEnd),
        actualStartTime: route.actualStartTime ? new Date(route.actualStartTime) : undefined,
        actualEndTime: route.actualEndTime ? new Date(route.actualEndTime) : undefined,
        createdAt: new Date(route.createdAt),
        updatedAt: new Date(route.updatedAt),
      }));
      
      console.log('Processed routes:', processedRoutes);
      setRoutes(processedRoutes);
    } catch (err) {
      console.error('Error fetching routes:', err);
      console.error('Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        name: err instanceof Error ? err.name : undefined
      });
      
      // Provide more detailed error message
      let errorMessage = 'An error occurred while loading routes';
      if (err instanceof Error) {
        if (err.message.includes('<!doctype')) {
          errorMessage = 'API server returned HTML instead of JSON. Please check if the backend server is running on https://localhost:7079';
        } else if (err.message.includes('Network Error') || err.message.includes('fetch')) {
          errorMessage = 'Cannot connect to API server. Please ensure the backend is running on https://localhost:7079';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, dateRange]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const handleCreateRoute = (route: Route) => {
    setRoutes(prev => [route, ...prev]);
    setShowCreateForm(false);
  };

  const handleUpdateRoute = (updatedRoute: Route) => {
    setRoutes(prev => prev.map(route => 
      route.id === updatedRoute.id ? updatedRoute : route
    ));
    setEditingRoute(null);
  };

  const handleDeleteRoute = async (routeId: string) => {
    try {
      await deleteRoute(routeId);
      setRoutes(prev => prev.filter(route => route.id !== routeId));
      setDeletingRoute(null);
    } catch (err) {
      console.error('Error deleting route:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete route');
    }
  };

  // Removed unused handleStartRoute function

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


  if (loading && routes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('routes.list.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('routes.list.title')}</h1>
              <p className="text-gray-600 mt-1">{routes.length} {t('routes.title').toLowerCase()}</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                {t('routes.list.add')}
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">{t('routes.filters.all')}</option>
                <option value="scheduled">{t('routes.filters.scheduled')}</option>
                <option value="in_progress">{t('routes.filters.inProgress')}</option>
                <option value="completed">{t('routes.filters.completed')}</option>
                <option value="cancelled">{t('routes.filters.cancelled')}</option>
              </select>
            </div>
            
            <div className="flex space-x-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {t('routes.list.error.title')}
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-red-600 hover:text-red-800">
                    Troubleshooting Information
                  </summary>
                  <div className="mt-2 text-xs bg-red-100 p-2 rounded">
                    <p><strong>Expected API URL:</strong> {localStorage.getItem('accessToken') ? 'https://localhost:7079/api/routes' : 'No auth token'}</p>
                    <p><strong>Auth Token:</strong> {localStorage.getItem('accessToken') ? '✓ Present' : '✗ Missing'}</p>
                    <p><strong>Common Solutions:</strong></p>
                    <ul className="list-disc list-inside ml-2">
                      <li>Ensure the .NET API server is running on https://localhost:7079</li>
                      <li>Check if you're logged in (refresh the page if needed)</li>
                      <li>Verify CORS settings allow localhost:5173</li>
                    </ul>
                  </div>
                </details>
              </div>
              <div className="mt-4">
                <button
                  onClick={fetchRoutes}
                  className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-md text-sm font-medium"
                >
                  {t('common.retry')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Route List */}
      {routes.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-500 text-lg">{t('routes.list.empty.title')}</div>
          <p className="text-gray-400 mt-2">{t('routes.list.empty.message')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {routes.map((route) => (
            <div key={route.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {route.workType || 'Route'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {new Date(route.scheduleStart).toLocaleDateString()} {' '}
                      {new Date(route.scheduleStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} - {' '}
                      {new Date(route.scheduleEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(route.status)}`}>
                  {getStatusText(route.status)}
                </span>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{t('routes.list.totalIncome')}</p>
                    <p className="text-lg font-semibold text-green-600">
                      {formatCurrency(route.totalIncome || route.estimatedIncome || 0)}
                    </p>
                  </div>
                  {route.distance > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Distance</p>
                      <p className="text-lg font-semibold text-gray-900">{getDisplayDistance(route.distance, 'mi', settings.mileageUnit).formatted}</p>
                    </div>
                  )}
                  {(route.startMile !== undefined || route.endMile !== undefined) && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Mileage</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {getDisplayDistance(route.startMile || 0, 'mi', settings.mileageUnit).value.toFixed(1)} - {getDisplayDistance(route.endMile || 0, 'mi', settings.mileageUnit).formatted}
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Mobile-friendly Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                  <button
                    onClick={() => navigate(`/routes/${route.id}`)}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 text-center"
                  >
                    {t('routes.actions.view')}
                  </button>
                  <button
                    onClick={() => setEditingRoute(route)}
                    className="bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 text-center"
                  >
                    {t('routes.actions.edit')}
                  </button>
                  <button
                    onClick={() => setDeletingRoute(route)}
                    className="bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 text-center"
                  >
                    {t('routes.actions.delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Route Form */}
      {showCreateForm && (
        <RouteForm
          onSave={handleCreateRoute}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Edit Route Form */}
      {editingRoute && (
        <RouteForm
          route={editingRoute}
          onSave={handleUpdateRoute}
          onCancel={() => setEditingRoute(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingRoute && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg font-medium text-gray-900">{t('routes.crud.delete.title')}</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">{t('routes.crud.delete.message')}</p>
              </div>
              <div className="flex justify-center space-x-4 mt-4">
                <button
                  onClick={() => setDeletingRoute(null)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md text-sm font-medium"
                >
                  {t('routes.crud.delete.cancel')}
                </button>
                <button
                  onClick={() => handleDeleteRoute(deletingRoute.id!)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  {t('routes.crud.delete.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedRouteList;