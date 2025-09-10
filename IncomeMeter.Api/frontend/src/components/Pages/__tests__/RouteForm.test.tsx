import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import RouteForm from '../RouteForm';
import type { Route } from '../../../types';

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

const mockRoute = {
  id: '1',
  userId: 'user-1',
  workType: 'Taxi',
  status: 'scheduled' as const,
  scheduleStart: new Date('2024-01-01T09:00:00Z'),
  scheduleEnd: new Date('2024-01-01T17:00:00Z'),
  actualStartTime: undefined,
  actualEndTime: undefined,
  incomes: [
    { source: 'Base fare', amount: 50 },
    { source: 'Tips', amount: 10 },
  ],
  totalIncome: 60,
  estimatedIncome: 80,
  distance: 100,
  startMile: 1000,
  endMile: 1100,
  createdAt: new Date('2024-01-01T08:00:00Z'),
  updatedAt: new Date('2024-01-01T08:00:00Z'),
};

const mockOnSave = jest.fn();
const mockOnCancel = jest.fn();

const renderRouteForm = (route?: Route) => {
  return render(
    <I18nextProvider i18n={i18n}>
      <RouteForm
        route={route}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    </I18nextProvider>
  );
};

describe('RouteForm Component', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockReturnValue('fake-token');
    (fetch as jest.Mock).mockClear();
    mockOnSave.mockClear();
    mockOnCancel.mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders create form when no route provided', () => {
    renderRouteForm();
    
    expect(screen.getByText('Create New Route')).toBeInTheDocument();
    expect(screen.getByLabelText('Work Type *')).toBeInTheDocument();
    expect(screen.getByLabelText('Start Time *')).toBeInTheDocument();
    expect(screen.getByLabelText('End Time *')).toBeInTheDocument();
    expect(screen.getByText('Create Route')).toBeInTheDocument(); // Submit button
  });

  it('renders edit form when route provided', () => {
    renderRouteForm(mockRoute);
    
    expect(screen.getByText('Edit Route')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Taxi')).toBeInTheDocument();
    expect(screen.getByText('Update Route')).toBeInTheDocument(); // Submit button
  });

  it('populates form fields when editing route', () => {
    renderRouteForm(mockRoute);
    
    const workTypeSelect = screen.getByDisplayValue('Taxi');
    const estimatedIncomeInput = screen.getByDisplayValue('80');
    const startMileInput = screen.getByDisplayValue('1000');
    
    expect(workTypeSelect).toBeInTheDocument();
    expect(estimatedIncomeInput).toBeInTheDocument();
    expect(startMileInput).toBeInTheDocument();
  });

  it('shows existing income items when editing', () => {
    renderRouteForm(mockRoute);
    
    expect(screen.getByDisplayValue('Base fare')).toBeInTheDocument();
    expect(screen.getByDisplayValue('50')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Tips')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    expect(screen.getByText('Total from income items: £60.00')).toBeInTheDocument();
  });

  it('handles form input changes', () => {
    renderRouteForm();
    
    const workTypeSelect = screen.getByLabelText('Work Type *');
    const estimatedIncomeInput = screen.getByLabelText('Estimated Income');
    
    fireEvent.change(workTypeSelect, { target: { value: 'Delivery' } });
    fireEvent.change(estimatedIncomeInput, { target: { value: '100' } });
    
    expect(workTypeSelect).toHaveValue('Delivery');
    expect(estimatedIncomeInput).toHaveValue(100);
  });

  it('maintains input values without rollback when typing', async () => {
    renderRouteForm();
    
    const estimatedIncomeInput = screen.getByLabelText('Estimated Income');
    const startMileInput = screen.getByLabelText('Start Mile');
    
    // Type multiple characters in sequence
    fireEvent.change(estimatedIncomeInput, { target: { value: '1' } });
    expect(estimatedIncomeInput).toHaveValue(1);
    
    fireEvent.change(estimatedIncomeInput, { target: { value: '12' } });
    expect(estimatedIncomeInput).toHaveValue(12);
    
    fireEvent.change(estimatedIncomeInput, { target: { value: '123' } });
    expect(estimatedIncomeInput).toHaveValue(123);
    
    // Test another field
    fireEvent.change(startMileInput, { target: { value: '500' } });
    expect(startMileInput).toHaveValue(500);
    
    // First field should still maintain its value
    expect(estimatedIncomeInput).toHaveValue(123);
    
    // Wait a bit to ensure no async updates interfere
    await waitFor(() => {
      expect(estimatedIncomeInput).toHaveValue(123);
      expect(startMileInput).toHaveValue(500);
    });
  });

  it('validates required fields', async () => {
    renderRouteForm();
    
    const submitButton = screen.getByText('Create Route');
    fireEvent.click(submitButton);
    
    // HTML5 form validation should prevent submission
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('adds new income item', () => {
    renderRouteForm();
    
    const sourceInput = screen.getByPlaceholderText('Income source (e.g., Base fare, Tips)');
    const amountInput = screen.getByPlaceholderText('Amount');
    const addButton = screen.getByText('Add');
    
    fireEvent.change(sourceInput, { target: { value: 'Bonus' } });
    fireEvent.change(amountInput, { target: { value: '20' } });
    fireEvent.click(addButton);
    
    expect(screen.getByDisplayValue('Bonus')).toBeInTheDocument();
    expect(screen.getByDisplayValue('20')).toBeInTheDocument();
    expect(screen.getByText('Total from income items: £20.00')).toBeInTheDocument();
  });

  it('removes income item', () => {
    renderRouteForm(mockRoute);
    
    const removeButtons = screen.getAllByText('×');
    fireEvent.click(removeButtons[0]);
    
    expect(screen.queryByDisplayValue('Base fare')).not.toBeInTheDocument();
    expect(screen.getByText('Total from income items: £10.00')).toBeInTheDocument();
  });

  it('updates existing income item', () => {
    renderRouteForm(mockRoute);
    
    const amountInput = screen.getByDisplayValue('50');
    fireEvent.change(amountInput, { target: { value: '75' } });
    
    expect(screen.getByText('Total from income items: £85.00')).toBeInTheDocument();
  });

  it('submits create form with correct data', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockRoute, id: 'new-id' }),
    });

    renderRouteForm();
    
    fireEvent.change(screen.getByLabelText('Work Type *'), { target: { value: 'Taxi' } });
    
    // Set datetime-local inputs
    const startTimeInput = screen.getByLabelText('Start Time *');
    const endTimeInput = screen.getByLabelText('End Time *');
    
    fireEvent.change(startTimeInput, { target: { value: '2024-01-01T09:00' } });
    fireEvent.change(endTimeInput, { target: { value: '2024-01-01T17:00' } });
    
    fireEvent.click(screen.getByText('Create Route'));
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/routes', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer fake-token',
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('"workType":"Taxi"'),
      });
    });
    
    expect(mockOnSave).toHaveBeenCalled();
  });

  it('submits edit form with correct data', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockRoute,
    });

    renderRouteForm(mockRoute);
    
    fireEvent.change(screen.getByDisplayValue('Taxi'), { target: { value: 'Delivery' } });
    
    fireEvent.click(screen.getByText('Update Route'));
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/routes/1', {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer fake-token',
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('"workType":"Delivery"'),
      });
    });
    
    expect(mockOnSave).toHaveBeenCalled();
  });

  it('handles cancel action', () => {
    renderRouteForm();
    
    fireEvent.click(screen.getByText('Cancel'));
    
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('shows loading state during form submission', async () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    renderRouteForm();
    
    fireEvent.change(screen.getByLabelText('Work Type *'), { target: { value: 'Taxi' } });
    
    const startTimeInput = screen.getByLabelText('Start Time *');
    const endTimeInput = screen.getByLabelText('End Time *');
    
    fireEvent.change(startTimeInput, { target: { value: '2024-01-01T09:00' } });
    fireEvent.change(endTimeInput, { target: { value: '2024-01-01T17:00' } });
    
    fireEvent.click(screen.getByText('Create Route'));
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('handles form submission error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Validation failed' }),
    });

    renderRouteForm();
    
    fireEvent.change(screen.getByLabelText('Work Type *'), { target: { value: 'Taxi' } });
    
    const startTimeInput = screen.getByLabelText('Start Time *');
    const endTimeInput = screen.getByLabelText('End Time *');
    
    fireEvent.change(startTimeInput, { target: { value: '2024-01-01T09:00' } });
    fireEvent.change(endTimeInput, { target: { value: '2024-01-01T17:00' } });
    
    fireEvent.click(screen.getByText('Create Route'));
    
    await waitFor(() => {
      expect(screen.getByText('Validation failed')).toBeInTheDocument();
    });
    
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('shows description field only when creating', () => {
    renderRouteForm();
    
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('does not show description field when editing', () => {
    renderRouteForm(mockRoute);
    
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
  });

  it('disables add button when income fields are empty', () => {
    renderRouteForm();
    
    const addButton = screen.getByText('Add');
    
    expect(addButton).toBeDisabled();
    
    const sourceInput = screen.getByPlaceholderText('Income source (e.g., Base fare, Tips)');
    fireEvent.change(sourceInput, { target: { value: 'Test' } });
    
    expect(addButton).toBeDisabled();
    
    const amountInput = screen.getByPlaceholderText('Amount');
    fireEvent.change(amountInput, { target: { value: '10' } });
    
    expect(addButton).not.toBeDisabled();
  });

  it('provides work type options', () => {
    renderRouteForm();
    
    // const workTypeSelect = screen.getByLabelText('Work Type *'); // Commented out as unused
    
    expect(screen.getByText('Select work type')).toBeInTheDocument();
    expect(screen.getByText('Taxi')).toBeInTheDocument();
    expect(screen.getByText('Delivery')).toBeInTheDocument();
    expect(screen.getByText('Ride Share')).toBeInTheDocument();
    expect(screen.getByText('Private Hire')).toBeInTheDocument();
    expect(screen.getByText('Courier')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
  });
});