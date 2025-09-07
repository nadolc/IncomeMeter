import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getAvailableScopes, getUserTokens, generateJwtToken, revokeJwtToken } from '../../utils/api';


interface ApiTokenResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: string;
  scopes: string[];
  tokenId: string;
  description: string;
}

interface ApiTokenInfo {
  tokenId: string;
  description: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  usageCount: number;
  daysUntilExpiry: number;
  isNearExpiry: boolean;
  isExpired: boolean;
  lastUsedIp?: string;
}

interface AvailableScopes {
  scope: string;
  description: string;
}

const JwtApiTokenGenerator: React.FC = () => {
  const { t } = useLanguage();
  
  // Form state
  const [description, setDescription] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [expiryDays, setExpiryDays] = useState<number>(365);
  const [generateRefreshToken, setGenerateRefreshToken] = useState(true);
  
  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewToken, setShowNewToken] = useState(false);
  const [newTokenData, setNewTokenData] = useState<ApiTokenResponse | null>(null);
  const [copied, setCopied] = useState<'access' | 'refresh' | null>(null);
  
  // Data state
  const [availableScopes, setAvailableScopes] = useState<AvailableScopes[]>([]);
  const [userTokens, setUserTokens] = useState<ApiTokenInfo[]>([]);
  const [defaultScopes, setDefaultScopes] = useState<string[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadAvailableScopes(),
        loadUserTokens()
      ]);
    } catch (err) {
      console.error('Failed to load initial data:', err);
      setError('Failed to load token data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableScopes = async () => {
    try {
      const data = await getAvailableScopes();
      setAvailableScopes(data.available_scopes);
      setDefaultScopes(data.default_scopes);
      setSelectedScopes(data.default_scopes);
    } catch (err) {
      console.error('Failed to load scopes:', err);
    }
  };

  const loadUserTokens = async () => {
    try {
      const tokens = await getUserTokens();
      setUserTokens(tokens);
    } catch (err) {
      console.error('Failed to load user tokens:', err);
    }
  };

  const handleGenerateToken = async () => {
    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    if (selectedScopes.length === 0) {
      setError('At least one scope must be selected');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const request = {
        description: description.trim(),
        scopes: selectedScopes,
        expiryDays,
        generateRefreshToken
      };

      const tokenData = await generateJwtToken(request);
      setNewTokenData(tokenData);
      setShowNewToken(true);
      setDescription('');
      setSelectedScopes(defaultScopes);
      setExpiryDays(365);
      await loadUserTokens(); // Refresh the token list
    } catch (err) {
      console.error('Failed to generate token:', err);
      setError('Failed to generate token');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToken = async (tokenType: 'access' | 'refresh') => {
    const token = tokenType === 'access' ? newTokenData?.accessToken : newTokenData?.refreshToken;
    if (!token) return;

    try {
      await navigator.clipboard.writeText(token);
      setCopied(tokenType);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy token:', err);
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    if (!window.confirm('Are you sure you want to revoke this token? This action cannot be undone.')) {
      return;
    }

    try {
      await revokeJwtToken(tokenId);
      await loadUserTokens(); // Refresh the list
    } catch (err) {
      console.error('Failed to revoke token:', err);
      setError('Failed to revoke token');
    }
  };

  const handleScopeToggle = (scope: string) => {
    setSelectedScopes(prev => 
      prev.includes(scope) 
        ? prev.filter(s => s !== scope)
        : [...prev, scope]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getTokenStatusBadge = (token: ApiTokenInfo) => {
    if (token.isExpired) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Expired</span>;
    }
    if (token.isNearExpiry) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Expires Soon</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">JWT API Tokens</h3>
        <p className="text-sm text-gray-600 mb-4">
          Generate secure JWT tokens for API access with scoped permissions and automatic expiration.
        </p>
      </div>

      {/* Token Generation Form */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-800 mb-4">Generate New Token</h4>
        
        <div className="space-y-4">
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Mobile App API Access"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isGenerating}
            />
          </div>

          {/* Scopes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permissions (Scopes) *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {availableScopes.map((scopeInfo) => (
                <label key={scopeInfo.scope} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scopeInfo.scope)}
                    onChange={() => handleScopeToggle(scopeInfo.scope)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isGenerating}
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{scopeInfo.scope}</div>
                    <div className="text-xs text-gray-500">{scopeInfo.description}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-2 flex space-x-2">
              <button
                type="button"
                onClick={() => setSelectedScopes(defaultScopes)}
                className="text-xs text-blue-600 hover:text-blue-800"
                disabled={isGenerating}
              >
                Select Default
              </button>
              <button
                type="button"
                onClick={() => setSelectedScopes(availableScopes.map(s => s.scope))}
                className="text-xs text-blue-600 hover:text-blue-800"
                disabled={isGenerating}
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSelectedScopes([])}
                className="text-xs text-blue-600 hover:text-blue-800"
                disabled={isGenerating}
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Expiry */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expires in (days)
              </label>
              <select
                value={expiryDays}
                onChange={(e) => setExpiryDays(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isGenerating}
              >
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={180}>6 months</option>
                <option value={365}>1 year</option>
                <option value={730}>2 years</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={generateRefreshToken}
                  onChange={(e) => setGenerateRefreshToken(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={isGenerating}
                />
                <span className="text-sm text-gray-700">Generate refresh token</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <button
            type="button"
            onClick={handleGenerateToken}
            disabled={isGenerating || !description.trim() || selectedScopes.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating...
              </span>
            ) : (
              'Generate JWT Token'
            )}
          </button>
        </div>
      </div>

      {/* Existing Tokens */}
      <div>
        <h4 className="font-medium text-gray-800 mb-4">Your API Tokens</h4>
        
        {userTokens.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No API tokens generated yet.</p>
        ) : (
          <div className="space-y-3">
            {userTokens.map((token) => (
              <div key={token.tokenId} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h5 className="font-medium text-gray-900">{token.description}</h5>
                      {getTokenStatusBadge(token)}
                    </div>
                    
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Created:</span> {formatDate(token.createdAt)}
                      </div>
                      <div>
                        <span className="font-medium">Expires:</span> {formatDate(token.expiresAt)}
                        <span className="ml-1 text-xs">({token.daysUntilExpiry} days)</span>
                      </div>
                      <div>
                        <span className="font-medium">Used:</span> {token.usageCount} times
                        {token.lastUsedAt && (
                          <span className="ml-1 text-xs">(last: {formatDate(token.lastUsedAt)})</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      <span className="font-medium text-sm text-gray-600">Scopes: </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {token.scopes.map(scope => (
                          <span key={scope} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleRevokeToken(token.tokenId)}
                    className="ml-4 px-3 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Token Modal */}
      {showNewToken && newTokenData && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 rounded-full mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
                API Token Generated Successfully
              </h3>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Store these tokens securely. You won't be able to view them again.
                </p>
              </div>

              {/* Access Token */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Token
                </label>
                <div className="bg-gray-100 p-3 rounded-md">
                  <code className="text-sm text-gray-800 break-all">{newTokenData.accessToken}</code>
                </div>
                <button
                  onClick={() => handleCopyToken('access')}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  {copied === 'access' ? 'Copied!' : 'Copy Access Token'}
                </button>
              </div>

              {/* Refresh Token */}
              {newTokenData.refreshToken && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Refresh Token
                  </label>
                  <div className="bg-gray-100 p-3 rounded-md">
                    <code className="text-sm text-gray-800 break-all">{newTokenData.refreshToken}</code>
                  </div>
                  <button
                    onClick={() => handleCopyToken('refresh')}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    {copied === 'refresh' ? 'Copied!' : 'Copy Refresh Token'}
                  </button>
                </div>
              )}

              {/* Token Info */}
              <div className="bg-blue-50 p-3 rounded-md mb-4">
                <div className="text-sm text-blue-800">
                  <p><strong>Description:</strong> {newTokenData.description}</p>
                  <p><strong>Expires:</strong> {new Date(newTokenData.expiresAt).toLocaleString()}</p>
                  <p><strong>Scopes:</strong> {newTokenData.scopes.join(', ')}</p>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => {
                    setShowNewToken(false);
                    setNewTokenData(null);
                    setCopied(null);
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JwtApiTokenGenerator;