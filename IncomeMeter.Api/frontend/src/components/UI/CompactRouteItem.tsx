import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';
import { getDisplayDistance } from '../../utils/distance';
import type { Route } from '../../types';

interface CompactRouteItemProps {
  route: Route;
  onEdit: (route: Route) => void;
  onDelete: (route: Route) => void;
}

const CompactRouteItem: React.FC<CompactRouteItemProps> = ({ route, onEdit, onDelete }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency, settings } = useSettings();

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

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleDateString(settings.language, { 
      month: 'short', 
      day: 'numeric'
    }) + ' ' + 
    new Date(date).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
  };

  const formatTimeRange = (start: Date, end: Date) => {
    const startTime = new Date(start).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
    const endTime = new Date(end).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
    return `${startTime} - ${endTime}`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200 px-4">
      {/* Mobile Layout - Tappable Area */}
      <div className="block md:hidden">
        {/* Main tappable area */}
        <div 
          className="p-3 cursor-pointer active:bg-gray-50 transition-colors duration-200"
          onClick={() => navigate(`/routes/${route.id}`)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {route.workType || 'Route'}
              </h3>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(route.status)}`}>
                {getStatusText(route.status)}
              </span>
            </div>
            <div className="text-sm font-semibold text-green-600">
              {formatCurrency(route.totalIncome || route.estimatedIncome || 0)}
            </div>
          </div>
          
          <div className="text-xs text-gray-600 mb-2">
            <div>{formatDateTime(route.scheduleStart)}</div>
            <div>{formatTimeRange(route.scheduleStart, route.scheduleEnd)}</div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex space-x-4 text-xs text-gray-500">
              {route.distance > 0 && (
                <span>{getDisplayDistance(route.distance, 'mi', settings.mileageUnit).formatted}</span>
              )}
              {(route.startMile !== undefined || route.endMile !== undefined) && (
                <span>
                  {getDisplayDistance(route.startMile || 0, 'mi', settings.mileageUnit).value.toFixed(0)} - {getDisplayDistance(route.endMile || 0, 'mi', settings.mileageUnit).value.toFixed(0)}
                </span>
              )}
            </div>
            
            {/* Small tap-to-view indicator */}
            <div className="text-xs text-blue-600 font-medium">
              {t('routes.actions.tapToView') || 'Tap to view'}
            </div>
          </div>
        </div>
        
        {/* Action buttons row - separated from tappable area */}
        <div className="px-3 pb-3 border-t border-gray-100">
          <div className="flex justify-end space-x-2 mt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(route);
              }}
              className="bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-medium transition-colors duration-200"
            >
              {t('routes.actions.edit')}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(route);
              }}
              className="bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1 rounded text-xs font-medium transition-colors duration-200"
            >
              {t('routes.actions.delete')}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Layout - Horizontal Grid */}
      <div className="hidden md:grid md:grid-cols-12 md:gap-3 md:items-center">
        {/* Work Type & Status - 3 cols */}
        <div className="col-span-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {route.workType || 'Route'}
            </h3>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(route.status)}`}>
              {getStatusText(route.status)}
            </span>
          </div>
        </div>

        {/* Date & Time - 2 cols */}
        <div className="col-span-2">
          <div className="text-xs text-gray-600">
            <div className="font-medium">{new Date(route.scheduleStart).toLocaleDateString(settings.language, { month: 'short', day: 'numeric' })}</div>
            <div>{formatTimeRange(route.scheduleStart, route.scheduleEnd)}</div>
          </div>
        </div>

        {/* Income - 2 cols */}
        <div className="col-span-2">
          <div className="text-sm font-semibold text-green-600">
            {formatCurrency(route.totalIncome || route.estimatedIncome || 0)}
          </div>
        </div>

        {/* Distance & Mileage - 2 cols */}
        <div className="col-span-2">
          <div className="text-xs text-gray-500">
            {route.distance > 0 && (
              <div>{getDisplayDistance(route.distance, 'mi', settings.mileageUnit).formatted}</div>
            )}
            {(route.startMile !== undefined || route.endMile !== undefined) && (
              <div>
                {getDisplayDistance(route.startMile || 0, 'mi', settings.mileageUnit).value.toFixed(0)} - {getDisplayDistance(route.endMile || 0, 'mi', settings.mileageUnit).value.toFixed(0)}
              </div>
            )}
          </div>
        </div>

        {/* Actions - 3 cols */}
        <div className="col-span-3">
          <div className="flex justify-end space-x-1">
            <button
              onClick={() => navigate(`/routes/${route.id}`)}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium transition-colors duration-200"
            >
              {t('routes.actions.view')}
            </button>
            <button
              onClick={() => onEdit(route)}
              className="bg-gray-50 hover:bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium transition-colors duration-200"
            >
              {t('routes.actions.edit')}
            </button>
            <button
              onClick={() => onDelete(route)}
              className="bg-red-50 hover:bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium transition-colors duration-200"
            >
              {t('routes.actions.delete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompactRouteItem;