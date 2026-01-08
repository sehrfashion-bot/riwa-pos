import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import AdminLayout from './AdminLayout';
import { toast } from 'sonner';
import {
  Clock, Check, ChefHat, Truck, Package, Volume2, VolumeX,
  Printer, RefreshCw, Eye
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ScrollArea } from '../../components/ui/scroll-area';

const AdminOrders = () => {
  const navigate = useNavigate();
  const { apiUrl, token, isAuthenticated } = useApp();
  const { t, language } = useLanguage();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [buzzerEnabled, setBuzzerEnabled] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(false);

  const buzzerRef = useRef(null);
  const buzzerIntervalRef = useRef(null);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
      return;
    }
    
    // Initialize buzzer
    buzzerRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleWVLldfn3oBSTkWF2/TkjVQ1EniN6f/0nF42F0Juk/TznGQ1FUZukuzlmF46JUxkheLfmWVKN1Bfdtz/+sp8TzMaQZLD4/XUj0snCB6f4///5KFKKgAAzur//+WcRiwAANnw///jpkUuAADk9f//4aRHLwAA8Pn//9+hSzIAAPn8///do0wzAAD+/v//3KRNNQAA////3KRNNQAA');
    
    loadOrders();
    
    // Poll every 7 seconds
    pollIntervalRef.current = setInterval(loadOrders, 7000);
    
    return () => {
      if (buzzerIntervalRef.current) clearInterval(buzzerIntervalRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isAuthenticated]);

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/orders?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      const prevPendingCount = orders.filter(o => o.status === 'pending').length;
      const newPendingCount = (data.orders || []).filter(o => o.status === 'pending').length;
      
      if (newPendingCount > prevPendingCount && buzzerEnabled) {
        playBuzzer();
      }
      
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token, orders.length, buzzerEnabled]);

  const playBuzzer = () => {
    setNewOrderAlert(true);
    if (buzzerRef.current) {
      buzzerRef.current.play().catch(() => {});
      buzzerIntervalRef.current = setInterval(() => {
        buzzerRef.current.play().catch(() => {});
      }, 1000);
      
      setTimeout(stopBuzzer, 15000);
    }
  };

  const stopBuzzer = () => {
    setNewOrderAlert(false);
    if (buzzerIntervalRef.current) {
      clearInterval(buzzerIntervalRef.current);
      buzzerIntervalRef.current = null;
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      const response = await fetch(`${apiUrl}/orders/update-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ order_id: orderId, status }),
      });
      
      if (!response.ok) throw new Error('Failed to update status');
      
      toast.success(t(`Order ${status}`, `الطلب ${status}`));
      stopBuzzer();
      loadOrders();
      
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status });
      }
    } catch (error) {
      toast.error(t('Failed to update order', 'فشل تحديث الطلب'));
    }
  };

  const viewOrderDetails = async (order) => {
    try {
      const response = await fetch(`${apiUrl}/orders/${order.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setSelectedOrder(data);
      setDetailsOpen(true);
    } catch (error) {
      toast.error(t('Failed to load order details', 'فشل تحميل تفاصيل الطلب'));
    }
  };

  const printReceipt = (order) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      const items = order.items || [];
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt</title>
            <style>
              body { font-family: 'Courier New', monospace; font-size: 12px; padding: 10px; width: 80mm; margin: 0 auto; }
              .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
              .header h1 { font-size: 14px; margin: 0; }
              .header p { margin: 2px 0; font-size: 10px; }
              .info { margin: 10px 0; }
              .info-row { display: flex; justify-content: space-between; }
              table { width: 100%; border-collapse: collapse; }
              th, td { text-align: left; padding: 4px 0; }
              th { border-bottom: 1px dashed #000; }
              .total-row { border-top: 1px dashed #000; font-weight: bold; }
              .grand-total { font-size: 14px; border-top: 2px solid #000; margin-top: 5px; padding-top: 5px; }
              .footer { text-align: center; margin-top: 20px; font-size: 10px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Al-Katem & Al-Bukhari Palace</h1>
              <p>قصر الكاظم والبخاري</p>
              <p>${new Date(order.created_at).toLocaleString()}</p>
              <p>Bill No: ${order.order_number}</p>
              <p>Type: ${order.order_type}</p>
              <p>Payment: ${order.payment_method}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align:center">Qty</th>
                  <th style="text-align:right">Price</th>
                  <th style="text-align:right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(item => `
                  <tr>
                    <td>${item.item_name}<br/><small>${item.item_name_ar || ''}</small></td>
                    <td style="text-align:center">${item.quantity}</td>
                    <td style="text-align:right">${(item.unit_price || 0).toFixed(3)}</td>
                    <td style="text-align:right">${(item.total_price || 0).toFixed(3)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="info">
              <div class="info-row"><span>Subtotal:</span><span>${(order.subtotal || 0).toFixed(3)}</span></div>
              <div class="info-row"><span>Tax (5%):</span><span>${(order.tax || 0).toFixed(3)}</span></div>
              ${order.service_charge > 0 ? `<div class="info-row"><span>Service:</span><span>${order.service_charge.toFixed(3)}</span></div>` : ''}
              ${order.delivery_fee > 0 ? `<div class="info-row"><span>Delivery:</span><span>${order.delivery_fee.toFixed(3)}</span></div>` : ''}
              <div class="info-row grand-total">
                <span>Grand Total / المجموع الإجمالي:</span>
                <span>KWD ${(order.total || 0).toFixed(3)}</span>
              </div>
            </div>
            <div class="footer">
              <p>Generated by RIWA POS</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'status-pending',
      accepted: 'status-accepted',
      preparing: 'status-preparing',
      ready: 'status-ready',
      out_for_delivery: 'status-preparing',
      completed: 'status-completed',
      cancelled: 'bg-red-500/20 text-red-400 border border-red-500/30',
    };
    
    const labels = {
      pending: t('Pending', 'معلق'),
      accepted: t('Accepted', 'مقبول'),
      preparing: t('Preparing', 'قيد التحضير'),
      ready: t('Ready', 'جاهز'),
      out_for_delivery: t('Out for Delivery', 'في الطريق'),
      completed: t('Completed', 'مكتمل'),
      cancelled: t('Cancelled', 'ملغي'),
    };
    
    return (
      <Badge className={styles[status] || styles.pending}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getNextStatus = (currentStatus) => {
    const flow = {
      pending: 'accepted',
      accepted: 'preparing',
      preparing: 'ready',
      ready: 'out_for_delivery',
      out_for_delivery: 'completed',
    };
    return flow[currentStatus];
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: Clock,
      accepted: Check,
      preparing: ChefHat,
      ready: Package,
      out_for_delivery: Truck,
      completed: Check,
    };
    const Icon = icons[status] || Clock;
    return <Icon className="w-4 h-4" />;
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const activeOrders = orders.filter(o => ['accepted', 'preparing', 'ready', 'out_for_delivery'].includes(o.status));
  const completedOrders = orders.filter(o => o.status === 'completed').slice(0, 10);

  return (
    <AdminLayout title={t('Orders', 'الطلبات')}>
      <div className="space-y-6">
        {/* Controls */}
        <div className={`flex items-center justify-between ${newOrderAlert ? 'animate-blink' : ''}`}>
          <div className="flex items-center gap-4">
            <Button
              variant={buzzerEnabled ? 'default' : 'outline'}
              onClick={() => setBuzzerEnabled(!buzzerEnabled)}
              className={buzzerEnabled ? 'bg-primary' : ''}
              data-testid="buzzer-toggle"
            >
              {buzzerEnabled ? <Volume2 className="w-4 h-4 mr-2" /> : <VolumeX className="w-4 h-4 mr-2" />}
              {t('Buzzer', 'المنبه')}
            </Button>
            
            {newOrderAlert && (
              <Button variant="destructive" onClick={stopBuzzer} className="animate-shake">
                {t('Stop Alert', 'إيقاف التنبيه')}
              </Button>
            )}
          </div>
          
          <Button variant="outline" onClick={loadOrders} data-testid="refresh-orders">
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('Refresh', 'تحديث')}
          </Button>
        </div>

        {/* Pending Orders */}
        {pendingOrders.length > 0 && (
          <div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-yellow-400">
              <Clock className="w-5 h-5" />
              {t('Pending Orders', 'الطلبات المعلقة')} ({pendingOrders.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingOrders.map((order) => (
                <Card
                  key={order.id}
                  className={`bg-card border-yellow-500/50 ${newOrderAlert ? 'animate-shake' : ''}`}
                  data-testid={`order-${order.id}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">#{order.order_number}</CardTitle>
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.order_type} • {new Date(order.created_at).toLocaleTimeString()}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xl font-bold text-primary ltr-nums">
                      {order.total?.toFixed(3)} KWD
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => updateOrderStatus(order.id, 'accepted')}
                        data-testid={`accept-${order.id}`}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        {t('Accept', 'قبول')}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => viewOrderDetails(order)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Active Orders */}
        {activeOrders.length > 0 && (
          <div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-400">
              <ChefHat className="w-5 h-5" />
              {t('Active Orders', 'الطلبات النشطة')} ({activeOrders.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeOrders.map((order) => (
                <Card key={order.id} className="bg-card border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">#{order.order_number}</CardTitle>
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.order_type} • {new Date(order.created_at).toLocaleTimeString()}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xl font-bold text-primary ltr-nums">
                      {order.total?.toFixed(3)} KWD
                    </div>
                    <div className="flex gap-2">
                      {getNextStatus(order.status) && (
                        <Button
                          className="flex-1 bg-primary"
                          onClick={() => updateOrderStatus(order.id, getNextStatus(order.status))}
                        >
                          {getStatusIcon(getNextStatus(order.status))}
                          <span className="ml-2">
                            {t(getNextStatus(order.status), getNextStatus(order.status))}
                          </span>
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => viewOrderDetails(order)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" onClick={() => printReceipt(order)}>
                        <Printer className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Completed Orders */}
        {completedOrders.length > 0 && (
          <div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-green-400">
              <Check className="w-5 h-5" />
              {t('Recent Completed', 'المكتملة حديثاً')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {completedOrders.map((order) => (
                <Card key={order.id} className="bg-card border-border/50 opacity-70">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">#{order.order_number}</p>
                        <p className="text-sm text-muted-foreground ltr-nums">
                          {order.total?.toFixed(3)} KWD
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => viewOrderDetails(order)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => printReceipt(order)}
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {orders.length === 0 && !loading && (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-xl">{t('No orders yet', 'لا توجد طلبات بعد')}</p>
          </div>
        )}
      </div>

      {/* Order Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {t('Order', 'الطلب')} #{selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                {/* Order Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t('Status', 'الحالة')}</p>
                    <p>{getStatusBadge(selectedOrder.status)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('Type', 'النوع')}</p>
                    <p>{selectedOrder.order_type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('Payment', 'الدفع')}</p>
                    <p>{selectedOrder.payment_method}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('Date', 'التاريخ')}</p>
                    <p className="ltr-nums">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                  </div>
                </div>

                {/* Customer Info */}
                {(selectedOrder.customer_name || selectedOrder.customer_phone) && (
                  <div className="border-t border-border/30 pt-4">
                    <h4 className="font-medium mb-2">{t('Customer', 'العميل')}</h4>
                    {selectedOrder.customer_name && <p>{selectedOrder.customer_name}</p>}
                    {selectedOrder.customer_phone && <p className="ltr-nums">{selectedOrder.customer_phone}</p>}
                    {selectedOrder.customer_address && <p>{selectedOrder.customer_address}</p>}
                  </div>
                )}

                {/* Items */}
                <div className="border-t border-border/30 pt-4">
                  <h4 className="font-medium mb-2">{t('Items', 'الأصناف')}</h4>
                  <div className="space-y-2">
                    {(selectedOrder.items || []).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start bg-secondary/30 p-3 rounded-lg">
                        <div>
                          <p className="font-medium">
                            {language === 'ar' ? item.item_name_ar || item.item_name : item.item_name}
                          </p>
                          {item.variant_name && (
                            <p className="text-sm text-muted-foreground">{item.variant_name}</p>
                          )}
                          {item.notes && (
                            <p className="text-sm text-yellow-400">📝 {item.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold ltr-nums">x{item.quantity}</p>
                          <p className="text-sm text-muted-foreground ltr-nums">
                            {item.total_price?.toFixed(3)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="border-t border-border/30 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('Subtotal', 'المجموع الفرعي')}</span>
                    <span className="ltr-nums">{selectedOrder.subtotal?.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('Tax', 'الضريبة')}</span>
                    <span className="ltr-nums">{selectedOrder.tax?.toFixed(3)}</span>
                  </div>
                  {selectedOrder.service_charge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('Service', 'الخدمة')}</span>
                      <span className="ltr-nums">{selectedOrder.service_charge?.toFixed(3)}</span>
                    </div>
                  )}
                  {selectedOrder.delivery_fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('Delivery', 'التوصيل')}</span>
                      <span className="ltr-nums">{selectedOrder.delivery_fee?.toFixed(3)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-border/30">
                    <span>{t('Total', 'الإجمالي')}</span>
                    <span className="text-primary ltr-nums">{selectedOrder.total?.toFixed(3)} KWD</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => printReceipt(selectedOrder)}
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    {t('Print Receipt', 'طباعة الإيصال')}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminOrders;
