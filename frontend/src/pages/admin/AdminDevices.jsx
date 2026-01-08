import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import AdminLayout from './AdminLayout';
import { toast } from 'sonner';
import { Save, Plus, Trash2, Loader2, Printer, TestTube } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

const AdminDevices = () => {
  const navigate = useNavigate();
  const { apiUrl, token, isAuthenticated } = useApp();
  const { t } = useLanguage();

  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newPrinter, setNewPrinter] = useState({
    name: '',
    printer_ip: '',
    printer_port: 9100,
    paper_width: 80,
    is_default: false,
    print_kitchen: false,
    print_receipt: true,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
      return;
    }
    loadPrinters();
  }, [isAuthenticated]);

  const loadPrinters = async () => {
    try {
      const response = await fetch(`${apiUrl}/admin/printers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setPrinters(data.printers || []);
    } catch (error) {
      console.error('Failed to load printers:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePrinter = async () => {
    if (!newPrinter.printer_ip) {
      toast.error(t('Printer IP is required', 'عنوان IP للطابعة مطلوب'));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${apiUrl}/admin/printers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newPrinter),
      });

      if (!response.ok) throw new Error('Failed to save printer');

      toast.success(t('Printer saved', 'تم حفظ الطابعة'));
      loadPrinters();
      setNewPrinter({
        name: '',
        printer_ip: '',
        printer_port: 9100,
        paper_width: 80,
        is_default: false,
        print_kitchen: false,
        print_receipt: true,
      });
    } catch (error) {
      toast.error(t('Failed to save printer', 'فشل حفظ الطابعة'));
    } finally {
      setSaving(false);
    }
  };

  const deletePrinter = async (printerId) => {
    if (!confirm(t('Delete this printer?', 'حذف هذه الطابعة؟'))) return;

    try {
      await fetch(`${apiUrl}/admin/printers/${printerId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      toast.success(t('Printer deleted', 'تم حذف الطابعة'));
      loadPrinters();
    } catch (error) {
      toast.error(t('Failed to delete printer', 'فشل حذف الطابعة'));
    }
  };

  const testPrinter = async (printer) => {
    toast.info(t('Testing printer...', 'جاري اختبار الطابعة...'));
    
    // ESC/POS test command
    const testCommands = [
      '\x1B\x40',           // Initialize
      '\x1B\x61\x01',       // Center align
      'RIWA POS\n',
      'Printer Test\n',
      `${new Date().toLocaleString()}\n`,
      '\n\n\n',
      '\x1D\x56\x00',       // Cut paper
    ];

    try {
      // Attempt WebSocket connection to printer
      const ws = new WebSocket(`ws://${printer.printer_ip}:${printer.printer_port}`);
      
      ws.onerror = () => {
        toast.warning(t('Direct connection not available. Try using raw socket proxy.', 'الاتصال المباشر غير متاح.'));
      };
      
      ws.onopen = () => {
        const data = new TextEncoder().encode(testCommands.join(''));
        ws.send(data);
        ws.close();
        toast.success(t('Test print sent!', 'تم إرسال الاختبار!'));
      };

      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          // Show print preview fallback
          const printWindow = window.open('', '_blank', 'width=300,height=200');
          if (printWindow) {
            printWindow.document.write(`
              <html>
                <body style="font-family: monospace; text-align: center; padding: 20px;">
                  <h3>RIWA POS</h3>
                  <p>Printer Test</p>
                  <p>${new Date().toLocaleString()}</p>
                  <p>IP: ${printer.printer_ip}</p>
                </body>
              </html>
            `);
            printWindow.document.close();
            printWindow.print();
          }
        }
      }, 3000);
    } catch (error) {
      toast.error(t('Printer test failed', 'فشل اختبار الطابعة'));
    }
  };

  if (loading) {
    return (
      <AdminLayout title={t('Devices & Printers', 'الأجهزة والطابعات')}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={t('Devices & Printers', 'الأجهزة والطابعات')}>
      <div className="space-y-6 max-w-4xl">
        {/* Existing Printers */}
        {printers.length > 0 && (
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle>{t('Configured Printers', 'الطابعات المضبوطة')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {printers.map((printer) => (
                <div
                  key={printer.id}
                  className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Printer className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">{printer.name || printer.printer_ip}</h4>
                      <p className="text-sm text-muted-foreground">
                        {printer.printer_ip}:{printer.printer_port} • {printer.paper_width}mm
                      </p>
                      <div className="flex gap-2 mt-1">
                        {printer.is_default && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                            {t('Default', 'افتراضي')}
                          </span>
                        )}
                        {printer.print_receipt && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                            {t('Receipt', 'إيصال')}
                          </span>
                        )}
                        {printer.print_kitchen && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                            {t('Kitchen', 'مطبخ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testPrinter(printer)}
                    >
                      <TestTube className="w-4 h-4 mr-1" />
                      {t('Test', 'اختبار')}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deletePrinter(printer.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Add New Printer */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              {t('Add Printer', 'إضافة طابعة')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('Printer Name', 'اسم الطابعة')}</Label>
                <Input
                  value={newPrinter.name}
                  onChange={(e) => setNewPrinter({ ...newPrinter, name: e.target.value })}
                  className="mt-1 bg-secondary"
                  placeholder={t('Kitchen Printer', 'طابعة المطبخ')}
                  data-testid="printer-name"
                />
              </div>
              
              <div>
                <Label>{t('IP Address', 'عنوان IP')}</Label>
                <Input
                  value={newPrinter.printer_ip}
                  onChange={(e) => setNewPrinter({ ...newPrinter, printer_ip: e.target.value })}
                  className="mt-1 bg-secondary"
                  placeholder="192.168.1.100"
                  data-testid="printer-ip"
                />
              </div>
              
              <div>
                <Label>{t('Port', 'المنفذ')}</Label>
                <Input
                  type="number"
                  value={newPrinter.printer_port}
                  onChange={(e) => setNewPrinter({ ...newPrinter, printer_port: parseInt(e.target.value) || 9100 })}
                  className="mt-1 bg-secondary ltr-nums"
                  data-testid="printer-port"
                />
              </div>
              
              <div>
                <Label>{t('Paper Width', 'عرض الورق')}</Label>
                <Select
                  value={newPrinter.paper_width.toString()}
                  onValueChange={(v) => setNewPrinter({ ...newPrinter, paper_width: parseInt(v) })}
                >
                  <SelectTrigger className="mt-1 bg-secondary" data-testid="paper-width">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58">58mm</SelectItem>
                    <SelectItem value="80">80mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={newPrinter.is_default}
                  onCheckedChange={(v) => setNewPrinter({ ...newPrinter, is_default: v })}
                />
                <Label>{t('Default Printer', 'الطابعة الافتراضية')}</Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={newPrinter.print_receipt}
                  onCheckedChange={(v) => setNewPrinter({ ...newPrinter, print_receipt: v })}
                />
                <Label>{t('Print Receipts', 'طباعة الإيصالات')}</Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={newPrinter.print_kitchen}
                  onCheckedChange={(v) => setNewPrinter({ ...newPrinter, print_kitchen: v })}
                />
                <Label>{t('Print Kitchen Tickets', 'طباعة تذاكر المطبخ')}</Label>
              </div>
            </div>

            <Button
              onClick={savePrinter}
              disabled={saving || !newPrinter.printer_ip}
              className="bg-primary"
              data-testid="save-printer"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {t('Save Printer', 'حفظ الطابعة')}
            </Button>
          </CardContent>
        </Card>

        {/* Printer Info */}
        <Card className="bg-card border-border/50">
          <CardContent className="p-6">
            <h4 className="font-medium mb-3">{t('Supported Printers', 'الطابعات المدعومة')}</h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• {t('ESC/POS compatible thermal printers', 'طابعات حرارية متوافقة مع ESC/POS')}</li>
              <li>• {t('Network printers with TCP/IP (Port 9100)', 'طابعات الشبكة TCP/IP (منفذ 9100)')}</li>
              <li>• {t('Common brands: Epson TM series, Star TSP, Bixolon SRP', 'العلامات: Epson TM, Star TSP, Bixolon SRP')}</li>
              <li>• {t('Kuwait restaurant printers (80mm thermal)', 'طابعات المطاعم الكويتية (حرارية 80mm)')}</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDevices;
