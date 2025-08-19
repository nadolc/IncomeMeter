import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import LanguageSwitcher from '../Common/LanguageSwitcher';

const NavBar: React.FC = () => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  const toggleMobileMenu = () => {
    setShowMobileMenu(!showMobileMenu);
    setShowUserMenu(false);
  };

  const closeMobileMenu = () => {
    setShowMobileMenu(false);
  };

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
    setShowMobileMenu(false);
  };

  const handleLogout = async () => {
    await logout();
  };

  const isActivePage = (path: string) => {
    return location.pathname === path;
  };

  const getLinkClass = (path: string, isMobile = false) => {
    const baseClass = isMobile
      ? 'block px-3 py-2.5 sm:px-4 sm:py-3 rounded-md font-medium'
      : 'text-gray-700 hover:text-blue-600 px-2 xl:px-3 py-2 rounded-md text-sm font-medium';
    
    return isActivePage(path)
      ? `${baseClass} ${isMobile ? 'bg-blue-50 text-blue-600' : 'text-blue-600 bg-blue-50'}`
      : `${baseClass} ${isMobile ? 'text-gray-700 hover:bg-blue-50 hover:text-blue-600' : ''}`;
  };

  return (
    <nav className="bg-white shadow-lg">
      <div className="w-full px-2 sm:px-4">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Mobile menu button (left) */}
          <div className="lg:hidden flex-shrink-0">
            <button
              onClick={toggleMobileMenu}
              className="mobile-nav-button"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Logo/Title (center on mobile, left on desktop) */}
          <div className="flex-1 lg:flex-none flex justify-center lg:justify-start px-2">
            <Link
              to="/dashboard"
              className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 truncate"
            >
              <span className="hidden xs:inline">{t('app.title')}</span>
              <span className="xs:hidden">IM</span>
            </Link>
          </div>

          {/* Desktop menu (right) */}
          <div className="hidden lg:flex items-center space-x-2 xl:space-x-4">
            <Link to="/dashboard" className={getLinkClass('/dashboard')}>
              {t('navigation.dashboard')}
            </Link>
            <Link to="/routes" className={getLinkClass('/routes')}>
              {t('routes.title')}
            </Link>
            <Link to="/routes/manage" className={getLinkClass('/routes/manage')}>
              {t('navigation.routeManagement')}
            </Link>
            <Link to="/profile" className={getLinkClass('/profile')}>
              {t('navigation.profile')}
            </Link>
            <Link to="/settings" className={getLinkClass('/settings')}>
              {t('navigation.settings')}
            </Link>

            <div className="flex items-center space-x-2">
              <span className="hidden xl:inline text-sm text-gray-600 max-w-24 truncate">
                {user?.name}
              </span>
              <LanguageSwitcher showText={false} className="mr-2" />
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-3 xl:px-4 py-2 rounded-md text-sm font-medium"
              >
                {t('auth.logout')}
              </button>
            </div>
          </div>

          {/* Mobile user menu button (right) */}
          <div className="lg:hidden flex-shrink-0">
            <button
              onClick={toggleUserMenu}
              className="mobile-nav-button"
              aria-label="Toggle user menu"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu overlay */}
        {showMobileMenu && (
          <div className="mobile-menu-overlay" onClick={closeMobileMenu}>
            <div
              className={`mobile-menu-panel ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 sm:p-4">
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl font-bold text-blue-600">{t('navigation.menu')}</h2>
                  <button
                    onClick={closeMobileMenu}
                    className="p-1 text-gray-500 hover:text-gray-700"
                    aria-label="Close menu"
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <nav className="space-y-2">
                  <Link
                    to="/dashboard"
                    onClick={closeMobileMenu}
                    className={getLinkClass('/dashboard', true)}
                  >
                    <div className="flex items-center">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v0H8v0z" />
                      </svg>
                      <span className="text-sm sm:text-base">{t('navigation.dashboard')}</span>
                    </div>
                  </Link>

                  <Link
                    to="/routes"
                    onClick={closeMobileMenu}
                    className={getLinkClass('/routes', true)}
                  >
                    <div className="flex items-center">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <span className="text-sm sm:text-base">{t('routes.title')}</span>
                    </div>
                  </Link>

                  <Link
                    to="/routes/manage"
                    onClick={closeMobileMenu}
                    className={getLinkClass('/routes/manage', true)}
                  >
                    <div className="flex items-center">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                      </svg>
                      <span className="text-sm sm:text-base">{t('navigation.routeManagement')}</span>
                    </div>
                  </Link>

                  <Link
                    to="/profile"
                    onClick={closeMobileMenu}
                    className={getLinkClass('/profile', true)}
                  >
                    <div className="flex items-center">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-sm sm:text-base">{t('navigation.profile')}</span>
                    </div>
                  </Link>

                  <Link
                    to="/settings"
                    onClick={closeMobileMenu}
                    className={getLinkClass('/settings', true)}
                  >
                    <div className="flex items-center">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm sm:text-base">{t('navigation.settings')}</span>
                    </div>
                  </Link>
                </nav>

                <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200">
                  <div className="px-3 py-2 sm:px-4">
                    <p className="text-xs sm:text-sm text-gray-600 mb-2">Logged in as:</p>
                    <p className="text-sm sm:text-base font-medium text-gray-900 truncate">
                      {user?.name}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full bg-red-500 hover:bg-red-600 text-white px-3 py-2.5 sm:px-4 sm:py-3 rounded-md text-sm sm:text-base font-medium mt-3 sm:mt-4"
                  >
                    {t('auth.logout')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile user menu dropdown */}
        {showUserMenu && (
          <div className="lg:hidden absolute right-2 top-14 sm:top-16 w-44 sm:w-48 bg-white rounded-md shadow-lg py-2 z-50">
            <div className="px-3 py-2 border-b border-gray-200">
              <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                {user?.name}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 text-xs sm:text-sm text-red-600 hover:bg-red-50"
            >
              {t('auth.logout')}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default NavBar;