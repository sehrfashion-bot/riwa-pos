import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import AdminLayout from './AdminLayout';
import { toast } from 'sonner';
import {
  Plus, Edit2, Trash2, Save, X, Loader2, Image, GripVertical
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Switch } from '../../components/ui/switch';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

const AdminMenu = () => {
  const navigate = useNavigate();
  const { apiUrl, token, isAuthenticated } = useApp();
  const { t, language } = useLanguage();

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal states
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  // Form states
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    name_ar: '',
    image_url: '',
    is_active: true,
    sort_order: 0,
  });

  const [itemForm, setItemForm] = useState({
    name: '',
    name_ar: '',
    description: '',
    description_ar: '',
    category_id: '',
    price: 0,
    image_url: '',
    is_active: true,
    sort_order: 0,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
      return;
    }
    loadData();
  }, [isAuthenticated]);

  const loadData = async () => {
    try {
      const [catRes, itemsRes] = await Promise.all([
        fetch(`${apiUrl}/admin/categories`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/admin/items`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      
      const catData = await catRes.json();
      const itemsData = await itemsRes.json();
      
      setCategories(catData.categories || []);
      setItems(itemsData.items || []);
    } catch (error) {
      console.error('Failed to load menu data:', error);
      toast.error(t('Failed to load menu', 'فشل تحميل القائمة'));
    } finally {
      setLoading(false);
    }
  };

  // Category functions
  const openCategoryModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name || '',
        name_ar: category.name_ar || '',
        image_url: category.image_url || '',
        is_active: category.is_active !== false,
        sort_order: category.sort_order || 0,
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: '',
        name_ar: '',
        image_url: '',
        is_active: true,
        sort_order: categories.length,
      });
    }
    setCategoryModalOpen(true);
  };

  const saveCategory = async () => {
    if (!categoryForm.name) {
      toast.error(t('Category name is required', 'اسم الفئة مطلوب'));
      return;
    }

    setSaving(true);
    try {
      const url = editingCategory
        ? `${apiUrl}/admin/categories/${editingCategory.id}`
        : `${apiUrl}/admin/categories`;
      
      const method = editingCategory ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(categoryForm),
      });

      if (!response.ok) throw new Error('Failed to save category');

      toast.success(t('Category saved', 'تم حفظ الفئة'));
      setCategoryModalOpen(false);
      loadData();
    } catch (error) {
      toast.error(t('Failed to save category', 'فشل حفظ الفئة'));
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (categoryId) => {
    if (!confirm(t('Delete this category?', 'حذف هذه الفئة؟'))) return;

    try {
      await fetch(`${apiUrl}/admin/categories/${categoryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      toast.success(t('Category deleted', 'تم حذف الفئة'));
      loadData();
    } catch (error) {
      toast.error(t('Failed to delete category', 'فشل حذف الفئة'));
    }
  };

  // Item functions
  const openItemModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setItemForm({
        name: item.name || '',
        name_ar: item.name_ar || '',
        description: item.description || '',
        description_ar: item.description_ar || '',
        category_id: item.category_id || '',
        price: item.price || 0,
        image_url: item.image_url || '',
        is_active: item.is_active !== false,
        sort_order: item.sort_order || 0,
      });
    } else {
      setEditingItem(null);
      setItemForm({
        name: '',
        name_ar: '',
        description: '',
        description_ar: '',
        category_id: categories[0]?.id || '',
        price: 0,
        image_url: '',
        is_active: true,
        sort_order: items.length,
      });
    }
    setItemModalOpen(true);
  };

  const saveItem = async () => {
    if (!itemForm.name || !itemForm.category_id) {
      toast.error(t('Name and category are required', 'الاسم والفئة مطلوبان'));
      return;
    }

    setSaving(true);
    try {
      const url = editingItem
        ? `${apiUrl}/admin/items/${editingItem.id}`
        : `${apiUrl}/admin/items`;
      
      const method = editingItem ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(itemForm),
      });

      if (!response.ok) throw new Error('Failed to save item');

      toast.success(t('Item saved', 'تم حفظ الصنف'));
      setItemModalOpen(false);
      loadData();
    } catch (error) {
      toast.error(t('Failed to save item', 'فشل حفظ الصنف'));
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (itemId) => {
    if (!confirm(t('Delete this item?', 'حذف هذا الصنف؟'))) return;

    try {
      await fetch(`${apiUrl}/admin/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      toast.success(t('Item deleted', 'تم حذف الصنف'));
      loadData();
    } catch (error) {
      toast.error(t('Failed to delete item', 'فشل حذف الصنف'));
    }
  };

  const getCategoryName = (categoryId) => {
    const cat = categories.find(c => c.id === categoryId);
    return language === 'ar' ? cat?.name_ar || cat?.name : cat?.name || 'Unknown';
  };

  if (loading) {
    return (
      <AdminLayout title={t('Menu Manager', 'إدارة القائمة')}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={t('Menu Manager', 'إدارة القائمة')}>
      <Tabs defaultValue="categories" className="space-y-6">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="categories" data-testid="tab-categories">
            {t('Categories', 'الفئات')} ({categories.length})
          </TabsTrigger>
          <TabsTrigger value="items" data-testid="tab-items">
            {t('Items', 'الأصناف')} ({items.length})
          </TabsTrigger>
        </TabsList>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">{t('Menu Categories', 'فئات القائمة')}</h3>
            <Button onClick={() => openCategoryModal()} className="bg-primary" data-testid="add-category">
              <Plus className="w-4 h-4 mr-2" />
              {t('Add Category', 'إضافة فئة')}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <Card key={category.id} className="bg-card border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg bg-secondary overflow-hidden flex items-center justify-center">
                      {category.image_url ? (
                        <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" />
                      ) : (
                        <Image className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">
                        {language === 'ar' ? category.name_ar || category.name : category.name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {items.filter(i => i.category_id === category.id).length} {t('items', 'أصناف')}
                      </p>
                      <p className={`text-xs ${category.is_active ? 'text-green-400' : 'text-red-400'}`}>
                        {category.is_active ? t('Active', 'نشط') : t('Inactive', 'غير نشط')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openCategoryModal(category)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => deleteCategory(category.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {categories.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                {t('No categories yet', 'لا توجد فئات بعد')}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">{t('Menu Items', 'أصناف القائمة')}</h3>
            <Button onClick={() => openItemModal()} className="bg-primary" data-testid="add-item">
              <Plus className="w-4 h-4 mr-2" />
              {t('Add Item', 'إضافة صنف')}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <Card key={item.id} className="bg-card border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg bg-secondary overflow-hidden flex items-center justify-center">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Image className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">
                        {language === 'ar' ? item.name_ar || item.name : item.name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {getCategoryName(item.category_id)}
                      </p>
                      <p className="text-primary font-bold ltr-nums">
                        {item.price?.toFixed(3)} KWD
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openItemModal(item)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => deleteItem(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {items.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                {t('No items yet', 'لا توجد أصناف بعد')}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Category Modal */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? t('Edit Category', 'تعديل الفئة') : t('Add Category', 'إضافة فئة')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>{t('Name (English)', 'الاسم (إنجليزي)')}</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                className="mt-1 bg-secondary"
                data-testid="category-name"
              />
            </div>
            
            <div>
              <Label>{t('Name (Arabic)', 'الاسم (عربي)')}</Label>
              <Input
                value={categoryForm.name_ar}
                onChange={(e) => setCategoryForm({ ...categoryForm, name_ar: e.target.value })}
                className="mt-1 bg-secondary"
                dir="rtl"
                data-testid="category-name-ar"
              />
            </div>
            
            <div>
              <Label>{t('Image URL', 'رابط الصورة')}</Label>
              <Input
                value={categoryForm.image_url}
                onChange={(e) => setCategoryForm({ ...categoryForm, image_url: e.target.value })}
                className="mt-1 bg-secondary"
                placeholder="https://..."
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={categoryForm.is_active}
                onCheckedChange={(v) => setCategoryForm({ ...categoryForm, is_active: v })}
              />
              <Label>{t('Active', 'نشط')}</Label>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCategoryModalOpen(false)}
              >
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button
                className="flex-1 bg-primary"
                onClick={saveCategory}
                disabled={saving}
                data-testid="save-category"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {t('Save', 'حفظ')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Modal */}
      <Dialog open={itemModalOpen} onOpenChange={setItemModalOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? t('Edit Item', 'تعديل الصنف') : t('Add Item', 'إضافة صنف')}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-2">
              <div>
                <Label>{t('Name (English)', 'الاسم (إنجليزي)')}</Label>
                <Input
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="mt-1 bg-secondary"
                  data-testid="item-name"
                />
              </div>
              
              <div>
                <Label>{t('Name (Arabic)', 'الاسم (عربي)')}</Label>
                <Input
                  value={itemForm.name_ar}
                  onChange={(e) => setItemForm({ ...itemForm, name_ar: e.target.value })}
                  className="mt-1 bg-secondary"
                  dir="rtl"
                  data-testid="item-name-ar"
                />
              </div>
              
              <div>
                <Label>{t('Category', 'الفئة')}</Label>
                <Select
                  value={itemForm.category_id}
                  onValueChange={(v) => setItemForm({ ...itemForm, category_id: v })}
                >
                  <SelectTrigger className="mt-1 bg-secondary" data-testid="item-category">
                    <SelectValue placeholder={t('Select category', 'اختر الفئة')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {language === 'ar' ? cat.name_ar || cat.name : cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>{t('Price (KWD)', 'السعر (د.ك)')}</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={itemForm.price}
                  onChange={(e) => setItemForm({ ...itemForm, price: parseFloat(e.target.value) || 0 })}
                  className="mt-1 bg-secondary ltr-nums"
                  data-testid="item-price"
                />
              </div>
              
              <div>
                <Label>{t('Description (English)', 'الوصف (إنجليزي)')}</Label>
                <Input
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  className="mt-1 bg-secondary"
                />
              </div>
              
              <div>
                <Label>{t('Description (Arabic)', 'الوصف (عربي)')}</Label>
                <Input
                  value={itemForm.description_ar}
                  onChange={(e) => setItemForm({ ...itemForm, description_ar: e.target.value })}
                  className="mt-1 bg-secondary"
                  dir="rtl"
                />
              </div>
              
              <div>
                <Label>{t('Image URL', 'رابط الصورة')}</Label>
                <Input
                  value={itemForm.image_url}
                  onChange={(e) => setItemForm({ ...itemForm, image_url: e.target.value })}
                  className="mt-1 bg-secondary"
                  placeholder="https://..."
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={itemForm.is_active}
                  onCheckedChange={(v) => setItemForm({ ...itemForm, is_active: v })}
                />
                <Label>{t('Active', 'نشط')}</Label>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setItemModalOpen(false)}
                >
                  {t('Cancel', 'إلغاء')}
                </Button>
                <Button
                  className="flex-1 bg-primary"
                  onClick={saveItem}
                  disabled={saving}
                  data-testid="save-item"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {t('Save', 'حفظ')}
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminMenu;
