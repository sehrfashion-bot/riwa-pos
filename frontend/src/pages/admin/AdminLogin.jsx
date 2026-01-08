import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import { toast } from 'sonner';
import { ArrowLeft, Globe, Loader2, Mail, Lock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { login, apiUrl } = useApp();
  const { t, toggleLanguage, language } = useLanguage();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error(t('Please fill all fields', 'يرجى ملء جميع الحقول'));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/auth/email-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        login(data.user, data.token);
        toast.success(t('Welcome!', 'مرحباً!'));
        navigate('/admin/dashboard');
      } else {
        toast.error(t('Invalid credentials', 'بيانات اعتماد غير صالحة'));
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error(t('Login failed', 'فشل تسجيل الدخول'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-4 flex justify-between items-center border-b border-border/30">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="text-muted-foreground"
          data-testid="back-button"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          {t('Back', 'رجوع')}
        </Button>
        <h1 className="text-xl font-bold text-primary">RIWA POS</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLanguage}
          className="text-muted-foreground"
          data-testid="admin-language-toggle"
        >
          <Globe className="w-4 h-4 mr-2" />
          {language === 'en' ? 'العربية' : 'English'}
        </Button>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {t('Admin Login', 'تسجيل دخول المدير')}
            </CardTitle>
            <p className="text-muted-foreground">
              {t('Sign in to access the admin panel', 'سجل الدخول للوصول إلى لوحة الإدارة')}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="email">{t('Email', 'البريد الإلكتروني')}</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('admin@example.com', 'admin@example.com')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 pl-10 bg-secondary"
                    data-testid="admin-email-input"
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="password">{t('Password', 'كلمة المرور')}</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pl-10 bg-secondary"
                    data-testid="admin-password-input"
                    required
                  />
                </div>
              </div>
              
              <Button
                type="submit"
                className="w-full h-12 text-lg btn-primary"
                disabled={loading}
                data-testid="admin-login-button"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t('Sign In', 'تسجيل الدخول')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminLogin;
