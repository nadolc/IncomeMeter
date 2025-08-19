import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import LocationForm from '../LocationForm';

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

const mockLocation = {
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
};

const mockOnSave = jest.fn();
const mockOnCancel = jest.fn();

const renderLocationForm = (location?: typeof mockLocation) => {
  return render(
    <I18nextProvider i18n={i18n}>
      <LocationForm
        routeId="route-1"
        location={location}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    </I18nextProvider>
  );
};

describe('LocationForm Component', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockReturnValue('fake-token');
    (fetch as jest.Mock).mockClear();
    mockOnSave.mockClear();
    mockOnCancel.mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders create form when no location provided', () => {
    renderLocationForm();
    
    expect(screen.getByText('Add Location')).toBeInTheDocument();
    expect(screen.getByLabelText('Latitude *')).toBeInTheDocument();
    expect(screen.getByLabelText('Longitude *')).toBeInTheDocument();
    expect(screen.getByLabelText('Timestamp *')).toBeInTheDocument();
    expect(screen.getByText('Add Location')).toBeInTheDocument(); // Submit button
  });

  it('renders edit form when location provided', () => {
    renderLocationForm(mockLocation);
    
    expect(screen.getByText('Edit Location')).toBeInTheDocument();
    expect(screen.getByDisplayValue('51.5074')).toBeInTheDocument();
    expect(screen.getByDisplayValue('-0.1278')).toBeInTheDocument();
    expect(screen.getByText('Update Location')).toBeInTheDocument(); // Submit button
  });

  it('populates form fields when editing location', () => {
    renderLocationForm(mockLocation);
    
    const latitudeInput = screen.getByDisplayValue('51.5074');
    const longitudeInput = screen.getByDisplayValue('-0.1278');
    const accuracyInput = screen.getByDisplayValue('10.2');
    const speedInput = screen.getByDisplayValue('30.5');
    
    expect(latitudeInput).toBeInTheDocument();
    expect(longitudeInput).toBeInTheDocument();
    expect(accuracyInput).toBeInTheDocument();
    expect(speedInput).toBeInTheDocument();
  });

  it('handles form input changes', () => {
    renderLocationForm();
    
    const latitudeInput = screen.getByLabelText('Latitude *');
    const longitudeInput = screen.getByLabelText('Longitude *');
    
    fireEvent.change(latitudeInput, { target: { value: '52.5074' } });
    fireEvent.change(longitudeInput, { target: { value: '-1.1278' } });
    
    expect(latitudeInput).toHaveValue(52.5074);
    expect(longitudeInput).toHaveValue(-1.1278);
  });

  it('validates required fields', async () => {
    renderLocationForm();
    
    const submitButton = screen.getByText('Add Location');
    fireEvent.click(submitButton);
    
    // HTML5 form validation should prevent submission
    // The exact validation message depends on the browser
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('submits create form with correct data', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockLocation, id: 'new-id' }),
    });

    renderLocationForm();
    
    fireEvent.change(screen.getByLabelText('Latitude *'), { target: { value: '51.5074' } });
    fireEvent.change(screen.getByLabelText('Longitude *'), { target: { value: '-0.1278' } });
    fireEvent.change(screen.getByLabelText('Accuracy (meters)'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Speed (km/h)'), { target: { value: '30' } });
    
    fireEvent.click(screen.getByText('Add Location'));
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/locations', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer fake-token',
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('"routeId":"route-1"'),
      });
    });
    
    expect(mockOnSave).toHaveBeenCalled();
  });

  it('submits edit form with correct data', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockLocation,
    });

    renderLocationForm(mockLocation);
    
    fireEvent.change(screen.getByDisplayValue('51.5074'), { target: { value: '52.5074' } });
    
    fireEvent.click(screen.getByText('Update Location'));
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/locations/1', {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer fake-token',
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('"latitude":52.5074'),
      });
    });
    
    expect(mockOnSave).toHaveBeenCalled();
  });

  it('handles cancel action', () => {
    renderLocationForm();
    
    fireEvent.click(screen.getByText('Cancel'));
    
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('handles geolocation success', async () => {
    const mockPosition = {
      coords: {
        latitude: 51.5074,
        longitude: -0.1278,
        accuracy: 10,
        speed: 30,
      },
    };

    geolocationMock.getCurrentPosition.mockImplementation((success) => {
      success(mockPosition);
    });

    renderLocationForm();
    
    fireEvent.click(screen.getByText('Use Current Location'));
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('51.507400')).toBeInTheDocument();
      expect(screen.getByDisplayValue('-0.127800')).toBeInTheDocument();
    });
  });

  it('handles geolocation error', async () => {
    const mockError = { message: 'Location access denied' };

    geolocationMock.getCurrentPosition.mockImplementation((_, error) => {
      error(mockError);
    });

    renderLocationForm();
    
    fireEvent.click(screen.getByText('Use Current Location'));
    
    await waitFor(() => {
      expect(screen.getByText('Location error: Location access denied')).toBeInTheDocument();
    });
  });

  it('shows loading state during form submission', async () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    renderLocationForm();
    
    fireEvent.change(screen.getByLabelText('Latitude *'), { target: { value: '51.5074' } });
    fireEvent.change(screen.getByLabelText('Longitude *'), { target: { value: '-0.1278' } });
    
    fireEvent.click(screen.getByText('Add Location'));
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('handles form submission error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Validation failed' }),
    });

    renderLocationForm();
    
    fireEvent.change(screen.getByLabelText('Latitude *'), { target: { value: '51.5074' } });
    fireEvent.change(screen.getByLabelText('Longitude *'), { target: { value: '-0.1278' } });
    
    fireEvent.click(screen.getByText('Add Location'));
    
    await waitFor(() => {
      expect(screen.getByText('Validation failed')).toBeInTheDocument();
    });
    
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('shows address field when editing', () => {
    renderLocationForm(mockLocation);
    
    expect(screen.getByLabelText('Address')).toBeInTheDocument();
    expect(screen.getByDisplayValue('London, UK')).toBeInTheDocument();
  });

  it('does not show address field when creating', () => {
    renderLocationForm();
    
    expect(screen.queryByLabelText('Address')).not.toBeInTheDocument();
  });
});