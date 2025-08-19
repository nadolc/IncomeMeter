import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Settings from '../Settings';
import { AuthProvider } from '../../../contexts/AuthContext';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import * as api from '../../../utils/api';

// Mock API functions
jest.mock('../../../utils/api', () => ({
  getUserSettings: jest.fn(),
  updateUserSettings: jest.fn(),
}));

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: jest.fn(),
    },
  }),
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <LanguageProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </LanguageProvider>
  </BrowserRouter>
);

const mockGetUserSettings = api.getUserSettings as jest.Mock;
const mockUpdateUserSettings = api.updateUserSettings as jest.Mock;

const defaultSettings = {
  currency: 'GBP' as const,
  language: 'en-GB' as const,
  timeZone: 'Europe/London',
  dateFormat: 'DD/MM/YYYY',
  emailNotifications: true,
  pushNotifications: false,
  defaultChartPeriod: '7d',
  showWeekends: true,
  mileageUnit: 'mi' as const,
};

describe('Settings Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserSettings.mockResolvedValue(defaultSettings);
    mockUpdateUserSettings.mockResolvedValue(defaultSettings);
  });

  it('renders loading state initially', async () => {
    // Mock delayed response
    mockGetUserSettings.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(defaultSettings), 100))
    );

    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByText('settings.title')).toBeInTheDocument();
    expect(screen.getByText('common.loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });
  });

  it('renders all settings sections when data loads', async () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check main sections
      expect(screen.getByText('settings.sections.localization')).toBeInTheDocument();
      expect(screen.getByText('settings.notifications.title')).toBeInTheDocument();
      
      // Check form fields
      expect(screen.getByLabelText('settings.form.currency')).toBeInTheDocument();
      expect(screen.getByLabelText('settings.form.language')).toBeInTheDocument();
      expect(screen.getByLabelText('settings.form.timeZone')).toBeInTheDocument();
      expect(screen.getByLabelText('settings.form.mileageUnit')).toBeInTheDocument();
      
      // Check notification toggles
      expect(screen.getByLabelText('settings.notifications.email')).toBeInTheDocument();
      expect(screen.getByLabelText('settings.notifications.push')).toBeInTheDocument();
    });
  });

  it('displays current settings values correctly', async () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    await waitFor(() => {
      const currencySelect = screen.getByLabelText('settings.form.currency') as HTMLSelectElement;
      const languageSelect = screen.getByLabelText('settings.form.language') as HTMLSelectElement;
      const mileageSelect = screen.getByLabelText('settings.form.mileageUnit') as HTMLSelectElement;
      
      expect(currencySelect.value).toBe('GBP');
      expect(languageSelect.value).toBe('en-GB');
      expect(mileageSelect.value).toBe('mi');
      
      // Check notification toggles
      const emailToggle = screen.getByLabelText('settings.notifications.email') as HTMLInputElement;
      const pushToggle = screen.getByLabelText('settings.notifications.push') as HTMLInputElement;
      
      expect(emailToggle.checked).toBe(true);
      expect(pushToggle.checked).toBe(false);
    });
  });

  it('updates currency setting', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('settings.form.currency')).toBeInTheDocument();
    });

    const currencySelect = screen.getByLabelText('settings.form.currency');
    await user.selectOptions(currencySelect, 'HKD');

    const saveButton = screen.getByText('settings.save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateUserSettings).toHaveBeenCalledWith({
        ...defaultSettings,
        currency: 'HKD'
      });
    });
  });

  it('updates language setting', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('settings.form.language')).toBeInTheDocument();
    });

    const languageSelect = screen.getByLabelText('settings.form.language');
    await user.selectOptions(languageSelect, 'zh-HK');

    const saveButton = screen.getByText('settings.save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateUserSettings).toHaveBeenCalledWith({
        ...defaultSettings,
        language: 'zh-HK'
      });
    });
  });

  it('updates notification settings', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('settings.notifications.email')).toBeInTheDocument();
    });

    // Toggle email notifications off
    const emailToggle = screen.getByLabelText('settings.notifications.email');
    await user.click(emailToggle);

    // Toggle push notifications on
    const pushToggle = screen.getByLabelText('settings.notifications.push');
    await user.click(pushToggle);

    const saveButton = screen.getByText('settings.save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateUserSettings).toHaveBeenCalledWith({
        ...defaultSettings,
        emailNotifications: false,
        pushNotifications: true
      });
    });
  });

  it('updates mileage unit setting', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('settings.form.mileageUnit')).toBeInTheDocument();
    });

    const mileageSelect = screen.getByLabelText('settings.form.mileageUnit');
    await user.selectOptions(mileageSelect, 'km');

    const saveButton = screen.getByText('settings.save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateUserSettings).toHaveBeenCalledWith({
        ...defaultSettings,
        mileageUnit: 'km'
      });
    });
  });

  it('shows loading state when saving settings', async () => {
    const user = userEvent.setup();
    
    // Mock delayed update
    mockUpdateUserSettings.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(defaultSettings), 100))
    );

    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('settings.save')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('settings.save');
    await user.click(saveButton);

    expect(screen.getByText('settings.saving')).toBeInTheDocument();
    expect(saveButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.queryByText('settings.saving')).not.toBeInTheDocument();
      expect(screen.getByText('settings.saved')).toBeInTheDocument();
    });
  });

  it('shows success message after saving', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('settings.save')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('settings.save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('settings.saved')).toBeInTheDocument();
    });

    // Success message should disappear after a few seconds
    setTimeout(() => {
      expect(screen.queryByText('settings.saved')).not.toBeInTheDocument();
    }, 3000);
  });

  it('handles save error gracefully', async () => {
    const user = userEvent.setup();
    
    mockUpdateUserSettings.mockRejectedValue(new Error('Save failed'));

    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('settings.save')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('settings.save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('errors.generic')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('handles initial settings fetch error', async () => {
    mockGetUserSettings.mockRejectedValue(new Error('Failed to fetch settings'));

    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('errors.generic')).toBeInTheDocument();
    });
  });

  it('displays currency options correctly', async () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('settings.currencies.GBP')).toBeInTheDocument();
      expect(screen.getByText('settings.currencies.HKD')).toBeInTheDocument();
    });
  });

  it('displays language options correctly', async () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('settings.languages.en-GB')).toBeInTheDocument();
      expect(screen.getByText('settings.languages.zh-HK')).toBeInTheDocument();
    });
  });

  it('displays mileage unit options correctly', async () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('settings.mileageUnits.km')).toBeInTheDocument();
      expect(screen.getByText('settings.mileageUnits.mi')).toBeInTheDocument();
    });
  });

  it('prevents saving when no changes are made', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('settings.save')).toBeInTheDocument();
    });

    // Save without making any changes
    const saveButton = screen.getByText('settings.save');
    await user.click(saveButton);

    // Should not call update API since no changes were made
    expect(mockUpdateUserSettings).toHaveBeenCalledWith(defaultSettings);
  });

  it('tracks form changes correctly', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('settings.form.currency')).toBeInTheDocument();
    });

    // Make a change
    const currencySelect = screen.getByLabelText('settings.form.currency');
    await user.selectOptions(currencySelect, 'HKD');

    // Save button should be enabled and show changes need saving
    const saveButton = screen.getByText('settings.save');
    expect(saveButton).not.toBeDisabled();
  });

  it('has proper form accessibility', async () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check that all form controls have labels
      const currencySelect = screen.getByLabelText('settings.form.currency');
      const languageSelect = screen.getByLabelText('settings.form.language');
      const emailToggle = screen.getByLabelText('settings.notifications.email');
      const pushToggle = screen.getByLabelText('settings.notifications.push');
      
      expect(currencySelect).toBeInTheDocument();
      expect(languageSelect).toBeInTheDocument();
      expect(emailToggle).toHaveAttribute('type', 'checkbox');
      expect(pushToggle).toHaveAttribute('type', 'checkbox');

      // Check form structure
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();
    });
  });

  it('calls getUserSettings on component mount', async () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockGetUserSettings).toHaveBeenCalledTimes(1);
    });
  });
});