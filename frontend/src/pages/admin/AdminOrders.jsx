import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import { createClient } from '@supabase/supabase-js';
import AdminLayout from './AdminLayout';
import { toast } from 'sonner';
import {
  Clock, Check, ChefHat, Truck, Package, Volume2, VolumeX,
  Printer, RefreshCw, Eye, ShoppingBag
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ScrollArea } from '../../components/ui/scroll-area';
import { printReceipt } from '../../utils/receipt';

// Supabase client for realtime
const supabaseUrl = 'https://sqhjsctsxlnivcbeclrn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxaGpzY3RzeGxuaXZjYmVjbHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODE5MjIsImV4cCI6MjA4MDE1NzkyMn0.X7Ad_4Uh4eA0zgNpZvYLh21oZbWIagbvPcNVrYS5WBo';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  const subscriptionRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
      return;
    }
    
    // Initialize buzzer
    buzzerRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleWVLldfn3oBSTkWF2/TkjVQ1EniN6f/0nF42F0Juk/TznGQ1FUZukuzlmF46JUxkheLfmWVKN1Bfdtz/+sp8TzMaQZLD4/XUj0snCB6f4///5KFKKgAAzur//+WcRiwAANnw///jpkUuAADk9f//4aRHLwAA8Pn//9+hSzIAAPn8///do0wzAAD+/v//3KRNNQAA////3KRNNQAA');
    
    loadOrders();

    // Subscribe to orders table changes
    const channel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('New order:', payload);
          const newOrder = payload.new;
          // Normalize fields
          newOrder.subtotal = newOrder.subtotal || 0;
          newOrder.tax = newOrder.tax_amount || 0;
          newOrder.total = newOrder.total_amount || 0;
          
          setOrders(prev => [newOrder, ...prev]);
          
          if (buzzerEnabled && newOrder.status === 'pending') {
            playBuzzer();
            toast.info(t('New order received!', 'تم استلام طلب جديد!'));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Order updated:', payload);
          const updatedOrder = payload.new;
          updatedOrder.subtotal = updatedOrder.subtotal || 0;
          updatedOrder.tax = updatedOrder.tax_amount || 0;
          updatedOrder.total = updatedOrder.total_amount || 0;
          
          setOrders(prev => 
            prev.map(order => 
              order.id === updatedOrder.id ? updatedOrder : order
            )
          );
        }
      )
      .subscribe((status) => {
        console.log('Orders subscription status:', status);
      });

    subscriptionRef.current = channel;
    
    return () => {
      stopBuzzer();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isAuthenticated, buzzerEnabled]);

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/orders?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to load orders');
      
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
      toast.error(t('Failed to load orders', 'فشل تحميل الطلبات'));
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token]);

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
      
      // Update local state
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status } : o
      ));
      
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
      
      if (!response.ok) throw new Error('Failed to load order');
      
      const data = await response.json();
      setSelectedOrder(data);
      setDetailsOpen(true);
    } catch (error) {
      toast.error(t('Failed to load order details', 'فشل تحميل تفاصيل الطلب'));
    }
  };

  // Use the receipt utility for printing
  const handlePrintReceipt = (order) => {
    const orderForPrint = {
      ...order,
      total: order.total || order.total_amount,
      payment_method: order.payment_method || 'cash',
      items: (order.items || []).map(item => ({
        name: item.item_name_en || item.item_name || item.name || 'Item',
        name_ar: item.item_name_ar,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      })),
    };
    printReceipt(orderForPrint, 'Admin', false);
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
        <div className={`flex flex-wrap items-center justify-between gap-4 ${newOrderAlert ? 'animate-blink' : ''}`}>
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
                      {(order.total || order.total_amount || 0).toFixed(3)} KWD
                    </div>
                    {order.customer_name && (
                      <p className="text-sm text-muted-foreground">
                        {order.customer_name} {order.customer_phone && `• ${order.customer_phone}`}
                      </p>
                    )}
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
                      {(order.total || order.total_amount || 0).toFixed(3)} KWD
                    </div>
                    <div className="flex gap-2">
                      {getNextStatus(order.status) && (
                        <Button
                          className="flex-1 bg-primary"
                          onClick={() => updateOrderStatus(order.id, getNextStatus(order.status))}
                        >
                          {getStatusIcon(getNextStatus(order.status))}
                          <span className="ml-2 capitalize">
                            {getNextStatus(order.status)?.replace(/_/g, ' ')}
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
                          {(order.total || order.total_amount || 0).toFixed(3)} KWD
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
            <p className="text-sm mt-2">{t('Orders will appear here in real-time', 'ستظهر الطلبات هنا مباشرة')}</p>
          </div>
        )}
      </div>

      {/* Order Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {t('Order', 'الطلب')} #{selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-4">
                {/* Order Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t('Status', 'الحالة')}</p>
                    <p>{getStatusBadge(selectedOrder.status)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('Type', 'النوع')}</p>
                    <p className="capitalize">{selectedOrder.order_type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('Payment', 'الدفع')}</p>
                    <p className="capitalize">{selectedOrder.payment_method || 'N/A'}</p>
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
                    {selectedOrder.delivery_address && <p>{selectedOrder.delivery_address}</p>}
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
                            {language === 'ar' ? item.item_name_ar || item.item_name : item.item_name || 'Item'}
                          </p>
                          {item.notes && (
                            <p className="text-sm text-yellow-400">📝 {item.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold ltr-nums">x{item.quantity}</p>
                          <p className="text-sm text-muted-foreground ltr-nums">
                            {(item.total_price || 0).toFixed(3)}
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
                    <span className="ltr-nums">{(selectedOrder.subtotal || 0).toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('Tax', 'الضريبة')}</span>
                    <span className="ltr-nums">{(selectedOrder.tax || selectedOrder.tax_amount || 0).toFixed(3)}</span>
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
                    <span className="text-primary ltr-nums">{(selectedOrder.total || selectedOrder.total_amount || 0).toFixed(3)} KWD</span>
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
