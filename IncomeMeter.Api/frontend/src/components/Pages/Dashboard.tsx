import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import type { DashboardStats, Route, PeriodIncomeData, PeriodType } from '../../types';
import { getDashboardStats, getTodaysRoutes, getPeriodStats } from '../../utils/api';
import { getDisplayDistance } from '../../utils/distance';
import { formatHoursCompact } from '../../utils/time';
import { formatPeriodDisplay } from '../../utils/fiscalYear';
import PeriodSelector from '../Dashboard/PeriodSelector';
import PeriodNavigation from '../Dashboard/PeriodNavigation';
import PeriodChart from '../Dashboard/PeriodChart';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { formatCurrency, settings } = useSettings();
  const { t, language } = useLanguage();
  
  // Legacy stats for overview cards
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todaysRoutes, setTodaysRoutes] = useState<Route[]>([]);
  
  // New period-based state
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('weekly');
  const [periodOffset, setPeriodOffset] = useState<number>(0);
  const [periodData, setPeriodData] = useState<PeriodIncomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [expandedWorkTypes, setExpandedWorkTypes] = useState<Set<string>>(new Set());
  
  // Swipe gesture state
  const [isSwipeAnimating, setIsSwipeAnimating] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(true);

  // Period data cache
  const [periodCache, setPeriodCache] = useState<Map<string, PeriodIncomeData>>(new Map());
  const MAX_CACHE_SIZE = 50;

  // Load legacy data on mount
  useEffect(() => {
    loadOverviewData();
  }, []);

  // Cache utility functions
  const getCacheKey = useCallback((period: PeriodType, offset: number, fiscalStart: string): string => {
    return `${period}-${offset}-${fiscalStart}`;
  }, []);

  const addToCache = useCallback((key: string, data: PeriodIncomeData) => {
    setPeriodCache(prev => {
      const newCache = new Map(prev);
      
      // Remove oldest entries if cache is full (LRU eviction)
      if (newCache.size >= MAX_CACHE_SIZE) {
        const firstKey = newCache.keys().next().value;
        if (firstKey) {
          newCache.delete(firstKey);
        }
        console.log('🗑️ Cache evicted oldest entry:', firstKey ?? 'unknown');
      }
      
      newCache.set(key, data);
      console.log('💾 Cached data:', key, `(${newCache.size}/${MAX_CACHE_SIZE})`);
      return newCache;
    });
  }, [MAX_CACHE_SIZE]);

  const getCachedData = useCallback((key: string): PeriodIncomeData | null => {
    const cached = periodCache.get(key);
    if (cached) {
      console.log('📦 Cache hit:', key);
      return cached;
    }
    console.log('❌ Cache miss:', key);
    return null;
  }, [periodCache]);

  const invalidateCache = useCallback(() => {
    setPeriodCache(new Map());
    console.log('🗑️ Period cache invalidated');
  }, []);

  // Load period data when period or offset changes
  useEffect(() => {
    loadPeriodData();
  }, [selectedPeriod, periodOffset, settings.fiscalYearStartDate]);

  const loadOverviewData = async () => {
    try {
      console.log('Loading overview dashboard data...');
      
      const [dashboardStats, routes] = await Promise.all([
        getDashboardStats().catch(err => {
          console.error('Dashboard stats error:', err);
          throw err;
        }),
        getTodaysRoutes().catch(err => {
          console.error('Today\'s routes error:', err);
          throw err;
        }),
      ]);
      
      setStats(dashboardStats);
      setTodaysRoutes(routes);
    } catch (error) {
      console.error('Error loading overview data:', error);
      setStats(null);
      setTodaysRoutes([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPeriodData = useCallback(async () => {
    const cacheKey = getCacheKey(selectedPeriod, periodOffset, settings.fiscalYearStartDate ?? '04-06');
    
    // Check cache first
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      setPeriodData(cachedData);
      return; // Exit early - no API call needed!
    }
    
    // Not in cache - fetch from API
    setPeriodLoading(true);
    try {
      console.log('🌐 Loading period data from API:', { selectedPeriod, periodOffset, fiscalStartDate: settings.fiscalYearStartDate });
      
      const data = await getPeriodStats(
        selectedPeriod,
        periodOffset,
        settings.fiscalYearStartDate ?? '04-06'
      );
      
      console.log('✅ Period data loaded:', data);
      
      // Store in cache
      addToCache(cacheKey, data);
      
      // Update state
      setPeriodData(data);
    } catch (error) {
      console.error('❌ Error loading period data:', error);
      setPeriodData(null);
    } finally {
      setPeriodLoading(false);
    }
  }, [selectedPeriod, periodOffset, settings.fiscalYearStartDate, getCacheKey, getCachedData, addToCache]);

  const handlePeriodChange = (newPeriod: PeriodType) => {
    setSelectedPeriod(newPeriod);
    setPeriodOffset(0); // Reset to current period when changing period type
  };

  const handlePreviousPeriod = useCallback(() => {
    setPeriodOffset(offset => offset - 1);
  }, []);

  const handleNextPeriod = useCallback(() => {
    setPeriodOffset(offset => offset + 1);
  }, []);

  const handleToday = useCallback(() => {
    setPeriodOffset(0);
  }, []);

  // Swipe gesture handlers
  const handleSwipeLeft = useCallback(() => {
    if (isSwipeAnimating || !periodData?.navigation?.canGoNext) return;
    
    setSwipeDirection('left');
    setIsSwipeAnimating(true);
    
    // Brief animation delay before navigation
    setTimeout(() => {
      handleNextPeriod();
      setSwipeDirection(null);
      setIsSwipeAnimating(false);
    }, 200);
  }, [isSwipeAnimating, periodData, handleNextPeriod]);

  const handleSwipeRight = useCallback(() => {
    if (isSwipeAnimating) return;
    
    setSwipeDirection('right');
    setIsSwipeAnimating(true);
    
    // Brief animation delay before navigation
    setTimeout(() => {
      handlePreviousPeriod();
      setSwipeDirection(null);
      setIsSwipeAnimating(false);
    }, 200);
  }, [isSwipeAnimating, handlePreviousPeriod]);

  const handleDoubleTap = useCallback(() => {
    // Only allow double-tap to return to today if we're not already on current period
    if (periodOffset !== 0) {
      setIsSwipeAnimating(true);
      
      // Show brief feedback for double-tap action
      setSwipeDirection('right'); // Use right direction as feedback
      setTimeout(() => {
        handleToday();
        setSwipeDirection(null);
        setIsSwipeAnimating(false);
      }, 150);
    }
  }, [periodOffset, handleToday]);

  // Configure swipe handlers
  const swipeHandlers = useSwipeable({
    onSwipedLeft: handleSwipeLeft,
    onSwipedRight: handleSwipeRight,
    onTap: handleDoubleTap,
    onSwiping: () => {
      // Hide hint on first swipe interaction
      if (showSwipeHint) {
        setShowSwipeHint(false);
      }
    },
    trackTouch: true,
    trackMouse: false, // Disable mouse swipes for desktop
    preventScrollOnSwipe: true,
    delta: 50, // Minimum swipe distance
    swipeDuration: 250, // Maximum swipe duration
    touchEventOptions: { passive: false },
  });

  // Refresh data and clear cache
  const handleRefresh = useCallback(async () => {
    console.log('🔄 Manual refresh triggered');
    invalidateCache();
    await loadOverviewData();
    await loadPeriodData();
  }, [invalidateCache, loadPeriodData]);

  // Add keyboard shortcut for cache debugging and auto-invalidation on visibility change
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Shift+C to log cache contents
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        console.log('📊 Cache contents:', Array.from(periodCache.entries()));
        console.log('📊 Cache size:', periodCache.size);
      }
      // Ctrl+Shift+R to force refresh and clear cache
      if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        event.preventDefault();
        handleRefresh();
      }
    };

    // Auto-refresh when page becomes visible again (user may have modified data elsewhere)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Optionally clear cache when user returns to dashboard
        // This ensures fresh data if they modified routes in another tab
        console.log('👁️ Dashboard became visible - consider refreshing cache');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [periodCache, handleRefresh]);

  const getCurrentPeriodDisplay = (): string => {
    if (!periodData) return '';
    return formatPeriodDisplay(
      selectedPeriod,
      new Date(periodData.startDate ?? new Date()),
      settings.fiscalYearStartDate ?? '04-06',
      language
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div 
      {...swipeHandlers} 
      className={`space-y-6 transition-transform duration-200 ${
        isSwipeAnimating && swipeDirection === 'left' ? 'transform -translate-x-2' : 
        isSwipeAnimating && swipeDirection === 'right' ? 'transform translate-x-2' : ''
      }`}
    >
      {/* Swipe Hint for First-time Users */}
      {periodData && showSwipeHint && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 flex items-center space-x-2 bg-blue-600 bg-opacity-90 text-white px-4 py-2 rounded-full text-sm shadow-lg animate-pulse md:hidden">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Swipe to navigate • Double-tap to return</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
      
      {/* Swipe Action Indicator */}
      {periodData && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center space-x-2 bg-gray-900 bg-opacity-75 text-white px-3 py-1 rounded-full text-sm transition-opacity duration-300 md:hidden" 
             style={{ opacity: isSwipeAnimating ? 1 : 0, pointerEvents: 'none' }}>
          {swipeDirection === 'left' && (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>Next Period</span>
            </>
          )}
          {swipeDirection === 'right' && (
            <>
              <span>{periodOffset !== 0 ? 'Return to Today' : 'Previous Period'}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </>
          )}
        </div>
      )}
      
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

      {/* Quick Stats Overview (Legacy) */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Last 7 Days */}
          <div className="stats-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">{t('dashboard.stats.last7Days')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {formatCurrency(stats.last7DaysIncome)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>

          {/* Current Month */}
          <div className="stats-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">{t('dashboard.stats.currentMonth')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {formatCurrency(stats.currentMonthIncome)}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Net Income */}
          <div className="stats-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">{t('dashboard.stats.netIncome')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {formatCurrency(stats.netIncome)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Period Selection */}
      <div className="dashboard-card">
        <div className="flex flex-col gap-4">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-3">
                          <h2 className="text-xl font-semibold text-gray-900">{t('dashboard.incomeAnalysis')}</h2>
              {periodCache.size > 0 && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full" 
                      title={`${periodCache.size} periods cached for instant access`}>
                  📦 {periodCache.size} cached
                </span>
              )}
            </div>
          </div>
          
          {/* Controls row - separate on mobile for better spacing */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <PeriodSelector 
              selectedPeriod={selectedPeriod}
              onPeriodChange={handlePeriodChange}
              className="flex-shrink-0"
            />
            <button
              onClick={handleRefresh}
              className="flex items-center justify-center sm:justify-start px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200 flex-shrink-0"
              title="Refresh data and clear cache (Ctrl+Shift+R)"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
                          <span className="hidden sm:inline">{t('dashboard.refresh')}</span>
                          <span className="sm:hidden">{t('dashboard.refresh')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Period Navigation */}
      {periodData && (
        <PeriodNavigation
          period={selectedPeriod}
          currentPeriodDisplay={getCurrentPeriodDisplay()}
          canGoPrevious={true}
          canGoNext={periodData.navigation?.canGoNext ?? true}
          onPrevious={handlePreviousPeriod}
          onNext={handleNextPeriod}
          onToday={handleToday}
        />
      )}

      {/* Period Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          {periodLoading ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            </div>
          ) : periodData ? (
            <PeriodChart
              period={selectedPeriod}
              data={periodData.chartData?.map((item: { label: string; date: string; income: number; routes: number; distance: number }) => ({
                label: item.label,
                date: item.date,
                income: item.income,
                routes: item.routes,
                distance: item.distance
              })) ?? []}
              currentPeriodDisplay={getCurrentPeriodDisplay()}
            />
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-center py-12">
                <p className="text-gray-500">{t('errors.generic')}</p>
                <button
                  onClick={loadPeriodData}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {t('common.retry')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Income by Source (Period-specific) */}
        <div className="dashboard-card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.stats.incomeBySource')}</h3>
          {periodData && Object.keys(periodData.incomeBySource).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(periodData.incomeBySource)
                .sort(([,a], [,b]) => ((b as { income: number }).income - (a as { income: number }).income))
                .map(([workType, stats], index) => {
                  const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-red-500', 'bg-indigo-500'];
                  const colorClass = colors[index % colors.length];
                  const workTypeStats = stats as { 
                    income: number; 
                    routes: number; 
                    totalWorkingHours: number; 
                    hourlyRate: number; 
                    totalMileage: number; 
                    earningsPerMile: number; 
                    incomeBySource?: Record<string, number>; 
                  };
                  const isExpanded = expandedWorkTypes.has(workType);
                  const hasIncomeSources = workTypeStats.incomeBySource && Object.keys(workTypeStats.incomeBySource).length > 0;
                  
                  const toggleExpanded = () => {
                    setExpandedWorkTypes(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(workType)) {
                        newSet.delete(workType);
                      } else {
                        newSet.add(workType);
                      }
                      return newSet;
                    });
                  };
                  
                  return (
                    <div key={workType} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      {/* Header with color indicator and work type */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 ${colorClass} rounded-full mr-2`}></div>
                          <span className="text-gray-800 font-medium capitalize">{workType}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">{workTypeStats.routes} {t('routes.title').toLowerCase()}</span>
                          {hasIncomeSources && (
                            <button
                              onClick={toggleExpanded}
                              className="p-1 text-gray-500 hover:text-gray-700 transition-colors duration-200"
                              title={isExpanded ? t('dashboard.stats.collapseDetails') : t('dashboard.stats.expandDetails')}
                            >
                              <svg className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Main income display */}
                      <div className="mb-3">
                        <div className="text-2xl font-bold text-gray-900">
                          {formatCurrency(workTypeStats.income || 0)}
                        </div>
                      </div>
                      
                      {/* Metrics grid */}
                      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                        <div className="flex flex-col">
                          <span className="text-gray-600">{t('dashboard.stats.workingTime')}</span>
                          <span className="font-medium text-gray-900">
                            {formatHoursCompact(workTypeStats.totalWorkingHours || 0)}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-600">{t('dashboard.stats.hourlyRate')}</span>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(workTypeStats.hourlyRate || 0)}/h
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-600">{t('dashboard.stats.totalDistance')}</span>
                          <span className="font-medium text-gray-900">
                            {getDisplayDistance(workTypeStats.totalMileage || 0, 'mi', settings.mileageUnit).formatted}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-600">{t('dashboard.stats.earningsPerMile')}</span>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(workTypeStats.earningsPerMile || 0)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Expandable Income Sources Section */}
                      {hasIncomeSources && isExpanded && (
                        <div className="pt-4 border-t border-gray-300">
                          <div className="flex items-center mb-3">
                            <div className={`w-2 h-2 ${colorClass} rounded-full mr-2`}></div>
                            <h4 className="text-sm font-medium text-gray-800">{t('dashboard.stats.sourceBreakdown')}</h4>
                          </div>
                          
                          <div className="space-y-2">
                            {Object.entries(workTypeStats.incomeBySource || {})
                              .sort(([,a], [,b]) => (b as number) - (a as number))
                              .map(([source, amount]) => {
                                const percentage = ((amount as number) / workTypeStats.income * 100).toFixed(1);
                                const barWidth = Math.max(5, (amount as number) / workTypeStats.income * 100);
                                
                                return (
                                  <div key={source} className="space-y-1">
                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-gray-700 capitalize">{source}</span>
                                      <div className="text-right">
                                        <span className="font-medium text-gray-900">{formatCurrency(amount as number)}</span>
                                        <span className="text-xs text-gray-500 ml-1">({percentage}%)</span>
                                      </div>
                                    </div>
                                    
                                    {/* Progress Bar */}
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div 
                                        className={`h-2 rounded-full ${colorClass} opacity-60`}
                                        style={{ width: `${barWidth}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                );
                              })
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="text-center py-8">
              <span className="text-gray-500 text-sm">{t('dashboard.charts.noDataPeriod', { period: t(`dashboard.periods.${selectedPeriod}`) })}</span>
            </div>
          )}
        </div>
      </div>

      {/* Today's Routes */}
      <div className="dashboard-card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">{t('dashboard.todayRoutes.title')}</h3>
          <span className="text-sm text-gray-500">{new Date().toLocaleDateString(language, { month: 'short', day: 'numeric' })}</span>
        </div>
        <div className="space-y-4">
          {todaysRoutes.length > 0 ? (
            todaysRoutes.map((route) => (
              <div 
                key={route.id} 
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                onClick={() => navigate(`/routes/${route.id}`)}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{route.workType}</p>
                    <p className="text-sm text-gray-600">
                      {route.scheduleStart?.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })} - {route.scheduleEnd?.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatCurrency(route.totalIncome ?? 0)}</p>
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
  );
};

export default Dashboard;