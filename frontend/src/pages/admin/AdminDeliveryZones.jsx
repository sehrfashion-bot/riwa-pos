import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import AdminLayout from './AdminLayout';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Save, Loader2, MapPin } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';

// Leaflet imports
import 'leaflet/dist/leaflet.css';

const AdminDeliveryZones = () => {
  const navigate = useNavigate();
  const { apiUrl, token, isAuthenticated } = useApp();
  const { t, language } = useLanguage();

  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  
  const [zoneForm, setZoneForm] = useState({
    zone_name: '',
    zone_name_ar: '',
    delivery_fee: 0,
    min_order_amount: 0,
    eta_minutes: 30,
    polygon: null,
    is_active: true,
  });

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawnItemsRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
      return;
    }
    loadZones();
  }, [isAuthenticated]);

  const loadZones = async () => {
    try {
      const response = await fetch(`${apiUrl}/admin/delivery-zones`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setZones(data.zones || []);
    } catch (error) {
      console.error('Failed to load zones:', error);
      toast.error(t('Failed to load delivery zones', 'فشل تحميل مناطق التوصيل'));
    } finally {
      setLoading(false);
    }
  };

  // Initialize map when modal opens
  useEffect(() => {
    if (modalOpen && mapRef.current && !mapInstanceRef.current) {
      initMap();
    }
    
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [modalOpen]);

  const initMap = async () => {
    const L = await import('leaflet');
    
    // Fix default marker icons
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });

    // Kuwait coordinates
    const kuwaitCenter = [29.3759, 47.9774];
    
    const map = L.map(mapRef.current).setView(kuwaitCenter, 11);
    mapInstanceRef.current = map;
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Initialize feature group for drawn items
    drawnItemsRef.current = new L.FeatureGroup();
    map.addLayer(drawnItemsRef.current);

    // Load existing polygon if editing
    if (editingZone?.polygon) {
      try {
        const geoJson = typeof editingZone.polygon === 'string' 
          ? JSON.parse(editingZone.polygon) 
          : editingZone.polygon;
        
        const layer = L.geoJSON(geoJson);
        drawnItemsRef.current.addLayer(layer);
        map.fitBounds(layer.getBounds());
      } catch (e) {
        console.error('Failed to parse polygon:', e);
      }
    }

    // Simple polygon drawing
    let drawing = false;
    let currentPolygon = null;
    let points = [];

    const drawInfo = L.control({ position: 'topright' });
    drawInfo.onAdd = function() {
      const div = L.DomUtil.create('div', 'leaflet-bar');
      div.innerHTML = `
        <div style="background: white; padding: 10px; border-radius: 4px;">
          <button id="startDraw" style="padding: 5px 10px; cursor: pointer; margin-right: 5px;">
            ${t('Draw Zone', 'رسم المنطقة')}
          </button>
          <button id="clearDraw" style="padding: 5px 10px; cursor: pointer;">
            ${t('Clear', 'مسح')}
          </button>
        </div>
      `;
      return div;
    };
    drawInfo.addTo(map);

    document.getElementById('startDraw')?.addEventListener('click', () => {
      drawing = true;
      points = [];
      drawnItemsRef.current.clearLayers();
      toast.info(t('Click on map to draw polygon. Double-click to finish.', 'انقر على الخريطة لرسم المضلع. انقر مرتين للإنهاء.'));
    });

    document.getElementById('clearDraw')?.addEventListener('click', () => {
      drawing = false;
      points = [];
      drawnItemsRef.current.clearLayers();
      setZoneForm(prev => ({ ...prev, polygon: null }));
    });

    map.on('click', (e) => {
      if (!drawing) return;
      
      points.push([e.latlng.lat, e.latlng.lng]);
      
      // Update polygon
      if (currentPolygon) {
        drawnItemsRef.current.removeLayer(currentPolygon);
      }
      
      if (points.length >= 2) {
        currentPolygon = L.polygon(points, { color: '#f59e0b' });
        drawnItemsRef.current.addLayer(currentPolygon);
      } else {
        L.circleMarker(e.latlng, { radius: 5, color: '#f59e0b' }).addTo(drawnItemsRef.current);
      }
    });

    map.on('dblclick', (e) => {
      if (!drawing || points.length < 3) return;
      
      drawing = false;
      
      // Convert to GeoJSON
      const geoJson = {
        type: 'Polygon',
        coordinates: [[...points.map(p => [p[1], p[0]]), [points[0][1], points[0][0]]]]
      };
      
      setZoneForm(prev => ({ ...prev, polygon: JSON.stringify(geoJson) }));
      toast.success(t('Polygon saved', 'تم حفظ المضلع'));
    });

    // Invalidate size after a short delay
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  };

  const openModal = (zone = null) => {
    setEditingZone(zone);
    if (zone) {
      setZoneForm({
        zone_name: zone.zone_name || '',
        zone_name_ar: zone.zone_name_ar || '',
        delivery_fee: zone.delivery_fee || 0,
        min_order_amount: zone.min_order_amount || 0,
        eta_minutes: zone.eta_minutes || 30,
        polygon: zone.polygon,
        is_active: zone.is_active !== false,
      });
    } else {
      setZoneForm({
        zone_name: '',
        zone_name_ar: '',
        delivery_fee: 0,
        min_order_amount: 0,
        eta_minutes: 30,
        polygon: null,
        is_active: true,
      });
    }
    setModalOpen(true);
  };

  const saveZone = async () => {
    if (!zoneForm.zone_name) {
      toast.error(t('Zone name is required', 'اسم المنطقة مطلوب'));
      return;
    }

    setSaving(true);
    try {
      const url = editingZone
        ? `${apiUrl}/admin/delivery-zones/${editingZone.id}`
        : `${apiUrl}/admin/delivery-zones`;
      
      const method = editingZone ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(zoneForm),
      });

      if (!response.ok) throw new Error('Failed to save zone');

      toast.success(t('Zone saved', 'تم حفظ المنطقة'));
      setModalOpen(false);
      loadZones();
    } catch (error) {
      toast.error(t('Failed to save zone', 'فشل حفظ المنطقة'));
    } finally {
      setSaving(false);
    }
  };

  const deleteZone = async (zoneId) => {
    if (!confirm(t('Delete this zone?', 'حذف هذه المنطقة؟'))) return;

    try {
      await fetch(`${apiUrl}/admin/delivery-zones/${zoneId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      toast.success(t('Zone deleted', 'تم حذف المنطقة'));
      loadZones();
    } catch (error) {
      toast.error(t('Failed to delete zone', 'فشل حذف المنطقة'));
    }
  };

  if (loading) {
    return (
      <AdminLayout title={t('Delivery Zones', 'مناطق التوصيل')}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={t('Delivery Zones', 'مناطق التوصيل')}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">
            {t('Define delivery coverage areas with polygon zones', 'حدد مناطق تغطية التوصيل بالمضلعات')}
          </p>
          <Button onClick={() => openModal()} className="bg-primary" data-testid="add-zone">
            <Plus className="w-4 h-4 mr-2" />
            {t('Add Zone', 'إضافة منطقة')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone) => (
            <Card key={zone.id} className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">
                        {language === 'ar' ? zone.zone_name_ar || zone.zone_name : zone.zone_name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {t('Fee', 'الرسوم')}: <span className="ltr-nums">{zone.delivery_fee?.toFixed(3)} KWD</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('Min Order', 'الحد الأدنى')}: <span className="ltr-nums">{zone.min_order_amount?.toFixed(3)} KWD</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('ETA', 'الوقت المتوقع')}: <span className="ltr-nums">{zone.eta_minutes}</span> {t('min', 'دقيقة')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openModal(zone)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => deleteZone(zone.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {zones.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <MapPin className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-xl">{t('No delivery zones yet', 'لا توجد مناطق توصيل بعد')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Zone Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingZone ? t('Edit Zone', 'تعديل المنطقة') : t('Add Zone', 'إضافة منطقة')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('Zone Name (English)', 'اسم المنطقة (إنجليزي)')}</Label>
                <Input
                  value={zoneForm.zone_name}
                  onChange={(e) => setZoneForm({ ...zoneForm, zone_name: e.target.value })}
                  className="mt-1 bg-secondary"
                  data-testid="zone-name"
                />
              </div>
              
              <div>
                <Label>{t('Zone Name (Arabic)', 'اسم المنطقة (عربي)')}</Label>
                <Input
                  value={zoneForm.zone_name_ar}
                  onChange={(e) => setZoneForm({ ...zoneForm, zone_name_ar: e.target.value })}
                  className="mt-1 bg-secondary"
                  dir="rtl"
                  data-testid="zone-name-ar"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>{t('Delivery Fee (KWD)', 'رسوم التوصيل')}</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={zoneForm.delivery_fee}
                  onChange={(e) => setZoneForm({ ...zoneForm, delivery_fee: parseFloat(e.target.value) || 0 })}
                  className="mt-1 bg-secondary ltr-nums"
                  data-testid="zone-fee"
                />
              </div>
              
              <div>
                <Label>{t('Min Order (KWD)', 'الحد الأدنى')}</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={zoneForm.min_order_amount}
                  onChange={(e) => setZoneForm({ ...zoneForm, min_order_amount: parseFloat(e.target.value) || 0 })}
                  className="mt-1 bg-secondary ltr-nums"
                  data-testid="zone-min"
                />
              </div>
              
              <div>
                <Label>{t('ETA (minutes)', 'الوقت المتوقع (دقائق)')}</Label>
                <Input
                  type="number"
                  value={zoneForm.eta_minutes}
                  onChange={(e) => setZoneForm({ ...zoneForm, eta_minutes: parseInt(e.target.value) || 30 })}
                  className="mt-1 bg-secondary ltr-nums"
                  data-testid="zone-eta"
                />
              </div>
            </div>
            
            {/* Map */}
            <div>
              <Label>{t('Zone Polygon', 'مضلع المنطقة')}</Label>
              <div 
                ref={mapRef} 
                className="mt-2 h-[300px] rounded-xl border border-border overflow-hidden"
                style={{ zIndex: 1 }}
              />
              {zoneForm.polygon && (
                <p className="text-sm text-green-400 mt-2">
                  ✓ {t('Polygon defined', 'تم تحديد المضلع')}
                </p>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setModalOpen(false)}
              >
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button
                className="flex-1 bg-primary"
                onClick={saveZone}
                disabled={saving}
                data-testid="save-zone"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {t('Save', 'حفظ')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminDeliveryZones;
