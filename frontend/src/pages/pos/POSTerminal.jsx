import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import { toast } from 'sonner';
import { createClient } from '@supabase/supabase-js';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote,
  User, LogOut, Settings, ChefHat, X, Check, Loader2, Menu as MenuIcon
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Badge } from '../../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../../components/ui/sheet';

// Supabase client for realtime
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://sqhjsctsxlnivcbeclrn.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxaGpzY3RzeGxuaXZjYmVjbHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODE5MjIsImV4cCI6MjA4MDE1NzkyMn0.X7Ad_4Uh4eA0zgNpZvYLh21oZbWIagbvPcNVrYS5WBo';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const POSTerminal = () => {
  const navigate = useNavigate();
  const { user, token, logout, apiUrl } = useApp();
  const { t, language, isRTL } = useLanguage();

  // State
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState('qsr');
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  
  // Modals
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedModifiers, setSelectedModifiers] = useState([]);
  const [itemNotes, setItemNotes] = useState('');
  
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [processingOrder, setProcessingOrder] = useState(false);

  const searchInputRef = useRef(null);

  // Load menu data
  useEffect(() => {
    if (!user) {
      navigate('/pos');
      return;
    }
    loadMenu();
  }, [user]);

  const loadMenu = async () => {
    try {
      const [catRes, itemsRes] = await Promise.all([
        fetch(`${apiUrl}/menu/categories`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${apiUrl}/menu/items`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
      ]);
      
      const catData = await catRes.json();
      const itemsData = await itemsRes.json();
      
      setCategories(catData.categories || []);
      setItems(itemsData.items || []);
      
      if (catData.categories?.length > 0 && !selectedCategory) {
        setSelectedCategory(catData.categories[0].id);
      }
    } catch (error) {
      console.error('Failed to load menu:', error);
      toast.error(t('Failed to load menu', 'فشل تحميل القائمة'));
    } finally {
      setLoading(false);
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesCategory = !selectedCategory || item.category_id === selectedCategory;
    const matchesSearch = !searchQuery || 
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name_ar?.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  // Cart functions
  const addToCart = useCallback(() => {
    if (!selectedItem) return;
    
    const cartItem = {
      id: `${selectedItem.id}-${Date.now()}`,
      item_id: selectedItem.id,
      name: selectedItem.name,
      name_ar: selectedItem.name_ar,
      variant_id: selectedVariant?.id,
      variant_name: selectedVariant?.name,
      quantity: itemQuantity,
      unit_price: selectedVariant?.price || selectedItem.price || 0,
      modifiers: selectedModifiers,
      notes: itemNotes,
      total_price: calculateItemTotal(),
    };
    
    setCart([...cart, cartItem]);
    closeItemModal();
    toast.success(t('Added to cart', 'تمت الإضافة للسلة'));
  }, [selectedItem, selectedVariant, selectedModifiers, itemQuantity, itemNotes, cart]);

  const removeFromCart = (itemId) => {
    setCart(cart.filter((item) => item.id !== itemId));
  };

  const updateCartItemQuantity = (itemId, delta) => {
    setCart(cart.map((item) => {
      if (item.id === itemId) {
        const newQty = Math.max(1, item.quantity + delta);
        return {
          ...item,
          quantity: newQty,
          total_price: item.unit_price * newQty + 
            item.modifiers.reduce((sum, m) => sum + (m.price || 0), 0) * newQty,
        };
      }
      return item;
    }));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
  const taxRate = 0.05; // 5% VAT
  const tax = subtotal * taxRate;
  const serviceCharge = orderType === 'qsr' ? 0 : subtotal * 0.1;
  const deliveryFee = orderType === 'delivery' ? 1.5 : 0;
  const total = subtotal + tax + serviceCharge + deliveryFee;
  const changeDue = paymentMethod === 'cash' && cashReceived ? parseFloat(cashReceived) - total : 0;

  const calculateItemTotal = () => {
    if (!selectedItem) return 0;
    const basePrice = selectedVariant?.price || selectedItem.price || 0;
    const modifiersPrice = selectedModifiers.reduce((sum, m) => sum + (m.price || 0), 0);
    return (basePrice + modifiersPrice) * itemQuantity;
  };

  // Item modal functions
  const openItemModal = async (item) => {
    setSelectedItem(item);
    setItemQuantity(1);
    setSelectedVariant(null);
    setSelectedModifiers([]);
    setItemNotes('');
    setItemModalOpen(true);
    
    try {
      const response = await fetch(`${apiUrl}/menu/item/${item.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setSelectedItem(data);
      if (data.variants?.length > 0) {
        setSelectedVariant(data.variants[0]);
      }
    } catch (error) {
      console.error('Failed to load item details:', error);
    }
  };

  const closeItemModal = () => {
    setItemModalOpen(false);
    setSelectedItem(null);
    setSelectedVariant(null);
    setSelectedModifiers([]);
    setItemNotes('');
    setItemQuantity(1);
  };

  const toggleModifier = (modifier, group) => {
    const existing = selectedModifiers.find(m => m.id === modifier.id);
    if (existing) {
      setSelectedModifiers(selectedModifiers.filter(m => m.id !== modifier.id));
    } else {
      const groupModifiers = selectedModifiers.filter(m => m.group_id === group.id);
      if (group.max_selections && groupModifiers.length >= group.max_selections) {
        setSelectedModifiers([
          ...selectedModifiers.filter(m => m.group_id !== group.id),
          { ...modifier, group_id: group.id }
        ]);
      } else {
        setSelectedModifiers([...selectedModifiers, { ...modifier, group_id: group.id }]);
      }
    }
  };

  // Payment functions
  const openPaymentModal = () => {
    if (cart.length === 0) {
      toast.error(t('Cart is empty', 'السلة فارغة'));
      return;
    }
    setCartOpen(false);
    setPaymentModalOpen(true);
    setCashReceived('');
  };

  const closePaymentModal = () => {
    setPaymentModalOpen(false);
    setCashReceived('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
  };

  const processOrder = async () => {
    if (paymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < total)) {
      toast.error(t('Insufficient cash amount', 'المبلغ النقدي غير كافٍ'));
      return;
    }

    setProcessingOrder(true);

    const orderData = {
      order_type: orderType,
      items: cart.map(item => ({
        item_id: item.item_id,
        name: item.name,
        name_ar: item.name_ar,
        variant_id: item.variant_id,
        variant_name: item.variant_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        modifiers: item.modifiers,
        notes: item.notes,
      })),
      subtotal,
      tax,
      service_charge: serviceCharge,
      delivery_fee: deliveryFee,
      total,
      payment_method: paymentMethod,
      cash_received: paymentMethod === 'cash' ? parseFloat(cashReceived) : null,
      change_due: changeDue > 0 ? changeDue : null,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      customer_address: orderType === 'delivery' ? customerAddress : null,
    };

    try {
      const response = await fetch(`${apiUrl}/orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) throw new Error('Order creation failed');

      const data = await response.json();
      
      toast.success(
        t(`Order ${data.order.order_number} created!`, `تم إنشاء الطلب ${data.order.order_number}!`)
      );
      
      clearCart();
      closePaymentModal();
      
    } catch (error) {
      console.error('Order failed:', error);
      toast.error(t('Failed to create order', 'فشل إنشاء الطلب'));
    } finally {
      setProcessingOrder(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/pos');
  };

  const quickCashAmounts = [5, 10, 20, 50];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  // Cart component for both sidebar and sheet
  const CartContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full">
      {/* Cart Header */}
      <div className="p-4 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <span className="font-semibold">
            {t('Cart', 'السلة')} ({cart.length})
          </span>
        </div>
        {cart.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCart}
            className="text-destructive"
            data-testid="clear-cart"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Cart Items */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('Cart is empty', 'السلة فارغة')}
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="bg-card rounded-lg p-3 border border-border/30"
                data-testid={`cart-item-${item.id}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">
                      {language === 'ar' ? item.name_ar || item.name : item.name}
                    </h4>
                    {item.variant_name && (
                      <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                    )}
                    {item.modifiers?.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        +{item.modifiers.map(m => m.name).join(', ')}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeFromCart(item.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateCartItemQuantity(item.id, -1)}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="w-8 text-center font-medium ltr-nums">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateCartItemQuantity(item.id, 1)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <span className="font-bold text-primary ltr-nums">
                    {item.total_price.toFixed(3)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Cart Footer */}
      <div className="p-4 border-t border-border/30 space-y-3">
        {/* Totals */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('Subtotal', 'المجموع الفرعي')}</span>
            <span className="ltr-nums">{subtotal.toFixed(3)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('Tax (5%)', 'الضريبة (5%)')}</span>
            <span className="ltr-nums">{tax.toFixed(3)}</span>
          </div>
          {serviceCharge > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('Service (10%)', 'الخدمة (10%)')}</span>
              <span className="ltr-nums">{serviceCharge.toFixed(3)}</span>
            </div>
          )}
          {deliveryFee > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('Delivery', 'التوصيل')}</span>
              <span className="ltr-nums">{deliveryFee.toFixed(3)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-2 border-t border-border/30">
            <span>{t('Total', 'الإجمالي')}</span>
            <span className="text-primary ltr-nums">{total.toFixed(3)} {t('KWD', 'د.ك')}</span>
          </div>
        </div>

        {/* Pay Button */}
        <Button
          className="w-full h-14 text-lg btn-primary"
          onClick={openPaymentModal}
          disabled={cart.length === 0}
          data-testid="pay-button"
        >
          <CreditCard className="w-5 h-5 mr-2" />
          {t('Pay', 'الدفع')} {total.toFixed(3)}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="h-14 md:h-16 border-b border-border/30 flex items-center justify-between px-3 md:px-4 bg-card/50 backdrop-blur shrink-0">
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="text-lg md:text-xl font-bold text-primary">RIWA POS</h1>
          <div className="hidden sm:flex items-center gap-1 md:gap-2">
            {['qsr', 'takeaway', 'delivery'].map((type) => (
              <Button
                key={type}
                variant={orderType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOrderType(type)}
                className={`text-xs md:text-sm ${orderType === type ? 'bg-primary text-primary-foreground' : ''}`}
                data-testid={`order-type-${type}`}
              >
                {t(type.charAt(0).toUpperCase() + type.slice(1), type === 'qsr' ? 'سريع' : type === 'takeaway' ? 'استلام' : 'توصيل')}
              </Button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-1 md:gap-2">
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
            <span>{user?.name || 'Cashier'}</span>
          </div>
          
          {/* Mobile Cart Button - visible on screens smaller than lg (1024px) */}
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden relative"
                data-testid="mobile-cart-button"
              >
                <ShoppingCart className="w-5 h-5" />
                {cart.length > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-primary text-xs">
                    {cart.length}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side={isRTL ? 'left' : 'right'} className="w-full sm:w-96 p-0">
              <CartContent isMobile={true} />
            </SheetContent>
          </Sheet>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/pos/kds')}
            data-testid="kds-button"
          >
            <ChefHat className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/pos/settings')}
            data-testid="settings-button"
            className="hidden sm:flex"
          >
            <Settings className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            data-testid="logout-button"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Mobile Order Type Selection */}
      <div className="sm:hidden p-2 border-b border-border/30 flex gap-2 overflow-x-auto">
        {['qsr', 'takeaway', 'delivery'].map((type) => (
          <Button
            key={type}
            variant={orderType === type ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOrderType(type)}
            className={`shrink-0 ${orderType === type ? 'bg-primary text-primary-foreground' : ''}`}
          >
            {t(type.charAt(0).toUpperCase() + type.slice(1), type === 'qsr' ? 'سريع' : type === 'takeaway' ? 'استلام' : 'توصيل')}
          </Button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Menu Section */}
        <div className={`flex-1 flex flex-col overflow-hidden`}>
          {/* Search */}
          <div className="p-3 md:p-4 border-b border-border/30">
            <div className="relative">
              <Search className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
              <Input
                ref={searchInputRef}
                placeholder={t('Search items...', 'البحث عن الأصناف...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`h-10 md:h-12 bg-card ${isRTL ? 'pr-10' : 'pl-10'}`}
                data-testid="search-input"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="p-2 md:p-4 border-b border-border/30 overflow-x-auto">
            <div className="flex gap-2 pb-1">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'secondary'}
                  size="sm"
                  className={`shrink-0 ${selectedCategory === category.id ? 'bg-primary text-primary-foreground' : ''}`}
                  onClick={() => setSelectedCategory(category.id)}
                  data-testid={`category-${category.id}`}
                >
                  {language === 'ar' ? category.name_ar || category.name : category.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Items Grid */}
          <ScrollArea className="flex-1 p-2 md:p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openItemModal(item)}
                  className="pos-item-card border border-border/30 text-left p-2 md:p-4"
                  data-testid={`item-${item.id}`}
                >
                  {item.image_url && (
                    <div className="aspect-square rounded-lg bg-secondary/50 mb-2 md:mb-3 overflow-hidden">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <h3 className="font-semibold text-xs md:text-sm mb-1 line-clamp-2">
                    {language === 'ar' ? item.name_ar || item.name : item.name}
                  </h3>
                  <p className="text-primary font-bold text-sm md:text-base ltr-nums">
                    {(item.price || 0).toFixed(3)} {t('KWD', 'د.ك')}
                  </p>
                </button>
              ))}
              {filteredItems.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  {t('No items found', 'لم يتم العثور على أصناف')}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Cart Sidebar - Desktop Only */}
        <div className={`hidden md:flex w-80 lg:w-96 flex-col pos-sidebar ${isRTL ? 'border-r' : 'border-l'} border-border/30`}>
          <CartContent />
        </div>
      </div>

      {/* Mobile Cart Summary Bar */}
      {cart.length > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border/30 p-3 flex items-center justify-between z-50">
          <div>
            <p className="text-sm text-muted-foreground">{cart.length} {t('items', 'أصناف')}</p>
            <p className="font-bold text-lg text-primary ltr-nums">{total.toFixed(3)} {t('KWD', 'د.ك')}</p>
          </div>
          <Button
            className="btn-primary h-12 px-6"
            onClick={() => setCartOpen(true)}
            data-testid="view-cart-button"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            {t('View Cart', 'عرض السلة')}
          </Button>
        </div>
      )}

      {/* Item Modal */}
      <Dialog open={itemModalOpen} onOpenChange={setItemModalOpen}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedItem && (language === 'ar' ? selectedItem.name_ar || selectedItem.name : selectedItem.name)}
            </DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              {/* Variants */}
              {selectedItem.variants?.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t('Size / Variant', 'الحجم / النوع')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.variants.map((variant) => (
                      <Button
                        key={variant.id}
                        variant={selectedVariant?.id === variant.id ? 'default' : 'outline'}
                        size="sm"
                        className={selectedVariant?.id === variant.id ? 'bg-primary' : ''}
                        onClick={() => setSelectedVariant(variant)}
                        data-testid={`variant-${variant.id}`}
                      >
                        {variant.name} - {variant.price?.toFixed(3)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Modifier Groups */}
              {selectedItem.modifier_groups?.map((group) => (
                <div key={group.id}>
                  <label className="text-sm font-medium mb-2 block">
                    {language === 'ar' ? group.name_ar || group.name : group.name}
                    {group.is_required && <span className="text-destructive ml-1">*</span>}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {group.modifiers?.map((modifier) => {
                      const isSelected = selectedModifiers.some(m => m.id === modifier.id);
                      return (
                        <Button
                          key={modifier.id}
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          className={isSelected ? 'bg-primary' : ''}
                          onClick={() => toggleModifier(modifier, group)}
                          data-testid={`modifier-${modifier.id}`}
                        >
                          {modifier.name}
                          {modifier.price > 0 && ` +${modifier.price.toFixed(3)}`}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Quantity */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t('Quantity', 'الكمية')}
                </label>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                    data-testid="qty-minus"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="text-2xl font-bold w-12 text-center ltr-nums">
                    {itemQuantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setItemQuantity(itemQuantity + 1)}
                    data-testid="qty-plus"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t('Special Notes', 'ملاحظات خاصة')}
                </label>
                <Input
                  placeholder={t('e.g. No onions', 'مثال: بدون بصل')}
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="bg-secondary"
                  data-testid="item-notes"
                />
              </div>

              {/* Add Button */}
              <Button
                className="w-full h-14 text-lg btn-primary"
                onClick={addToCart}
                data-testid="add-to-cart"
              >
                {t('Add to Cart', 'أضف للسلة')} - {calculateItemTotal().toFixed(3)} {t('KWD', 'د.ك')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('Payment', 'الدفع')}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Payment Method */}
            <div className="flex gap-2">
              <Button
                variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                className={`flex-1 h-12 ${paymentMethod === 'cash' ? 'bg-primary' : ''}`}
                onClick={() => setPaymentMethod('cash')}
                data-testid="payment-cash"
              >
                <Banknote className="w-5 h-5 mr-2" />
                {t('Cash', 'نقداً')}
              </Button>
              <Button
                variant={paymentMethod === 'card' ? 'default' : 'outline'}
                className={`flex-1 h-12 ${paymentMethod === 'card' ? 'bg-primary' : ''}`}
                onClick={() => setPaymentMethod('card')}
                data-testid="payment-card"
              >
                <CreditCard className="w-5 h-5 mr-2" />
                {t('Card', 'بطاقة')}
              </Button>
            </div>

            {/* Customer Info for Delivery */}
            {orderType === 'delivery' && (
              <div className="space-y-3">
                <Input
                  placeholder={t('Customer Name', 'اسم العميل')}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-12 bg-secondary"
                  data-testid="customer-name"
                />
                <Input
                  placeholder={t('Phone Number', 'رقم الهاتف')}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="h-12 bg-secondary"
                  data-testid="customer-phone"
                />
                <Input
                  placeholder={t('Delivery Address', 'عنوان التوصيل')}
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="h-12 bg-secondary"
                  data-testid="customer-address"
                />
              </div>
            )}

            {/* Cash Amount */}
            {paymentMethod === 'cash' && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t('Cash Received', 'المبلغ المستلم')}
                </label>
                <Input
                  type="number"
                  step="0.001"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="h-14 text-xl text-center bg-secondary ltr-nums"
                  placeholder="0.000"
                  data-testid="cash-received"
                />
                <div className="flex gap-2 mt-2">
                  {quickCashAmounts.map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      className="flex-1"
                      onClick={() => setCashReceived(amount.toString())}
                    >
                      {amount}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setCashReceived(Math.ceil(total).toString())}
                  >
                    {Math.ceil(total)}
                  </Button>
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-lg">
                <span>{t('Total', 'الإجمالي')}</span>
                <span className="font-bold ltr-nums">{total.toFixed(3)} {t('KWD', 'د.ك')}</span>
              </div>
              {paymentMethod === 'cash' && cashReceived && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('Received', 'المستلم')}</span>
                    <span className="ltr-nums">{parseFloat(cashReceived).toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-lg border-t border-border pt-2">
                    <span>{t('Change', 'الباقي')}</span>
                    <span className={`font-bold ltr-nums ${changeDue >= 0 ? 'text-green-400' : 'text-destructive'}`}>
                      {changeDue.toFixed(3)} {t('KWD', 'د.ك')}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Confirm Button */}
            <Button
              className="w-full h-14 text-lg btn-primary"
              onClick={processOrder}
              disabled={processingOrder || (paymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < total))}
              data-testid="confirm-payment"
            >
              {processingOrder ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  {t('Confirm Payment', 'تأكيد الدفع')}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POSTerminal;
