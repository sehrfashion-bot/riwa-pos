import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../App';
import { Monitor, Settings, Globe } from 'lucide-react';
import { Button } from '../components/ui/button';

const LandingPage = () => {
  const navigate = useNavigate();
  const { t, toggleLanguage, language } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-center">
        <div className="text-muted-foreground text-sm">
          {t('RIWA POS & WEB SERVICES', 'قخدمات نقاط البيع والويب من ريوا')}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLanguage}
          className="text-muted-foreground hover:text-foreground"
          data-testid="language-toggle"
        >
          <Globe className="w-4 h-4 mr-2" />
          {language === 'en' ? 'العربية' : 'English'}
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Logo/Title */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-bold text-primary tracking-tight mb-2">
            RIWA POS
          </h1>
          <p className="text-muted-foreground text-lg">
            {t('Point of Sale System', 'نظام نقاط البيع')}
          </p>
        </div>

        {/* Two Large Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* POS Tile */}
          <button
            onClick={() => navigate('/pos')}
            className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-8 md:p-12 transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_40px_rgba(245,158,11,0.15)] active:scale-[0.98]"
            data-testid="pos-tile"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Monitor className="w-10 h-10 md:w-12 md:h-12 text-primary" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">
                {t('POS', 'نقطة البيع')}
              </h2>
              <p className="text-muted-foreground">
                {t('Cashier Terminal & KDS', 'محطة الكاشير وعرض المطبخ')}
              </p>
            </div>
          </button>

          {/* Admin Tile */}
          <button
            onClick={() => navigate('/admin')}
            className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-8 md:p-12 transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_40px_rgba(245,158,11,0.15)] active:scale-[0.98]"
            data-testid="admin-tile"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Settings className="w-10 h-10 md:w-12 md:h-12 text-primary" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">
                {t('Admin Panel', 'لوحة الإدارة')}
              </h2>
              <p className="text-muted-foreground">
                {t('Management & Reports', 'الإدارة والتقارير')}
              </p>
            </div>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-muted-foreground text-sm">
        © {new Date().getFullYear()} RIWA POS
      </footer>
    </div>
  );
};

export default LandingPage;
