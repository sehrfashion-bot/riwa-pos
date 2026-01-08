import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { ArrowLeft, Volume2, VolumeX, Printer, Check, Clock, RefreshCw, ChefHat } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

// Supabase client for realtime
const supabaseUrl = 'https://sqhjsctsxlnivcbeclrn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxaGpzY3RzeGxuaXZjYmVjbHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODE5MjIsImV4cCI6MjA4MDE1NzkyMn0.X7Ad_4Uh4eA0zgNpZvYLh21oZbWIagbvPcNVrYS5WBo';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const POSKDS = () => {
  const navigate = useNavigate();
  const { apiUrl, token, user } = useApp();
  const { t, language } = useLanguage();

  const [kdsItems, setKdsItems] = useState([]);
  const [station, setStation] = useState('all');
  const [loading, setLoading] = useState(true);
  const [buzzerEnabled, setBuzzerEnabled] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  
  const buzzerRef = useRef(null);
  const buzzerIntervalRef = useRef(null);
  const subscriptionRef = useRef(null);

  // Initialize buzzer audio
  useEffect(() => {
    buzzerRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleWVLldfn3oBSTkWF2/TkjVQ1EniN6f/0nF42F0Juk/TznGQ1FUZukuzlmF46JUxkheLfmWVKN1Bfdtz/+sp8TzMaQZLD4/XUj0snCB6f4///5KFKKgAAzur//+WcRiwAANnw///jpkUuAADk9f//4aRHLwAA8Pn//9+hSzIAAPn8///do0wzAAD+/v//3KRNNQAA////3KRNNQAA');
    
    return () => {
      stopBuzzer();
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, []);

  // Load KDS items from API
  const loadKDSItems = useCallback(async () => {
    try {
      const endpoint = station === 'all' 
        ? `${apiUrl}/kds/items`
        : `${apiUrl}/kds/items?station=${station}`;
      
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to load KDS items');
      
      const data = await response.json();
      setKdsItems(data.items || []);
    } catch (error) {
      console.error('Failed to load KDS items:', error);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token, station]);

  // Setup Supabase realtime subscription
  useEffect(() => {
    loadKDSItems();

    // Subscribe to orders and order_items tables for real-time updates
    const ordersChannel = supabase
      .channel('kds-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Order change:', payload);
          // Reload items when orders change
          loadKDSItems();
          
          if (payload.eventType === 'INSERT' && buzzerEnabled) {
            playBuzzer();
            toast.info(t('New order received!', 'تم استلام طلب جديد!'));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items'
        },
        (payload) => {
          console.log('Order item change:', payload);
          // Reload items when order_items change
          loadKDSItems();
          
          if (payload.eventType === 'INSERT' && buzzerEnabled) {
            playBuzzer();
          }
        }
      )
      .subscribe((status) => {
        console.log('Supabase KDS subscription status:', status);
      });

    subscriptionRef.current = ordersChannel;

    return () => {
      if (ordersChannel) {
        supabase.removeChannel(ordersChannel);
      }
    };
  }, [station, buzzerEnabled]);

  // Buzzer functions
  const playBuzzer = () => {
    setNewOrderAlert(true);
    
    if (buzzerRef.current) {
      buzzerRef.current.play().catch(() => {});
      
      buzzerIntervalRef.current = setInterval(() => {
        buzzerRef.current.play().catch(() => {});
      }, 1000);
      
      // Stop after 15 seconds
      setTimeout(() => {
        stopBuzzer();
      }, 15000);
    }
  };

  const stopBuzzer = () => {
    setNewOrderAlert(false);
    if (buzzerIntervalRef.current) {
      clearInterval(buzzerIntervalRef.current);
      buzzerIntervalRef.current = null;
    }
  };

  // Bump item (mark as completed)
  const bumpItem = async (itemId) => {
    try {
      const response = await fetch(`${apiUrl}/kds/bump`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ kds_item_id: itemId }),
      });
      
      if (!response.ok) throw new Error('Failed to bump item');
      
      // Remove from local state immediately
      setKdsItems(items => items.filter(i => i.id !== itemId));
      toast.success(t('Item completed', 'تم إكمال الصنف'));
      stopBuzzer();
    } catch (error) {
      toast.error(t('Failed to complete item', 'فشل إكمال الصنف'));
    }
  };

  // Print ticket
  const printTicket = (item) => {
    const printWindow = window.open('', '_blank', 'width=300,height=400');
    if (printWindow) {
      const modifiers = typeof item.modifiers === 'string' ? JSON.parse(item.modifiers || '[]') : (item.modifiers || []);
      printWindow.document.write(`
        <html>
          <head>
            <title>KDS Ticket</title>
            <style>
              body { font-family: 'Courier New', monospace; font-size: 12px; padding: 10px; }
              .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; }
              .item { margin: 10px 0; }
              .qty { font-size: 24px; font-weight: bold; }
              .modifiers { font-size: 10px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <strong>KDS TICKET</strong><br/>
              Order: ${item.order_number || item.order?.order_number || 'N/A'}<br/>
              ${new Date(item.created_at).toLocaleString()}
            </div>
            <div class="item">
              <div class="qty">x${item.quantity}</div>
              <div><strong>${item.item_name}</strong></div>
              ${item.item_name_ar ? `<div>${item.item_name_ar}</div>` : ''}
              ${modifiers.length > 0 ? `<div class="modifiers">${modifiers.map(m => m.name).join(', ')}</div>` : ''}
              ${item.notes ? `<div class="modifiers">Note: ${item.notes}</div>` : ''}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Group items by order
  const groupedItems = kdsItems.reduce((acc, item) => {
    const orderId = item.order_id;
    if (!acc[orderId]) {
      acc[orderId] = {
        order: item.order,
        order_number: item.order_number || item.order?.order_number,
        items: [],
        createdAt: item.created_at,
      };
    }
    acc[orderId].items.push(item);
    return acc;
  }, {});

  // Get time since order
  const getTimeSince = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  };

  // Is order urgent (over 10 minutes)
  const isUrgent = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    return diff > 600; // 10 minutes
  };

  if (!user) {
    navigate('/pos');
    return null;
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className={`h-14 md:h-16 border-b border-border/30 flex items-center justify-between px-3 md:px-4 bg-card/50 backdrop-blur shrink-0 ${newOrderAlert ? 'animate-blink bg-primary/20' : ''}`}>
        <div className="flex items-center gap-2 md:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/pos/terminal')}
            data-testid="back-to-pos"
          >
            <ArrowLeft className="w-5 h-5 mr-1 md:mr-2" />
            <span className="hidden sm:inline">{t('Back', 'رجوع')}</span>
          </Button>
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 md:w-6 h-5 md:h-6 text-primary" />
            <h1 className="text-lg md:text-xl font-bold">KDS</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          {/* Station Filter */}
          <Select value={station} onValueChange={setStation}>
            <SelectTrigger className="w-28 md:w-36 bg-card" data-testid="station-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Stations', 'كل المحطات')}</SelectItem>
              <SelectItem value="main">{t('Main Kitchen', 'المطبخ الرئيسي')}</SelectItem>
              <SelectItem value="grill">{t('Grill', 'الشواية')}</SelectItem>
              <SelectItem value="fryer">{t('Fryer', 'القلاية')}</SelectItem>
              <SelectItem value="drinks">{t('Drinks', 'المشروبات')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Buzzer Toggle */}
          <Button
            variant={buzzerEnabled ? 'default' : 'outline'}
            size="icon"
            onClick={() => setBuzzerEnabled(!buzzerEnabled)}
            className={buzzerEnabled ? 'bg-primary' : ''}
            data-testid="buzzer-toggle"
          >
            {buzzerEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>

          {/* Refresh */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => loadKDSItems()}
            data-testid="refresh-kds"
          >
            <RefreshCw className="w-5 h-5" />
          </Button>

          {/* Stop Alert */}
          {newOrderAlert && (
            <Button
              variant="destructive"
              size="sm"
              onClick={stopBuzzer}
              className="animate-shake"
              data-testid="stop-alert"
            >
              {t('Stop', 'إيقاف')}
            </Button>
          )}
        </div>
      </header>

      {/* KDS Grid */}
      <ScrollArea className="flex-1 p-2 md:p-4">
        {Object.keys(groupedItems).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ChefHat className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-xl">{t('No pending orders', 'لا توجد طلبات معلقة')}</p>
            <p className="text-sm mt-2">{t('Orders will appear here in real-time', 'ستظهر الطلبات هنا مباشرة')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {Object.entries(groupedItems).map(([orderId, group]) => (
              <div
                key={orderId}
                className={`kds-card ${isUrgent(group.createdAt) ? 'urgent border-destructive animate-pulse' : 'border-border/50'}`}
                data-testid={`kds-order-${orderId}`}
              >
                {/* Order Header */}
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-border/30">
                  <div>
                    <h3 className="font-bold text-lg">
                      #{group.order_number || orderId.slice(0, 8)}
                    </h3>
                    <Badge variant="outline" className="mt-1">
                      {group.order?.order_type || 'qsr'}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className={`flex items-center gap-1 ${isUrgent(group.createdAt) ? 'text-destructive' : 'text-muted-foreground'}`}>
                      <Clock className="w-4 h-4" />
                      <span className="font-mono ltr-nums">{getTimeSince(group.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-3">
                  {group.items.map((item) => {
                    const modifiers = typeof item.modifiers === 'string' ? JSON.parse(item.modifiers || '[]') : (item.modifiers || []);
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg ${item.status === 'pending' ? 'bg-secondary/50' : 'bg-green-500/10'}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xl md:text-2xl font-bold text-primary ltr-nums">
                                x{item.quantity}
                              </span>
                              <div>
                                <h4 className="font-semibold text-sm md:text-base">
                                  {language === 'ar' ? item.item_name_ar || item.item_name : item.item_name}
                                </h4>
                                {modifiers.length > 0 && (
                                  <p className="text-xs md:text-sm text-muted-foreground">
                                    +{modifiers.map(m => m.name).join(', ')}
                                  </p>
                                )}
                                {item.notes && (
                                  <p className="text-xs md:text-sm text-yellow-400">
                                    📝 {item.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => printTicket(item)}
                              className="h-8 w-8"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            {item.status === 'pending' && (
                              <Button
                                variant="default"
                                size="icon"
                                onClick={() => bumpItem(item.id)}
                                className="h-8 w-8 bg-green-600 hover:bg-green-700"
                                data-testid={`bump-${item.id}`}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bump All */}
                {group.items.some(i => i.status === 'pending') && (
                  <Button
                    className="w-full mt-3 bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      group.items
                        .filter(i => i.status === 'pending')
                        .forEach(i => bumpItem(i.id));
                    }}
                    data-testid={`bump-all-${orderId}`}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {t('Bump All', 'إكمال الكل')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default POSKDS;
