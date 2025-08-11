import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    const handleCallback = async () => {
      const token = searchParams.get('token');
      const redirectUrl = searchParams.get('redirectUrl') || '/dashboard';
      const error = searchParams.get('error');

      if (error) {
        navigate('/login?error=' + encodeURIComponent(error));
        return;
      }

      if (token) {
        // DEBUG: Log token for API testing
        console.log('=== JWT TOKEN FOR API TESTING ===');
        console.log('Token:', token);
        console.log('Authorization Header:', `Bearer ${token}`);
        console.log('==================================');
        
        // Store the token
        localStorage.setItem('accessToken', token);
        
        // Fetch user profile and update auth context
        try {
          const apiUrl = import.meta.env.VITE_API_URL || 'https://localhost:7079';
          const response = await fetch(`${apiUrl}/api/auth/profile`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          }
        } catch (error) {
          console.error('Failed to fetch user profile:', error);
        }

        // Redirect to the intended page
        navigate(redirectUrl);
      } else {
        navigate('/login?error=No token received');
      }
    };

    handleCallback();
  }, [navigate, searchParams, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">{t('common.loading')}</p>
      </div>
    </div>
  );
};

export default AuthCallback;