import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { generateApiKey } from '../../utils/api';

const ApiKeyGenerator: React.FC = () => {
  const { t } = useLanguage();
  const [description, setDescription] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    
    if (!description.trim()) {
      setError(t('apiKeys.errors.descriptionRequired'));
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const result = await generateApiKey(description.trim());
      setGeneratedKey(result.apiKey);
      setShowKey(true);
      setDescription('');
    } catch (err) {
      console.error('Failed to generate API key:', err);
      setError(t('apiKeys.errors.generateFailed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy API key:', err);
    }
  };

  const handleCloseModal = () => {
    setShowKey(false);
    setGeneratedKey('');
    setCopied(false);
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('apiKeys.title')}</h3>
      <p className="text-sm text-gray-600 mb-6">{t('apiKeys.description')}</p>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="apiKeyDescription" className="block text-sm font-medium text-gray-700 mb-2">
            {t('apiKeys.form.description')}
          </label>
          <input
            type="text"
            id="apiKeyDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('apiKeys.form.descriptionPlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isGenerating}
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || !description.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t('apiKeys.generating')}
            </span>
          ) : (
            t('apiKeys.generate')
          )}
        </button>
      </div>

      {/* Modal for showing generated API key */}
      {showKey && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" onClick={handleCloseModal}>
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 rounded-full mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
                {t('apiKeys.success.title')}
              </h3>
              <p className="text-sm text-gray-600 text-center mb-4">
                {t('apiKeys.success.message')}
              </p>
              
              <div className="bg-gray-100 p-3 rounded-md mb-4">
                <code className="text-sm text-gray-800 break-all">{generatedKey}</code>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleCopyKey}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                >
                  {copied ? t('apiKeys.success.copied') : t('apiKeys.success.copyKey')}
                </button>
                <button
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-400 transition-colors"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeyGenerator;