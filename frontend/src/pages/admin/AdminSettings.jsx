import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import AdminLayout from './AdminLayout';
import { toast } from 'sonner';
import { Save, Loader2, Key, Eye, EyeOff, TestTube, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Switch } from '../../components/ui/switch';

const AdminSettings = () => {
  const navigate = useNavigate();
  const { apiUrl, token, isAuthenticated } = useApp();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState({});
  const [showSecrets, setShowSecrets] = useState({});

  const [settings, setSettings] = useState({
    tax_rate: 5,
    service_charge_rate: 0,
    currency: 'KWD',
    currency_symbol: 'د.ك',
    decimal_places: 3,
    receipt_header: 'Al-Katem & Al-Bukhari Palace\nقصر الكاظم والبخاري',
    receipt_footer: 'Thank you for your visit!\nشكراً لزيارتكم!',
    buzzer_duration: 15,
    auto_accept_orders: false,
  });

  const [apiKeys, setApiKeys] = useState({
    myfatoorah: { api_key: '', is_test: true },
    upay: { api_key: '', api_secret: '', is_test: true },
    armada: { api_key: '', is_test: true },
    wiyak: { api_key: '', is_test: true },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
      return;
    }
    loadSettings();
  }, [isAuthenticated]);

  const loadSettings = async () => {
    try {
      const response = await fetch(`${apiUrl}/admin/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.settings) {
        setSettings(prev => ({ ...prev, ...data.settings }));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${apiUrl}/admin/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error('Failed to save settings');

      toast.success(t('Settings saved', 'تم حفظ الإعدادات'));
    } catch (error) {
      toast.error(t('Failed to save settings', 'فشل حفظ الإعدادات'));
    } finally {
      setSaving(false);
    }
  };

  const saveApiKey = async (provider) => {
    const keyData = apiKeys[provider];
    if (!keyData.api_key) {
      toast.error(t('API key is required', 'مفتاح API مطلوب'));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${apiUrl}/admin/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider,
          api_key: keyData.api_key,
          api_secret: keyData.api_secret,
          is_test: keyData.is_test,
        }),
      });

      if (!response.ok) throw new Error('Failed to save API key');

      toast.success(t('API key saved', 'تم حفظ مفتاح API'));
    } catch (error) {
      toast.error(t('Failed to save API key', 'فشل حفظ مفتاح API'));
    } finally {
      setSaving(false);
    }
  };

  const testApiKey = async (provider) => {
    const keyData = apiKeys[provider];
    if (!keyData.api_key) {
      toast.error(t('Enter API key first', 'أدخل مفتاح API أولاً'));
      return;
    }

    setTesting({ ...testing, [provider]: true });
    try {
      const response = await fetch(`${apiUrl}/admin/api-keys/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider,
          api_key: keyData.api_key,
          api_secret: keyData.api_secret,
          is_test: keyData.is_test,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(t('API key format is valid', 'تنسيق مفتاح API صالح'));
      } else {
        toast.error(data.message || t('Invalid API key format', 'تنسيق مفتاح API غير صالح'));
      }
    } catch (error) {
      toast.error(t('Test failed', 'فشل الاختبار'));
    } finally {
      setTesting({ ...testing, [provider]: false });
    }
  };

  const toggleShowSecret = (provider) => {
    setShowSecrets({ ...showSecrets, [provider]: !showSecrets[provider] });
  };

  const paymentProviders = [
    {
      id: 'myfatoorah',
      name: 'MyFatoorah',
      description: t('Kuwait payment gateway', 'بوابة الدفع الكويتية'),
      hasSecret: false,
    },
    {
      id: 'upay',
      name: 'UPay',
      description: t('Mobile payment solution', 'حل الدفع بالجوال'),
      hasSecret: true,
    },
    {
      id: 'armada',
      name: 'Armada',
      description: t('Delivery aggregator', 'مجمع التوصيل'),
      hasSecret: false,
    },
    {
      id: 'wiyak',
      name: 'Wiyak',
      description: t('Delivery aggregator', 'مجمع التوصيل'),
      hasSecret: false,
    },
  ];

  if (loading) {
    return (
      <AdminLayout title={t('Settings', 'الإعدادات')}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={t('Settings', 'الإعدادات')}>
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="general">{t('General', 'عام')}</TabsTrigger>
          <TabsTrigger value="receipt">{t('Receipt', 'الإيصال')}</TabsTrigger>
          <TabsTrigger value="api-keys">{t('API Keys', 'مفاتيح API')}</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card className="bg-card border-border/50 max-w-2xl">
            <CardHeader>
              <CardTitle>{t('General Settings', 'الإعدادات العامة')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('Tax Rate (%)', 'نسبة الضريبة (%)')}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={settings.tax_rate}
                    onChange={(e) => setSettings({ ...settings, tax_rate: parseFloat(e.target.value) || 0 })}
                    className="mt-1 bg-secondary ltr-nums"
                    data-testid="tax-rate"
                  />
                </div>
                
                <div>
                  <Label>{t('Service Charge (%)', 'رسوم الخدمة (%)')}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={settings.service_charge_rate}
                    onChange={(e) => setSettings({ ...settings, service_charge_rate: parseFloat(e.target.value) || 0 })}
                    className="mt-1 bg-secondary ltr-nums"
                    data-testid="service-charge"
                  />
                </div>
                
                <div>
                  <Label>{t('Currency', 'العملة')}</Label>
                  <Input
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    className="mt-1 bg-secondary"
                  />
                </div>
                
                <div>
                  <Label>{t('Decimal Places', 'المنازل العشرية')}</Label>
                  <Input
                    type="number"
                    value={settings.decimal_places}
                    onChange={(e) => setSettings({ ...settings, decimal_places: parseInt(e.target.value) || 3 })}
                    className="mt-1 bg-secondary ltr-nums"
                  />
                </div>
              </div>

              <div>
                <Label>{t('Buzzer Duration (seconds)', 'مدة المنبه (ثواني)')}</Label>
                <Input
                  type="number"
                  value={settings.buzzer_duration}
                  onChange={(e) => setSettings({ ...settings, buzzer_duration: parseInt(e.target.value) || 15 })}
                  className="mt-1 bg-secondary ltr-nums w-32"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.auto_accept_orders}
                  onCheckedChange={(v) => setSettings({ ...settings, auto_accept_orders: v })}
                />
                <Label>{t('Auto-accept new orders', 'القبول التلقائي للطلبات الجديدة')}</Label>
              </div>

              <Button onClick={saveSettings} disabled={saving} className="bg-primary" data-testid="save-general">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {t('Save Settings', 'حفظ الإعدادات')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receipt Settings */}
        <TabsContent value="receipt" className="space-y-6">
          <Card className="bg-card border-border/50 max-w-2xl">
            <CardHeader>
              <CardTitle>{t('Receipt Settings', 'إعدادات الإيصال')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('Receipt Header', 'رأس الإيصال')}</Label>
                <textarea
                  value={settings.receipt_header}
                  onChange={(e) => setSettings({ ...settings, receipt_header: e.target.value })}
                  className="mt-1 w-full bg-secondary rounded-lg p-3 text-sm min-h-[100px] border-0 focus:ring-1 focus:ring-primary"
                  placeholder="Al-Katem & Al-Bukhari Palace"
                  data-testid="receipt-header"
                />
              </div>
              
              <div>
                <Label>{t('Receipt Footer', 'تذييل الإيصال')}</Label>
                <textarea
                  value={settings.receipt_footer}
                  onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
                  className="mt-1 w-full bg-secondary rounded-lg p-3 text-sm min-h-[100px] border-0 focus:ring-1 focus:ring-primary"
                  placeholder="Thank you!"
                  data-testid="receipt-footer"
                />
              </div>

              <Button onClick={saveSettings} disabled={saving} className="bg-primary">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {t('Save Settings', 'حفظ الإعدادات')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api-keys" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {paymentProviders.map((provider) => (
              <Card key={provider.id} className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-primary" />
                    {provider.name}
                  </CardTitle>
                  <CardDescription>{provider.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>{t('API Key', 'مفتاح API')}</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type={showSecrets[provider.id] ? 'text' : 'password'}
                        value={apiKeys[provider.id]?.api_key || ''}
                        onChange={(e) => setApiKeys({
                          ...apiKeys,
                          [provider.id]: { ...apiKeys[provider.id], api_key: e.target.value }
                        })}
                        className="bg-secondary font-mono"
                        placeholder="Enter API key..."
                        data-testid={`${provider.id}-key`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleShowSecret(provider.id)}
                      >
                        {showSecrets[provider.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  {provider.hasSecret && (
                    <div>
                      <Label>{t('API Secret', 'سر API')}</Label>
                      <Input
                        type={showSecrets[`${provider.id}_secret`] ? 'text' : 'password'}
                        value={apiKeys[provider.id]?.api_secret || ''}
                        onChange={(e) => setApiKeys({
                          ...apiKeys,
                          [provider.id]: { ...apiKeys[provider.id], api_secret: e.target.value }
                        })}
                        className="mt-1 bg-secondary font-mono"
                        placeholder="Enter API secret..."
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={apiKeys[provider.id]?.is_test}
                      onCheckedChange={(v) => setApiKeys({
                        ...apiKeys,
                        [provider.id]: { ...apiKeys[provider.id], is_test: v }
                      })}
                    />
                    <Label>{t('Test Mode', 'وضع الاختبار')}</Label>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => testApiKey(provider.id)}
                      disabled={testing[provider.id]}
                      className="flex-1"
                    >
                      {testing[provider.id] ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4 mr-2" />
                      )}
                      {t('Test', 'اختبار')}
                    </Button>
                    <Button
                      onClick={() => saveApiKey(provider.id)}
                      disabled={saving}
                      className="flex-1 bg-primary"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {t('Save', 'حفظ')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-card border-border/50 max-w-2xl">
            <CardContent className="p-6">
              <h4 className="font-medium mb-3">{t('Security Note', 'ملاحظة أمنية')}</h4>
              <p className="text-sm text-muted-foreground">
                {t(
                  'API keys are stored securely. The TEST button only validates the key format, it does not make actual API calls. Enable Test Mode for development.',
                  'يتم تخزين مفاتيح API بشكل آمن. زر الاختبار يتحقق فقط من تنسيق المفتاح، ولا يقوم بإجراء اتصالات فعلية. قم بتفعيل وضع الاختبار للتطوير.'
                )}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default AdminSettings;
