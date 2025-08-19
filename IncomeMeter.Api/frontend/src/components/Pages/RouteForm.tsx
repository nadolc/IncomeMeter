import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getActiveWorkTypeConfigs, createRoute, updateRoute } from '../../utils/api';
import type { WorkTypeConfig } from '../../types';

interface IncomeItem {
  source: string;
  amount: number;
}

interface RouteFormData {
  workType: string;
  workTypeId?: string;
  scheduleStart: string;
  scheduleEnd: string;
  estimatedIncome?: number;
  startMile?: number;
  description?: string;
  incomes: IncomeItem[];
}

interface Route {
  id?: string;
  userId: string;
  workType?: string;
  status: string;
  scheduleStart: Date;
  scheduleEnd: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  incomes: IncomeItem[];
  totalIncome: number;
  estimatedIncome: number;
  distance: number;
  startMile?: number;
  endMile?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface RouteFormProps {
  route?: Route;
  onSave: (route: Route) => void;
  onCancel: () => void;
}

const RouteForm: React.FC<RouteFormProps> = ({ route, onSave, onCancel }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<RouteFormData>({
    workType: '',
    workTypeId: undefined,
    scheduleStart: new Date().toISOString().slice(0, 16),
    scheduleEnd: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16), // +8 hours
    estimatedIncome: undefined,
    startMile: undefined,
    description: undefined,
    incomes: [],
  });
  const [workTypeConfigs, setWorkTypeConfigs] = useState<WorkTypeConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newIncomeSource, setNewIncomeSource] = useState('');
  const [newIncomeAmount, setNewIncomeAmount] = useState<number | ''>('');

  useEffect(() => {
    loadWorkTypeConfigs();
  }, []);

  useEffect(() => {
    if (route) {
      setFormData({
        workType: route.workType || '',
        workTypeId: (route as any).workTypeId,
        scheduleStart: new Date(route.scheduleStart).toISOString().slice(0, 16),
        scheduleEnd: new Date(route.scheduleEnd).toISOString().slice(0, 16),
        estimatedIncome: route.estimatedIncome,
        startMile: route.startMile,
        description: undefined, // Not in the route model
        incomes: route.incomes || [],
      });
    }
  }, [route]);

  const loadWorkTypeConfigs = async () => {
    try {
      setLoadingConfigs(true);
      const configs = await getActiveWorkTypeConfigs();
      setWorkTypeConfigs(configs);
    } catch (err) {
      console.error('Error loading work type configs:', err);
      setError('Failed to load work type configurations');
    } finally {
      setLoadingConfigs(false);
    }
  };

  const handleWorkTypeChange = (workTypeId: string, workTypeName: string) => {
    const selectedConfig = workTypeConfigs.find(config => config.id === workTypeId);
    
    if (selectedConfig) {
      // Auto-populate income sources from the selected work type configuration
      const newIncomes = selectedConfig.incomeSourceTemplates.map(template => ({
        source: template.name,
        amount: template.defaultAmount || 0,
      }));

      setFormData(prev => ({
        ...prev,
        workType: workTypeName || selectedConfig.name,
        workTypeId: workTypeId,
        incomes: newIncomes,
        estimatedIncome: newIncomes.reduce((sum, income) => sum + income.amount, 0)
      }));
    } else {
      // Custom work type (not from configuration)
      setFormData(prev => ({
        ...prev,
        workType: workTypeName,
        workTypeId: undefined,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const requestData = {
        workType: formData.workType,
        workTypeId: formData.workTypeId,
        scheduleStart: new Date(formData.scheduleStart),
        scheduleEnd: new Date(formData.scheduleEnd),
        estimatedIncome: formData.estimatedIncome,
        startMile: formData.startMile,
        incomes: formData.incomes,
      };

      let result;
      if (route) {
        // Update existing route
        result = await updateRoute(route.id!, requestData);
      } else {
        // Create new route
        result = await createRoute(requestData);
      }

      onSave(result as Route);
    } catch (err) {
      console.error('Error saving route:', err);
      setError(err instanceof Error ? err.message : 'Failed to save route');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'estimatedIncome' || name === 'startMile'
        ? value === '' ? undefined : Number(value)
        : value
    }));
  };

  const addIncomeItem = () => {
    if (newIncomeSource && newIncomeAmount !== '') {
      setFormData(prev => ({
        ...prev,
        incomes: [...prev.incomes, { source: newIncomeSource, amount: Number(newIncomeAmount) }]
      }));
      setNewIncomeSource('');
      setNewIncomeAmount('');
    }
  };

  const removeIncomeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      incomes: prev.incomes.filter((_, i) => i !== index)
    }));
  };

  const updateIncomeItem = (index: number, field: 'source' | 'amount', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      incomes: prev.incomes.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const isEdit = !!route;
  const totalEstimatedIncome = formData.incomes.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 text-center">
            {isEdit ? t('routes.crud.edit.title') : t('routes.crud.create.title')}
          </h3>
          
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="workType" className="block text-sm font-medium text-gray-700">
                  {t('routes.crud.create.workType')} *
                </label>
                {loadingConfigs ? (
                  <div className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                    <span className="text-gray-500">Loading work types...</span>
                  </div>
                ) : (
                  <select
                    id="workType"
                    name="workType"
                    value={formData.workTypeId || 'custom'}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'custom') {
                        handleWorkTypeChange('', formData.workType);
                      } else {
                        const config = workTypeConfigs.find(c => c.id === value);
                        if (config) {
                          handleWorkTypeChange(value, config.name);
                        }
                      }
                    }}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select work type</option>
                    {workTypeConfigs.map(config => (
                      <option key={config.id} value={config.id}>
                        {config.name}
                        {config.incomeSourceTemplates.length > 0 && 
                          ` (${config.incomeSourceTemplates.length} income sources)`
                        }
                      </option>
                    ))}
                    <option value="custom">Custom / Other</option>
                  </select>
                )}
                
                {/* Custom work type input - show when "custom" is selected or no workTypeId */}
                {(!formData.workTypeId || formData.workTypeId === 'custom') && (
                  <input
                    type="text"
                    placeholder="Enter custom work type"
                    value={formData.workType}
                    onChange={(e) => setFormData(prev => ({ ...prev, workType: e.target.value }))}
                    className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                )}
                
                {/* Show preview of auto-populated income sources */}
                {formData.workTypeId && workTypeConfigs.find(c => c.id === formData.workTypeId) && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Auto-populated income sources:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {workTypeConfigs.find(c => c.id === formData.workTypeId)?.incomeSourceTemplates.map((template, index) => (
                        <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {template.name}
                          {template.defaultAmount && ` (£${template.defaultAmount})`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="startMile" className="block text-sm font-medium text-gray-700">
                  {t('routes.crud.create.startMile')}
                </label>
                <input
                  type="number"
                  id="startMile"
                  name="startMile"
                  step="0.1"
                  min="0"
                  value={formData.startMile || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="scheduleStart" className="block text-sm font-medium text-gray-700">
                  {t('routes.crud.create.scheduleStart')} *
                </label>
                <input
                  type="datetime-local"
                  id="scheduleStart"
                  name="scheduleStart"
                  value={formData.scheduleStart}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="scheduleEnd" className="block text-sm font-medium text-gray-700">
                  {t('routes.crud.create.scheduleEnd')} *
                </label>
                <input
                  type="datetime-local"
                  id="scheduleEnd"
                  name="scheduleEnd"
                  value={formData.scheduleEnd}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="estimatedIncome" className="block text-sm font-medium text-gray-700">
                {t('routes.crud.create.estimatedIncome')}
              </label>
              <input
                type="number"
                id="estimatedIncome"
                name="estimatedIncome"
                step="0.01"
                min="0"
                value={formData.estimatedIncome || ''}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {!isEdit && (
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  {t('routes.crud.create.description')}
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  value={formData.description || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            {/* Income Items */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Income Sources
              </label>
              
              {/* Add New Income Item */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Income source (e.g., Base fare, Tips)"
                  value={newIncomeSource}
                  onChange={(e) => setNewIncomeSource(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="number"
                  placeholder="Amount"
                  step="0.01"
                  min="0"
                  value={newIncomeAmount}
                  onChange={(e) => setNewIncomeAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={addIncomeItem}
                  disabled={!newIncomeSource || newIncomeAmount === ''}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Add
                </button>
              </div>

              {/* Existing Income Items */}
              {formData.incomes.length > 0 && (
                <div className="space-y-2">
                  {formData.incomes.map((income, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={income.source}
                        onChange={(e) => updateIncomeItem(index, 'source', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      <input
                        type="number"
                        value={income.amount}
                        onChange={(e) => updateIncomeItem(index, 'amount', Number(e.target.value))}
                        step="0.01"
                        min="0"
                        className="w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeIncomeItem(index)}
                        className="bg-red-600 hover:bg-red-700 text-white px-2 py-2 rounded-md text-sm"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div className="text-right text-sm text-gray-600">
                    Total from income items: £{totalEstimatedIncome.toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md text-sm font-medium"
              >
                {isEdit ? t('routes.crud.edit.cancel') : t('routes.crud.create.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                {loading ? t('common.loading') : (isEdit ? t('routes.crud.edit.submit') : t('routes.crud.create.submit'))}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RouteForm;