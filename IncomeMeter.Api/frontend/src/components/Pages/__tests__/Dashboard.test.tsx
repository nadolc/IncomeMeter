import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { AuthProvider } from '../../../contexts/AuthContext';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import * as api from '../../../utils/api';

// Mock API functions
jest.mock('../../../utils/api', () => ({
  getDashboardStats: jest.fn(),
  getTodaysRoutes: jest.fn(),
}));

// Mock Chart.js
jest.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="line-chart">Line Chart</div>,
  Doughnut: () => <div data-testid="doughnut-chart">Doughnut Chart</div>,
}));

const mockDashboardStats = {
  totalRoutes: 25,
  totalIncome: 1250.75,
  averageIncomePerRoute: 50.03,
  last7DaysIncome: 350.50,
  currentMonthIncome: 1100.25,
  incomeBySource: [
    { source: 'Delivery', amount: 800.00 },
    { source: 'Rideshare', amount: 450.75 }
  ],
  weeklyTrend: [
    { date: '2024-01-01', income: 45.50 },
    { date: '2024-01-02', income: 60.75 }
  ]
};

const mockTodaysRoutes = [
  {
    id: 'route-1',
    workType: 'Delivery',
    status: 'completed',
    scheduleStart: new Date('2024-01-01T09:00:00Z'),
    scheduleEnd: new Date('2024-01-01T17:00:00Z'),
    actualStartTime: new Date('2024-01-01T09:15:00Z'),
    actualEndTime: new Date('2024-01-01T16:45:00Z'),
    totalIncome: 125.50,
    distance: 45.2,
    incomes: [{ source: 'Base Pay', amount: 125.50 }],
    userId: 'user-1',
    estimatedIncome: 120.00,
    startMile: 12345,
    endMile: 12390,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <LanguageProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </LanguageProvider>
  </BrowserRouter>
);

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard with loading state initially', () => {
    (api.getDashboardStats as jest.Mock).mockReturnValue(new Promise(() => {}));
    (api.getTodaysRoutes as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays dashboard stats when data loads successfully', async () => {
    (api.getDashboardStats as jest.Mock).mockResolvedValue(mockDashboardStats);
    (api.getTodaysRoutes as jest.Mock).mockResolvedValue(mockTodaysRoutes);

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('£1,250.75')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('£50.03')).toBeInTheDocument();
    });

    // Check for charts
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();
  });

  it('displays today\'s routes', async () => {
    (api.getDashboardStats as jest.Mock).mockResolvedValue(mockDashboardStats);
    (api.getTodaysRoutes as jest.Mock).mockResolvedValue(mockTodaysRoutes);

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Today\'s Routes')).toBeInTheDocument();
      expect(screen.getByText('Delivery')).toBeInTheDocument();
      expect(screen.getByText('£125.50')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  it('displays no routes message when no routes for today', async () => {
    (api.getDashboardStats as jest.Mock).mockResolvedValue(mockDashboardStats);
    (api.getTodaysRoutes as jest.Mock).mockResolvedValue([]);

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('No routes scheduled for today')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    (api.getDashboardStats as jest.Mock).mockRejectedValue(new Error('API Error'));
    (api.getTodaysRoutes as jest.Mock).mockRejectedValue(new Error('API Error'));

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });
  });

  it('displays correct income trends', async () => {
    (api.getDashboardStats as jest.Mock).mockResolvedValue({
      ...mockDashboardStats,
      last7DaysIncome: 400.00,
      previousWeekIncome: 350.00 // 14.3% increase
    });
    (api.getTodaysRoutes as jest.Mock).mockResolvedValue([]);

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('£400.00')).toBeInTheDocument();
      expect(screen.getByText(/from last week/)).toBeInTheDocument();
    });
  });

  it('formats currency correctly for different amounts', async () => {
    const statsWithVariousAmounts = {
      ...mockDashboardStats,
      totalIncome: 999.99,
      last7DaysIncome: 0.50,
      currentMonthIncome: 10000.00
    };

    (api.getDashboardStats as jest.Mock).mockResolvedValue(statsWithVariousAmounts);
    (api.getTodaysRoutes as jest.Mock).mockResolvedValue([]);

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('£999.99')).toBeInTheDocument();
      expect(screen.getByText('£0.50')).toBeInTheDocument();
      expect(screen.getByText('£10,000.00')).toBeInTheDocument();
    });
  });
});