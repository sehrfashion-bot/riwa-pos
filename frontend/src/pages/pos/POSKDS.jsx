import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import { toast } from 'sonner';
import { ArrowLeft, Volume2, VolumeX, Printer, Check, Clock, RefreshCw, ChefHat } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

const POSKDS = () => {
  const navigate = useNavigate();
  const { apiUrl, token } = useApp();
  const { t, language } = useLanguage();

  const [kdsItems, setKdsItems] = useState([]);
  const [station, setStation] = useState('all');
  const [loading, setLoading] = useState(true);
  const [buzzerEnabled, setBuzzerEnabled] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  
  const buzzerRef = useRef(null);
  const buzzerIntervalRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Initialize buzzer audio
  useEffect(() => {
    buzzerRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleWVLldfn3oBSTkWF2/TkjVQ1EniN6f/0nF42F0Juk/TznGQ1FUZukuzlmF46JUxkheLfmWVKN1Bfdtz/+sp8TzMaQZLD4/XUj0snCB6f4///5KFKKgAAzur//+WcRiwAANnw///jpkUuAADk9f//4aRHLwAA8Pn//9+hSzIAAPn8///do0wzAAD+/v//3KRNNQAA////3KRNNQAA');
    
    return () => {
      if (buzzerIntervalRef.current) {
        clearInterval(buzzerIntervalRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Load KDS items
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
      const prevCount = kdsItems.filter(i => i.status === 'pending').length;
      const newCount = (data.items || []).filter(i => i.status === 'pending').length;
      
      // Check for new orders
      if (newCount > prevCount && buzzerEnabled) {
        playBuzzer();
      }
      
      setKdsItems(data.items || []);
    } catch (error) {
      console.error('Failed to load KDS items:', error);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token, station, kdsItems.length, buzzerEnabled]);

  // Initial load and polling
  useEffect(() => {
    loadKDSItems();
    
    // Poll every 7 seconds as fallback
    pollIntervalRef.current = setInterval(loadKDSItems, 7000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [station]);

  // Buzzer functions
  const playBuzzer = () => {
    setNewOrderAlert(true);
    
    // Play buzzer sound in loop for 15 seconds
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
              Order: ${item.order?.order_number || 'N/A'}<br/>
              ${new Date(item.created_at).toLocaleString()}
            </div>
            <div class="item">
              <div class="qty">x${item.quantity}</div>
              <div><strong>${item.item_name}</strong></div>
              ${item.item_name_ar ? `<div>${item.item_name_ar}</div>` : ''}
              ${item.modifiers ? `<div class="modifiers">${JSON.parse(item.modifiers).map(m => m.name).join(', ')}</div>` : ''}
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

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className={`h-16 border-b border-border/30 flex items-center justify-between px-4 bg-card/50 backdrop-blur shrink-0 ${newOrderAlert ? 'animate-blink bg-primary/20' : ''}`}>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/pos/terminal')}
            data-testid="back-to-pos"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            {t('Back', 'رجوع')}
          </Button>
          <div className="flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">KDS</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Station Filter */}
          <Select value={station} onValueChange={setStation}>
            <SelectTrigger className="w-36 bg-card" data-testid="station-filter">
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
              onClick={stopBuzzer}
              className="animate-shake"
              data-testid="stop-alert"
            >
              {t('Stop Alert', 'إيقاف التنبيه')}
            </Button>
          )}
        </div>
      </header>

      {/* KDS Grid */}
      <ScrollArea className="flex-1 p-4">
        {Object.keys(groupedItems).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ChefHat className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-xl">{t('No pending orders', 'لا توجد طلبات معلقة')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Object.entries(groupedItems).map(([orderId, group]) => (
              <div
                key={orderId}
                className={`kds-card ${isUrgent(group.createdAt) ? 'urgent border-destructive' : 'border-border/50'}`}
                data-testid={`kds-order-${orderId}`}
              >
                {/* Order Header */}
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-border/30">
                  <div>
                    <h3 className="font-bold text-lg">
                      #{group.order?.order_number || orderId.slice(0, 8)}
                    </h3>
                    <Badge variant="outline" className="mt-1">
                      {group.order?.order_type || 'QSR'}
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
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg ${item.status === 'pending' ? 'bg-secondary/50' : 'bg-green-500/10'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-primary ltr-nums">
                              x{item.quantity}
                            </span>
                            <div>
                              <h4 className="font-semibold">
                                {language === 'ar' ? item.item_name_ar || item.item_name : item.item_name}
                              </h4>
                              {item.modifiers && JSON.parse(item.modifiers).length > 0 && (
                                <p className="text-sm text-muted-foreground">
                                  +{JSON.parse(item.modifiers).map(m => m.name).join(', ')}
                                </p>
                              )}
                              {item.notes && (
                                <p className="text-sm text-yellow-400">
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
                  ))}
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
