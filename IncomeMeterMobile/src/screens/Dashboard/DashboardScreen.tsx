import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import StatsCard from '../../components/dashboard/StatsCard';
import PeriodNavigation from '../../components/dashboard/PeriodNavigation';
import { DashboardApiService } from '../../services/dashboardApi';
import { DashboardStats, Route, PeriodType, PeriodIncomeData } from '../../types/dashboard';

const DashboardScreen: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todaysRoutes, setTodaysRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Period navigation state
  const [currentPeriod, setCurrentPeriod] = useState<PeriodType>('weekly');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [periodData, setPeriodData] = useState<PeriodIncomeData | null>(null);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // For development, use mock data
      // In production, replace with actual API calls
      const [dashboardStats, routes, periodStats] = await Promise.all([
        // DashboardApiService.getDashboardStats(),
        // DashboardApiService.getTodaysRoutes(),
        // DashboardApiService.getPeriodStats(currentPeriod, periodOffset),
        Promise.resolve(DashboardApiService.getMockDashboardStats()),
        Promise.resolve(DashboardApiService.getMockTodaysRoutes()),
        Promise.resolve(DashboardApiService.getMockPeriodData(currentPeriod)),
      ]);

      setStats(dashboardStats);
      setTodaysRoutes(routes);
      setPeriodData(periodStats);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert(
        'Error',
        'Failed to load dashboard data. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPeriod, periodOffset]);

  // Period navigation handlers
  const handlePreviousPeriod = useCallback(() => {
    if (periodData?.navigation.canGoPrevious) {
      setPeriodOffset(prev => prev + 1);
    }
  }, [periodData]);

  const handleNextPeriod = useCallback(() => {
    if (periodData?.navigation.canGoNext) {
      setPeriodOffset(prev => prev - 1);
    }
  }, [periodData]);

  const handleToday = useCallback(() => {
    setPeriodOffset(0);
  }, []);

  const getCurrentPeriodDisplay = (): string => {
    if (!periodData) return 'Loading...';

    const startDate = new Date(periodData.startDate);
    const endDate = new Date(periodData.endDate);

    switch (currentPeriod) {
      case 'weekly':
        return `${startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
      case 'monthly':
        return startDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      case 'annual':
        return startDate.getFullYear().toString();
      default:
        return periodData.navigation.currentPeriodLabel;
    }
  };

  // Load data on mount
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
  }, [loadDashboardData]);

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  // Format route status
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return '#10B981';
      case 'in_progress': return '#F59E0B';
      case 'scheduled': return '#6366F1';
      case 'cancelled': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'in_progress': return 'In Progress';
      case 'scheduled': return 'Scheduled';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Welcome back!</Text>
      </View>
      <View>
        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-GB', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      </View>
    </View>
  );

  const renderStatsCards = () => {
    if (!stats) return null;

    return (
      <View style={styles.statsContainer}>
        <StatsCard
          title="Last 7 Days"
          value={formatCurrency(stats.last7DaysIncome)}
          icon={
            <View style={[styles.iconBackground, { backgroundColor: '#D1FAE5' }]}>
              <Icon name="trending-up" size={24} color="#10B981" />
            </View>
          }
        />

        <StatsCard
          title="Current Month"
          value={formatCurrency(stats.currentMonthIncome)}
          icon={
            <View style={[styles.iconBackground, { backgroundColor: '#DBEAFE' }]}>
              <Icon name="assessment" size={24} color="#3B82F6" />
            </View>
          }
        />

        <StatsCard
          title="Net Income"
          value={formatCurrency(stats.netIncome)}
          subtitle={`Avg: ${formatCurrency(stats.averageIncomePerRoute)} per route`}
          icon={
            <View style={[styles.iconBackground, { backgroundColor: '#FEF3C7' }]}>
              <Icon name="account-balance-wallet" size={24} color="#F59E0B" />
            </View>
          }
        />
      </View>
    );
  };

  const renderTodaysRoutes = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Today's Routes</Text>
        <TouchableOpacity>
          <Text style={styles.sectionAction}>View All</Text>
        </TouchableOpacity>
      </View>

      {todaysRoutes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="route" size={48} color="#9CA3AF" />
          <Text style={styles.emptyText}>No routes scheduled for today</Text>
          <TouchableOpacity style={styles.addButton}>
            <Text style={styles.addButtonText}>Add Route</Text>
          </TouchableOpacity>
        </View>
      ) : (
        todaysRoutes.map((route) => (
          <View key={route.id} style={styles.routeCard}>
            <View style={styles.routeHeader}>
              <View>
                <Text style={styles.routeWorkType}>{route.workType || 'Work'}</Text>
                <Text style={styles.routeTime}>
                  {new Date(route.scheduleStart).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })} - {new Date(route.scheduleEnd).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(route.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(route.status) }]}>
                  {getStatusText(route.status)}
                </Text>
              </View>
            </View>

            <View style={styles.routeDetails}>
              <View style={styles.routeDetailItem}>
                <Icon name="attach-money" size={16} color="#6B7280" />
                <Text style={styles.routeDetailText}>
                  {route.totalIncome > 0
                    ? formatCurrency(route.totalIncome)
                    : route.estimatedIncome
                      ? `Est. ${formatCurrency(route.estimatedIncome)}`
                      : 'TBD'
                  }
                </Text>
              </View>
              {route.distance > 0 && (
                <View style={styles.routeDetailItem}>
                  <Icon name="straighten" size={16} color="#6B7280" />
                  <Text style={styles.routeDetailText}>{route.distance.toFixed(1)} km</Text>
                </View>
              )}
            </View>
          </View>
        ))
      )}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Icon name="hourglass-empty" size={48} color="#6366F1" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#6366F1']}
          />
        }
      >
        {renderHeader()}

        {/* Period Navigation */}
        {periodData && (
          <PeriodNavigation
            period={currentPeriod}
            currentPeriodDisplay={getCurrentPeriodDisplay()}
            canGoPrevious={periodData.navigation.canGoPrevious}
            canGoNext={periodData.navigation.canGoNext}
            onPrevious={handlePreviousPeriod}
            onNext={handleNextPeriod}
            onToday={handleToday}
          />
        )}

        {renderStatsCards()}
        {renderTodaysRoutes()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  date: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  iconBackground: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  sectionAction: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  routeWorkType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  routeTime: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  routeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  routeDetailText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
});

export default DashboardScreen;