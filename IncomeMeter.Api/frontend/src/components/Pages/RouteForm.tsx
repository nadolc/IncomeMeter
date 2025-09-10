import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';
import { useTimezone } from '../../hooks/useTimezone';
import { createDateInTimezone, toUserTimezone } from '../../utils/timezoneUtils';
import { getActiveWorkTypeConfigs, createRoute, updateRoute } from '../../utils/api';
import type { WorkTypeConfig, Route } from '../../types';

interface IncomeItem {
    source: string;
    amount: number;
}

interface RouteFormData {
    workType: string;
    workTypeId?: string;
    scheduleStart: string;
    scheduleEnd: string;
    actualStartTime?: string;
    actualEndTime?: string;
    estimatedIncome?: number;
    startMile?: number;
    endMile?: number;
    status: 'completed' | 'in_progress' | 'scheduled' | 'cancelled';
    description?: string;
    incomes: IncomeItem[];
}

// Using imported Route type from '../../types' instead of local definition

interface RouteFormProps {
    route?: Route;
    onSave: (route: Route) => void;
    onCancel: () => void;
}

const RouteForm: React.FC<RouteFormProps> = ({ route, onSave, onCancel }) => {
    const { t } = useTranslation();
    const { settings, formatCurrency } = useSettings();
    const { timezone } = useTimezone(settings.timeZone);

    // Helper function to format Date for datetime-local input in user's timezone
    const formatForDateTimeInput = useCallback((date: Date): string => {
        // Convert to user's timezone
        const userDate = toUserTimezone(date, timezone);
        // Format as YYYY-MM-DDTHH:MM (required by datetime-local input)
        return userDate.toISOString().slice(0, 16);
    }, [timezone]);

    // Helper function to create initial dates in user's timezone
    const getInitialScheduleDates = useCallback(() => {
        // Get current time formatted in user's timezone
        const now = new Date();
        
        // Format current time in the target timezone to get the local time components
        const formatter = new Intl.DateTimeFormat('sv-SE', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const nowInUserTz = formatter.format(now);
        const scheduleStart = nowInUserTz.replace(' ', 'T');
        
        // Add 8 hours for end time (simple string manipulation)
        const [datePart, timePart] = scheduleStart.split('T');
        const [hours, minutes] = timePart.split(':');
        const endHour = (parseInt(hours) + 8) % 24;
        const scheduleEnd = `${datePart}T${String(endHour).padStart(2, '0')}:${minutes}`;
        
        return {
            scheduleStart,
            scheduleEnd
        };
    }, [timezone]);
    const [formData, setFormData] = useState<RouteFormData>({
        workType: '',
        workTypeId: undefined,
        scheduleStart: '',
        scheduleEnd: '',
        actualStartTime: '',
        actualEndTime: '',
        estimatedIncome: undefined,
        startMile: undefined,
        endMile: undefined,
        status: 'scheduled',
        description: undefined,
        incomes: [],
    });
    const [workTypeConfigs, setWorkTypeConfigs] = useState<WorkTypeConfig[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingConfigs, setLoadingConfigs] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newIncomeSource, setNewIncomeSource] = useState('');
    const [newIncomeAmount, setNewIncomeAmount] = useState<number | ''>('');
    const [initialFormData, setInitialFormData] = useState<RouteFormData | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadWorkTypeConfigs();
    }, []);

    useEffect(() => {
        if (route) {
            const editFormData = {
                workType: route.workType || '',
                workTypeId: (route as Route & { workTypeId?: string }).workTypeId,
                scheduleStart: formatForDateTimeInput(new Date(route.scheduleStart)),
                scheduleEnd: formatForDateTimeInput(new Date(route.scheduleEnd)),
                actualStartTime: route.actualStartTime ? formatForDateTimeInput(new Date(route.actualStartTime)) : undefined,
                actualEndTime: route.actualEndTime ? formatForDateTimeInput(new Date(route.actualEndTime)) : undefined,
                estimatedIncome: route.estimatedIncome,
                startMile: route.startMile,
                endMile: route.endMile,
                status: route.status,
                description: undefined, // Not in the route model
                incomes: route.incomes || [],
            };
            setFormData(editFormData);
            setInitialFormData(editFormData);
        }
    }, [route, formatForDateTimeInput]);

    // Set initial form data for new routes - only run once when component mounts
    useEffect(() => {
        if (!route && !initialFormData) {
            const initialDates = getInitialScheduleDates();
            const newRouteFormData = {
                workType: '',
                workTypeId: undefined,
                scheduleStart: initialDates.scheduleStart,
                scheduleEnd: initialDates.scheduleEnd,
                actualStartTime: initialDates.scheduleStart,
                actualEndTime: initialDates.scheduleEnd,
                estimatedIncome: undefined,
                startMile: undefined,
                endMile: undefined,
                status: 'scheduled' as const,
                description: undefined,
                incomes: [],
            };
            setFormData(newRouteFormData);
            setInitialFormData(newRouteFormData);
        }
    }, [route, initialFormData, getInitialScheduleDates]);

    // Function to check if form has unsaved changes
    const isFormDirty = (): boolean => {
        if (!initialFormData) return false;
        
        // Compare all form fields
        const fieldsToCompare: (keyof RouteFormData)[] = [
            'workType', 'workTypeId', 'scheduleStart', 'scheduleEnd', 
            'actualStartTime', 'actualEndTime', 'estimatedIncome', 
            'startMile', 'endMile', 'status', 'description'
        ];
        
        for (const field of fieldsToCompare) {
            if (formData[field] !== initialFormData[field]) {
                return true;
            }
        }
        
        // Compare incomes array
        if (formData.incomes.length !== initialFormData.incomes.length) {
            return true;
        }
        
        for (let i = 0; i < formData.incomes.length; i++) {
            if (formData.incomes[i].source !== initialFormData.incomes[i].source ||
                formData.incomes[i].amount !== initialFormData.incomes[i].amount) {
                return true;
            }
        }
        
        return false;
    };

    // Handle click outside modal
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                if (isFormDirty()) {
                    // Show confirmation dialog here later
                    console.log('Form has unsaved changes - would show dialog');
                }
                onCancel();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isFormDirty, onCancel]);

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

        // Check if user has unsaved income source
        if (newIncomeSource.trim() || newIncomeAmount !== '') {
            setError(t('routes.crud.validation.unsavedIncomeSource') || 'Please add or clear the income source before saving the route.');
            setLoading(false);
            return;
        }

        try {
            // Calculate total income from incomes array
            const totalIncome = formData.incomes.reduce((sum, item) => sum + item.amount, 0);

            // Convert datetime-local input values from user's timezone to UTC for backend storage
            const requestData = {
                workType: formData.workType,
                workTypeId: formData.workTypeId,
                scheduleStart: createDateInTimezone(formData.scheduleStart, timezone),
                scheduleEnd: createDateInTimezone(formData.scheduleEnd, timezone),
                actualStartTime: formData.actualStartTime ? createDateInTimezone(formData.actualStartTime, timezone) : undefined,
                actualEndTime: formData.actualEndTime ? createDateInTimezone(formData.actualEndTime, timezone) : undefined,
                estimatedIncome: formData.estimatedIncome,
                totalIncome: totalIncome, // Add calculated total income
                startMile: formData.startMile,
                endMile: formData.endMile,
                status: formData.status,
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

            // Convert dates from strings to Date objects to match Route interface
            const routeWithDates = {
                ...result,
                scheduleStart: new Date(result.scheduleStart),
                scheduleEnd: new Date(result.scheduleEnd),
                actualStartTime: result.actualStartTime ? new Date(result.actualStartTime) : undefined,
                actualEndTime: result.actualEndTime ? new Date(result.actualEndTime) : undefined,
                createdAt: new Date(result.createdAt),
                updatedAt: new Date(result.updatedAt)
            } as Route;

            onSave(routeWithDates);
        } catch (err) {
            console.error('Error saving route:', err);
            setError(err instanceof Error ? err.message : 'Failed to save route');
        } finally {
            setLoading(false);
        }
    };

    // State to track if the checkbox is checked
    const [isSameAsSchedule, setIsSameAsSchedule] = useState(true);

    // Handler specifically for the checkbox
    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { checked } = e.target;
        setIsSameAsSchedule(checked);

        if (checked) {
            // If checked, copy the scheduled times to the actual times
            setFormData(prevFormData => ({
                ...prevFormData,
                actualStartTime: prevFormData.scheduleStart,
                actualEndTime: prevFormData.scheduleEnd,
            }));
        } else {
            // If unchecked, clear the actual times
            setFormData(prevFormData => ({
                ...prevFormData,
                actualStartTime: '',
                actualEndTime: '',
            }));
        }
    };

    useEffect(() => {
        setIsSameAsSchedule(true);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newData = {
                ...prev,
                [name]: name === 'estimatedIncome' || name === 'startMile' || name === 'endMile'
                    ? value === '' ? undefined : Number(value)
                    : value
            };

            // Auto-calculate distance when mileage changes
            if ((name === 'startMile' || name === 'endMile') && newData.startMile && newData.endMile) {
                // This would trigger a distance calculation - implement if needed
                console.log('Auto-calculate distance:', newData.endMile - newData.startMile);
            }

            return newData;
        });
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
        <div>
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div ref={modalRef} className="relative top-4 mx-auto p-6 border w-full max-w-4xl shadow-lg rounded-md bg-white max-h-[95vh] overflow-y-auto">
                    <div className="mb-4">
                        <h3 className="text-lg font-medium text-gray-900 text-center">
                            {isEdit ? t('routes.crud.edit.title') : t('routes.crud.create.title')}
                            {isFormDirty() && <span className="text-orange-500 ml-1">*</span>}
                        </h3>

                    {error && (
                        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="mt-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Column 1: Work Type, Schedule Times, Status, Estimated Income */}
                            <div className="space-y-4">
                                {/* Work Type Section */}
                                <div>
                                    <label htmlFor="workType" className="block text-sm font-medium text-gray-700">
                                        {t('routes.crud.create.workType')} *
                                    </label>
                                    {loadingConfigs ? (
                                        <div className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                                            <span className="text-gray-500">{t('routes.crud.create.loadingWorkType')}</span>
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
                                                <option value="">{t('routes.crud.create.selectWorkType')} </option>
                                            {workTypeConfigs.map(config => (
                                                <option key={config.id} value={config.id}>
                                                    {config.name}
                                                    {config.incomeSourceTemplates.length > 0 &&
                                                        ` (${config.incomeSourceTemplates.length} income sources)`
                                                    }
                                                </option>
                                            ))}
                                                <option value="custom">{t('routes.crud.create.other')}</option>
                                        </select>
                                    )}

                                    {/* Custom work type input - show when "custom" is selected or no workTypeId */}
                                    {(!formData.workTypeId || formData.workTypeId === 'custom') && (
                                        <input
                                            type="text"
                                            placeholder={t('routes.crud.create.enterCustomWorkType')}
                                            value={formData.workType}
                                            onChange={(e) => setFormData(prev => ({ ...prev, workType: e.target.value }))}
                                            className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            required
                                        />
                                    )}

                                    {/* Show preview of auto-populated income sources */}
                                    {formData.workTypeId && workTypeConfigs.find(c => c.id === formData.workTypeId) && (
                                        <div className="mt-2 text-sm text-gray-600">
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {workTypeConfigs.find(c => c.id === formData.workTypeId)?.incomeSourceTemplates.map((template, index) => (
                                                    <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                        {template.name}
                                                        {template.defaultAmount && ` (${formatCurrency(template.defaultAmount)})`}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Schedule Times */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                                {/* Route Status */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        {t('routes.crud.create.routeStatus')}
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { value: 'scheduled', label: t('routes.filters.scheduled'), selectedColor: 'bg-blue-600', unselectedColor: 'bg-gray-200 text-gray-600 hover:bg-gray-300' },
                                            { value: 'in_progress', label: t('routes.filters.inProgress'), selectedColor: 'bg-orange-600', unselectedColor: 'bg-gray-200 text-gray-600 hover:bg-gray-300' },
                                            { value: 'completed', label: t('routes.filters.completed'), selectedColor: 'bg-green-600', unselectedColor: 'bg-gray-200 text-gray-600 hover:bg-gray-300' },
                                            { value: 'cancelled', label: t('routes.filters.cancelled'), selectedColor: 'bg-gray-600', unselectedColor: 'bg-gray-200 text-gray-600 hover:bg-gray-300' },
                                        ].map((status) => (
                                            <button
                                                key={status.value}
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, status: status.value as 'completed' | 'in_progress' | 'scheduled' | 'cancelled' }))}
                                                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 border-2 ${formData.status === status.value
                                                        ? `${status.selectedColor} text-white border-white ring-2 ring-offset-2 ring-blue-200 shadow-lg transform scale-105`
                                                        : `${status.unselectedColor} border-gray-300 hover:border-gray-400 shadow-sm`
                                                    }`}
                                            >
                                                {status.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Estimated Income */}
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
                            </div>

                            {/* Column 2: Mileage, Actual Times, Description, Income Sources */}
                            <div className="space-y-4">
                                {/* Mileage */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                                    <div>
                                        <label htmlFor="endMile" className="block text-sm font-medium text-gray-700">
                                            {t('routes.crud.create.endMile')}
                                        </label>
                                        <input
                                            type="number"
                                            id="endMile"
                                            name="endMile"
                                            step="0.1"
                                            min="0"
                                            value={formData.endMile || ''}
                                            onChange={handleInputChange}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                {/* Checkbox for Same as Actual */}
                                <div className="flex items-center justify-start gap-2">
                                    <input
                                        type="checkbox"
                                        id="scheduleSameToActual"
                                        name="scheduleSameToActual"
                                        checked={isSameAsSchedule}
                                        onChange={handleCheckboxChange}
                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <label htmlFor="scheduleSameToActual" className="text-sm font-medium text-gray-700 select-none">
                                        {t('routes.crud.create.scheduleSameToActual')}
                                    </label>
                                </div>

                                {/* Actual Times */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor="actualStartTime" className="block text-sm font-medium text-gray-700">
                                            {t('routes.crud.create.actualStart')}
                                        </label>
                                        <input
                                            type="datetime-local"
                                            id="actualStartTime"
                                            name="actualStartTime"
                                            value={formData.actualStartTime || ''}
                                            onChange={handleInputChange}
                                            disabled={isSameAsSchedule}
                                            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none ${isSameAsSchedule ? 'bg-gray-200 cursor-not-allowed' : 'bg-white border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                                }`}
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="actualEndTime" className="block text-sm font-medium text-gray-700">
                                            {t('routes.crud.create.actualEnd')}
                                        </label>
                                        <input
                                            type="datetime-local"
                                            id="actualEndTime"
                                            name="actualEndTime"
                                            value={formData.actualEndTime || ''}
                                            onChange={handleInputChange}
                                            disabled={isSameAsSchedule}
                                            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none ${isSameAsSchedule ? 'bg-gray-200 cursor-not-allowed' : 'bg-white border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                                }`}
                                        />
                                    </div>
                                </div>

                                {/* Description */}
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
                            </div>
                        </div>

                        {/* Income Sources Section - spans full width */}
                        <div className="mt-6">
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                {t('routes.crud.create.incomeSources')}
                            </label>

                            {/* Add New Income Item */}
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    placeholder={t('routes.crud.create.incomeSourcesPlaceholder')}
                                    value={newIncomeSource}
                                    onChange={(e) => setNewIncomeSource(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                />
                                <input
                                    type="number"
                                    placeholder={t('routes.crud.create.amountPlaceholder')}
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
                                    +
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
                                        <span className="font-medium">{t('routes.crud.create.totalAmount')}: {formatCurrency(totalEstimatedIncome)}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end space-x-3 pt-4">
                            <button
                                type="button"
                                onClick={() => {
                                    if (isFormDirty()) {
                                        console.log('Form has unsaved changes - would show dialog');
                                    }
                                    onCancel();
                                }}
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

        </div>
    );
};

export default RouteForm;