import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface MultiSelectOption {
  id: string;
  label: string;
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onSelectionChange: (selectedValues: string[]) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select options",
  label,
  className = ""
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleOption = (optionId: string) => {
    const isSelected = selectedValues.includes(optionId);
    if (isSelected) {
      onSelectionChange(selectedValues.filter(id => id !== optionId));
    } else {
      onSelectionChange([...selectedValues, optionId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedValues.length === options.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(options.map(option => option.id));
    }
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) {
      return placeholder;
    } else if (selectedValues.length === 1) {
      const selectedOption = options.find(opt => opt.id === selectedValues[0]);
      return selectedOption?.label || placeholder;
    } else {
      return `${selectedValues.length} selected`;
    }
  };

  const isAllSelected = selectedValues.length === options.length && options.length > 0;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between"
      >
        <span className={`block truncate ${selectedValues.length === 0 ? 'text-gray-500' : 'text-gray-900'}`}>
          {getDisplayText()}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {options.length > 0 && (
            <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {isAllSelected ? t('common.clearAll') || 'Clear All' : t('common.selectAll') || 'Select All'}
                </button>
                {selectedValues.length > 0 && selectedValues.length < options.length && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs text-gray-600 hover:text-gray-800"
                  >
                    {t('common.clearAll') || 'Clear All'}
                  </button>
                )}
              </div>
            </div>
          )}

          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              {t('common.noOptions') || 'No options available'}
            </div>
          ) : (
            <div className="py-1">
              {options.map((option) => (
                <label
                  key={option.id}
                  className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option.id)}
                    onChange={() => handleToggleOption(option.id)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-900 truncate">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;