import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import AdminLayout from './AdminLayout';
import { toast } from 'sonner';
import { Loader2, Download, Calendar, FileText, TrendingUp, DollarSign, ShoppingBag } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';

const AdminReports = () => {
  const navigate = useNavigate();
  const { apiUrl, token, isAuthenticated } = useApp();
  const { t, language } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [ordersReport, setOrdersReport] = useState({ orders: [], summary: {} });
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
      return;
    }
    loadReports();
  }, [isAuthenticated, startDate, endDate]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const [ordersRes, logsRes] = await Promise.all([
        fetch(`${apiUrl}/admin/reports/orders?start_date=${startDate}&end_date=${endDate}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${apiUrl}/admin/audit-logs?limit=100`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
      ]);
      
      const ordersData = await ordersRes.json();
      const logsData = await logsRes.json();
      
      setOrdersReport(ordersData);
      setAuditLogs(logsData.logs || []);
    } catch (error) {
      console.error('Failed to load reports:', error);
      toast.error(t('Failed to load reports', 'فشل تحميل التقارير'));
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const orders = ordersReport.orders || [];
    if (orders.length === 0) {
      toast.error(t('No data to export', 'لا توجد بيانات للتصدير'));
      return;
    }

    const headers = ['Order #', 'Date', 'Type', 'Status', 'Payment', 'Total (KWD)'];
    const rows = orders.map(o => [
      o.order_number,
      new Date(o.created_at).toLocaleString(),
      o.order_type,
      o.status,
      o.payment_method,
      o.total?.toFixed(3)
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success(t('Report exported', 'تم تصدير التقرير'));
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'status-pending',
      accepted: 'status-accepted',
      preparing: 'status-preparing',
      ready: 'status-ready',
      completed: 'status-completed',
      cancelled: 'bg-red-500/20 text-red-400',
    };
    return <Badge className={styles[status] || styles.pending}>{status}</Badge>;
  };

  if (loading) {
    return (
      <AdminLayout title={t('Reports', 'التقارير')}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const summary = ordersReport.summary || {};

  return (
    <AdminLayout title={t('Reports', 'التقارير')}>
      <Tabs defaultValue="orders" className="space-y-6">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="orders">{t('Orders Report', 'تقرير الطلبات')}</TabsTrigger>
          <TabsTrigger value="audit">{t('Audit Logs', 'سجلات التدقيق')}</TabsTrigger>
        </TabsList>

        {/* Orders Report */}
        <TabsContent value="orders" className="space-y-6">
          {/* Date Filters */}
          <Card className="bg-card border-border/50">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <Label>{t('Start Date', 'تاريخ البداية')}</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 bg-secondary"
                  />
                </div>
                <div>
                  <Label>{t('End Date', 'تاريخ النهاية')}</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 bg-secondary"
                  />
                </div>
                <Button onClick={loadReports} variant="outline">
                  <Calendar className="w-4 h-4 mr-2" />
                  {t('Apply', 'تطبيق')}
                </Button>
                <Button onClick={exportCSV} className="bg-primary">
                  <Download className="w-4 h-4 mr-2" />
                  {t('Export CSV', 'تصدير CSV')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-card border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('Total Orders', 'إجمالي الطلبات')}</p>
                    <p className="text-3xl font-bold ltr-nums">{summary.total_orders || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('Total Sales', 'إجمالي المبيعات')}</p>
                    <p className="text-3xl font-bold ltr-nums">{(summary.total_sales || 0).toFixed(3)} KWD</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('Avg. Order Value', 'متوسط قيمة الطلب')}</p>
                    <p className="text-3xl font-bold ltr-nums">{(summary.average_order || 0).toFixed(3)} KWD</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Orders Table */}
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle>{t('Order Details', 'تفاصيل الطلبات')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Order #', 'رقم الطلب')}</TableHead>
                      <TableHead>{t('Date', 'التاريخ')}</TableHead>
                      <TableHead>{t('Type', 'النوع')}</TableHead>
                      <TableHead>{t('Status', 'الحالة')}</TableHead>
                      <TableHead>{t('Payment', 'الدفع')}</TableHead>
                      <TableHead className="text-right">{t('Total', 'الإجمالي')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ordersReport.orders || []).map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell className="ltr-nums">{new Date(order.created_at).toLocaleString()}</TableCell>
                        <TableCell>{order.order_type}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>{order.payment_method}</TableCell>
                        <TableCell className="text-right font-bold ltr-nums">{order.total?.toFixed(3)}</TableCell>
                      </TableRow>
                    ))}
                    {(ordersReport.orders || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {t('No orders in selected period', 'لا توجد طلبات في الفترة المحددة')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs */}
        <TabsContent value="audit" className="space-y-6">
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {t('System Audit Logs', 'سجلات تدقيق النظام')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {auditLogs.length > 0 ? (
                  <div className="space-y-3">
                    {auditLogs.map((log, idx) => (
                      <div key={idx} className="p-4 bg-secondary/30 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{log.action}</p>
                            <p className="text-sm text-muted-foreground">{log.details}</p>
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            <p className="ltr-nums">{new Date(log.created_at).toLocaleString()}</p>
                            <p>{log.user_name || log.user_id}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>{t('No audit logs yet', 'لا توجد سجلات تدقيق بعد')}</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default AdminReports;
