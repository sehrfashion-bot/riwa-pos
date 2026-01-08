import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import { toast } from 'sonner';
import { ArrowLeft, Globe, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

const POSLogin = () => {
  const navigate = useNavigate();
  const { login, apiUrl } = useApp();
  const { t, toggleLanguage, language } = useLanguage();
  
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePinInput = (digit) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      
      // Auto-submit when 4 digits entered
      if (newPin.length === 4) {
        handlePinLogin(newPin);
      }
    }
  };

  const handlePinClear = () => {
    setPin('');
  };

  const handlePinBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handlePinLogin = async (pinCode) => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/auth/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinCode }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        login(data.user, data.token);
        toast.success(t('Welcome!', 'مرحباً!'));
        navigate('/pos/terminal');
      } else {
        toast.error(t('Invalid PIN', 'رمز PIN غير صالح'));
        setPin('');
      }
    } catch (error) {
      toast.error(t('Login failed', 'فشل تسجيل الدخول'));
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
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
        navigate('/pos/terminal');
      } else {
        toast.error(t('Invalid credentials', 'بيانات اعتماد غير صالحة'));
      }
    } catch (error) {
      toast.error(t('Login failed', 'فشل تسجيل الدخول'));
    } finally {
      setLoading(false);
    }
  };

  const pinPad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['C', '0', '⌫'],
  ];

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
          data-testid="pos-language-toggle"
        >
          <Globe className="w-4 h-4 mr-2" />
          {language === 'en' ? 'العربية' : 'English'}
        </Button>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">
              {t('POS Login', 'تسجيل دخول نقطة البيع')}
            </h2>
            <p className="text-muted-foreground">
              {t('Enter your PIN or email', 'أدخل رمز PIN أو البريد الإلكتروني')}
            </p>
          </div>

          <Tabs defaultValue="pin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
              <TabsTrigger value="pin" data-testid="pin-tab">
                {t('PIN', 'رمز PIN')}
              </TabsTrigger>
              <TabsTrigger value="email" data-testid="email-tab">
                {t('Email', 'البريد الإلكتروني')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pin" className="mt-6">
              {/* PIN Display */}
              <div className="flex justify-center gap-3 mb-8" data-testid="pin-display">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-colors ${
                      pin.length > i
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card'
                    }`}
                  >
                    {pin.length > i ? '•' : ''}
                  </div>
                ))}
              </div>

              {/* PIN Pad */}
              <div className="grid grid-cols-3 gap-3" data-testid="pin-pad">
                {pinPad.flat().map((key) => (
                  <Button
                    key={key}
                    variant={key === 'C' ? 'destructive' : 'secondary'}
                    className="h-16 text-2xl font-bold"
                    onClick={() => {
                      if (key === 'C') handlePinClear();
                      else if (key === '⌫') handlePinBackspace();
                      else handlePinInput(key);
                    }}
                    disabled={loading}
                    data-testid={`pin-key-${key === '⌫' ? 'backspace' : key === 'C' ? 'clear' : key}`}
                  >
                    {loading && key === '0' ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      key
                    )}
                  </Button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="email" className="mt-6">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <Input
                    type="email"
                    placeholder={t('Email', 'البريد الإلكتروني')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 text-lg bg-card"
                    data-testid="email-input"
                    required
                  />
                </div>
                <div>
                  <Input
                    type="password"
                    placeholder={t('Password', 'كلمة المرور')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 text-lg bg-card"
                    data-testid="password-input"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-14 text-lg btn-primary"
                  disabled={loading}
                  data-testid="email-login-button"
                >
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    t('Login', 'تسجيل الدخول')
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default POSLogin;
