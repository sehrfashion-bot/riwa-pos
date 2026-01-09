import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, MapPin, Ticket,
  Heart, Printer, Settings, FileText, LogOut, Globe, ChevronRight
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { ScrollArea } from '../../components/ui/scroll-area';

const AdminLayout = ({ children, title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useApp();
  const { t, toggleLanguage, language, isRTL } = useLanguage();

  const handleLogout = () => {
    logout();
    navigate('/admin');
  };

  const navItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: t('Dashboard', 'لوحة التحكم') },
    { path: '/admin/orders', icon: ShoppingBag, label: t('Orders', 'الطلبات') },
    { path: '/admin/menu', icon: UtensilsCrossed, label: t('Menu', 'القائمة') },
    { path: '/admin/delivery-zones', icon: MapPin, label: t('Delivery Zones', 'مناطق التوصيل') },
    { path: '/admin/coupons', icon: Ticket, label: t('Coupons', 'الكوبونات') },
    { path: '/admin/loyalty', icon: Heart, label: t('Loyalty', 'الولاء') },
    { path: '/admin/printers', icon: Printer, label: t('Printers', 'الطابعات') },
    { path: '/admin/settings', icon: Settings, label: t('Settings', 'الإعدادات') },
    { path: '/admin/reports', icon: FileText, label: t('Reports', 'التقارير') },
  ];

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Sidebar */}
      <aside className={`w-64 border-border/30 bg-card/50 flex flex-col shrink-0 ${isRTL ? 'border-l' : 'border-r'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-border/30">
          <h1 className="text-xl font-bold text-primary">RIWA Admin</h1>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="px-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                  data-testid={`nav-${item.path.split('/').pop()}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                  {isActive && <ChevronRight className={`w-4 h-4 ${isRTL ? 'mr-auto rotate-180' : 'ml-auto'}`} />}
                </NavLink>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border/30 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={toggleLanguage}
          >
            <Globe className="w-5 h-5 mr-3" />
            {language === 'en' ? 'العربية' : 'English'}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive"
            onClick={handleLogout}
            data-testid="admin-logout"
          >
            <LogOut className="w-5 h-5 mr-3" />
            {t('Logout', 'تسجيل الخروج')}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border/30 flex items-center justify-between px-6 bg-card/30 backdrop-blur shrink-0">
          <h2 className="text-xl font-bold">{title}</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.name || user?.email || 'Admin'}
            </span>
          </div>
        </header>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {children}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
};

export default AdminLayout;
