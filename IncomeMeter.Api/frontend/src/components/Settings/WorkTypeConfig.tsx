import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
// import { useTranslation } from 'react-i18next'; // Commented out as unused
import { 
  getWorkTypeConfigs, 
  createWorkTypeConfig, 
  updateWorkTypeConfig, 
  deleteWorkTypeConfig 
} from '../../utils/api';
import type { WorkTypeConfig, CreateWorkTypeConfigRequest, IncomeSourceTemplate } from '../../types';

const WorkTypeConfigSection: React.FC = () => {
  // const { t } = useTranslation(); // Commented out as unused
  const [workTypeConfigs, setWorkTypeConfigs] = useState<WorkTypeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<WorkTypeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateWorkTypeConfigRequest>({
    name: '',
    description: '',
    incomeSourceTemplates: [],
    isActive: true,
  });

  useEffect(() => {
    loadWorkTypeConfigs();
  }, []);

  const loadWorkTypeConfigs = async () => {
    try {
      setLoading(true);
      const configs = await getWorkTypeConfigs();
      setWorkTypeConfigs(configs);
      setError(null);
    } catch (err) {
      console.error('Error loading work type configs:', err);
      setError('Failed to load work type configurations');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      incomeSourceTemplates: [],
      isActive: true,
    });
    setEditingConfig(null);
    setShowCreateForm(false);
  };

  const initializeNewForm = () => {
    setFormData({
      name: '',
      description: '',
      incomeSourceTemplates: [{
        name: '',
        category: '',
        defaultAmount: undefined,
        isRequired: false,
        description: '',
      }],
      isActive: true,
    });
    setEditingConfig(null);
    setShowCreateForm(true);
  };

  const handleCreateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newConfig = await createWorkTypeConfig(formData);
      setWorkTypeConfigs(prev => [newConfig, ...prev]);
      resetForm();
    } catch (err) {
      console.error('Error creating work type config:', err);
      setError('Failed to create work type configuration');
    }
  };

  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConfig) return;

    try {
      const updatedConfig = await updateWorkTypeConfig(editingConfig.id, formData);
      setWorkTypeConfigs(prev => 
        prev.map(config => config.id === editingConfig.id ? updatedConfig : config)
      );
      resetForm();
    } catch (err) {
      console.error('Error updating work type config:', err);
      setError('Failed to update work type configuration');
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('Are you sure you want to delete this work type configuration?')) return;

    try {
      await deleteWorkTypeConfig(id);
      setWorkTypeConfigs(prev => prev.filter(config => config.id !== id));
    } catch (err) {
      console.error('Error deleting work type config:', err);
      setError('Failed to delete work type configuration');
    }
  };

  const startEdit = (config: WorkTypeConfig) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      description: config.description,
      incomeSourceTemplates: config.incomeSourceTemplates.map(template => ({
        name: template.name,
        category: template.category,
        defaultAmount: template.defaultAmount,
        isRequired: template.isRequired,
        description: template.description,
      })),
      isActive: config.isActive,
    });
    setShowCreateForm(true);
  };

  const addIncomeSource = () => {
    setFormData(prev => ({
      ...prev,
      incomeSourceTemplates: [
        ...prev.incomeSourceTemplates,
        {
          name: '',
          category: '',
          defaultAmount: undefined,
          isRequired: false,
          description: '',
        }
      ]
    }));
  };

  const updateIncomeSource = (index: number, field: keyof IncomeSourceTemplate, value: any) => {
    setFormData(prev => ({
      ...prev,
      incomeSourceTemplates: prev.incomeSourceTemplates.map((template, i) =>
        i === index ? { ...template, [field]: value } : template
      )
    }));
  };

  const removeIncomeSource = (index: number) => {
    setFormData(prev => ({
      ...prev,
      incomeSourceTemplates: prev.incomeSourceTemplates.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Work Types & Income Sources</h3>
          <p className="text-sm text-gray-600 mt-1">Configure work types with associated income sources for streamlined route creation</p>
        </div>
        <button
          onClick={initializeNewForm}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Add Work Type
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Work Type Configurations List */}
      <div className="space-y-4 mb-6">
        {workTypeConfigs.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <div className="text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-lg font-medium text-gray-900">No work types configured</p>
              <p className="text-gray-600">Create your first work type to get started</p>
            </div>
          </div>
        ) : (
          workTypeConfigs.map((config) => (
            <div key={config.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-gray-900">{config.name}</h4>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      config.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {config.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {config.description && (
                    <p className="text-sm text-gray-600 mb-3">{config.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {config.incomeSourceTemplates.map((template, index) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {template.name}
                        {template.defaultAmount && ` (£${template.defaultAmount})`}
                        {template.isRequired && ' *'}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => startEdit(config)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteConfig(config.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && createPortal(
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingConfig ? 'Edit Work Type' : 'Create New Work Type'}
              </h3>
              
              <form onSubmit={editingConfig ? handleUpdateConfig : handleCreateConfig} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Multi-app Delivery, Taxi Service"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Optional description for this work type"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Income Sources
                    </label>
                    <button
                      type="button"
                      onClick={addIncomeSource}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      + Add Income Source
                    </button>
                  </div>
                  
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {formData.incomeSourceTemplates.map((template, index) => (
                      <div key={index} className="border border-gray-200 rounded-md p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <input
                              type="text"
                              value={template.name}
                              onChange={(e) => updateIncomeSource(index, 'name', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Income source name (e.g., Uber Eat)"
                              required
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              value={template.category || ''}
                              onChange={(e) => updateIncomeSource(index, 'category', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Category (optional)"
                            />
                          </div>
                          <div>
                            <input
                              type="number"
                              value={template.defaultAmount || ''}
                              onChange={(e) => updateIncomeSource(index, 'defaultAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Default amount (optional)"
                              step="0.01"
                              min="0"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={template.isRequired}
                                onChange={(e) => updateIncomeSource(index, 'isRequired', e.target.checked)}
                                className="mr-2"
                              />
                              <span className="text-sm">Required</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => removeIncomeSource(index)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="mr-2"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Active (available for route creation)
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                  >
                    {editingConfig ? 'Update' : 'Create'} Work Type
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default WorkTypeConfigSection;