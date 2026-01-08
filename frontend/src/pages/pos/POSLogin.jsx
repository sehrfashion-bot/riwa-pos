import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import { toast } from 'sonner';
import { ArrowLeft, Globe, Loader2, User } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

const POSLogin = () => {
  const navigate = useNavigate();
  const { login, apiUrl } = useApp();
  const { t, toggleLanguage, language } = useLanguage();
  
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePinInput = (digit) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
    }
  };

  const handlePinClear = () => {
    setPin('');
  };

  const handlePinBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handlePinLogin = async (e) => {
    e?.preventDefault();
    
    if (!username.trim()) {
      toast.error(t('Please enter your username', 'يرجى إدخال اسم المستخدم'));
      return;
    }
    
    if (pin.length < 4) {
      toast.error(t('PIN must be at least 4 digits', 'يجب أن يكون PIN 4 أرقام على الأقل'));
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/auth/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), pin }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        login(data.user, data.token);
        toast.success(t(`Welcome, ${data.user.name}!`, `مرحباً، ${data.user.name}!`));
        navigate('/pos/terminal');
      } else {
        toast.error(t('Invalid username or PIN', 'اسم المستخدم أو PIN غير صالح'));
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
              {t('Enter your credentials to access POS', 'أدخل بياناتك للوصول لنقطة البيع')}
            </p>
          </div>

          <Tabs defaultValue="pin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
              <TabsTrigger value="pin" data-testid="pin-tab">
                {t('Username & PIN', 'المستخدم و PIN')}
              </TabsTrigger>
              <TabsTrigger value="email" data-testid="email-tab">
                {t('Email', 'البريد الإلكتروني')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pin" className="mt-6">
              <form onSubmit={handlePinLogin}>
                {/* Username Input */}
                <div className="mb-4">
                  <Label htmlFor="username">{t('Username', 'اسم المستخدم')}</Label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="username"
                      type="text"
                      placeholder={t('Enter username or name', 'أدخل اسم المستخدم')}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="h-12 pl-10 bg-card text-lg"
                      data-testid="username-input"
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* PIN Display */}
                <div className="mb-4">
                  <Label>{t('PIN Code', 'رمز PIN')}</Label>
                  <div className="flex justify-center gap-3 mt-2" data-testid="pin-display">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-colors ${
                          pin.length > i
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card'
                        }`}
                      >
                        {pin.length > i ? '•' : ''}
                      </div>
                    ))}
                  </div>
                </div>

                {/* PIN Pad */}
                <div className="grid grid-cols-3 gap-2" data-testid="pin-pad">
                  {pinPad.flat().map((key) => (
                    <Button
                      key={key}
                      type="button"
                      variant={key === 'C' ? 'destructive' : 'secondary'}
                      className="h-14 text-xl font-bold"
                      onClick={() => {
                        if (key === 'C') handlePinClear();
                        else if (key === '⌫') handlePinBackspace();
                        else handlePinInput(key);
                      }}
                      disabled={loading}
                      data-testid={`pin-key-${key === '⌫' ? 'backspace' : key === 'C' ? 'clear' : key}`}
                    >
                      {key}
                    </Button>
                  ))}
                </div>

                {/* Login Button */}
                <Button
                  type="submit"
                  className="w-full h-14 text-lg btn-primary mt-4"
                  disabled={loading || !username.trim() || pin.length < 4}
                  data-testid="pin-login-button"
                >
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    t('Login', 'تسجيل الدخول')
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="email" className="mt-6">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <Label htmlFor="email">{t('Email', 'البريد الإلكتروني')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('Enter email', 'أدخل البريد الإلكتروني')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 text-lg bg-card mt-1"
                    data-testid="email-input"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">{t('Password', 'كلمة المرور')}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t('Enter password', 'أدخل كلمة المرور')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 text-lg bg-card mt-1"
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

          {/* Hint */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            {t('Use your staff name and PIN to login', 'استخدم اسم الموظف ورمز PIN لتسجيل الدخول')}
          </p>
        </div>
      </main>
    </div>
  );
};

export default POSLogin;
