import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

// Pages
import LandingPage from './pages/LandingPage';
import POSLogin from './pages/pos/POSLogin';
import POSTerminal from './pages/pos/POSTerminal';
import POSKDS from './pages/pos/POSKDS';
import POSSettings from './pages/pos/POSSettings';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminMenu from './pages/admin/AdminMenu';
import AdminDeliveryZones from './pages/admin/AdminDeliveryZones';
import AdminCoupons from './pages/admin/AdminCoupons';
import AdminLoyalty from './pages/admin/AdminLoyalty';
import AdminDevices from './pages/admin/AdminDevices';
import AdminSettings from './pages/admin/AdminSettings';
import AdminReports from './pages/admin/AdminReports';

// Context
const AppContext = createContext(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

// Language context
const LanguageContext = createContext(null);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};

const API_URL = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('riwa_token'));
  const [language, setLanguage] = useState(localStorage.getItem('riwa_lang') || 'en');
  const [isRTL, setIsRTL] = useState(language === 'ar');

  // Set RTL direction
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    localStorage.setItem('riwa_lang', language);
  }, [isRTL, language]);

  const toggleLanguage = useCallback(() => {
    const newLang = language === 'en' ? 'ar' : 'en';
    setLanguage(newLang);
    setIsRTL(newLang === 'ar');
  }, [language]);

  // Translation helper
  const t = useCallback((en, ar) => {
    return language === 'ar' ? ar : en;
  }, [language]);

  // Auth functions
  const login = useCallback((userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('riwa_token', authToken);
    localStorage.setItem('riwa_user', JSON.stringify(userData));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('riwa_token');
    localStorage.removeItem('riwa_user');
  }, []);

  // Load user from storage - persistent login
  useEffect(() => {
    const storedUser = localStorage.getItem('riwa_user');
    const storedToken = localStorage.getItem('riwa_token');
    
    if (storedUser && storedToken) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setToken(storedToken);
      } catch (e) {
        // Invalid stored data - clear it
        localStorage.removeItem('riwa_user');
        localStorage.removeItem('riwa_token');
      }
    }
  }, []);

  const appValue = {
    user,
    token,
    login,
    logout,
    apiUrl: `${API_URL}/api`,
    isAuthenticated: !!token && !!user,
  };

  const langValue = {
    language,
    isRTL,
    toggleLanguage,
    t,
  };

  return (
    <AppContext.Provider value={appValue}>
      <LanguageContext.Provider value={langValue}>
        <div className="min-h-screen bg-background text-foreground noise-bg">
          <BrowserRouter>
            <Routes>
              {/* Landing */}
              <Route path="/" element={<LandingPage />} />
              
              {/* POS Routes */}
              <Route path="/pos" element={<POSLogin />} />
              <Route path="/pos/terminal" element={<POSTerminal />} />
              <Route path="/pos/kds" element={<POSKDS />} />
              <Route path="/pos/settings" element={<POSSettings />} />
              
              {/* Admin Routes */}
              <Route path="/admin" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/orders" element={<AdminOrders />} />
              <Route path="/admin/menu" element={<AdminMenu />} />
              <Route path="/admin/delivery-zones" element={<AdminDeliveryZones />} />
              <Route path="/admin/coupons" element={<AdminCoupons />} />
              <Route path="/admin/loyalty" element={<AdminLoyalty />} />
              <Route path="/admin/devices" element={<AdminDevices />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster 
            position="top-center" 
            richColors 
            toastOptions={{
              style: {
                background: 'hsl(0 0% 7%)',
                border: '1px solid hsl(0 0% 15%)',
                color: 'hsl(0 0% 98%)',
              },
            }}
          />
        </div>
      </LanguageContext.Provider>
    </AppContext.Provider>
  );
}

export default App;
