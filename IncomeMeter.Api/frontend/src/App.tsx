import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Layout from './components/Layout/Layout';
import Dashboard from './components/Pages/Dashboard';
import Login from './components/Pages/Login';
import Register from './components/Pages/Register';
import Settings from './components/Pages/Settings';
import Profile from './components/Pages/Profile';
import RouteList from './components/Pages/RouteList';
import RouteDetails from './components/Pages/RouteDetails';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import AuthCallback from './components/Auth/AuthCallback';
import './i18n';
import TokenDisplay from './components/Debug/TokenDisplay';

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <LanguageProvider>
          <Router>
            <div className="min-h-screen bg-gray-50">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/auth-callback" element={<AuthCallback />} />
                <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="routes" element={<RouteList />} />
                  <Route path="routes/:id" element={<RouteDetails />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
              <TokenDisplay />
            </div>
          </Router>
        </LanguageProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
