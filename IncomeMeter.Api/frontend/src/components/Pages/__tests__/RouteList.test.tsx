import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import RouteList from '../RouteList';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import { SettingsProvider } from '../../../contexts/SettingsContext';
import * as api from '../../../utils/api';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock API functions
jest.mock('../../../utils/api', () => ({
  getRoutes: jest.fn(),
}));

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock window.alert
const mockAlert = jest.fn();
Object.defineProperty(window, 'alert', {
  value: mockAlert,
  writable: true,
});

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <LanguageProvider>
      <SettingsProvider>
        {children}
      </SettingsProvider>
    </LanguageProvider>
  </BrowserRouter>
);

const mockGetRoutes = api.getRoutes as jest.Mock;

const mockRoutes = [
  {
    id: 'route-1',
    userId: 'user-123',
    workType: 'Delivery',
    status: 'completed',
    scheduleStart: '2024-01-01T09:00:00Z',
    scheduleEnd: '2024-01-01T12:00:00Z',
    actualStartTime: '2024-01-01T09:05:00Z',
    actualEndTime: '2024-01-01T11:55:00Z',
    distance: 25.5,
    startMile: 12345.0,
    endMile: 12370.5,
    totalIncome: 150.75,
    estimatedIncome: 160.00,
    incomes: [
      { source: 'Base Pay', amount: 120.00 },
      { source: 'Tips', amount: 30.75 }
    ],
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T12:05:00Z'
  },
  {
    id: 'route-2',
    userId: 'user-123',
    workType: 'Rideshare',
    status: 'scheduled',
    scheduleStart: '2024-01-02T14:00:00Z',
    scheduleEnd: '2024-01-02T18:00:00Z',
    actualStartTime: null,
    actualEndTime: null,
    distance: 30.2,
    startMile: null,
    endMile: null,
    totalIncome: 0,
    estimatedIncome: 180.00,
    incomes: [],
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z'
  },
  {
    id: 'route-3',
    userId: 'user-123',
    workType: 'Private Hire',
    status: 'in_progress',
    scheduleStart: '2024-01-03T10:00:00Z',
    scheduleEnd: '2024-01-03T16:00:00Z',
    actualStartTime: '2024-01-03T10:15:00Z',
    actualEndTime: null,
    distance: 0,
    startMile: 12400.0,
    endMile: null,
    totalIncome: 0,
    estimatedIncome: 200.00,
    incomes: [],
    createdAt: '2024-01-02T08:00:00Z',
    updatedAt: '2024-01-03T10:15:00Z'
  }
];

describe('RouteList Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRoutes.mockResolvedValue(mockRoutes);
  });

  it('renders loading state initially', async () => {
    // Mock delayed response
    mockGetRoutes.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockRoutes), 100))
    );

    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    expect(screen.getByText('routes.list.loading')).toBeInTheDocument();
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('routes.list.loading')).not.toBeInTheDocument();
    });
  });

  it('renders route list when data loads successfully', async () => {
    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check page title and count
      expect(screen.getByText('routes.list.title')).toBeInTheDocument();
      expect(screen.getByText('3 routes.title')).toBeInTheDocument();

      // Check add route button
      expect(screen.getByText('routes.list.add')).toBeInTheDocument();

      // Check route cards
      expect(screen.getByText('Delivery')).toBeInTheDocument();
      expect(screen.getByText('Rideshare')).toBeInTheDocument();
      expect(screen.getByText('Private Hire')).toBeInTheDocument();

      // Check route statuses
      expect(screen.getByText('routes.status.completed')).toBeInTheDocument();
      expect(screen.getByText('routes.status.scheduled')).toBeInTheDocument();
      expect(screen.getByText('routes.status.inProgress')).toBeInTheDocument();
    });
  });

  it('displays empty state when no routes are available', async () => {
    mockGetRoutes.mockResolvedValue([]);

    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('routes.list.empty.title')).toBeInTheDocument();
      expect(screen.getByText('routes.list.empty.message')).toBeInTheDocument();
      expect(screen.getByText('0 routes.title')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    mockGetRoutes.mockRejectedValue(new Error('Failed to fetch routes'));

    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('routes.list.error.title')).toBeInTheDocument();
      expect(screen.getByText('routes.list.error.message')).toBeInTheDocument();
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
  });

  it('navigates to route details when route card is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Delivery')).toBeInTheDocument();
    });

    const routeCard = screen.getByText('Delivery').closest('[role="button"]');
    expect(routeCard).toBeInTheDocument();

    await user.click(routeCard!);

    expect(mockNavigate).toHaveBeenCalledWith('/routes/route-1');
  });

  it('shows alert when add route button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('routes.list.add')).toBeInTheDocument();
    });

    const addButton = screen.getByText('routes.list.add');
    await user.click(addButton);

    expect(mockAlert).toHaveBeenCalledWith('routes.list.add');
  });

  it('retries loading when retry button is clicked', async () => {
    const user = userEvent.setup();
    
    // First call fails, second succeeds
    mockGetRoutes
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockRoutes);

    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('routes.list.error.message')).toBeInTheDocument();
    });

    const retryButton = screen.getByText('common.retry');
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('routes.list.title')).toBeInTheDocument();
    });

    expect(mockGetRoutes).toHaveBeenCalledTimes(2);
  });

  it('displays correct status colors and text', async () => {
    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      const completedStatus = screen.getByText('routes.status.completed');
      const scheduledStatus = screen.getByText('routes.status.scheduled');
      const inProgressStatus = screen.getByText('routes.status.inProgress');

      expect(completedStatus).toBeInTheDocument();
      expect(scheduledStatus).toBeInTheDocument();
      expect(inProgressStatus).toBeInTheDocument();

      // Check status colors via CSS classes
      expect(completedStatus.closest('.bg-green-500')).toBeInTheDocument();
      expect(scheduledStatus.closest('.bg-blue-500')).toBeInTheDocument();
      expect(inProgressStatus.closest('.bg-orange-500')).toBeInTheDocument();
    });
  });

  it('formats dates and times correctly', async () => {
    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check that dates are formatted in local format
      const dateElements = screen.getAllByText(/01\/01\/2024|1\/1\/2024/);
      expect(dateElements.length).toBeGreaterThan(0);
      
      // Check that times are formatted in 24-hour format
      const timeElements = screen.getAllByText(/09:00|12:00|14:00|18:00/);
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });

  it('displays income and distance information correctly', async () => {
    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check total income display
      expect(screen.getByText('routes.list.totalIncome')).toBeInTheDocument();
      expect(screen.getByText('£150.75')).toBeInTheDocument();
      expect(screen.getByText('£180.00')).toBeInTheDocument();

      // Check distance display
      expect(screen.getAllByText('Distance')).toHaveLength(3);
    });
  });

  it('displays mileage information when available', async () => {
    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check start and end mile display
      expect(screen.getByText('12345 mi')).toBeInTheDocument();
      expect(screen.getByText('12370.5 mi')).toBeInTheDocument();
      expect(screen.getByText('12400 mi')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });
  });

  it('handles routes with missing optional fields', async () => {
    const routeWithMinimalData = [{
      id: 'route-minimal',
      userId: 'user-123',
      workType: null,
      status: 'unknown',
      scheduleStart: '2024-01-01T09:00:00Z',
      scheduleEnd: '2024-01-01T12:00:00Z',
      actualStartTime: null,
      actualEndTime: null,
      distance: 0,
      startMile: null,
      endMile: null,
      totalIncome: 0,
      estimatedIncome: 0,
      incomes: [],
      createdAt: '2024-01-01T08:00:00Z',
      updatedAt: '2024-01-01T08:00:00Z'
    }];

    mockGetRoutes.mockResolvedValue(routeWithMinimalData);

    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Route')).toBeInTheDocument(); // Default work type
      expect(screen.getByText('common.unknown')).toBeInTheDocument(); // Unknown status
      expect(screen.getByText('£0.00')).toBeInTheDocument(); // Zero income
    });
  });

  it('calculates distance from mileage when both start and end miles are available', async () => {
    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      // The first route has startMile: 12345.0 and endMile: 12370.5
      // Distance should be calculated as 25.5 miles
      expect(screen.getByText(/25\.5/)).toBeInTheDocument();
    });
  });

  it('uses provided distance when mileage calculation is not available', async () => {
    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      // The second route has distance: 30.2 and no mileage info
      expect(screen.getByText(/30\.2/)).toBeInTheDocument();
    });
  });

  it('shows estimated income when total income is zero', async () => {
    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      // Routes with totalIncome: 0 should show estimatedIncome instead
      expect(screen.getByText('£180.00')).toBeInTheDocument();
      expect(screen.getByText('£200.00')).toBeInTheDocument();
    });
  });

  it('handles console error logging', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    mockGetRoutes.mockRejectedValue(new Error('API Error'));

    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('routes.list.error.message')).toBeInTheDocument();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading routes:', expect.any(Error));
    });

    consoleErrorSpy.mockRestore();
  });

  it('has proper accessibility attributes', async () => {
    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check heading hierarchy
      const mainHeading = screen.getByRole('heading', { level: 1, name: 'routes.list.title' });
      expect(mainHeading).toBeInTheDocument();

      // Check route cards are clickable
      const routeCards = screen.getAllByRole('button');
      expect(routeCards.length).toBeGreaterThan(0);

      // Check add button accessibility
      const addButton = screen.getByRole('button', { name: /routes.list.add/i });
      expect(addButton).toBeInTheDocument();
    });
  });

  it('displays route count correctly in different scenarios', async () => {
    // Test with multiple routes
    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('3 routes.title')).toBeInTheDocument();
    });

    // Test with single route
    mockGetRoutes.mockResolvedValue([mockRoutes[0]]);
    
    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('1 routes.title')).toBeInTheDocument();
    });
  });

  it('handles route click with proper navigation parameters', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Rideshare')).toBeInTheDocument();
    });

    const rideshareRoute = screen.getByText('Rideshare').closest('[role="button"]');
    await user.click(rideshareRoute!);

    expect(mockNavigate).toHaveBeenCalledWith('/routes/route-2');
  });

  it('displays work type or fallback correctly', async () => {
    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check that work types are displayed correctly
      expect(screen.getByText('Delivery')).toBeInTheDocument();
      expect(screen.getByText('Rideshare')).toBeInTheDocument();
      expect(screen.getByText('Private Hire')).toBeInTheDocument();
    });
  });

  it('calls getRoutes API on component mount', async () => {
    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockGetRoutes).toHaveBeenCalledTimes(1);
    });
  });

  it('processes route date strings correctly', async () => {
    render(
      <TestWrapper>
        <RouteList />
      </TestWrapper>
    );

    await waitFor(() => {
      // Verify that date processing doesn't cause errors
      expect(screen.getByText('routes.list.title')).toBeInTheDocument();
    });

    // Verify the API was called and data was processed
    expect(mockGetRoutes).toHaveBeenCalled();
  });
});