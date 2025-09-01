import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSettings } from '../../contexts/SettingsContext';
import { getDisplayDistance } from '../../utils/distance';
import type { PeriodType, ChartDataPoint } from '../../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);


interface PeriodChartProps {
  period: PeriodType;
  data: ChartDataPoint[];
  currentPeriodDisplay: string;
  className?: string;
}

const PeriodChart: React.FC<PeriodChartProps> = ({
  period,
  data,
  currentPeriodDisplay,
  className = '',
}) => {
  const { t, language } = useLanguage();
  const { formatCurrency, settings } = useSettings();

  // Helper function to get localized labels
  const getLocalizedLabel = React.useCallback((item: ChartDataPoint, periodType: PeriodType, lang: string): string => {
    const date = new Date(item.date);
    
    switch (periodType) {
      case 'weekly':
        // For weekly view, use localized day names
        const dayNames = {
          'en-GB': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          'zh-HK': ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
        };
        const dayIndex = date.getDay();
        return dayNames[lang as keyof typeof dayNames]?.[dayIndex] || item.label;
        
      case 'monthly':
        // For monthly view, use week numbers
        return lang === 'zh-HK' ? `第${item.label.replace('Week ', '')}週` : item.label;
        
      case 'annual':
        // For annual view, use localized month names
        const monthNames = {
          'en-GB': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          'zh-HK': ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
        };
        const monthIndex = date.getMonth();
        return monthNames[lang as keyof typeof monthNames]?.[monthIndex] || item.label;
        
      default:
        return item.label;
    }
  }, []);

  // Helper function to get chart title
  const getChartTitle = React.useCallback((periodType: PeriodType, display: string, lang: string): string => {
    const periodTranslations = {
      'en-GB': {
        weekly: 'Weekly Income',
        monthly: 'Monthly Income by Week',
        annual: 'Annual Income by Month'
      },
      'zh-HK': {
        weekly: '每週收入',
        monthly: '每月收入（按週）',
        annual: '年度收入（按月）'
      }
    };
    
    const title = periodTranslations[lang as keyof typeof periodTranslations]?.[periodType] || 
                  periodTranslations['en-GB'][periodType];
    
    return `${title} - ${display}`;
  }, []);

  // Process data for chart
  const processedData = React.useMemo(() => {
    return data.map(item => ({
      ...item,
      // Localize labels based on period type and language
      localizedLabel: getLocalizedLabel(item, period, language),
    }));
  }, [data, period, language, getLocalizedLabel]);

  const chartData = {
    labels: processedData.map(item => item.localizedLabel),
    datasets: [
      {
        label: t('dashboard.stats.netIncome'),
        data: processedData.map(item => item.income),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Hide legend for cleaner look
      },
      title: {
        display: true,
        text: getChartTitle(period, currentPeriodDisplay, language),
        font: {
          size: 16,
          weight: 600,
        },
        color: '#374151',
        padding: {
          bottom: 20,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#374151',
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          title: (context: any) => {
            const dataPoint = processedData[context[0].dataIndex];
            const date = new Date(dataPoint.date);
            return `${dataPoint.localizedLabel} - ${date.toLocaleDateString(language)}`;
          },
          label: (context: any) => {
            const dataPoint = processedData[context.dataIndex];
            return [
              `${t('routes.details.income')}: ${formatCurrency(dataPoint.income)}`,
              `${t('routes.title')}: ${dataPoint.routes}`,
              `${t('routes.details.distance')}: ${getDisplayDistance(dataPoint.distance, 'km', settings.mileageUnit).formatted}`
            ];
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#6B7280',
          font: {
            size: 12,
          },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
        },
        ticks: {
          color: '#6B7280',
          font: {
            size: 12,
          },
          callback: (value: any) => {
            return formatCurrency(value);
          },
        },
      },
    },
    elements: {
      bar: {
        borderRadius: 4,
      },
    },
  };

  if (!data || data.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="text-center py-8">
          <div className="text-gray-400 text-lg mb-2">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {t('dashboard.charts.noDataPeriod', { period: t(`dashboard.periods.${period}`) })}
          </h3>
          <p className="text-gray-500 text-sm">
            {period === 'weekly' && 'No routes completed this week'}
            {period === 'monthly' && 'No routes completed this month'}
            {period === 'annual' && 'No routes completed this fiscal year'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div style={{ height: '400px' }}>
        <Bar data={chartData} options={options} />
      </div>
      
      {/* Chart Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-bold text-blue-600 truncate" title={formatCurrency(data.reduce((sum, item) => sum + item.income, 0))}>
              {formatCurrency(data.reduce((sum, item) => sum + item.income, 0))}
            </div>
            <div className="text-xs sm:text-sm text-gray-600 truncate">{t('dashboard.stats.netIncome')}</div>
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-bold text-green-600">
              {data.reduce((sum, item) => sum + item.routes, 0)}
            </div>
            <div className="text-xs sm:text-sm text-gray-600 truncate">{t('routes.title')}</div>
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-bold text-purple-600 truncate" title={getDisplayDistance(data.reduce((sum, item) => sum + item.distance, 0), 'km', settings.mileageUnit).formatted}>
              {getDisplayDistance(data.reduce((sum, item) => sum + item.distance, 0), 'km', settings.mileageUnit).formatted}
            </div>
            <div className="text-xs sm:text-sm text-gray-600 truncate">{t('routes.details.distance')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PeriodChart;