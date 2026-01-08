import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import { toast } from 'sonner';
import { ArrowLeft, Printer, Save, Loader2, Globe, TestTube } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

const POSSettings = () => {
  const navigate = useNavigate();
  const { apiUrl, token } = useApp();
  const { t, language, toggleLanguage } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [newPrinter, setNewPrinter] = useState({
    name: '',
    printer_ip: '',
    printer_port: 9100,
    paper_width: 80,
    is_default: false,
  });

  useEffect(() => {
    loadPrinters();
  }, []);

  const loadPrinters = async () => {
    try {
      const response = await fetch(`${apiUrl}/admin/printers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setPrinters(data.printers || []);
    } catch (error) {
      console.error('Failed to load printers:', error);
    }
  };

  const savePrinter = async () => {
    if (!newPrinter.printer_ip) {
      toast.error(t('Printer IP is required', 'عنوان IP للطابعة مطلوب'));
      return;
    }

    setLoading(true);
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
      });
    } catch (error) {
      toast.error(t('Failed to save printer', 'فشل حفظ الطابعة'));
    } finally {
      setLoading(false);
    }
  };

  const testPrinter = async (printer) => {
    toast.info(t('Testing printer connection...', 'جاري اختبار اتصال الطابعة...'));
    
    // In a real implementation, this would send a test print via WebSocket
    // For now, we'll simulate the test
    try {
      // Create ESC/POS test command
      const testData = [
        0x1B, 0x40, // Initialize printer
        0x1B, 0x61, 0x01, // Center align
        ...Array.from(new TextEncoder().encode('RIWA POS\n')),
        ...Array.from(new TextEncoder().encode('Test Print\n')),
        ...Array.from(new TextEncoder().encode(new Date().toLocaleString() + '\n')),
        0x1D, 0x56, 0x00, // Cut paper
      ];
      
      // Try to connect via raw socket (requires backend proxy in production)
      const ws = new WebSocket(`ws://${printer.printer_ip}:${printer.printer_port}`);
      
      ws.onerror = () => {
        // Fallback: Show preview instead
        toast.warning(t('Direct connection not available. Use Print Preview instead.', 'الاتصال المباشر غير متاح. استخدم معاينة الطباعة.'));
      };
      
      ws.onopen = () => {
        ws.send(new Uint8Array(testData));
        ws.close();
        toast.success(t('Test print sent!', 'تم إرسال طباعة تجريبية!'));
      };
      
      // Close after timeout
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          toast.info(t('Printer test completed', 'اكتمل اختبار الطابعة'));
        }
      }, 3000);
      
    } catch (error) {
      console.error('Printer test error:', error);
      toast.error(t('Printer test failed', 'فشل اختبار الطابعة'));
    }
  };

  const deletePrinter = async (printerId) => {
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-16 border-b border-border/30 flex items-center justify-between px-4 bg-card/50 backdrop-blur">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/pos/terminal')}
            data-testid="back-to-pos"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            {t('Back', 'رجوع')}
          </Button>
          <h1 className="text-xl font-bold">{t('POS Settings', 'إعدادات نقطة البيع')}</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Language Settings */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              {t('Language', 'اللغة')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t('Display Language', 'لغة العرض')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('Switch between English and Arabic', 'التبديل بين الإنجليزية والعربية')}
                </p>
              </div>
              <Button variant="outline" onClick={toggleLanguage} data-testid="toggle-language">
                {language === 'en' ? 'العربية' : 'English'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Printer Configuration */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary" />
              {t('Receipt Printers', 'طابعات الإيصالات')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Existing Printers */}
            {printers.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">{t('Configured Printers', 'الطابعات المضبوطة')}</h4>
                {printers.map((printer) => (
                  <div
                    key={printer.id}
                    className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{printer.name || printer.printer_ip}</p>
                      <p className="text-sm text-muted-foreground">
                        {printer.printer_ip}:{printer.printer_port} • {printer.paper_width}mm
                      </p>
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
                        {t('Delete', 'حذف')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Printer */}
            <div className="space-y-4 pt-4 border-t border-border/30">
              <h4 className="font-medium">{t('Add New Printer', 'إضافة طابعة جديدة')}</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t('Printer Name', 'اسم الطابعة')}</Label>
                  <Input
                    placeholder={t('e.g. Kitchen Printer', 'مثال: طابعة المطبخ')}
                    value={newPrinter.name}
                    onChange={(e) => setNewPrinter({ ...newPrinter, name: e.target.value })}
                    className="mt-1 bg-secondary"
                    data-testid="printer-name"
                  />
                </div>
                
                <div>
                  <Label>{t('IP Address', 'عنوان IP')}</Label>
                  <Input
                    placeholder="192.168.1.100"
                    value={newPrinter.printer_ip}
                    onChange={(e) => setNewPrinter({ ...newPrinter, printer_ip: e.target.value })}
                    className="mt-1 bg-secondary"
                    data-testid="printer-ip"
                  />
                </div>
                
                <div>
                  <Label>{t('Port', 'المنفذ')}</Label>
                  <Input
                    type="number"
                    value={newPrinter.printer_port}
                    onChange={(e) => setNewPrinter({ ...newPrinter, printer_port: parseInt(e.target.value) })}
                    className="mt-1 bg-secondary"
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

              <div className="flex items-center gap-2">
                <Switch
                  checked={newPrinter.is_default}
                  onCheckedChange={(v) => setNewPrinter({ ...newPrinter, is_default: v })}
                  data-testid="printer-default"
                />
                <Label>{t('Set as default printer', 'تعيين كطابعة افتراضية')}</Label>
              </div>

              <Button
                onClick={savePrinter}
                disabled={loading || !newPrinter.printer_ip}
                className="btn-primary"
                data-testid="save-printer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {t('Save Printer', 'حفظ الطابعة')}
              </Button>
            </div>

            {/* Printer Info */}
            <div className="bg-secondary/30 rounded-lg p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-2">{t('Supported Printers', 'الطابعات المدعومة')}</p>
              <ul className="list-disc list-inside space-y-1">
                <li>{t('ESC/POS compatible thermal printers', 'طابعات حرارية متوافقة مع ESC/POS')}</li>
                <li>{t('Network printers with TCP/IP', 'طابعات الشبكة مع TCP/IP')}</li>
                <li>{t('Common brands: Epson, Star, Bixolon', 'العلامات الشائعة: Epson, Star, Bixolon')}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default POSSettings;
