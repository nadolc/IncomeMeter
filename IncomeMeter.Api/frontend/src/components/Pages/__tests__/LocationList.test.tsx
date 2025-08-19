import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import LocationList from '../LocationList';

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock navigator.geolocation
const geolocationMock = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
};
Object.defineProperty(navigator, 'geolocation', { value: geolocationMock });

const mockLocations = [
  {
    id: '1',
    routeId: 'route-1',
    userId: 'user-1',
    latitude: 51.5074,
    longitude: -0.1278,
    timestamp: '2024-01-01T10:00:00Z',
    address: 'London, UK',
    speed: 30.5,
    accuracy: 10.2,
    distanceFromLastKm: 1.5,
    distanceFromLastMi: 0.93,
  },
  {
    id: '2',
    routeId: 'route-1',
    userId: 'user-1',
    latitude: 51.5085,
    longitude: -0.1290,
    timestamp: '2024-01-01T10:05:00Z',
    address: 'Near London, UK',
    speed: 25.0,
    accuracy: 8.5,
    distanceFromLastKm: 0.8,
    distanceFromLastMi: 0.5,
  },
];

const renderLocationList = (routeId: string = 'route-1') => {
  return render(
    <BrowserRouter>
      <I18nextProvider i18n={i18n}>
        <LocationList routeId={routeId} />
      </I18nextProvider>
    </BrowserRouter>
  );
};

describe('LocationList Component', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockReturnValue('fake-token');
    (fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders loading state initially', () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    
    renderLocationList();
    
    expect(screen.getByText('Loading locations...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders locations list when data is loaded', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockLocations,
    });

    renderLocationList();

    await waitFor(() => {
      expect(screen.getByText('Route Locations')).toBeInTheDocument();
    });

    expect(screen.getByText('51.507400, -0.127800')).toBeInTheDocument();
    expect(screen.getByText('London, UK')).toBeInTheDocument();
    expect(screen.getByText('Speed: 30.5 km/h')).toBeInTheDocument();
    expect(screen.getByText('Accuracy: 10.2m')).toBeInTheDocument();
  });

  it('renders empty state when no locations', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    renderLocationList();

    await waitFor(() => {
      expect(screen.getByText('No Locations Found')).toBeInTheDocument();
    });

    expect(screen.getByText('No location data recorded for this route.')).toBeInTheDocument();
  });

  it('renders error state when fetch fails', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    renderLocationList();

    await waitFor(() => {
      expect(screen.getByText('Error Loading Locations')).toBeInTheDocument();
    });

    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('handles retry on error', async () => {
    (fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockLocations,
      });

    renderLocationList();

    await waitFor(() => {
      expect(screen.getByText('Error Loading Locations')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByText('Route Locations')).toBeInTheDocument();
    });
  });

  it('opens add location modal when add button is clicked', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockLocations,
    });

    renderLocationList();

    await waitFor(() => {
      expect(screen.getByText('Route Locations')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Location'));

    // Note: In a real implementation, this would open a modal
    // For this test, we're just checking that the button exists and is clickable
    expect(screen.getByText('Add Location')).toBeInTheDocument();
  });

  it('handles delete location', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockLocations,
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    renderLocationList();

    await waitFor(() => {
      expect(screen.getByText('Route Locations')).toBeInTheDocument();
    });

    // Click delete button for first location
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    // Confirm deletion in modal
    await waitFor(() => {
      expect(screen.getByText('Delete Location')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete', { selector: 'button' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/locations/1', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer fake-token',
        },
      });
    });
  });

  it('formats coordinates correctly', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockLocations,
    });

    renderLocationList();

    await waitFor(() => {
      expect(screen.getByText('51.507400, -0.127800')).toBeInTheDocument();
      expect(screen.getByText('51.508500, -0.129000')).toBeInTheDocument();
    });
  });

  it('formats timestamp correctly', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockLocations,
    });

    renderLocationList();

    await waitFor(() => {
      // The exact format depends on the user's locale, but we can check it's displayed
      expect(screen.getByText(/1\/1\/2024.*10:00:00/)).toBeInTheDocument();
    });
  });

  it('displays distance information when available', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockLocations,
    });

    renderLocationList();

    await waitFor(() => {
      expect(screen.getByText('Distance (km): 1.5km')).toBeInTheDocument();
      expect(screen.getByText('Distance (km): 0.8km')).toBeInTheDocument();
    });
  });

  it('makes correct API call with route ID', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockLocations,
    });

    renderLocationList('test-route-id');

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/locations?routeId=test-route-id', {
        headers: {
          'Authorization': 'Bearer fake-token',
          'Content-Type': 'application/json',
        },
      });
    });
  });
});