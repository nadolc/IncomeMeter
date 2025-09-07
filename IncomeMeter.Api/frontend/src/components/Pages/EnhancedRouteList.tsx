import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import RouteForm from './RouteForm';
import { getRoutes, getRoutesByStatus, getRoutesByDateRange, deleteRoute, getActiveWorkTypeConfigs } from '../../utils/api';
import MultiSelectDropdown from '../UI/MultiSelectDropdown';
import TimeRangeFilter from '../UI/TimeRangeFilter';
import { getDateRangeFromSelection } from '../../utils/timeRangeUtils';
import { sortRoutes, getSortingOptions, type SortOption } from '../../utils/routeSorting';
import CompactRouteItem from '../UI/CompactRouteItem';
import type { Route, WorkTypeConfig, FilterOption } from '../../types';


const EnhancedRouteList: React.FC = () => {
  const { t } = useTranslation();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [deletingRoute, setDeletingRoute] = useState<Route | null>(null);
  
  // Filter states
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('7_days'); // Default to last 7 days
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([]);
  const [selectedIncomeSources, setSelectedIncomeSources] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('newest'); // Default to newest first
  
  // Filter data
  const [availableWorkTypes, setAvailableWorkTypes] = useState<WorkTypeConfig[]>([]);
  const [availableIncomeSources, setAvailableIncomeSources] = useState<FilterOption[]>([]);

  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let data: Route[] = [];
      
      console.log('Fetching routes with filters:', { filterStatus, timeRange, selectedWorkTypes, selectedIncomeSources });
      
      // Apply API filters (status and date range)
      const dateRangeFilter = getDateRangeFromSelection(timeRange);
      
      if (filterStatus !== 'all') {
        console.log(`Fetching routes by status: ${filterStatus}`);
        data = await getRoutesByStatus(filterStatus);
      } else if (dateRangeFilter) {
        console.log(`Fetching routes by date range: ${dateRangeFilter.start} to ${dateRangeFilter.end}`);
        const startStr = dateRangeFilter.start.toISOString().split('T')[0];
        const endStr = dateRangeFilter.end.toISOString().split('T')[0];
        data = await getRoutesByDateRange(startStr, endStr);
      } else {
        console.log('Fetching all routes');
        data = await getRoutes();
      }

      console.log('Raw API response:', data);

      let processedRoutes: Route[] = data.map((route: Route) => ({
        ...route,
        scheduleStart: new Date(route.scheduleStart),
        scheduleEnd: new Date(route.scheduleEnd),
        actualStartTime: route.actualStartTime ? new Date(route.actualStartTime) : undefined,
        actualEndTime: route.actualEndTime ? new Date(route.actualEndTime) : undefined,
        createdAt: new Date(route.createdAt),
        updatedAt: new Date(route.updatedAt),
      }));
      
      // Apply client-side filters for work types and income sources
      if (selectedWorkTypes.length > 0) {
        processedRoutes = processedRoutes.filter(route => 
          route.workType && selectedWorkTypes.includes(route.workType)
        );
      }
      
      if (selectedIncomeSources.length > 0) {
        processedRoutes = processedRoutes.filter(route => 
          route.incomes.some(income => selectedIncomeSources.includes(income.source))
        );
      }
      
      // Apply sorting
      processedRoutes = sortRoutes(processedRoutes, sortOption);
      
      console.log('Filtered and sorted routes:', processedRoutes);
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
  }, [filterStatus, timeRange, selectedWorkTypes, selectedIncomeSources, sortOption]);

  // Fetch work types on component mount
  const fetchWorkTypes = useCallback(async () => {
    try {
      const workTypes = await getActiveWorkTypeConfigs();
      setAvailableWorkTypes(workTypes);
    } catch (err) {
      console.error('Failed to fetch work types:', err);
    }
  }, []);

  // Build unique income sources from all routes
  const buildIncomeSourcesOptions = useMemo(() => {
    const sources = new Set<string>();
    routes.forEach(route => {
      route.incomes.forEach(income => {
        if (income.source.trim()) {
          sources.add(income.source);
        }
      });
    });
    
    return Array.from(sources)
      .sort()
      .map(source => ({
        id: source,
        label: source
      }));
  }, [routes]);

  useEffect(() => {
    setAvailableIncomeSources(buildIncomeSourcesOptions);
  }, [buildIncomeSourcesOptions]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  useEffect(() => {
    fetchWorkTypes();
  }, [fetchWorkTypes]);

  // Memoized filter options
  const workTypeOptions = useMemo(() => 
    availableWorkTypes.map(workType => ({
      id: workType.name,
      label: workType.name
    })),
    [availableWorkTypes]
  );

  // Memoized sorting options
  const sortingOptions = useMemo(() => getSortingOptions(t), [t]);

  // Filter utility functions
  const getActiveFilterCount = () => {
    let count = 0;
    if (filterStatus !== 'all') count++;
    if (timeRange !== 'all') count++;
    if (selectedWorkTypes.length > 0) count++;
    if (selectedIncomeSources.length > 0) count++;
    if (sortOption !== 'newest') count++; // Count non-default sorting as active filter
    return count;
  };

  const clearAllFilters = () => {
    setFilterStatus('all');
    setTimeRange('7_days'); // Reset to default
    setSelectedWorkTypes([]);
    setSelectedIncomeSources([]);
    setSortOption('newest'); // Reset to default
  };

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

  // Removed unused helper functions - moved to CompactRouteItem


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
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('routes.list.title')}</h1>
              <p className="text-gray-600 mt-1">{routes.length} {t('routes.title').toLowerCase()}</p>
            </div>
            <div className="flex items-center space-x-2">
              {/* Mobile Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="md:hidden flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707v4.586l-4-2V14.414a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>{showFilters ? t('routes.filters.hideFilters') : t('routes.filters.showFilters')}</span>
                {getActiveFilterCount() > 0 && (
                  <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
                    {getActiveFilterCount()}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                {t('routes.list.add')}
              </button>
            </div>
          </div>

          {/* Filters - Always visible on desktop, toggleable on mobile */}
          <div className={`${showFilters ? 'block' : 'hidden'} md:block`}>
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              {/* First row: Status, Time Range, Work Types, Income Sources, and Sorting */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('routes.filters.all').replace(' Routes', '')}
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                  >
                    <option value="all">{t('routes.filters.all')}</option>
                    <option value="scheduled">{t('routes.filters.scheduled')}</option>
                    <option value="in_progress">{t('routes.filters.inProgress')}</option>
                    <option value="completed">{t('routes.filters.completed')}</option>
                    <option value="cancelled">{t('routes.filters.cancelled')}</option>
                  </select>
                </div>
                
                <TimeRangeFilter
                  selectedRange={timeRange}
                  onRangeChange={setTimeRange}
                  label={t('routes.filters.timeRange.label')}
                />
                
                <MultiSelectDropdown
                  options={workTypeOptions}
                  selectedValues={selectedWorkTypes}
                  onSelectionChange={setSelectedWorkTypes}
                  placeholder={t('common.selectAll')}
                  label={t('routes.filters.workTypes')}
                />
                
                <MultiSelectDropdown
                  options={availableIncomeSources}
                  selectedValues={selectedIncomeSources}
                  onSelectionChange={setSelectedIncomeSources}
                  placeholder={t('common.selectAll')}
                  label={t('routes.filters.incomeSources')}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('routes.filters.sorting.label')}
                  </label>
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                  >
                    {sortingOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Clear filters button */}
              {getActiveFilterCount() > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={clearAllFilters}
                    className="text-sm text-gray-600 hover:text-gray-800 underline"
                  >
                    {t('common.clearAll')} ({getActiveFilterCount()})
                  </button>
                </div>
              )}
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
            <CompactRouteItem
              key={route.id}
              route={route}
              onEdit={setEditingRoute}
              onDelete={setDeletingRoute}
            />
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