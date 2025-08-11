import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import type { DashboardStats, Route } from '../../types';
import { getDashboardStats, getTodaysRoutes } from '../../utils/api';
import { getDisplayDistance } from '../../utils/distance';

const Dashboard: React.FC = () => {
  const { formatCurrency, settings } = useSettings();
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todaysRoutes, setTodaysRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashboardStats, routes] = await Promise.all([
        getDashboardStats(),
        getTodaysRoutes(),
      ]);
      
      setStats(dashboardStats);
      setTodaysRoutes(routes);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t('errors.generic')}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="dashboard-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
            <p className="text-gray-600 mt-1">{t('dashboard.welcome')}</p>
          </div>
          <div className="mt-4 sm:mt-0">
            <span className="text-sm text-gray-500">{new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Last 7 Days Total Income */}
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">{t('dashboard.stats.last7Days')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatCurrency(stats.last7DaysIncome)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-green-600 font-medium">+12% {t('dashboard.trends.fromLastWeek')}</span>
          </div>
        </div>

        {/* Current Month Pie Chart */}
        <div className="stats-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">{t('dashboard.stats.currentMonth')}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{t('dashboard.stats.incomeBySource')}</p>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(stats.incomeBySource)
              .sort(([,a], [,b]) => b - a) // Sort by income amount descending
              .map(([workType, amount], index) => {
                const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-red-500', 'bg-indigo-500'];
                const colorClass = colors[index % colors.length];
                
                return (
                  <div key={workType} className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 ${colorClass} rounded-full mr-2`}></div>
                      <span className="text-gray-600 capitalize">{workType}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(amount)}</span>
                  </div>
                );
              })}
            {Object.keys(stats.incomeBySource).length === 0 && (
              <div className="text-center py-4">
                <span className="text-gray-500 text-sm">No completed routes this month</span>
              </div>
            )}
          </div>
        </div>

        {/* Net Income Current Month */}
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">{t('dashboard.stats.netIncome')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatCurrency(stats.netIncome)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-blue-600 font-medium">Current month total</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Bar Chart - Last 7 Days */}
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Last 7 Days Income</h3>
          </div>
          <div className="space-y-3">
            {(() => {
              // Calculate max income for proper bar scaling
              const maxIncome = Math.max(...stats.dailyIncomeData.map(d => d.income), 1);
              
              return stats.dailyIncomeData.map((day, index) => (
                <div key={day.date} className="grid grid-cols-12 gap-3 items-center">
                  {/* Date column - fixed width */}
                  <div className="col-span-2">
                    <span className="text-sm text-gray-600 font-medium">
                      {new Date(day.date).toLocaleDateString('en-US', { 
                        weekday: 'short',
                        month: 'numeric',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  
                  {/* Bar chart column - flexible width */}
                  <div className="col-span-7">
                    <div className="bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{ 
                          width: maxIncome > 0 ? `${(day.income / maxIncome) * 100}%` : '0%'
                        }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Amount column - fixed width, right aligned */}
                  <div className="col-span-3 text-right">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(day.income)}
                    </span>
                  </div>
                </div>
              ));
            })()}
            
            {/* Show message if no data */}
            {stats.dailyIncomeData.length === 0 && (
              <div className="text-center py-8">
                <span className="text-gray-500 text-sm">No income data for the last 7 days</span>
              </div>
            )}
          </div>
        </div>

        {/* Today's Routes */}
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">{t('dashboard.todayRoutes.title')}</h3>
            <span className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
          <div className="space-y-4">
            {todaysRoutes.length > 0 ? (
              todaysRoutes.map((route) => (
                <div key={route.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-full">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{route.name}</p>
                      <p className="text-sm text-gray-600">
                        {route.startTime?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - {route.endTime?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(route.estimatedIncome ?? route.totalIncome ?? 0)}</p>
                    <p className="text-sm text-gray-600">{getDisplayDistance(route.distance, 'mi', settings.mileageUnit).formatted}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <p className="text-gray-500">{t('dashboard.todayRoutes.noRoutes')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;