import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, useParams } from 'react-router-dom';
import RouteDetails from '../RouteDetails';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import { SettingsProvider } from '../../../contexts/SettingsContext';
import * as api from '../../../utils/api';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(),
  useNavigate: () => mockNavigate,
}));

// Mock API functions
jest.mock('../../../utils/api', () => ({
  getRouteById: jest.fn(),
  getLocationsByRouteId: jest.fn(),
}));

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

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

const mockUseParams = useParams as jest.Mock;
const mockGetRouteById = api.getRouteById as jest.Mock;
const mockGetLocationsByRouteId = api.getLocationsByRouteId as jest.Mock;

const mockRoute = {
  id: 'route-123',
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
};

const mockLocations = [
  {
    id: 'loc-1',
    routeId: 'route-123',
    userId: 'user-123',
    timestamp: '2024-01-01T09:05:00Z',
    latitude: 51.5074,
    longitude: -0.1278,
    address: 'London, UK',
    accuracy: 5.2,
    speed: 10.5,
    distanceFromLastKm: 0
  },
  {
    id: 'loc-2',
    routeId: 'route-123',
    userId: 'user-123',
    timestamp: '2024-01-01T11:55:00Z',
    latitude: 51.5155,
    longitude: -0.1426,
    address: 'Westminster, London, UK',
    accuracy: 3.8,
    speed: 0,
    distanceFromLastKm: 2.3
  }
];

describe('RouteDetails Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParams.mockReturnValue({ id: 'route-123' });
    mockGetRouteById.mockResolvedValue(mockRoute);
    mockGetLocationsByRouteId.mockResolvedValue(mockLocations);
  });

  it('renders loading state initially', async () => {
    // Mock delayed response
    mockGetRouteById.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockRoute), 100))
    );

    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    expect(screen.getByText('routes.details.loading')).toBeInTheDocument();
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('routes.details.loading')).not.toBeInTheDocument();
    });
  });

  it('renders route details when data loads successfully', async () => {
    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check page title and status
      expect(screen.getByText('routes.details.title')).toBeInTheDocument();
      expect(screen.getByText('Delivery')).toBeInTheDocument();
      expect(screen.getByText('routes.status.completed')).toBeInTheDocument();

      // Check route overview
      expect(screen.getByText('Route Overview')).toBeInTheDocument();
      expect(screen.getByText('£150.75')).toBeInTheDocument();
      
      // Check income breakdown
      expect(screen.getByText('Income Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Base Pay')).toBeInTheDocument();
      expect(screen.getByText('£120.00')).toBeInTheDocument();
      expect(screen.getByText('Tips')).toBeInTheDocument();
      expect(screen.getByText('£30.75')).toBeInTheDocument();
    });
  });

  it('displays locations when available', async () => {
    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('routes.details.locations.title')).toBeInTheDocument();
      expect(screen.getByText('2 locations')).toBeInTheDocument();
      
      // Check location details
      expect(screen.getByText('London, UK')).toBeInTheDocument();
      expect(screen.getByText('Westminster, London, UK')).toBeInTheDocument();
      
      // Check location metadata
      expect(screen.getByText('Accuracy: 5.2m')).toBeInTheDocument();
      expect(screen.getByText('Speed: 10.5 m/s')).toBeInTheDocument();
    });
  });

  it('displays odometer information when available', async () => {
    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('routes.details.locations.startMile')).toBeInTheDocument();
      expect(screen.getByText('routes.details.locations.endMile')).toBeInTheDocument();
    });
  });

  it('handles route not found error', async () => {
    mockUseParams.mockReturnValue({ id: 'nonexistent-route' });
    mockGetRouteById.mockRejectedValue(new Error('Route not found'));

    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('routes.details.error.title')).toBeInTheDocument();
      expect(screen.getByText('routes.details.error.message')).toBeInTheDocument();
    });
  });

  it('handles missing route parameter', async () => {
    mockUseParams.mockReturnValue({ id: undefined });

    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('routes.details.notFound.title')).toBeInTheDocument();
      expect(screen.getByText('routes.details.notFound.message')).toBeInTheDocument();
    });
  });

  it('navigates back to routes list when back button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('routes.details.title')).toBeInTheDocument();
    });

    const backButton = screen.getByRole('button', { name: /back/i });
    await user.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith('/routes');
  });

  it('retries loading when retry button is clicked', async () => {
    const user = userEvent.setup();
    
    // First call fails, second succeeds
    mockGetRouteById
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockRoute);

    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('routes.details.error.message')).toBeInTheDocument();
    });

    const retryButton = screen.getByText('common.retry');
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('routes.details.title')).toBeInTheDocument();
    });

    expect(mockGetRouteById).toHaveBeenCalledTimes(2);
  });

  it('displays correct status colors and text', async () => {
    const statuses = [
      { status: 'completed', color: 'bg-green-500', text: 'routes.status.completed' },
      { status: 'in_progress', color: 'bg-orange-500', text: 'routes.status.inProgress' },
      { status: 'scheduled', color: 'bg-blue-500', text: 'routes.status.scheduled' },
      { status: 'cancelled', color: 'bg-gray-500', text: 'routes.status.cancelled' }
    ];

    for (const { status, text } of statuses) {
      mockGetRouteById.mockResolvedValue({ ...mockRoute, status });

      render(
        <TestWrapper>
          <RouteDetails />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(text)).toBeInTheDocument();
      });
    }
  });

  it('formats dates and times correctly', async () => {
    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check that dates are formatted in local format
      const dateElements = screen.getAllByText(/01\/01\/2024|1\/1\/2024/);
      expect(dateElements.length).toBeGreaterThan(0);
      
      // Check that times are formatted in 24-hour format
      const timeElements = screen.getAllByText(/09:05|11:55/);
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });

  it('handles routes without income breakdown', async () => {
    const routeWithoutIncomes = { ...mockRoute, incomes: [] };
    mockGetRouteById.mockResolvedValue(routeWithoutIncomes);

    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.queryByText('Income Breakdown')).not.toBeInTheDocument();
      expect(screen.getByText('Route Overview')).toBeInTheDocument();
    });
  });

  it('handles routes without locations', async () => {
    mockGetLocationsByRouteId.mockResolvedValue([]);

    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.queryByText('routes.details.locations.title')).not.toBeInTheDocument();
      expect(screen.getByText('Route Overview')).toBeInTheDocument();
    });
  });

  it('displays route information section', async () => {
    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('routes.details.routeInfo')).toBeInTheDocument();
      expect(screen.getByText('routes.details.routeId')).toBeInTheDocument();
      expect(screen.getByText('route-123')).toBeInTheDocument();
      expect(screen.getByText('routes.details.userId')).toBeInTheDocument();
      expect(screen.getByText('user-123')).toBeInTheDocument();
    });
  });

  it('handles missing actual times gracefully', async () => {
    const routeWithoutActualTimes = {
      ...mockRoute,
      actualStartTime: null,
      actualEndTime: null
    };
    mockGetRouteById.mockResolvedValue(routeWithoutActualTimes);

    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('common.noTime')).toBeInTheDocument();
      expect(screen.getByText('routes.details.actualTime')).toBeInTheDocument();
    });
  });

  it('calls API functions with correct parameters', async () => {
    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockGetRouteById).toHaveBeenCalledWith('route-123');
      expect(mockGetLocationsByRouteId).toHaveBeenCalledWith('route-123');
    });
  });

  it('handles API errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    mockGetRouteById.mockRejectedValue(new Error('API Error'));

    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('routes.details.error.message')).toBeInTheDocument();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading route details:', expect.any(Error));
    });

    consoleErrorSpy.mockRestore();
  });

  it('displays work type correctly', async () => {
    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Work Type')).toBeInTheDocument();
      expect(screen.getByText('Delivery')).toBeInTheDocument();
    });
  });

  it('handles routes with no work type specified', async () => {
    const routeWithoutWorkType = { ...mockRoute, workType: null };
    mockGetRouteById.mockResolvedValue(routeWithoutWorkType);

    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Not specified')).toBeInTheDocument();
    });
  });

  it('displays distance in correct units', async () => {
    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Distance')).toBeInTheDocument();
      // Distance should be displayed with proper formatting
      expect(screen.getByText(/25\.5/)).toBeInTheDocument();
    });
  });

  it('shows estimated income when total income is not available', async () => {
    const routeWithEstimatedIncome = { ...mockRoute, totalIncome: 0 };
    mockGetRouteById.mockResolvedValue(routeWithEstimatedIncome);

    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('£160.00')).toBeInTheDocument();
    });
  });

  it('has proper accessibility attributes', async () => {
    render(
      <TestWrapper>
        <RouteDetails />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check heading hierarchy
      const mainHeading = screen.getByRole('heading', { level: 1, name: 'routes.details.title' });
      expect(mainHeading).toBeInTheDocument();

      const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
      expect(sectionHeadings.length).toBeGreaterThan(0);

      // Check button accessibility
      const backButton = screen.getByRole('button', { name: /back/i });
      expect(backButton).toBeInTheDocument();
    });
  });
});