import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import AdminLayout from './AdminLayout';
import { toast } from 'sonner';
import { Plus, Trash2, Copy, Loader2, Ticket } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';

const AdminCoupons = () => {
  const navigate = useNavigate();
  const { apiUrl, token, isAuthenticated } = useApp();
  const { t, language } = useLanguage();

  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  
  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: 0,
    min_order_amount: 0,
    max_uses: 0,
    used_count: 0,
    valid_from: '',
    valid_until: '',
    is_active: true,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
      return;
    }
    loadCoupons();
  }, [isAuthenticated]);

  const loadCoupons = async () => {
    try {
      const response = await fetch(`${apiUrl}/admin/coupons`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setCoupons(data.coupons || []);
    } catch (error) {
      console.error('Failed to load coupons:', error);
      toast.error(t('Failed to load coupons', 'فشل تحميل الكوبونات'));
    } finally {
      setLoading(false);
    }
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'RIWA';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCouponForm({ ...couponForm, code });
  };

  const openModal = () => {
    setCouponForm({
      code: '',
      discount_type: 'percentage',
      discount_value: 0,
      min_order_amount: 0,
      max_uses: 0,
      used_count: 0,
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: '',
      is_active: true,
    });
    setModalOpen(true);
  };

  const saveCoupon = async () => {
    if (!couponForm.code || !couponForm.discount_value) {
      toast.error(t('Code and discount value are required', 'الكود وقيمة الخصم مطلوبان'));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${apiUrl}/admin/coupons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(couponForm),
      });

      if (!response.ok) throw new Error('Failed to save coupon');

      toast.success(t('Coupon created', 'تم إنشاء الكوبون'));
      setModalOpen(false);
      loadCoupons();
    } catch (error) {
      toast.error(t('Failed to create coupon', 'فشل إنشاء الكوبون'));
    } finally {
      setSaving(false);
    }
  };

  const deleteCoupon = async (couponId) => {
    if (!confirm(t('Delete this coupon?', 'حذف هذا الكوبون؟'))) return;

    try {
      await fetch(`${apiUrl}/admin/coupons/${couponId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      toast.success(t('Coupon deleted', 'تم حذف الكوبون'));
      loadCoupons();
    } catch (error) {
      toast.error(t('Failed to delete coupon', 'فشل حذف الكوبون'));
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success(t('Code copied', 'تم نسخ الكود'));
  };

  if (loading) {
    return (
      <AdminLayout title={t('Coupons', 'الكوبونات')}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={t('Coupons', 'الكوبونات')}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">
            {t('Create and manage discount coupons', 'إنشاء وإدارة كوبونات الخصم')}
          </p>
          <Button onClick={openModal} className="bg-primary" data-testid="add-coupon">
            <Plus className="w-4 h-4 mr-2" />
            {t('Add Coupon', 'إضافة كوبون')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map((coupon) => (
            <Card key={coupon.id} className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <code className="text-lg font-bold text-primary">{coupon.code}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyCode(coupon.code)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <Badge className={coupon.is_active ? 'status-ready' : 'status-completed'}>
                    {coupon.is_active ? t('Active', 'نشط') : t('Inactive', 'غير نشط')}
                  </Badge>
                </div>
                
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">{t('Discount', 'الخصم')}:</span>{' '}
                    <span className="font-medium ltr-nums">
                      {coupon.discount_type === 'percentage' 
                        ? `${coupon.discount_value}%`
                        : `${coupon.discount_value} KWD`
                      }
                    </span>
                  </p>
                  {coupon.min_order_amount > 0 && (
                    <p>
                      <span className="text-muted-foreground">{t('Min Order', 'الحد الأدنى')}:</span>{' '}
                      <span className="ltr-nums">{coupon.min_order_amount} KWD</span>
                    </p>
                  )}
                  <p>
                    <span className="text-muted-foreground">{t('Usage', 'الاستخدام')}:</span>{' '}
                    <span className="ltr-nums">
                      {coupon.used_count || 0} / {coupon.max_uses || '∞'}
                    </span>
                  </p>
                  {coupon.valid_until && (
                    <p>
                      <span className="text-muted-foreground">{t('Expires', 'ينتهي')}:</span>{' '}
                      <span className="ltr-nums">{new Date(coupon.valid_until).toLocaleDateString()}</span>
                    </p>
                  )}
                </div>
                
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => deleteCoupon(coupon.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    {t('Delete', 'حذف')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {coupons.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Ticket className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-xl">{t('No coupons yet', 'لا توجد كوبونات بعد')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Coupon Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{t('Create Coupon', 'إنشاء كوبون')}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>{t('Coupon Code', 'كود الكوبون')}</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  className="bg-secondary font-mono"
                  placeholder="RIWA123"
                  data-testid="coupon-code"
                />
                <Button variant="outline" onClick={generateCode}>
                  {t('Generate', 'توليد')}
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('Discount Type', 'نوع الخصم')}</Label>
                <Select
                  value={couponForm.discount_type}
                  onValueChange={(v) => setCouponForm({ ...couponForm, discount_type: v })}
                >
                  <SelectTrigger className="mt-1 bg-secondary" data-testid="discount-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">{t('Percentage', 'نسبة مئوية')}</SelectItem>
                    <SelectItem value="fixed">{t('Fixed Amount', 'مبلغ ثابت')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>
                  {couponForm.discount_type === 'percentage' 
                    ? t('Discount %', 'نسبة الخصم')
                    : t('Discount Amount (KWD)', 'مبلغ الخصم')
                  }
                </Label>
                <Input
                  type="number"
                  step={couponForm.discount_type === 'percentage' ? '1' : '0.001'}
                  value={couponForm.discount_value}
                  onChange={(e) => setCouponForm({ ...couponForm, discount_value: parseFloat(e.target.value) || 0 })}
                  className="mt-1 bg-secondary ltr-nums"
                  data-testid="discount-value"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('Min Order Amount (KWD)', 'الحد الأدنى للطلب')}</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={couponForm.min_order_amount}
                  onChange={(e) => setCouponForm({ ...couponForm, min_order_amount: parseFloat(e.target.value) || 0 })}
                  className="mt-1 bg-secondary ltr-nums"
                  data-testid="min-order"
                />
              </div>
              
              <div>
                <Label>{t('Max Uses (0 = unlimited)', 'الحد الأقصى للاستخدام')}</Label>
                <Input
                  type="number"
                  value={couponForm.max_uses}
                  onChange={(e) => setCouponForm({ ...couponForm, max_uses: parseInt(e.target.value) || 0 })}
                  className="mt-1 bg-secondary ltr-nums"
                  data-testid="max-uses"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('Valid From', 'صالح من')}</Label>
                <Input
                  type="date"
                  value={couponForm.valid_from}
                  onChange={(e) => setCouponForm({ ...couponForm, valid_from: e.target.value })}
                  className="mt-1 bg-secondary"
                />
              </div>
              
              <div>
                <Label>{t('Valid Until', 'صالح حتى')}</Label>
                <Input
                  type="date"
                  value={couponForm.valid_until}
                  onChange={(e) => setCouponForm({ ...couponForm, valid_until: e.target.value })}
                  className="mt-1 bg-secondary"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={couponForm.is_active}
                onCheckedChange={(v) => setCouponForm({ ...couponForm, is_active: v })}
              />
              <Label>{t('Active', 'نشط')}</Label>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setModalOpen(false)}
              >
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button
                className="flex-1 bg-primary"
                onClick={saveCoupon}
                disabled={saving}
                data-testid="save-coupon"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('Create', 'إنشاء')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminCoupons;
