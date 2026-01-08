import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import AdminLayout from './AdminLayout';
import { toast } from 'sonner';
import { Save, Plus, Trash2, Loader2, Heart, Gift } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

const AdminLoyalty = () => {
  const navigate = useNavigate();
  const { apiUrl, token, isAuthenticated } = useApp();
  const { t } = useLanguage();

  const [settings, setSettings] = useState({
    is_enabled: false,
    points_per_kwd: 10,
    points_redemption_rate: 100, // points per 1 KWD
    min_points_redeem: 100,
    max_discount_percentage: 50,
  });
  
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
      return;
    }
    loadData();
  }, [isAuthenticated]);

  const loadData = async () => {
    try {
      const [settingsRes, rulesRes] = await Promise.all([
        fetch(`${apiUrl}/admin/loyalty-settings`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/admin/loyalty-rules`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      
      const settingsData = await settingsRes.json();
      const rulesData = await rulesRes.json();
      
      if (settingsData.settings) {
        setSettings(settingsData.settings);
      }
      setRules(rulesData.rules || []);
    } catch (error) {
      console.error('Failed to load loyalty data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${apiUrl}/admin/loyalty-settings`, {
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

  const addRule = () => {
    const newRule = {
      id: `temp-${Date.now()}`,
      name: '',
      trigger_type: 'order_count',
      trigger_value: 5,
      reward_type: 'points',
      reward_value: 100,
      is_active: true,
    };
    setRules([...rules, newRule]);
  };

  const updateRule = (index, field, value) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], [field]: value };
    setRules(updated);
  };

  const saveRule = async (rule) => {
    try {
      const isNew = rule.id.startsWith('temp-');
      const { id, ...ruleData } = rule;
      
      const response = await fetch(`${apiUrl}/admin/loyalty-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(ruleData),
      });

      if (!response.ok) throw new Error('Failed to save rule');

      toast.success(t('Rule saved', 'تم حفظ القاعدة'));
      loadData();
    } catch (error) {
      toast.error(t('Failed to save rule', 'فشل حفظ القاعدة'));
    }
  };

  const deleteRule = (index) => {
    const updated = rules.filter((_, i) => i !== index);
    setRules(updated);
    toast.success(t('Rule removed', 'تم إزالة القاعدة'));
  };

  if (loading) {
    return (
      <AdminLayout title={t('Loyalty Program', 'برنامج الولاء')}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={t('Loyalty Program', 'برنامج الولاء')}>
      <div className="space-y-6 max-w-4xl">
        {/* Settings */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              {t('Loyalty Settings', 'إعدادات الولاء')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">{t('Enable Loyalty Program', 'تفعيل برنامج الولاء')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('Customers earn points on purchases', 'يكسب العملاء نقاطاً على المشتريات')}
                </p>
              </div>
              <Switch
                checked={settings.is_enabled}
                onCheckedChange={(v) => setSettings({ ...settings, is_enabled: v })}
                data-testid="loyalty-enabled"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('Points per 1 KWD spent', 'النقاط لكل 1 د.ك')}</Label>
                <Input
                  type="number"
                  value={settings.points_per_kwd}
                  onChange={(e) => setSettings({ ...settings, points_per_kwd: parseInt(e.target.value) || 0 })}
                  className="mt-1 bg-secondary ltr-nums"
                  data-testid="points-per-kwd"
                />
              </div>
              
              <div>
                <Label>{t('Points to redeem 1 KWD', 'النقاط لاسترداد 1 د.ك')}</Label>
                <Input
                  type="number"
                  value={settings.points_redemption_rate}
                  onChange={(e) => setSettings({ ...settings, points_redemption_rate: parseInt(e.target.value) || 0 })}
                  className="mt-1 bg-secondary ltr-nums"
                  data-testid="redemption-rate"
                />
              </div>
              
              <div>
                <Label>{t('Min points to redeem', 'الحد الأدنى للاسترداد')}</Label>
                <Input
                  type="number"
                  value={settings.min_points_redeem}
                  onChange={(e) => setSettings({ ...settings, min_points_redeem: parseInt(e.target.value) || 0 })}
                  className="mt-1 bg-secondary ltr-nums"
                  data-testid="min-redeem"
                />
              </div>
              
              <div>
                <Label>{t('Max discount % per order', 'الحد الأقصى للخصم %')}</Label>
                <Input
                  type="number"
                  value={settings.max_discount_percentage}
                  onChange={(e) => setSettings({ ...settings, max_discount_percentage: parseInt(e.target.value) || 0 })}
                  className="mt-1 bg-secondary ltr-nums"
                  data-testid="max-discount"
                />
              </div>
            </div>

            <Button onClick={saveSettings} disabled={saving} className="bg-primary" data-testid="save-settings">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {t('Save Settings', 'حفظ الإعدادات')}
            </Button>
          </CardContent>
        </Card>

        {/* Bonus Rules */}
        <Card className="bg-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              {t('Bonus Rules', 'قواعد المكافآت')}
            </CardTitle>
            <Button onClick={addRule} variant="outline" size="sm" data-testid="add-rule">
              <Plus className="w-4 h-4 mr-2" />
              {t('Add Rule', 'إضافة قاعدة')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {rules.map((rule, index) => (
              <div key={rule.id} className="p-4 bg-secondary/30 rounded-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>{t('Rule Name', 'اسم القاعدة')}</Label>
                    <Input
                      value={rule.name}
                      onChange={(e) => updateRule(index, 'name', e.target.value)}
                      className="mt-1 bg-secondary"
                      placeholder={t('e.g. 5th Order Bonus', 'مثال: مكافأة الطلب الخامس')}
                    />
                  </div>
                  
                  <div>
                    <Label>{t('Trigger', 'المحفز')}</Label>
                    <Select
                      value={rule.trigger_type}
                      onValueChange={(v) => updateRule(index, 'trigger_type', v)}
                    >
                      <SelectTrigger className="mt-1 bg-secondary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="order_count">{t('Order Count', 'عدد الطلبات')}</SelectItem>
                        <SelectItem value="spend_amount">{t('Total Spent', 'إجمالي الإنفاق')}</SelectItem>
                        <SelectItem value="birthday">{t('Birthday', 'عيد الميلاد')}</SelectItem>
                        <SelectItem value="signup">{t('Sign Up', 'التسجيل')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>{t('Trigger Value', 'قيمة المحفز')}</Label>
                    <Input
                      type="number"
                      value={rule.trigger_value}
                      onChange={(e) => updateRule(index, 'trigger_value', parseInt(e.target.value) || 0)}
                      className="mt-1 bg-secondary ltr-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>{t('Reward Type', 'نوع المكافأة')}</Label>
                    <Select
                      value={rule.reward_type}
                      onValueChange={(v) => updateRule(index, 'reward_type', v)}
                    >
                      <SelectTrigger className="mt-1 bg-secondary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="points">{t('Bonus Points', 'نقاط إضافية')}</SelectItem>
                        <SelectItem value="discount">{t('Discount %', 'خصم %')}</SelectItem>
                        <SelectItem value="free_item">{t('Free Item', 'صنف مجاني')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>{t('Reward Value', 'قيمة المكافأة')}</Label>
                    <Input
                      type="number"
                      value={rule.reward_value}
                      onChange={(e) => updateRule(index, 'reward_value', parseInt(e.target.value) || 0)}
                      className="mt-1 bg-secondary ltr-nums"
                    />
                  </div>
                  
                  <div className="flex items-end gap-2">
                    <Button
                      onClick={() => saveRule(rule)}
                      className="bg-primary flex-1"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      {t('Save', 'حفظ')}
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => deleteRule(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {rules.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {t('No bonus rules configured', 'لم يتم تكوين قواعد المكافآت')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminLoyalty;
