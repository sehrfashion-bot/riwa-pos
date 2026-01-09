import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import AdminLayout from './AdminLayout';
import { toast } from 'sonner';
import {
  Printer, Plus, Trash2, Edit2, TestTube, Loader2, 
  Check, X, Settings, Wifi, WifiOff
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';

const AdminPrinters = () => {
  const navigate = useNavigate();
  const { isAuthenticated, apiUrl } = useApp();
  const { t, language } = useLanguage();
  
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState(null);
  const [testing, setTesting] = useState({});
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ip_address: '',
    port: 9100,
    model: 'NT310',
    location: 'cashier',
    default_for_channel: 'pos',
    enabled: true,
    open_drawer_before: false,
    open_drawer_after: true
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
      return;
    }
    loadPrinters();
  }, [isAuthenticated, navigate]);

  const loadPrinters = async () => {
    try {
      const response = await fetch(`${apiUrl}/printers`);
      const data = await response.json();
      setPrinters(data.printers || []);
    } catch (error) {
      console.error('Failed to load printers:', error);
      toast.error('Failed to load printers');
    } finally {
      setLoading(false);
    }
  };

  const openNewPrinterDialog = () => {
    setEditingPrinter(null);
    setFormData({
      name: '',
      description: '',
      ip_address: '',
      port: 9100,
      model: 'NT310',
      location: 'cashier',
      default_for_channel: 'pos',
      enabled: true,
      open_drawer_before: false,
      open_drawer_after: true
    });
    setDialogOpen(true);
  };

  const openEditDialog = (printer) => {
    setEditingPrinter(printer);
    setFormData({
      name: printer.name || '',
      description: printer.description || '',
      ip_address: printer.ip_address || '',
      port: printer.port || 9100,
      model: printer.model || 'NT310',
      location: printer.location || 'cashier',
      default_for_channel: printer.default_for_channel || 'pos',
      enabled: printer.enabled ?? true,
      open_drawer_before: printer.open_drawer_before ?? false,
      open_drawer_after: printer.open_drawer_after ?? true
    });
    setDialogOpen(true);
  };

  const savePrinter = async () => {
    if (!formData.name || !formData.ip_address) {
      toast.error('Name and IP address are required');
      return;
    }

    try {
      const url = editingPrinter 
        ? `${apiUrl}/printers/${editingPrinter.id}`
        : `${apiUrl}/printers`;
      
      const method = editingPrinter ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to save printer');

      toast.success(editingPrinter ? 'Printer updated' : 'Printer added');
      setDialogOpen(false);
      loadPrinters();
    } catch (error) {
      console.error('Save printer error:', error);
      toast.error('Failed to save printer');
    }
  };

  const deletePrinter = async (printerId) => {
    if (!window.confirm('Are you sure you want to delete this printer?')) return;

    try {
      const response = await fetch(`${apiUrl}/printers/${printerId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete printer');

      toast.success('Printer deleted');
      loadPrinters();
    } catch (error) {
      console.error('Delete printer error:', error);
      toast.error('Failed to delete printer');
    }
  };

  const testPrinter = async (printer) => {
    setTesting(prev => ({ ...prev, [printer.id]: true }));

    try {
      const response = await fetch(`${apiUrl}/printers/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip_address: printer.ip_address,
          port: printer.port
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(result.message || 'Test print successful!');
      } else {
        toast.error(result.message || 'Test print failed');
      }
    } catch (error) {
      console.error('Test printer error:', error);
      toast.error('Failed to test printer');
    } finally {
      setTesting(prev => ({ ...prev, [printer.id]: false }));
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{t('Printer Settings', 'إعدادات الطابعة')}</h1>
            <p className="text-muted-foreground">
              {t('Configure network printers for auto-printing receipts', 'تهيئة طابعات الشبكة للطباعة التلقائية')}
            </p>
          </div>
          <Button onClick={openNewPrinterDialog} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            {t('Add Printer', 'إضافة طابعة')}
          </Button>
        </div>

        {/* Info Card */}
        <Card className="mb-6 bg-secondary/20 border-secondary">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Settings className="w-5 h-5 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">{t('Network Printer Setup', 'إعداد طابعة الشبكة')}</p>
                <p className="text-muted-foreground">
                  {t('Add your Sunmi NT310 or ESC/POS compatible printer. The printer will automatically print receipts when orders are placed and open the cash drawer for cash payments.', 
                    'أضف طابعة Sunmi NT310 أو طابعة متوافقة مع ESC/POS. ستقوم الطابعة بطباعة الإيصالات تلقائياً عند إنشاء الطلبات وفتح درج النقود للمدفوعات النقدية.')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Printers List */}
        {printers.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Printer className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">{t('No Printers Configured', 'لا توجد طابعات')}</h3>
              <p className="text-muted-foreground mb-4">
                {t('Add a network printer to enable automatic receipt printing', 'أضف طابعة شبكة لتفعيل الطباعة التلقائية')}
              </p>
              <Button onClick={openNewPrinterDialog}>
                <Plus className="w-4 h-4 mr-2" />
                {t('Add Your First Printer', 'أضف أول طابعة')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {printers.map((printer) => (
              <Card key={printer.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {printer.enabled ? (
                        <Wifi className="w-5 h-5 text-green-500" />
                      ) : (
                        <WifiOff className="w-5 h-5 text-muted-foreground" />
                      )}
                      <CardTitle className="text-base">{printer.name}</CardTitle>
                    </div>
                    <Badge variant={printer.enabled ? 'default' : 'secondary'}>
                      {printer.enabled ? t('Active', 'نشط') : t('Disabled', 'معطل')}
                    </Badge>
                  </div>
                  {printer.description && (
                    <CardDescription>{printer.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('IP Address', 'عنوان IP')}</span>
                      <span className="font-mono">{printer.ip_address}:{printer.port}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('Model', 'الموديل')}</span>
                      <span>{printer.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('Location', 'الموقع')}</span>
                      <span className="capitalize">{printer.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('Channel', 'القناة')}</span>
                      <span className="uppercase">{printer.default_for_channel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('Cash Drawer', 'درج النقود')}</span>
                      <span>
                        {printer.open_drawer_after ? t('After Print', 'بعد الطباعة') : t('Disabled', 'معطل')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => testPrinter(printer)}
                      disabled={testing[printer.id]}
                    >
                      {testing[printer.id] ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4 mr-1" />
                      )}
                      {t('Test', 'اختبار')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(printer)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePrinter(printer.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingPrinter ? t('Edit Printer', 'تعديل الطابعة') : t('Add Printer', 'إضافة طابعة')}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('Printer Name', 'اسم الطابعة')} *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Cashier Printer"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('Description', 'الوصف')}</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Main receipt printer"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>{t('IP Address', 'عنوان IP')} *</Label>
                  <Input
                    value={formData.ip_address}
                    onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                    placeholder="192.168.1.100"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('Port', 'المنفذ')}</Label>
                  <Input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 9100 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('Model', 'الموديل')}</Label>
                  <Select value={formData.model} onValueChange={(v) => setFormData({ ...formData, model: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NT310">Sunmi NT310</SelectItem>
                      <SelectItem value="NT311">Sunmi NT311</SelectItem>
                      <SelectItem value="Generic">Generic ESC/POS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('Location', 'الموقع')}</Label>
                  <Select value={formData.location} onValueChange={(v) => setFormData({ ...formData, location: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cashier">{t('Cashier', 'الكاشير')}</SelectItem>
                      <SelectItem value="kitchen">{t('Kitchen', 'المطبخ')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('Default for Channel', 'القناة الافتراضية')}</Label>
                <Select value={formData.default_for_channel} onValueChange={(v) => setFormData({ ...formData, default_for_channel: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pos">{t('POS (Receipts)', 'نقطة البيع (إيصالات)')}</SelectItem>
                    <SelectItem value="kds">{t('KDS (Kitchen)', 'شاشة المطبخ')}</SelectItem>
                    <SelectItem value="both">{t('Both', 'كلاهما')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <Label>{t('Enabled', 'مفعّل')}</Label>
                  <Switch
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>{t('Open Cash Drawer After Print', 'فتح درج النقود بعد الطباعة')}</Label>
                  <Switch
                    checked={formData.open_drawer_after}
                    onCheckedChange={(checked) => setFormData({ ...formData, open_drawer_after: checked })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button onClick={savePrinter} className="btn-primary">
                {editingPrinter ? t('Update', 'تحديث') : t('Add Printer', 'إضافة')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminPrinters;
